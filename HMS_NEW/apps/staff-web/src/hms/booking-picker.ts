// Data mapping for BookingPicker (Availability picker in Booking).
import type { PickerDay } from "@/components/arc/availability-picker/availability-picker";
import type { Slot } from "./types";

export const PICKER_DAYS = 10;

// The picker works in the demo's 24-hour "HH:MM" (it adds the duration to it).
export const hhmm = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

export function pickerDays(availability: Map<string, { available: Slot[]; taken?: Slot[] }>, timezone: string) {
  const day = (d: string, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...o }).format(new Date(`${d}T12:00:00Z`));
  return [...availability.entries()]
    .filter(([, v]) => v.available.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, PICKER_DAYS)
    .map(([d, v]) => ({
      day: {
        id: d,
        short: day(d, { weekday: "short" }),
        date: day(d, { day: "numeric" }),
        full: day(d, { weekday: "long", day: "numeric", month: "long" }),
        // Taken times show struck through, as in the Booking pill's time step.
        slots: [...v.available.map((s) => ({ s, busy: undefined as string | undefined })), ...(v.taken ?? []).map((s) => ({ s, busy: "taken" }))]
          .sort((a, b) => Date.parse(a.s.slotStart) - Date.parse(b.s.slotStart))
          .map(({ s, busy }) => ({ time: hhmm(s.slotStart, timezone), ...(busy && { busy }) })),
      } satisfies PickerDay,
      slots: v.available,
    }));
}
