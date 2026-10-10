// Teleconsultation reads: the staff worklist and detail, and the patient's view through the link.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { notFound, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import type { TelehealthSettings } from '../../config.ts';
import { currentConsentDocument, joinWindow, type LinkCaller } from './sessions.ts';

function baseQuery(tx: Transaction<DB>, now: Date) {
  return tx
    .selectFrom('clinical.tele_session as s')
    .innerJoin('booking.appointment as a', 'a.id', 's.appointment_id')
    .innerJoin('platform.staff as d', 'd.id', 's.practitioner_staff_id')
    .leftJoin('patient.patient as p', 'p.id', 'a.patient_id')
    .leftJoin('booking.booking_party as bp', 'bp.id', 'a.booking_party_id')
    .leftJoin('clinical.encounter as e', 'e.appointment_id', 'a.id')
    .select([
      's.id as sessionId', 's.appointment_id as appointmentId', 's.facility_id as facilityId', 's.practitioner_staff_id as practitionerStaffId',
      'd.display_name as doctorName', 's.status', 'a.status as appointmentStatus', 'a.confirmation_code as confirmationCode',
      'a.session_on as sessionOn', 'a.starts_at as startsAt', 'a.ends_at as endsAt', 'a.reason_text as reason',
      'a.patient_id as patientId', 'p.mrn', 'bp.phone as bookingPhone',
      's.patient_waiting_since as patientWaitingSince', 's.patient_left_at as patientLeftAt',
      's.started_at as startedAt', 's.ended_at as endedAt', 's.end_outcome as endOutcome',
      's.identity_method as identityMethod', 's.identity_verified_at as identityVerifiedAt',
      's.patient_link_issued_at as linkIssuedAt', 's.patient_link_expires_at as linkExpiresAt',
      'e.id as encounterId', 's.version',
    ])
    .select(sql<string | null>`coalesce(p.given_name || coalesce(' ' || p.family_name, ''), bp.name)`.as('patientName'))
    .select(sql<boolean>`EXISTS (
        SELECT 1 FROM clinical.tele_consent c
        JOIN clinical.tele_consent_document cd ON cd.id = c.document_id
        WHERE c.session_id = s.id AND cd.published_at <= ${now} AND (cd.retired_at IS NULL OR cd.retired_at > ${now}))`.as('consented'));
}

type Row = Awaited<ReturnType<ReturnType<typeof baseQuery>['executeTakeFirstOrThrow']>>;

const view = (r: Row, now: Date) => ({
  ...r,
  linkActive: !!r.linkExpiresAt && r.linkExpiresAt > now,
});

export interface TeleWorklistFilter {
  facilityId: string;
  date: string;
  staffId?: string | undefined;
  status?: 'scheduled' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | undefined;
}

export async function listTeleconsults(db: Kysely<DB>, caller: Caller, f: TeleWorklistFilter) {
  const now = clock(caller);
  return runQuery(db, caller.tenantId, async (tx) => {
    let q = baseQuery(tx, now).where('s.facility_id', '=', f.facilityId).where('a.session_on', '=', f.date);
    if (f.staffId) q = q.where('s.practitioner_staff_id', '=', f.staffId);
    if (f.status) q = q.where('s.status', '=', f.status);
    return (await q.orderBy('a.starts_at').execute()).map((r) => view(r, now));
  });
}

export async function getTeleconsult(db: Kysely<DB>, caller: Caller, where: { sessionId: string } | { appointmentId: string }) {
  const now = clock(caller);
  return runQuery(db, caller.tenantId, async (tx) => {
    let q = baseQuery(tx, now);
    q = 'sessionId' in where ? q.where('s.id', '=', where.sessionId) : q.where('s.appointment_id', '=', where.appointmentId);
    const row = await q.executeTakeFirst();
    if (!row) throw notFound('teleconsultation');
    const events = await tx
      .selectFrom('clinical.tele_session_event')
      .select(['event_type as type', 'actor_kind as actorKind', 'actor_staff_id as actorStaffId', 'detail', 'occurred_at as at'])
      .where('session_id', '=', row.sessionId)
      .orderBy('occurred_at')
      .orderBy('id')
      .execute();
    return { ...view(row, now), events };
  });
}

/** Facility of a session, for permission checks (undefined if it doesn't exist). */
export async function teleconsultFacility(db: Kysely<DB>, caller: Caller, sessionId: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) =>
    (await tx.selectFrom('clinical.tele_session').select('facility_id').where('id', '=', sessionId).executeTakeFirst())?.facility_id,
  );
}

/**
 * What the patient sees: who and when, the consent to read, and what they can do next. Nothing the
 * link holder didn't already know (no MRN, phone, or clinical content).
 */
export async function patientSessionView(db: Kysely<DB>, caller: LinkCaller, settings: TelehealthSettings) {
  const now = clock(caller);
  return runQuery(db, caller.tenantId, async (tx) => {
    const r = await tx
      .selectFrom('clinical.tele_session as s')
      .innerJoin('booking.appointment as a', 'a.id', 's.appointment_id')
      .innerJoin('platform.staff as d', 'd.id', 's.practitioner_staff_id')
      .innerJoin('platform.facility as f', 'f.id', 's.facility_id')
      .select(['s.id', 's.status', 'a.starts_at', 'a.ends_at', 'd.display_name as doctorName', 'f.name as hospitalName'])
      .where('s.id', '=', caller.sessionId)
      .executeTakeFirst();
    if (!r || !r.starts_at || !r.ends_at) throw notFound('teleconsultation');
    const doc = await currentConsentDocument(tx, now);
    const consented = doc
      ? !!(await tx.selectFrom('clinical.tele_consent').select('id').where('session_id', '=', r.id).where('document_id', '=', doc.id).executeTakeFirst())
      : false;
    const { opensAt, closesAt } = joinWindow(settings, { starts_at: r.starts_at, ends_at: r.ends_at });
    const open = now >= opensAt && now <= closesAt;
    const next =
      !doc ? 'unavailable'
      : ['completed', 'cancelled', 'no_show'].includes(r.status) ? 'closed'
      : !consented ? 'accept_consent'
      : r.status === 'in_progress' && open ? 'join'
      : r.status === 'scheduled' && open ? 'enter_waiting_room'
      : r.status === 'scheduled' ? 'wait_for_start_time'
      : 'wait_for_doctor';
    return {
      status: r.status,
      doctorName: r.doctorName,
      hospitalName: r.hospitalName,
      startsAt: r.starts_at.toISOString(),
      endsAt: r.ends_at.toISOString(),
      joinOpensAt: opensAt.toISOString(),
      joinClosesAt: closesAt.toISOString(),
      consent: { accepted: consented, document: doc ? { version: doc.doc_version, language: doc.language, title: doc.title, body: doc.body } : null },
      next,
      // Poll gently while waiting; the doctor starting is what the patient is waiting for.
      retryAfterSeconds: next === 'wait_for_doctor' ? 5 : next === 'join' || next === 'closed' || next === 'unavailable' ? null : 30,
    };
  });
}
