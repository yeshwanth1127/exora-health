import { test } from "node:test";
import assert from "node:assert/strict";
import {
  visibleFieldError,
  nativeFieldError,
  describedBy,
  loadPresentation,
} from "../src/components/form-feedback.ts";
import {
  validDay,
  shiftDay,
  localToday,
  dateRangeError,
  timeRangeError,
  dayInBounds,
} from "../src/components/date-controls-model.ts";

test("local field errors wait for blur or submit, while server refusal is immediate", () => {
  assert.equal(visibleFieldError({ error: "Required" }), undefined);
  assert.equal(
    visibleFieldError({ error: "Required", touched: true }),
    "Required",
  );
  assert.equal(
    visibleFieldError({ error: "Required", submitted: true }),
    "Required",
  );
  assert.equal(
    visibleFieldError({ error: "Required", validationMode: "always" }),
    "Required",
  );
  assert.equal(
    visibleFieldError({ error: "Required", serverError: "Conflict" }),
    "Conflict",
  );
  assert.equal(visibleFieldError({ touched: true }), undefined);
});
test("feedback visibility does not discard required, numeric, date and link validation", () => {
  assert.ok(nativeFieldError({ value: " ", required: true }, "Name"));
  assert.ok(nativeFieldError({ value: 0, type: "number", min: 1 }, "Count"));
  assert.ok(nativeFieldError({ value: "NaN", type: "number" }, "Count"));
  assert.ok(
    nativeFieldError(
      { value: "2026-10-01", type: "date", min: "2026-10-02" },
      "Date",
    ),
  );
  assert.ok(nativeFieldError({ value: "example.com", type: "url" }, "Link"));
  assert.equal(
    nativeFieldError({ value: "https://example.com", type: "url" }, "Link"),
    undefined,
  );
  assert.equal(
    nativeFieldError({ value: "", required: true, disabled: true }, "Name"),
    undefined,
  );
});
test("description associations preserve external hints and remove hidden owned error ID", () => {
  assert.equal(
    describedBy(
      "external field-error external",
      "field-description",
      undefined,
      "field-error",
    ),
    "external field-description",
  );
  assert.equal(
    describedBy("external", "field-description", "field-error", "field-error"),
    "external field-description field-error",
  );
});
test("initial failures are terminal, refresh failures allow explicitly stale data, lost authorization hides rows", () => {
  assert.equal(
    loadPresentation({ loading: false, error: "Failed", data: null }),
    "error",
  );
  assert.equal(
    loadPresentation({ loading: false, error: "Failed", data: { items: [] } }),
    "stale",
  );
  for (const status of [401, 403, 404])
    assert.equal(
      loadPresentation({
        loading: false,
        error: "Failed",
        data: { items: [1] },
        failure: { status },
      }),
      "error",
    );
  assert.equal(
    loadPresentation({
      loading: false,
      error: "Failed",
      data: { items: [1] },
      failure: { code: "invalid_response" },
    }),
    "error",
  );
  assert.equal(loadPresentation({ loading: true }), "loading");
  assert.equal(
    loadPresentation({ loading: false, data: { items: [] } }),
    "ready",
  );
});
test("day navigation preserves plain dates across DST, leap days and month boundaries", () => {
  assert.equal(shiftDay("2026-03-08", 1), "2026-03-09");
  assert.equal(shiftDay("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDay("2026-02-30", 1), "");
  assert.equal(validDay("2026-2-3"), false);
});
test("Today is calculated in the declared clinic timezone independently of browser timezone", () => {
  const now = new Date("2026-10-13T00:30:00Z");
  assert.equal(localToday("Asia/Kolkata", now), "2026-10-13");
  assert.equal(localToday("America/Los_Angeles", now), "2026-10-12");
});
test("date and time ranges reject inversion and invalid values without converting to browser instants", () => {
  assert.equal(dateRangeError("2026-10-13", "2026-10-13"), undefined);
  assert.equal(dateRangeError("", "2026-10-13"), undefined);
  assert.ok(dateRangeError("2026-10-14", "2026-10-13"));
  assert.ok(dateRangeError("2026-02-30", ""));
  assert.ok(timeRangeError("24:00", "23:59"));
  assert.ok(timeRangeError("11:00", "11:00"));
  assert.equal(timeRangeError("11:15", "12:00"), undefined);
  assert.equal(dayInBounds("2026-10-13", "2026-10-13", "2026-10-13"), true);
  assert.equal(dayInBounds("2026-10-12", "2026-10-13"), false);
});
