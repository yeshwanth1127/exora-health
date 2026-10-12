// The Schedules board in one read (G04), exact-time staff holds (G08), and outcome lookup for a request
// whose response was lost (G26).
import { sql, type DB, type Kysely } from '@hms/db';
import { conflict, invalid, pgCode, preconditionFailed, runCommand, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import type { HoldResult } from './appointments.ts';
import { practitionerResourceId } from './calendar.ts';

/**
 * One clinic's day for every doctor working there: sessions, every slot with its state, booked visits,
 * live holds (time only, no patient), blocks/closures and the clinic's holiday, as of one instant.
 */
export async function calendarBoard(db: Kysely<DB>, caller: Caller, input: { facilityId: string; date: string; staffId?: string | undefined }) {
  const now = clock(caller);
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows: doctors } = await sql<{ staff_id: string; name: string; department: string; resource_id: string | null }>`
      SELECT DISTINCT ON (s.id) s.id AS staff_id, s.display_name AS name, d.name AS department, sr.id AS resource_id
      FROM catalog.practitioner_affiliation pa
      JOIN platform.staff s ON s.id = pa.staff_id AND s.status = 'active'
      JOIN platform.department d ON d.id = pa.department_id
      LEFT JOIN booking.schedulable_resource sr ON sr.staff_id = s.id
      WHERE pa.facility_id = ${input.facilityId} AND pa.valid_from <= ${input.date}::date AND (pa.valid_to IS NULL OR pa.valid_to > ${input.date}::date)
        AND (${input.staffId ?? null}::uuid IS NULL OR s.id = ${input.staffId ?? null}::uuid)
      ORDER BY s.id, d.name`.execute(tx);
    const { rows: [holiday] } = await sql<{ id: string; name: string }>`
      SELECT id, name FROM booking.facility_holiday WHERE facility_id = ${input.facilityId} AND holiday_on = ${input.date}::date AND revoked_at IS NULL`.execute(tx);
    const rows = [];
    for (const d of doctors.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!d.resource_id) {
        rows.push({ staffId: d.staff_id, name: d.name, department: d.department, calendar: false, sessions: [], slots: [], appointments: [], holds: [], exceptions: [] });
        continue;
      }
      const [sessions, slots, appointments, holds, exceptions] = await Promise.all([
        sql<{ starts_at: Date; ends_at: Date; visit_mode: string; slot_minutes: number | null; max_walk_in_tokens: number; source: string }>`
          SELECT starts_at, ends_at, visit_mode, slot_minutes, max_walk_in_tokens, source FROM booking.sessions(${d.resource_id}, ${input.date}::date, ${input.date}::date)
          WHERE facility_id = ${input.facilityId} ORDER BY starts_at`.execute(tx),
        sql<{ slot_start: Date; slot_end: Date; visit_mode: string; status: string }>`
          SELECT slot_start, slot_end, visit_mode, status FROM booking.available_slots(${d.resource_id}, ${input.date}::date, ${input.date}::date, ${now})
          WHERE facility_id = ${input.facilityId} ORDER BY slot_start`.execute(tx),
        tx
          .selectFrom('booking.appointment as a')
          .leftJoin('patient.patient as p', 'p.id', 'a.patient_id')
          .leftJoin('booking.booking_party as bp', 'bp.id', 'a.booking_party_id')
          .select([
            'a.id as appointmentId', 'a.status', 'a.starts_at as startsAt', 'a.ends_at as endsAt', 'a.booking_kind as bookingKind', 'a.visit_mode as visitMode',
            'a.confirmation_code as confirmationCode', 'p.mrn', sql<string | null>`p.given_name || coalesce(' ' || p.family_name, '')`.as('patientName'), 'bp.name as bookingPartyName',
          ])
          .where('a.resource_id', '=', d.resource_id)
          .where('a.facility_id', '=', input.facilityId)
          .where('a.session_on', '=', input.date)
          .orderBy('a.starts_at')
          .execute(),
        sql<{ reservation_id: string; starts_at: Date; ends_at: Date; hold_expires_at: Date; owner_type: string | null }>`
          SELECT id AS reservation_id, lower(period) AS starts_at, upper(period) AS ends_at, hold_expires_at, owner_type FROM booking.reservation
          WHERE resource_id = ${d.resource_id} AND facility_id = ${input.facilityId} AND status = 'held' AND hold_expires_at > ${now}
            AND period && tstzrange((${input.date}::date - 1)::timestamptz, (${input.date}::date + 2)::timestamptz)`.execute(tx),
        tx
          .selectFrom('booking.schedule_exception')
          .select(['id as scheduleExceptionId', 'kind', 'start_local as start', 'end_local as end', 'facility_id as facilityId', 'visit_mode as visitMode', 'reason'])
          .where('resource_id', '=', d.resource_id)
          .where('on_date', '=', input.date)
          .where('revoked_at', 'is', null)
          .where((eb) => eb.or([eb('facility_id', 'is', null), eb('facility_id', '=', input.facilityId)]))
          .execute(),
      ]);
      rows.push({
        staffId: d.staff_id,
        name: d.name,
        department: d.department,
        calendar: true,
        sessions: sessions.rows.map((s) => ({ startsAt: s.starts_at, endsAt: s.ends_at, visitMode: s.visit_mode, slotMinutes: s.slot_minutes, maxWalkInTokens: s.max_walk_in_tokens, source: s.source })),
        slots: slots.rows.map((s) => ({ slotStart: s.slot_start, slotEnd: s.slot_end, visitMode: s.visit_mode, status: s.status })),
        appointments,
        holds: holds.rows.map((h) => ({ reservationId: h.reservation_id, startsAt: h.starts_at, endsAt: h.ends_at, holdExpiresAt: h.hold_expires_at, kind: h.owner_type ?? 'booking' })),
        exceptions,
      });
    }
    const counts = rows.reduce(
      (c, r) => ({
        free: c.free + r.slots.filter((s) => s.status === 'free').length,
        taken: c.taken + r.slots.filter((s) => s.status === 'taken').length,
        booked: c.booked + r.appointments.filter((a) => a.status !== 'cancelled').length,
      }),
      { free: 0, taken: 0, booked: 0 },
    );
    return { facilityId: input.facilityId, date: input.date, asOf: now, holiday: holiday ?? null, counts, rows };
  });
}

