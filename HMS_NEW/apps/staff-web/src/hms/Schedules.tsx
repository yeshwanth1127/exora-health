import { useMemo, useState } from "react";
import { ScheduleTimeline } from "@/modules/schedule-timeline";
import { PageTitle } from "@/components/workspace";
import {
  OriginalResourceContext,
  type OriginalResourceSource,
} from "@/components/resource-source";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clinic } from "./Clinic";
import { useWorkspace } from "./hooks";
import { HmsError, query, request } from "./client";
import { can, today } from "./model";
import { Hint } from "./ui";
import {
  scheduleCatalogue,
  scheduleDoctors,
  scheduleRow,
} from "./schedule-presentation";
import type { Appointment, Slot } from "./types";
import { confirmLeave } from "./leave";

export function Schedules() {
  const { me, facility, practitioners } = useWorkspace();
  const [day, setDay] = useState(() => today(facility.timezone)),
    [view, setView] = useState("timeline");
  const source = useMemo<OriginalResourceSource>(() => {
    const catalogue = scheduleCatalogue(facility, practitioners),
      doctors = scheduleDoctors(facility, practitioners);
    const allowed = {
      "schedules.manage": can(me, "schedules.manage", facility.facilityId),
      "schedule.block": can(me, "schedules.manage", facility.facilityId),
      "appointments.create": can(me, "appointments.book", facility.facilityId),
      "appointments.overbook": false,
      "appointments.delete": false,
    };
    return {
      scope: `${me.tenantId}:${facility.facilityId}:${me.staffId}`,
      permissions: { role: me.staffType, allowed, staff: [] },
      unavailableWrite:
        "Saving this original editor awaits its backend contract. Nothing will be saved.",
      async read<T>(path: string, signal: AbortSignal): Promise<T> {
        if (path === "/api/v1/admin/doctors") return doctors as T;
        if (path === "/api/v1/admin/catalogue") return catalogue as T;
        const url = new URL(path, "https://frontend.invalid");
        if (url.pathname !== "/api/v1/admin/schedule-timeline")
          throw new HmsError(
            "This read requires the scheduling backend integration. No conflict check or saved state is available yet.",
            501,
            "backend_pending",
          );
        const date = url.searchParams.get("day") ?? day;
        const branch = url.searchParams.get("branch_id");
        if (branch && branch !== facility.facilityId)
          throw new HmsError(
            "Switch clinic to inspect another facility.",
            403,
            "facility_scope",
          );
        const appointments = await request<{ items: Appointment[] }>(
          `/v1/appointments?${query({ facilityId: facility.facilityId, from: date, to: date, limit: 500 })}`,
          { signal },
        );
        const rows = await Promise.all(
          doctors.map(async (doctor) => {
            const slots = practitioners.find((p) => p.staffId === doctor.id)
              ?.calendarId
              ? await request<{ items: Slot[] }>(
                  `/v1/practitioners/${doctor.id}/slots?${query({ facilityId: facility.facilityId, from: date, to: date, includeUnavailable: true })}`,
                  { signal },
                )
              : { items: [] };
            return scheduleRow(
              doctor,
              slots.items,
              appointments.items,
              facility,
            );
          }),
        );
        return { day: date, as_of: new Date().toISOString(), rows } as T;
      },
    };
  }, [me, facility, practitioners, day]);
  return (
    <>
      <PageTitle
        title="Schedules"
        description="Your original doctor timeline, detail sheets and weekly-hours editor."
      />
      <Hint>
        The original interface is restored. The timeline currently shows
        remaining free slots and loaded bookings for this clinic. Holds, closure
        reasons and complete published-hour history are unavailable. Weekly and
        range editors are local drafts; they cannot review conflicts or save
        changes yet.
      </Hint>
      <Tabs
        className="mt-5 mb-5"
        value={view}
        onValueChange={(next) => {
          if (confirmLeave()) setView(next);
        }}
      >
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="slots">Bookable slots</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "timeline" ? (
        <OriginalResourceContext.Provider value={source}>
          <ScheduleTimeline day={day} setDay={setDay} />
        </OriginalResourceContext.Provider>
      ) : (
        <Clinic page="schedules" />
      )}
    </>
  );
}
