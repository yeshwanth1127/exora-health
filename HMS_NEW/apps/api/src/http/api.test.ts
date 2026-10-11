// HTTP API end to end: authentication, per-facility permissions, validation and the booking journey
// (WhatsApp bot books → front desk registers + checks in → doctor calls, starts, completes).
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@hms/db';
import { config } from '../../../../db/scripts/config.mjs';
import { adminPool, createTenant, type TenantFixture } from '../../../../db/tests/db.ts';
import { signDevToken } from '../auth/dev-token.ts';
import { createVerifier } from '../auth/verify.ts';
import { DEV_ISSUER, DEV_SECRET_DEFAULT } from '../config.ts';
import { buildServer } from '../server.ts';

const admin = adminPool();
const db = createDb({ connectionString: config.testAppDatabaseUrl, maxConnections: 10 });
let app: FastifyInstance;
let t: TenantFixture;
let facility2: string;
let doctor: string;
let monday: string;
const run = randomUUID().slice(0, 8); // identities are global, so make this run's subjects unique
const tokens: Record<'admin' | 'branchAdmin' | 'frontDesk' | 'nurse' | 'doctor' | 'bot', string> = {} as never;

const ist = (date: string, time: string) => `${date}T${time}:00+05:30`;

interface CallOptions {
  token?: string | null;
  body?: unknown;
  idem?: string | true;
  now?: string;
  headers?: Record<string, string>;
}

async function call(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, opts: CallOptions = {}) {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.token !== null) headers.authorization = `Bearer ${opts.token ?? tokens.admin}`;
  if (opts.idem) headers['idempotency-key'] = opts.idem === true ? `test-${randomUUID()}` : opts.idem;
  if (opts.now) headers['x-test-now'] = opts.now;
  const res = await app.inject({ method, url, headers, ...(opts.body !== undefined ? { payload: opts.body as object } : {}) });
  return { status: res.statusCode, body: res.body ? res.json() : null, headers: res.headers };
}

