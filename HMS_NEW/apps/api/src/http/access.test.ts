// Workspace administration (G16) and the activity log (G18) over HTTP.
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
import { setStaffStatus } from '../modules/access/index.ts';
import { buildServer } from '../server.ts';

const admin = adminPool();
const db = createDb({ connectionString: config.testAppDatabaseUrl, maxConnections: 5 });
let app: FastifyInstance;
let t: TenantFixture;
let facility2: string;
const run = randomUUID().slice(0, 8);
const people = {} as Record<'admin' | 'branchAdmin' | 'frontDesk' | 'auditor' | 'nurse' | 'limitedAdmin' | 'accessOnly', string>;
const tokens = {} as Record<keyof typeof people, string>;

async function call(method: 'GET' | 'POST' | 'PUT', url: string, opts: { token?: string; body?: unknown; idem?: string | true } = {}) {
  const headers: Record<string, string> = { authorization: `Bearer ${opts.token ?? tokens.admin}` };
  if (!opts.idem && /\/(revoke|status|retire)$/.test(url)) headers['idempotency-key'] = `test-${randomUUID()}`;
  if (opts.idem) headers['idempotency-key'] = opts.idem === true ? `test-${randomUUID()}` : opts.idem;
  const res = await app.inject({ method, url, headers, ...(opts.body !== undefined ? { payload: opts.body as object } : {}) });
  return { status: res.statusCode, body: res.body ? res.json() : null };
}

beforeAll(async () => {
  app = buildServer({ db, verifier: createVerifier({ mode: 'dev', secret: DEV_SECRET_DEFAULT, issuer: DEV_ISSUER }) });
  t = await createTenant(admin, 'access');
  const one = async (text: string, values: unknown[]) => (await admin.query<{ id: string }>(text, values)).rows[0]!.id;
  facility2 = await one(`INSERT INTO platform.facility (tenant_id, organization_id, code, name, facility_type, state_code) VALUES ($1, $2, 'F2', 'Branch 2', 'clinic', '29') RETURNING id`, [t.tenantId, t.organizationId]);
  const setup: Array<[keyof typeof people, string, string, string | null]> = [
    ['admin', 'Priya Admin', 'tenant_admin', null],
    ['branchAdmin', 'Branch One Lead', 'tenant_admin', t.facilityId],
    ['frontDesk', 'Ravi Desk', 'front_desk', t.facilityId],
    ['auditor', 'Audit Person', 'auditor', null],
    ['nurse', 'Meena Nurse', 'nurse', t.facilityId],
    ['limitedAdmin', 'Limited Admin', `limited_${run}`, t.facilityId], // manages access at Branch 1 but holds no booking permissions
    ['accessOnly', 'Access Only', `limited_${run}`, null], // the same, at every clinic
  ];
  const limited = await one(`INSERT INTO platform.role (tenant_id, code, name) VALUES ($1, $2, 'Access only') RETURNING id`, [t.tenantId, `limited_${run}`]);
  await admin.query(`INSERT INTO platform.role_permission (role_id, permission_id) SELECT $1, id FROM platform.permission WHERE code IN ('access.manage', 'staff.manage', 'staff.read')`, [limited]);
  for (const [who, name, role, facility] of setup) {
    people[who] = await one(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, $2, $3, $3, 'admin') RETURNING id`, [t.tenantId, who, name]);
    await admin.query(`INSERT INTO platform.role_grant (tenant_id, staff_id, role_id, facility_id) SELECT $1, $2, id, $4 FROM platform.role WHERE (tenant_id IS NULL OR tenant_id = $1) AND code = $3`, [t.tenantId, people[who], role, facility]);
    await admin.query(`INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, status) VALUES ($1, $2, $3, $4, 'active')`, [t.tenantId, people[who], DEV_ISSUER, `${who}-${run}`]);
    tokens[who] = await signDevToken(`${who}-${run}`);
  }
});

afterAll(async () => {
  await app?.close();
  await db.destroy();
  await admin.end();
});

describe('activity log (G18)', () => {
  const log = (query: string, token = tokens.auditor) => call('GET', `/v1/audit-events?${query}`, { token });

  it('lists who changed what, filtered, for auditors and every-clinic administrators only', async () => {
    const initial = await call('GET', `/v1/facilities/${t.facilityId}/overbooking`);
    const toggled = await call('PUT', `/v1/facilities/${t.facilityId}/overbooking`, { token: tokens.branchAdmin, idem: true, body: { enabled: true, version: initial.body.version } });
    expect(toggled.status).toBe(200);
    expect((await call('PUT', `/v1/facilities/${t.facilityId}/overbooking`, { token: tokens.branchAdmin, idem: true, body: { enabled: false, version: toggled.body.version } })).status).toBe(200);
    const found = await log(`actor=${encodeURIComponent('branch one')}&action=config_setting`);
    expect(found.status).toBe(200);
    expect(found.body.items[0]).toMatchObject({ actorName: 'Branch One Lead', actorIsSystem: false, action: 'update', subjectType: 'platform.config_setting' });
    const id = found.body.items[0].subjectId;
    const byRecord = (await log(`record=${id}`)).body.items;
    expect(byRecord.map((e: { auditEventId: string; subjectId: string }) => [e.auditEventId, e.subjectId])).toEqual([[found.body.items[0].auditEventId, id]]);
    expect((await log(`record=${id}`, tokens.admin)).status).toBe(200);
    expect((await log('actor=%25')).body.items).toEqual([]); // wildcards are literal
    expect((await log(`record=${id}&to=2020-01-01`)).body.items).toEqual([]);
    expect((await log('from=2026-02-02&to=2026-01-01')).status).toBe(400);

    // Only this tenant's rows (RLS), newest first, paged with `more`
    const page = await log('limit=500');
    const { rows } = await admin.query<{ n: string }>(`SELECT count(*) AS n FROM platform.audit_event WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [t.tenantId, page.body.items.map((e: { auditEventId: string }) => e.auditEventId)]);
    expect(Number(rows[0]!.n)).toBe(page.body.items.length);
    expect((await log('limit=1')).body).toMatchObject({ more: true });

    for (const token of [tokens.branchAdmin, tokens.frontDesk, tokens.nurse]) expect((await log('', token)).status).toBe(403);
  });

  it('exports matching events and records the export', async () => {
    expect((await call('POST', '/v1/audit-events/export', { token: tokens.frontDesk, body: {} })).status).toBe(403);
    const out = await call('POST', '/v1/audit-events/export', { token: tokens.auditor, body: { action: 'config_setting' } });
    expect(out.status).toBe(200);
    expect(out.body.truncated).toBe(false);
    expect(out.body.items.length).toBeGreaterThan(0);
    const recorded = await log('action=export');
    expect(recorded.body.items[0]).toMatchObject({ actorName: 'Audit Person', action: 'export', subjectType: 'platform.audit_event', diff: { filters: { action: 'config_setting' }, rows: out.body.items.length } });
  });
});

