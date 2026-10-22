import { conflict, invalid, notFound, preconditionFailed } from '@hms/platform';
import type { VoiceAgentBinding } from '../../config.ts';

/** This clinic's control-plane address and its own derived token. The browser never receives either. */
export type VoiceControlTarget = { url: string; token: string; tenantId: string };

export type ActiveVoiceAgent = {
  agent: VoiceAgentBinding;
  phoneNumber: string | null;
  /** Signed Sarvam call URL for this agent version, or the provider's failure status. */
  signedUrl(interactionType: string): Promise<{ status: number; body: unknown }>;
};

/** Resolves the clinic's live agent on each request; implementations cache. */
export type VoiceAgentSource = () => Promise<ActiveVoiceAgent | undefined>;

type ControlInit = { method: string; body?: unknown; idempotencyKey?: string };

export async function controlCall(control: VoiceControlTarget, path: string, init: ControlInit): Promise<unknown> {
  const send = () => fetch(`${control.url}/control/v1/internal/tenants/${control.tenantId}${path}`, {
    method: init.method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${control.token}`,
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(init.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  let response: Response;
  try {
    response = await send();
  } catch {
    // A pooled connection the server already closed fails before anything is sent. Retry only reads
    // and keyed writes, which are safe to repeat.
    if (init.method !== 'GET' && !init.idempotencyKey) throw preconditionFailed('Voice control could not be reached.');
    try { response = await send(); }
    catch { throw preconditionFailed('Voice control could not be reached.'); }
  }
  const text = await response.text();
  let body: unknown = {};
  if (text) {
    try { body = JSON.parse(text) as unknown; }
    catch { throw preconditionFailed('Voice control returned an unreadable response.'); }
  }
  if (response.ok) return body;
  throw controlFailure(response.status, body);
}

function controlFailure(status: number, body: unknown) {
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const code = typeof record.error === 'string' ? record.error : 'voice_control_failed';
  if (status === 400 && code === 'validation') {
    const issues = Array.isArray(record.issues) ? record.issues.flatMap((issue) => {
      if (!issue || typeof issue !== 'object') return [];
      const item = issue as { path?: unknown; message?: unknown };
      return [{ path: Array.isArray(item.path) ? item.path.map(String).join('.') : '', message: typeof item.message === 'string' ? item.message : 'Invalid value' }];
    }) : [];
    return invalid('Voice settings are not valid.', { issues });
  }
  const message = typeof record.message === 'string' ? record.message : CONTROL_MESSAGES[code] ?? 'Voice request could not be completed.';
  if (status === 404 || code === 'not_found' || code === 'voice_revision_not_found') return notFound('Voice settings');
  if (status === 401 || status === 403) return preconditionFailed('Voice control rejected this clinic credential.');
  if (status >= 500) return preconditionFailed('Voice control is unavailable.');
  return conflict(message, { controlError: code, ...(typeof record.currentRevision === 'number' ? { currentRevision: record.currentRevision } : {}) });
}

const CONTROL_MESSAGES: Record<string, string> = {
  voice_not_entitled: 'Voice is not included in this clinic plan.',
  voice_agent_exists: 'This clinic already has a voice agent.',
  voice_agent_missing: 'This clinic does not have a voice agent yet.',
  voice_request_open: 'A voice request is already with Exora.',
  voice_revision_not_draft: 'Save your changes before requesting them.',
  stale_revision: 'Voice settings changed elsewhere. Reload and try again.',
  idempotency_key_reused: 'This request was already used for a different change. Reload and try again.',
  idempotency_key_required: 'A retry key is required for this voice request.',
};

type ControlStatus = {
  agent: { agentId: string; appVersion: number; displayName: string; phoneNumber: string | null } | null;
  runtime: { orgId: string; workspaceId: string } | null;
};

/**
 * The agent bound in the control plane, cached briefly so the public config endpoint stays fast.
 * A failed lookup is cached for a shorter time and reads as "no agent" rather than an error.
 */
export function controlVoiceSource(control: VoiceControlTarget, log: { warn(obj: unknown, msg: string): void }, ttlMs = 60_000): VoiceAgentSource {
  let cached: { value: ActiveVoiceAgent | undefined; until: number } | undefined;
  let pending: Promise<ActiveVoiceAgent | undefined> | undefined;
  async function load(): Promise<ActiveVoiceAgent | undefined> {
    try {
      const status = await controlCall(control, '/voice', { method: 'GET' }) as ControlStatus;
      const value = status.agent && status.runtime ? {
        agent: {
          orgId: status.runtime.orgId,
          workspaceId: status.runtime.workspaceId,
          appId: status.agent.agentId,
          appVersion: status.agent.appVersion,
          agentName: status.agent.displayName,
          runtimeBaseUrl: '/sarvam-runtime/',
        },
        phoneNumber: status.agent.phoneNumber,
        signedUrl: async (interactionType: string) => {
          try {
            return { status: 200, body: await controlCall(control, '/voice-runtime-url', { method: 'POST', body: { interactionType } }) };
          } catch {
            return { status: 502, body: null };
          }
        },
      } : undefined;
      cached = { value, until: Date.now() + ttlMs };
      return value;
    } catch (error) {
      log.warn({ err: error }, 'voice agent lookup failed');
      cached = { value: cached?.value, until: Date.now() + Math.min(ttlMs, 15_000) };
      return cached.value;
    }
  }
  return async () => {
    if (cached && cached.until > Date.now()) return cached.value;
    pending ??= load().finally(() => { pending = undefined; });
    return pending;
  };
}

/** An agent pinned in this container's environment (clinics set up before managed requests). */
export function environmentVoiceSource(agent: VoiceAgentBinding, apiKey: string, phoneNumber: string | null): VoiceAgentSource {
  const active: ActiveVoiceAgent = {
    agent,
    phoneNumber,
    async signedUrl(interactionType) {
      const upstream = new URL(`https://apps.sarvam.ai/api/app-runtime/orgs/${encodeURIComponent(agent.orgId)}/workspaces/${encodeURIComponent(agent.workspaceId)}/apps/${encodeURIComponent(agent.appId)}/url`);
      upstream.searchParams.set('interaction_type', interactionType);
      upstream.searchParams.set('version', String(agent.appVersion));
      const response = await fetch(upstream, { headers: { 'X-API-Key': apiKey }, signal: AbortSignal.timeout(10_000) });
      const text = await response.text();
      if (!response.ok) return { status: response.status, body: null };
      try { return { status: 200, body: JSON.parse(text) as unknown }; }
      catch { return { status: 502, body: null }; }
    },
  };
  return async () => active;
}
