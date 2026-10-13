import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clinicCode,
  clinicStates,
  stateChoices,
  validTimezone,
} from "../src/hms/clinic-location";
test("human state selection preserves the backend's exact two-digit code", () => {
  assert.equal(clinicStates.find((s) => s.label === "Karnataka")?.value, "29");
  assert.equal(
    clinicStates.find((s) => s.label === "Andhra Pradesh")?.value,
    "37",
  );
  assert.equal(clinicStates.find((s) => s.label === "Delhi")?.value, "07");
});
test("unknown persisted state code stays selectable without silent remapping", () => {
  assert.deepEqual(
    stateChoices("28").find((s) => s.value === "28"),
    { value: "28", label: "Saved state code 28" },
  );
  assert.equal(
    stateChoices("").some((s) => s.value === ""),
    false,
  );
});
test("suggested clinic code uses the current API alphabet and limit", () => {
  assert.equal(clinicCode("  South Clinic / 2  "), "SOUTH-CLINIC-2");
  assert.equal(clinicCode("a".repeat(60)).length, 30);
});
test("time zone guidance validates IANA zones and rejects unknown values", () => {
  assert.equal(validTimezone("Asia/Kolkata"), true);
  assert.equal(validTimezone("UTC"), true);
  assert.equal(validTimezone(""), false);
  assert.equal(validTimezone("India"), false);
});