describe('staff accounts and access (G16)', () => {
  let roles: Record<string, string>;
  const email = `kiran.${run}@clinic.example`;
  const me = (token: string) => call('GET', '/v1/me', { token });
  const signIn = (subject: string, mail?: string) => signDevToken(subject, { email: mail ?? '' });
  const create = (token: string, body: Record<string, unknown> = {}, idem: string | true = true) =>
    call('POST', '/v1/staff-accounts', {
      token,
      idem,
      body: { displayName: 'Kiran Kumar', employeeNo: `FD-${run}`, staffType: 'admin', email, roleId: roles.front_desk, facilityId: t.facilityId, ...body },
    });
  const list = (token = tokens.admin, facilityId = t.facilityId) => call('GET', `/v1/staff-accounts?facilityId=${facilityId}`, { token });
  const row = async (staffId: string, token = tokens.admin, facilityId = t.facilityId) => (await list(token, facilityId)).body.items.find((s: { staffId: string }) => s.staffId === staffId);

  beforeAll(async () => {
    const r = await call('GET', '/v1/roles');
    expect(r.status).toBe(200);
    roles = Object.fromEntries(r.body.roles.map((x: { code: string; roleId: string }) => [x.code, x.roleId]));
    expect(roles.booking_agent).toBeUndefined(); // integration roles are not offered
  });

  it('invites a staff member who links on first sign-in with the same verified email', async () => {
    const key = `invite-${run}`;
    const made = await create(tokens.admin, {}, key);
    expect(made).toMatchObject({ status: 201, body: { accountStatus: 'invited' } });
    expect((await create(tokens.admin, {}, key)).body.staffId).toBe(made.body.staffId); // retry
    expect((await create(tokens.admin, { employeeNo: `X-${run}` })).body.error.details.reason).toBe('duplicate_staff');
    expect(await row(made.body.staffId)).toMatchObject({ displayName: 'Kiran Kumar', status: 'active', email, account: { status: 'invited', linked: false }, grants: [{ roleName: 'Front desk', facilityId: t.facilityId }] });

    // No email, or an unverified one, does not link
    expect((await me(await signIn(`kiran-${run}`))).status).toBe(403);
    const unverified = await new SignJWT({ email, email_verified: false }).setProtectedHeader({ alg: 'HS256' }).setIssuer(DEV_ISSUER).setSubject(`kiran-${run}`).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(DEV_SECRET_DEFAULT));
    expect((await me(unverified)).status).toBe(403);

    const kiran = await signIn(`kiran-${run}`, email.toUpperCase());
    const first = await me(kiran);
    expect(first).toMatchObject({ status: 200, body: { staffId: made.body.staffId, permissions: { 'appointments.book': [t.facilityId] } } });
    expect(first.body.permissions['access.manage']).toBeUndefined();
    expect((await me(kiran)).status).toBe(200);
    expect(await row(made.body.staffId)).toMatchObject({ account: { status: 'active', linked: true } });
    // The invite is used up: another identity with the same email gets nothing
    expect((await me(await signIn(`impostor-${run}`, email))).status).toBe(403);
    const linked = await call('GET', `/v1/audit-events?record=${made.body.userAccountId}&action=update`, { token: tokens.auditor });
    expect(linked.body.items[0]).toMatchObject({ actorName: 'Kiran Kumar', diff: { linked: 'verified_email' } });

    // A deactivated invitee can't link
    const zed = await create(tokens.admin, { displayName: 'Zed Former', employeeNo: `Z-${run}`, email: `zed.${run}@clinic.example` });
    expect((await call('POST', `/v1/staff/${zed.body.staffId}/status`, { body: { status: 'inactive', reason: 'Offer withdrawn' } })).status).toBe(200);
    expect((await me(await signIn(`zed-${run}`, `zed.${run}@clinic.example`))).status).toBe(403);
  });

  it('only grants what the granter holds, only where they manage access, and never to themselves', async () => {
    const lee = await create(tokens.admin, { displayName: 'Lee Grant', employeeNo: `L-${run}`, email: `lee.${run}@clinic.example` });
    const grant = (token: string, roleId: string, facilityId: string | null, staffId = lee.body.staffId) =>
      call('POST', `/v1/staff/${staffId}/grants`, { token, idem: true, body: { roleId, facilityId } });

    expect((await grant(tokens.branchAdmin, roles.nurse!, facility2)).status).toBe(403); // not their clinic
    expect((await grant(tokens.branchAdmin, roles.nurse!, null)).status).toBe(403); // not every clinic
    expect((await create(tokens.branchAdmin, { employeeNo: `B-${run}`, email: `b.${run}@clinic.example`, facilityId: null })).status).toBe(403);
    const over = await grant(tokens.limitedAdmin, roles.front_desk!, t.facilityId);
    expect(over).toMatchObject({ status: 403, body: { error: { details: { reason: 'exceeds_own_access' } } } });
    expect(over.body.error.details.permissions).toContain('appointments.book');
    // Administrators can set up doctors (break-glass is granted by its reviewers), at their own clinic
    expect((await grant(tokens.branchAdmin, roles.doctor!, t.facilityId)).status).toBe(201);
    expect((await grant(tokens.branchAdmin, roles.doctor!, t.facilityId)).body.error.details.reason).toBe('already_granted');
    expect((await grant(tokens.admin, roles.tenant_admin!, null, people.admin)).body.error.details.reason).toBe('self');
    for (const token of [tokens.frontDesk, tokens.nurse]) {
      expect((await grant(token, roles.nurse!, t.facilityId)).status).toBe(403);
      expect((await call('GET', '/v1/roles', { token })).status).toBe(403);
      expect((await list(token)).status).toBe(403);
    }
    expect((await list(tokens.branchAdmin, facility2)).status).toBe(403);
    // A Branch 1 manager sees Branch 1 and every-clinic grants only
    const seen = await row(lee.body.staffId, tokens.branchAdmin);
    expect(seen.grants.map((g: { roleName: string }) => g.roleName).sort()).toEqual(['Doctor', 'Front desk']);
  });

  it('revoking and deactivating take effect on the next request, without locking anyone out', async () => {
    const pat = await create(tokens.admin, { displayName: 'Pat Revoke', employeeNo: `P-${run}`, email: `pat.${run}@clinic.example` });
    const patToken = await signIn(`pat-${run}`, `pat.${run}@clinic.example`);
    expect((await me(patToken)).status).toBe(200);

    const revoke = (grantId: string, token = tokens.admin) => call('POST', `/v1/role-grants/${grantId}/revoke`, { token, body: { reason: 'Moved to billing' } });
    expect((await call('POST', `/v1/role-grants/${pat.body.grantId}/revoke`, { body: { reason: '' } })).status).toBe(400);
    expect((await revoke(pat.body.grantId, tokens.frontDesk)).status).toBe(403);
    expect((await revoke(pat.body.grantId)).body).toMatchObject({ status: 'revoked' });
    expect((await revoke(pat.body.grantId)).status).toBe(404);
    expect((await me(patToken)).body.permissions['appointments.book']).toBeUndefined();
    expect((await revoke(randomUUID())).status).toBe(404);

    // Status: needs staff.manage everywhere the person works; never yourself
    const status = (staffId: string, s: 'active' | 'inactive', token = tokens.admin) => call('POST', `/v1/staff/${staffId}/status`, { token, body: { status: s, reason: 'Left the clinic' } });
    expect((await status(people.auditor, 'inactive', tokens.branchAdmin)).status).toBe(403); // the auditor works at every clinic
    expect((await status(people.admin, 'inactive')).body.error.details.reason).toBe('self');
    expect((await status(people.frontDesk, 'inactive', tokens.branchAdmin)).status).toBe(200);
    expect((await me(tokens.frontDesk)).status).toBe(403);
    expect((await status(people.frontDesk, 'active', tokens.branchAdmin)).status).toBe(200);
    expect((await me(tokens.frontDesk)).status).toBe(200);
    expect((await revoke(randomUUID(), tokens.branchAdmin)).status).toBe(404);
    const ownGrant = (await row(people.admin)).grants[0].grantId;
    expect((await revoke(ownGrant)).body.error.details.reason).toBe('own_access');
    // A Branch 1 manager can't revoke grants at another clinic or at every clinic
    const auditorGrant = (await row(people.auditor)).grants[0].grantId;
    expect((await revoke(auditorGrant, tokens.branchAdmin)).status).toBe(403);
    const elsewhere = await call('POST', `/v1/staff/${pat.body.staffId}/grants`, { idem: true, body: { roleId: roles.nurse, facilityId: facility2 } });
    expect(elsewhere.status).toBe(201);
    expect((await revoke(elsewhere.body.grantId, tokens.branchAdmin)).status).toBe(403);

    // Two every-clinic administrators removing each other at once: one of them always remains
    const second = await create(tokens.admin, { displayName: 'Second Admin', employeeNo: `S-${run}`, email: `second.${run}@clinic.example`, roleId: roles.tenant_admin, facilityId: null });
    const secondToken = await signIn(`second-${run}`, `second.${run}@clinic.example`);
    expect((await me(secondToken)).status).toBe(200);
    // accessOnly also manages access everywhere and would let both succeed, so it is set aside for the race.
    await admin.query(`UPDATE platform.staff SET status = 'inactive' WHERE id = $1`, [people.accessOnly]);
    const both = await Promise.all([status(second.body.staffId, 'inactive'), status(people.admin, 'inactive', secondToken)]);
    expect(both.map((r) => r.status)).not.toEqual([200, 200]);
    const { rows } = await admin.query(`SELECT s.id FROM platform.staff s WHERE s.tenant_id = $1 AND s.status = 'active' AND s.id = ANY($2::uuid[])`, [t.tenantId, [people.admin, second.body.staffId]]);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await admin.query(`UPDATE platform.staff SET status = 'active' WHERE id = $1`, [people.admin]);

    // The race replayed deterministically: the second administrator was already deactivated when their
    // (earlier-authorized) command runs, so removing the first would leave nobody.
    // (accessOnly also manages access everywhere, so it is set aside for the replay.)
    await admin.query(`UPDATE platform.staff SET status = 'inactive' WHERE id = ANY($1::uuid[])`, [[second.body.staffId, people.accessOnly]]);
    await expect(
      setStaffStatus(db, { tenantId: t.tenantId, actor: { kind: 'staff', staffId: second.body.staffId } }, { staffId: people.admin, status: 'inactive', reason: 'Race replay' }),
    ).rejects.toMatchObject({ details: { reason: 'last_administrator' } });
    expect((await me(tokens.admin)).status).toBe(200);
    await admin.query(`UPDATE platform.staff SET status = 'active' WHERE id = $1`, [people.accessOnly]);
  });
});

