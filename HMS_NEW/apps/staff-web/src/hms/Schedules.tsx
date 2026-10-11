import { useMemo, useState } from "react";
import { ScheduleTimeline } from "@/modules/schedule-timeline";
import { PageTitle } from "@/components/workspace";
import {
  OriginalResourceContext,
  type OriginalResourceSource,
} from "@/components/resource-source";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { can, today } from "./model";
import { ErrorMessage, Hint } from "./ui";
import { scheduleSource } from "./schedule-source";

export function Schedules() {
  const { me, facility, practitioners } = useWorkspace();
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
        description="Your original doctor timeline, detail sheets and weekly-hours editor."
      />
      <Hint>
        Blocks and extra hours apply to this clinic. Weekly hours replace this
        clinic's hours from the chosen date, and are checked against bookings
        and the doctor's hours at other clinics before saving. Click a free
        slot to book it; open an appointment to move or cancel it.
        {overbooking &&
          ` Overbooking is on: open a booked appointment to add up to ${setting.data?.maxPerSession} extra per doctor session, with a reason.`}
      </Hint>
      {can(me, "config.manage", facility.facilityId) && setting.data && (
        <OverbookingSwitch
          facilityId={facility.facilityId}
          enabled={overbooking}
          onSaved={() => void setting.refresh()}
        />
      )}
      <div className="mt-5">
        <OriginalResourceContext.Provider value={source}>
          <ScheduleTimeline day={day} setDay={setDay} />
        </OriginalResourceContext.Provider>
      </div>
    </>
  );
}

/** Clinic administrators turn overbooking on or off for this clinic only. */
function OverbookingSwitch({
  facilityId,
  enabled,
  onSaved,
}: {
  facilityId: string;
  enabled: boolean;
  onSaved: () => void;
}) {
  const cmd = useCommand();
  return (
    <div className="mt-4 flex items-center justify-between gap-4 rounded-md border p-3">
      <Label htmlFor="clinic-overbooking" className="font-normal">
        Allow overbooking at this clinic (at most 3 per doctor session)
      </Label>
      <Switch
        id="clinic-overbooking"
        checked={enabled}
        disabled={cmd.busy}
        onCheckedChange={async (next) => {
          if (
            await cmd.run(
              `/v1/facilities/${facilityId}/overbooking`,
              { enabled: next },
              false,
              "PUT",
            )
          )
            onSaved();
        }}
      />
      <ErrorMessage text={cmd.error} />
    </div>
  );
}
