import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chatLink,
  currentStage,
  emptySetup,
  stepsFor,
  suggestShape,
} from "../src/hms/whatsapp-setup.ts";

test("clinic shape decides which booking steps start on", () => {
  const on = (shape: Parameters<typeof stepsFor>[0]) =>
    stepsFor(shape, "Clinic", "Dr. A").filter((s) => s.on).map((s) => s.id);
  assert.deepEqual(on("single_doctor"), ["welcome", "slot", "details", "confirm"]);
  assert.deepEqual(on("small_clinic"), ["welcome", "doctor", "slot", "details", "confirm"]);
  assert.equal(on("multi_specialty").length, 6);
  assert.match(stepsFor("single_doctor", "Clinic", "Dr. A")[3].message, /Dr\. A/);
  assert.equal(stepsFor("small_clinic", "Clinic").length, 6, "off steps are kept for re-enabling");
});

test("suggested shape follows registered doctors and departments", () => {
  assert.equal(suggestShape(1, 3), "single_doctor");
  assert.equal(suggestShape(4, 1), "small_clinic");
  assert.equal(suggestShape(17, 11), "multi_specialty");
});

test("setup advances one stage at a time and pausing never reopens setup", () => {
  let s = { ...emptySetup };
  assert.equal(currentStage(s), "connect");
  s = { ...s, connected: { phone: "+919876543210", name: "Clinic" } };
  assert.equal(currentStage(s), "flow");
  s = { ...s, shape: "small_clinic" };
  assert.equal(currentStage(s), "flow", "choosing a template is not saving the flow");
  s = { ...s, flowDone: true, contentDone: true, tested: true };
  assert.equal(currentStage(s), "test");
  s = { ...s, live: true, paused: true };
  assert.equal(currentStage(s), "live");
});

test("chat link strips formatting", () => {
  assert.equal(chatLink("+91 98765-43210"), "https://wa.me/919876543210?text=Hi");
});