describe('custom roles (G16)', () => {
  let roles: Record<string, { roleId: string; permissions: string[]; builtIn: boolean }>;
  const load = async () => {
    roles = Object.fromEntries((await call('GET', '/v1/roles')).body.roles.map((r: { code: string }) => [r.code, r]));
  };
  const toggle = async (roleId: string, permission: string, allowed: boolean, token = tokens.admin) => {
    const role = (await call('GET', '/v1/roles')).body.roles.find((r: { roleId: string }) => r.roleId === roleId);
    return call('PUT', `/v1/roles/${roleId}/permissions/${permission}`, { token, idem: true, body: { allowed, version: role.version } });
  };

  it('copies a built-in role, edits the copy and grants it; built-in roles stay read-only', async () => {
    await load();
    const copy = (token: string) => call('POST', '/v1/roles', { token, idem: true, body: { name: 'Senior front desk', copyOfRoleId: roles.front_desk!.roleId } });
    for (const token of [tokens.branchAdmin, tokens.frontDesk]) expect((await copy(token)).status).toBe(403);
    expect((await copy(tokens.accessOnly)).body.error.details.reason).toBe('exceeds_own_access');
    const made = await copy(tokens.admin);
    expect(made.status).toBe(201);
    await load();
    const senior = roles[made.body.code]!;
    expect(senior).toMatchObject({ builtIn: false, permissions: roles.front_desk!.permissions });

    expect((await toggle(roles.front_desk!.roleId, 'schedules.manage', true)).body.error.details.reason).toBe('built_in');
    expect((await toggle(senior.roleId, 'schedules.manage', true, tokens.branchAdmin)).status).toBe(403);
    expect((await toggle(senior.roleId, 'appointments.book', false, tokens.branchAdmin)).status).toBe(403); // roles are tenant-wide
    expect((await toggle(senior.roleId, 'schedules.manage', true, tokens.accessOnly)).body.error.details.reason).toBe('exceeds_own_access');
    expect((await toggle(senior.roleId, 'nothing.real', true)).status).toBe(404);
    expect((await toggle(senior.roleId, 'schedules.manage', true)).status).toBe(200);

    // Granted at Branch 1, the edit shows up on the holder's next request, and switching off removes it
    const kim = await call('POST', '/v1/staff-accounts', { idem: true, body: { displayName: 'Kim Senior', employeeNo: `K-${run}`, staffType: 'admin', email: `kim.${run}@clinic.example`, roleId: senior.roleId, facilityId: t.facilityId } });
    expect(kim.status).toBe(201);
    const kimToken = await signDevToken(`kim-${run}`, { email: `kim.${run}@clinic.example` });
    expect((await call('GET', '/v1/me', { token: kimToken })).body.permissions['schedules.manage']).toEqual([t.facilityId]);
    expect((await toggle(senior.roleId, 'schedules.manage', false)).status).toBe(200);
    expect((await call('GET', '/v1/me', { token: kimToken })).body.permissions['schedules.manage']).toBeUndefined();
    const audited = await call('GET', `/v1/audit-events?record=${senior.roleId}`, { token: tokens.auditor });
    expect(audited.body.items.map((e: { diff: { allowed?: boolean } }) => e.diff.allowed)).toEqual([false, true, undefined]);
  });
});
