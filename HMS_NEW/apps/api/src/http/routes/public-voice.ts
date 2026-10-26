import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DB, Kysely } from '@hms/db';
import { z } from 'zod';
import { DomainError } from '@hms/platform';
import type { VoiceRuntimeSettings } from '../../config.ts';
import { ingestVoice, type ChannelSettings } from '../../modules/comms/voice-growth.ts';
import type { VoiceAgentSource } from '../../modules/comms/managed-voice.ts';
import { parse } from '../support.ts';

const hash = (value: string) => createHash('sha256').update(value).digest();
const same = (left: string, right: string) => timingSafeEqual(hash(left), hash(right));

function sessionToken(secret: string, sessionId: string, expiresAt: number, startedAt: number) {
  const payload = `${sessionId}.${expiresAt}.${startedAt}`;
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

function verifySession(secret: string, token: string | undefined) {
  if (!token) throw new DomainError('forbidden', 'voice session token is required');
  const [sessionId, rawExpiry, rawStartedAt, signature] = token.split('.');
  const expiry = Number(rawExpiry);
  const startedAt = Number(rawStartedAt);
  if (!sessionId || !signature || !Number.isInteger(expiry) || !Number.isInteger(startedAt) ||
      startedAt > Date.now() || expiry <= Date.now()) {
    throw new DomainError('forbidden', 'voice session token has expired');
  }
  const payload = `${sessionId}.${rawExpiry}.${rawStartedAt}`;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!same(signature, expected)) throw new DomainError('forbidden', 'voice session token is invalid');
  return { sessionId, startedAt };
}

function browserBinding(settings: ChannelSettings) {
  const bindings = settings.voiceBindings ?? (settings.voice ? [settings.voice] : []);
  return bindings.length === 1 ? bindings[0] : undefined;
}

/**
 * Public browser calling surface. The Sarvam API key stays server-side: either in this container (an
 * environment-pinned agent) or in the control plane (an agent bound by Paperwhale), resolved per request.
 */
export function registerPublicVoiceRoutes(
  app: FastifyInstance,
  db: Kysely<DB>,
  settings: VoiceRuntimeSettings,
  channels: ChannelSettings,
  source: VoiceAgentSource,
) {
  const integration = settings.integration;
  async function activeAgent() {
    const active = integration ? await source() : undefined;
    if (!active || !integration) throw new DomainError('precondition_failed', 'voice calling has not been activated for this clinic');
    return { ...active, integration };
  }

  app.get('/public/v1/voice/config', async () => {
    const active = await source();
    const agent = active?.agent;
    const enabled = !!agent && !!integration;
    return {
      enabled,
      integration_ready: !!integration,
      agent_ready: !!agent,
      state: enabled ? 'active' : integration ? 'awaiting_sarvam_agent' : 'not_requested',
      phone_number: active?.phoneNumber ?? settings.assignedPhoneNumber ?? null,
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
    };
  });

  app.post('/public/v1/voice/sessions', async (request, reply) => {
    const { agent, integration } = await activeAgent();
    parse(z.object({ recording_consent: z.literal(true), notice_version: z.literal(settings.noticeVersion) }), request.body);
    const runtimeSessionId = randomUUID();
    const startedAt = Date.now();
    const expiresAt = Date.now() + Math.min(settings.sessionSeconds + 60, 3660) * 1000;
    const binding = browserBinding(channels);
    if (binding) await ingestVoice(db, {
      eventId: `web:${runtimeSessionId}:0`, sessionId: runtimeSessionId, sequence: 0,
      startedAt: new Date(startedAt).toISOString(), status: 'active',
      agentVersion: agent.appVersion, toolCalls: 0,
      consent: {
        recordingAllowed: true, transcriptAllowed: true,
        evidence: `patient website notice ${settings.noticeVersion}`,
        occurredAt: new Date(startedAt).toISOString(),
        expiresAt: new Date(startedAt + 30 * 86400000).toISOString(),
      },
    }, { ...channels, voice: binding });
    return reply.status(201).send({
      runtime_session_id: runtimeSessionId,
      session_token: sessionToken(integration.signingSecret, runtimeSessionId, expiresAt, startedAt),
      expires_at: new Date(expiresAt).toISOString(),
    });
  });

  app.post('/public/v1/voice/sessions/end', async (request, reply) => {
    const active = integration ? await source() : undefined;
    if (active && integration) {
      const agent = active.agent;
      const session = verifySession(integration.signingSecret, request.headers['x-voice-session'] as string | undefined);
      const binding = browserBinding(channels);
      if (binding) await ingestVoice(db, {
        eventId: `web:${session.sessionId}:1`, sessionId: session.sessionId, sequence: 1,
        startedAt: new Date(session.startedAt).toISOString(), endedAt: new Date().toISOString(),
        status: 'completed', agentVersion: agent.appVersion, toolCalls: 0,
      }, { ...channels, voice: binding });
    }
    return reply.status(204).send();
  });

  app.get('/sarvam-runtime/orgs/:orgId/workspaces/:workspaceId/apps/:appId/url', async (request, reply) => {
    const { agent, integration, signedUrl } = await activeAgent();
    verifySession(integration.signingSecret, request.headers['x-voice-session'] as string | undefined);
    const params = parse(z.object({ orgId: z.string().min(1), workspaceId: z.string().min(1), appId: z.string().min(1) }), request.params);
    if (params.orgId !== agent.orgId || params.workspaceId !== agent.workspaceId || params.appId !== agent.appId) {
      throw new DomainError('forbidden', 'the requested voice agent is not assigned to this clinic');
    }
    const query = parse(z.object({ interaction_type: z.string().max(40).optional(), version: z.coerce.number().int().positive().optional() }), request.query);
    if (query.version !== undefined && query.version !== agent.appVersion) {
      throw new DomainError('forbidden', 'the requested voice agent version is not active');
    }
    const response = await signedUrl(query.interaction_type || 'call');
    reply.header('cache-control', 'no-store');
    if (response.status !== 200 || response.body === null) {
      request.log.warn({ status: response.status }, 'Sarvam signed URL request failed');
      return reply.status(response.status >= 400 ? response.status : 502)
        .send({ error: { code: 'voice_runtime_unavailable', message: 'Voice calling is temporarily unavailable.' } });
    }
    return reply.status(200).send(response.body);
  });
}
