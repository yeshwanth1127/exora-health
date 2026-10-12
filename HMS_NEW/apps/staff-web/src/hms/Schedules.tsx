import { useMemo, useState } from "react";
import { ScheduleTimeline } from "@/modules/schedule-timeline";
import { PageTitle } from "@/components/workspace";
import {
  OriginalResourceContext,
  type OriginalResourceSource,
} from "@/components/resource-source";
import { useQuery, useWorkspace } from "./hooks";
import { today } from "./model";
import { scheduleSource } from "./schedule-source";

export function Schedules() {
  const { me, facility, practitioners, go } = useWorkspace();
  const params = new URLSearchParams(location.search);
  const requestedDoctor = params.get("doctor") ?? undefined;
  const requestedMode =
    params.get("mode") === "virtual" ? "virtual" : "in_person";
  const [day, setDay] = useState(() => today(facility.timezone));
  const setting = useQuery<{ enabled: boolean; maxPerSession: number }>(
    `/v1/facilities/${facility.facilityId}/overbooking`,
  );
  const overbooking = setting.data?.enabled === true;
  const source = useMemo<OriginalResourceSource>(
    () => scheduleSource(me, facility, practitioners, day, overbooking),
    [me, facility, practitioners, day, overbooking],
  );
  return (
    <>
      <PageTitle
        title="Schedules"
        description="Doctor schedules and weekly hours."
      />
      <div className="mt-5">
        <OriginalResourceContext.Provider value={source}>
          <ScheduleTimeline
            day={day}
            setDay={setDay}
            ownDoctorId={me.staffType === "doctor" ? me.staffId : undefined}
            initialDoctorId={requestedDoctor}
            initialVisitMode={requestedMode}
            onDoctorProfile={(id) =>
              go(`doctors?doctor=${encodeURIComponent(id)}`)
            }
          />
        </OriginalResourceContext.Provider>
      </div>
    </>
  );
}
