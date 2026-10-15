import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { sql, type DB, type Kysely } from "@hms/db";
import { notFound, runCommand } from "@hms/platform";
import { authorize } from "../../auth/principal.ts";
import {
  callerOf,
  principalOf,
  parse,
  idempotencyKey,
  uuid,
} from "../support.ts";
import { type ManagedSettings } from "../../modules/comms/managed-config.ts";
import {
  addAnalyticsSite,
  analyticsDashboard,
  AnalyticsEvent,
  AnalyticsSiteInput,
  collectAnalytics,
  removeAnalyticsSite,
  trackerScript,
} from "../../modules/comms/managed-analytics.ts";
import {
  googlePerformance,
  googleAction,
  GoogleAction,
  googleCallback,
  googleDashboard,
  googleLocations,
  selectGoogleLocation,
  startGoogle,
} from "../../modules/comms/managed-google.ts";
import { registerManagedWhatsAppRoutes } from "./managed-whatsapp.ts";

export function registerManagedIntegrationRoutes(
  app: FastifyInstance,
  db: Kysely<DB>,
  settings: ManagedSettings,
) {
  const scope = z.strictObject({ facilityId: uuid });
  app.get("/v1/website-analytics", async (request) => {
    const q = parse(
      scope.extend({
        days: z.coerce
          .number()
          .pipe(z.union([z.literal(7), z.literal(30), z.literal(90)]))
          .default(30),
      }),
      request.query,
    );
    authorize(principalOf(request), "growth.read", q.facilityId);
    return analyticsDashboard(
      db,
      callerOf(request),
      q.facilityId,
      q.days,
      settings,
    );
  });
  app.post("/v1/website-analytics/sites", async (request) => {
    const input = parse(AnalyticsSiteInput, request.body);
    authorize(principalOf(request), "growth.manage", input.facilityId);
    return addAnalyticsSite(
      db,
      callerOf(request),
      input,
      idempotencyKey(request),
      settings,
    );
  });
  app.delete("/v1/website-analytics/sites/:id", async (request) => {
    const { facilityId } = parse(scope, request.query),
      { id } = parse(z.strictObject({ id: uuid }), request.params);
    authorize(principalOf(request), "growth.manage", facilityId);
    return removeAnalyticsSite(
      db,
      callerOf(request),
      facilityId,
      id,
      idempotencyKey(request),
    );
  });
  app.get("/a.js", async (_request, reply) =>
    reply
      .type("application/javascript")
      .header("cache-control", "public, max-age=300")
      .header("x-content-type-options", "nosniff")
      .send(trackerScript),
  );
  const limits = new Map<string, { at: number; n: number }>();
  app.post("/a/collect", { bodyLimit: 2048 }, async (request, reply) => {
    const now = Date.now(),
      old = limits.get(request.ip);
    if (old && now - old.at < 60000) {
      if (++old.n > 120) return reply.code(429).send({ accepted: false });
    } else {
      if (limits.size > 10000) limits.clear();
      limits.set(request.ip, { at: now, n: 1 });
    }
    reply.header("cache-control", "no-store");
    if (request.headers["sec-gpc"] === "1" || request.headers.dnt === "1")
      return { accepted: false };
    let body = request.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return reply.code(400).send({ accepted: false });
      }
    }
    return collectAnalytics(
      db,
      parse(AnalyticsEvent, body),
      request.headers.origin ?? "",
      request.ip,
      request.headers["user-agent"] ?? "",
      settings,
    );
  });
  app.get("/v1/google-business", async (request) => {
    const { facilityId } = parse(scope, request.query);
    authorize(principalOf(request), "growth.read", facilityId);
    return googleDashboard(db, callerOf(request), facilityId, settings);
  });
  app.get("/v1/google-business/performance", async (request) => {
    const { facilityId } = parse(scope, request.query);
    authorize(principalOf(request), "growth.read", facilityId);
    return googlePerformance(db, callerOf(request), facilityId, settings);
  });
  app.post("/v1/google-business/connect", async (request, reply) => {
    const { facilityId } = parse(scope, request.body);
    authorize(principalOf(request), "growth.manage", facilityId);
    const result = await startGoogle(
      db,
      callerOf(request),
      facilityId,
      idempotencyKey(request),
      settings,
    );
    const secure = settings.publicOrigin?.startsWith("https:")
      ? "; Secure"
      : "";
    reply
      .header(
        "set-cookie",
        `hms_google_state=${result.state}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/integrations/google/callback${secure}`,
      )
      .header("cache-control", "no-store");
    return { authorizationUrl: result.authorizationUrl };
  });
  app.get("/integrations/google/callback", async (request, reply) => {
    reply
      .header("cache-control", "no-store")
      .header("referrer-policy", "no-referrer");
    let result = "failed",
      facilityId = "";
    try {
      const q = parse(
        z.object({
          state: z.string().min(1).max(100),
          code: z.string().min(1).max(4096),
        }),
        request.query,
      );
      const cookie = request.headers.cookie
        ?.split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith("hms_google_state="))
        ?.slice("hms_google_state=".length);
      const done = await googleCallback(db, q.state, q.code, cookie, settings);
      facilityId = done.facilityId;
      result = "choose";
    } catch {
      /* Errors never include provider responses or callback parameters. */
    }
    reply.header(
      "set-cookie",
      `hms_google_state=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/integrations/google/callback${settings.publicOrigin?.startsWith("https:") ? "; Secure" : ""}`,
    );
    if (!settings.publicOrigin)
      return reply.code(422).send({ connected: false });
    return reply.redirect(
      `${settings.publicOrigin}/staff/google_business?google=${result}${facilityId ? `&facility=${facilityId}` : ""}`,
    );
  });
  app.get("/v1/google-business/locations", async (request) => {
    const { facilityId } = parse(scope, request.query);
    authorize(principalOf(request), "growth.manage", facilityId);
    return googleLocations(db, callerOf(request), facilityId, settings);
  });
  app.post("/v1/google-business/location", async (request) => {
    const q = parse(
      scope.extend({ locationId: z.string().max(150) }),
      request.body,
    );
    authorize(principalOf(request), "growth.manage", q.facilityId);
    return selectGoogleLocation(
      db,
      callerOf(request),
      q.facilityId,
      q.locationId,
      idempotencyKey(request),
      settings,
    );
  });
  app.post("/v1/google-business/actions", async (request) => {
    const { facilityId } = parse(scope, request.query);
    authorize(principalOf(request), "growth.manage", facilityId);
    return googleAction(
      db,
      callerOf(request),
      facilityId,
      parse(GoogleAction, request.body),
      idempotencyKey(request),
      settings,
    );
  });
  app.delete("/v1/managed-connections/:provider", async (request) => {
    const { provider } = parse(
        z.strictObject({ provider: z.enum(["google", "whatsapp"]) }),
        request.params,
      ),
      { facilityId } = parse(scope, request.query);
    authorize(
      principalOf(request),
      provider === "google" ? "growth.manage" : "comms.manage",
      facilityId,
    );
    return runCommand(
      db,
      {
        ...callerOf(request),
        module: "comms",
        name: "comms.managed_disconnect",
        request: { facilityId, provider },
        idempotencyKey: idempotencyKey(request),
      },
      async (ctx) => {
        const {
          rows: [r],
        } = await sql<{
          id: string;
        }>`UPDATE comms.managed_connection SET enabled=false,credential='',metadata='{}'::jsonb WHERE facility_id=${facilityId} AND provider=${provider} AND enabled RETURNING id`.execute(
          ctx.tx,
        );
        if (!r) throw notFound("connection");
        await sql`UPDATE comms.integration_attempt SET status='failed',credential=NULL,verifier='' WHERE facility_id=${facilityId} AND provider=${provider} AND status IN ('pending','exchanging','ready')`.execute(
          ctx.tx,
        );
        if (provider === "whatsapp")
          await sql`UPDATE comms.outbound_message SET status='cancelled' WHERE facility_id=${facilityId} AND managed_send_requested AND status='queued'`.execute(
            ctx.tx,
          );
        ctx.audit({
          action: "update",
          subjectType: "comms.managed_connection",
          subjectId: r.id,
          diff: { state: "disconnected", provider },
        });
        return { disconnected: true };
      },
    );
  });
  registerManagedWhatsAppRoutes(app, db, settings);
}
