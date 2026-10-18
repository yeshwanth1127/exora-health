// Per-person alert marks (docs/prd/staff-alerts.md): own rows only, upserts, read-all, validation.
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@hms/db';
import { config } from '../../../../db/scripts/config.mjs';
import { adminPool, createTenant, type TenantFixture } from '../../../../db/tests/db.ts';
import { signDevToken } from '../auth/dev-token.ts';
import { createVerifier } from '../auth/verify.ts';
import { DEV_ISSUER, DEV_SECRET_DEFAULT } from '../config.ts';
import { buildServer } from '../server.ts';

const admin = adminPool();
const db = createDb({ connectionString: config.testAppDatabaseUrl, maxConnections: 5 });
let app: FastifyInstance;
let t: TenantFixture;
const run = randomUUID().slice(0, 8);
const soon = new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10);
const people = {} as Record<'desk' | 'doctor' | 'admin', string>;
const tokens = {} as Record<keyof typeof people, string>;

async function call(method: 'GET' | 'POST' | 'PUT', url: string, token: string, body?: unknown) {
  const res = await app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(body !== undefined ? { payload: body as object } : {}) });
  return { status: res.statusCode, body: res.body ? res.json() : null };
}

beforeAll(async () => {
  app = buildServer({ db, verifier: createVerifier({ mode: 'dev', secret: DEV_SECRET_DEFAULT, issuer: DEV_ISSUER }) });
  t = await createTenant(admin, 'alerts');
  for (const [who, role] of [['desk', 'front_desk'], ['doctor', 'doctor'], ['admin', 'tenant_admin']] as const) {
    people[who] = (await admin.query<{ id: string }>(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, $2, $2, $2, $3) RETURNING id`, [t.tenantId, who, who === 'doctor' ? 'doctor' : 'admin'])).rows[0]!.id;
    await admin.query(`INSERT INTO platform.role_grant (tenant_id, staff_id, role_id, facility_id) SELECT $1, $2, id, $4 FROM platform.role WHERE tenant_id IS NULL AND code = $3`, [t.tenantId, people[who], role, t.facilityId]);
    await admin.query(`INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, status) VALUES ($1, $2, $3, $4, 'active')`, [t.tenantId, people[who], DEV_ISSUER, `${who}-${run}`]);
    tokens[who] = await signDevToken(`${who}-${run}`);
  }
  await admin.query(`INSERT INTO platform.staff_registration (tenant_id, staff_id, council, registration_no, valid_until) VALUES ($1, $2, 'KMC', $3, $4)`, [t.tenantId, people.doctor, `R-${run}`, soon]);
});

afterAll(async () => {
  await app?.close();
  await db.destroy();
  await admin.end();
});

describe('/v1/me/alerts', () => {
  it('limits a clinic-scoped staff manager to registrations they can manage', async () => {
    const facility2 = (await admin.query(`INSERT INTO platform.facility (tenant_id, organization_id, code, name, facility_type, state_code) VALUES ($1, $2, 'F2', 'Other clinic', 'hospital', '29') RETURNING id`, [t.tenantId, t.organizationId])).rows[0]!.id;
    const manager = (await admin.query(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, 'manager', 'Manager', 'Manager', 'admin') RETURNING id`, [t.tenantId])).rows[0]!.id;
    const role = (await admin.query(`INSERT INTO platform.role (tenant_id, code, name) VALUES ($1, 'registration_manager', 'Registration manager') RETURNING id`, [t.tenantId])).rows[0]!.id;
    await admin.query(`INSERT INTO platform.role_permission (role_id, permission_id) SELECT $1, id FROM platform.permission WHERE code = 'staff.manage'`, [role]);
    await admin.query(`INSERT INTO platform.role_grant (tenant_id, staff_id, role_id, facility_id) VALUES ($1, $2, $3, $4)`, [t.tenantId, manager, role, t.facilityId]);
    await admin.query(`INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, status) VALUES ($1, $2, $3, $4, 'active')`, [t.tenantId, manager, DEV_ISSUER, `manager-${run}`]);
    const token = await signDevToken(`manager-${run}`);
    const added: { id: string }[] = [];
    for (const [name, clinics] of [['only_here', [t.facilityId]], ['only_elsewhere', [facility2]], ['both_clinics', [t.facilityId, facility2]], ['everywhere', [null]]] as const) {
      const id = (await admin.query(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, $2, $2, $2, 'doctor') RETURNING id`, [t.tenantId, name])).rows[0]!.id;
      for (const clinic of clinics) await admin.query(`INSERT INTO platform.role_grant (tenant_id, staff_id, role_id, facility_id) SELECT $1, $2, id, $3 FROM platform.role WHERE tenant_id IS NULL AND code = 'doctor'`, [t.tenantId, id, clinic]);
      await admin.query(`INSERT INTO platform.staff_registration (tenant_id, staff_id, council, registration_no, valid_until) VALUES ($1, $2, 'KMC', $3, $4)`, [t.tenantId, id, `${name}-${run}`, soon]);
      added.push({ id });
    }
    const response = await call('GET', '/v1/me/alerts', token);
    expect(response.status).toBe(200);
    const ids = response.body.teamRegistrations.map((r: { staffId: string }) => r.staffId);
    expect(ids).toContain(added[0]!.id);
    for (const item of added.slice(1)) expect(ids).not.toContain(item.id);
  });

  it('returns only the caller’s own marks and registrations', async () => {
    const key = `queue:${randomUUID()}`;
    expect((await call('PUT', `/v1/me/alerts/${key}`, tokens.desk, { read: true })).status).toBe(200);
    const desk = await call('GET', '/v1/me/alerts', tokens.desk);
    expect(desk.body.states).toEqual([expect.objectContaining({ key, dismissedAt: null, snoozedUntil: null })]);
    expect(desk.body.states[0].readAt).toEqual(expect.any(String));
    expect(desk.body.registrations).toEqual([]);
    const doctor = await call('GET', '/v1/me/alerts', tokens.doctor);
    expect(doctor.body.states).toEqual([]);
    expect(doctor.body.registrations).toEqual([expect.objectContaining({ council: 'KMC', validUntil: soon })]);
  });

  it('returns other people’s expiring registrations only to staff managers', async () => {
    expect((await call('GET', '/v1/me/alerts', tokens.desk)).body.teamRegistrations).toBeNull();
    const admin = (await call('GET', '/v1/me/alerts', tokens.admin)).body;
    const mine = (admin.teamRegistrations as { staffId: string; staffName: string; council: string }[]).filter((r) => r.staffId === people.doctor);
    expect(mine).toEqual([expect.objectContaining({ staffName: 'doctor', council: 'KMC' })]);
  });

  it('upserts dismiss and snooze without clearing read, and un-snoozes with null', async () => {
    const key = `tele:${randomUUID()}`;
    await call('PUT', `/v1/me/alerts/${key}`, tokens.doctor, { read: true });
    const until = '2026-10-19T03:30:00.000Z';
    const snoozed = await call('PUT', `/v1/me/alerts/${key}`, tokens.doctor, { snoozedUntil: until, dismissed: true });
    expect(snoozed.body).toEqual(expect.objectContaining({ key, snoozedUntil: until, dismissedAt: expect.any(String), readAt: expect.any(String) }));
    const cleared = await call('PUT', `/v1/me/alerts/${key}`, tokens.doctor, { snoozedUntil: null, dismissed: false });
    expect(cleared.body).toEqual(expect.objectContaining({ snoozedUntil: null, dismissedAt: null, readAt: expect.any(String) }));
  });

  it('marks many read at once', async () => {
    const keys = [`waitlist:${randomUUID()}`, `queue:${randomUUID()}`];
    expect((await call('POST', '/v1/me/alerts/read', tokens.desk, { keys })).body).toEqual({ updated: 2 });
    const states = (await call('GET', '/v1/me/alerts', tokens.desk)).body.states as { key: string; readAt: string | null }[];
    for (const k of keys) expect(states.find((s) => s.key === k)?.readAt).toEqual(expect.any(String));
  });

  it('rejects malformed keys, empty marks and unknown fields', async () => {
    expect((await call('PUT', '/v1/me/alerts/Not%20a%20key', tokens.desk, { read: true })).status).toBe(400);
    expect((await call('PUT', `/v1/me/alerts/queue:${randomUUID()}`, tokens.desk, {})).status).toBe(400);
    expect((await call('PUT', `/v1/me/alerts/queue:${randomUUID()}`, tokens.desk, { staffId: people.doctor })).status).toBe(400);
    expect((await call('POST', '/v1/me/alerts/read', tokens.desk, { keys: [] })).status).toBe(400);
  });

  it('requires sign-in', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/me/alerts' });
    expect(res.statusCode).toBe(401);
  });
});
