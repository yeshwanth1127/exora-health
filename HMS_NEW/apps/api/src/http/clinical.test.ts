// Phase 5 over HTTP: check-in opens the encounter (worker consumer) → nurse records vitals → doctor
// starts, writes and signs a note, adds diagnoses and an allergy, finishes → appointment completed.
// Also: chart privacy (care relationship, break-glass), note immutability, CORS and dev login.
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@hms/db';
import { config } from '../../../../db/scripts/config.mjs';
import { adminPool, createTenant, type TenantFixture } from '../../../../db/tests/db.ts';
import { dispatchOnce } from '../../../worker/src/dispatcher.ts';
import { consumers } from '../consumers.ts';
import { signDevToken } from '../auth/dev-token.ts';
import { createVerifier } from '../auth/verify.ts';
import { DEV_ISSUER, DEV_SECRET_DEFAULT } from '../config.ts';
import { buildServer } from '../server.ts';

const admin = adminPool();
const db = createDb({ connectionString: config.testAppDatabaseUrl, maxConnections: 10 });
let app: FastifyInstance;
let t: TenantFixture;
let monday: string;
let hs: string;
const run = randomUUID().slice(0, 8);
type Who = 'admin' | 'frontDesk' | 'nurse' | 'doctor' | 'doctor2';
const staffIds = {} as Record<Who, string>;
const tokens = {} as Record<Who, string>;

const ist = (time: string) => `${monday}T${time}:00+05:30`;

async function call(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS', url: string, opts: { as?: Who | null; body?: unknown; idem?: boolean; now?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.as !== null) headers.authorization = `Bearer ${tokens[opts.as ?? 'admin']}`;
  if (opts.idem) headers['idempotency-key'] = `t-${randomUUID()}`;
  headers['x-test-now'] = opts.now ?? ist('09:00');
  const res = await app.inject({ method, url, headers, ...(opts.body !== undefined ? { payload: opts.body as object } : {}) });
  return { status: res.statusCode, body: res.body ? res.json() : null, headers: res.headers };
}

/** Runs the worker's consumers until nothing is pending. */
async function runWorker() {
  for (let i = 0; i < 20; i++) if ((await dispatchOnce(db, consumers, { batchSize: 200 })).claimed === 0) break;
}

/** Books and checks in a new patient for the doctor at `slot`; returns appointment, patient and encounter ids. */
async function checkedInVisit(slot: string, name: string) {
  const hold = await call('POST', '/v1/holds', { as: 'frontDesk', idem: true, now: ist('07:00'), body: { staffId: staffIds.doctor, slotStart: ist(slot) } });
  const patient = await call('POST', '/v1/patients', { as: 'frontDesk', idem: true, body: { givenName: name, sex: 'female', registeredFacilityId: t.facilityId, source: 'front_desk' } });
  const appt = await call('POST', '/v1/appointments', { as: 'frontDesk', idem: true, now: ist('07:00'), body: { reservationId: hold.body.reservationId, patientId: patient.body.patientId, originChannel: 'front_desk', reason: 'Fever and cough' } });
  const checkIn = await call('POST', `/v1/appointments/${appt.body.appointmentId}/check-in`, { as: 'frontDesk', idem: true, now: ist('08:30'), body: {} });
  expect(checkIn.status).toBe(200);
  await runWorker();
  const enc = await call('GET', `/v1/appointments/${appt.body.appointmentId}/encounter`, { as: 'frontDesk' });
  expect(enc.status).toBe(200);
  return { appointmentId: appt.body.appointmentId as string, patientId: patient.body.patientId as string, encounterId: enc.body.encounterId as string };
}

