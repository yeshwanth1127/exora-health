import { Switch, type SwitchProps } from "@/components/arc/switch/switch";
import {
  Checkbox,
  type CheckboxProps,
} from "@/components/arc/checkbox/checkbox";

/** Reference tokens stay on the selected control rather than recolouring its row. */
export function GrowthSwitch({ className, ...props }: SwitchProps) {
  return (
    <Switch
      {...props}
      className={["arc-demo-scope", className].filter(Boolean).join(" ")}
    />
  );
}

export function GrowthCheckbox({
  onCheckedChange,
  ...props
}: Omit<CheckboxProps, "checked" | "defaultChecked" | "onCheckedChange"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <div className="arc-demo-scope shrink-0">
      <Checkbox
        {...props}
        onCheckedChange={(next) => onCheckedChange?.(next === true)}
      />
    </div>
  );
}
