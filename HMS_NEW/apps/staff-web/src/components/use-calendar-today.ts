import { useCallback, useSyncExternalStore } from "react";
import { formatReportDay, parseReportDay, reportToday } from "@/hms/arc-report-range";
const subscribeDay = (notify: () => void) => {
  const timer = window.setInterval(notify, 1000);
  window.addEventListener("focus", notify);
  document.addEventListener("visibilitychange", notify);
  return () => { window.clearInterval(timer); window.removeEventListener("focus", notify); document.removeEventListener("visibilitychange", notify); };
};
const serverDay = () => "";
/** Calendar days follow the supplied organisation zone, including midnight and wake-up. */
export function useCalendarToday(timezone?: string) {
  const readDay = useCallback(() => {
    const day = reportToday(timezone);
    return day ? formatReportDay(day) : "";
  }, [timezone]);
  return parseReportDay(useSyncExternalStore(subscribeDay, readDay, serverDay));
}