beforeAll(async () => {
  app = buildServer({
    db,
    verifier: createVerifier({ mode: 'dev', secret: DEV_SECRET_DEFAULT, issuer: DEV_ISSUER }),
    allowClockOverride: true,
    corsOrigins: ['http://localhost:5173'],
    devLogin: (subject) => signDevToken(subject),
  });
  t = await createTenant(admin, 'clinical');
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
    await admin.query(`INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, status) VALUES ($1, $2, $3, $4, 'active')`, [t.tenantId, staffIds[who], DEV_ISSUER, `${who}-${run}`]);
    tokens[who] = await signDevToken(`${who}-${run}`);
  }
  // Only the first doctor has a current council registration (needed to sign notes).
  await admin.query(`INSERT INTO platform.staff_registration (tenant_id, staff_id, council, registration_no, valid_until) VALUES ($1, $2, 'NMC', $3, '2099-12-31')`, [t.tenantId, staffIds.doctor, `R-${run}`]);
  await admin.query(`INSERT INTO catalog.practitioner_affiliation (tenant_id, staff_id, facility_id, department_id, valid_from) VALUES ($1, $2, $3, $4, '2024-01-01')`, [t.tenantId, staffIds.doctor, t.facilityId, dept]);
  const consult = await one(`INSERT INTO catalog.service_item (tenant_id, code, name, category) VALUES ($1, 'CONS', 'Consultation', 'consultation') RETURNING id`, [t.tenantId]);
  hs = await one(`INSERT INTO catalog.healthcare_service (tenant_id, department_id, code, name, consultation_service_item_id) VALUES ($1, $2, 'GM-OPD', 'GM OPD', $3) RETURNING id`, [t.tenantId, dept, consult]);
  for (const [code, name, unit] of [['BP_SYS', 'Systolic BP', 'mm[Hg]'], ['BP_DIA', 'Diastolic BP', 'mm[Hg]'], ['PULSE', 'Pulse', '/min'], ['TEMP', 'Temperature', 'Cel']]) {
    await admin.query(`INSERT INTO catalog.observation_definition (tenant_id, code, name, category, value_type, unit) VALUES ($1, $2, $3, 'vital_sign', 'numeric', $4)`, [t.tenantId, code, name, unit]);
  }
  monday = (await admin.query<{ d: string }>(`SELECT (date_trunc('week', now() AT TIME ZONE 'Asia/Kolkata') + interval '14 days')::date::text AS d`)).rows[0]!.d;
  await call('POST', `/v1/practitioners/${staffIds.doctor}/calendar`);
  const session = await call('POST', `/v1/practitioners/${staffIds.doctor}/weekly-sessions`, {
    body: { facilityId: t.facilityId, weekday: 1, start: '09:00', end: '12:00', slotMinutes: 15, healthcareServiceId: hs, effectiveFrom: '2024-01-01' },
  });
  expect(session.status).toBe(201);
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  await admin.end();
});

