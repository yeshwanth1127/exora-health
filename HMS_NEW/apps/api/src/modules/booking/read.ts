// Booking read models for the API.
import { sql, type DB, type Kysely } from '@hms/db';
import { invalid, notFound, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { consultationFee } from './appointments.ts';
import { practitionerResourceId } from './calendar.ts';

export interface AppointmentView {
  appointmentId: string;
  confirmationCode: string;
  status: string;
  bookingKind: string;
  facilityId: string;
  practitionerStaffId: string;
  practitionerName: string;
  patientId: string | null;
  patientName: string | null;
  mrn: string | null;
  bookingPartyName: string | null;
  bookingPartyPhone: string | null;
  sessionOn: string;
  startsAt: Date | null;
  endsAt: Date | null;
  visitType: string;
  visitMode: string;
  originChannel: string;
  priority: string;
  feeMinor: number | null;
  reason: string | null;
  tokenNo: number | null;
  tokenStatus: string | null;
  rescheduledFromId: string | null;
  cancelReason: string | null;
  /** Set when this visit was overbooked into a taken slot. */
  overbookReason: string | null;
}

function baseQuery(db: Kysely<DB> | Parameters<Parameters<typeof runQuery>[2]>[0]) {
  return db
    .selectFrom('booking.appointment as a')
    .innerJoin('platform.staff as s', 's.id', 'a.practitioner_staff_id')
    .leftJoin('patient.patient as p', 'p.id', 'a.patient_id')
    .leftJoin('booking.booking_party as bp', 'bp.id', 'a.booking_party_id')
    .leftJoin('booking.queue_token as q', 'q.appointment_id', 'a.id')
    .leftJoin('booking.reservation as r', 'r.id', 'a.reservation_id')
    .select([
      'a.id as appointmentId',
      'a.confirmation_code as confirmationCode',
      'a.status',
      'a.booking_kind as bookingKind',
      'a.facility_id as facilityId',
      'a.practitioner_staff_id as practitionerStaffId',
      's.display_name as practitionerName',
      'a.patient_id as patientId',
      sql<string | null>`p.given_name || coalesce(' ' || p.family_name, '')`.as('patientName'),
      'p.mrn',
      'bp.name as bookingPartyName',
      'bp.phone as bookingPartyPhone',
      'a.session_on as sessionOn',
      'a.starts_at as startsAt',
      'a.ends_at as endsAt',
      'a.visit_type as visitType',
      'a.visit_mode as visitMode',
      'a.origin_channel as originChannel',
      'a.priority',
      'a.fee_snapshot_minor as feeMinor',
      'a.reason_text as reason',
      'q.token_no as tokenNo',
      'q.status as tokenStatus',
      'a.rescheduled_from_id as rescheduledFromId',
      'a.cancel_reason as cancelReason',
      'r.overbook_reason as overbookReason',
    ]);
}

export interface AppointmentFilter {
  facilityId?: string | undefined;
  staffId?: string | undefined;
  patientId?: string | undefined;
  from: string;
  to: string;
  status?: string | undefined;
  /** Patient or booker name, phone digits, MRN or confirmation code. */
  q?: string | undefined;
  /** From a previous page's nextCursor. */
  cursor?: string | undefined;
  limit?: number | undefined;
}

type Cursor = [sessionOn: string, startsAt: string | null, id: string];
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(raw: string): Cursor {
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString()) as unknown;
    if (
      Array.isArray(c) && c.length === 3 &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(c[0])) &&
      (c[1] === null || !Number.isNaN(Date.parse(String(c[1])))) &&
      /^[0-9a-f-]{36}$/.test(String(c[2]))
    ) return c as Cursor;
  } catch { /* falls through */ }
  throw invalid('cursor is not valid; start again from the first page');
}
const likeEscape = (v: string) => v.replace(/[\\%_]/g, '\\$&');

