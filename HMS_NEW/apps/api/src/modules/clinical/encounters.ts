// Encounter lifecycle: opened from a booking check-in (by the worker) or directly; started by the
// clinician; finished with a disposition (which completes the appointment) or cancelled.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, preconditionFailed, runCommand, writeOutbox, type EventInput } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { ensureEncounterAccess, lockEncounter } from './access.ts';

type EncounterClass = 'outpatient' | 'emergency' | 'inpatient' | 'day_care' | 'virtual';
const PREFIX: Record<EncounterClass, string> = { outpatient: 'OP', emergency: 'ER', inpatient: 'IP', day_care: 'DC', virtual: 'TC' };

async function encounterNumber(tx: Transaction<DB>, cls: EncounterClass): Promise<string> {
  const { rows: [n] } = await sql<{ n: number }>`SELECT platform.next_number('encounter') AS n`.execute(tx);
  return `${PREFIX[cls]}-${String(n!.n).padStart(6, '0')}`;
}

interface NewEncounter {
  tenantId: string;
  patientId: string;
  facilityId: string;
  departmentId: string | null;
  attendingStaffId: string;
  appointmentId: string | null;
  encounterClass: EncounterClass;
  chiefComplaint: string | null;
  arrivedAt: Date;
}

async function insertEncounter(tx: Transaction<DB>, e: NewEncounter): Promise<{ encounterId: string; encounterNo: string; event: EventInput }> {
  const encounterNo = await encounterNumber(tx, e.encounterClass);
  const { id } = await tx
    .insertInto('clinical.encounter')
    .values({
      tenant_id: e.tenantId,
      encounter_no: encounterNo,
      patient_id: e.patientId,
      facility_id: e.facilityId,
      department_id: e.departmentId,
      attending_staff_id: e.attendingStaffId,
      appointment_id: e.appointmentId,
      encounter_class: e.encounterClass,
      chief_complaint: e.chiefComplaint,
      arrived_at: e.arrivedAt,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await tx
    .insertInto('clinical.encounter_participant')
    .values({ tenant_id: e.tenantId, encounter_id: id, staff_id: e.attendingStaffId, role: 'attending', period_start: e.arrivedAt })
    .execute();
  return {
    encounterId: id,
    encounterNo,
    event: {
      eventType: 'encounter.opened',
      aggregateType: 'clinical.encounter',
      aggregateId: id,
      payload: { encounterId: id, encounterNo, patientId: e.patientId, appointmentId: e.appointmentId, attendingStaffId: e.attendingStaffId },
    },
  };
}

/**
 * Event consumer step: opens the encounter for a checked-in appointment. Idempotent — an appointment
 * has at most one encounter (unique index), and an existing one is returned.
 */
export async function openEncounterForAppointment(tx: Transaction<DB>, tenantId: string, appointmentId: string, correlationId: string | null) {
  const existing = await tx.selectFrom('clinical.encounter').select(['id', 'encounter_no']).where('appointment_id', '=', appointmentId).executeTakeFirst();
  if (existing) return { encounterId: existing.id, encounterNo: existing.encounter_no, created: false };
  const appt = await tx
    .selectFrom('booking.appointment as a')
    .leftJoin('catalog.healthcare_service as hs', 'hs.id', 'a.healthcare_service_id')
    .leftJoin('platform.department as d', (join) => join.onRef('d.id', '=', 'hs.department_id').onRef('d.facility_id', '=', 'a.facility_id'))
    .select(['a.id', 'a.status', 'a.patient_id', 'a.facility_id', 'a.practitioner_staff_id', 'a.visit_mode', 'a.reason_text', 'a.checked_in_at', 'd.id as department_id'])
    .where('a.id', '=', appointmentId)
    .executeTakeFirst();
  if (!appt) throw notFound('appointment', { appointmentId });
  if (appt.status !== 'checked_in' || !appt.patient_id) return { encounterId: null, encounterNo: null, created: false }; // cancelled meanwhile
  const created = await insertEncounter(tx, {
    tenantId,
    patientId: appt.patient_id,
    facilityId: appt.facility_id,
    departmentId: appt.department_id,
    attendingStaffId: appt.practitioner_staff_id,
    appointmentId: appt.id,
    encounterClass: appt.visit_mode === 'virtual' ? 'virtual' : 'outpatient',
    chiefComplaint: appt.reason_text,
    arrivedAt: appt.checked_in_at ?? new Date(),
  });
  await writeOutbox(tx, tenantId, correlationId, [created.event]);
  return { encounterId: created.encounterId, encounterNo: created.encounterNo, created: true };
}

export interface OpenEncounterInput {
  patientId: string;
  facilityId: string;
  attendingStaffId: string;
  encounterClass: EncounterClass;
  departmentId?: string;
  chiefComplaint?: string;
}

/** Opens an encounter without a booking (emergency, unscheduled). */
export async function openEncounter(db: Kysely<DB>, caller: Caller, input: OpenEncounterInput, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.open_encounter', idempotencyKey, request: input }, async (ctx) => {
    const patient = await ctx.tx.selectFrom('patient.patient').select(['status']).where('id', '=', input.patientId).executeTakeFirst();
    if (!patient) throw notFound('patient', { patientId: input.patientId });
    if (patient.status !== 'active') throw preconditionFailed(`patient record is ${patient.status}`);
    const created = await insertEncounter(ctx.tx, {
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      facilityId: input.facilityId,
      departmentId: input.departmentId ?? null,
      attendingStaffId: input.attendingStaffId,
      appointmentId: null,
      encounterClass: input.encounterClass,
      chiefComplaint: input.chiefComplaint ?? null,
      arrivedAt: now,
    });
    ctx.audit({ action: 'create', subjectType: 'clinical.encounter', subjectId: created.encounterId, patientId: input.patientId });
    ctx.emit(created.event);
    return { encounterId: created.encounterId, encounterNo: created.encounterNo, status: 'arrived' };
  });
}

