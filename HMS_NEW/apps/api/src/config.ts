// API configuration from the environment. Local defaults match `pnpm pg:start` + `pnpm db:reset`.
import { config as dbConfig } from '../../../db/scripts/config.mjs';

export type AuthConfig =
  | { mode: 'dev'; secret: string; issuer: string }
  | { mode: 'oidc'; issuer: string; jwksUrl: string; audience: string };

export interface ApiConfig {
  port: number;
  host: string;
  databaseUrl: string;
  auth: AuthConfig;
  /** Lets tests pin the clock with the X-Test-Now header. Never enable in production. */
  allowClockOverride: boolean;
  /** Browser origins allowed by CORS (CORS_ORIGINS, comma-separated). */
  corsOrigins: string[];
  telehealth: TelehealthSettings;
  /** Tenant exposed by this single-tenant runtime's public booking surface. */
  publicTenantId?: string;
  /** Optional tenant-bound Sarvam booking integration and public web-call runtime. */
  voice: VoiceRuntimeSettings;
}

export interface VoiceAgentBinding {
  orgId: string;
  workspaceId: string;
  appId: string;
  appVersion: number;
  agentName: string;
  runtimeBaseUrl: string;
}

export interface VoiceRuntimeSettings {
  /** Enables Sarvam's server-to-server tools. Omitted until a tenant requests Voice. */
  integration?: {
    serviceKey: string;
    signingSecret: string;
    serviceAccountId: string;
  };
  /** Enables the public website's browser voice call. Omitted until an agent is committed. */
  agent?: VoiceAgentBinding;
  /** Public inbound number assigned exclusively to this tenant's agent. */
  assignedPhoneNumber?: string;
  sarvamApiKey?: string;
  recordingNotice: string;
  noticeVersion: string;
  sessionSeconds: number;
}

/** Virtual OPD: Jitsi token signing and join rules. */
export interface TelehealthSettings {
  jitsiDomain: string;
  /** JWT `iss` (the app id configured in Jitsi's token authentication). */
  jitsiAppId: string;
  /** JWT `aud`; self-hosted jitsi-meet-tokens accepts 'jitsi' by default. */
  jitsiAudience: string;
  /** HS256 shared secret; lives only in the API's environment. */
  jitsiSecret: string;
  tokenMinutes: number;
  joinEarlyMinutes: number;
  joinLateMinutes: number;
  /** Patient join page; the link is `<base>#t=<token>` (the fragment never reaches a server). */
  patientLinkBase: string;
}

export const DEV_JITSI_SECRET = 'local-dev-jitsi-secret-change-me-0123456789';

export function loadVoiceRuntimeSettings(env: NodeJS.ProcessEnv = process.env): VoiceRuntimeSettings {
  const serviceKey = env.VOICE_SERVICE_KEY?.trim();
  const serviceAccountId = env.VOICE_SERVICE_ACCOUNT_ID?.trim();
  const signingSecret = env.VOICE_SIGNING_SECRET?.trim() || serviceKey;
  const integration = serviceKey && serviceAccountId && signingSecret
    ? { serviceKey, serviceAccountId, signingSecret }
    : undefined;
  if ((serviceKey || serviceAccountId || env.VOICE_SIGNING_SECRET) && !integration) {
    throw new Error('VOICE_SERVICE_KEY and VOICE_SERVICE_ACCOUNT_ID must be set together');
  }

  const orgId = env.SARVAM_ORG_ID?.trim();
  const workspaceId = env.SARVAM_WORKSPACE_ID?.trim();
  const appId = env.SARVAM_APP_ID?.trim();
  const appVersion = env.SARVAM_APP_VERSION ? Number(env.SARVAM_APP_VERSION) : undefined;
  const agentFields = [orgId, workspaceId, appId, appVersion, env.SARVAM_AGENT_NAME, env.SARVAM_API_KEY];
  const hasAgentField = agentFields.some(Boolean);
  const completeAgent = !!orgId && !!workspaceId && !!appId && Number.isInteger(appVersion) && Number(appVersion) > 0 && !!env.SARVAM_API_KEY;
  if (hasAgentField && !completeAgent) {
    throw new Error('Sarvam web voice needs SARVAM_ORG_ID, SARVAM_WORKSPACE_ID, SARVAM_APP_ID, SARVAM_APP_VERSION and SARVAM_API_KEY');
  }
  const agent = completeAgent
    ? {
        orgId: orgId!,
        workspaceId: workspaceId!,
        appId: appId!,
        appVersion: Number(appVersion),
        agentName: env.SARVAM_AGENT_NAME?.trim() || 'booking assistant',
        runtimeBaseUrl: '/sarvam-runtime/',
      }
    : undefined;
  const assignedPhoneNumber = env.SARVAM_PHONE_NUMBER?.trim();
  if (assignedPhoneNumber && !/^\+[1-9]\d{7,14}$/.test(assignedPhoneNumber)) {
    throw new Error('SARVAM_PHONE_NUMBER must be an E.164 phone number');
  }
  const sessionSeconds = Number(env.VOICE_SESSION_SECONDS ?? 900);
  if (!Number.isInteger(sessionSeconds) || sessionSeconds < 60 || sessionSeconds > 3600) {
    throw new Error('VOICE_SESSION_SECONDS must be an integer from 60 to 3600');
  }
  return {
    integration,
    agent,
    assignedPhoneNumber: assignedPhoneNumber || undefined,
    sarvamApiKey: completeAgent ? env.SARVAM_API_KEY!.trim() : undefined,
    recordingNotice: env.VOICE_RECORDING_NOTICE?.trim() || 'This call may be processed and recorded to help the clinic manage your appointment.',
    noticeVersion: env.VOICE_NOTICE_VERSION?.trim() || '2026-10-14',
    sessionSeconds,
  };
}

