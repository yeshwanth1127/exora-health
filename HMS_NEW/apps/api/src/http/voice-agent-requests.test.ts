// Clinic side of manually provisioned voice agents: staff requests relay to this clinic's control-plane
// record with its own token, and the website uses the agent Paperwhale bound there, without a restart.
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startKit, type Kit, type Person } from './test-kit.ts';

type Seen = { method: string; path: string; authorization?: string; idempotency?: string; body: unknown };
const seen: Seen[] = [];
let control: Server, kit: Kit, owner: Person, desk: Person;
let controlStatus: Record<string, unknown> = { agent: null, runtime: null };

beforeAll(async () => {
  control = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      const path = (request.url ?? '').replace(/^\/control\/v1\/internal\/tenants\/[^/]+/, '');
      seen.push({ method: request.method ?? '', path, authorization: request.headers.authorization, idempotency: request.headers['idempotency-key'] as string | undefined, body: raw ? JSON.parse(raw) : undefined });
      const send = (status: number, body: unknown) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); };
      if (request.headers.authorization !== 'Bearer clinic-derived-token') return send(401, { error: 'unauthorized' });
      if (path === '/voice' && request.method === 'GET') return send(200, controlStatus);
      if (path === '/voice-request') return send(201, { id: 'request-1', kind: 'create', state: 'pending' });
      if (path === '/voice-changes') return send(409, { error: 'voice_request_open' });
      if (path === '/voice-runtime-url') return send(200, { url: 'wss://runtime.test/signed' });
      return send(404, { error: 'not_found' });
    });
  });
  await new Promise<void>((resolve) => control.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(control.address() as { port: number }).port}`;
  kit = await startKit('voice-agent-requests', undefined, undefined, undefined, (tenant) => ({
    publicTenantId: tenant.tenantId,
    voiceControl: { url, token: 'clinic-derived-token', tenantId: tenant.tenantId },
    voice: {
      integration: { serviceKey: 'service-key-for-tests-0123456789abcdef', signingSecret: 'signing-secret-for-tests-0123456789ab', serviceAccountId: tenant.tenantId },
      recordingNotice: 'Calls may be recorded.', noticeVersion: 'test-notice', sessionSeconds: 600,
    },
  }));
  owner = await kit.person('Dr Owner', 'tenant_admin', null);
  desk = await kit.person('Front Desk', 'front_desk', kit.tenant.facilityId);
});

afterAll(async () => { await kit?.close(); control?.close(); });

describe('clinic voice agent requests', () => {
  it('lets voice readers see status but only voice managers request an agent', async () => {
    expect((await kit.call(desk, 'GET', `/v1/voice/agent-settings?facilityId=${kit.tenant.facilityId}`)).status).toBe(200);
    expect((await kit.call(desk, 'POST', '/v1/voice/agent-request', { facilityId: kit.tenant.facilityId })).status).toBe(403);
    const before = seen.length;
    const created = await kit.call(owner, 'POST', '/v1/voice/agent-request', { facilityId: kit.tenant.facilityId }, 'owner-request-key-1');
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ id: 'request-1', state: 'pending' });
    expect(seen.slice(before)).toEqual([expect.objectContaining({
      method: 'POST', path: '/voice-request', authorization: 'Bearer clinic-derived-token',
      idempotency: 'owner-request-key-1', body: { requestedBy: 'Dr Owner' },
    })]);
  });

  it('turns control refusals into clinic-readable conflicts', async () => {
    const response = await kit.call(owner, 'POST', '/v1/voice/agent-settings/request-changes', { facilityId: kit.tenant.facilityId, revision: 2 });
    expect(response.status).toBe(409);
    expect(JSON.stringify(response.body)).toContain('A voice request is already with Paperwhale.');
  });

  it('serves website calls from the agent bound in the control plane', async () => {
    const off = await kit.app.inject({ method: 'GET', url: '/public/v1/voice/config' });
    expect(off.json()).toMatchObject({ enabled: false, state: 'awaiting_sarvam_agent' });

    // The first server cached "no agent" for a minute; a second clinic server picks up the newly bound agent.
    controlStatus = {
      agent: { agentId: 'Clinic-Good-1', appVersion: 3, displayName: 'Lotus Front Desk', phoneNumber: '+917900000001' },
      runtime: { orgId: 'org-1', workspaceId: 'ws-1' },
    };
    const fresh = await startKit('voice-agent-requests-live', undefined, undefined, undefined, (tenant) => ({
      publicTenantId: tenant.tenantId,
      voiceControl: { url: `http://127.0.0.1:${(control.address() as { port: number }).port}`, token: 'clinic-derived-token', tenantId: tenant.tenantId },
      voice: {
        integration: { serviceKey: 'service-key-for-tests-0123456789abcdef', signingSecret: 'signing-secret-for-tests-0123456789ab', serviceAccountId: tenant.tenantId },
        recordingNotice: 'Calls may be recorded.', noticeVersion: 'test-notice', sessionSeconds: 600,
      },
    }));
    try {
      const config = (await fresh.app.inject({ method: 'GET', url: '/public/v1/voice/config' })).json();
      expect(config).toMatchObject({
        enabled: true, state: 'active', app_id: 'Clinic-Good-1', version: 3, agent_name: 'Lotus Front Desk',
        org_id: 'org-1', workspace_id: 'ws-1', phone_number: '+917900000001', runtime_base_url: '/sarvam-runtime/',
      });
      expect(JSON.stringify(config)).not.toContain('clinic-derived-token');
      const session = await fresh.app.inject({ method: 'POST', url: '/public/v1/voice/sessions', payload: { recording_consent: true, notice_version: 'test-notice' } });
      expect(session.statusCode).toBe(201);
      const token = session.json().session_token as string;
      const signed = await fresh.app.inject({ method: 'GET', url: '/sarvam-runtime/orgs/org-1/workspaces/ws-1/apps/Clinic-Good-1/url?version=3', headers: { 'x-voice-session': token } });
      expect(signed.statusCode).toBe(200);
      expect(signed.json()).toEqual({ url: 'wss://runtime.test/signed' });
      expect(seen.at(-1)).toMatchObject({ method: 'POST', path: '/voice-runtime-url', body: { interactionType: 'call' } });
      const other = await fresh.app.inject({ method: 'GET', url: '/sarvam-runtime/orgs/org-1/workspaces/ws-1/apps/Other-Agent/url', headers: { 'x-voice-session': token } });
      expect(other.statusCode).toBe(403);
    } finally {
      await fresh.close();
    }
  });
});
