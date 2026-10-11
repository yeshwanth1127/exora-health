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
import { today } from "./model";
import { Hint } from "./ui";
import { scheduleSource } from "./schedule-source";
import { confirmLeave } from "./leave";

export function Schedules() {
  const { me, facility, practitioners } = useWorkspace();
  const [day, setDay] = useState(() => today(facility.timezone)),
    [view, setView] = useState("timeline");
  const source = useMemo<OriginalResourceSource>(
    () => scheduleSource(me, facility, practitioners, day),
    [me, facility, practitioners, day],
  );
  return (
    <>
      <PageTitle
        title="Schedules"
        description="Your original doctor timeline, detail sheets and weekly-hours editor."
      />
      <Hint>
        Blocks and extra hours apply to this clinic. Weekly hours replace this
        clinic's hours from the chosen date, and are checked against bookings
        and the doctor's hours at other clinics before saving. Book patients
        from Booking; exact-time booking from the timeline is not available yet.
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
