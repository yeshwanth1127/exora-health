import { DatePicker } from "./arc/date-picker/date-picker";
import { parseReportDay, formatReportDay } from "@/hms/arc-report-range";
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
  const { field, ...attributes } = useAttributes(id);
  // Keep an existing unsupported calling code intact instead of reinterpreting it.
  const parsed = value ? parsePhoneNumber(value) : null;
  const unsupported = !!value && (!parsed || `+${parsed.country.dial}${parsed.national}` !== value);
  return <FieldShell label={label} id={attributes.id}><div className="arc-demo-scope">
    {unsupported ? <Input id={attributes.id} aria-label={label} type="tel" value={value} required={required ?? field?.required}
      disabled={disabled} onChange={(event) => onValueChange(event.target.value)} onBlur={onBlur} />
      : <PhoneInput {...attributes} label={label} hideLabel value={value} onValueChange={onValueChange}
          defaultCountry="IN" preferredCountries={["IN"]} disabled={disabled} required={required ?? field?.required}
          error={error} onBlur={onBlur} />}
    <input className="sr-only" aria-hidden="true" tabIndex={-1} type="tel" value={value} disabled={disabled} onChange={() => {}}
      required={required ?? field?.required} pattern="\+[1-9][0-9]{6,14}"
      onInvalid={(event) => { event.preventDefault(); document.getElementById(attributes.id)?.focus(); }} />
  </div></FieldShell>;
}
export function MoneyField({ label = "Fee", id, value, onValueChange, disabled }: {
  label?: string; id?: string; value: number | null; onValueChange: (value: number | null) => void; disabled?: boolean;
}) {
  const { field: _field, ...attributes } = useAttributes(id);
  return <FieldShell label={label} id={attributes.id}><div className="arc-demo-scope">
    <MoneyInput className="arc-money-field" {...attributes} label={label} hideLabel value={value} onValueChange={onValueChange}
      currency="INR" currencies={["INR"]} locale="en-IN" quickAdd={[]} min={0} max={99_999_999} disabled={disabled} />
  </div></FieldShell>;
}
export function TimeField({ label = "Time", id, value, onValueChange, disabled, required }: {
  label?: string; id?: string; value: string; onValueChange: (value: string) => void; disabled?: boolean; required?: boolean;
}) {
  const { field, ...attributes } = useAttributes(id);
  return <FieldShell label={label} id={attributes.id}><div className="arc-demo-scope">
    <TimePicker {...attributes} label={label} hideLabel value={value} onChange={onValueChange} format="24h" minuteStep={1}
      disabled={disabled} aria-required={required ?? field?.required} />
    <input className="sr-only" aria-hidden="true" tabIndex={-1} type="time" value={value} onChange={() => {}}
      required={required ?? field?.required} disabled={disabled}
      onInvalid={(event) => { event.preventDefault(); document.getElementById(attributes.id)?.focus(); }} />
  </div></FieldShell>;
}

/** Calendar-day values stay YYYY-MM-DD; no UTC conversion is involved. */
export function DateField({ label = "Date", id, value, onValueChange, disabled, required, min, max }: {
  label?: string; id?: string; value: string; onValueChange: (value: string) => void;
  disabled?: boolean; required?: boolean; min?: string; max?: string;
}) {
  const { field, ...attributes } = useAttributes(id);
  return <FieldShell label={label} id={attributes.id}><div className="arc-demo-scope">
    <DatePicker {...attributes} className="arc-date-field" hideLabel label={label}
      value={parseReportDay(value) ?? undefined} onChange={(date) => onValueChange(date ? formatReportDay(date) : "")}
      placeholder="Select a date" clearable={!(required ?? field?.required)} disabled={disabled}
      minDate={parseReportDay(min ?? "") ?? undefined} maxDate={parseReportDay(max ?? "") ?? undefined} />
    <input className="sr-only" aria-hidden="true" tabIndex={-1} type="date" value={value} onChange={() => {}}
      required={required ?? field?.required} disabled={disabled} min={min} max={max}
      onInvalid={(event) => { event.preventDefault(); document.getElementById(attributes.id)?.focus(); }} />
  </div></FieldShell>;
}
