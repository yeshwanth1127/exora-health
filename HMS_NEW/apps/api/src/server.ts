// HTTP API (Fastify). Every /v1 route requires a bearer token; the principal is resolved per request
// and each route checks its permission (for the facility involved) before running a command.
import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql, type DB, type Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { resolvePrincipal } from './auth/principal.ts';
import { AuthenticationError, type TokenVerifier } from './auth/verify.ts';
import { parse, sendError } from './http/support.ts';
import { registerClinicalRoutes } from './http/routes/clinical.ts';
import { registerBookingRoutes } from './http/routes/booking.ts';
import { registerCalendarRoutes } from './http/routes/calendar.ts';
import { registerDirectoryRoutes } from './http/routes/directory.ts';
import { registerPatientRoutes } from './http/routes/patients.ts';
import { registerQueueRoutes } from './http/routes/queue.ts';
import { registerTelehealthRoutes, TELE_TOKEN_HEADER } from './http/routes/telehealth.ts';
import { loadTelehealthSettings, type TelehealthSettings } from './config.ts';

export interface ServerDeps {
  db: Kysely<DB>;
  verifier: TokenVerifier;
  /** Tests only: honour the X-Test-Now header to pin the clock. */
  allowClockOverride?: boolean;
  logger?: boolean;
  /** Browser origins allowed to call the API (CORS), e.g. ['http://localhost:5173']. */
  corsOrigins?: string[];
  /**
   * Development only: enables POST /dev/login, which signs a token for a seeded identity so a local
   * front-end can sign in without an identity provider. Never set in production.
   */
  devLogin?: (subject: string) => Promise<string>;
  /** Virtual OPD settings (Jitsi signing, join window); defaults to the environment's. */
  telehealth?: TelehealthSettings;
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
  void app.register(cors, {
    origin: deps.corsOrigins ?? false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type', 'idempotency-key', 'x-request-id', 'x-tenant-id', TELE_TOKEN_HEADER],
    exposedHeaders: ['x-request-id'],
    maxAge: 600,
  });
  app.decorateRequest('principal', null);
  app.decorateRequest('clockOverride', undefined);

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.addHook('onRequest', async (request) => {
    if (deps.allowClockOverride && request.url.startsWith('/tele/v1/')) {
      const now = request.headers['x-test-now'];
      if (typeof now === 'string') request.clockOverride = new Date(now);
    }
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

  if (deps.devLogin) {
    const devLogin = deps.devLogin;
    app.post('/dev/login', async (request) => {
      const { subject } = parse(z.object({ subject: z.string().trim().min(1).max(100) }), request.body);
      // The token is only useful if the subject has an account; /v1/me will say who it is.
      return { token: await devLogin(subject), tokenType: 'Bearer', note: 'development login — disabled outside AUTH_MODE=dev' };
    });
  }

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
  registerClinicalRoutes(app, deps.db);
  registerTelehealthRoutes(app, deps.db, deps.telehealth ?? loadTelehealthSettings());
  return app;
}

export { REQUEST_ID };
