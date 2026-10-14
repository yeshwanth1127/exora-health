import { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SharedField } from "./shared-field";
import {
  dateRangeError,
  dayInBounds,
  localToday,
  shiftDay,
  timeRangeError,
} from "./date-controls-model";

/** Browser date picker plus typed date and keyboard-accessible navigation. No availability is implied. */
export function DayNavigator({
  value,
  onChange,
  timezone,
  boundaryLabel,
  label = "Day",
  min,
  max,
  disabled,
  allowClear = false,
}: {
  value: string;
  onChange: (value: string) => void;
  timezone?: string;
  boundaryLabel?: string;
  label?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  const id = useId(),
    prev = shiftDay(value, -1),
    next = shiftDay(value, 1);
  const current = timezone ? localToday(timezone) : "";
  return (
    <SharedField label={label} id={id} hint={boundaryLabel ?? timezone}>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Previous ${label.toLowerCase()}`}
          disabled={disabled || !dayInBounds(prev, min, max)}
          onClick={() => onChange(prev)}
        >
          <ChevronLeft />
        </Button>
        <Input
          id={id}
          type="date"
          className="w-40"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => {
            if (
              (!e.target.value && allowClear) ||
              dayInBounds(e.target.value, min, max)
            )
              onChange(e.target.value);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Next ${label.toLowerCase()}`}
          disabled={disabled || !dayInBounds(next, min, max)}
          onClick={() => onChange(next)}
        >
          <ChevronRight />
        </Button>
        {timezone && (
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !dayInBounds(current, min, max)}
            onClick={() => onChange(current)}
          >
            Today
          </Button>
        )}
        {allowClear && value && (
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => onChange("")}
          >
            All dates
          </Button>
        )}
      </div>
    </SharedField>
  );
}
export function DateRangeField({
  from,
  to,
  onChange,
  timezone,
  boundaryLabel,
  disabled,
  min,
  max,
  required,
  submitted,
}: {
  from: string;
  to: string;
  onChange: (value: { from: string; to: string }) => void;
  timezone?: string;
  boundaryLabel?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  required?: boolean;
  submitted?: boolean;
}) {
  const id = useId(),
    error = dateRangeError(from, to);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <SharedField
          label="From"
          id={`${id}-from`}
          error={error}
          required={required}
          submitted={submitted}
        >
          <Input
            id={`${id}-from`}
            aria-describedby={
              boundaryLabel || timezone ? `${id}-boundary` : undefined
            }
            type="date"
            value={from}
            min={min}
            max={max}
            required={required}
            disabled={disabled}
            onChange={(e) => onChange({ from: e.target.value, to })}
          />
        </SharedField>
        <SharedField
          label="To"
          id={`${id}-to`}
          required={required}
          error={error}
          submitted={submitted}
        >
          <Input
            id={`${id}-to`}
            aria-describedby={
              boundaryLabel || timezone ? `${id}-boundary` : undefined
            }
            type="date"
            value={to}
            min={from || min}
            max={max}
            required={required}
            disabled={disabled}
            onChange={(e) => onChange({ from, to: e.target.value })}
          />
        </SharedField>
      </div>
      {(boundaryLabel || timezone) && (
        <p id={`${id}-boundary`} className="text-sm text-muted-foreground">
          Both selected dates are included · {boundaryLabel ?? timezone}
        </p>
      )}
    </div>
  );
}
export function TimeRangeField({
  start,
  end,
  onChange,
  timezone,
  disabled,
  required = true,
  submitted,
}: {
  start: string;
  end: string;
  onChange: (value: { start: string; end: string }) => void;
  timezone?: string;
  disabled?: boolean;
  required?: boolean;
  submitted?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-2 gap-3">
      <SharedField
        label="Start time"
        id={`${id}-start`}
        error={timeRangeError(start, end)}
        hint={timezone}
        required={required}
        submitted={submitted}
      >
        <Input
          id={`${id}-start`}
          type="time"
          value={start}
          disabled={disabled}
          required={required}
          onChange={(e) => onChange({ start: e.target.value, end })}
        />
      </SharedField>
      <SharedField
        label="End time"
        id={`${id}-end`}
        hint={timezone}
        error={timeRangeError(start, end)}
        required={required}
        submitted={submitted}
      >
        <Input
          id={`${id}-end`}
          type="time"
          value={end}
          disabled={disabled}
          required={required}
          onChange={(e) => onChange({ start, end: e.target.value })}
        />
      </SharedField>
    </div>
  );
}