// ---- exact-time holds ------------------------------------------------------------------------------------

/** The clinic whose published session contains [startsAt, endsAt) for this doctor, if any. */
export async function rangeFacility(db: Kysely<DB>, caller: Caller, staffId: string, startsAt: Date, endsAt: Date): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const resourceId = await practitionerResourceId(tx, staffId);
    const { rows: [s] } = await sql<{ facility_id: string }>`
      SELECT facility_id FROM booking.sessions(${resourceId}, ${startsAt}::date - 1, ${startsAt}::date + 1)
      WHERE slot_minutes IS NOT NULL AND tstzrange(starts_at, ends_at) @> tstzrange(${startsAt}, ${endsAt}) LIMIT 1`.execute(tx);
    return s?.facility_id;
  });
}

/**
 * Holds an exact period (not a whole slot) inside one published session at the authorized clinic: the
 * front desk's "book 10:05–10:20". The reservation exclusion still forbids overlapping another hold or
 * booking, and blocked time is refused. Booking and moving then use the normal hold-based commands.
 */
export async function holdRange(
  db: Kysely<DB>,
  caller: Caller,
  input: { staffId: string; startsAt: string; endsAt: string; facilityId: string; holdMinutes?: number | undefined; visitMode?: 'in_person' | 'virtual' | undefined },
  idempotencyKey: string,
): Promise<HoldResult> {
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  const minutes = (end.getTime() - start.getTime()) / 60_000;
  if (!(minutes >= 5 && minutes <= 240)) throw invalid('a visit is 5 minutes to 4 hours long');
  if (start.getUTCSeconds() || end.getUTCSeconds()) throw invalid('times are whole minutes');
  const now = clock(caller);
  if (start <= now) throw invalid('choose a time in the future');
  const holdMinutes = input.holdMinutes ?? 5;
  const result = await runCommand(db, { ...caller, module: 'booking', name: 'booking.hold_range', idempotencyKey, request: input }, async (ctx) => {
    const resourceId = await practitionerResourceId(ctx.tx, input.staffId);
    await ctx.tx.selectFrom('booking.schedulable_resource').select('id').where('id', '=', resourceId).forUpdate().execute();
    const { rows: [session] } = await sql<{ facility_id: string; visit_mode: string }>`
      SELECT facility_id, visit_mode FROM booking.sessions(${resourceId}, ${start}::date - 1, ${start}::date + 1)
      WHERE slot_minutes IS NOT NULL AND tstzrange(starts_at, ends_at) @> tstzrange(${start}, ${end}) LIMIT 1`.execute(ctx.tx);
    if (!session) throw preconditionFailed("that time isn't inside the doctor's published hours", { reason: 'outside_hours' });
    if (input.visitMode && session.visit_mode !== input.visitMode) throw conflict(`those hours are for ${session.visit_mode === 'virtual' ? 'video' : 'in-person'} visits`, { reason: 'other_visit_mode' });
    if (session.facility_id !== input.facilityId) throw conflict('those hours are at another clinic', { reason: 'other_clinic' });
    const { rows: blocked } = await sql`
      SELECT 1 FROM booking.available_slots(${resourceId}, ${start}::date - 1, ${start}::date + 1, ${now})
      WHERE status = 'blocked' AND tstzrange(slot_start, slot_end) && tstzrange(${start}, ${end}) LIMIT 1`.execute(ctx.tx);
    if (blocked.length) throw conflict('part of that time is blocked', { reason: 'slot_blocked' });
    await ctx.tx
      .updateTable('booking.reservation')
      .set({ status: 'expired' })
      .where('resource_id', '=', resourceId)
      .where('status', '=', 'held')
      .where('hold_expires_at', '<=', now)
      .where(sql<boolean>`period && tstzrange(${start}, ${end})`)
      .execute();
    const holdExpiresAt = new Date(now.getTime() + holdMinutes * 60_000);
    try {
      const { id } = await ctx.tx
        .insertInto('booking.reservation')
        .values({ tenant_id: ctx.tenantId, resource_id: resourceId, facility_id: session.facility_id, period: sql`tstzrange(${start}, ${end})`, status: 'held', hold_expires_at: holdExpiresAt })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'booking.reservation', subjectId: id, diff: { exact: true, startsAt: start.toISOString(), endsAt: end.toISOString() } });
      return { reservationId: id, slotStart: start, slotEnd: end, facilityId: session.facility_id, holdExpiresAt };
    } catch (err) {
      if (pgCode(err) === '23P01') throw conflict('that time overlaps another booking or hold', { reason: 'slot_unavailable' });
      throw err;
    }
  });
  return { ...result, slotStart: new Date(result.slotStart), slotEnd: new Date(result.slotEnd), holdExpiresAt: new Date(result.holdExpiresAt) };
}

// ---- unknown outcome --------------------------------------------------------------------------------------

/**
 * What happened to a request sent with this Idempotency-Key: `completed` with its result, `in_progress`,
 * or `unknown` (never received; it is safe to send it again with the same key). Keys are random per
 * intent, so knowing one is knowing the request.
 */
export async function requestOutcome(db: Kysely<DB>, caller: Caller, key: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const r = await tx.selectFrom('platform.idempotency_record').select(['scope', 'status', 'result_ref', 'created_at']).where('key', '=', key).orderBy('created_at', 'desc').executeTakeFirst();
    if (!r) return { key, status: 'unknown' as const };
    return { key, scope: r.scope, status: r.status, result: r.status === 'completed' ? r.result_ref : null, receivedAt: r.created_at };
  });
}
