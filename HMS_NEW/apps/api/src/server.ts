// HTTP API (Fastify). Every /v1 route requires a bearer token; the principal is resolved per request
// and each route checks its permission (for the facility involved) before running a command.
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { z } from "zod";
import { sql, type DB, type Kysely } from "@hms/db";
import { DomainError } from "@hms/platform";
import { resolvePrincipal } from "./auth/principal.ts";
import { AuthenticationError, type TokenVerifier } from "./auth/verify.ts";
import { parse, sendError } from "./http/support.ts";
import { registerClinicalRoutes } from "./http/routes/clinical.ts";
import { registerPublicBookingRoutes } from "./http/routes/public-booking.ts";
import {
  loadPublicBookingConfig,
  type PublicBookingConfig,
} from "./modules/booking/public-config.ts";
import { registerBookingRoutes } from "./http/routes/booking.ts";
import { registerCalendarRoutes } from "./http/routes/calendar.ts";
import { registerManagedIntegrationRoutes } from "./http/routes/managed-integrations.ts";
import {
  loadManagedSettings,
  type ManagedSettings,
} from "./modules/comms/managed-config.ts";
import { registerChannelOnboardingRoutes } from "./http/routes/channel-onboarding.ts";
import { parseWhatsAppProviderConfig } from "./modules/comms/whatsapp-provider-config.ts";
import { registerCommsRoutes } from "./http/routes/comms.ts";
import { registerCommsSummaryRoutes } from "./http/routes/comms-summary.ts";
import { registerVoiceGrowthRoutes } from "./http/routes/voice-growth.ts";
import {
  loadChannelSettings,
  type ChannelSettings,
} from "./modules/comms/voice-growth.ts";
import { registerAccessRoutes } from "./http/routes/access.ts";
import { registerAdminRoutes } from "./http/routes/admin.ts";
import { registerBoardRoutes } from "./http/routes/board.ts";
import { registerRecordRoutes } from "./http/routes/records.ts";
import { registerRegistryRoutes } from "./http/routes/registry.ts";
import { registerDirectoryRoutes } from "./http/routes/directory.ts";
import { registerPatientRoutes } from "./http/routes/patients.ts";
import { registerQueueRoutes } from "./http/routes/queue.ts";
import {
  registerTelehealthRoutes,
  TELE_TOKEN_HEADER,
} from "./http/routes/telehealth.ts";
import { loadTelehealthSettings, type TelehealthSettings } from "./config.ts";

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
  devLogin?: (subject: string, email?: string) => Promise<string>;
  /** Virtual OPD settings (Jitsi signing, join window); defaults to the environment's. */
  telehealth?: TelehealthSettings;
  channels?: ChannelSettings;
  managed?: ManagedSettings;
  /** Server-only HTTP transport injection; production defaults to native fetch. */
  whatsappTemplateFetcher?: typeof fetch;
  /** Server-owned website bindings; absence loads disabled-by-default environment configuration. */
  publicBooking?: PublicBookingConfig;
}

