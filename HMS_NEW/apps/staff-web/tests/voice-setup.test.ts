// Voice › Call setup: step derivation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
const opts = { parentURL: import.meta.url, tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)) };
const { voiceStep } = await tsImport("../src/hms/voice-setup.ts", opts);

const base = { doctors: 2, line: "requested", agent: { exists: false, request: null }, live: false };

test("walks the steps in order from server state", () => {
  assert.equal(voiceStep({ ...base, doctors: 0 }), 0);
  assert.equal(voiceStep({ ...base, line: "draft" }), 1);
  assert.equal(voiceStep({ ...base, line: null }), 1);
  assert.equal(voiceStep(base), 2);
  assert.equal(voiceStep({ ...base, agent: { exists: false, request: "declined" } }), 2);
  assert.equal(voiceStep({ ...base, agent: { exists: false, request: "in_setup" } }), 3);
  assert.equal(voiceStep({ ...base, agent: { exists: true, request: "completed" } }), 3);
  assert.equal(voiceStep({ ...base, agent: { exists: true, request: null }, live: true }), 4);
});

test("an existing agent or open request is not hidden by an earlier gap", () => {
  assert.equal(voiceStep({ ...base, doctors: 0, line: null, agent: { exists: true, request: null } }), 3);
  assert.equal(voiceStep({ ...base, doctors: 0, agent: { exists: false, request: "pending" } }), 3);
});