/** Appointments in a date range, in visit order (date, start time, walk-ins last), one page at a time. */
export async function listAppointments(db: Kysely<DB>, caller: Caller, f: AppointmentFilter): Promise<{ items: AppointmentView[]; nextCursor: string | null }> {
  const limit = Math.min(f.limit ?? 200, 500);
  const after = f.cursor ? decodeCursor(f.cursor) : null;
  return runQuery(db, caller.tenantId, async (tx) => {
    let q = baseQuery(tx).where('a.session_on', '>=', f.from).where('a.session_on', '<=', f.to);
    if (f.facilityId) q = q.where('a.facility_id', '=', f.facilityId);
    if (f.staffId) q = q.where('a.practitioner_staff_id', '=', f.staffId);
    if (f.patientId) q = q.where('a.patient_id', '=', f.patientId);
    if (f.status) q = q.where('a.status', '=', f.status);
    const term = f.q?.trim().toLowerCase();
    if (term) {
      const like = `%${likeEscape(term)}%`;
      const digits = term.replace(/\D/g, '');
      const phone = digits.length >= 4 ? `%${digits}` : null;
      q = q.where(sql<boolean>`(
        a.confirmation_code = upper(${term}) OR lower(p.mrn) = ${term}
        OR lower(p.given_name || coalesce(' ' || p.family_name, '')) LIKE ${like} OR lower(bp.name) LIKE ${like}
        OR (${phone}::text IS NOT NULL AND (bp.phone LIKE ${phone} OR EXISTS (
              SELECT 1 FROM patient.patient_contact c
              WHERE c.patient_id = a.patient_id AND c.kind = 'phone' AND c.valid_to IS NULL AND c.value LIKE ${phone}))))`);
    }
    const sortStart = sql`coalesce(a.starts_at, 'infinity'::timestamptz)`;
    if (after) q = q.where(sql<boolean>`(a.session_on, ${sortStart}, a.id) > (${after[0]}::date, coalesce(${after[1]}::timestamptz, 'infinity'::timestamptz), ${after[2]}::uuid)`);
    const rows = (await q.orderBy('a.session_on').orderBy(sortStart).orderBy('a.id').limit(limit + 1).execute()) as AppointmentView[];
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > limit && last ? encodeCursor([String(last.sessionOn).slice(0, 10), last.startsAt ? new Date(last.startsAt).toISOString() : null, last.appointmentId]) : null,
    };
  });
}

export interface OperationsSummary {
  date: string;
  summary: {
    appointmentsTotal: number;
    appointmentsUpcoming: number;
    retained: number;
    activeDoctors: number;
    scheduleRules: number;
    activeHolds: number;
    voiceBookings: number;
    /** No notification or voice-call store exists yet (G19, G21): unknown, never zero. */
    pendingNotifications: null;
    voiceSessions: null;
  };
  dailyBookings: { date: string; bookings: number }[];
  byStatus: { label: string; value: number }[];
  byChannel: { label: string; value: number }[];
  recent: AppointmentView[];
}

/**
 * One clinic's overview as of `on`: appointment totals and mix, doctors with published hours, live holds,
 * bookings made in the 14 days ending `on` (clinic-local dates, reschedule replacements excluded) and the
 * ten latest bookings.
 */
// ponytail: all-time counts scan the clinic's appointments; add a date window or rollup when that is slow.
export async function operationsSummary(db: Kysely<DB>, caller: Caller, facilityId: string, on: string): Promise<OperationsSummary> {
  const now = clock(caller);
  return runQuery(db, caller.tenantId, async (tx) => {
    const [{ rows: [totals] }, { rows: [hours] }, { rows: [holds] }, { rows: daily }, { rows: mix }, recent] = await Promise.all([
      sql<{ total: number; upcoming: number; retained: number; voice: number }>`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE status = 'confirmed' AND session_on >= ${on}::date)::int AS upcoming,
               count(*) FILTER (WHERE status IN ('confirmed', 'checked_in', 'completed'))::int AS retained,
               count(*) FILTER (WHERE origin_channel = 'voice')::int AS voice
        FROM booking.appointment WHERE facility_id = ${facilityId}`.execute(tx),
      sql<{ rules: number; doctors: number }>`
        SELECT count(*)::int AS rules, count(DISTINCT r.resource_id)::int AS doctors
        FROM booking.schedule_rule r
        WHERE r.facility_id = ${facilityId} AND r.withdrawn_at IS NULL
          AND r.effective_from <= ${on}::date AND (r.effective_to IS NULL OR r.effective_to > ${on}::date)`.execute(tx),
      sql<{ n: number }>`
        SELECT count(*)::int AS n FROM booking.reservation
        WHERE facility_id = ${facilityId} AND status = 'held' AND hold_expires_at > ${now}`.execute(tx),
      sql<{ date: string; bookings: number }>`
        SELECT d::date::text AS date, count(a.id)::int AS bookings
        FROM generate_series(${on}::date - 13, ${on}::date, interval '1 day') d
        LEFT JOIN booking.appointment a
          ON a.facility_id = ${facilityId} AND a.rescheduled_from_id IS NULL
         AND (a.created_at AT TIME ZONE (SELECT timezone FROM platform.facility WHERE id = ${facilityId}))::date = d::date
        GROUP BY d ORDER BY d`.execute(tx),
      sql<{ kind: 'status' | 'channel'; label: string; value: number }>`
        SELECT 'status' AS kind, status AS label, count(*)::int AS value FROM booking.appointment WHERE facility_id = ${facilityId} GROUP BY status
        UNION ALL
        SELECT 'channel', origin_channel, count(*)::int FROM booking.appointment WHERE facility_id = ${facilityId} GROUP BY origin_channel
        ORDER BY value DESC, label`.execute(tx),
      baseQuery(tx).where('a.facility_id', '=', facilityId).orderBy('a.created_at', 'desc').orderBy('a.id', 'desc').limit(10).execute(),
    ]);
    const pick = (kind: string) => mix.filter((m) => m.kind === kind).map(({ label, value }) => ({ label, value }));
    return {
      date: on,
      summary: {
        appointmentsTotal: totals!.total,
        appointmentsUpcoming: totals!.upcoming,
        retained: totals!.retained,
        activeDoctors: hours!.doctors,
        scheduleRules: hours!.rules,
        activeHolds: holds!.n,
        voiceBookings: totals!.voice,
        pendingNotifications: null,
        voiceSessions: null,
      },
      dailyBookings: daily,
      byStatus: pick('status'),
      byChannel: pick('channel'),
      recent: recent as AppointmentView[],
    };
  });
}

