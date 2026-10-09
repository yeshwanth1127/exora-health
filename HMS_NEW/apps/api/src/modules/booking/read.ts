// Booking read models for the API.
import { sql, type DB, type Kysely } from '@hms/db';
import { notFound, runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';

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
}

function baseQuery(db: Kysely<DB> | Parameters<Parameters<typeof runQuery>[2]>[0]) {
  return db
    .selectFrom('booking.appointment as a')
    .innerJoin('platform.staff as s', 's.id', 'a.practitioner_staff_id')
    .leftJoin('patient.patient as p', 'p.id', 'a.patient_id')
    .leftJoin('booking.booking_party as bp', 'bp.id', 'a.booking_party_id')
    .leftJoin('booking.queue_token as q', 'q.appointment_id', 'a.id')
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
    ]);
}

export interface AppointmentFilter {
  facilityId?: string | undefined;
  staffId?: string | undefined;
  patientId?: string | undefined;
  from: string;
  to: string;
  status?: string | undefined;
  limit?: number | undefined;
}

export async function listAppointments(db: Kysely<DB>, caller: Caller, f: AppointmentFilter): Promise<AppointmentView[]> {
  return runQuery(db, caller.tenantId, async (tx) => {
    let q = baseQuery(tx).where('a.session_on', '>=', f.from).where('a.session_on', '<=', f.to);
    if (f.facilityId) q = q.where('a.facility_id', '=', f.facilityId);
    if (f.staffId) q = q.where('a.practitioner_staff_id', '=', f.staffId);
    if (f.patientId) q = q.where('a.patient_id', '=', f.patientId);
    if (f.status) q = q.where('a.status', '=', f.status);
    return (await q.orderBy('a.session_on').orderBy('a.starts_at').limit(Math.min(f.limit ?? 200, 500)).execute()) as AppointmentView[];
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
