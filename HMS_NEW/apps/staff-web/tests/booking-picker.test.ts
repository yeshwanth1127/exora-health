// Availability picker in Booking: slot data mapping.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
const opts = { parentURL: import.meta.url, tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)) };
const { pickerDays } = await tsImport("../src/hms/booking-picker.ts", opts);

test("picker shows up to ten open days in order, with clinic-time HH:MM and taken times marked", () => {
  const slot = (start: string) => ({ slotStart: start, slotEnd: start });
  const ids = Array.from({ length: 13 }, (_, n) => `2026-10-${String(19 + n).padStart(2, "0")}`);
  const availability = new Map(
    ids.map((d) => [
      d,
      d === "2026-10-20"
        ? { available: [], taken: [slot(`${d}T08:30:00Z`)] }
        : { available: [slot(`${d}T08:30:00Z`)], taken: [slot(`${d}T03:30:00Z`)] },
    ]),
  );
  const days = pickerDays(availability, "Asia/Kolkata");
  assert.equal(days.length, 10);
  assert.ok(!days.some((d: { day: { id: string } }) => d.day.id === "2026-10-20"), "a day with no free time is skipped");
  assert.equal(days[0].day.id, "2026-10-19");
  assert.deepEqual(days[0].day.slots, [{ time: "09:00", busy: "taken" }, { time: "14:00" }]);
  assert.equal(days[0].slots.length, 1, "only free slots can be held");
  assert.equal(days[0].day.short, "Mon");
});
