// Real HTTP/auth and restricted Postgres. No Apple account, provider or message is simulated as live.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ChannelOnboardingSchema } from '@hms/contracts';
import { startKit, type Kit, type Person } from './test-kit.ts';

let kit: Kit, other: Kit, owner: Person, desk: Person, branch: Person, outsider: Person;
let otherFacility: string;
const path = '/v1/channel-onboarding/apple_messages';
const draft = {
  channel: 'apple_messages', brandName: 'Example Clinic', website: 'https://clinic.example.com',
  businessPhone: '+12125550123', supportEmail: 'reception@example.com', languages: ['en'],
  greeting: 'Welcome. We can help you book an appointment.', humanHandoff: 'on_request',
  supportTimezone: 'America/New_York', supportHours: [{ day: 1, from: '09:00', to: '17:00' }],
  afterHoursMessage: 'Reception is closed. We will respond during our support hours.',
  authorizedToRepresentClinic: true,
};
beforeAll(async () => {
  kit = await startKit('apple-setup'); other = await startKit('apple-other');
  owner = await kit.person('Owner', 'tenant_admin', null);
  desk = await kit.person('Reception', 'front_desk', kit.tenant.facilityId);
  branch = await kit.person('Branch owner', 'tenant_admin', kit.tenant.facilityId);
  outsider = await other.person('Other owner', 'tenant_admin', null);
  const { rows: [facility] } = await kit.admin.query(
    "INSERT INTO platform.facility(tenant_id,organization_id,code,name,facility_type,state_code) VALUES($1,$2,'OTHER','Other clinic','clinic','29') RETURNING id",
    [kit.tenant.tenantId, kit.tenant.organizationId],
  );
  otherFacility = facility.id;
});
afterAll(async () => { await kit?.close(); await other?.close(); });
const input = (version = 0, value: unknown = draft) => ({ facilityId: kit.tenant.facilityId, version, draft: value });

