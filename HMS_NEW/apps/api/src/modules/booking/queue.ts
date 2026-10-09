// The doctor's daily queue: call the next patient (emergency → VIP → senior citizen → normal, then
// token order), start the consultation, complete it (completes the appointment), or skip.
import { sql, type DB, type Kysely } from '@hms/db';
import { notFound, preconditionFailed, runCommand, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { practitionerResourceId } from './calendar.ts';

export interface QueueEntry {
  tokenId: string;
  tokenNo: number;
  patientId: string;
  appointmentId: string | null;
  priority: string;
  status: string;
}

const PRIORITY_ORDER = sql`CASE priority WHEN 'emergency' THEN 0 WHEN 'vip' THEN 1 WHEN 'senior_citizen' THEN 2 ELSE 3 END`;

/** Calls the next waiting patient for a doctor at a facility on a day; null when nobody is waiting. */
export async function callNext(db: Kysely<DB>, caller: Caller, input: { staffId: string; facilityId: string; sessionOn: string }): Promise<QueueEntry | null> {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.call_next', request: input }, async (ctx) => {
    const resourceId = await practitionerResourceId(ctx.tx, input.staffId);
    // SKIP LOCKED: two screens pressing "next" at once get two different patients.
    const next = await ctx.tx
      .selectFrom('booking.queue_token')
      .select(['id', 'token_no', 'patient_id', 'appointment_id', 'priority'])
      .where('resource_id', '=', resourceId)
      .where('facility_id', '=', input.facilityId)
      .where('session_on', '=', input.sessionOn)
      .where('status', '=', 'waiting')
      .orderBy(PRIORITY_ORDER)
      .orderBy('token_no')
      .limit(1)
      .forUpdate()
      .skipLocked()
      .executeTakeFirst();
    if (!next) return null;
    await ctx.tx.updateTable('booking.queue_token').set({ status: 'called', called_at: now }).where('id', '=', next.id).execute();
    ctx.emit({ eventType: 'queue.called', aggregateType: 'booking.queue_token', aggregateId: next.id, payload: { tokenNo: next.token_no, patientId: next.patient_id } });
    return { tokenId: next.id, tokenNo: next.token_no, patientId: next.patient_id, appointmentId: next.appointment_id, priority: next.priority, status: 'called' };
  });
}

async function moveToken(
  db: Kysely<DB>,
  caller: Caller,
  name: string,
  tokenId: string,
  from: string[],
  to: 'in_service' | 'done' | 'skipped',
) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name, request: { tokenId } }, async (ctx) => {
    const token = await ctx.tx.selectFrom('booking.queue_token').selectAll().where('id', '=', tokenId).forUpdate().executeTakeFirst();
    if (!token) throw notFound('queue token', { tokenId });
    if (!from.includes(token.status)) throw preconditionFailed(`token is ${token.status}; cannot move to ${to}`);
    await ctx.tx
      .updateTable('booking.queue_token')
      .set({
        status: to,
        ...(to === 'in_service' ? { service_started_at: now } : {}),
        ...(to === 'done' ? { done_at: now } : {}),
      })
      .where('id', '=', tokenId)
      .execute();
    if (to === 'done' && token.appointment_id) {
      const appt = await ctx.tx
        .updateTable('booking.appointment')
        .set({ status: 'completed', completed_at: now })
        .where('id', '=', token.appointment_id)
        .where('status', '=', 'checked_in')
        .returning(['id', 'version', 'patient_id'])
        .executeTakeFirst();
      if (appt) {
        ctx.audit({ action: 'status_change', subjectType: 'booking.appointment', subjectId: appt.id, patientId: appt.patient_id });
        ctx.emit({ eventType: 'appointment.completed', aggregateType: 'booking.appointment', aggregateId: appt.id, aggregateVersion: appt.version, payload: { appointmentId: appt.id } });
      }
    }
    return { tokenId, status: to };
  });
}

export const startService = (db: Kysely<DB>, caller: Caller, input: { tokenId: string }) =>
  moveToken(db, caller, 'booking.start_service', input.tokenId, ['called'], 'in_service');
export const completeService = (db: Kysely<DB>, caller: Caller, input: { tokenId: string }) =>
  moveToken(db, caller, 'booking.complete_service', input.tokenId, ['in_service'], 'done');
export const skipToken = (db: Kysely<DB>, caller: Caller, input: { tokenId: string }) =>
  moveToken(db, caller, 'booking.skip_token', input.tokenId, ['waiting', 'called'], 'skipped');

/** The day's queue for a doctor at a facility, in calling order. */
export async function listQueue(db: Kysely<DB>, caller: Caller, input: { staffId: string; facilityId: string; sessionOn: string }): Promise<QueueEntry[]> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const resourceId = await practitionerResourceId(tx, input.staffId);
    const rows = await tx
      .selectFrom('booking.queue_token')
      .select(['id', 'token_no', 'patient_id', 'appointment_id', 'priority', 'status'])
      .where('resource_id', '=', resourceId)
      .where('facility_id', '=', input.facilityId)
      .where('session_on', '=', input.sessionOn)
      .orderBy(sql`CASE status WHEN 'in_service' THEN 0 WHEN 'called' THEN 1 WHEN 'waiting' THEN 2 ELSE 3 END`)
      .orderBy(PRIORITY_ORDER)
      .orderBy('token_no')
      .execute();
    return rows.map((r) => ({ tokenId: r.id, tokenNo: r.token_no, patientId: r.patient_id, appointmentId: r.appointment_id, priority: r.priority, status: r.status }));
  });
}
