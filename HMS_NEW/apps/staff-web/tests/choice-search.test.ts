import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterChoices,
  searchableChoice,
  choiceLabel,
  searchKeyBubbles,
} from "../src/hms/choice-search.ts";

test("search is limited to larger entity sources with explicit override available", () => {
  assert.equal(searchableChoice("Doctor", 7), false);
  assert.equal(searchableChoice("Queue doctor", 8), true);
  assert.equal(searchableChoice("State / UT", 37), true);
  assert.equal(searchableChoice("Clinic timezone", 20), true);
  assert.equal(searchableChoice("Status", 12), false);
  assert.equal(searchableChoice("Doctor", 50, false), false);
  assert.equal(searchableChoice("Assigned owner", 6, true), true);
});
test("more than thirty doctors filter case-insensitively without changing IDs or source order", () => {
  const options = Array.from({ length: 35 }, (_, i) => ({
    value: `doctor-${i}`,
    label: `Doctor ${i}`,
    description: i % 2 ? "North clinic" : "South clinic",
  }));
  const result = filterChoices(options, "  DOCTOR 3 north  ");
  assert.deepEqual(
    result.map((o) => o.value),
    ["doctor-3", "doctor-13", "doctor-23", "doctor-31", "doctor-33"],
  );
  assert.equal(options.length, 35);
  assert.equal(result[0], options[3]);
});
test("same-name entities can be distinguished using supplied clinic or department context", () => {
  const options = [
    { value: "a", label: "Asha Rao", description: "Cardiology · Central" },
    { value: "b", label: "Asha Rao", description: "Dermatology · North" },
  ];
  assert.deepEqual(
    filterChoices(options, "asha north").map((o) => o.value),
    ["b"],
  );
  assert.equal(
    choiceLabel(options, "b", "Doctor"),
    "Asha Rao · Dermatology · North",
  );
});
test("no matches and clearing query never remove the selected label or mutate selection", () => {
  const options = [
    { value: "a", label: "José Rao" },
    { value: "b", label: "Asha Rao" },
  ];
  assert.deepEqual(filterChoices(options, "no such doctor"), []);
  assert.equal(choiceLabel(options, "b", "Doctor"), "Asha Rao");
  assert.equal(filterChoices(options, "   "), options);
  assert.deepEqual(
    filterChoices(options, "jose").map((o) => o.value),
    ["a"],
  );
  assert.deepEqual(filterChoices([], "asha"), []);
  assert.equal(choiceLabel([], "b", "Doctor"), "Doctor");
});
test("text editing and Enter stay with the search input, navigation and Escape use Base UI", () => {
  for (const key of ["a", " ", "Enter", "Backspace", "Delete", "Home", "End"])
    assert.equal(searchKeyBubbles(key), false);
  for (const key of ["ArrowDown", "ArrowUp", "Escape", "Tab"])
    assert.equal(searchKeyBubbles(key), true);
});
