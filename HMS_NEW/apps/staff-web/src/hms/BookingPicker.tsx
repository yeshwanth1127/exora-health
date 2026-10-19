// Arc Pro Availability picker in the booking slot step (approved 18 Oct 2026): one doctor's next ten days with open
// times from the chosen start date; confirming places the real slot hold.
import { AvailabilityPicker, type PickerCopy } from "@/components/arc/availability-picker/availability-picker";
import { appointmentModeLabel, type AppointmentMode } from "./booking-workflow";
import type { Slot } from "./types";
import { hhmm, type pickerDays } from "./booking-picker";

export function BookingPicker({
  doctor,
  mode,
  timezone,
  days,
  held,
  disabled,
  onSelect,
  onHold,
}: {
  doctor: string;
  mode: AppointmentMode;
  timezone: string;
  days: ReturnType<typeof pickerDays>;
  held: boolean;
  disabled: boolean;
  onSelect: (date: string) => void;
  onHold: (slot: Slot, date: string) => void;
}) {
  const first = days[0]?.slots[0];
  const minutes = first ? Math.round((Date.parse(first.slotEnd) - Date.parse(first.slotStart)) / 60_000) : 30;
  const copy: PickerCopy = {
    free: "Open for booking",
    busy: () => "Not available",
    conflict: () => "Not available",
    done: "Slot held for this booking",
    confirm: "Hold this time",
    confirmed: "Held",
    dayOpen: (n) => `${n} open ${n === 1 ? "time" : "times"}`,
  };
  const slotAt = (date: string, at: string) =>
    days.find((d) => d.day.id === date)?.slots.find((s) => hhmm(s.slotStart, timezone) === at);
  return (
    <AvailabilityPicker
      title={`${appointmentModeLabel(mode)} with ${doctor}`}
      subtitle={`${minutes} minutes · ${timezone} time`}
      attendees={[{ name: doctor, first: doctor }]}
      days={days.map((d) => d.day)}
      weekLabel={`Next ${days.length} days with open times for ${doctor}`}
      durationMin={minutes}
      copy={copy}
      confirmed={held}
      disabled={disabled}
      onSelect={({ day }) => onSelect(day)}
      onConfirm={({ day, time: at }) => {
        const slot = slotAt(day, at);
        if (slot) onHold(slot, day);
      }}
    />
  );
}
