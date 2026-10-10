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
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((o) => o.trim()).filter(Boolean),
  };
}
