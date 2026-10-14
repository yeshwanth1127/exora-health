import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setOverbooking } from '../modules/booking/appointments.ts';
import { setRolePermission } from '../modules/access/roles.ts';
import { startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let manager: Person;
let second: Person;
beforeAll(async () => {
  k = await startKit('admin-guarantees');
  manager = await k.person('Setup administrator', 'tenant_admin', null);
  second = await k.person('Other administrator', 'tenant_admin', null);
});
afterAll(async () => k?.close());

describe('persisted administrative guarantees', () => {
  it('requires an explicit policy version and serializes competing administrators from the unset state', async () => {
    const path = `/v1/facilities/${k.tenant.facilityId}/overbooking`;
    const before = await k.call(manager, 'GET', path);
    expect(before.body.version).toBeNull();
    expect((await k.call(manager, 'PUT', path, { enabled: true }, true)).status).toBe(400);
    const input = { enabled: true, version: before.body.version };
    const results = await Promise.all([
      k.call(manager, 'PUT', path, input, `policy-${randomUUID()}`),
      k.call(second, 'PUT', path, input, `policy-${randomUUID()}`),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const loser = results.find(r => r.status === 409)!;
    expect(loser.body.error.details.reason).toBe('stale_version');
    expect((await k.call(manager, 'GET', path)).body).toMatchObject({ enabled: true, version: results.find(r => r.status === 200)!.body.version });
  });

  it('replays a policy receipt after a later administrator changes the policy, without reverting it', async () => {
    const path = `/v1/facilities/${k.tenant.facilityId}/overbooking`;
    const before = await k.call(manager, 'GET', path);
    const body = { enabled: false, version: before.body.version };
    const key = `policy-${randomUUID()}`;
    const first = await k.call(manager, 'PUT', path, body, key);
    expect(first.status).toBe(200);
    const next = await k.call(second, 'PUT', path, { enabled: true, version: first.body.version }, true);
    expect(next.status).toBe(200);
    expect(await k.call(manager, 'PUT', path, body, key)).toEqual(first);
    expect((await k.call(manager, 'GET', path)).body.enabled).toBe(true);
    expect((await k.call(second, 'PUT', path, body, key)).status).toBe(409);
  });

  it('refuses stale whole-role permission edits and returns the frozen actor-bound receipt', async () => {
    const roles = (await k.call(manager, 'GET', '/v1/roles')).body.roles;
    const copy = await k.call(manager, 'POST', '/v1/roles', { name: 'Concurrent role', copyOfRoleId: roles.find((r: { code: string }) => r.code === 'front_desk').roleId }, true);
    expect(copy.status).toBe(201);
    const role = (await k.call(manager, 'GET', '/v1/roles')).body.roles.find((r: { roleId: string }) => r.roleId === copy.body.roleId);
    const path = `/v1/roles/${role.roleId}/permissions/schedules.manage`;
    const key = `role-${randomUUID()}`;
    const body = { allowed: true, version: role.version };
    const first = await k.call(manager, 'PUT', path, body, key);
    expect(first.status).toBe(200);
    expect(first.body.version).toBe(role.version + 1);
    const stale = await k.call(second, 'PUT', path, { allowed: false, version: role.version }, true);
    expect(stale.status).toBe(409);
    expect(stale.body.error.details.reason).toBe('stale_version');
    expect(await k.call(manager, 'PUT', path, body, key)).toEqual(first);
    expect((await k.call(second, 'PUT', path, body, key)).status).toBe(409);
  });

  it('distinguishes inaccessible clinics from no clinics without exposing clinic identity', async () => {
    const visitor = await k.person('Unassigned user', 'front_desk', null);
    await k.admin.query('DELETE FROM platform.role_grant WHERE tenant_id = $1 AND staff_id = $2', [k.tenant.tenantId, visitor.staffId]);
    const context = await k.call(visitor, 'GET', '/v1/session-context');
    expect(context.status).toBe(200);
    expect(context.body.facilities).toEqual([]);
    expect(context.body.bootstrap).toMatchObject({ state: 'inaccessible_clinics', canCreateClinic: false });
    expect((await k.call(visitor, 'POST', '/v1/facilities', { code: 'DENY', name: 'Denied clinic', facilityType: 'clinic', stateCode: '29' }, true)).status).toBe(403);
  });

  it('bootstraps an empty organization with bounded creator access and atomically replays creation', async () => {
    const empty = await startKit('empty-bootstrap');
    try {
      const owner = await empty.person('Setup owner', 'tenant_admin', null);
      const limited = await empty.person('Setup only', 'front_desk', null);
      await empty.admin.query('DELETE FROM platform.role_grant WHERE tenant_id = $1 AND staff_id = $2', [empty.tenant.tenantId, limited.staffId]);
      const role = (await empty.admin.query<{ id: string }>(`INSERT INTO platform.role (tenant_id, code, name) VALUES ($1, 'setup_only', 'Setup only') RETURNING id`, [empty.tenant.tenantId])).rows[0]!;
      await empty.admin.query(`INSERT INTO platform.role_permission (role_id, permission_id) SELECT $1, id FROM platform.permission WHERE code = 'facility.manage'`, [role.id]);
      await empty.admin.query(`INSERT INTO platform.role_grant (tenant_id, staff_id, role_id) VALUES ($1, $2, $3)`, [empty.tenant.tenantId, limited.staffId, role.id]);
      await empty.admin.query('DELETE FROM platform.facility WHERE tenant_id = $1', [empty.tenant.tenantId]);
      const context = await empty.call(limited, 'GET', '/v1/session-context');
      expect(context.body.bootstrap).toMatchObject({ state: 'zero_clinics', canCreateClinic: true });
      const key = `clinic-${randomUUID()}`;
      const body = { code: 'NEW', name: 'First clinic', facilityType: 'clinic', stateCode: '29' };
      const responses = await Promise.all([empty.call(limited, 'POST', '/v1/facilities', body, key), empty.call(limited, 'POST', '/v1/facilities', body, key)]);
      expect(responses[0].status).toBe(201);
      expect(responses[1]).toEqual(responses[0]);
      const facilityId = responses[0].body.facilityId;
      expect((await empty.call(limited, 'GET', `/v1/facilities/${facilityId}`)).status).toBe(200);
      const me = (await empty.call(limited, 'GET', '/v1/me')).body;
      expect(me.permissions['catalog.read']).toEqual([facilityId]);
      expect(me.permissions['access.manage']).toBeUndefined();
      expect(me.permissions['clinical.read']).toBeUndefined();
      expect((await empty.call(owner, 'POST', '/v1/facilities', body, key)).status).toBe(409);
      const count = await empty.admin.query<{ n: string }>('SELECT count(*) AS n FROM platform.facility WHERE tenant_id = $1', [empty.tenant.tenantId]);
      expect(Number(count.rows[0]!.n)).toBe(1);
    } finally { await empty.close(); }
  });
  it('requires mutation keys and freezes renewal, publication, retirement and status receipts', async () => {
    const roles = (await k.call(manager, 'GET', '/v1/roles')).body.roles;
    const invited = await k.call(manager, 'POST', '/v1/staff-accounts', { displayName: 'Invited staff', employeeNo: `invite-${k.run}`, staffType: 'admin', email: `invite-${k.run}@clinic.example`, roleId: roles.find((r: { code: string }) => r.code === 'front_desk').roleId, facilityId: k.tenant.facilityId }, true);
    expect(invited.status).toBe(201);
    const renewPath = `/v1/staff/${invited.body.staffId}/invite/renew`;
    expect((await k.call(manager, 'POST', renewPath, undefined, false)).status).toBe(400);
    const renewKey = `renew-${randomUUID()}`;
    const renewal = await k.call(manager, 'POST', renewPath, undefined, renewKey);
    expect(renewal.status).toBe(200);
    expect(await k.call(manager, 'POST', renewPath, undefined, renewKey, new Date(Date.now() + 2 * 86400000).toISOString())).toEqual(renewal);
    expect((await k.call(second, 'POST', renewPath, undefined, renewKey)).status).toBe(409);
    const statusPath = `/v1/staff/${invited.body.staffId}/status`;
    const statusKey = `status-${randomUUID()}`;
    const disable = { status: 'inactive', reason: 'Inactive for test' };
    const disabled = await k.call(manager, 'POST', statusPath, disable, statusKey);
    expect(disabled.status).toBe(200);
    expect((await k.call(second, 'POST', statusPath, { status: 'active', reason: 'Restore for test' }, true)).status).toBe(200);
    expect(await k.call(manager, 'POST', statusPath, disable, statusKey)).toEqual(disabled);
    const staff = await k.admin.query<{ status: string }>('SELECT status FROM platform.staff WHERE id = $1', [invited.body.staffId]);
    expect(staff.rows[0]!.status).toBe('active');

    const revokePath = `/v1/role-grants/${invited.body.grantId}/revoke`;
    const revokeKey = `revoke-${randomUUID()}`;
    const revokeBody = { reason: 'Remove temporary access' };
    const revoked = await k.call(manager, 'POST', revokePath, revokeBody, revokeKey);
    expect(revoked.status).toBe(200);
    expect(await k.call(manager, 'POST', revokePath, revokeBody, revokeKey)).toEqual(revoked);
    expect((await k.call(second, 'POST', revokePath, revokeBody, revokeKey)).status).toBe(409);

    const draft = await k.call(manager, 'POST', '/v1/consent-documents', { docVersion: `audit-${k.run}`, language: 'en', title: 'Teleconsultation consent', body: 'Consent document for secure teleconsultation testing.' }, true);
    expect(draft.status).toBe(201);
    const publishPath = `/v1/consent-documents/${draft.body.documentId}/publish`;
    const publishKey = `publish-${randomUUID()}`;
    const published = await k.call(manager, 'POST', publishPath, undefined, publishKey);
    expect(published.status).toBe(200);
    expect(await k.call(manager, 'POST', publishPath, undefined, publishKey)).toEqual(published);
    const retirePath = `/v1/consent-documents/${draft.body.documentId}/retire`;
    const retireBody = { reason: 'Superseded during audit testing' };
    const retireKey = `retire-${randomUUID()}`;
    const retired = await k.call(manager, 'POST', retirePath, retireBody, retireKey);
    expect(retired.status).toBe(200);
    expect(await k.call(manager, 'POST', retirePath, retireBody, retireKey)).toEqual(retired);
    const audit = await k.admin.query<{ n: string }>("SELECT count(*) AS n FROM platform.audit_event WHERE tenant_id = $1 AND subject_id = $2 AND action = 'status_change'", [k.tenant.tenantId, draft.body.documentId]);
    expect(Number(audit.rows[0]!.n)).toBe(2);
  });

  it('rechecks role-editor authority after taking the access lock instead of trusting an earlier principal', async () => {
    const roles = (await k.call(manager, 'GET', '/v1/roles')).body.roles;
    const copy = await k.call(manager, 'POST', '/v1/roles', { name: 'Revocation guard', copyOfRoleId: roles.find((r: { code: string }) => r.code === 'front_desk').roleId }, true);
    const role = (await k.call(manager, 'GET', '/v1/roles')).body.roles.find((r: { roleId: string }) => r.roleId === copy.body.roleId);
    const user = await k.person('Revoked editor', 'tenant_admin', null);
    // Simulates a request whose principal was authenticated before an administrator revoked its grant.
    await k.admin.query('UPDATE platform.role_grant SET revoked_at = now() WHERE tenant_id = $1 AND staff_id = $2', [k.tenant.tenantId, user.staffId]);
    await expect(setRolePermission(k.db, { tenantId: k.tenant.tenantId, actor: { kind: 'staff', staffId: user.staffId } }, { roleId: role.roleId, permission: 'appointments.book', allowed: false, version: role.version }, `revoked-${randomUUID()}`)).rejects.toMatchObject({ code: 'forbidden', details: { reason: 'access_revoked' } });
    const policy = (await k.call(manager, 'GET', `/v1/facilities/${k.tenant.facilityId}/overbooking`)).body;
    await expect(setOverbooking(k.db, { tenantId: k.tenant.tenantId, actor: { kind: 'staff', staffId: user.staffId } }, { facilityId: k.tenant.facilityId, enabled: !policy.enabled, version: policy.version }, `revoked-policy-${randomUUID()}`)).rejects.toMatchObject({ code: 'forbidden', details: { reason: 'access_revoked' } });
    const unchanged = (await k.call(manager, 'GET', '/v1/roles')).body.roles.find((r: { roleId: string }) => r.roleId === role.roleId);
    expect(unchanged.version).toBe(role.version);
    expect(unchanged.permissions).toContain('appointments.book');
  });

  it('serializes publication of separate consent drafts so only one is current per language', async () => {
    const make = async (suffix: string) => k.call(manager, 'POST', '/v1/consent-documents', { docVersion: `parallel-${k.run}-${suffix}`, language: 'kn', title: 'Teleconsultation consent', body: 'Consent document for concurrent publication testing.' }, true);
    const drafts = await Promise.all([make('a'), make('b')]);
    expect(drafts.map(r => r.status)).toEqual([201, 201]);
    const results = await Promise.all(drafts.map((r, i) => k.call(i === 0 ? manager : second, 'POST', `/v1/consent-documents/${r.body.documentId}/publish`, undefined, true)));
    expect(results.map(r => r.status)).toEqual([200, 200]);
    const current = await k.admin.query<{ n: string }>("SELECT count(*) AS n FROM clinical.tele_consent_document WHERE tenant_id = $1 AND language = 'kn' AND published_at IS NOT NULL AND retired_at IS NULL", [k.tenant.tenantId]);
    expect(Number(current.rows[0]!.n)).toBe(1);
  });

});