beforeAll(async () => {
  app = buildServer({ db, verifier: createVerifier({ mode: 'dev', secret: DEV_SECRET_DEFAULT, issuer: DEV_ISSUER }), allowClockOverride: true });
  t = await createTenant(admin, 'api');
  const one = async (text: string, values: unknown[]) => (await admin.query<{ id: string }>(text, values)).rows[0]!.id;

  facility2 = await one(`INSERT INTO platform.facility (tenant_id, organization_id, code, name, facility_type, state_code) VALUES ($1, $2, 'F2', 'Branch 2', 'clinic', '29') RETURNING id`, [t.tenantId, t.organizationId]);
  const dept = await one(`INSERT INTO platform.department (tenant_id, facility_id, code, name, kind) VALUES ($1, $2, 'GM', 'General Medicine', 'clinical') RETURNING id`, [t.tenantId, t.facilityId]);
  const dept2 = await one(`INSERT INTO platform.department (tenant_id, facility_id, code, name, kind) VALUES ($1, $2, 'GM', 'General Medicine', 'clinical') RETURNING id`, [t.tenantId, facility2]);
  const staff = (no: string, name: string, type: string, system = false) =>
    one(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type, is_system_account) VALUES ($1, $2, $3, $3, $4, $5) RETURNING id`, [t.tenantId, no, name, type, system]);
  const people = {
    admin: await staff('A1', 'Admin', 'admin'),
    branchAdmin: await staff('A2', 'Branch 1 Admin', 'admin'),
    frontDesk: await staff('F1', 'Front Desk', 'admin'),
    nurse: await staff('N1', 'Nurse', 'nurse'),
    doctor: await staff('D1', 'Dr API', 'doctor'),
    bot: await staff('SVC', 'WhatsApp bot', 'other', true),
  };
  doctor = people.doctor;
  const grants: Array<[keyof typeof people, string, string | null]> = [
    ['admin', 'tenant_admin', null],
    ['branchAdmin', 'tenant_admin', t.facilityId], // administers Branch 1 only
    ['frontDesk', 'front_desk', t.facilityId], // Branch 1 only
    ['nurse', 'nurse', t.facilityId],
    ['doctor', 'doctor', null],
    ['bot', 'booking_agent', null],
  ];
  for (const [who, role, facility] of grants) {
    await admin.query(
      `INSERT INTO platform.role_grant (tenant_id, staff_id, role_id, facility_id) SELECT $1, $2, id, $4 FROM platform.role WHERE tenant_id IS NULL AND code = $3`,
      [t.tenantId, people[who], role, facility],
    );
  }
  for (const who of Object.keys(people) as Array<keyof typeof people>) {
    await admin.query(`INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, status) VALUES ($1, $2, $3, $4, 'active')`, [
      t.tenantId,
      people[who],
      DEV_ISSUER,
      `${who}-${run}`,
    ]);
    tokens[who] = await signDevToken(`${who}-${run}`);
  }
  for (const f of [[t.facilityId, dept], [facility2, dept2]]) {
    await admin.query(`INSERT INTO catalog.practitioner_affiliation (tenant_id, staff_id, facility_id, department_id, valid_from) VALUES ($1, $2, $3, $4, '2024-01-01')`, [t.tenantId, doctor, f[0], f[1]]);
  }
  const consult = await one(`INSERT INTO catalog.service_item (tenant_id, code, name, category) VALUES ($1, 'CONS', 'Consultation', 'consultation') RETURNING id`, [t.tenantId]);
  const hs = await one(`INSERT INTO catalog.healthcare_service (tenant_id, department_id, code, name, consultation_service_item_id) VALUES ($1, $2, 'GM-OPD', 'GM OPD', $3) RETURNING id`, [t.tenantId, dept, consult]);
  const list = await one(`INSERT INTO catalog.price_list (tenant_id, code, name, kind, valid_from) VALUES ($1, 'CASH', 'Cash', 'cash', '2024-01-01') RETURNING id`, [t.tenantId]);
  await admin.query(`INSERT INTO catalog.price_list_item (tenant_id, price_list_id, service_item_id, unit_price_minor, valid_from) VALUES ($1, $2, $3, 50000, '2024-01-01')`, [t.tenantId, list, consult]);
  await admin.query(`UPDATE catalog.price_list SET status = 'active', activated_at = now(), is_default = true WHERE id = $1`, [list]);
  monday = (await admin.query<{ d: string }>(`SELECT (date_trunc('week', now() AT TIME ZONE 'Asia/Kolkata') + interval '14 days')::date::text AS d`)).rows[0]!.d;

  // Set up the doctor's calendar through the API, as an administrator would.
  expect((await call('POST', `/v1/practitioners/${doctor}/calendar`)).status).toBe(201);
  const session = (body: object) => call('POST', `/v1/practitioners/${doctor}/weekly-sessions`, { body: { effectiveFrom: '2024-01-01', ...body } });
  expect((await session({ facilityId: t.facilityId, weekday: 1, start: '09:00', end: '11:00', slotMinutes: 15, healthcareServiceId: hs })).status).toBe(201);
  expect((await session({ facilityId: t.facilityId, weekday: 1, start: '17:00', end: '18:00', maxWalkInTokens: 5, healthcareServiceId: hs })).status).toBe(201);
  expect((await session({ facilityId: facility2, weekday: 2, start: '10:00', end: '12:00', slotMinutes: 30 })).status).toBe(201);
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  await admin.end();
});

describe('service endpoints', () => {
  it('health and readiness need no token', async () => {
    expect(await call('GET', '/health', { token: null })).toMatchObject({ status: 200, body: { status: 'ok' } });
    expect(await call('GET', '/ready', { token: null })).toMatchObject({ status: 200, body: { status: 'ready' } });
  });

  it('unknown routes return a JSON 404', async () => {
    expect(await call('GET', '/v1/nope')).toMatchObject({ status: 404, body: { error: { code: 'route_not_found' } } });
  });
});

describe('authentication', () => {
  it('rejects a missing, forged or expired token with 401', async () => {
    expect((await call('GET', '/v1/me', { token: null })).status).toBe(401);
    const forged = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setIssuer(DEV_ISSUER).setSubject(`admin-${run}`).setExpirationTime('1h').sign(new TextEncoder().encode('not-the-secret-not-the-secret-123'));
    expect((await call('GET', '/v1/me', { token: forged })).status).toBe(401);
    const expired = await signDevToken(`admin-${run}`, { ttl: '-1m' });
    expect((await call('GET', '/v1/me', { token: expired })).status).toBe(401);
  });

  it('rejects a valid token for an identity with no account (403)', async () => {
    expect(await call('GET', '/v1/me', { token: await signDevToken(`stranger-${run}`) })).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
  });

  it('describes the caller, with permissions per facility scope', async () => {
    const { status, body } = await call('GET', '/v1/me', { token: tokens.frontDesk });
    expect(status).toBe(200);
    expect(body.tenantId).toBe(t.tenantId);
    expect(body.permissions['appointments.book']).toEqual([t.facilityId]);
    expect(body.permissions['schedules.manage']).toBeUndefined();
  });
});

describe('permissions', () => {
  it('a nurse cannot book; front desk cannot manage schedules', async () => {
    const hold = await call('POST', '/v1/holds', { token: tokens.nurse, idem: true, body: { staffId: doctor, slotStart: ist(monday, '09:00') }, now: ist(monday, '07:00') });
    expect(hold).toMatchObject({ status: 403, body: { error: { code: 'forbidden', details: { permission: 'appointments.book' } } } });
    const exception = await call('POST', `/v1/practitioners/${doctor}/exceptions`, { token: tokens.frontDesk, body: { onDate: monday, kind: 'closed' } });
    expect(exception.status).toBe(403);
  });

  it("front desk scoped to Branch 1 cannot book the doctor's Branch 2 slots", async () => {
    const tuesday = (await admin.query<{ d: string }>(`SELECT ($1::date + 1)::text AS d`, [monday])).rows[0]!.d;
    const res = await call('POST', '/v1/holds', { token: tokens.frontDesk, idem: true, body: { staffId: doctor, slotStart: ist(tuesday, '10:00') }, now: ist(monday, '07:00') });
    expect(res).toMatchObject({ status: 403, body: { error: { details: { facilityId: facility2 } } } });
  });

  it('facility-scoped staff must say which facility when listing appointments', async () => {
    expect((await call('GET', `/v1/appointments?from=${monday}&to=${monday}`, { token: tokens.frontDesk })).status).toBe(400);
    expect((await call('GET', `/v1/appointments?from=${monday}&to=${monday}&facilityId=${t.facilityId}`, { token: tokens.frontDesk })).status).toBe(200);
    expect((await call('GET', `/v1/appointments?from=${monday}&to=${monday}&facilityId=${facility2}`, { token: tokens.frontDesk })).status).toBe(403);
  });
});

describe('facility scope of schedule changes (G01)', () => {
  // The doctor works Mondays at Branch 1 and Tuesdays at Branch 2; branchAdmin manages Branch 1 only.
  const later = (days: number) => new Date(Date.parse(monday) + days * 86_400_000).toISOString().slice(0, 10);
  const as = (token: string, body: object) => ({ token, body });

  it('weekly sessions: only at a facility the caller manages, and ending one checks its facility', async () => {
    const add = (facilityId: string) => call('POST', `/v1/practitioners/${doctor}/weekly-sessions`, as(tokens.branchAdmin, { facilityId, weekday: 3, start: '09:00', end: '10:00', slotMinutes: 15, effectiveFrom: '2030-01-01' }));
    expect((await add(t.facilityId)).status).toBe(201);
    expect((await add(facility2)).status).toBe(403);
    const { rows: [branch2Rule] } = await admin.query<{ id: string }>(`SELECT id FROM booking.schedule_rule WHERE facility_id = $1 LIMIT 1`, [facility2]);
    expect((await call('POST', `/v1/weekly-sessions/${branch2Rule!.id}/end`, as(tokens.branchAdmin, { effectiveTo: '2031-01-01' }))).status).toBe(403);
    expect((await call('POST', `/v1/weekly-sessions/${randomUUID()}/end`, as(tokens.branchAdmin, { effectiveTo: '2031-01-01' }))).status).toBe(404);
  });

  it('leave and blocks reach every facility the doctor works at; extra hours only their own', async () => {
    const exception = (token: string, body: object) => call('POST', `/v1/practitioners/${doctor}/exceptions`, as(token, { onDate: later(23), ...body }));
    expect((await exception(tokens.branchAdmin, { kind: 'closed', reason: 'Leave' })).status).toBe(403);
    expect((await exception(tokens.branchAdmin, { kind: 'block', start: '10:00', end: '11:00' })).status).toBe(403);
    expect((await exception(tokens.branchAdmin, { kind: 'extra_hours', facilityId: t.facilityId, start: '14:00', end: '15:00', slotMinutes: 15 })).status).toBe(201);
    expect((await exception(tokens.branchAdmin, { kind: 'extra_hours', facilityId: facility2, start: '14:00', end: '15:00', slotMinutes: 15 })).status).toBe(403);
  });

  it("a day plan must cover every facility it can take sessions from", async () => {
    const plan = (date: string, blocks: object[]) => call('PUT', `/v1/practitioners/${doctor}/day-plans/${date}`, as(tokens.branchAdmin, { replacesWeekly: true, blocks }));
    const branch1Block = { facilityId: t.facilityId, start: '09:00', end: '10:00', slotMinutes: 15 };
    expect((await plan(later(22), [branch1Block])).status).toBe(403); // a Tuesday: replaces the Branch 2 session
    expect((await plan(later(22), [])).status).toBe(403);
    expect((await plan(later(21), [branch1Block])).status).toBe(200); // a Monday: Branch 1 only
    expect((await call('PUT', `/v1/practitioners/${doctor}/day-plans/${later(22)}`, as(tokens.admin, { replacesWeekly: true, blocks: [] }))).status).toBe(200);
  });

  it('creating a calendar needs scope at one of the doctor\'s facilities', async () => {
    expect((await call('POST', `/v1/practitioners/${doctor}/calendar`, { token: tokens.branchAdmin })).status).toBe(200);
  });

  it('facility-scoped readers see only their facilities\' sessions and slots', async () => {
    const sessions = await call('GET', `/v1/practitioners/${doctor}/sessions?from=${monday}&to=${later(1)}`, { token: tokens.frontDesk });
    expect(sessions.status).toBe(200);
    expect(new Set(sessions.body.items.map((s: { facilityId: string }) => s.facilityId))).toEqual(new Set([t.facilityId]));
    const all = await call('GET', `/v1/practitioners/${doctor}/sessions?from=${monday}&to=${later(1)}`);
    expect(new Set(all.body.items.map((s: { facilityId: string }) => s.facilityId))).toEqual(new Set([t.facilityId, facility2]));
    const slots = await call('GET', `/v1/practitioners/${doctor}/slots?from=${later(1)}&to=${later(1)}`, { token: tokens.frontDesk, now: ist(monday, '07:00') });
    expect(slots.body.items).toEqual([]);
  });
});

describe('schedule scope, reads and reversals (G37, G06, G07, G05)', () => {
  const later = (days: number) => new Date(Date.parse(monday) + days * 86_400_000).toISOString().slice(0, 10);
  const day = () => later(28); // a Monday: Branch 1 weekly session 09:00–11:00 (8 slots)
  const slotsAt = async (facilityId: string) =>
    (await call('GET', `/v1/practitioners/${doctor}/slots?from=${day()}&to=${day()}&facilityId=${facilityId}`, { now: ist(monday, '07:00') })).body.items.length;

  it('a clinic closure leaves the other clinic bookable, and revoking it restores the slots', async () => {
    const extra = await call('POST', `/v1/practitioners/${doctor}/exceptions`, { idem: true, body: { onDate: day(), kind: 'extra_hours', facilityId: facility2, start: '14:00', end: '15:00', slotMinutes: 30 } });
    expect(extra.status).toBe(201);
    expect([await slotsAt(t.facilityId), await slotsAt(facility2)]).toEqual([8, 2]);

    const closed = await call('POST', `/v1/practitioners/${doctor}/exceptions`, { token: tokens.branchAdmin, body: { onDate: day(), kind: 'closed', facilityId: t.facilityId, reason: 'Branch 1 maintenance' } });
    expect(closed.status).toBe(201);
    expect([await slotsAt(t.facilityId), await slotsAt(facility2)]).toEqual([0, 2]);
    const block = await call('POST', `/v1/practitioners/${doctor}/exceptions`, { body: { onDate: day(), kind: 'block', facilityId: facility2, start: '14:00', end: '14:30' } });
    expect(block.status).toBe(201);
    expect(await slotsAt(facility2)).toBe(1);

    // Reads: Branch 1 front desk sees its own and every-clinic exceptions, not Branch 2's
    const seen = await call('GET', `/v1/practitioners/${doctor}/exceptions?from=${day()}&to=${day()}`, { token: tokens.frontDesk });
    expect(seen.body.items.map((e: { scheduleExceptionId: string }) => e.scheduleExceptionId)).toEqual([closed.body.scheduleExceptionId]);

    // Reversal: needs scope and a reason, is audited, and is idempotent
    const revoke = (id: string, token = tokens.branchAdmin) => call('POST', `/v1/schedule-exceptions/${id}/revoke`, { token, body: { reason: 'Maintenance moved' } });
    expect((await revoke(block.body.scheduleExceptionId)).status).toBe(403);
    expect((await call('POST', `/v1/schedule-exceptions/${closed.body.scheduleExceptionId}/revoke`, { token: tokens.branchAdmin, body: { reason: '' } })).status).toBe(400);
    expect((await revoke(closed.body.scheduleExceptionId)).status).toBe(200);
    expect((await revoke(closed.body.scheduleExceptionId)).status).toBe(200);
    expect(await slotsAt(t.facilityId)).toBe(8);
    const { rows } = await admin.query(`SELECT count(*)::int AS n FROM platform.audit_event WHERE subject_id = $1 AND action = 'status_change'`, [closed.body.scheduleExceptionId]);
    expect(rows[0].n).toBe(1);
  });

  it('previews the appointments a closure would affect without saving anything', async () => {
    const hold = await call('POST', '/v1/holds', { token: tokens.frontDesk, idem: true, now: ist(monday, '07:00'), body: { staffId: doctor, slotStart: ist(day(), '10:00') } });
    const booked = await call('POST', '/v1/appointments', { token: tokens.frontDesk, idem: true, now: ist(monday, '07:00'), body: { reservationId: hold.body.reservationId, bookingParty: { name: 'Preview', phone: '+919800000001' }, originChannel: 'front_desk' } });
    expect(booked.status).toBe(201);
    const preview = (body: object, token = tokens.admin) => call('POST', `/v1/practitioners/${doctor}/exceptions/preview`, { token, body: { onDate: day(), ...body } });
    expect((await preview({ facilityId: t.facilityId })).body).toEqual({ affectedAppointmentIds: [booked.body.appointmentId] });
    expect((await preview({ facilityId: facility2 })).body).toEqual({ affectedAppointmentIds: [] });
    expect((await preview({ start: '11:00', end: '12:00' })).body).toEqual({ affectedAppointmentIds: [] });
    expect((await preview({}, tokens.frontDesk)).status).toBe(403);
    expect((await call('GET', `/v1/practitioners/${doctor}/exceptions?from=${day()}&to=${day()}`)).body.items).toHaveLength(3); // unchanged
  });

  it('holidays are listed and revoked, and a revoked date can be declared again', async () => {
    const tuesday = later(29);
    const sessionsOn = async () => (await call('GET', `/v1/practitioners/${doctor}/sessions?from=${tuesday}&to=${tuesday}`)).body.items.length;
    expect(await sessionsOn()).toBe(1);
    const holiday = await call('POST', `/v1/facilities/${facility2}/holidays`, { body: { date: tuesday, name: 'Festival' } });
    expect(holiday.status).toBe(201);
    expect(await sessionsOn()).toBe(0);
    expect((await call('GET', `/v1/facilities/${facility2}/holidays?from=${tuesday}&to=${tuesday}`)).body.items).toMatchObject([{ name: 'Festival', revokedAt: null }]);
    expect((await call('GET', `/v1/facilities/${facility2}/holidays?from=${tuesday}&to=${tuesday}`, { token: tokens.frontDesk })).status).toBe(403);
    const revoke = (token: string) => call('POST', `/v1/facility-holidays/${holiday.body.facilityHolidayId}/revoke`, { token, body: { reason: 'Declared by mistake' } });
    expect((await revoke(tokens.branchAdmin)).status).toBe(403);
    expect((await revoke(tokens.admin)).status).toBe(200);
    expect(await sessionsOn()).toBe(1);
    expect((await call('POST', `/v1/facilities/${facility2}/holidays`, { body: { date: tuesday, name: 'Festival (corrected)' } })).status).toBe(201);
  });

  it('reads the weekly plan and day plan; a stale or retried day-plan save cannot add a revision', async () => {
    const weekly = await call('GET', `/v1/practitioners/${doctor}/weekly-sessions?from=${monday}`, { token: tokens.frontDesk });
    expect(weekly.status).toBe(200);
    expect(new Set(weekly.body.items.map((r: { facilityId: string }) => r.facilityId))).toEqual(new Set([t.facilityId]));

    const planOn = later(35);
    expect((await call('GET', `/v1/practitioners/${doctor}/day-plans/${planOn}`)).body).toMatchObject({ revision: 0, blocks: [] });
    const body = { baseRevision: 0, replacesWeekly: true, blocks: [{ facilityId: t.facilityId, start: '08:00', end: '09:00', slotMinutes: 20 }] };
    const key = `plan-${run}`;
    const first = await call('PUT', `/v1/practitioners/${doctor}/day-plans/${planOn}`, { idem: key, body });
    expect(first.body).toMatchObject({ revision: 1 });
    expect((await call('PUT', `/v1/practitioners/${doctor}/day-plans/${planOn}`, { idem: key, body })).body).toMatchObject({ revision: 1 });
    expect(await call('PUT', `/v1/practitioners/${doctor}/day-plans/${planOn}`, { body })).toMatchObject({ status: 409, body: { error: { details: { reason: 'stale_revision', currentRevision: 1 } } } });
    expect((await call('GET', `/v1/practitioners/${doctor}/day-plans/${planOn}`)).body).toMatchObject({ revision: 1, replacesWeekly: true, blocks: [{ facilityId: t.facilityId, slotMinutes: 20 }] });
  });
});

describe('weekly plan replacement (G07)', () => {
  const later = (days: number) => new Date(Date.parse(monday) + days * 86_400_000).toISOString().slice(0, 10);
  const plan = () => ({
    facilityId: t.facilityId,
    visitMode: 'in_person',
    effectiveFrom: later(42), // a Monday
    effectiveTo: later(56),
    slotMinutes: 20,
    sessions: [{ weekday: 1, start: '10:00', end: '12:00' }, { weekday: 4, start: '09:00', end: '10:00' }],
  });
  const sessionsOn = async (date: string) =>
    (await call('GET', `/v1/practitioners/${doctor}/sessions?from=${date}&to=${date}`)).body.items.map((x: { startsAt: string; slotMinutes: number | null }) => [x.startsAt.slice(11, 16), x.slotMinutes]);

  it('previews without saving, refuses while appointments fall outside, then replaces atomically', async () => {
    const before = await sessionsOn(later(42));
    expect(before).toEqual([['03:30', 15], ['11:30', null]]); // 09:00 and 17:00 IST

    const hold = await call('POST', '/v1/holds', { token: tokens.frontDesk, idem: true, now: ist(monday, '07:00'), body: { staffId: doctor, slotStart: ist(later(49), '09:00') } });
    const booked = await call('POST', '/v1/appointments', { token: tokens.frontDesk, idem: true, now: ist(monday, '07:00'), body: { reservationId: hold.body.reservationId, bookingParty: { name: 'Outside', phone: '+919800000002' }, originChannel: 'front_desk' } });
    expect(booked.status).toBe(201);

    const preview = await call('POST', `/v1/practitioners/${doctor}/weekly-plan/preview`, { body: plan() });
    expect(preview.body).toMatchObject({ canSave: false, affectedAppointmentIds: [booked.body.appointmentId] });
    expect(preview.body.otherPublishedHours).toContainEqual({ facilityId: facility2, facilityName: 'Branch 2', visitMode: 'in_person', weekday: 2, start: '10:00', end: '12:00' });
    expect(await sessionsOn(later(42))).toEqual(before); // nothing saved
    expect(await call('PUT', `/v1/practitioners/${doctor}/weekly-plan`, { body: plan() })).toMatchObject({ status: 409, body: { error: { details: { reason: 'affected_appointments' } } } });

    expect((await call('POST', `/v1/appointments/${booked.body.appointmentId}/cancel`, { token: tokens.frontDesk, body: { reason: 'Doctor hours changing' } })).status).toBe(200);
    const key = `weekly-${run}`;
    const saved = await call('PUT', `/v1/practitioners/${doctor}/weekly-plan`, { idem: key, body: plan() });
    expect(saved).toMatchObject({ status: 200, body: { canSave: true, affectedAppointmentIds: [] } });
    expect((await call('PUT', `/v1/practitioners/${doctor}/weekly-plan`, { idem: key, body: plan() })).status).toBe(200); // retried: no duplicate rules

    expect(await sessionsOn(later(42))).toEqual([['04:30', 20]]); // Monday 10:00 IST
    expect(await sessionsOn(later(45))).toEqual([['03:30', 20]]); // Thursday 09:00 IST
    expect(await sessionsOn(later(56))).toEqual(before); // the old hours resume after the range
    expect(await sessionsOn(later(43))).toEqual([['04:30', 30]]); // Branch 2 Tuesday kept
  });

  it('checks clinic scope, overlap with other clinics, and the start date', async () => {
    expect((await call('PUT', `/v1/practitioners/${doctor}/weekly-plan`, { token: tokens.branchAdmin, body: { ...plan(), facilityId: facility2 } })).status).toBe(403);
    const clash = { ...plan(), facilityId: facility2, sessions: [{ weekday: 1, start: '11:00', end: '13:00' }] };
    expect(await call('PUT', `/v1/practitioners/${doctor}/weekly-plan`, { body: clash })).toMatchObject({ status: 409, body: { error: { details: { reason: 'overlaps_other_hours' } } } });
    expect(await call('PUT', `/v1/practitioners/${doctor}/weekly-plan`, { now: ist(monday, '07:00'), body: { ...plan(), effectiveFrom: monday } })).toMatchObject({ status: 422, body: { error: { details: { reason: 'starts_too_soon' } } } });
  });
});

describe('validation', () => {
  it('rejects bad input with 400 and the field issues', async () => {
    const res = await call('POST', '/v1/patients', { token: tokens.frontDesk, idem: true, body: { givenName: '', sex: 'x', registeredFacilityId: 'nope', source: 'front_desk' } });
    expect(res.status).toBe(400);
    expect(res.body.error.details.issues.map((i: { path: string }) => i.path).sort()).toEqual(['givenName', 'registeredFacilityId', 'sex']);
  });

  it('requires an Idempotency-Key on creating commands', async () => {
    const res = await call('POST', '/v1/patients', { token: tokens.frontDesk, body: { givenName: 'No Key', sex: 'female', registeredFacilityId: t.facilityId, source: 'front_desk' } });
    expect(res).toMatchObject({ status: 400, body: { error: { message: expect.stringContaining('Idempotency-Key') } } });
  });
});

describe('the booking journey over HTTP', () => {
  it('bot books for a WhatsApp caller → desk registers and checks in → doctor sees the patient', async () => {
    const at = ist(monday, '07:00');
    // 1. The WhatsApp bot finds the doctor and a free slot
    const practitioners = await call('GET', `/v1/practitioners?facilityId=${t.facilityId}`, { token: tokens.bot });
    expect(practitioners.body.items.map((p: { staffId: string }) => p.staffId)).toContain(doctor);
    const slots = await call('GET', `/v1/practitioners/${doctor}/slots?from=${monday}&to=${monday}`, { token: tokens.bot, now: at });
    expect(slots.status).toBe(200);
    expect(slots.body.items).toHaveLength(8);

    // 2. It holds 09:30 and books it for the caller; a second hold on the same slot is refused
    const hold = await call('POST', '/v1/holds', { token: tokens.bot, idem: true, now: at, body: { staffId: doctor, slotStart: ist(monday, '09:30') } });
    expect(hold.status).toBe(201);
    const clash = await call('POST', '/v1/holds', { token: tokens.frontDesk, idem: true, now: at, body: { staffId: doctor, slotStart: ist(monday, '09:30') } });
    expect(clash).toMatchObject({ status: 409, body: { error: { details: { reason: 'slot_unavailable' } } } });
    const bookKey = `book-${run}`;
    const bookBody = { reservationId: hold.body.reservationId, bookingParty: { name: 'Sunita', phone: '+919811122233', verifiedChannel: 'whatsapp' }, originChannel: 'whatsapp', reason: 'Cough' };
    const booked = await call('POST', '/v1/appointments', { token: tokens.bot, idem: bookKey, now: at, body: bookBody });
    expect(booked).toMatchObject({ status: 201, body: { status: 'confirmed', feeMinor: 50000 } });
    const retried = await call('POST', '/v1/appointments', { token: tokens.bot, idem: bookKey, now: at, body: bookBody });
    expect(retried.body.appointmentId).toBe(booked.body.appointmentId);
    const appointmentId = booked.body.appointmentId as string;

    // 3. On the day: checking in without knowing the patient is refused with a clear reason
    const morning = ist(monday, '08:45');
    expect(await call('POST', `/v1/appointments/${appointmentId}/check-in`, { token: tokens.frontDesk, idem: true, now: morning, body: {} })).toMatchObject({
      status: 422,
      body: { error: { details: { reason: 'patient_required' } } },
    });
    // The desk registers her, finds her by phone, and checks her in
    const reg = await call('POST', '/v1/patients', {
      token: tokens.frontDesk,
      idem: true,
      body: { givenName: 'Sunita', familyName: 'Rao', sex: 'female', phone: '+919811122233', registeredFacilityId: t.facilityId, source: 'front_desk' },
    });
    expect(reg).toMatchObject({ status: 201, body: { mrn: '000001' } });
    const found = await call('GET', '/v1/patients?phone=%2B919811122233', { token: tokens.frontDesk });
    expect(found.body.items.map((p: { patientId: string }) => p.patientId)).toEqual([reg.body.patientId]);
    const checkedIn = await call('POST', `/v1/appointments/${appointmentId}/check-in`, { token: tokens.frontDesk, idem: true, now: morning, body: { patientId: reg.body.patientId } });
    expect(checkedIn).toMatchObject({ status: 200, body: { tokenNo: 1 } });

    // 4. The doctor calls, starts and completes the consultation; the queue is then empty
    const queueKey = { staffId: doctor, facilityId: t.facilityId, date: monday };
    const called = await call('POST', '/v1/queue/call-next', { token: tokens.doctor, now: ist(monday, '09:30'), body: queueKey });
    expect(called).toMatchObject({ status: 200, body: { tokenNo: 1, patientId: reg.body.patientId } });
    expect((await call('POST', `/v1/queue-tokens/${called.body.tokenId}/start`, { token: tokens.doctor, now: ist(monday, '09:31') })).status).toBe(200);
    expect((await call('POST', `/v1/queue-tokens/${called.body.tokenId}/complete`, { token: tokens.doctor, now: ist(monday, '09:40') })).status).toBe(200);
    expect((await call('POST', '/v1/queue/call-next', { token: tokens.doctor, now: ist(monday, '09:41'), body: queueKey })).status).toBe(204);

    const final = await call('GET', `/v1/appointments/${appointmentId}`, { token: tokens.frontDesk });
    expect(final.body).toMatchObject({ status: 'completed', patientName: 'Sunita Rao', mrn: '000001', tokenNo: 1, tokenStatus: 'done', bookingPartyName: 'Sunita' });

    // Every write was attributed to whoever made it
    const { rows: history } = await admin.query(
      `SELECT h.to_status, s.display_name FROM booking.appointment_status_history h JOIN platform.staff s ON s.id = h.actor_staff_id
       WHERE h.appointment_id = $1 ORDER BY h.occurred_at, h.id`,
      [appointmentId],
    );
    expect(history).toEqual([
      { to_status: 'confirmed', display_name: 'WhatsApp bot' },
      { to_status: 'checked_in', display_name: 'Front Desk' },
      { to_status: 'completed', display_name: 'Dr API' },
    ]);
  });

  it('records the request id on audit and outbox rows', async () => {
    const requestId = randomUUID();
    const res = await call('POST', '/v1/patients', {
      token: tokens.frontDesk,
      idem: true,
      headers: { 'x-request-id': requestId },
      body: { givenName: 'Traced', sex: 'male', registeredFacilityId: t.facilityId, source: 'front_desk' },
    });
    expect(res.headers['x-request-id']).toBe(requestId);
    const { rows } = await admin.query(`SELECT count(*)::int AS n FROM platform.audit_event WHERE correlation_id = $1`, [requestId]);
    expect(rows[0].n).toBe(1);
  });

  it('walk-ins join the queue; cancelling needs a reason', async () => {
    const reg = await call('POST', '/v1/patients', { token: tokens.frontDesk, idem: true, body: { givenName: 'Walker', sex: 'male', registeredFacilityId: t.facilityId, source: 'front_desk' } });
    const walkIn = await call('POST', '/v1/walk-ins', { token: tokens.frontDesk, idem: true, now: ist(monday, '16:00'), body: { staffId: doctor, facilityId: t.facilityId, patientId: reg.body.patientId } });
    expect(walkIn).toMatchObject({ status: 201, body: { status: 'checked_in', tokenNo: 2 } });
    expect((await call('POST', `/v1/appointments/${walkIn.body.appointmentId}/cancel`, { token: tokens.frontDesk, body: {} })).status).toBe(400);
    expect(await call('POST', `/v1/appointments/${walkIn.body.appointmentId}/cancel`, { token: tokens.frontDesk, body: { reason: 'Left without being seen' } })).toMatchObject({
      status: 200,
      body: { status: 'cancelled' },
    });
  });
});

describe('tenant isolation over HTTP', () => {
  it("another tenant's administrator gets 404 for this tenant's appointment", async () => {
    const other = await createTenant(admin, 'api-other');
    const { rows: [s] } = await admin.query<{ id: string }>(
      `INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, 'X', 'X', 'Other Admin', 'admin') RETURNING id`,
      [other.tenantId],
    );
    await admin.query(`INSERT INTO platform.role_grant (tenant_id, staff_id, role_id) SELECT $1, $2, id FROM platform.role WHERE tenant_id IS NULL AND code = 'tenant_admin'`, [other.tenantId, s!.id]);
    await admin.query(`INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, status) VALUES ($1, $2, $3, $4, 'active')`, [other.tenantId, s!.id, DEV_ISSUER, `other-${run}`]);
    const { rows: [appt] } = await admin.query<{ id: string }>(`SELECT id FROM booking.appointment WHERE tenant_id = $1 LIMIT 1`, [t.tenantId]);
    const res = await call('GET', `/v1/appointments/${appt!.id}`, { token: await signDevToken(`other-${run}`) });
    expect(res.status).toBe(404);
  });
});