export async function startEncounter(db: Kysely<DB>, caller: Caller, input: { encounterId: string }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.start_encounter', request: input }, async (ctx) => {
    const enc = await lockEncounter(ctx.tx, input.encounterId);
    await ensureEncounterAccess(ctx, enc, now);
    if (enc.status === 'in_progress') return { encounterId: enc.id, status: 'in_progress' };
    if (enc.status !== 'arrived') throw preconditionFailed(`a ${enc.status} encounter cannot be started`);
    await ctx.tx.updateTable('clinical.encounter').set({ status: 'in_progress', started_at: now }).where('id', '=', enc.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'clinical.encounter', subjectId: enc.id, patientId: enc.patient_id });
    ctx.emit({ eventType: 'encounter.started', aggregateType: 'clinical.encounter', aggregateId: enc.id, payload: { encounterId: enc.id, appointmentId: enc.appointment_id } });
    return { encounterId: enc.id, status: 'in_progress' };
  });
}

export interface FinishEncounterInput {
  encounterId: string;
  disposition: 'discharged_home' | 'admitted' | 'referred_out' | 'lama' | 'absconded' | 'died' | 'follow_up';
  followUpAdvisedOn?: string;
}

export async function finishEncounter(db: Kysely<DB>, caller: Caller, input: FinishEncounterInput) {
  if (input.disposition === 'follow_up' && !input.followUpAdvisedOn) throw invalid('a follow-up disposition needs followUpAdvisedOn');
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.finish_encounter', request: input }, async (ctx) => {
    const enc = await lockEncounter(ctx.tx, input.encounterId);
    await ensureEncounterAccess(ctx, enc, now);
    if (enc.status !== 'in_progress') throw preconditionFailed(`a ${enc.status} encounter cannot be finished; start it first`);
    const drafts = await ctx.tx
      .selectFrom('clinical.clinical_note')
      .select('id')
      .where('encounter_id', '=', enc.id)
      .where('status', '=', 'draft')
      .execute();
    if (drafts.length) throw preconditionFailed('sign or void the draft notes before finishing', { reason: 'unsigned_notes', noteIds: drafts.map((d) => d.id) });
    await ctx.tx
      .updateTable('clinical.encounter')
      .set({ status: 'finished', ended_at: now, disposition: input.disposition, follow_up_advised_on: input.followUpAdvisedOn ?? null })
      .where('id', '=', enc.id)
      .execute();
    await ctx.tx.updateTable('clinical.encounter_participant').set({ period_end: now }).where('encounter_id', '=', enc.id).where('period_end', 'is', null).execute();
    ctx.audit({ action: 'status_change', subjectType: 'clinical.encounter', subjectId: enc.id, patientId: enc.patient_id });
    ctx.emit({
      eventType: 'encounter.finished',
      aggregateType: 'clinical.encounter',
      aggregateId: enc.id,
      payload: { encounterId: enc.id, appointmentId: enc.appointment_id, patientId: enc.patient_id, disposition: input.disposition, followUpAdvisedOn: input.followUpAdvisedOn ?? null },
    });
    return { encounterId: enc.id, status: 'finished' };
  });
}

