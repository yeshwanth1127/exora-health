import { useState } from "react";
import { DateField, TimeField } from "@/components/WorkspaceFields";

const parts = (value: string) => ({
  day: value.split("T")[0] ?? "",
  time: value.split("T")[1] ?? "",
});

/** Same local, minute-precision value as datetime-local; never convert it to UTC. */
export function GrowthDateTime({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(() => ({
    source: value,
    ...parts(value),
  }));
  if (draft.source !== value) setDraft({ source: value, ...parts(value) });
  function change(next: { day: string; time: string }) {
    // Retain the partial edit visibly, while existing scheduling validation sees
    // an empty value until both parts are complete, as with datetime-local.
    const result = next.day && next.time ? `${next.day}T${next.time}` : "";
    setDraft({ source: result, ...next });
    onValueChange(result);
  }
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-52">
        <DateField
          label={`${label}: date`}
          value={draft.day}
          onValueChange={(day) => change({ day, time: draft.time })}
        />
      </div>
      <div className="w-44">
        <TimeField
          label={`${label}: time`}
          value={draft.time}
          onValueChange={(time) => change({ day: draft.day, time })}
        />
      </div>
    </div>
  );
}
