import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import pg from 'pg';
import { config } from '../../../db/scripts/config.mjs';

const pool = new pg.Pool({ connectionString: config.testDatabaseUrl });
const provisionerToken = randomUUID();
const superadminToken = randomUUID();
const customers: string[] = [];
const runtimeCalls: string[] = [];
let child: ChildProcess, origin: string, sarvam: Server;

const tenantToken = (tenantId: string) => createHmac('sha256', provisionerToken).update(`tenant-control:${tenantId}`).digest('hex');
const key = () => `${randomUUID()}${randomUUID()}`.slice(0, 40);

beforeAll(async () => {
  // Stands in for Sarvam's runtime: only agent "Clinic-Good-1" v3 or v4 issues a call URL.
  sarvam = createServer((request, response) => {
    runtimeCalls.push(request.url ?? '');
    const url = new URL(request.url ?? '/', 'http://sarvam.test');
    const ok = request.headers['x-api-key'] === 'workspace-key' && url.pathname.endsWith('/apps/Clinic-Good-1/url') && ['3', '4'].includes(url.searchParams.get('version') ?? '');
    response.writeHead(ok ? 200 : 404, { 'content-type': 'application/json' });
    response.end(JSON.stringify(ok ? { url: 'wss://runtime.test/session' } : { detail: 'Not Found' }));
  });
  await new Promise<void>((resolve) => sarvam.listen(0, '127.0.0.1', resolve));
  const sarvamPort = (sarvam.address() as { port: number }).port;
  const root = path.resolve(import.meta.dirname, '../../..');
  origin = await new Promise<string>((resolve, reject) => {
    child = spawn(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'apps/control-api/src/main.ts'], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env, CONTROL_DATABASE_URL: config.testDatabaseUrl, HOST: '127.0.0.1', PORT: '0', AUTO_PROVISION: '0',
        SERVE_PLATFORM_ASSETS: '0', PROVISIONER_TOKEN: provisionerToken, SUPERADMIN_TOKEN: superadminToken,
        SARVAM_API_KEY: 'workspace-key', SARVAM_ORG_ID: 'org-1', SARVAM_WORKSPACE_ID: 'ws-1', SARVAM_RUNTIME_ORIGIN: `http://127.0.0.1:${sarvamPort}`,
      },
    });
    const timer = setTimeout(() => reject(new Error('Local control API did not start')), 60000);
    child.stdout!.on('data', chunk => {
      const address = String(chunk).match(/Server listening at (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
      if (address) { clearTimeout(timer); resolve(address); }
    });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Local control API exited before startup')); });
  });
}, 90000);

afterAll(async () => {
  child?.kill('SIGTERM');
  sarvam?.close();
  for (const id of customers) {
    await pool.query('DELETE FROM control.voice_provisioning_operation WHERE customer_id=$1', [id]);
    await pool.query('DELETE FROM control.voice_configuration_revision WHERE customer_id=$1', [id]);
    await pool.query('DELETE FROM control.voice_agent_binding WHERE customer_id=$1', [id]);
    await pool.query('DELETE FROM control.deployment WHERE customer_id=$1', [id]);
    const { rows: [row] } = await pool.query('DELETE FROM control.customer WHERE id=$1 RETURNING onboarding_id', [id]);
    if (row) await pool.query('DELETE FROM control.onboarding_request WHERE id=$1', [row.onboarding_id]);
  }
  await pool.end();
});

async function clinic(plan: 'launch' | 'scale' = 'scale') {
  const onboardingId = randomUUID(), customerId = randomUUID(), tenantId = randomUUID(), slug = `voice-${randomUUID().slice(0, 8)}`;
  const modules = plan === 'launch' ? ['platform', 'booking'] : ['platform', 'booking', 'comms'];
  await pool.query(`INSERT INTO control.onboarding_request(id,idempotency_key,slug,owner_email,payload,access_token_hash,status,allocated_port)
    VALUES($1,$2,$3,'owner@example.test',$4,'x','ready',$5)`, [onboardingId, randomUUID(), slug, { facilityName: 'Main Clinic', timezone: 'Asia/Kolkata' }, 20000 + randomInt(40000)]);
  await pool.query(`INSERT INTO control.customer(id,onboarding_id,name,slug,owner_email,plan_code,modules,voice_status) VALUES($1,$2,'Lotus Clinic',$3,'owner@example.test',$4,$5,'not_requested')`,
    [customerId, onboardingId, slug, plan, JSON.stringify(modules)]);
  await pool.query(`INSERT INTO control.deployment(id,customer_id,tenant_id,compose_project,image,public_url,staff_url,state,health)
    VALUES($1,$2,$3,$4,'exora/hms:test',$5,$6,'ready','healthy')`, [randomUUID(), customerId, tenantId, `exora-${slug}`, `https://${slug}.health.test/`, `https://${slug}.health.test/staff`]);
  customers.push(customerId);
  return { customerId, tenantId, slug };
}

