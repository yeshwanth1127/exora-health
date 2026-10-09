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
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((o) => o.trim()).filter(Boolean),
  };
}
