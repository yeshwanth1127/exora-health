import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarMonths, calendarYears, changeCalendarMonth } from "../src/components/arc/calendar/calendar-navigation.ts";

test("DOB year choices jump directly to an older year and retain persisted dates outside the usual range", () => {
  const current = new Date(2026, 9, 18);
  const years = calendarYears(current, current);
  assert.equal(years[0].value, "2026");
  assert.ok(years.some((year) => year.value === "1968"));
  assert.ok(calendarYears(new Date(1880, 1, 1), current).some((year) => year.value === "1880"));
  assert.equal(calendarMonths()[1].label, "February");
  assert.equal(calendarMonths().length, 12);
  const next = changeCalendarMonth(current, 1968, 1);
  assert.deepEqual([next.getFullYear(), next.getMonth(), next.getDate()], [1968, 1, 1]);
  assert.equal(current.getFullYear(), 2026);
});
test("changing the DOB caption resets the displayed month safely from a 31st day", () => {
  const month = new Date(2024, 0, 31);
  const next = changeCalendarMonth(month, 2023, 1);
  assert.deepEqual([next.getFullYear(), next.getMonth(), next.getDate()], [2023, 1, 1]);
  assert.equal(changeCalendarMonth(month, NaN, 1), month);
  assert.deepEqual(calendarYears(month, undefined, new Date(2000, 0, 1), new Date(2002, 0, 1)).map((year) => year.value), ["2002", "2001", "2000"]);
});