describe('a consultation from check-in to completion', () => {
  it('runs end to end with every rule enforced', async () => {
    const { appointmentId, patientId, encounterId } = await checkedInVisit('09:00', 'Lata');

    // The front desk sees the worklist but not the chart
    const worklist = await call('GET', `/v1/encounters?facilityId=${t.facilityId}&date=${monday}`, { as: 'frontDesk' });
    expect(worklist.body.items).toEqual([expect.objectContaining({ encounterId, status: 'arrived', patientName: 'Lata', tokenNo: 1 })]);
    expect((await call('GET', `/v1/encounters/${encounterId}`, { as: 'frontDesk' })).status).toBe(403);

    // Nurse takes vitals at triage (joining the active encounter); an unknown code is rejected
    expect((await call('POST', `/v1/encounters/${encounterId}/vitals`, { as: 'nurse', body: { values: [{ code: 'NOPE', value: 1 }] } })).status).toBe(400);
    const vitals = await call('POST', `/v1/encounters/${encounterId}/vitals`, {
      as: 'nurse',
      now: ist('08:50'),
      body: { values: [{ code: 'BP_SYS', value: 150 }, { code: 'BP_DIA', value: 95 }, { code: 'PULSE', value: 88 }, { code: 'TEMP', value: 38.4 }] },
    });
    expect(vitals.status).toBe(201);
    // A mistyped value is corrected, never overwritten
    const bp = vitals.body.observations.find((o: { code: string }) => o.code === 'BP_SYS');
    const corrected = await call('POST', `/v1/observations/${bp.observationId}/correct`, { as: 'nurse', body: { value: 140, reason: 'Misread the cuff' } });
    expect(corrected.body).toMatchObject({ status: 'amended', replacementId: expect.any(String) });

    // Doctor starts the consultation and writes a SOAP note
    expect((await call('POST', `/v1/encounters/${encounterId}/start`, { as: 'doctor', now: ist('09:02') })).body).toEqual({ encounterId, status: 'in_progress' });
    const badNote = await call('POST', `/v1/encounters/${encounterId}/notes`, { as: 'doctor', idem: true, body: { noteType: 'consultation', templateCode: 'opd_consultation', data: { mood: 'happy' } } });
    expect(badNote.status).toBe(400); // not a field of the template
    const note = await call('POST', `/v1/encounters/${encounterId}/notes`, {
      as: 'doctor',
      idem: true,
      now: ist('09:05'),
      body: { noteType: 'consultation', templateCode: 'opd_consultation', data: { subjective: 'Fever 3 days, dry cough', objective: 'Throat congested' } },
    });
    expect(note).toMatchObject({ status: 201, body: { status: 'draft', currentVersion: 1 } });
    const noteId = note.body.noteId as string;
    const v2 = await call('PUT', `/v1/notes/${noteId}`, { as: 'doctor', body: { baseVersion: 1, data: { subjective: 'Fever 3 days, dry cough', objective: 'Throat congested', assessment: 'Viral URTI', plan: 'Rest, fluids, review in 3 days' } } });
    expect(v2.body).toMatchObject({ status: 'draft', currentVersion: 2 });
    expect((await call('PUT', `/v1/notes/${noteId}`, { as: 'doctor', body: { baseVersion: 1, narrative: 'stale edit' } })).status).toBe(409);
    expect((await call('PUT', `/v1/notes/${noteId}`, { as: 'nurse', body: { baseVersion: 2, narrative: 'not mine' } })).status).toBe(403);
    expect((await call('POST', `/v1/notes/${noteId}/sign`, { as: 'nurse' })).status).toBe(403); // nurses can't sign
    expect((await call('POST', `/v1/notes/${noteId}/sign`, { as: 'doctor', now: ist('09:12') })).body).toMatchObject({ status: 'signed' });

    // After signing, a change is an amendment with a reason
    expect(await call('PUT', `/v1/notes/${noteId}`, { as: 'doctor', body: { baseVersion: 2, narrative: 'add' } })).toMatchObject({
      status: 422,
      body: { error: { details: { reason: 'amendment_reason_required' } } },
    });
    expect((await call('PUT', `/v1/notes/${noteId}`, { as: 'doctor', body: { baseVersion: 2, narrative: 'Advised paracetamol', amendmentReason: 'Omitted advice' } })).body).toMatchObject({ status: 'amended', currentVersion: 3 });
    const { rows: versions } = await admin.query(`SELECT version_no, amendment_reason FROM clinical.clinical_note_version WHERE note_id = $1 ORDER BY version_no`, [noteId]);
    expect(versions).toEqual([
      { version_no: 1, amendment_reason: null },
      { version_no: 2, amendment_reason: null },
      { version_no: 3, amendment_reason: 'Omitted advice' },
    ]);
    await expect(admin.query(`UPDATE clinical.clinical_note_version SET narrative = 'tampered' WHERE note_id = $1`, [noteId])).rejects.toMatchObject({ code: '42501' });

    // Diagnoses (one primary only) and an allergy
    expect((await call('POST', `/v1/encounters/${encounterId}/diagnoses`, { as: 'doctor', body: { role: 'primary', display: 'Acute upper respiratory infection', codeSystem: 'icd10_who', code: 'J06.9' } })).status).toBe(201);
    expect((await call('POST', `/v1/encounters/${encounterId}/diagnoses`, { as: 'doctor', body: { role: 'primary', display: 'Something else' } })).status).toBe(409);
    expect((await call('POST', `/v1/encounters/${encounterId}/diagnoses`, { as: 'doctor', body: { role: 'secondary', display: 'Essential hypertension', isChronic: true } })).status).toBe(201);
    expect((await call('POST', `/v1/patients/${patientId}/allergies`, { as: 'doctor', body: { category: 'drug', substance: 'Penicillin', reaction: 'Rash', severity: 'moderate' } })).status).toBe(201);

    // Finishing is blocked while a draft note exists
    const draft = await call('POST', `/v1/encounters/${encounterId}/notes`, { as: 'doctor', idem: true, body: { noteType: 'progress', narrative: 'scratch' } });
    expect(await call('POST', `/v1/encounters/${encounterId}/finish`, { as: 'doctor', now: ist('09:20'), body: { disposition: 'discharged_home' } })).toMatchObject({
      status: 422,
      body: { error: { details: { reason: 'unsigned_notes' } } },
    });
    await call('POST', `/v1/notes/${draft.body.noteId}/entered-in-error`, { as: 'doctor', body: { reason: 'Not needed' } });
    expect((await call('POST', `/v1/encounters/${encounterId}/finish`, { as: 'doctor', now: ist('09:20'), body: { disposition: 'follow_up', followUpAdvisedOn: '2099-01-01' } })).body).toEqual({ encounterId, status: 'finished' });

    // The worker completes the appointment and closes the queue token
    await runWorker();
    const appt = await call('GET', `/v1/appointments/${appointmentId}`, { as: 'frontDesk' });
    expect(appt.body).toMatchObject({ status: 'completed', tokenStatus: 'done' });

    // The chart shows allergies, problems, the finished encounter and latest (corrected) vitals; viewing is audited
    const chart = await call('GET', `/v1/patients/${patientId}/chart`, { as: 'doctor' });
    expect(chart.status).toBe(200);
    expect(chart.body.allergies.map((a: { substance: string }) => a.substance)).toEqual(['Penicillin']);
    expect(chart.body.problems.map((p: { display: string }) => p.display).sort()).toEqual(['Acute upper respiratory infection', 'Essential hypertension']);
    expect(chart.body.encounters[0]).toMatchObject({ encounterId, status: 'finished', disposition: 'follow_up' });
    expect(chart.body.latestVitals.find((v: { code: string }) => v.code === 'BP_SYS').valueNum).toBe('140');
    const detail = await call('GET', `/v1/encounters/${encounterId}`, { as: 'doctor' });
    expect(detail.body.notes.map((n: { status: string }) => n.status)).toEqual(['amended', 'entered_in_error']);
    const { rows: views } = await admin.query(`SELECT count(*)::int AS n FROM platform.audit_event WHERE patient_id = $1 AND action = 'view' AND actor_staff_id = $2`, [patientId, staffIds.doctor]);
    expect(views[0].n).toBe(2);
  });
});

