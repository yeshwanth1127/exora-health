// HTTP API (Fastify). Every /v1 route requires a bearer token; the principal is resolved per request
// and each route checks its permission (for the facility involved) before running a command.
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { sql, type DB, type Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { resolvePrincipal } from './auth/principal.ts';
import { AuthenticationError, type TokenVerifier } from './auth/verify.ts';
import { sendError } from './http/support.ts';
import { registerBookingRoutes } from './http/routes/booking.ts';
import { registerCalendarRoutes } from './http/routes/calendar.ts';
import { registerDirectoryRoutes } from './http/routes/directory.ts';
import { registerPatientRoutes } from './http/routes/patients.ts';
import { registerQueueRoutes } from './http/routes/queue.ts';

export interface ServerDeps {
  db: Kysely<DB>;
  verifier: TokenVerifier;
  /** Tests only: honour the X-Test-Now header to pin the clock. */
  allowClockOverride?: boolean;
  logger?: boolean;
}

const REQUEST_ID = /^[A-Za-z0-9_.:-]{8,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({
    logger: deps.logger ?? false,
    // Use the caller's X-Request-Id when it's sane, else a fresh UUID; it is recorded on audit/outbox rows.
    genReqId: (req) => {
      const header = req.headers['x-request-id'];
      return typeof header === 'string' && UUID.test(header) ? header : randomUUID();
    },
    bodyLimit: 256 * 1024,
  });
  app.decorateRequest('principal', null);
  app.decorateRequest('clockOverride', undefined);

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.addHook('onRequest', async (request) => {
    if (!request.url.startsWith('/v1/')) return;
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AuthenticationError('missing bearer token');
    const identity = await deps.verifier(header.slice('Bearer '.length).trim());
    const tenantHeader = request.headers['x-tenant-id'];
    if (tenantHeader !== undefined && (typeof tenantHeader !== 'string' || !UUID.test(tenantHeader))) {
      throw new DomainError('validation', 'X-Tenant-Id must be a UUID');
    }
    request.principal = await resolvePrincipal(deps.db, identity, tenantHeader);
    if (deps.allowClockOverride) {
      const now = request.headers['x-test-now'];
      if (typeof now === 'string') request.clockOverride = new Date(now);
    }
  });

  app.setErrorHandler((err, request, reply) => sendError(request, reply, err));
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({ error: { code: 'route_not_found', message: `${request.method} ${request.url} does not exist` }, requestId: request.id }),
  );

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (_request, reply) => {
    try {
      await sql`SELECT 1`.execute(deps.db);
      return { status: 'ready' };
    } catch {
      return reply.status(503).send({ status: 'database unavailable' });
    }
  });

  app.get('/v1/me', async (request) => {
    const p = request.principal!;
    return {
      tenantId: p.tenantId,
      staffId: p.staffId,
      displayName: p.displayName,
      staffType: p.staffType,
      isSystemAccount: p.isSystemAccount,
      permissions: Object.fromEntries([...p.grants].map(([perm, scopes]) => [perm, [...scopes].map((s) => s ?? '*')])),
    };
  });

  registerDirectoryRoutes(app, deps.db);
  registerPatientRoutes(app, deps.db);
  registerCalendarRoutes(app, deps.db);
  registerBookingRoutes(app, deps.db);
  registerQueueRoutes(app, deps.db);
  return app;
}

export { REQUEST_ID };
