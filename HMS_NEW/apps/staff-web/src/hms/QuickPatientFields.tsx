import { Input } from "@/components/arc/input/input";
import { PhoneField } from "@/components/WorkspaceFields";
import { E164 } from "./forms";
export type ArrivalPatient = { name: string; phone: string };
export const arrivalReady = (patient: ArrivalPatient) =>
  !!patient.name.trim() && (!patient.phone || E164.test(patient.phone));
export const arrivalBody = (patient: ArrivalPatient) => ({
  name: patient.name.trim(),
  ...(patient.phone ? { phone: patient.phone } : {}),
});
export function QuickPatientFields({
  value,
  onChange,
  disabled = false,
}: {
  value: ArrivalPatient;
  onChange: (value: ArrivalPatient) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add the patient’s name now. DOB and other details can be completed
        later. For a returning patient, use patient search to keep their
        existing record.
      </p>
      <div className="arc-demo-scope">
        <Input
          label="Patient name"
          id="arrival-name"
          required
          autoFocus
          maxLength={100}
          value={value.name}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </div>
      <PhoneField
        label="Phone (optional)"
        id="arrival-phone"
        value={value.phone}
        disabled={disabled}
        onValueChange={(phone) => onChange({ ...value, phone })}
      />
      {value.phone && !E164.test(value.phone) && (
        <p role="alert" className="text-sm text-destructive">
          Enter a valid phone with country code, or leave it empty.
        </p>
      )}
    </div>
  );
}
