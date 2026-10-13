/** Calendar dates stay date-only: UTC here is arithmetic, never the clinic's instant. */
export function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(stamp) &&
    new Date(stamp).toISOString().slice(0, 10) === value
  );
}
export function shiftDay(value: string, days: number) {
  if (!validDay(value) || !Number.isInteger(days)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function localToday(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function dateRangeError(from: string, to: string) {
  if ((from && !validDay(from)) || (to && !validDay(to)))
    return "Choose complete calendar dates.";
  return from && to && from > to
    ? "The end date must be on or after the start date."
    : undefined;
}
export function timeRangeError(start: string, end: string) {
  const valid = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  if ((start && !valid(start)) || (end && !valid(end)))
    return "Choose complete times.";
  return start && end && start >= end
    ? "The end time must be after the start time."
    : undefined;
}
export function dayInBounds(value: string, min?: string, max?: string) {
  return validDay(value) && (!min || value >= min) && (!max || value <= max);
}
