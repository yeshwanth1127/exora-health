// Starts the API: pnpm api:dev (local) or `pnpm --filter @hms/api start`.
import { createDb } from '@hms/db';
import { registerTenantWebAssets } from './web-assets.ts';
import { loadPublicBookingConfig } from './modules/booking/public-config.ts';
import { signDevToken } from './auth/dev-token.ts';
import { createVerifier } from './auth/verify.ts';
import { loadConfig } from './config.ts';
import { buildServer } from './server.ts';

const config = loadConfig();
const db = createDb({ connectionString: config.databaseUrl, maxConnections: 20 });
const app = buildServer({
  db,
  verifier: createVerifier(config.auth),
  allowClockOverride: config.allowClockOverride,
  logger: true,
  corsOrigins: config.corsOrigins,
  telehealth: config.telehealth,
  publicTenantId: config.publicTenantId,
  voice: config.voice,
  voiceControl: config.voiceControl,
  ...(config.auth.mode === 'dev' ? { devLogin: (subject: string, email?: string) => signDevToken(subject, { secret: (config.auth as { secret: string }).secret, email: email ?? '' }) } : {}),
});

// The tenant runtime image serves the already-built staff and platform web applications from the
// same origin as the API. Development keeps Vite's proxy and HMR instead.
if (process.env.SERVE_WEB_ASSETS === '1') {
  const root = process.cwd();
  const bookingSite = loadPublicBookingConfig().sites.find(site => site.tenantId === config.publicTenantId)?.siteSlug;
  await registerTenantWebAssets(app, { root, template: process.env.WEBSITE_TEMPLATE, bookingSite });
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await db.destroy();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: config.port, host: config.host });
app.log.info(`auth mode: ${config.auth.mode}`);