export async function cancelEncounter(db: Kysely<DB>, caller: Caller, input: { encounterId: string; reason: string }) {
  if (!input.reason.trim()) throw invalid('a reason is required');
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.cancel_encounter', request: input }, async (ctx) => {
    const enc = await lockEncounter(ctx.tx, input.encounterId);
    if (enc.status !== 'arrived' && enc.status !== 'planned') throw preconditionFailed(`a ${enc.status} encounter cannot be cancelled`);
    await ctx.tx.updateTable('clinical.encounter').set({ status: 'cancelled', cancel_reason: input.reason }).where('id', '=', enc.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'clinical.encounter', subjectId: enc.id, patientId: enc.patient_id, reason: input.reason });
    ctx.emit({ eventType: 'encounter.cancelled', aggregateType: 'clinical.encounter', aggregateId: enc.id, payload: { encounterId: enc.id, appointmentId: enc.appointment_id } });
    return { encounterId: enc.id, status: 'cancelled' };
  });
}

/** Event consumer step: an appointment cancelled after check-in cancels its not-yet-started encounter. */
export async function cancelEncounterForAppointment(tx: Transaction<DB>, tenantId: string, appointmentId: string, reason: string, correlationId: string | null) {
  const enc = await tx.selectFrom('clinical.encounter').select(['id', 'status']).where('appointment_id', '=', appointmentId).forUpdate().executeTakeFirst();
  if (!enc || enc.status !== 'arrived') return false;
  await tx.updateTable('clinical.encounter').set({ status: 'cancelled', cancel_reason: `Appointment cancelled: ${reason}` }).where('id', '=', enc.id).execute();
  await writeOutbox(tx, tenantId, correlationId, [
    { eventType: 'encounter.cancelled', aggregateType: 'clinical.encounter', aggregateId: enc.id, payload: { encounterId: enc.id, appointmentId } },
  ]);
  return true;
}

export async function addParticipant(db: Kysely<DB>, caller: Caller, input: { encounterId: string; staffId: string; role: 'consulting' | 'resident' | 'nurse' | 'other' }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.add_participant', request: input }, async (ctx) => {
    const enc = await lockEncounter(ctx.tx, input.encounterId);
    await ensureEncounterAccess(ctx, enc, now);
    if (enc.status !== 'arrived' && enc.status !== 'in_progress') throw preconditionFailed('participants can only join an active encounter');
    try {
      await ctx.tx.insertInto('clinical.encounter_participant').values({ tenant_id: ctx.tenantId, encounter_id: enc.id, staff_id: input.staffId, role: input.role }).execute();
    } catch (err) {
      if ((err as { code?: string }).code === '23505') throw conflict('already a participant in that role');
      throw err;
    }
    ctx.audit({ action: 'create', subjectType: 'clinical.encounter_participant', subjectId: enc.id, patientId: enc.patient_id });
    return { encounterId: enc.id, staffId: input.staffId, role: input.role };
  });
}