function asTenant(tenantId: string, route: string, init: { method?: string; body?: unknown; idempotencyKey?: string; token?: string } = {}) {
  return fetch(`${origin}/control/v1/internal/tenants/${tenantId}${route}`, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${init.token ?? tenantToken(tenantId)}`,
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(init.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

function asSuperadmin(route: string, body?: unknown) {
  return fetch(`${origin}/control/v1/admin${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${superadminToken}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('clinic-requested voice agents', () => {
  it('accepts only the clinic own derived token', async () => {
    const a = await clinic(), b = await clinic();
    expect((await asTenant(a.tenantId, '/voice', { token: provisionerToken })).status).toBe(401);
    expect((await asTenant(a.tenantId, '/voice', { token: tenantToken(b.tenantId) })).status).toBe(401);
    const own = await asTenant(a.tenantId, '/voice');
    expect(own.status).toBe(200);
    expect(await own.json()).toMatchObject({ entitled: true, voiceStatus: 'not_requested', agent: null, request: null, runtime: null });
  });

  it('refuses a request from a plan without communications', async () => {
    const launch = await clinic('launch');
    const response = await asTenant(launch.tenantId, '/voice-request', { method: 'POST', body: { requestedBy: 'Owner' }, idempotencyKey: key() });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: 'voice_not_entitled' });
  });

  it('runs a create request from the clinic button to an active agent', async () => {
    const { customerId, tenantId, slug } = await clinic();
    const requestKey = key();
    const created = await asTenant(tenantId, '/voice-request', { method: 'POST', body: { requestedBy: 'Dr Rao' }, idempotencyKey: requestKey });
    expect(created.status).toBe(201);
    const request = await created.json() as { id: string };
    expect(request).toMatchObject({ kind: 'create', state: 'pending', requestedBy: 'Dr Rao', revision: 1 });
    const replay = await asTenant(tenantId, '/voice-request', { method: 'POST', body: { requestedBy: 'Dr Rao' }, idempotencyKey: requestKey });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ id: request.id });
    const second = await asTenant(tenantId, '/voice-request', { method: 'POST', body: { requestedBy: 'Dr Rao' }, idempotencyKey: key() });
    expect(await second.json()).toMatchObject({ error: 'voice_request_open' });

    const inbox = await (await asSuperadmin('/voice-requests')).json() as { items: { id: string; customerSlug: string }[] };
    expect(inbox.items).toContainEqual(expect.objectContaining({ id: request.id, customerSlug: slug }));
    const kit = await (await asSuperadmin(`/voice-requests/${request.id}`)).json() as {
      manifest: { tools: { url: string }[]; prompt: string; agentName: string }; serviceKey: { command: string };
    };
    expect(kit.manifest.agentName).toBe('Lotus Clinic Front Desk');
    expect(kit.manifest.tools.length).toBeGreaterThan(3);
    for (const tool of kit.manifest.tools) expect(tool.url.startsWith(`https://${slug}.health.test/api/v1/integrations/voice/`)).toBe(true);
    expect(kit.serviceKey.command).toContain(`/${slug}/secrets.json`);

    expect(await (await asSuperadmin(`/voice-requests/${request.id}/start`, {})).json()).toMatchObject({ state: 'in_setup' });
    expect(await (await asTenant(tenantId, '/voice')).json()).toMatchObject({ voiceStatus: 'configuring', request: { state: 'in_setup' } });

    const untested = await asSuperadmin(`/voice-requests/${request.id}/activate`, { agentId: 'Clinic-Good-1', appVersion: 3 });
    expect(await untested.json()).toMatchObject({ error: 'voice_agent_untested' });
    const badTest = await asSuperadmin(`/voice-requests/${request.id}/test`, { agentId: 'Clinic-Good-1', appVersion: 9 });
    expect(badTest.status).toBe(409);
    expect(await badTest.json()).toMatchObject({ error: 'voice_agent_test_failed' });
    expect((await asSuperadmin(`/voice-requests/${request.id}/test`, { agentId: 'Clinic-Good-1', appVersion: 3 })).status).toBe(200);
    const otherVersion = await asSuperadmin(`/voice-requests/${request.id}/activate`, { agentId: 'Clinic-Good-1', appVersion: 4 });
    expect(await otherVersion.json()).toMatchObject({ error: 'voice_agent_untested' });
    const activated = await asSuperadmin(`/voice-requests/${request.id}/activate`, { agentId: 'Clinic-Good-1', appVersion: 3, phoneNumber: '+917900000001' });
    expect(activated.status).toBe(200);
    expect(await activated.json()).toMatchObject({ state: 'completed' });

    const status = await (await asTenant(tenantId, '/voice')).json() as { settings: Record<string, unknown> };
    expect(status).toMatchObject({
      voiceStatus: 'active', activeRevision: 1, runtime: { orgId: 'org-1', workspaceId: 'ws-1' },
      agent: { agentId: 'Clinic-Good-1', appVersion: 3, displayName: 'Lotus Clinic Front Desk', phoneNumber: '+917900000001' },
      request: { state: 'completed' },
    });
    const runtime = await asTenant(tenantId, '/voice-runtime-url', { method: 'POST', body: {} });
    expect(runtime.status).toBe(200);
    expect(await runtime.json()).toEqual({ url: 'wss://runtime.test/session' });
    expect(runtimeCalls.at(-1)).toContain('/orgs/org-1/workspaces/ws-1/apps/Clinic-Good-1/url?interaction_type=call&version=3');
    const { rows: [binding] } = await pool.query('SELECT state,agent_id,app_version FROM control.voice_agent_binding WHERE customer_id=$1', [customerId]);
    expect(binding).toEqual({ state: 'active', agent_id: 'Clinic-Good-1', app_version: 3 });

    // Another clinic can never be bound to the same Sarvam agent.
    const other = await clinic();
    const otherRequest = await (await asTenant(other.tenantId, '/voice-request', { method: 'POST', body: { requestedBy: 'Admin' }, idempotencyKey: key() })).json() as { id: string };
    const stolen = await asSuperadmin(`/voice-requests/${otherRequest.id}/test`, { agentId: 'Clinic-Good-1', appVersion: 3 });
    expect(await stolen.json()).toMatchObject({ error: 'voice_agent_bound_elsewhere' });

    // Request changes: draft → request → decline with a reason → edit again → request → apply as v4.
    const settings = status.settings as Record<string, unknown>;
    const draft = await asTenant(tenantId, '/voice-draft', { method: 'PUT', body: { expectedRevision: 1, settings: { ...settings, greeting: 'Namaste, Lotus Clinic here.' }, requestedBy: 'Dr Rao' } });
    expect(draft.status).toBe(201);
    const changes = await (await asTenant(tenantId, '/voice-changes', { method: 'POST', body: { revision: 2, requestedBy: 'Dr Rao' }, idempotencyKey: key() })).json() as { id: string };
    expect(changes).toMatchObject({ kind: 'changes', state: 'pending', revision: 2 });
    const blocked = await asTenant(tenantId, '/voice-draft', { method: 'PUT', body: { expectedRevision: 2, settings, requestedBy: 'Dr Rao' } });
    expect(await blocked.json()).toMatchObject({ error: 'voice_request_open' });
    const changeKit = await (await asSuperadmin(`/voice-requests/${changes.id}`)).json() as { previousSettings: { greeting: string }; settings: { greeting: string } };
    expect(changeKit.previousSettings.greeting).not.toBe(changeKit.settings.greeting);
    expect(await (await asSuperadmin(`/voice-requests/${changes.id}/decline`, { reason: 'Please add Kannada too.' })).json()).toMatchObject({ state: 'declined', reason: 'Please add Kannada too.' });
    expect(await (await asTenant(tenantId, '/voice')).json()).toMatchObject({ revisionState: 'failed', request: { kind: 'changes', state: 'declined', reason: 'Please add Kannada too.' }, agent: { appVersion: 3 } });

    await asTenant(tenantId, '/voice-draft', { method: 'PUT', body: { expectedRevision: 2, settings: { ...settings, languages: ['en', 'kn'] }, requestedBy: 'Dr Rao' } });
    const retry = await (await asTenant(tenantId, '/voice-changes', { method: 'POST', body: { revision: 3, requestedBy: 'Dr Rao' }, idempotencyKey: key() })).json() as { id: string };
    const sameVersion = await asSuperadmin(`/voice-requests/${retry.id}/test`, { agentId: 'Clinic-Good-1', appVersion: 3 });
    expect(await sameVersion.json()).toMatchObject({ error: 'voice_version_not_newer' });
    expect((await asSuperadmin(`/voice-requests/${retry.id}/test`, { agentId: 'Clinic-Good-1', appVersion: 4 })).status).toBe(200);
    expect((await asSuperadmin(`/voice-requests/${retry.id}/activate`, { agentId: 'Clinic-Good-1', appVersion: 4 })).status).toBe(200);
    expect(await (await asTenant(tenantId, '/voice')).json()).toMatchObject({
      activeRevision: 3, revisionState: 'active', agent: { appVersion: 4, phoneNumber: '+917900000001' }, settings: { languages: ['en', 'kn'] },
    });
  });

  it('returns a declined create request to the button', async () => {
    const { tenantId } = await clinic();
    const request = await (await asTenant(tenantId, '/voice-request', { method: 'POST', body: { requestedBy: 'Admin' }, idempotencyKey: key() })).json() as { id: string };
    await asSuperadmin(`/voice-requests/${request.id}/decline`, { reason: 'Publish a doctor schedule first.' });
    expect(await (await asTenant(tenantId, '/voice')).json()).toMatchObject({
      voiceStatus: 'not_requested', agent: null, request: { kind: 'create', state: 'declined', reason: 'Publish a doctor schedule first.' },
    });
    expect((await asTenant(tenantId, '/voice-request', { method: 'POST', body: { requestedBy: 'Admin' }, idempotencyKey: key() })).status).toBe(201);
  });
});
