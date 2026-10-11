import { test } from "node:test";
import assert from "node:assert/strict";
import { cancellable, flagMark, LAB_PAGE_PERMISSIONS, nextStudyStatus, referenceText, released, resultValue } from "../src/hms/diagnostics.ts";

test("order items are cancellable until a result exists", () => {
  for (const s of ["ordered", "scheduled", "collected", "in_progress"]) assert.equal(cancellable(s), true);
  for (const s of ["resulted", "released", "cancelled"]) assert.equal(cancellable(s), false);
});

test("only final and amended reports are released", () => {
  assert.equal(released("final"), true);
  assert.equal(released("amended"), true);
  assert.equal(released("preliminary"), false);
  assert.equal(released(null), false);
});

test("imaging studies step scheduled → arrived → in progress → completed; reporting is the report's job", () => {
  assert.equal(nextStudyStatus("scheduled"), "arrived");
  assert.equal(nextStudyStatus("arrived"), "in_progress");
  assert.equal(nextStudyStatus("in_progress"), "completed");
  assert.equal(nextStudyStatus("completed"), null);
  assert.equal(nextStudyStatus("cancelled"), null);
});

test("results print with their unit, flag and reference interval", () => {
  assert.equal(resultValue({ valueNum: "6.50", valueText: null, valueDisplay: null, unit: "g/dL" }), "6.5 g/dL");
  assert.equal(resultValue({ valueNum: null, valueText: "No growth", valueDisplay: null, unit: null }), "No growth");
  assert.equal(resultValue({ valueNum: null, valueText: null, valueDisplay: "Positive", unit: null }), "Positive");
  assert.equal(flagMark("critical_low"), "LL");
  assert.equal(flagMark("high"), "H");
  assert.equal(flagMark("normal"), "");
  assert.equal(referenceText({ refLow: "12.0", refHigh: "15.0" }), "12–15");
  assert.equal(referenceText({ refLow: null, refHigh: "200" }), "≤ 200");
  assert.equal(referenceText({ refLow: null, refHigh: null, refText: "Negative" }), "Negative");
});

test("the Lab & imaging page opens for collectors, lab, radiology and acknowledging clinicians", () => {
  assert.deepEqual([...LAB_PAGE_PERMISSIONS].sort(), ["imaging.manage", "imaging.report", "lab.collect", "lab.process", "lab.verify", "pcpndt.manage", "results.acknowledge"]);
});
