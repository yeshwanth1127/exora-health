import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startKit, type Kit, type Person } from './test-kit.ts';
import { storeWhatsAppCallback } from '../modules/comms/whatsapp.ts';
import { resolveWhatsAppBinding } from '../modules/comms/whatsapp-provider-config.ts';

let a: Kit, b: Kit, adminA: Person, adminB: Person;
const original = { ...process.env };
const phoneA = '177700000001', phoneB = '177700000002', wabaA = '188800000001', wabaB = '188800000002';
const secret = 'test-only-managed-app-secret-at-least-32';
const sender = '919876540001';
const value = (phone: string, id: string, text = 'human') => ({
  messaging_product: 'whatsapp', metadata: { phone_number_id: phone },
  messages: [{ id, from: sender, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } }],
});
const entry = (phone: string, waba: string, id: string, text?: string) => ({
  id: waba, changes: [{ field: 'messages', value: value(phone, id, text) }],
});
const envelope = (entries: unknown[]) => ({ object: 'whatsapp_business_account', entry: entries });
const send = async (body: unknown, validSignature = true) => {
  const raw = JSON.stringify(body);
  const r = await a.app.inject({ method: 'POST', url: '/v1/integrations/whatsapp/webhook',
    payload: raw, headers: { 'content-type': 'application/json', 'x-hub-signature-256': validSignature ?
      'sha256=' + createHmac('sha256', secret).update(raw).digest('hex') : 'sha256=' + '0'.repeat(64) } });
  return { status: r.statusCode, body: r.json() };
};
const count = async () => (await a.admin.query<{ n: number }>(
  'SELECT count(*)::int n FROM comms.provider_event WHERE tenant_id=ANY($1::uuid[])', [[a.tenant.tenantId, b.tenant.tenantId]],
)).rows[0]!.n;
beforeAll(async () => {
  Object.assign(process.env, { WA_CLINIC_BINDINGS_JSON: '[]', WA_APP_SECRET: secret, WA_VERIFY_TOKEN: 'test-managed-verification', WA_GRAPH_VERSION: 'v23.0',
    HMS_WA_TOKEN_CLINIC_A: 'test-only-clinic-A-token' });
  delete process.env.HMS_WA_TOKEN_CLINIC_B;
  a = await startKit('managed-wa-a'); b = await startKit('managed-wa-b');
  adminA = await a.person('A admin', 'tenant_admin', null); adminB = await b.person('B admin', 'tenant_admin', null);
  process.env.WA_CLINIC_BINDINGS_JSON = JSON.stringify([
    { tenantId: a.tenant.tenantId, facilityId: a.tenant.facilityId, phoneNumberId: phoneA, businessAccountId: wabaA, accessTokenEnv: 'HMS_WA_TOKEN_CLINIC_A' },
    { tenantId: b.tenant.tenantId, facilityId: b.tenant.facilityId, phoneNumberId: phoneB, businessAccountId: wabaB, accessTokenEnv: 'HMS_WA_TOKEN_CLINIC_B' },
  ]);
  expect((await a.call(adminA, 'PUT', '/v1/comms/settings', { facilityId: a.tenant.facilityId, phoneNumberId: phoneA, version: 0 })).status).toBe(200);
  expect((await b.call(adminB, 'PUT', '/v1/comms/settings', { facilityId: b.tenant.facilityId, phoneNumberId: phoneB, version: 0 })).status).toBe(200);
});
afterAll(async () => {
  await a.close(); await b.close();
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
});

