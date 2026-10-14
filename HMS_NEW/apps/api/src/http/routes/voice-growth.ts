import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { sql, type DB, type Kysely } from "@hms/db";
import { DomainError, invalid, runQuery } from "@hms/platform";
import {
  BookingLinkInputSchema,
  VoiceEventSchema,
  GrowthQuerySchema,
  WebsiteActivitySchema,
} from "@hms/contracts";
import { authorize, grantedFacilities } from "../../auth/principal.ts";
import { AuthenticationError } from "../../auth/verify.ts";
import {
  callerOf,
  idempotencyKey,
  parse,
  principalOf,
  uuid,
} from "../support.ts";
import {
  bookingLinks,
  saveBookingLink,
  bookingLinkChanges,
  growthSummary,
  websiteActivity,
  voiceHistory,
  ingestVoice,
  voiceFacility,
  voiceAccess,
  recordingBytes,
  validVoiceSecret,
  voiceRuntimeForRequest,
  type ChannelSettings,
} from "../../modules/comms/voice-growth.ts";

export function registerVoiceGrowthRoutes(
  app: FastifyInstance,
  db: Kysely<DB>,
  settings: ChannelSettings,
) {
  const facilityQuery = z.object({ facilityId: uuid });
  app.get("/v1/booking-links", async (request) => {
    const { facilityId } = parse(facilityQuery, request.query);
    authorize(principalOf(request), "growth.read", facilityId);
    return bookingLinks(db, callerOf(request), facilityId);
  });
  app.put("/v1/facilities/:id/booking-link", async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    authorize(principalOf(request), "growth.manage", id);
    return saveBookingLink(
      db,
      callerOf(request),
      id,
      parse(BookingLinkInputSchema, request.body),
      idempotencyKey(request),
      settings,
    );
  });
  app.get("/v1/booking-links/changes", async (request) => {
    const { facilityId } = parse(facilityQuery, request.query);
    authorize(principalOf(request), "growth.read", facilityId);
    return bookingLinkChanges(db, callerOf(request), facilityId);
  });
  app.get("/v1/growth/capabilities", async (request) => {
    const { facilityId } = parse(facilityQuery, request.query);
    authorize(principalOf(request), "growth.read", facilityId);
    return {
      items: [
        {
          title: "Manual booking link",
          state: settings.bookingHosts?.length ? "available" : "not_connected",
          description: settings.bookingHosts?.length
            ? "Save an approved HTTPS booking destination with clinic scope and change history. Publishing to Google is manual."
            : "Configure approved booking destination hosts before saving a link. Publishing to Google is manual.",
          reference: "Local clinic booking-link registry",
        },
        {
          title: "Google profile publishing",
          state: "not_connected",
          description:
            "Google OAuth/profile management is outside this release.",
          reference: "Google Business Profile",
        },
        {
          title: "Acquisition attribution",
          state: "not_connected",
          description:
            "Booking channels are known; acquisition source is not tracked.",
          reference: "Persisted appointment channels",
        },
      ],
    };
  });
  app.get("/v1/growth/summary", async (request) => {
    const q = parse(GrowthQuerySchema, request.query);
    authorize(principalOf(request), "growth.read", q.facilityId);
    return growthSummary(db, callerOf(request), q);
  });
  app.get("/v1/growth/website-activity", async (request) => {
    const q = parse(
      z.object({
        facilityId: uuid,
        from: z.iso.date(),
        to: z.iso.date(),
        traffic: z.enum(["production", "demo"]).default("production"),
      }),
      request.query,
    );
    parse(GrowthQuerySchema, { ...q, cohort: "created" });
    authorize(principalOf(request), "growth.read", q.facilityId);
    const timezone = await runQuery(
      db,
      callerOf(request).tenantId,
      async (tx) =>
        (
          await tx
            .selectFrom("platform.facility")
            .select("timezone")
            .where("id", "=", q.facilityId)
            .executeTakeFirstOrThrow()
        ).timezone,
    );
    return WebsiteActivitySchema.parse(
      await websiteActivity(callerOf(request), q, timezone, settings),
    );
  });
  app.post("/integrations/voice/events", async (request, reply) => {
    const binding = voiceRuntimeForRequest(settings, request.headers['x-voice-account']);
    if (!binding)
      return reply
        .status(503)
        .send({
          error: {
            code: "not_configured",
            message: "Voice runtime ingestion is not configured",
          },
        });
    const scopedSettings = { ...settings, voice: binding };
    if (!validVoiceSecret(scopedSettings, request.headers["x-voice-secret"]))
      throw new AuthenticationError("invalid runtime authentication");
    const event = parse(VoiceEventSchema, request.body);
    if (settings.voiceBindings !== undefined && event.agentVersion !== binding.agentVersion)
      throw invalid('runtime agent version must match the configured deployment');
    return ingestVoice(db, event, scopedSettings);
  });
  app.get("/v1/voice-calls", async (request) => {
    const q = parse(
      z.object({
        facilityId: uuid,
        offset: z.coerce.number().int().min(0).max(100000).default(0),
      }),
      request.query,
    );
    authorize(principalOf(request), "voice.read", q.facilityId);
    return voiceHistory(
      db,
      callerOf(request),
      q.facilityId,
      q.offset,
      settings,
    );
  });
  for (const kind of ["recording", "transcript"] as const)
    app.get(`/v1/voice-calls/:id/${kind}`, async (request, reply) => {
      const { id } = parse(z.object({ id: uuid }), request.params),
        caller = callerOf(request),
        facilityId = await voiceFacility(db, caller, id);
      const permission =
        kind === "recording" ? "voice.recordings.read" : "voice.read";
      const scopes = grantedFacilities(principalOf(request), permission);
      const allowed = scopes === null || scopes.has(facilityId);
      const result = await voiceAccess(db, caller, id, kind, allowed, settings);
      if (!allowed) authorize(principalOf(request), permission, facilityId);
      if (result.outcome !== "allowed")
        throw new DomainError(
          "precondition_failed",
          "Voice review is unavailable",
          { reason: result.outcome },
        );
      reply
        .header("cache-control", "no-store")
        .header("x-content-type-options", "nosniff");
      if (kind === "transcript") return result.transcript;
      const { mime, bytes } = await recordingBytes(
        result.recordingUrl!,
        settings,
      );
      return reply.type(mime).send(bytes);
    });
  app.get("/v1/voice-recording-access", async (request) => {
    const { facilityId } = parse(facilityQuery, request.query);
    authorize(principalOf(request), "voice.recordings.read", facilityId);
    return runQuery(db, callerOf(request).tenantId, async (tx) => {
      const { rows } = await sql<{
        id: string;
        call_id: string;
        display_name: string;
        outcome: string;
        created_at: Date;
        kind: string;
      }>`SELECT a.*,s.display_name FROM comms.voice_recording_access a JOIN comms.voice_call c ON c.id=a.call_id AND c.tenant_id=a.tenant_id JOIN platform.staff s ON s.id=a.actor_staff_id AND s.tenant_id=a.tenant_id WHERE c.facility_id=${facilityId} ORDER BY a.created_at DESC,a.id DESC LIMIT 100`.execute(
        tx,
      );
      return {
        items: rows.map((r) => ({
          id: r.id,
          callId: r.call_id,
          actor: r.display_name,
          outcome: `${r.kind}_${r.outcome}`,
          createdAt: r.created_at.toISOString(),
        })),
      };
    });
  });
}
