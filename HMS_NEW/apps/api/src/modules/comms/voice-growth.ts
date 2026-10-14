import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { sql, type DB, type Kysely } from "@hms/db";
import {
  conflict,
  invalid,
  notFound,
  preconditionFailed,
  runCommand,
  runQuery,
} from "@hms/platform";
import {
  BookingLinkSchema,
  GrowthSummarySchema,
  VoiceHistorySchema,
  VoiceTranscriptSchema,
  type VoiceEvent,
} from "@hms/contracts";
import type { Caller } from "../../caller.ts";
import { clock } from "../../caller.ts";
import { moduleState } from "./notifications.ts";
import { parseVoiceProviderConfig } from './voice-provider-config.ts';

export type VoiceRuntimeBinding = {
  tenantId: string; facilityId: string; accountId: string; secret: string; agentVersion: number | null;
};

export interface ChannelSettings {
  voice?: VoiceRuntimeBinding;
  /** Explicit registry: even an empty list disables the legacy callback. Server-only secrets. */
  voiceBindings?: VoiceRuntimeBinding[];
  recordingHosts: string[];
  bookingHosts?: string[];
  posthog?: {
    tenantId: string;
    facilityId: string;
    host: string;
    project: string;
    key: string;
  };
  fetcher: typeof fetch;
}
export function loadChannelSettings(
  env: NodeJS.ProcessEnv = process.env,
): ChannelSettings {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const recordingHosts = (env.VOICE_RECORDING_HOSTS ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (
    recordingHosts.some(
      (h) =>
        isIP(h) ||
        h === "localhost" ||
        !h.includes(".") ||
        !/^[a-z0-9.-]+$/.test(h),
    )
  )
    throw Error("VOICE_RECORDING_HOSTS must list exact public DNS hosts");
  const bookingHosts = (env.BOOKING_LINK_HOSTS ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (
    bookingHosts.some(
      (h) =>
        isIP(h) ||
        h === "localhost" ||
        !h.includes(".") ||
        !/^[a-z0-9.-]+$/.test(h),
    )
  )
    throw Error("BOOKING_LINK_HOSTS must list exact approved public DNS hosts");
  const s: ChannelSettings = { recordingHosts, bookingHosts, fetcher: fetch };
  const voiceConfig = parseVoiceProviderConfig(env);
  const voiceBindings = voiceConfig.bindings.flatMap(binding => {
    // These descriptors came from this exact validated environment snapshot; parse once
    // rather than reparsing the full fleet for each runtime at startup.
    const secret = binding.secretPresent ? env[binding.secretEnv]!.trim() : null;
    return secret ? [{ tenantId: binding.tenantId, facilityId: binding.facilityId,
      accountId: binding.accountId, agentVersion: binding.agentVersion, secret }] : [];
  });
  if (voiceConfig.mode === 'multi_clinic') s.voiceBindings = voiceBindings;
  else if (voiceBindings[0]) s.voice = voiceBindings[0];
  if (env.POSTHOG_READ_KEY) {
    if (
      !["https://us.posthog.com", "https://eu.posthog.com"].includes(
        env.POSTHOG_API_HOST ?? "",
      ) ||
      !/^\d+$/.test(env.POSTHOG_PROJECT_ID ?? "") ||
      !uuid.test(env.POSTHOG_TENANT_ID ?? "") ||
      !uuid.test(env.POSTHOG_FACILITY_ID ?? "")
    )
      throw Error(
        "PostHog needs an allowed cloud host, numeric project and explicit tenant/facility binding",
      );
    s.posthog = {
      tenantId: env.POSTHOG_TENANT_ID!,
      facilityId: env.POSTHOG_FACILITY_ID!,
      host: env.POSTHOG_API_HOST!,
      project: env.POSTHOG_PROJECT_ID!,
      key: env.POSTHOG_READ_KEY,
    };
  }
  return s;
}
export function validVoiceSecret(settings: ChannelSettings, value: unknown) {
  const expected = settings.voice?.secret;
  return (
    !!expected &&
    typeof value === "string" &&
    Buffer.byteLength(value) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  );
}
/** Account header selects a configured deployment; body fields cannot select tenant/clinic. */
export function voiceRuntimeForRequest(settings: ChannelSettings, account: unknown): VoiceRuntimeBinding | undefined {
  if (settings.voiceBindings !== undefined) {
    if (typeof account !== 'string') return;
    return settings.voiceBindings.find(binding => binding.accountId === account);
  }
  if (account !== undefined && account !== settings.voice?.accountId) return;
  return settings.voice;
}
async function active(tx: Parameters<Parameters<typeof runQuery>[2]>[0]) {
  if ((await moduleState(tx)) !== "active")
    throw preconditionFailed("communications module is inactive", {
      reason: "module_inactive",
    });
}
export async function bookingLinks(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<{
      facility_id: string;
      booking_url: string;
      version: number;
      updated_at: Date;
    }>`SELECT * FROM comms.booking_link WHERE facility_id=${facilityId}`.execute(
      tx,
    );
    return {
      items: rows.map((r) =>
        BookingLinkSchema.parse({
          facilityId: r.facility_id,
          bookingUrl: r.booking_url,
          version: r.version,
          updatedAt: r.updated_at.toISOString(),
        }),
      ),
    };
  });
}
export async function saveBookingLink(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  input: { bookingUrl: string; version: number },
  key: string,
  settings: ChannelSettings,
) {
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.booking_link",
      idempotencyKey: key,
      request: { facilityId, ...input },
    },
    async (ctx) => {
      await active(ctx.tx);
      if (!settings.bookingHosts?.length)
        throw preconditionFailed(
          "approved booking destinations are not configured",
          { reason: "booking_hosts_not_configured" },
        );
      if (
        !settings.bookingHosts.includes(
          new URL(input.bookingUrl).hostname.toLowerCase(),
        )
      )
        throw invalid("booking destination is not approved");
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${ctx.tenantId}:booking_link:${facilityId}`},0))`.execute(
        ctx.tx,
      );
      const facility = await ctx.tx
        .selectFrom("platform.facility")
        .select(["id", "facility_type"])
        .where("id", "=", facilityId)
        .executeTakeFirst();
      if (!facility) throw notFound("facility");
      if (facility.facility_type === "virtual")
        throw invalid("a physical clinic is required");
      const {
        rows: [before],
      } = await sql<{
        booking_url: string;
        version: number;
      }>`SELECT booking_url,version FROM comms.booking_link WHERE facility_id=${facilityId}`.execute(
        ctx.tx,
      );
      if ((before?.version ?? 0) !== input.version)
        throw conflict("booking link changed; reload", {
          reason: "stale_version",
        });
      const {
        rows: [r],
      } = await sql<{
        id: string;
        version: number;
        updated_at: Date;
      }>`INSERT INTO comms.booking_link(tenant_id,facility_id,booking_url,created_by) VALUES(${ctx.tenantId},${facilityId},${input.bookingUrl},${ctx.actor.staffId}) ON CONFLICT(tenant_id,facility_id) DO UPDATE SET booking_url=EXCLUDED.booking_url RETURNING id,version,updated_at`.execute(
        ctx.tx,
      );
      await sql`INSERT INTO comms.booking_link_change(tenant_id,facility_id,actor_staff_id,before_url,after_url) VALUES(${ctx.tenantId},${facilityId},${ctx.actor.staffId},${before?.booking_url ?? null},${input.bookingUrl})`.execute(
        ctx.tx,
      );
      ctx.audit({
        action: "update",
        subjectType: "comms.booking_link",
        subjectId: r!.id,
        diff: { before: before?.booking_url ?? null, after: input.bookingUrl },
      });
      ctx.emit({
        eventType: "growth.booking_link_changed",
        aggregateType: "comms.booking_link",
        aggregateId: r!.id,
        payload: { facilityId },
      });
      return BookingLinkSchema.parse({
        facilityId,
        bookingUrl: input.bookingUrl,
        version: r!.version,
        updatedAt: r!.updated_at.toISOString(),
      });
    },
  );
}
export async function bookingLinkChanges(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<{
      id: string;
      facility_id: string;
      display_name: string;
      before_url: string | null;
      after_url: string;
      created_at: Date;
    }>`SELECT c.*,s.display_name FROM comms.booking_link_change c JOIN platform.staff s ON s.id=c.actor_staff_id AND s.tenant_id=c.tenant_id WHERE c.facility_id=${facilityId} ORDER BY c.created_at DESC,c.id DESC LIMIT 100`.execute(
      tx,
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        facilityId: r.facility_id,
        actorName: r.display_name,
        before: r.before_url,
        after: r.after_url,
        createdAt: r.created_at.toISOString(),
      })),
    };
  });
}
export async function growthSummary(
  db: Kysely<DB>,
  caller: Caller,
  q: {
    facilityId: string;
    from: string;
    to: string;
    cohort: "created" | "visit";
  },
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const facility = await tx
      .selectFrom("platform.facility")
      .select("timezone")
      .where("id", "=", q.facilityId)
      .executeTakeFirst();
    if (!facility) throw notFound("facility");
    const { rows } = await sql<{
      status: string;
      origin_channel: string;
      resolved: boolean;
    }>`
    WITH RECURSIVE chains AS (
      SELECT a.id,a.created_at AS root_created FROM booking.appointment a WHERE a.rescheduled_from_id IS NULL
      UNION ALL SELECT a.id,c.root_created FROM booking.appointment a JOIN chains c ON a.rescheduled_from_id=c.id
    ) SELECT a.status,a.origin_channel,(a.completed_at IS NOT NULL OR a.ends_at<=${clock(caller)} OR (a.ends_at IS NULL AND a.session_on < (${clock(caller)} AT TIME ZONE ${facility.timezone})::date)) AS resolved
      FROM booking.appointment a JOIN chains c ON c.id=a.id
      WHERE a.facility_id=${q.facilityId} AND NOT EXISTS(SELECT 1 FROM booking.appointment n WHERE n.rescheduled_from_id=a.id)
      AND (CASE WHEN ${q.cohort}='created' THEN (c.root_created AT TIME ZONE ${facility.timezone})::date ELSE a.session_on END) BETWEEN ${q.from}::date AND ${q.to}::date`.execute(
      tx,
    );
    const retained = rows.filter((r) =>
      ["confirmed", "checked_in", "completed"].includes(r.status),
    ).length;
    const resolved = rows.filter(
      (r) =>
        r.resolved && ["checked_in", "completed", "no_show"].includes(r.status),
    );
    const attended = resolved.filter((r) => r.status !== "no_show").length;
    const tally = (key: "status" | "origin_channel") => {
      const result: Record<string, number> = {};
      for (const r of rows) result[r[key]] = (result[r[key]] ?? 0) + 1;
      return result;
    };
    return GrowthSummarySchema.parse({
      ...q,
      timezone: facility.timezone,
      appointmentsInCohort: rows.length,
      retainedConfirmationShare: rows.length
        ? (100 * retained) / rows.length
        : null,
      attendanceRateResolved: resolved.length
        ? (100 * attended) / resolved.length
        : null,
      byStatus: tally("status"),
      byChannel: tally("origin_channel"),
      byAcquisitionSource: {},
      sources: { appointments: "persisted", acquisition: "not_tracked" },
    });
  });
}
export async function websiteActivity(
  caller: Caller,
  q: {
    facilityId: string;
    from: string;
    to: string;
    traffic: "production" | "demo";
  },
  timezone: string,
  settings: ChannelSettings,
) {
  const base = {
    traffic: q.traffic,
    from: q.from,
    to: q.to,
    timezone,
    rows: [] as {
      event: string;
      label: string;
      events: number;
      visitors: number;
    }[],
    retrievedAt: null as string | null,
  };
  const p = settings.posthog;
  if (!p || p.tenantId !== caller.tenantId || p.facilityId !== q.facilityId)
    return { ...base, status: "not_configured" };
  // Fixed allowlisted aggregation only: no patient fields, URLs, search terms or arbitrary SQL from the browser.
  const events = ["$pageview", "booking_started", "booking_completed"];
  const query = `SELECT event, count(), count(DISTINCT distinct_id) FROM events WHERE timestamp >= toDateTime('${q.from} 00:00:00', '${timezone.replace(/[^A-Za-z0-9_\/+.-]/g, "")}') AND timestamp < toDateTime('${q.to} 00:00:00', '${timezone.replace(/[^A-Za-z0-9_\/+.-]/g, "")}') + INTERVAL 1 DAY AND event IN ('$pageview','booking_started','booking_completed') AND properties.hms_traffic = '${q.traffic}' AND properties.hms_surface = 'public' AND properties.hms_analytics_consent = true GROUP BY event LIMIT 3`;
  try {
    const r = await settings.fetcher(
      `${p.host}/api/projects/${p.project}/query/`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${p.key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!r.ok || !r.body) throw Error();
    const reader = r.body.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 65536) throw Error();
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const d = JSON.parse(Buffer.concat(chunks).toString()) as {
      results?: unknown;
    };
    if (!Array.isArray(d.results) || d.results.length > 3) throw Error();
    base.rows = d.results.map((v) => {
      if (
        !Array.isArray(v) ||
        !events.includes(v[0]) ||
        !Number.isSafeInteger(v[1]) ||
        !Number.isSafeInteger(v[2]) ||
        v[1] < 0 ||
        v[2] < 0
      )
        throw Error();
      return { event: v[0], label: v[0], events: v[1], visitors: v[2] };
    });
    base.retrievedAt = new Date().toISOString();
    return { ...base, status: "available" };
  } catch {
    return { ...base, status: "unavailable" };
  }
}
function recordingUrlAllowed(value: string, settings: ChannelSettings) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      settings.recordingHosts.includes(u.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}
export async function ingestVoice(
  db: Kysely<DB>,
  input: VoiceEvent,
  settings: ChannelSettings,
) {
  const binding = settings.voice!;
  // A stale sequence or idempotent replay must not bypass deployment identity validation.
  if (binding.agentVersion !== null && input.agentVersion !== undefined && binding.agentVersion !== input.agentVersion)
    throw invalid('runtime agent version does not match configured version');
  const caller: Caller = {
    tenantId: binding.tenantId,
    actor: { kind: "system" },
  };
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: `comms.voice_event:${binding.accountId}`,
      idempotencyKey: input.eventId,
      request: input,
    },
    async (ctx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${ctx.tenantId}:voice:${binding.accountId}:${input.sessionId}`},0))`.execute(
        ctx.tx,
      );
      const {
        rows: [prior],
      } = await sql<{
        id: string;
        last_sequence: number;
        status: string;
        started_at: Date;
        consented_at: Date | null;
        recording_allowed: boolean;
        transcript_allowed: boolean;
        recording_revoked_at: Date | null;
        transcript_revoked_at: Date | null;
      }>`SELECT * FROM comms.voice_call WHERE runtime_account_id=${binding.accountId} AND session_id=${input.sessionId}`.execute(
        ctx.tx,
      );
      const consent = input.consent;
      const now = Date.now();
      if (
        consent &&
        (Date.parse(consent.occurredAt) > now ||
          Date.parse(consent.expiresAt) <= Date.parse(consent.occurredAt) ||
          Date.parse(consent.expiresAt) - Date.parse(consent.occurredAt) >
            30 * 86400000)
      )
        throw invalid("invalid consent occurrence or access expiry");
      const withdrawal =
        !!prior &&
        !!consent &&
        (!consent.recordingAllowed || !consent.transcriptAllowed);
      if (withdrawal) {
        const {
          rows: [revoked],
        } = await sql<{
          recording_allowed: boolean;
          transcript_allowed: boolean;
        }>`UPDATE comms.voice_call SET recording_allowed=recording_allowed AND ${consent!.recordingAllowed},transcript_allowed=transcript_allowed AND ${consent!.transcriptAllowed},recording_revoked_at=CASE WHEN ${!consent!.recordingAllowed} THEN clock_timestamp() ELSE recording_revoked_at END,transcript_revoked_at=CASE WHEN ${!consent!.transcriptAllowed} THEN clock_timestamp() ELSE transcript_revoked_at END WHERE id=${prior!.id} RETURNING recording_allowed,transcript_allowed`.execute(
          ctx.tx,
        );
        await sql`INSERT INTO comms.voice_consent_event(tenant_id,call_id,recording_requested,transcript_requested,recording_effective,transcript_effective,occurred_at,evidence,expires_at) VALUES(${ctx.tenantId},${prior!.id},${consent!.recordingAllowed},${consent!.transcriptAllowed},${revoked!.recording_allowed},${revoked!.transcript_allowed},${consent!.occurredAt}::timestamptz,${consent!.evidence},${consent!.expiresAt}::timestamptz)`.execute(
          ctx.tx,
        );
        ctx.audit({
          action: "update",
          subjectType: "comms.voice_call",
          subjectId: prior!.id,
          diff: {
            recordingAllowed: revoked!.recording_allowed,
            transcriptAllowed: revoked!.transcript_allowed,
          },
        });
        // A privacy revocation applies independently of call-sequence ordering and suspension.
        return { callId: prior!.id, ignored: false };
      } else await active(ctx.tx);
      if (prior && input.sequence <= prior.last_sequence)
        return { callId: prior.id, ignored: true };
      const freshConsent =
        !!consent &&
        (!prior?.consented_at ||
          Date.parse(consent.occurredAt) >= prior.consented_at.getTime());
      const recordingAllowed =
        !!consent?.recordingAllowed &&
        (!prior?.recording_revoked_at ||
          Date.parse(consent.occurredAt) >
            prior.recording_revoked_at.getTime());
      const transcriptAllowed =
        !!consent?.transcriptAllowed &&
        (!prior?.transcript_revoked_at ||
          Date.parse(consent.occurredAt) >
            prior.transcript_revoked_at.getTime());
      if (
        prior &&
        prior.started_at.toISOString() !==
          new Date(input.startedAt).toISOString()
      )
        throw invalid("call start cannot change");
      if (prior && prior.status !== "active" && input.status === "active")
        throw conflict("a completed call cannot restart");
      if (input.status === "booked" && !input.appointmentId)
        throw invalid("a booked outcome requires a verified appointment");
      if (input.appointmentId) {
        const a = await ctx.tx
          .selectFrom("booking.appointment")
          .select(["facility_id", "origin_channel", "confirmation_code"])
          .where("id", "=", input.appointmentId)
          .executeTakeFirst();
        if (
          !a ||
          a.facility_id !== binding.facilityId ||
          a.origin_channel !== "voice" ||
          a.confirmation_code !== input.confirmationCode
        )
          throw invalid("voice booking reference is not verified");
      }
      if (
        Date.parse(input.startedAt) > now ||
        (input.endedAt && Date.parse(input.endedAt) > now)
      )
        throw invalid("call timestamps cannot be in the future");
      if (
        input.recordingUrl &&
        !recordingUrlAllowed(input.recordingUrl, settings)
      )
        throw invalid("recording host is not configured");
      const {
        rows: [call],
      } = await sql<{
        id: string;
        recording_allowed: boolean;
        transcript_allowed: boolean;
        available_until: Date | null;
      }>`INSERT INTO comms.voice_call(tenant_id,facility_id,runtime_account_id,session_id,last_sequence,status,started_at,ended_at,agent_version,tool_calls,appointment_id,recording_allowed,transcript_allowed,consented_at,consent_evidence,available_until,recording_url)
      VALUES(${ctx.tenantId},${binding.facilityId},${binding.accountId},${input.sessionId},${input.sequence},${input.status},${input.startedAt}::timestamptz,${input.endedAt ?? null}::timestamptz,${input.agentVersion ?? binding.agentVersion},${input.toolCalls},${input.appointmentId ?? null},${recordingAllowed},${transcriptAllowed},${consent?.occurredAt ?? null}::timestamptz,${consent?.evidence ?? null},${consent?.expiresAt ?? null}::timestamptz,${input.recordingUrl ?? null})
      ON CONFLICT(tenant_id,runtime_account_id,session_id) DO UPDATE SET last_sequence=EXCLUDED.last_sequence,status=EXCLUDED.status,ended_at=coalesce(EXCLUDED.ended_at,voice_call.ended_at),agent_version=coalesce(EXCLUDED.agent_version,voice_call.agent_version),tool_calls=greatest(EXCLUDED.tool_calls,voice_call.tool_calls),appointment_id=coalesce(EXCLUDED.appointment_id,voice_call.appointment_id),recording_allowed=CASE WHEN ${freshConsent} THEN EXCLUDED.recording_allowed ELSE voice_call.recording_allowed END,transcript_allowed=CASE WHEN ${freshConsent} THEN EXCLUDED.transcript_allowed ELSE voice_call.transcript_allowed END,consented_at=CASE WHEN ${freshConsent} THEN EXCLUDED.consented_at ELSE voice_call.consented_at END,consent_evidence=CASE WHEN ${freshConsent} THEN EXCLUDED.consent_evidence ELSE voice_call.consent_evidence END,available_until=CASE WHEN ${freshConsent} THEN EXCLUDED.available_until ELSE voice_call.available_until END,recording_url=coalesce(EXCLUDED.recording_url,voice_call.recording_url) RETURNING id,recording_allowed,transcript_allowed,available_until`.execute(
        ctx.tx,
      );
      if (consent && !withdrawal)
        await sql`INSERT INTO comms.voice_consent_event(tenant_id,call_id,recording_requested,transcript_requested,recording_effective,transcript_effective,occurred_at,evidence,expires_at) VALUES(${ctx.tenantId},${call!.id},${consent.recordingAllowed},${consent.transcriptAllowed},${call!.recording_allowed},${call!.transcript_allowed},${consent.occurredAt}::timestamptz,${consent.evidence},${consent.expiresAt}::timestamptz)`.execute(
          ctx.tx,
        );
      if (
        input.turns &&
        call!.transcript_allowed &&
        call!.available_until &&
        call!.available_until.getTime() > now
      ) {
        await sql`INSERT INTO comms.voice_transcript_revision(tenant_id,call_id,sequence,turns) VALUES(${ctx.tenantId},${call!.id},${input.sequence},${JSON.stringify(input.turns)}::jsonb)`.execute(
          ctx.tx,
        );
        await sql`INSERT INTO comms.voice_transcript(tenant_id,call_id,turns) VALUES(${ctx.tenantId},${call!.id},${JSON.stringify(input.turns)}::jsonb) ON CONFLICT(tenant_id,call_id) DO UPDATE SET turns=EXCLUDED.turns`.execute(
          ctx.tx,
        );
      }
      ctx.audit({
        action: prior ? "update" : "create",
        subjectType: "comms.voice_call",
        subjectId: call!.id,
        diff: { status: input.status, sequence: input.sequence },
      });
      ctx.emit({
        eventType: "voice.call_updated",
        aggregateType: "comms.voice_call",
        aggregateId: call!.id,
        payload: { facilityId: binding.facilityId },
      });
      return { callId: call!.id, ignored: false };
    },
  );
}
export async function voiceHistory(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  offset: number,
  settings: ChannelSettings,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } =
      await sql<any>`SELECT c.*,a.confirmation_code,a.status AS appointment_status,jsonb_array_length(coalesce(t.turns,'[]'::jsonb)) AS turn_count,t.id AS transcript_id FROM comms.voice_call c LEFT JOIN booking.appointment a ON a.id=c.appointment_id AND a.tenant_id=c.tenant_id LEFT JOIN comms.voice_transcript t ON t.call_id=c.id AND t.tenant_id=c.tenant_id WHERE c.facility_id=${facilityId} AND c.started_at>=${clock(caller)}::timestamptz-interval '30 days' ORDER BY c.started_at DESC,c.id DESC LIMIT 26 OFFSET ${offset}`.execute(
        tx,
      );
    const {
      rows: [summary],
    } =
      await sql<any>`SELECT count(*)::int AS calls,count(*) FILTER(WHERE appointment_id IS NOT NULL)::int AS bookings,count(*) FILTER(WHERE status='error')::int AS errors,count(*) FILTER(WHERE status IN('completed','booked'))::int AS completed,coalesce(sum(tool_calls),0)::int AS "toolCalls" FROM comms.voice_call WHERE facility_id=${facilityId} AND started_at>=${clock(caller)}::timestamptz-interval '30 days'`.execute(
        tx,
      );
    const now = clock(caller).getTime();
    const items = rows.slice(0, 25).map((c) => {
      const expired = c.available_until && c.available_until.getTime() <= now;
      return {
        id: c.id,
        sessionId: c.session_id,
        status: c.status,
        startedAt: c.started_at.toISOString(),
        endedAt: c.ended_at?.toISOString() ?? null,
        agentVersion: c.agent_version,
        turnCount: c.turn_count,
        toolCalls: c.tool_calls,
        appointment: c.appointment_id
          ? {
              id: c.appointment_id,
              confirmationCode: c.confirmation_code,
              status: c.appointment_status,
            }
          : null,
        recordingState: !c.recording_allowed
          ? "no_consent"
          : expired
            ? "expired"
            : c.recording_url && recordingUrlAllowed(c.recording_url, settings)
              ? "eligible"
              : "not_configured",
        transcriptState: !c.transcript_allowed
          ? "no_consent"
          : expired
            ? "expired"
            : c.transcript_id
              ? "eligible"
              : "pending",
        consentedAt: c.consented_at?.toISOString() ?? null,
        availableUntil: c.available_until?.toISOString() ?? null,
      };
    });
    const clinicBinding = (settings.voiceBindings ?? (settings.voice ? [settings.voice] : []))
      .find(binding => binding.tenantId === caller.tenantId && binding.facilityId === facilityId);
    const bound = !!clinicBinding;
    return VoiceHistorySchema.parse({
      items,
      total: summary!.calls,
      summary,
      nextCursor: rows.length > 25 ? String(offset + 25) : null,
      configuration: {
        callsReady: bound,
        recordingsReady: bound && settings.recordingHosts.length > 0,
        transcriptsReady: bound,
        accessDays: 30,
        agentVersion: clinicBinding?.agentVersion ?? null,
      },
    });
  });
}
export async function voiceFacility(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const {
      rows: [r],
    } = await sql<{
      facility_id: string;
    }>`SELECT facility_id FROM comms.voice_call WHERE id=${id}`.execute(tx);
    if (!r) throw notFound("voice call");
    return r.facility_id;
  });
}
export async function voiceAccess(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
  kind: "recording" | "transcript",
  authorized: boolean,
  settings: ChannelSettings,
) {
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.voice_access",
      request: { id, kind },
    },
    async (ctx) => {
      const {
        rows: [c],
      } =
        await sql<any>`SELECT c.*,t.turns FROM comms.voice_call c LEFT JOIN comms.voice_transcript t ON t.call_id=c.id AND t.tenant_id=c.tenant_id WHERE c.id=${id}`.execute(
          ctx.tx,
        );
      if (!c) throw notFound("voice call");
      let outcome = !authorized
        ? "forbidden"
        : !(kind === "recording" ? c.recording_allowed : c.transcript_allowed)
          ? "no_consent"
          : !c.available_until || c.available_until <= clock(caller)
            ? "expired"
            : kind === "recording" &&
                (!c.recording_url ||
                  !recordingUrlAllowed(c.recording_url, settings))
              ? "not_configured"
              : kind === "transcript" && !c.turns
                ? "pending"
                : "allowed";
      await sql`INSERT INTO comms.voice_recording_access(tenant_id,call_id,actor_staff_id,kind,outcome) VALUES(${ctx.tenantId},${id},${ctx.actor.staffId},${kind},${outcome})`.execute(
        ctx.tx,
      );
      ctx.audit({
        action: "view",
        subjectType: `comms.voice_${kind}`,
        subjectId: id,
        diff: { outcome },
      });
      return {
        outcome,
        recordingUrl:
          outcome === "allowed" && kind === "recording"
            ? c.recording_url
            : null,
        transcript:
          outcome === "allowed" && kind === "transcript"
            ? VoiceTranscriptSchema.parse({ source: "runtime", turns: c.turns })
            : null,
      };
    },
  );
}
export async function recordingBytes(url: string, settings: ChannelSettings) {
  if (!recordingUrlAllowed(url, settings))
    throw preconditionFailed("recording host unavailable");
  const r = await settings.fetcher(url, {
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok || !r.body) throw preconditionFailed("recording unavailable");
  const mime = r.headers.get("content-type")?.split(";")[0] ?? "";
  if (
    ![
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/mp4",
      "audio/webm",
    ].includes(mime)
  )
    throw preconditionFailed("unsupported recording response");
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 20 * 1024 * 1024)
        throw preconditionFailed("recording exceeds review size");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return { mime, bytes: Buffer.concat(chunks) };
}