export interface OutboxEventView {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: Date;
  processedAt: Date | null;
  attempts: number;
  status: 'processed' | 'pending' | 'retrying' | 'dead_lettered';
}

/**
 * The tenant's latest outbox events, newest first: metadata only. Payloads and error text can carry
 * patient data, so they are never returned.
 */
export async function recentOutboxEvents(db: Kysely<DB>, caller: Caller, limit: number): Promise<OutboxEventView[]> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const rows = await tx
      .selectFrom('platform.outbox_event')
      .select(['id', 'event_type', 'aggregate_type', 'aggregate_id', 'occurred_at', 'processed_at', 'dead_lettered_at', 'attempts'])
      .orderBy('occurred_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .execute();
    return rows.map((r) => ({
      eventId: r.id,
      eventType: r.event_type,
      aggregateType: r.aggregate_type,
      aggregateId: r.aggregate_id,
      occurredAt: r.occurred_at,
      processedAt: r.processed_at,
      attempts: r.attempts,
      status: r.dead_lettered_at ? 'dead_lettered' : r.processed_at ? 'processed' : r.attempts > 0 ? 'retrying' : 'pending',
    }));
  });
}

export async function getAppointment(db: Kysely<DB>, caller: Caller, appointmentId: string): Promise<AppointmentView> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const row = await baseQuery(tx).where('a.id', '=', appointmentId).executeTakeFirst();
    if (!row) throw notFound('appointment', { appointmentId });
    return row as AppointmentView;
  });
}

/** Facility of a reservation (for authorization before booking it); undefined when not found. */
export async function reservationFacility(db: Kysely<DB>, caller: Caller, reservationId: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) =>
    (await tx.selectFrom('booking.reservation').select('facility_id').where('id', '=', reservationId).executeTakeFirst())?.facility_id,
  );
}

/** Facility of a queue token; undefined when not found. */
export async function tokenFacility(db: Kysely<DB>, caller: Caller, tokenId: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) =>
    (await tx.selectFrom('booking.queue_token').select('facility_id').where('id', '=', tokenId).executeTakeFirst())?.facility_id,
  );
}

/** Facility of the slot starting at `slotStart` in a doctor's calendar; undefined when there is no such slot. */
export async function slotFacility(db: Kysely<DB>, caller: Caller, staffId: string, slotStart: Date): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows: [r] } = await sql<{ facility_id: string }>`
      SELECT s.facility_id
      FROM booking.schedulable_resource sr,
           booking.available_slots(sr.id, (${slotStart}::timestamptz)::date - 1, (${slotStart}::timestamptz)::date + 1, '-infinity') s
      WHERE sr.staff_id = ${staffId} AND s.slot_start = ${slotStart}
      LIMIT 1`.execute(tx);
    return r?.facility_id;
  });
}

/**
 * What the doctor charges at a clinic: one row per service and visit mode they hold sessions for in the
 * two weeks from `on`, priced exactly as booking prices it (the session's service, date and mode).
 */
export async function quoteFees(db: Kysely<DB>, caller: Caller, input: { staffId: string; facilityId: string; on: string }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const resourceId = await practitionerResourceId(tx, input.staffId);
    const { rows } = await sql<{ healthcare_service_id: string | null; service_name: string | null; visit_mode: string; session_on: string }>`
      SELECT DISTINCT ON (s.healthcare_service_id, s.visit_mode)
             s.healthcare_service_id, hs.name AS service_name, s.visit_mode, s.session_on::text
      FROM booking.sessions(${resourceId}, ${input.on}::date, ${input.on}::date + 13) s
      LEFT JOIN catalog.healthcare_service hs ON hs.id = s.healthcare_service_id
      WHERE s.facility_id = ${input.facilityId} AND s.slot_minutes IS NOT NULL
      ORDER BY s.healthcare_service_id, s.visit_mode, s.session_on`.execute(tx);
    return Promise.all(
      rows.map(async (r) => {
        const fee = await consultationFee(tx, r.healthcare_service_id, input.staffId, r.session_on, r.visit_mode);
        return { healthcareServiceId: r.healthcare_service_id, serviceName: r.service_name, visitMode: r.visit_mode, pricedOn: r.session_on, feeMinor: fee?.unitPriceMinor ?? null };
      }),
    );
  });
}
