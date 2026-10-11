// Mounts the original Overview, answered by GET /v1/operations/summary for the chosen clinic.
import { useMemo } from "react";
import { OperationsModule } from "@/modules/operations";
import {
  OriginalResourceContext,
  type OriginalResourceSource,
} from "@/components/resource-source";
import { request, query } from "./client";
import { useWorkspace } from "./hooks";
import { today } from "./model";
import type { Appointment } from "./types";

type Summary = {
  summary: Record<string, number | null>;
  dailyBookings: { date: string; bookings: number }[];
  byStatus: { label: string; value: number }[];
  byChannel: { label: string; value: number }[];
  recent: Appointment[];
};

export function Overview() {
  const { me, facility } = useWorkspace();
  const source = useMemo<OriginalResourceSource>(
    () => ({
      scope: `${me.tenantId}:${facility.facilityId}:${me.staffId}`,
      permissions: { role: me.staffType, allowed: {}, staff: [] },
      unavailableWrite: "Nothing on this page saves.",
      async read<T>(path: string, signal: AbortSignal): Promise<T> {
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
            // Unknown until messaging and voice exist (G19, G21); shown as "—", never 0.
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
              a.patientName ??
              (a.patientId ? "Patient name unavailable" : "Patient not linked"),
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
      <OperationsModule page="overview" />
    </OriginalResourceContext.Provider>
  );
}
