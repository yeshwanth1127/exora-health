// Mounts the original Overview and Operations pages. Overview reads GET /v1/operations/summary for the chosen
// clinic; Operations adds the tenant's outbox events (audit.read for every clinic) and API readiness.
import { useMemo } from "react";
import { OperationsModule } from "@/modules/operations";
import {
  OriginalResourceContext,
  type OriginalResourceSource,
} from "@/components/resource-source";
import { request, query } from "./client";
import { useWorkspace } from "./hooks";
import { today } from "./model";
import { patientDisplayName } from "./patient-presentation";
import { SetupGuide } from "./SetupGuide";
import type { Appointment } from "./types";

type OutboxEvent = {
  eventId: string;
  eventType: string;
  aggregateId: string;
  occurredAt: string;
  processedAt: string | null;
  status: string;
};
type Summary = {
  summary: Record<string, number | null>;
  dailyBookings: { date: string; bookings: number }[];
  byStatus: { label: string; value: number }[];
  byChannel: { label: string; value: number }[];
  recent: Appointment[];
};

export function Overview({
  page = "overview",
}: {
  page?: "overview" | "operations";
}) {
  const { me, facility } = useWorkspace();
  const source = useMemo<OriginalResourceSource>(
    () => ({
      scope: `${me.tenantId}:${facility.facilityId}:${me.staffId}`,
      permissions: { role: me.staffType, allowed: {}, staff: [] },
      unavailableWrite: "Nothing on this page saves.",
      async read<T>(path: string, signal: AbortSignal): Promise<T> {
        if (path === "/api/v1/admin/operations") {
          const { items } = await request<{ items: OutboxEvent[] }>(
            "/v1/operations/events?limit=100",
            { signal },
          );
          return items.map((e) => ({
            id: e.eventId,
            event_type: e.eventType,
            aggregate_id: e.aggregateId,
            created_at: e.occurredAt,
            processed_at: e.processedAt,
            status: e.status,
          })) as T;
        }
        if (path === "/api/health/ready") {
          const r = await fetch("/ready", { signal, cache: "no-store" });
          return { ready: r.ok } as T;
        }
        if (path !== "/api/v1/admin/analytics")
          throw new Error("Not available on this page.");
        const r = await request<Summary>(
          `/v1/operations/summary?${query({ facilityId: facility.facilityId, date: today(facility.timezone) })}`,
          { signal },
        );
        const s = r.summary;
        return {
          summary: {
            appointments_total: s.appointmentsTotal,
            appointments_upcoming: s.appointmentsUpcoming,
            appointments_confirmed: s.retained,
            conversion_rate: s.appointmentsTotal
              ? Math.round((s.retained! / s.appointmentsTotal) * 100)
              : 0,
            active_doctors: s.activeDoctors,
            schedule_rules: s.scheduleRules,
            active_holds: s.activeHolds,
            voice_bookings: s.voiceBookings,
            // Local jobs only; absent permission/module availability stays null.
            pending_notifications: s.pendingNotifications,
            voice_sessions_total: s.voiceSessions,
          },
          daily_bookings: r.dailyBookings,
          by_status: r.byStatus,
          by_channel: r.byChannel,
          recent_appointments: r.recent.map((a) => ({
            id: a.appointmentId,
            // The caller is not the patient; never show their name as the patient's.
            patient_name:
              a.patientId && a.patientName
                ? patientDisplayName(a.patientId, a.patientName)
                : (a.patientName ??
                  (a.patientId
                    ? "Patient name unavailable"
                    : "Patient not linked")),
            patient_phone: "",
            doctor: { name: a.practitionerName },
            branch: { name: facility.name },
            starts_at: a.startsAt, // walk-ins have no booked time
            origin_channel: a.originChannel,
            status: a.status,
            confirmation_code: a.confirmationCode,
          })),
        } as T;
      },
    }),
    [me, facility],
  );
  return (
    <OriginalResourceContext.Provider value={source}>
      <OperationsModule
        page={page}
        setup={page === "overview" ? <SetupGuide /> : undefined}
      />
    </OriginalResourceContext.Provider>
  );
}