describe('chart privacy', () => {
  it('a doctor not caring for the patient is refused, and can use audited break-glass access', async () => {
    const { patientId, encounterId } = await checkedInVisit('10:00', 'Private');
    expect(await call('GET', `/v1/patients/${patientId}/chart`, { as: 'doctor2' })).toMatchObject({ status: 403, body: { error: { details: { reason: 'no_care_relationship' } } } });
    expect((await call('GET', `/v1/encounters/${encounterId}`, { as: 'doctor2' })).status).toBe(403);
    expect((await call('POST', `/v1/patients/${patientId}/break-glass`, { as: 'doctor2', body: { reason: 'short' } })).status).toBe(400);
    expect((await call('POST', `/v1/patients/${patientId}/break-glass`, { as: 'doctor2', body: { reason: 'Patient collapsed in corridor, need history' } })).status).toBe(201);
    expect((await call('GET', `/v1/patients/${patientId}/chart`, { as: 'doctor2' })).status).toBe(200);
    const { rows } = await admin.query(`SELECT count(*)::int AS n FROM platform.audit_event WHERE patient_id = $1 AND action = 'break_glass'`, [patientId]);
    expect(rows[0].n).toBe(1);
  });

  it('signing needs a current professional registration', async () => {
    const patient = await call('POST', '/v1/patients', { as: 'frontDesk', idem: true, body: { givenName: 'Unscheduled', sex: 'male', registeredFacilityId: t.facilityId, source: 'emergency' } });
    const enc = await call('POST', '/v1/encounters', { as: 'admin', idem: true, body: { patientId: patient.body.patientId, facilityId: t.facilityId, attendingStaffId: staffIds.doctor2, encounterClass: 'emergency' } });
    expect(enc).toMatchObject({ status: 201, body: { encounterNo: expect.stringMatching(/^ER-\d{6}$/) } });
    const note = await call('POST', `/v1/encounters/${enc.body.encounterId}/notes`, { as: 'doctor2', idem: true, body: { noteType: 'history', narrative: 'Chest pain' } });
    expect(await call('POST', `/v1/notes/${note.body.noteId}/sign`, { as: 'doctor2' })).toMatchObject({ status: 422, body: { error: { details: { reason: 'registration_required' } } } });
  });

  it('cancelling a checked-in appointment cancels its not-yet-started encounter', async () => {
    const { appointmentId, encounterId } = await checkedInVisit('10:15', 'Leaving');
    expect((await call('POST', `/v1/appointments/${appointmentId}/cancel`, { as: 'frontDesk', body: { reason: 'Patient left' } })).status).toBe(200);
    await runWorker();
    const { rows } = await admin.query(`SELECT status, cancel_reason FROM clinical.encounter WHERE id = $1`, [encounterId]);
    expect(rows[0]).toEqual({ status: 'cancelled', cancel_reason: 'Appointment cancelled: Patient left' });
  });
});

describe('front-end support', () => {
  it('answers CORS preflight for the allowed origin only', async () => {
    const preflight = (origin: string) =>
      app.inject({ method: 'OPTIONS', url: '/v1/me', headers: { origin, 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization,idempotency-key' } });
    const allowed = await preflight('http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(String(allowed.headers['access-control-allow-headers'])).toContain('idempotency-key');
    expect((await preflight('https://evil.example')).headers['access-control-allow-origin']).toBeUndefined();
  });

  it('dev login returns a token for a seeded identity', async () => {
    const res = await app.inject({ method: 'POST', url: '/dev/login', payload: { subject: `nurse-${run}` } });
    expect(res.statusCode).toBe(200);
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${res.json().token}` } });
    expect(me.json().staffId).toBe(staffIds.nurse);
  });
});
