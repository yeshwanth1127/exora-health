import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  changedFields,
  isStale,
  listFromText,
  minorToRupees,
  refusal,
  rupeesToMinor,
} from "../src/hms/forms.ts";
import { HmsError } from "../src/hms/client.ts";

test("only changed fields are sent; blank clears, untouched sends nothing", () => {
  const before = { name: "Clinic", city: "Bengaluru", phone: null, pincode: "560001" };
  assert.deepEqual(
    changedFields(before, { name: " Clinic ", city: "", phone: "+918012345678", pincode: "560001" }),
    { city: null, phone: "+918012345678" },
  );
  assert.deepEqual(changedFields(before, { name: "Clinic" }), {});
  assert.deepEqual(changedFields({ tags: ["a"] }, { tags: ["a", "b"] }), { tags: ["a", "b"] });
  assert.deepEqual(changedFields({ on: true }, { on: false }), { on: false });
});

test("fees are typed in rupees and sent in paise; bad input is refused, not guessed", () => {
  assert.equal(rupeesToMinor("450"), 45000);
  assert.equal(rupeesToMinor("450.5"), 45050);
  assert.equal(rupeesToMinor("1,000.25"), 100025);
  assert.equal(rupeesToMinor(""), null);
  for (const bad of ["-1", "4.555", "abc", "1e3", "10000000"]) assert.equal(rupeesToMinor(bad), undefined, bad);
  assert.equal(minorToRupees(45000), "450");
  assert.equal(minorToRupees(45050), "450.50");
  assert.equal(minorToRupees(null), "");
});

test("lists, dates and refusals", () => {
  assert.deepEqual(listFromText(" MBBS, MD (Medicine) ,, "), ["MBBS", "MD (Medicine)"]);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  const stale = new HmsError("changed", 409, "conflict", { reason: "stale_version" });
  assert.ok(isStale(stale));
  assert.equal(isStale(new HmsError("x", 409, "conflict", { reason: "in_use" })), false);
  assert.equal(refusal(new HmsError("x", 409, "conflict", { reason: "in_use" })), "in_use");
  assert.equal(refusal(new HmsError("x", 403, "forbidden", { reason: "in_use" })), undefined);
});
