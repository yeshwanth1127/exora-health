/** Clinic-local form values never silently use the browser's timezone. */
export function clinicDateInput(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function clinicDateInstant(local: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Choose a complete clinic date and time.");
  const target = Date.parse(`${local}:00Z`);
  if (!Number.isFinite(target))
    throw new Error("Choose a valid clinic date and time.");
  const candidates = new Set<number>();
  for (const delta of [-86400000, 0, 86400000]) {
    const probe = target + delta;
    const formatted = clinicDateInput(new Date(probe), timezone);
    const offset =
      Date.parse(`${formatted}:00Z`) - Math.floor(probe / 60000) * 60000;
    const candidate = target - offset;
    if (clinicDateInput(new Date(candidate), timezone) === local)
      candidates.add(candidate);
  }
  if (candidates.size !== 1)
    throw new Error(
      "This clinic time is missing or ambiguous. Choose a different time.",
    );
  return new Date([...candidates][0]).toISOString();
}
