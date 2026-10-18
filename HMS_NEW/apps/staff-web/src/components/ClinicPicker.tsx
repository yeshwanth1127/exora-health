import { useState } from "react";
import { Combobox } from "./arc/combobox/combobox";

/** Clearing is a selection draft; workspace scope changes only after choosing a valid clinic. */
export function ClinicPicker({ value, options, onChange }: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [cleared, setCleared] = useState(false);
  const current = options.find((option) => option.value === value)?.label;
  return <div className="arc-demo-scope w-52">
    <Combobox label="Clinic" value={cleared ? "" : value} options={options}
      placeholder="Choose clinic to switch…"
      description={cleared ? `Still viewing ${current}. Choose a clinic to switch.` : undefined}
      onValueChange={(next) => {
        setCleared(!next);
        if (next && options.some((option) => option.value === next)) onChange(next);
      }} />
  </div>;
}
