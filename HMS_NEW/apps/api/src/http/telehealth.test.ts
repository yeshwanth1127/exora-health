// Virtual OPD over HTTP: a virtual booking gets a teleconsultation → front desk issues the patient's
// join link → patient consents and enters the waiting room (worker checks the appointment in and the
// encounter opens) → assigned doctor starts, joins, confirms identity and ends → link stops working.
// Also: who may do what, the join window, link rotation, cancellation, and the database guards.
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { jwtVerify } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@hms/db';
import { config } from '../../../../db/scripts/config.mjs';
import { adminPool, createTenant, type TenantFixture } from '../../../../db/tests/db.ts';
import { dispatchOnce } from '../../../worker/src/dispatcher.ts';
import { consumers } from '../consumers.ts';
import { signDevToken } from '../auth/dev-token.ts';
import { createVerifier } from '../auth/verify.ts';
import { DEV_ISSUER, DEV_SECRET_DEFAULT, type TelehealthSettings } from '../config.ts';
import { buildServer } from '../server.ts';

const admin = adminPool();
const db = createDb({ connectionString: config.testAppDatabaseUrl, maxConnections: 10 });
const settings: TelehealthSettings = {
  jitsiDomain: 'meet.test.local',
  jitsiAppId: 'hms-test',
  jitsiAudience: 'jitsi',
  jitsiSecret: 'test-jitsi-secret-0123456789abcdef0123',
  tokenMinutes: 5,
  joinEarlyMinutes: 15,
  joinLateMinutes: 60,
  patientLinkBase: 'https://hospital.test/video-consult',
};
let app: FastifyInstance;
let t: TenantFixture;
let monday: string;
const run = randomUUID().slice(0, 8);
type Who = 'admin' | 'frontDesk' | 'nurse' | 'doctor' | 'doctor2';
const staffIds = {} as Record<Who, string>;
const tokens = {} as Record<Who, string>;
const ist = (time: string) => `${monday}T${time}:00+05:30`;

async function call(method: 'GET' | 'POST', url: string, opts: { as?: Who | null; body?: unknown; idem?: boolean; now?: string; link?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.as !== null && opts.link === undefined) headers.authorization = `Bearer ${tokens[opts.as ?? 'admin']}`;
  if (opts.link !== undefined) headers['x-teleconsult-token'] = opts.link;
  if (opts.idem) headers['idempotency-key'] = `t-${randomUUID()}`;
  headers['x-test-now'] = opts.now ?? ist('09:00');
  const res = await app.inject({ method, url, headers, ...(opts.body !== undefined ? { payload: opts.body as object } : {}) });
  return { status: res.statusCode, body: res.body ? res.json() : null, headers: res.headers };
}
const patient = (method: 'GET' | 'POST', path: string, link: string, now: string, body?: unknown) =>
  call(method, `/tele/v1/session${path}`, { link, now, ...(body !== undefined ? { body } : {}) });

async function runWorker() {
  for (let i = 0; i < 20; i++) if ((await dispatchOnce(db, consumers, { batchSize: 200 })).claimed === 0) break;
}

/** Books a virtual slot; with `register`, for a registered patient, else for an unidentified caller. */
async function virtualBooking(slot: string, name: string, register = true) {
  const hold = await call('POST', '/v1/holds', { as: 'frontDesk', idem: true, now: ist('07:00'), body: { staffId: staffIds.doctor, slotStart: ist(slot) } });
  expect(hold.status).toBe(201);
  let patientId: string | undefined;
  if (register) {
    const p = await call('POST', '/v1/patients', { as: 'frontDesk', idem: true, body: { givenName: name, sex: 'female', registeredFacilityId: t.facilityId, source: 'front_desk' } });
    patientId = p.body.patientId;
  }
  const appt = await call('POST', '/v1/appointments', {
    as: 'frontDesk',
    idem: true,
    now: ist('07:00'),
    body: { reservationId: hold.body.reservationId, originChannel: 'front_desk', reason: 'Follow-up of blood pressure', ...(patientId ? { patientId } : { bookingParty: { name, phone: '+919800000001' } }) },
  });
  expect(appt.status).toBe(201);
  await runWorker();
  return { appointmentId: appt.body.appointmentId as string, patientId };
}