export function loadTelehealthSettings(env: NodeJS.ProcessEnv = process.env): TelehealthSettings {
  const secret = env.JITSI_SECRET ?? DEV_JITSI_SECRET;
  if (env.NODE_ENV === 'production' && (secret === DEV_JITSI_SECRET || secret.length < 32)) {
    throw new Error('set JITSI_SECRET (at least 32 characters) in production');
  }
  const minutes = (name: string, fallback: number, max: number) => {
    const n = Number(env[name] ?? fallback);
    if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`${name} must be an integer from 1 to ${max}`);
    return n;
  };
  return {
    jitsiDomain: env.JITSI_DOMAIN ?? 'meet.localhost',
    jitsiAppId: env.JITSI_APP_ID ?? 'hms',
    jitsiAudience: env.JITSI_AUDIENCE ?? 'jitsi',
    jitsiSecret: secret,
    tokenMinutes: minutes('JITSI_TOKEN_MINUTES', 5, 60),
    joinEarlyMinutes: minutes('TELE_JOIN_EARLY_MINUTES', 15, 120),
    joinLateMinutes: minutes('TELE_JOIN_LATE_MINUTES', 60, 240),
    patientLinkBase: env.TELE_PATIENT_LINK_BASE ?? 'http://localhost:5173/video-consult',
  };
}

export const DEV_ISSUER = 'local-dev';
export const DEV_SECRET_DEFAULT = 'local-dev-secret-change-me-0123456789abcdef';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const mode = env.AUTH_MODE ?? 'dev';
  let auth: AuthConfig;
  if (mode === 'oidc') {
    const { OIDC_ISSUER, OIDC_JWKS_URL, OIDC_AUDIENCE } = env;
    if (!OIDC_ISSUER || !OIDC_JWKS_URL || !OIDC_AUDIENCE) throw new Error('AUTH_MODE=oidc needs OIDC_ISSUER, OIDC_JWKS_URL and OIDC_AUDIENCE');
    auth = { mode: 'oidc', issuer: OIDC_ISSUER, jwksUrl: OIDC_JWKS_URL, audience: OIDC_AUDIENCE };
  } else if (mode === 'dev') {
    if (env.NODE_ENV === 'production') throw new Error('AUTH_MODE=dev is not allowed when NODE_ENV=production');
    auth = { mode: 'dev', secret: env.DEV_JWT_SECRET ?? DEV_SECRET_DEFAULT, issuer: DEV_ISSUER };
  } else {
    throw new Error(`unknown AUTH_MODE ${mode}`);
  }
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '127.0.0.1',
    databaseUrl: dbConfig.appDatabaseUrl,
    auth,
    allowClockOverride: env.ALLOW_CLOCK_OVERRIDE === '1' && env.NODE_ENV !== 'production',
    // Default: the Vite dev server used by hospital-webpage.
    telehealth: loadTelehealthSettings(env),
    publicTenantId: env.PUBLIC_TENANT_ID,
    voice: loadVoiceRuntimeSettings(env),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((o) => o.trim()).filter(Boolean),
  };
}
