import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/arc/input/input";
import {
  birthDateParts,
  parseBirthDate,
  type BirthDateParts,
} from "./birth-date";
import { useUnsaved } from "./leave";
import { today } from "./model";
import { useWorkspace } from "./hooks";

/** Direct keyboard entry, specifically requested for DOB; appointment calendars are unchanged. */
export function BirthDateField({
  id,
  label = "Date of birth (optional)",
  value,
  onValueChange,
  disabled,
}: {
  id: string;
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { facility } = useWorkspace();
  const [parts, setParts] = useState(() => birthDateParts(value));
  const [touched, setTouched] = useState(false);
  const emitted = useRef(value);
  const dayInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setParts(birthDateParts(value));
    }
  }, [value]);
  const parsed = parseBirthDate(parts, today(facility.timezone));
  useEffect(() => {
    dayInput.current?.setCustomValidity(parsed.error);
  }, [parsed.error]);
  // Partial dates must neither be silently saved nor lost when leaving the form.
  useUnsaved(!disabled && !!parsed.error);
  function update(key: keyof BirthDateParts, text: string) {
    const next = {
      ...parts,
      [key]: text.replace(/\D/g, "").slice(0, key === "year" ? 4 : 2),
    };
    setParts(next);
    const result = parseBirthDate(next, today(facility.timezone));
    emitted.current = result.value;
    onValueChange(result.value);
  }
  return (
    <fieldset
      disabled={disabled}
      className="space-y-2"
      aria-describedby={`${id}-hint${touched && parsed.error ? ` ${id}-error` : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setTouched(true);
      }}
    >
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="arc-demo-scope grid max-w-sm grid-cols-[1fr_1fr_1.4fr] gap-3">
        <Input
          ref={dayInput}
          id={`${id}-day`}
          label="Day"
          placeholder="DD"
          inputMode="numeric"
          autoComplete="bday-day"
          maxLength={2}
          value={parts.day}
          onChange={(event) => update("day", event.target.value)}
          aria-invalid={touched && !!parsed.error}
        />
        <Input
          id={`${id}-month`}
          label="Month"
          placeholder="MM"
          inputMode="numeric"
          autoComplete="bday-month"
          maxLength={2}
          value={parts.month}
          onChange={(event) => update("month", event.target.value)}
          aria-invalid={touched && !!parsed.error}
        />
        <Input
          id={`${id}-year`}
          label="Year"
          placeholder="YYYY"
          inputMode="numeric"
          autoComplete="bday-year"
          maxLength={4}
          value={parts.year}
          onChange={(event) => update("year", event.target.value)}
          aria-invalid={touched && !!parsed.error}
        />
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Day / Month / Year. Leave all three empty if unknown.
      </p>
      {touched && parsed.error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {parsed.error}
        </p>
      )}
    </fieldset>
  );
}