async function issueLink(appointmentId: string, now = ist('07:30')) {
  const res = await call('POST', `/v1/appointments/${appointmentId}/teleconsult/link`, { as: 'frontDesk', now });
  expect(res.status).toBe(201);
  return res.body as { sessionId: string; token: string; url: string; expiresAt: string };
}

beforeAll(async () => {
  app = buildServer({ db, verifier: createVerifier({ mode: 'dev', secret: DEV_SECRET_DEFAULT, issuer: DEV_ISSUER }), allowClockOverride: true, telehealth: settings });
  t = await createTenant(admin, 'tele');
  const one = async (text: string, values: unknown[]) => (await admin.query<{ id: string }>(text, values)).rows[0]!.id;
  const dept = await one(`INSERT INTO platform.department (tenant_id, facility_id, code, name, kind) VALUES ($1, $2, 'GM', 'General Medicine', 'clinical') RETURNING id`, [t.tenantId, t.facilityId]);
  const people: Array<[Who, string, string, string | null]> = [
    ['admin', 'admin', 'tenant_admin', null],
    ['frontDesk', 'admin', 'front_desk', t.facilityId],
    ['nurse', 'nurse', 'nurse', t.facilityId],
    ['doctor', 'doctor', 'doctor', null],
    ['doctor2', 'doctor', 'doctor', null],
  ];
  for (const [who, type, role, facility] of people) {
    staffIds[who] = await one(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, $2, $2, $2, $3) RETURNING id`, [t.tenantId, who, type]);
    await admin.query(`INSERT INTO platform.role_grant (tenant_id, staff_id, role_id, facility_id) SELECT $1, $2, id, $4 FROM platform.role WHERE tenant_id IS NULL AND code = $3`, [t.tenantId, staffIds[who], role, facility]);
    await admin.query(`INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, status) VALUES ($1, $2, $3, $4, 'active')`, [t.tenantId, staffIds[who], DEV_ISSUER, `tele-${who}-${run}`]);
    tokens[who] = await signDevToken(`tele-${who}-${run}`);
  }
  await admin.query(`INSERT INTO catalog.practitioner_affiliation (tenant_id, staff_id, facility_id, department_id, valid_from) VALUES ($1, $2, $3, $4, '2024-01-01')`, [t.tenantId, staffIds.doctor, t.facilityId, dept]);
  const consult = await one(`INSERT INTO catalog.service_item (tenant_id, code, name, category) VALUES ($1, 'CONS', 'Consultation', 'consultation') RETURNING id`, [t.tenantId]);
  const hs = await one(`INSERT INTO catalog.healthcare_service (tenant_id, department_id, code, name, service_mode, consultation_service_item_id) VALUES ($1, $2, 'GM-TELE', 'GM video OPD', 'virtual', $3) RETURNING id`, [t.tenantId, dept, consult]);
  await admin.query(
    `INSERT INTO clinical.tele_consent_document (tenant_id, doc_version, title, body, published_at) VALUES ($1, 'v1', 'Video consult consent', 'I agree to a video consultation.', '2024-01-01')`,
    [t.tenantId],
  );
  monday = (await admin.query<{ d: string }>(`SELECT (date_trunc('week', now() AT TIME ZONE 'Asia/Kolkata') + interval '14 days')::date::text AS d`)).rows[0]!.d;
  await call('POST', `/v1/practitioners/${staffIds.doctor}/calendar`);
  const session = await call('POST', `/v1/practitioners/${staffIds.doctor}/weekly-sessions`, {
    body: { facilityId: t.facilityId, weekday: 1, start: '10:00', end: '12:00', slotMinutes: 20, healthcareServiceId: hs, visitMode: 'virtual', effectiveFrom: '2024-01-01' },
  });
  expect(session.status).toBe(201);
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  await admin.end();
});

describe('a video consultation from booking to the end of the call', () => {
  it('runs end to end with every rule enforced', async () => {
    const { appointmentId } = await virtualBooking('10:00', 'Kavya');

    // Booking created the teleconsultation (worker)
    const created = await call('GET', `/v1/appointments/${appointmentId}/teleconsult`, { as: 'frontDesk' });
    expect(created.body).toMatchObject({ status: 'scheduled', appointmentStatus: 'confirmed', patientName: 'Kavya', consented: false, linkActive: false, encounterId: null });
    const sessionId = created.body.sessionId as string;

    // Only staff with teleconsult.manage issue links; the link carries the token in the fragment
    expect((await call('POST', `/v1/appointments/${appointmentId}/teleconsult/link`, { as: 'nurse' })).status).toBe(403);
    const link = await issueLink(appointmentId);
    expect(link.url).toBe(`${settings.patientLinkBase}#t=${link.token}`);
    expect(link.expiresAt).toBe(new Date(new Date(ist('10:20')).getTime() + 60 * 60_000).toISOString());
    const stored = await admin.query(`SELECT patient_link_hash FROM clinical.tele_session WHERE id = $1`, [sessionId]);
    expect(stored.rows[0].patient_link_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.rows[0].patient_link_hash).not.toContain(link.token);

    // Bad links are refused alike
    expect((await patient('GET', '', 'x'.repeat(43), ist('09:00'))).status).toBe(403);
    expect((await call('GET', '/tele/v1/session', { as: null })).status).toBe(403);

    // The patient sees the doctor, the time and the consent to accept — no MRN or phone
    const first = await patient('GET', '', link.token, ist('09:00'));
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ status: 'scheduled', doctorName: 'doctor', next: 'accept_consent', consent: { accepted: false, document: { version: 'v1' } } });
    expect(JSON.stringify(first.body)).not.toMatch(/mrn|phone|\+91/i);

    // Waiting room needs consent, for the current version, inside the join window
    expect((await patient('POST', '/check-in', link.token, ist('09:50'))).body.error.details.reason).toBe('consent_required');
    expect((await patient('POST', '/consent', link.token, ist('09:00'), { documentVersion: 'v0', accepted: true })).body.error.details.reason).toBe('consent_version_changed');
    expect((await patient('POST', '/consent', link.token, ist('09:00'), { documentVersion: 'v1', accepted: false })).status).toBe(400);
    expect((await patient('POST', '/consent', link.token, ist('09:00'), { documentVersion: 'v1', accepted: true })).status).toBe(201);
    expect((await patient('POST', '/consent', link.token, ist('09:01'), { documentVersion: 'v1', accepted: true })).status).toBe(201); // repeat is harmless
    expect((await patient('GET', '', link.token, ist('09:00'))).body).toMatchObject({ next: 'wait_for_start_time', consent: { accepted: true } });
    expect((await patient('POST', '/check-in', link.token, ist('09:30'))).body.error.details.reason).toBe('too_early');
    expect((await patient('POST', '/check-in', link.token, ist('09:50'))).body).toEqual({ status: 'waiting' });
    expect((await patient('GET', '', link.token, ist('09:51'))).body).toMatchObject({ next: 'wait_for_doctor', retryAfterSeconds: 5 });

    // The doctor can't start until the arrival has checked the appointment in (worker)
    expect((await call('POST', `/v1/teleconsults/${sessionId}/start`, { as: 'doctor', now: ist('09:55') })).body.error.details.reason).toBe('patient_not_checked_in');
    await runWorker();
    const checkedIn = await call('GET', `/v1/teleconsults/${sessionId}`, { as: 'doctor' });
    expect(checkedIn.body).toMatchObject({ status: 'waiting', appointmentStatus: 'checked_in', consented: true, encounterId: expect.any(String) });
    const enc = await call('GET', `/v1/appointments/${appointmentId}/encounter`, { as: 'frontDesk' });
    expect(enc.body.encounterNo).toMatch(/^TC-/);

    // Worklist for the front desk and the doctor
    const list = await call('GET', `/v1/teleconsults?facilityId=${t.facilityId}&date=${monday}&staffId=${staffIds.doctor}`, { as: 'frontDesk' });
    expect(list.body.items.map((i: { sessionId: string }) => i.sessionId)).toContain(sessionId);

    // Only the assigned doctor runs the call; the patient can't join before it starts
    expect((await call('POST', `/v1/teleconsults/${sessionId}/start`, { as: 'doctor2', now: ist('09:58') })).status).toBe(403);
    expect((await call('POST', `/v1/teleconsults/${sessionId}/start`, { as: 'frontDesk', now: ist('09:58') })).status).toBe(403);
    expect((await patient('POST', '/join', link.token, ist('09:58'))).body.error.details.reason).toBe('doctor_not_ready');
    expect((await call('POST', `/v1/teleconsults/${sessionId}/join`, { as: 'doctor', now: ist('09:58') })).body.error.details.reason).toBe('not_started');
    expect((await call('POST', `/v1/teleconsults/${sessionId}/start`, { as: 'doctor', now: ist('09:58') })).body).toEqual({ sessionId, status: 'in_progress' });
    expect((await call('POST', `/v1/teleconsults/${sessionId}/start`, { as: 'doctor', now: ist('09:59') })).body).toEqual({ sessionId, status: 'in_progress' }); // retry-safe

    // Join grants: short-lived, same room, moderator only for the doctor
    const doctorGrant = await call('POST', `/v1/teleconsults/${sessionId}/join`, { as: 'doctor', now: ist('09:59') });
    const patientGrant = await patient('POST', '/join', link.token, ist('10:00'));
    expect(doctorGrant.headers['cache-control']).toBe('no-store');
    expect(doctorGrant.body).toMatchObject({ provider: 'jitsi', domain: 'meet.test.local', role: 'moderator', displayName: 'doctor' });
    expect(patientGrant.body).toMatchObject({ role: 'participant', displayName: 'Kavya', roomName: doctorGrant.body.roomName });
    expect(doctorGrant.body.roomName).toMatch(/^tc[0-9a-f]{32}$/);
    const key = new TextEncoder().encode(settings.jitsiSecret);
    const verify = (jwt: string, at: string) => jwtVerify(jwt, key, { issuer: 'hms-test', audience: 'jitsi', subject: 'meet.test.local', currentDate: new Date(at) });
    const d = await verify(doctorGrant.body.jwt, ist('10:00'));
    const p = await verify(patientGrant.body.jwt, ist('10:00'));
    expect(d.payload).toMatchObject({ room: doctorGrant.body.roomName, context: { user: { moderator: true } } });
    expect(p.payload).toMatchObject({ room: doctorGrant.body.roomName, context: { user: { moderator: false, name: 'Kavya' } } });
    expect(p.payload.exp! - p.payload.iat!).toBe(300);
    await expect(verify(patientGrant.body.jwt, ist('10:06'))).rejects.toThrow(); // expired after 5 minutes
    await expect(jwtVerify(patientGrant.body.jwt, new TextEncoder().encode('wrong-secret-0123456789abcdef0123456'))).rejects.toThrow();

    // Leaving doesn't end the consultation; rejoining needs a fresh grant
    expect((await patient('POST', '/leave', link.token, ist('10:05'))).body).toEqual({ status: 'in_progress' });
    expect((await patient('POST', '/join', link.token, ist('10:06'))).status).toBe(200);

    // Ending as "consulted" needs the identity check first
    expect((await call('POST', `/v1/teleconsults/${sessionId}/end`, { as: 'doctor', now: ist('10:15'), body: { outcome: 'consulted' } })).body.error.details.reason).toBe('identity_not_verified');
    expect((await call('POST', `/v1/teleconsults/${sessionId}/identity`, { as: 'doctor2', now: ist('10:02'), body: { method: 'photo_id' } })).status).toBe(403);
    expect((await call('POST', `/v1/teleconsults/${sessionId}/identity`, { as: 'doctor', now: ist('10:02'), body: { method: 'photo_id', note: 'Aadhaar card shown on camera' } })).status).toBe(200);
    expect((await call('POST', `/v1/teleconsults/${sessionId}/end`, { as: 'doctor', now: ist('10:15'), body: { outcome: 'consulted' } })).body).toEqual({ sessionId, status: 'completed' });

    // The link is dead; the visit is still open for the doctor to finish on the encounter
    expect((await patient('GET', '', link.token, ist('10:16'))).status).toBe(403);
    const done = await call('GET', `/v1/teleconsults/${sessionId}`, { as: 'doctor' });
    expect(done.body).toMatchObject({ status: 'completed', endOutcome: 'consulted', identityMethod: 'photo_id', linkActive: false, appointmentStatus: 'checked_in' });
    expect(done.body.events.map((e: { type: string }) => e.type)).toEqual([
      'created', 'link_issued', 'consent_recorded', 'patient_waiting', 'started', 'join_granted', 'join_granted', 'identity_verified', 'patient_left', 'join_granted', 'ended',
    ]);
    expect(done.body.events.find((e: { type: string }) => e.type === 'consent_recorded').actorKind).toBe('patient');

    // Audit and outbox carry no secrets
    const leaks = await admin.query(
      `SELECT (SELECT count(*) FROM platform.outbox_event WHERE tenant_id = $1 AND payload::text LIKE '%' || $2 || '%')
            + (SELECT count(*) FROM platform.audit_event WHERE tenant_id = $1 AND coalesce(diff::text, '') || coalesce(reason, '') LIKE '%' || $2 || '%') AS n`,
      [t.tenantId, link.token],
    );
    expect(Number(leaks.rows[0].n)).toBe(0);
  });
});

