import type { AppointmentMode } from "./booking-workflow";
import type { Slot } from "./types";

export function monthDays(month: string) {
  const start = new Date(`${month}-01T12:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return Array.from(
    { length: end.getUTCDate() },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}

export function adjacentMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

/** Month reads stay within the API's 31-day bound and exclude past clinic dates. */
export function monthRange(month: string, today: string) {
  const days = monthDays(month);
  return { from: days[0] < today ? today : days[0], to: days.at(-1)! };
}

/** Availability is mode- and clinic-specific, grouped by clinic date rather than UTC date. */
export function dailyAvailability(
  slots: Slot[],
  mode: AppointmentMode,
  facilityId: string,
  timezone: string,
  now: number,
) {
  const days = new Map<string, { available: Slot[]; published: number }>();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (const slot of slots) {
    if (
      slot.visitMode !== mode ||
      slot.facilityId !== facilityId ||
      Date.parse(slot.slotStart) <= now
    )
      continue;
    const day = date.format(new Date(slot.slotStart));
    const entry = days.get(day) ?? { available: [], published: 0 };
    entry.published++;
    if (slot.status === "free") entry.available.push(slot);
    days.set(day, entry);
  }
  for (const day of days.values())
    day.available.sort(
      (a, b) => Date.parse(a.slotStart) - Date.parse(b.slotStart),
    );
  return days;
}
