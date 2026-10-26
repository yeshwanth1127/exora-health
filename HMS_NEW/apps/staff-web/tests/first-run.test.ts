// First-run guide: setup progress, Overview phase and coach-mark step parsing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
const opts = { parentURL: import.meta.url, tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)) };
const { guideStep, overviewPhase, setupProgress } = await tsImport("../src/hms/first-run.ts", opts);

const items = (...states: string[]) =>
  ["clinic", "doctor", "service", "hours", "preview"].map((id, n) => ({
    id, title: id, state: states[n] ?? "complete", detail: "", destination: "", permission: "",
  }));

test("setup stops at the first unfinished step, keeps later saved steps done, and ignores the booking preview", () => {
  const p = setupProgress(items("complete", "not_started", "complete"));
  assert.equal(p.reached, 1);
  assert.equal(p.ready, false);
  assert.deepEqual([...p.done], ["clinic", "service", "hours"]);
  assert.equal(setupProgress(items("complete", "complete", "complete", "complete", "blocked")).ready, true);
});

test("setup never guesses while loading or unreadable", () => {
  assert.equal(setupProgress(items("loading")), "loading");
  assert.equal(setupProgress(items("complete", "unknown")), null);
  assert.equal(setupProgress([]), null);
});

test("overview shows only setup until ready, and no report before the first appointment", () => {
  const ready = { reached: 4, ready: true, done: new Set() };
  assert.equal(overviewPhase({ reached: 0, ready: false, done: new Set() }, 12), "setup");
  assert.equal(overviewPhase("loading", 0), "loading");
  assert.equal(overviewPhase(ready, 0), "first_patients");
  assert.equal(overviewPhase(ready, 1), "running");
  assert.equal(overviewPhase(ready, null), "loading");
  // People who can't read setup still get reports.
  assert.equal(overviewPhase(null, 3), "running");
  assert.equal(overviewPhase(null, 0), "first_patients");
});

test("guide step comes only from known ids", () => {
  assert.equal(guideStep("?guide=doctor")?.target, "Add doctor");
  assert.equal(guideStep("?guide=nope"), null);
});
