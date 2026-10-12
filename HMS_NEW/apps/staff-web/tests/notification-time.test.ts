import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clinicDateInput,
  clinicDateInstant,
} from "../src/hms/notification-time.ts";
test("follow-up form converts the selected clinic time independently of computer timezone", () => {
  assert.equal(
    clinicDateInstant("2026-11-01T10:00", "Asia/Kolkata"),
    "2026-11-01T04:30:00.000Z",
  );
  assert.equal(
    clinicDateInput(new Date("2026-11-01T04:30:00Z"), "Asia/Kolkata"),
    "2026-11-01T10:00",
  );
});
test("ambiguous or missing clinic clock times require another explicit time", () => {
  assert.throws(() =>
    clinicDateInstant("2026-03-08T02:30", "America/New_York"),
  );
  assert.throws(() =>
    clinicDateInstant("2026-11-01T01:30", "America/New_York"),
  );
  assert.throws(() => clinicDateInstant("2026-02-30T10:00", "Asia/Kolkata"));
  assert.throws(() => clinicDateInstant("2026-11", "Asia/Kolkata"));
});