describe('company-managed WhatsApp clinic bindings', () => {
  it('reports clinic-specific credential configuration without secrets or live delivery claims', async () => {
    const settingsA = await a.call(adminA, 'GET', `/v1/comms/settings?facilityId=${a.tenant.facilityId}`);
    const settingsB = await b.call(adminB, 'GET', `/v1/comms/settings?facilityId=${b.tenant.facilityId}`);
    expect(settingsA.body).toMatchObject({ webhookReady: true, providerConfigured: true, liveSending: false, transport: 'log' });
    expect(settingsB.body).toMatchObject({ webhookReady: true, providerConfigured: false, liveSending: false });
    expect(JSON.stringify(settingsA.body)).not.toContain('test-only-clinic-A-token');
    expect(JSON.stringify(settingsA.body)).not.toContain('HMS_WA_TOKEN_CLINIC_A');
  });
  it('routes two signed WABAs to exact clinics and pauses human requests before worker dispatch; replay is harmless', async () => {
    const payload = envelope([entry(phoneA, wabaA, 'managed-a-1'), entry(phoneB, wabaB, 'managed-b-1')]);
    expect((await send(payload)).status).toBe(200); expect((await send(payload)).status).toBe(200);
    const { rows } = await a.admin.query(
      `SELECT c.tenant_id,c.facility_id,c.automation_state,p.patient_id FROM comms.conversation c JOIN comms.contact_point p ON p.id=c.contact_point_id
       WHERE c.tenant_id=ANY($1::uuid[]) ORDER BY c.tenant_id`, [[a.tenant.tenantId, b.tenant.tenantId]],
    );
    expect(rows).toHaveLength(2);
    for (const k of [a, b]) expect(rows).toContainEqual({ tenant_id: k.tenant.tenantId, facility_id: k.tenant.facilityId, automation_state: 'handoff_requested', patient_id: null });
    const events = (await a.admin.query('SELECT facility_id,phone_number_id,business_account_id FROM comms.provider_event WHERE tenant_id=ANY($1::uuid[])', [[a.tenant.tenantId, b.tenant.tenantId]])).rows;
    expect(events).toHaveLength(2);
    expect(events).toContainEqual({ facility_id: a.tenant.facilityId, phone_number_id: phoneA, business_account_id: wabaA });
    await a.dispatch();
    expect((await a.admin.query('SELECT id FROM comms.inbound_message WHERE tenant_id=ANY($1::uuid[])', [[a.tenant.tenantId, b.tenant.tenantId]])).rows).toHaveLength(2);
  });
  it('rejects mixed known/unknown or wrong-WABA batches before any writes and verifies raw signatures', async () => {
    const before = await count();
    expect((await send(envelope([entry(phoneA, wabaA, 'never-a'), entry(phoneB, wabaA, 'never-b')]))).status).toBe(403);
    expect((await send(envelope([entry(phoneA, wabaA, 'never-c'), entry('177700000099', wabaB, 'never-d')]))).status).toBe(403);
    expect((await send(envelope([entry(phoneA, wabaA, 'never-e')]), false)).status).toBe(403);
    expect(await count()).toBe(before);
  });
  it('keeps signed STOP and human requests available without a GET verification token', async () => {
    const token = process.env.WA_VERIFY_TOKEN;
    delete process.env.WA_VERIFY_TOKEN;
    try {
      const setup = await a.call(adminA, 'GET', `/v1/comms/settings?facilityId=${a.tenant.facilityId}`);
      expect(setup.body).toMatchObject({ webhookReady: false, providerConfigured: false });
      const challenge = await a.app.inject({ method: 'GET', url: '/v1/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=anything&hub.challenge=123' });
      expect(challenge.statusCode).toBe(403);
      expect((await send(envelope([entry(phoneA, wabaA, 'stop-no-verify', 'STOP')]))).status).toBe(200);
      const stopped = await a.admin.query(`SELECT e.action FROM comms.messaging_consent_event e
        JOIN comms.contact_point p ON p.id=e.contact_point_id WHERE e.tenant_id=$1 AND p.address=$2`, [a.tenant.tenantId, '+' + sender]);
      expect(stopped.rows).toContainEqual({ action: 'stop' });
      expect((await send(envelope([entry(phoneB, wabaB, 'human-no-verify', 'human')]))).status).toBe(200);
      const state = await b.admin.query('SELECT automation_state FROM comms.conversation WHERE tenant_id=$1', [b.tenant.tenantId]);
      expect(state.rows).toContainEqual({ automation_state: 'handoff_requested' });
      const other = await b.admin.query('SELECT action FROM comms.messaging_consent_event WHERE tenant_id=$1', [b.tenant.tenantId]);
      expect(other.rows).not.toContainEqual({ action: 'stop' });
    } finally { if (token !== undefined) process.env.WA_VERIFY_TOKEN = token; }
  });
  it('rejects malformed signed arrays, message objects and epochs without poisoning the worker', async () => {
    const before = await count();
    for (const body of [null, { entry: {} }, envelope([{ id: wabaA, changes: null }]),
      envelope([{ id: wabaA, changes: [{ field: 'messages', value: { metadata: { phone_number_id: phoneA }, messages: [null] } }] }]),
      envelope([{ id: wabaA, changes: [{ field: 'messages', value: { ...value(phoneA, 'invalid-time'), messages: [{ id: 'invalid-time', from: sender, timestamp: '999999999999' }] } }] }])])
      expect((await send(body)).status).toBe(400);
    expect(await count()).toBe(before);
  });
  it('refuses clinic administrators claiming another clinic’s server-bound phone', async () => {
    const read = await a.call(adminA, 'GET', `/v1/comms/settings?facilityId=${a.tenant.facilityId}`);
    expect((await a.call(adminA, 'PUT', '/v1/comms/settings', { facilityId: a.tenant.facilityId, phoneNumberId: phoneB, version: read.body.version })).status).toBe(403);
    const bindings = process.env.WA_CLINIC_BINDINGS_JSON!;
    const changed = JSON.parse(bindings); changed[0].tenantId = b.tenant.tenantId; changed[0].facilityId = b.tenant.facilityId;
    changed.splice(1, 1); process.env.WA_CLINIC_BINDINGS_JSON = JSON.stringify(changed);
    try { expect((await send(envelope([entry(phoneA, wabaA, 'wrong-database-owner')]))).status).toBe(403); }
    finally { process.env.WA_CLINIC_BINDINGS_JSON = bindings; }
  });
  it('requires a reviewed migration for a new number after inbound history exists', async () => {
    const bindings = process.env.WA_CLINIC_BINDINGS_JSON!, changed = JSON.parse(bindings);
    changed[0].phoneNumberId = '177700000003'; process.env.WA_CLINIC_BINDINGS_JSON = JSON.stringify(changed);
    try {
      const read = await a.call(adminA, 'GET', `/v1/comms/settings?facilityId=${a.tenant.facilityId}`);
      expect((await a.call(adminA, 'PUT', '/v1/comms/settings', { facilityId: a.tenant.facilityId, phoneNumberId: '177700000003', version: read.body.version })).body.error.details.reason).toBe('account_has_history');
    } finally { process.env.WA_CLINIC_BINDINGS_JSON = bindings; }
  });
  it('rechecks account identity after an ingestion transaction waits behind a number update', async () => {
    const descriptor = { tenantId: a.tenant.tenantId, facilityId: a.tenant.facilityId, phoneNumberId: '177700000004', businessAccountId: wabaA, accessTokenEnv: 'HMS_WA_TOKEN_CLINIC_A' };
    // A separate unused clinic avoids modifying historical production-like account rows.
    const f = await a.call(adminA, 'POST', '/v1/facilities', { code: 'WA-RACE', name: 'Race clinic', facilityType: 'clinic', stateCode: '29' });
    expect(f.status).toBe(201); descriptor.facilityId = f.body.facilityId;
    const previous = process.env.WA_CLINIC_BINDINGS_JSON!;
    process.env.WA_CLINIC_BINDINGS_JSON = JSON.stringify([...JSON.parse(previous), descriptor]);
    try {
      expect((await a.call(adminA, 'PUT', '/v1/comms/settings', { facilityId: descriptor.facilityId, phoneNumberId: descriptor.phoneNumberId, version: 0 })).status).toBe(200);
      const locked = await a.admin.connect();
      await locked.query('BEGIN');
      try {
      const { rows: [holder] } = await locked.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      await locked.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`${a.tenant.tenantId}:account:${descriptor.facilityId}`]);
      // Start against the original descriptor, then commit a mapping change while ingest waits.
      const pending = storeWhatsAppCallback(a.db, descriptor.phoneNumberId, value(descriptor.phoneNumberId, 'mapping-race'), resolveWhatsAppBinding(descriptor.phoneNumberId)!).then(() => ({ accepted: true, error: undefined }), error => ({ accepted: false, error }));
      // Observe the actual waiter rather than treating an arbitrary delay as synchronization.
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const { rows: [r] } = await a.admin.query<{ waiting: boolean }>("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND $1=ANY(pg_blocking_pids(pid))) AS waiting", [holder!.pid]);
        if (r!.waiting) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      await locked.query('UPDATE comms.channel_account SET phone_number_id=$1 WHERE tenant_id=$2 AND facility_id=$3', ['177700000005', a.tenant.tenantId, descriptor.facilityId]);
      await locked.query('COMMIT');
      expect((await pending).error).toMatchObject({ code: 'forbidden' });
      expect((await a.admin.query('SELECT id FROM comms.provider_event WHERE tenant_id=$1 AND facility_id=$2', [a.tenant.tenantId, descriptor.facilityId])).rows).toHaveLength(0);
      } finally { await locked.query('ROLLBACK'); locked.release(); }
    } finally { process.env.WA_CLINIC_BINDINGS_JSON = previous; }
  });
});
