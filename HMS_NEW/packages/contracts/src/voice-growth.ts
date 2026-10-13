import { z } from "zod";
const iso = z.iso.datetime({ offset: true });
const date = z.iso.date();
export const BookingLinkInputSchema = z.strictObject({
  bookingUrl: z
    .string()
    .max(500)
    .refine((v) => {
      try {
        const u = new URL(v);
        return (
          u.protocol === "https:" &&
          !u.username &&
          !u.password &&
          !u.hash &&
          Array.from(u.searchParams.keys()).every((k) =>
            /^(utm_source|utm_medium|utm_campaign|utm_content|utm_term|lang)$/i.test(
              k,
            ),
          )
        );
      } catch {
        return false;
      }
    }, "use an HTTPS URL without credentials"),
  version: z.number().int().nonnegative(),
});
export const BookingLinkSchema = z.object({
  facilityId: z.uuid(),
  bookingUrl: z.string(),
  version: z.number().int(),
  updatedAt: iso,
});
export const BookingLinksSchema = z.object({
  items: z.array(BookingLinkSchema),
});
export const LinkChangesSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      facilityId: z.uuid(),
      actorName: z.string(),
      before: z.string().nullable(),
      after: z.string(),
      createdAt: iso,
    }),
  ),
});
export const GrowthQuerySchema = z
  .object({
    facilityId: z.uuid(),
    from: date,
    to: date,
    cohort: z.enum(["created", "visit"]).default("created"),
  })
  .refine(
    (v) =>
      v.to >= v.from && Date.parse(v.to) - Date.parse(v.from) <= 365 * 86400000,
    "range must be ordered and at most 366 days",
  );
export const GrowthSummarySchema = z.object({
  facilityId: z.uuid(),
  from: date,
  to: date,
  timezone: z.string(),
  cohort: z.enum(["created", "visit"]),
  appointmentsInCohort: z.number().int().nonnegative(),
  retainedConfirmationShare: z.number().nullable(),
  attendanceRateResolved: z.number().nullable(),
  byStatus: z.record(z.string(), z.number()),
  byChannel: z.record(z.string(), z.number()),
  byAcquisitionSource: z.record(z.string(), z.number()),
  sources: z.object({
    appointments: z.literal("persisted"),
    acquisition: z.literal("not_tracked"),
  }),
});
export const GrowthCapabilitiesSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      state: z.enum(["available", "not_connected"]),
      description: z.string(),
      reference: z.string(),
    }),
  ),
});
export const WebsiteActivitySchema = z.object({
  status: z.enum([
    "disabled",
    "not_configured",
    "invalid_host",
    "unavailable",
    "available",
  ]),
  traffic: z.enum(["production", "demo"]),
  rows: z.array(
    z.object({
      event: z.string(),
      label: z.string(),
      events: z.number().int().nonnegative(),
      visitors: z.number().int().nonnegative(),
    }),
  ),
  from: date,
  to: date,
  timezone: z.string(),
  retrievedAt: iso.nullable(),
});
const TurnSchema = z.strictObject({
  role: z.enum(["user", "agent"]),
  originalText: z.string().max(5000).nullable(),
  englishText: z.string().max(5000).nullable(),
});
export const VoiceEventSchema = z
  .strictObject({
    eventId: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9_.:-]+$/),
    sessionId: z.string().min(1).max(128),
    sequence: z.number().int().nonnegative(),
    startedAt: iso,
    endedAt: iso.optional(),
    status: z.enum([
      "active",
      "completed",
      "booked",
      "error",
      "abandoned",
      "transferred",
    ]),
    agentVersion: z.number().int().positive().optional(),
    toolCalls: z.number().int().min(0).max(1000).default(0),
    turns: z.array(TurnSchema).max(500).optional(),
    appointmentId: z.uuid().optional(),
    confirmationCode: z.string().max(30).optional(),
    consent: z
      .strictObject({
        recordingAllowed: z.boolean(),
        transcriptAllowed: z.boolean(),
        evidence: z.string().trim().min(3).max(500),
        occurredAt: iso,
        expiresAt: iso,
      })
      .optional(),
    recordingUrl: z.url().max(2000).optional(),
  })
  .refine(
    (v) => !v.endedAt || Date.parse(v.endedAt) >= Date.parse(v.startedAt),
    "call end precedes start",
  );
export type VoiceEvent = z.infer<typeof VoiceEventSchema>;
export const VoiceCallSchema = z.object({
  id: z.uuid(),
  sessionId: z.string(),
  status: z.string(),
  startedAt: iso,
  endedAt: iso.nullable(),
  agentVersion: z.number().int().nullable(),
  turnCount: z.number().int(),
  toolCalls: z.number().int(),
  appointment: z
    .object({ id: z.uuid(), confirmationCode: z.string(), status: z.string() })
    .nullable(),
  recordingState: z.enum([
    "eligible",
    "no_consent",
    "expired",
    "not_configured",
    "pending",
  ]),
  transcriptState: z.enum(["eligible", "no_consent", "expired", "pending"]),
  consentedAt: iso.nullable(),
  availableUntil: iso.nullable(),
});
export const VoiceHistorySchema = z.object({
  items: z.array(VoiceCallSchema),
  total: z.number().int(),
  summary: z.object({
    calls: z.number().int(),
    bookings: z.number().int(),
    errors: z.number().int(),
    completed: z.number().int(),
    toolCalls: z.number().int(),
  }),
  nextCursor: z.string().nullable(),
  configuration: z.object({
    callsReady: z.boolean(),
    recordingsReady: z.boolean(),
    transcriptsReady: z.boolean(),
    accessDays: z.number().int(),
    agentVersion: z.number().int().nullable(),
  }),
});
export const VoiceTranscriptSchema = z.object({
  source: z.literal("runtime"),
  turns: z.array(TurnSchema),
});
export const VoiceAccessSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      callId: z.uuid(),
      actor: z.string(),
      outcome: z.string(),
      createdAt: iso,
    }),
  ),
});