describe('links, unidentified callers and cancellations', () => {
  it('re-issuing a link revokes the old one', async () => {
    const { appointmentId } = await virtualBooking('10:20', 'Rotate');
    const a = await issueLink(appointmentId);
    const b = await issueLink(appointmentId);
    expect(a.sessionId).toBe(b.sessionId);
    expect((await patient('GET', '', a.token, ist('09:00'))).status).toBe(403);
    expect((await patient('GET', '', b.token, ist('09:00'))).status).toBe(200);
    // Expires after the join window closes
    expect((await patient('GET', '', b.token, ist('11:41'))).status).toBe(403);
  });

  it('an unidentified caller waits until the front desk checks them in; staff can record verbal consent', async () => {
    const { appointmentId } = await virtualBooking('10:40', 'Caller', false);
    const link = await issueLink(appointmentId);
    // Staff record consent given on the phone (only with consents.record)
    expect((await call('POST', `/v1/teleconsults/${link.sessionId}/consent`, { as: 'doctor2', body: { documentVersion: 'v1', note: 'x' } })).status).toBe(400);
    const verbal = await call('POST', `/v1/teleconsults/${link.sessionId}/consent`, { as: 'frontDesk', body: { documentVersion: 'v1', note: 'Patient agreed on the phone at 09:10' } });
    expect(verbal.status).toBe(201);
    expect((await patient('POST', '/check-in', link.token, ist('10:30'))).body).toEqual({ status: 'waiting' });
    await runWorker();
    // No patient record yet: not checked in automatically
    const waiting = await call('GET', `/v1/teleconsults/${link.sessionId}`, { as: 'frontDesk' });
    expect(waiting.body).toMatchObject({ status: 'waiting', appointmentStatus: 'confirmed', patientName: 'Caller', bookingPhone: '+919800000001' });
    expect((await call('POST', `/v1/teleconsults/${link.sessionId}/start`, { as: 'doctor', now: ist('10:35') })).body.error.details.reason).toBe('patient_not_checked_in');
    // Front desk registers and checks in (existing endpoint), then the doctor can start
    const p = await call('POST', '/v1/patients', { as: 'frontDesk', idem: true, body: { givenName: 'Caller', sex: 'male', registeredFacilityId: t.facilityId, source: 'front_desk' } });
    expect((await call('POST', `/v1/appointments/${appointmentId}/check-in`, { as: 'frontDesk', idem: true, now: ist('10:36'), body: { patientId: p.body.patientId } })).status).toBe(200);
    expect((await call('POST', `/v1/teleconsults/${link.sessionId}/start`, { as: 'doctor', now: ist('10:37') })).body.status).toBe('in_progress');
    // A call that didn't happen ends without the identity check, but needs a note
    expect((await call('POST', `/v1/teleconsults/${link.sessionId}/end`, { as: 'doctor', now: ist('10:50'), body: { outcome: 'technical_failure' } })).status).toBe(400);
    expect((await call('POST', `/v1/teleconsults/${link.sessionId}/end`, { as: 'doctor', now: ist('10:50'), body: { outcome: 'technical_failure', note: 'Patient audio failed; will call back' } })).body.status).toBe('completed');
  });

  it('cancelling the appointment closes the teleconsultation and revokes the link', async () => {
    const { appointmentId } = await virtualBooking('11:00', 'Cancel');
    const link = await issueLink(appointmentId);
    expect((await call('POST', `/v1/appointments/${appointmentId}/cancel`, { as: 'frontDesk', now: ist('08:00'), body: { reason: 'Patient asked' } })).status).toBe(200);
    await runWorker();
    expect((await call('GET', `/v1/teleconsults/${link.sessionId}`, { as: 'frontDesk' })).body).toMatchObject({ status: 'cancelled', linkActive: false });
    expect((await patient('GET', '', link.token, ist('09:00'))).status).toBe(403);
    expect((await call('POST', `/v1/appointments/${appointmentId}/teleconsult/link`, { as: 'frontDesk' })).status).toBe(422);
  });

  it('sessions are invisible to other tenants; without a published consent document there are no video consultations', async () => {
    const other = await createTenant(admin, 'tele-off');
    const staff = (await admin.query<{ id: string }>(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, 'fd', 'fd', 'fd', 'admin') RETURNING id`, [other.tenantId])).rows[0]!.id;
    await admin.query(`INSERT INTO platform.role_grant (tenant_id, staff_id, role_id) SELECT $1, $2, id FROM platform.role WHERE tenant_id IS NULL AND code = 'tenant_admin'`, [other.tenantId, staff]);
    await admin.query(`INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, status) VALUES ($1, $2, $3, $4, 'active')`, [other.tenantId, staff, DEV_ISSUER, `tele-off-${run}`]);
    // Our session is invisible to another tenant
    const { appointmentId } = await virtualBooking('11:20', 'Isolated');
    const res = await app.inject({ method: 'GET', url: `/v1/appointments/${appointmentId}/teleconsult`, headers: { authorization: `Bearer ${await signDevToken(`tele-off-${run}`)}` } });
    expect(res.statusCode).toBe(404);

    // Retiring the only consent document switches teleconsultation off for the tenant
    await admin.query(`UPDATE clinical.tele_consent_document SET retired_at = now() WHERE tenant_id = $1`, [t.tenantId]);
    try {
      const off = await call('POST', `/v1/appointments/${appointmentId}/teleconsult/link`, { as: 'frontDesk' });
      expect(off.body.error.details.reason).toBe('teleconsult_not_configured');
    } finally {
      await admin.query(`UPDATE clinical.tele_consent_document SET retired_at = NULL WHERE tenant_id = $1`, [t.tenantId]);
    }
    expect((await call('POST', `/v1/appointments/${appointmentId}/teleconsult/link`, { as: 'frontDesk' })).status).toBe(201);
  });
});

describe('database guards', () => {
  it('rejects a "consulted" ending without identity, illegal transitions, and edits to the event log', async () => {
    const { appointmentId } = await virtualBooking('11:40', 'Guard');
    const { rows: [s] } = await admin.query(`SELECT id FROM clinical.tele_session WHERE appointment_id = $1`, [appointmentId]);
    await expect(admin.query(`UPDATE clinical.tele_session SET status = 'completed', started_at = now(), ended_at = now(), end_outcome = 'patient_did_not_join' WHERE id = $1`, [s.id])).rejects.toThrow(/cannot move from scheduled to completed/);
    await admin.query(`UPDATE clinical.tele_session SET status = 'in_progress', started_at = now() - interval '1 minute' WHERE id = $1`, [s.id]);
    await expect(admin.query(`UPDATE clinical.tele_session SET status = 'completed', ended_at = now(), end_outcome = 'consulted' WHERE id = $1`, [s.id])).rejects.toThrow(/check constraint/);
    await admin.query(`UPDATE clinical.tele_session SET status = 'completed', ended_at = now(), end_outcome = 'patient_did_not_join' WHERE id = $1`, [s.id]);
    await expect(admin.query(`UPDATE clinical.tele_session SET status = 'waiting' WHERE id = $1`, [s.id])).rejects.toThrow(/cannot move from completed to waiting/);
    await expect(admin.query(`UPDATE clinical.tele_session_event SET event_type = 'ended' WHERE session_id = $1`, [s.id])).rejects.toThrow(/immutable/);
    await expect(admin.query(`UPDATE clinical.tele_consent_document SET body = 'changed' WHERE tenant_id = $1`, [t.tenantId])).rejects.toThrow(/cannot be changed/);
  });
});
