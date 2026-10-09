// Starts the API: pnpm api:dev (local) or `pnpm --filter @hms/api start`.
import { createDb } from '@hms/db';
import { createVerifier } from './auth/verify.ts';
import { loadConfig } from './config.ts';
import { buildServer } from './server.ts';

const config = loadConfig();
const db = createDb({ connectionString: config.databaseUrl, maxConnections: 20 });
const app = buildServer({ db, verifier: createVerifier(config.auth), allowClockOverride: config.allowClockOverride, logger: true });

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
