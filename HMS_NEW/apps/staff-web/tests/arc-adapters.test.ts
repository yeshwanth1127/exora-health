import { test } from "node:test";
import assert from "node:assert/strict";
import { filterOptionValue, doctorFilterOptions } from "../src/hms/arc-filter-data.ts";
import { formatReportDay, parseReportDay, reportToday } from "../src/hms/arc-report-range.ts";

test("Arc display-label selections map back to exact API status and doctor identities", () => {
  assert.equal(filterOptionValue({ id: "status", label: "Booking status", value: "Checked in" }, {
    id: "status", label: "Booking status", options: [{ label: "Checked in", value: "checked_in" }],
  }), "checked_in");
  const doctors = doctorFilterOptions([{ staffId: "doctor-a", name: "Dr Shah" }, { staffId: "doctor-b", name: "Dr Shah" }]);
  assert.notEqual(doctors[0].label, doctors[1].label);
  assert.equal(filterOptionValue({ id: "doctor", label: "Doctor", value: doctors[1].label }, {
    id: "doctor", label: "Doctor", options: doctors,
  }), "doctor-b");
});
test("unknown or ambiguous filter labels cannot become query identities", () => {
  const field = { id: "doctor", label: "Doctor", options: [{ label: "Dr Shah", value: "a" }, { label: "Dr Shah", value: "b" }] };
  assert.equal(filterOptionValue({ id: "doctor", label: "Doctor", value: "Dr Shah" }, field), undefined);
  assert.equal(filterOptionValue({ id: "doctor", label: "Doctor", value: "missing" }, field), undefined);
});
test("report dates round trip as calendar days through DST and reject invalid dates", () => {
  for (const zone of ["Asia/Kolkata", "America/Los_Angeles", "Pacific/Auckland"]) {
    const before = process.env.TZ;
    process.env.TZ = zone;
    try {
      for (const day of ["2026-03-08", "2026-11-01", "2028-02-29", "2026-12-31"]) {
        assert.equal(formatReportDay(parseReportDay(day)!), day);
      }
      assert.equal(parseReportDay("2026-02-29"), null);
      assert.equal(parseReportDay("2026-13-01"), null);
      assert.equal(parseReportDay(""), null);
    } finally {
      if (before === undefined) delete process.env.TZ; else process.env.TZ = before;
    }
  }
});
test("report Today uses the organisation timezone and never fabricates an unknown timezone", () => {
  const instant = new Date("2026-10-18T22:00:00Z");
  assert.equal(formatReportDay(reportToday("Asia/Kolkata", instant)!), "2026-10-19");
  assert.equal(formatReportDay(reportToday("America/Los_Angeles", instant)!), "2026-10-18");
  assert.equal(reportToday(undefined, instant), null);
  assert.equal(reportToday("Invalid/Timezone", instant), null);
});
