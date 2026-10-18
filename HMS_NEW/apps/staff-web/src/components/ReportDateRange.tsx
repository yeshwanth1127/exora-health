import { useCallback, useState, useSyncExternalStore } from "react";
import { DateRangePicker } from "./arc/date-range-picker/date-range-picker";
import { formatReportDay, parseReportDay, reportToday } from "@/hms/arc-report-range";
import { DateRangeField } from "./date-controls";
import { Button } from "./ui/button";

// Stable day snapshots update only at the organisation's midnight, including
// after a sleeping/background tab returns; a viewer in another zone stays in sync.
const subscribeDay = (notify: () => void) => {
  const timer = window.setInterval(notify, 1000);
  window.addEventListener("focus", notify);
  document.addEventListener("visibilitychange", notify);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", notify);
    document.removeEventListener("visibilitychange", notify);
  };
};
const serverDay = () => "";

export function ReportDateRange({ from, to, timezone, onChange }: {
  from: string; to: string; timezone?: string;
  onChange: (value: { from: string; to: string }) => void;
}) {
  // The query briefly clears its response during a filter refresh; retain the
  // last server-confirmed timezone within this clinic's mounted workspace.
  const [knownTimezone, setKnownTimezone] = useState(timezone);
  if (timezone && timezone !== knownTimezone) setKnownTimezone(timezone);
  const effectiveTimezone = timezone ?? knownTimezone;
  const readDay = useCallback(() => {
    const day = reportToday(effectiveTimezone);
    return day ? formatReportDay(day) : "";
  }, [effectiveTimezone]);
  const today = parseReportDay(useSyncExternalStore(subscribeDay, readDay, serverDay));
  const start = parseReportDay(from), end = parseReportDay(to);
  if (!today) return <DateRangeField from={from} to={to} onChange={onChange} boundaryLabel="Organisation timezone unavailable" />;
  return <div className="space-y-2">
    <div className="arc-demo-scope">
      <DateRangePicker label="Activity date range" placeholder="All dates" value={start && end ? { start, end } : null}
        today={today} onChange={(range) => onChange({ from: formatReportDay(range.start), to: formatReportDay(range.end) })} />
    </div>
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span>Both selected dates are included · Organisation dates · {effectiveTimezone}</span>
      {(from || to) && <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ from: "", to: "" })}>All dates</Button>}
    </div>
  </div>;
}
