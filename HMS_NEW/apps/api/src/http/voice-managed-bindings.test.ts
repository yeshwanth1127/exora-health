import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startKit, type Kit, type Person } from './test-kit.ts';
import { loadChannelSettings, type ChannelSettings } from '../modules/comms/voice-growth.ts';
let a: Kit, b: Kit, adminA: Person, adminB: Person;
const channels: ChannelSettings = { recordingHosts: [], fetcher: fetch, voiceBindings: [] };
const secretA = 'test-only-voice-secret-clinic-a-32chars';
const secretB = 'test-only-voice-secret-clinic-b-32chars';
const startedAt = new Date(Date.now() - 30000).toISOString();
const event = (id: string, extra: Record<string, unknown> = {}) => ({
  eventId: id, sessionId: 'shared-provider-session-id', sequence: 0, startedAt, status: 'active', ...extra,
});
const send = async (account: string | undefined, secret: string, body: unknown) => {
  const r = await a.app.inject({ method: 'POST', url: '/integrations/voice/events', payload: body as object,
    headers: { 'x-voice-secret': secret, ...(account ? { 'x-voice-account': account } : {}) } });
  return { status: r.statusCode, body: r.json() };
};
beforeAll(async () => {
  a = await startKit('managed-voice-a', channels); b = await startKit('managed-voice-b');
  adminA = await a.person('A admin', 'tenant_admin', null); adminB = await b.person('B admin', 'tenant_admin', null);
  const configured = loadChannelSettings({
    VOICE_CLINIC_BINDINGS_JSON: JSON.stringify([
      { tenantId: a.tenant.tenantId, facilityId: a.tenant.facilityId, accountId: 'clinic-a-deployment', agentVersion: 3, secretEnv: 'HMS_VOICE_SECRET_CLINIC_A' },
      { tenantId: b.tenant.tenantId, facilityId: b.tenant.facilityId, accountId: 'clinic-b-deployment', agentVersion: 4, secretEnv: 'HMS_VOICE_SECRET_CLINIC_B' },
    ]), HMS_VOICE_SECRET_CLINIC_A: secretA, HMS_VOICE_SECRET_CLINIC_B: secretB,
  });
  channels.voiceBindings = configured.voiceBindings;
});
afterAll(async () => { await a.close(); await b.close(); });
describe('company-managed internal voice runtime bindings', () => {
  it('requires exact account header and matching dedicated secret before any callback write', async () => {
    expect((await send(undefined, secretA, event('voice-no-account'))).status).toBe(503);
    expect((await send('unknown-deployment', secretA, event('voice-unknown'))).status).toBe(503);
    expect((await send('clinic-b-deployment', secretA, event('voice-cross-secret'))).status).toBe(401);
    expect((await send('clinic-a-deployment', secretB, event('voice-cross-secret-b'))).status).toBe(401);
    expect((await a.admin.query('SELECT id FROM comms.voice_call WHERE tenant_id=ANY($1::uuid[])', [[a.tenant.tenantId, b.tenant.tenantId]])).rows).toHaveLength(0);
  });
  it('persists each clinic independently despite shared session and event IDs; replay changes neither', async () => {
    const body = event('same-event-both-clinics');
    const first = await send('clinic-a-deployment', secretA, { ...body, agentVersion: 3 });
    const second = await send('clinic-b-deployment', secretB, { ...body, agentVersion: 4 });
    expect(first.status).toBe(200); expect(second.status).toBe(200); expect(first.body.callId).not.toBe(second.body.callId);
    expect((await send('clinic-a-deployment', secretA, { ...body, agentVersion: 3 })).body).toEqual(first.body);
    const rows = (await a.admin.query('SELECT tenant_id,facility_id,runtime_account_id,agent_version FROM comms.voice_call WHERE tenant_id=ANY($1::uuid[])', [[a.tenant.tenantId, b.tenant.tenantId]])).rows;
    expect(rows).toHaveLength(2);
    expect(rows).toContainEqual({ tenant_id: a.tenant.tenantId, facility_id: a.tenant.facilityId, runtime_account_id: 'clinic-a-deployment', agent_version: 3 });
    expect(rows).toContainEqual({ tenant_id: b.tenant.tenantId, facility_id: b.tenant.facilityId, runtime_account_id: 'clinic-b-deployment', agent_version: 4 });
  });
  it('refuses body-supplied clinic selection and wrong agent revisions', async () => {
    expect((await send('clinic-a-deployment', secretA, event('forged-tenant', { tenantId: b.tenant.tenantId, facilityId: b.tenant.facilityId }))).status).toBe(400);
    expect((await send('clinic-a-deployment', secretA, event('wrong-agent-version', { agentVersion: 4 }))).status).toBe(400);
    expect((await send('clinic-a-deployment', secretA, event('missing-agent-version'))).status).toBe(400);
    expect((await send('clinic-a-deployment', secretA, event('valid-next-sequence', { sequence: 1, agentVersion: 3 }))).status).toBe(200);
  });
  it('scopes history readiness and records to clinic identity without returning runtime secrets', async () => {
    const historyA = await a.call(adminA, 'GET', `/v1/voice-calls?facilityId=${a.tenant.facilityId}`);
    // Read B through A's server to prove both descriptors are loaded into that server.
    const historyB = await a.call(adminB, 'GET', `/v1/voice-calls?facilityId=${b.tenant.facilityId}`);
    expect(historyA.body).toMatchObject({ total: 1, configuration: { callsReady: true, agentVersion: 3 } });
    expect(historyB.body).toMatchObject({ total: 1, configuration: { callsReady: true, agentVersion: 4 } });
    expect(historyA.body.items[0].id).not.toBe(historyB.body.items[0].id);
    expect(JSON.stringify(historyA.body)).not.toContain(secretA); expect(JSON.stringify(historyB.body)).not.toContain(secretB);
    const crossed = await a.call(adminA, 'GET', `/v1/voice-calls?facilityId=${b.tenant.facilityId}`);
    expect(crossed.body).toMatchObject({ total: 0, configuration: { callsReady: false } });
  });
  it('an explicit empty registry disables callbacks even when a legacy binding exists', async () => {
    const saved = channels.voiceBindings;
    channels.voice = { ...saved![0]! }; channels.voiceBindings = [];
    try { expect((await send(undefined, secretA, event('no-legacy-fallback'))).status).toBe(503); }
    finally { channels.voiceBindings = saved; delete channels.voice; }
  });
});
