// Clinic operation modules (inpatient, billing, pharmacy + inventory, HR) are off until switched on:
// a missing module_state row means not provisioned for them, pharmacy carries inventory, inpatient needs
// billing, and a switched-off module's commands refuse work.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCommand } from '@hms/platform';
import { startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let admin: Person;

const state = async (module: string) =>
  (await k.call(admin, 'GET', '/v1/modules')).body.items.find((m: { module: string }) => m.module === module);
const set = async (module: string, to: string) =>
  k.call(admin, 'PUT', `/v1/modules/${module}`, { state: to, version: (await state(module)).version, reason: 'Clinic module switch test' });

beforeAll(async () => {
  k = await startKit('clinic-modules');
  admin = await k.person('Meera Admin', 'tenant_admin', null);
});
afterAll(() => k.close());

describe('clinic operation module switches', () => {
  it('are off for a tenant without rows, while older modules stay on', async () => {
    for (const m of ['inpatient', 'billing', 'inventory', 'pharmacy', 'hr']) expect((await state(m)).state).toBe('not_provisioned');
    expect((await state('comms')).state).toBe('active');
  });

  it('refuse commands until switched on', async () => {
    const attempt = () => runCommand(k.db, { tenantId: k.tenant.tenantId, actor: { kind: 'system' }, module: 'billing', name: 'test.billing_probe' }, async () => 'ran');
    await expect(attempt()).rejects.toMatchObject({ code: 'precondition_failed', details: { reason: 'module_inactive', module: 'billing' } });
    expect((await set('billing', 'active')).status).toBe(200);
    await expect(attempt()).resolves.toBe('ran');
  });

  it('switch inventory with pharmacy, never on its own', async () => {
    expect((await set('inventory', 'active')).body.error).toMatchObject({ details: { reason: 'switched_with', module: 'pharmacy' } });
    expect((await set('pharmacy', 'active')).status).toBe(200);
    expect((await state('inventory')).state).toBe('active');
    expect((await set('pharmacy', 'suspended')).status).toBe(200);
    expect((await state('inventory')).state).toBe('suspended');
  });

  it('keep billing on while inpatient is on', async () => {
    expect((await set('billing', 'suspended')).status).toBe(200);
    const refused = await set('inpatient', 'active');
    expect(refused.status).toBe(422);
    expect(refused.body.error.details).toMatchObject({ reason: 'module_required', module: 'billing' });
    expect((await set('billing', 'active')).status).toBe(200);
    expect((await set('inpatient', 'active')).status).toBe(200);
    const blocked = await set('billing', 'suspended');
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.details).toMatchObject({ reason: 'module_required_by', module: 'inpatient' });
  });
});