const REQUEST_ID = /^[A-Za-z0-9_.:-]{8,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RouteEntry {
  method: string;
  url: string;
}
const routeTables = new WeakMap<FastifyInstance, RouteEntry[]>();
/** Every route the server registered (method and pattern), e.g. for the frontend coverage test. */
export const routesOf = (app: FastifyInstance): readonly RouteEntry[] =>
  routeTables.get(app) ?? [];

export function buildServer(deps: ServerDeps): FastifyInstance {
  // Configuration mistakes fail before listening, without leaking credential values.
  parseWhatsAppProviderConfig();
  const publicBooking = deps.publicBooking ?? loadPublicBookingConfig();
  const managed = { ...(deps.managed ?? loadManagedSettings()), booking: publicBooking };
  const trustedProxies = (process.env.TRUSTED_PROXY_CIDRS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  for (const value of trustedProxies) {
    const [address, prefix, ...extra] = value.split("/"),
      version = isIP(address ?? "");
    if (
      !version ||
      extra.length ||
      (prefix !== undefined &&
        (!/^\d+$/.test(prefix) ||
          Number(prefix) < 1 ||
          Number(prefix) > (version === 4 ? 32 : 128)))
    )
      throw Error(
        "TRUSTED_PROXY_CIDRS must contain explicit trusted IPs or bounded CIDRs, never a wildcard",
      );
  }
  const app = Fastify({
    trustProxy: trustedProxies.length ? trustedProxies : false,
    // Query strings carry patient search terms (names, phones), so request logs keep the path only.
    logger: deps.logger
      ? {
          serializers: {
            req: (req) => ({
              method: req.method,
              url: req.url.split("?")[0],
              reqId: req.id,
              remoteAddress: req.ip,
            }),
          },
        }
      : false,
    // Use the caller's X-Request-Id when it's sane, else a fresh UUID; it is recorded on audit/outbox rows.
    genReqId: (req) => {
      const header = req.headers["x-request-id"];
      return typeof header === "string" && UUID.test(header)
        ? header
        : randomUUID();
    },
    bodyLimit: 256 * 1024,
  });
  void app.register(cors, {
    delegator: async (request: FastifyRequest) => {
      if (request.url.split("?")[0] === "/a/collect")
        return {
          origin: true,
          methods: ["POST", "OPTIONS"],
          allowedHeaders: ["content-type"],
          maxAge: 600,
        };
      const match = /^\/public\/v1\/booking\/([a-z0-9-]+)\//.exec(request.url);
      if (match)
        return {
          origin:
            publicBooking.sites.find((s) => s.siteSlug === match[1])?.origins ??
            false,
          methods: ["GET", "POST", "OPTIONS"],
          allowedHeaders: ["content-type", "idempotency-key"],
          exposedHeaders: ["x-request-id"],
          maxAge: 600,
          preflightContinue: true,
        };
      return {
        origin: deps.corsOrigins ?? false,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: [
          "authorization",
          "content-type",
          "idempotency-key",
          "x-request-id",
          "x-tenant-id",
          TELE_TOKEN_HEADER,
        ],
        exposedHeaders: ["x-request-id"],
        maxAge: 600,
      };
    },
  });
  app.decorateRequest("principal", null);
  app.decorateRequest("clockOverride", undefined);
  const table: RouteEntry[] = [];
  routeTables.set(app, table);
  app.addHook("onRoute", (route) => {
    for (const method of [route.method].flat())
      if (method !== "HEAD") table.push({ method, url: route.url });
  });

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
    if (
      /^\/v1\/(website-analytics|google-business|whatsapp-workspace|managed-connections)([/?]|$)/.test(
        request.url,
      )
    )
      reply
        .header("cache-control", "private, no-store")
        .header("referrer-policy", "no-referrer");
  });

  app.addHook("onRequest", async (request) => {
    // This exact provider endpoint verifies its own challenge/HMAC in the encapsulated router.
    if (
      request.url.split("?")[0] === "/v1/integrations/whatsapp/webhook" &&
      ["GET", "POST"].includes(request.method)
    )
      return;
    if (deps.allowClockOverride && request.url.startsWith("/tele/v1/")) {
      const now = request.headers["x-test-now"];
      if (typeof now === "string") request.clockOverride = new Date(now);
    }
    if (!request.url.startsWith("/v1/")) return;
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new AuthenticationError("missing bearer token");
    const identity = await deps.verifier(header.slice("Bearer ".length).trim());
    const tenantHeader = request.headers["x-tenant-id"];
    if (
      tenantHeader !== undefined &&
      (typeof tenantHeader !== "string" || !UUID.test(tenantHeader))
    ) {
      throw new DomainError("validation", "X-Tenant-Id must be a UUID");
    }
    request.principal = await resolvePrincipal(deps.db, identity, tenantHeader);
    if (deps.allowClockOverride) {
      const now = request.headers["x-test-now"];
      if (typeof now === "string") request.clockOverride = new Date(now);
    }
  });

  app.setErrorHandler((err, request, reply) => sendError(request, reply, err));
  app.setNotFoundHandler((request, reply) =>
    reply
      .status(404)
      .send({
        error: {
          code: "route_not_found",
          message: `${request.method} ${request.url} does not exist`,
        },
        requestId: request.id,
      }),
  );

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (_request, reply) => {
    try {
      await sql`SELECT 1`.execute(deps.db);
      return { status: "ready" };
    } catch {
      return reply.status(503).send({ status: "database unavailable" });
    }
  });

  if (deps.devLogin) {
    const devLogin = deps.devLogin;
    app.post("/dev/login", async (request) => {
      const { subject, email } = parse(
        z.object({
          subject: z.string().trim().min(1).max(100),
          email: z.email().optional(),
        }),
        request.body,
      );
      // The token is only useful if the subject has an account (or `email` has an open staff invite); /v1/me says who it is.
      return {
        token: await devLogin(subject, email),
        tokenType: "Bearer",
        note: "development login — disabled outside AUTH_MODE=dev",
      };
    });
  }

  app.get("/v1/me", async (request) => {
    const p = request.principal!;
    return {
      tenantId: p.tenantId,
      staffId: p.staffId,
      displayName: p.displayName,
      staffType: p.staffType,
      isSystemAccount: p.isSystemAccount,
      permissions: Object.fromEntries(
        [...p.grants].map(([perm, scopes]) => [
          perm,
          [...scopes].map((s) => s ?? "*"),
        ]),
      ),
    };
  });

  registerCommsRoutes(app, deps.db, {
    templateFetcher: deps.whatsappTemplateFetcher,
    managed,
  });
  registerChannelOnboardingRoutes(app, deps.db);
  registerManagedIntegrationRoutes(app, deps.db, managed);
  registerCommsSummaryRoutes(app, deps.db);
  registerVoiceGrowthRoutes(
    app,
    deps.db,
    deps.channels ?? loadChannelSettings(),
  );
  registerAccessRoutes(app, deps.db);
  registerDirectoryRoutes(app, deps.db);
  registerPatientRoutes(app, deps.db);
  registerCalendarRoutes(app, deps.db);
  registerBookingRoutes(app, deps.db);
  registerPublicBookingRoutes(app, deps.db, publicBooking, managed);
  registerQueueRoutes(app, deps.db);
  registerClinicalRoutes(app, deps.db);
  registerAdminRoutes(app, deps.db);
  registerRegistryRoutes(app, deps.db);
  registerRecordRoutes(app, deps.db);
  registerBoardRoutes(app, deps.db);
  registerTelehealthRoutes(
    app,
    deps.db,
    deps.telehealth ?? loadTelehealthSettings(),
  );
  return app;
}

export { REQUEST_ID };
