import { localToday } from "../components/date-controls-model";

/** Calendar dates, not UTC instants: keep the organisation's day through every round trip. */
export function parseReportDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(year, month - 1, date);
  return formatReportDay(value) === day ? value : null;
}
export function formatReportDay(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}
export function reportToday(timezone: string | undefined, now = new Date()): Date | null {
  if (!timezone) return null;
  try { return parseReportDay(localToday(timezone, now)); }
  catch { return null; }
}
