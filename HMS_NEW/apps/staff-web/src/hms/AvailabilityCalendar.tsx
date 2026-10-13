import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adjacentMonth, monthDays } from "./availability-calendar";
import { appointmentModeLabel, type AppointmentMode } from "./booking-workflow";
import type { Slot } from "./types";

export function AvailabilityCalendar({
  date,
  today,
  mode,
  days,
  loading,
  failed,
  disabled,
  onSelect,
}: {
  date: string;
  today: string;
  mode: AppointmentMode;
  days: Map<string, { available: Slot[]; published: number }>;
  loading: boolean;
  failed: boolean;
  disabled: boolean;
  onSelect: (date: string) => void;
}) {
  const month = date.slice(0, 7);
  const dates = monthDays(month);
  const first = new Date(`${dates[0]}T12:00:00Z`);
  const blanks = (first.getUTCDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(first);
  const fullDate = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeZone: "UTC",
  });
  return (
    <section
      aria-label={`${appointmentModeLabel(mode)} availability calendar`}
      className="rounded-lg border p-4 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Choose a day</h3>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {monthLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="outline"
            aria-label="Previous month"
            disabled={disabled || month <= today.slice(0, 7)}
            onClick={() =>
              onSelect(
                adjacentMonth(month, -1) === today.slice(0, 7)
                  ? today
                  : `${adjacentMonth(month, -1)}-01`,
              )
            }
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label="Next month"
            disabled={disabled}
            onClick={() => onSelect(`${adjacentMonth(month, 1)}-01`)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {loading
          ? "Checking this doctor’s availability…"
          : failed
            ? "Availability could not be loaded. Retry below."
            : "Open times are shown on each day. All times use the clinic’s timezone."}
      </p>
      <div
        className="grid grid-cols-7 gap-1"
        role="group"
        aria-label={`${monthLabel} dates`}
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span
            key={day}
            className="pb-1 text-center text-xs text-muted-foreground"
          >
            {day}
          </span>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {dates.map((day) => {
          const availability = days.get(day);
          const count = availability?.available.length ?? 0;
          const past = day < today;
          const caption = past
            ? "Past"
            : loading
              ? "Checking"
              : failed
                ? "Unavailable"
                : count
                  ? `${count} open`
                  : availability?.published
                    ? "No open times"
                    : "No hours";
          return (
            <button
              key={day}
              type="button"
              aria-pressed={day === date}
              aria-label={`${fullDate.format(new Date(`${day}T12:00:00Z`))}, ${caption}`}
              disabled={disabled || loading || failed || past}
              onClick={() => onSelect(day)}
              className={`min-h-16 rounded-md border px-1 py-2 text-center transition-colors disabled:opacity-40 ${day === date ? "border-blue-600 bg-blue-600 text-white" : count ? "border-emerald-200 bg-background hover:border-emerald-600" : "border-transparent text-muted-foreground hover:bg-muted"}`}
            >
              <span className="block text-sm font-semibold">
                {Number(day.slice(-2))}
              </span>
              <span className="mt-1 block text-xs leading-tight">
                {caption}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
