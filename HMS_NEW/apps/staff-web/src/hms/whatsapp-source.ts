import {
  FollowupRuleUpsertSchema,
  AppointmentFollowupCreateSchema,
} from "@hms/contracts";
import type { OriginalResourceSource } from "@/components/resource-source";
import { HmsError, IntentKeys, query, request } from "./client";
import { can, today } from "./model";
import {
  decodeCapabilities,
  decodeFollowupRules,
  decodeFollowupRule,
  decodeNotificationJob,
  decodeMessages,
} from "./comms-model";
import { fullWhatsAppSource } from "./whatsapp-full-source";
import type { Appointment, Facility, Me, Practitioner } from "./types";
const wa = "/api/v1/admin/whatsapp";
export function whatsappSource(
  me: Me,
  facility: Facility,
  practitioners: Practitioner[] = [],
): OriginalResourceSource {
  const at = facility.facilityId,
    intents = new IntentKeys();
  const versions = new Map<string, number>();
  const full = fullWhatsAppSource(facility, practitioners, intents);
  return {
    scope: `${me.tenantId}:${at}:${me.staffId}`,
    permissions: {
      role: can(me, "comms.manage", at) ? "admin" : "staff",
      allowed: {
        "followups.manage": can(me, "comms.manage", at),
        "comms.read": can(me, "comms.read", at),
        "comms.reply": can(me, "comms.reply", at),
        "comms.manage": can(me, "comms.manage", at),
        "campaigns.manage": can(me, "campaigns.manage", at),
        "campaigns.approve": can(me, "campaigns.approve", at),
        "clinics.manage": can(me, "facility.manage", at),
      },
      staff: [],
    },
    unavailableWrite: "This action is pending integration.",
    asset: full.asset,
    async read<T>(path: string, signal: AbortSignal): Promise<T> {
      const url = new URL(path, "http://local");
      if (url.pathname === `${wa}/operations-config`) {
        const c = decodeCapabilities(
          await request(`/v1/comms/capabilities?${query({ facilityId: at })}`, {
            signal,
          }),
        );
        const settings = (await full.read(`${wa}/settings`, signal)) as {
          testRecipientIds?: string[];
          rateMinor?: number;
          operationalCounts?: {
            openConversations: number;
            campaignDrafts: number;
            marketingContacts: number;
          };
        };
        return {
          outreach_enabled: false,
          module_active: c.moduleStatus === "active",
          environment: "Local records",
          test_recipients: settings.testRecipientIds ?? [],
          local_rate_minor: settings.rateMinor ?? 100,
          local_metrics: settings.operationalCounts ?? null,
          marketing_contacts: null,
          reception: { hours: "", phone: "", response: "" },
        } as T;
      }
      if (url.pathname === `${wa}/followup-rules`) {
        const r = decodeFollowupRules(
          await request(
            `/v1/comms/followup-rules?${query({ facilityId: at })}`,
            { signal },
          ),
        );
        return r.items.map((r) => ({
          kind: r.kind,
          enabled: r.enabled,
          delay_hours: r.delayHours,
          template_id: "",
          version: r.version,
        })) as T;
      }
      if (url.pathname === "/api/v1/admin/appointments") {
        const to = today(facility.timezone);
        const fromDate = new Date(`${to}T12:00:00Z`);
        fromDate.setUTCDate(fromDate.getUTCDate() - 180);
        const from = fromDate.toISOString().slice(0, 10);
        const r = await request<{
          items: (Appointment & { version: number })[];
        }>(
          `/v1/appointments?${query({ facilityId: at, status: "completed", from, to, limit: 500 })}`,
          { signal },
        );
        return r.items
          .filter((a) => a.status === "completed" && a.facilityId === at)
          .map((a) => {
            if (!Number.isInteger(a.version))
              throw new HmsError(
                "The visit revision is missing. Refresh before scheduling.",
                422,
                "invalid_contract",
              );
            versions.set(a.appointmentId, a.version);
            return {
              id: a.appointmentId,
              patient_name:
                a.patientName ?? a.bookingPartyName ?? "Patient not linked",
              confirmation_code: a.confirmationCode,
              status: a.status,
              origin_channel: a.originChannel,
            };
          }) as T;
      }
      const extra = await full.read(path, signal);
      if (extra !== undefined) return extra as T;
      throw new HmsError(
        "This WhatsApp section is pending integration.",
        501,
        "backend_pending",
      );
    },
    async write<T>(
      path: string,
      options: { method?: string; body?: unknown } = {},
    ): Promise<T> {
      const body = options.body as Record<string, unknown>;
      const rule = path.match(
        /^\/api\/v1\/admin\/whatsapp\/followup-rules\/(day_before|same_day|follow_up|feedback|no_show|reschedule|cancellation)$/,
      );
      if (rule && options.method === "PUT") {
        const data = FollowupRuleUpsertSchema.parse({
          facilityId: at,
          version: body.version,
          enabled: body.enabled,
          delayHours: body.delay_hours,
        });
        const route = `/v1/comms/followup-rules/${rule[1]}`;
        const result = decodeFollowupRule(
          await request<unknown>(route, {
            method: "PUT",
            body: data,
            idempotencyKey: intents.for(path, data),
          }),
        );
        intents.complete(path, data);
        return result as T;
      }
      const follow = path.match(
        /^\/api\/v1\/admin\/whatsapp\/appointments\/([0-9a-f-]{36})\/followup$/i,
      );
      if (follow && options.method === "POST") {
        const data = AppointmentFollowupCreateSchema.parse({
          dueAt: body.due_at,
          version: versions.get(follow[1]),
        });
        const result = decodeNotificationJob(
          await request<unknown>(`/v1/appointments/${follow[1]}/followup`, {
            method: "POST",
            body: data,
            idempotencyKey: intents.for(path, data),
          }),
        );
        return result as T;
      }
      const extra = await full.write(path, options);
      if (extra !== undefined) return extra as T;
      throw new HmsError(
        "This action is pending integration.",
        501,
        "backend_pending",
      );
    },
  };
}
export const decodeNotificationHistory = decodeMessages;