describe('Apple Messages company-managed setup foundation', () => {
  it('reports not started and never advertises a live provider connection', async () => {
    const result = await kit.call(desk, 'GET', `${path}?facilityId=${kit.tenant.facilityId}`);
    expect(result.status).toBe(200);
    expect(ChannelOnboardingSchema.parse(result.body)).toMatchObject({
      channel: 'apple_messages', state: 'not_started', version: 0, draft: null,
      management: 'company_managed', live: false, activation: 'provider_verification_required',
    });
  });

  it('enforces setup permission, clinic scope and tenant isolation', async () => {
    expect((await kit.call(desk, 'PUT', path, input())).status).toBe(403);
    expect((await kit.call(desk, 'POST', `${path}/submit`, { facilityId: kit.tenant.facilityId, version: 1 })).status).toBe(403);
    expect((await kit.call(branch, 'GET', `${path}?facilityId=${otherFacility}`)).status).toBe(403);
    expect((await kit.call(branch, 'PUT', path, { ...input(), facilityId: otherFacility })).status).toBe(403);
    expect((await other.call(outsider, 'GET', `${path}?facilityId=${kit.tenant.facilityId}`)).status).toBe(404);
    expect((await other.call(outsider, 'PUT', path, { ...input(), facilityId: kit.tenant.facilityId })).status).toBe(404);
  });

  it('rejects fabricated activation, provider secrets, bot-only operation and invalid support details', async () => {
    for (const value of [
      { ...draft, live: true }, { ...draft, providerToken: 'do-not-store' },
      { ...draft, humanHandoff: 'disabled' }, { ...draft, authorizedToRepresentClinic: false },
      { ...draft, supportTimezone: 'made-up-zone' }, { ...draft, supportHours: [] },
      { ...draft, supportHours: [{ day: 1, from: '17:00', to: '09:00' }] },
      { ...draft, supportHours: [draft.supportHours[0], draft.supportHours[0]] },
      { ...draft, website: 'http://clinic.example.com' },
      { ...draft, website: 'not a URL' },
      { ...draft, website: 'https://secret:token@clinic.example.com' },
      { ...draft, website: 'https://clinic.example.com/?token=secret' },
      { ...draft, businessPhone: '2125550123' }, { ...draft, languages: ['en', 'en'] },
    ]) expect((await kit.call(owner, 'PUT', path, input(0, value))).status).toBe(400);
    expect((await kit.call(owner, 'PUT', path, { ...input(), live: true })).status).toBe(400);
    expect((await kit.call(owner, 'PUT', '/v1/channel-onboarding/whatsapp', input())).status).toBe(400);
    expect((await kit.call(owner, 'PUT', path, input(), false)).status).toBe(400);
    const { rows } = await kit.admin.query('SELECT id FROM comms.channel_onboarding WHERE tenant_id=$1', [kit.tenant.tenantId]);
    expect(rows).toHaveLength(0);
  });

  it('persists and attributes a setup request once through retries, without creating a provider binding', async () => {
    const saved = await kit.call(branch, 'PUT', path, input(), 'apple-draft');
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ version: 1, state: 'draft', draft, updatedByStaffId: branch.staffId, live: false });
    expect(await kit.call(branch, 'PUT', path, input(), 'apple-draft')).toEqual(saved);
    expect((await kit.call(owner, 'PUT', path, input())).status).toBe(409);
    const submission = { facilityId: kit.tenant.facilityId, version: 1 };
    const results = await Promise.all([0, 1].map(() => kit.call(branch, 'POST', `${path}/submit`, submission, 'apple-submit')));
    expect(results[0]?.status).toBe(200); expect(results[1]).toEqual(results[0]);
    expect(results[0]!.body).toMatchObject({ state: 'requested', live: false, version: 2, activation: 'provider_verification_required' });
    expect(results[0]!.body.requestedAt).toBeTruthy();
    const read = await kit.call(desk, 'GET', `${path}?facilityId=${kit.tenant.facilityId}`);
    expect(read.body).toEqual(results[0]!.body);
    const { rows: events } = await kit.admin.query("SELECT payload FROM platform.outbox_event WHERE tenant_id=$1 AND event_type='channel.setup_requested'", [kit.tenant.tenantId]);
    expect(events).toHaveLength(1); expect(events[0].payload).toMatchObject({ facilityId: kit.tenant.facilityId, channel: 'apple_messages', version: 2 });
    const { rows: connections } = await kit.admin.query('SELECT id FROM comms.managed_connection WHERE tenant_id=$1', [kit.tenant.tenantId]);
    expect(connections).toHaveLength(0);
    expect(JSON.stringify(events)).not.toMatch(/supportEmail|businessPhone|greeting/);
  });

  it('serializes competing revisions and keeps Apple preferences separate from other channels', async () => {
    const results = await Promise.all(['First', 'Second'].map(brandName => kit.call(owner, 'PUT', path, input(2, { ...draft, brandName }))));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(results.find(r => r.status === 200)?.body).toMatchObject({ state: 'draft', version: 3, requestedAt: null, live: false });
    const wa = await kit.call(owner, 'GET', `/v1/channel-onboarding/whatsapp?facilityId=${kit.tenant.facilityId}`);
    expect(wa.body).toMatchObject({ state: 'not_started', draft: null, version: 0 });
    expect((await kit.call(owner, 'POST', `${path}/submit`, { facilityId: kit.tenant.facilityId, version: 2 })).status).toBe(409);
  });

  it('rechecks current permissions before a previously authorized owner submits', async () => {
    await kit.admin.query('UPDATE platform.role_grant SET revoked_at=now() WHERE tenant_id=$1 AND staff_id=$2', [kit.tenant.tenantId, branch.staffId]);
    expect((await kit.call(branch, 'POST', `${path}/submit`, { facilityId: kit.tenant.facilityId, version: 3 })).status).toBe(403);
    expect((await kit.call(branch, 'PUT', path, input(3))).status).toBe(403);
    const read = await kit.call(owner, 'GET', `${path}?facilityId=${kit.tenant.facilityId}`);
    expect(read.body).toMatchObject({ version: 3, state: 'draft', live: false });
  });
});
