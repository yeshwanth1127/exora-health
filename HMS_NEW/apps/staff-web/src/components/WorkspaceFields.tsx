import { useId } from "react";
import { PhoneInput, parsePhoneNumber } from "./arc/phone-input/phone-input";
import { MoneyInput } from "./arc/money-input/money-input";
import { TimePicker } from "./arc/time-picker/time-picker";
import { Input } from "./ui/input";
import { useFieldContext } from "./field-context";
import { SharedField } from "./shared-field";
import { describedBy } from "./form-feedback";
import type { ReactNode } from "react";

function FieldShell({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  const field = useFieldContext();
  return field?.controlId === id ? children : <SharedField label={label} id={id}>{children}</SharedField>;
}
function useAttributes(id?: string) {
  const generated = useId();
  const field = useFieldContext();
  return { id: id ?? field?.controlId ?? generated, field,
    "aria-required": field?.required,
    "aria-invalid": field?.invalid || undefined,
    "aria-describedby": describedBy(field?.descriptionId, field?.errorId) };
}
export function PhoneField({ label = "Phone", id, value, onValueChange, disabled, required, error, onBlur }: {
  label?: string; id?: string; value: string; onValueChange: (value: string) => void;
  disabled?: boolean; required?: boolean; error?: string; onBlur?: () => void;
}) {
  const attributes = useAttributes(id);
  // Keep an existing unsupported calling code intact instead of reinterpreting it.
  const parsed = value ? parsePhoneNumber(value) : null;
  const unsupported = !!value && (!parsed || `+${parsed.country.dial}${parsed.national}` !== value);
  return <FieldShell label={label} id={attributes.id}><div className="arc-demo-scope">
    {unsupported ? <Input id={attributes.id} aria-label={label} type="tel" value={value} required={required ?? attributes.field?.required}
      disabled={disabled} onChange={(event) => onValueChange(event.target.value)} onBlur={onBlur} />
      : <PhoneInput {...attributes} label={label} hideLabel value={value} onValueChange={onValueChange}
          defaultCountry="IN" preferredCountries={["IN"]} disabled={disabled} required={required ?? attributes.field?.required}
          error={error} onBlur={onBlur} />}
    <input className="sr-only" aria-hidden="true" tabIndex={-1} type="tel" value={value} disabled={disabled} onChange={() => {}}
      required={required ?? attributes.field?.required} pattern="\+[1-9][0-9]{6,14}"
      onInvalid={(event) => { event.preventDefault(); document.getElementById(attributes.id)?.focus(); }} />
  </div></FieldShell>;
}
export function MoneyField({ label = "Fee", id, value, onValueChange, disabled }: {
  label?: string; id?: string; value: number | null; onValueChange: (value: number | null) => void; disabled?: boolean;
}) {
  const attributes = useAttributes(id);
  return <FieldShell label={label} id={attributes.id}><div className="arc-demo-scope">
    <MoneyInput className="arc-money-field" {...attributes} label={label} hideLabel value={value} onValueChange={onValueChange}
      currency="INR" currencies={["INR"]} locale="en-IN" quickAdd={[]} min={0} max={99_999_999} disabled={disabled} />
  </div></FieldShell>;
}
export function TimeField({ label = "Time", id, value, onValueChange, disabled, required }: {
  label?: string; id?: string; value: string; onValueChange: (value: string) => void; disabled?: boolean; required?: boolean;
}) {
  const attributes = useAttributes(id);
  return <FieldShell label={label} id={attributes.id}><div className="arc-demo-scope">
    <TimePicker {...attributes} label={label} hideLabel value={value} onChange={onValueChange} format="24h" minuteStep={1}
      disabled={disabled} aria-required={required ?? attributes.field?.required} />
    <input className="sr-only" aria-hidden="true" tabIndex={-1} type="time" value={value} onChange={() => {}}
      required={required ?? attributes.field?.required} disabled={disabled}
      onInvalid={(event) => { event.preventDefault(); document.getElementById(attributes.id)?.focus(); }} />
  </div></FieldShell>;
}
