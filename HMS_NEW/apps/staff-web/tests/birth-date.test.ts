import { test } from "node:test";
import assert from "node:assert/strict";
import { birthDateParts, parseBirthDate } from "../src/hms/birth-date.ts";
const max = "2026-10-19";
const parse = (day: string, month: string, year: string) =>
  parseBirthDate({ day, month, year }, max);
test("DOB accepts direct day/month/year entry and preserves calendar-day strings", () => {
  assert.deepEqual(parse("9", "2", "1985"), { value: "1985-02-09", error: "" });
  assert.deepEqual(birthDateParts("2000-02-29"), {
    day: "29",
    month: "02",
    year: "2000",
  });
  assert.equal(parse("19", "10", "2026").value, max);
});
test("unknown DOB stays empty and partial dates cannot silently become a saved date", () => {
  assert.deepEqual(parse("", "", ""), { value: "", error: "" });
  for (const parts of [
    ["1", "", ""],
    ["", "2", "2000"],
    ["1", "1", "85"],
  ]) {
    const result = parse(parts[0]!, parts[1]!, parts[2]!);
    assert.equal(result.value, "");
    assert.ok(result.error);
  }
});
test("DOB rejects impossible dates, false leap years and future birthdays without rollover", () => {
  assert.equal(parse("29", "2", "2000").value, "2000-02-29");
  for (const parts of [
    ["29", "2", "1900"],
    ["31", "4", "1995"],
    ["0", "1", "2000"],
    ["1", "13", "2000"],
    ["1", "1", "0000"],
    ["20", "10", "2026"],
  ]) {
    const result = parse(parts[0]!, parts[1]!, parts[2]!);
    assert.equal(result.value, "");
    assert.ok(result.error);
  }
});
