// Starts the API: pnpm api:dev (local) or `pnpm --filter @hms/api start`.
import { createDb } from '@hms/db';
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
  ...(config.auth.mode === 'dev' ? { devLogin: (subject: string) => signDevToken(subject, { secret: (config.auth as { secret: string }).secret }) } : {}),
});

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
