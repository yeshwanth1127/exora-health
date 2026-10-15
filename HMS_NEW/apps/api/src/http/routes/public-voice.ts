import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DomainError } from '@hms/platform';
import type { VoiceRuntimeSettings } from '../../config.ts';
import { parse } from '../support.ts';

const hash = (value: string) => createHash('sha256').update(value).digest();
const same = (left: string, right: string) => timingSafeEqual(hash(left), hash(right));

function sessionToken(secret: string, sessionId: string, expiresAt: number) {
  const payload = `${sessionId}.${expiresAt}`;
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

function verifySession(secret: string, token: string | undefined) {
  if (!token) throw new DomainError('forbidden', 'voice session token is required');
  const [sessionId, rawExpiry, signature] = token.split('.');
  const expiry = Number(rawExpiry);
  if (!sessionId || !signature || !Number.isInteger(expiry) || expiry <= Date.now()) {
    throw new DomainError('forbidden', 'voice session token has expired');
  }
  const payload = `${sessionId}.${rawExpiry}`;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!same(signature, expected)) throw new DomainError('forbidden', 'voice session token is invalid');
  return sessionId;
}

/** Public browser calling surface. The Sarvam API key remains server-side in the signed-URL proxy. */
export function registerPublicVoiceRoutes(app: FastifyInstance, settings: VoiceRuntimeSettings) {
  const agent = settings.agent;
  const integration = settings.integration;
  const enabled = !!agent && !!integration && !!settings.sarvamApiKey;

  app.get('/public/v1/voice/config', async () => ({
    enabled,
    integration_ready: !!integration,
    agent_ready: !!agent && !!settings.sarvamApiKey,
    state: enabled ? 'active' : integration ? 'awaiting_sarvam_agent' : 'not_requested',
    ...(enabled ? {
      org_id: agent.orgId,
      workspace_id: agent.workspaceId,
      app_id: agent.appId,
      version: agent.appVersion,
      agent_name: agent.agentName,
      runtime_base_url: agent.runtimeBaseUrl,
      recording_notice: settings.recordingNotice,
      notice_version: settings.noticeVersion,
      session_seconds: settings.sessionSeconds,
    } : {}),
  }));

  app.post('/public/v1/voice/sessions', async (request, reply) => {
    if (!enabled) throw new DomainError('precondition_failed', 'voice calling has not been activated for this clinic');
    parse(z.object({ recording_consent: z.literal(true), notice_version: z.literal(settings.noticeVersion) }), request.body);
    const runtimeSessionId = randomUUID();
    const expiresAt = Date.now() + Math.min(settings.sessionSeconds + 60, 3660) * 1000;
    return reply.status(201).send({
      runtime_session_id: runtimeSessionId,
      session_token: sessionToken(integration.signingSecret, runtimeSessionId, expiresAt),
      expires_at: new Date(expiresAt).toISOString(),
    });
  });

  app.post('/public/v1/voice/sessions/end', async (request, reply) => {
    if (enabled) verifySession(integration.signingSecret, request.headers['x-voice-session'] as string | undefined);
    return reply.status(204).send();
  });

  app.get('/sarvam-runtime/orgs/:orgId/workspaces/:workspaceId/apps/:appId/url', async (request, reply) => {
    if (!enabled) throw new DomainError('precondition_failed', 'voice calling has not been activated for this clinic');
    verifySession(integration.signingSecret, request.headers['x-voice-session'] as string | undefined);
    const params = parse(z.object({ orgId: z.string().min(1), workspaceId: z.string().min(1), appId: z.string().min(1) }), request.params);
    if (params.orgId !== agent.orgId || params.workspaceId !== agent.workspaceId || params.appId !== agent.appId) {
      throw new DomainError('forbidden', 'the requested voice agent is not assigned to this clinic');
    }
    const query = parse(z.object({ interaction_type: z.string().max(40).optional(), version: z.coerce.number().int().positive().optional() }), request.query);
    if (query.version !== undefined && query.version !== agent.appVersion) {
      throw new DomainError('forbidden', 'the requested voice agent version is not active');
    }
    const upstream = new URL(`https://apps.sarvam.ai/api/app-runtime/orgs/${encodeURIComponent(agent.orgId)}/workspaces/${encodeURIComponent(agent.workspaceId)}/apps/${encodeURIComponent(agent.appId)}/url`);
    upstream.searchParams.set('interaction_type', query.interaction_type || 'call');
    upstream.searchParams.set('version', String(agent.appVersion));
    const response = await fetch(upstream, {
      headers: { 'X-API-Key': settings.sarvamApiKey! },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    reply.status(response.status).header('cache-control', 'no-store');
    if (!response.ok) {
      request.log.warn({ status: response.status }, 'Sarvam signed URL request failed');
      return reply.send({ error: { code: 'voice_runtime_unavailable', message: 'Voice calling is temporarily unavailable.' } });
    }
    try {
      return reply.send(JSON.parse(text));
    } catch {
      throw new DomainError('precondition_failed', 'voice runtime returned an invalid response');
    }
  });
}
