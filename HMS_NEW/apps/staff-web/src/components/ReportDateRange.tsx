import { useState } from "react";
import { DateRangePicker } from "./arc/date-range-picker/date-range-picker";
import { formatReportDay, parseReportDay } from "@/hms/arc-report-range";
import { DateRangeField } from "./date-controls";
import { Button } from "./arc/button/button";
import { useCalendarToday } from "./use-calendar-today";

export function ReportDateRange({ from, to, timezone, onChange }: {
  from: string; to: string; timezone?: string;
  onChange: (value: { from: string; to: string }) => void;
}) {
  // The query briefly clears its response during a filter refresh; retain the
  // last server-confirmed timezone within this clinic's mounted workspace.
  const [knownTimezone, setKnownTimezone] = useState(timezone);
  if (timezone && timezone !== knownTimezone) setKnownTimezone(timezone);
  const effectiveTimezone = timezone ?? knownTimezone;
  const today = useCalendarToday(effectiveTimezone);
  const start = parseReportDay(from), end = parseReportDay(to);
  if (!today) return <DateRangeField from={from} to={to} onChange={onChange} boundaryLabel="Organisation timezone unavailable" />;
  return <div className="workspace-field arc-report-field">
    <span className="workspace-control-label">Date range</span>
    <div className="arc-demo-scope">
      <DateRangePicker className="arc-report-picker" label="Activity date range" placeholder="All dates" value={start && end ? { start, end } : null}
        today={today} onChange={(range) => onChange({ from: formatReportDay(range.start), to: formatReportDay(range.end) })} />
    </div>
    <div className="arc-demo-scope flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{effectiveTimezone} · inclusive</span>
      {(from || to) && <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ from: "", to: "" })}>All dates</Button>}
    </div>
  </div>;
}
