import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adjacentMonth,
  monthDays,
  monthRange,
  dailyAvailability,
} from "../src/hms/availability-calendar.ts";
import type { Slot } from "../src/hms/types.ts";

test("calendar month ranges stay inside the slots API bound including leap days and year boundaries", () => {
  assert.equal(monthDays("2028-02").length, 29);
  assert.equal(monthDays("2026-02").length, 28);
  assert.equal(adjacentMonth("2026-12", 1), "2027-01");
  assert.equal(adjacentMonth("2027-01", -1), "2026-12");
  assert.deepEqual(monthRange("2026-10", "2026-10-12"), {
    from: "2026-10-12",
    to: "2026-10-31",
  });
  for (const month of ["2026-11", "2026-12", "2027-01", "2028-02"]) {
    const range = monthRange(month, "2026-10-12");
    assert.ok(Date.parse(range.to) - Date.parse(range.from) <= 31 * 86400000);
  }
});

test("available dates use the clinic day and exclude other clinics, modes, past times and occupied slots", () => {
  const slot = (
    slotStart: string,
    status = "free",
    visitMode = "virtual",
    facilityId = "clinic",
  ) => ({ slotStart, status, visitMode, facilityId }) as Slot;
  const days = dailyAvailability(
    [
      slot("2026-10-12T23:30:00Z"), // Oct13 in clinic timezone
      slot("2026-10-13T04:00:00Z", "taken"),
      slot("2026-10-14T04:00:00Z", "blocked"),
      slot("2026-10-14T04:15:00Z", "held"),
      slot("2026-10-15T04:00:00Z", "free", "in_person"),
      slot("2026-10-16T04:00:00Z", "free", "virtual", "another-clinic"),
      slot("2026-10-12T04:00:00Z"),
    ],
    "virtual",
    "clinic",
    "Asia/Kolkata",
    Date.parse("2026-10-12T05:00:00Z"),
  );
  assert.deepEqual([...days.keys()], ["2026-10-13", "2026-10-14"]);
  assert.equal(days.get("2026-10-13")?.available.length, 1);
  assert.equal(days.get("2026-10-13")?.published, 2);
  assert.equal(days.get("2026-10-14")?.available.length, 0);
  assert.equal(days.get("2026-10-14")?.published, 2);
});
