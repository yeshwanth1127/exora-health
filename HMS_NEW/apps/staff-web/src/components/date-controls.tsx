import { Tooltip } from "./arc/tooltip/tooltip";
import { TimeField } from "./WorkspaceFields";
import { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./arc/button/button";
import { DatePicker } from "./arc/date-picker/date-picker";
import { parseReportDay, formatReportDay } from "@/hms/arc-report-range";
import { useCalendarToday } from "./use-calendar-today";
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
  const calendarToday = useCalendarToday(timezone);
  const current = timezone ? localToday(timezone) : "";
  return <div className="arc-demo-scope arc-day-navigation">
    <div className="flex items-end gap-2">
      <div className="w-52">
        <DatePicker id={id} label={label} value={parseReportDay(value) ?? undefined}
          today={calendarToday ?? undefined} clearable={allowClear} placeholder="All dates"
          minDate={parseReportDay(min ?? "") ?? undefined} maxDate={parseReportDay(max ?? "") ?? undefined}
          disabled={disabled} showToday={!!timezone}
          onChange={(day) => {
            const nextValue = day ? formatReportDay(day) : "";
            if ((!nextValue && allowClear) || dayInBounds(nextValue, min, max)) onChange(nextValue);
          }} />
      </div>
      <Tooltip content={`Previous ${label.toLowerCase()}`}><Button type="button" variant="secondary" className="arc-icon-control" aria-label={`Previous ${label.toLowerCase()}`}
        disabled={disabled || !dayInBounds(prev, min, max)} onClick={() => onChange(prev)}><ChevronLeft size={16} /></Button></Tooltip>
      <Tooltip content={`Next ${label.toLowerCase()}`}><Button type="button" variant="secondary" className="arc-icon-control" aria-label={`Next ${label.toLowerCase()}`}
        disabled={disabled || !dayInBounds(next, min, max)} onClick={() => onChange(next)}><ChevronRight size={16} /></Button></Tooltip>
      {timezone && <Button type="button" variant="secondary" disabled={disabled || !dayInBounds(current, min, max)} onClick={() => onChange(current)}>Today</Button>}
      {allowClear && value && <Button type="button" variant="ghost" disabled={disabled} onClick={() => onChange("")}>All dates</Button>}
    </div>
    {(boundaryLabel || timezone) && <p className="mt-2 text-xs text-muted-foreground">{boundaryLabel ?? timezone}</p>}
  </div>;
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
        <TimeField label="Start time" id={`${id}-start`} value={start}
          disabled={disabled} required={required} onValueChange={(value) => onChange({ start: value, end })} />
      </SharedField>
      <SharedField
        label="End time"
        id={`${id}-end`}
        hint={timezone}
        error={timeRangeError(start, end)}
        required={required}
        submitted={submitted}
      >
        <TimeField label="End time" id={`${id}-end`} value={end}
          disabled={disabled} required={required} onValueChange={(value) => onChange({ end: value, start })} />
      </SharedField>
    </div>
  );
}
