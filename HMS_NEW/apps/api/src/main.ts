// Starts the API: pnpm api:dev (local) or `pnpm --filter @hms/api start`.
import { createDb } from '@hms/db';
import fastifyStatic from '@fastify/static';
import { signDevToken } from './auth/dev-token.ts';
import { createVerifier } from './auth/verify.ts';
import { loadConfig } from './config.ts';
import { buildServer } from './server.ts';
import path from 'node:path';

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
  ...(config.auth.mode === 'dev' ? { devLogin: (subject: string, email?: string) => signDevToken(subject, { secret: (config.auth as { secret: string }).secret, email: email ?? '' }) } : {}),
});

// The tenant runtime image serves the already-built staff and platform web applications from the
// same origin as the API. Development keeps Vite's proxy and HMR instead.
if (process.env.SERVE_WEB_ASSETS === '1') {
  const root = process.cwd();
  const publicRoot = path.join(root, 'apps/public-web/dist');
  const staffRoot = path.join(root, 'apps/staff-web/dist');
  await app.register(fastifyStatic, {
    root: publicRoot,
    prefix: '/',
    wildcard: false,
    cacheControl: true,
    maxAge: '1h',
    immutable: false,
  });
  await app.register(fastifyStatic, {
    root: staffRoot,
    prefix: '/staff/',
    wildcard: false,
    decorateReply: false,
    cacheControl: true,
    maxAge: '1h',
    immutable: false,
  });
  app.get('/staff/*', async (_request, reply) => reply.sendFile('index.html', staffRoot));
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
