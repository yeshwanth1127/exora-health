// Apple Messages › Setup: step derivation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
const opts = { parentURL: import.meta.url, tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)) };
const { appleStep } = await tsImport("../src/hms/apple-setup.ts", opts);

test("follows the saved request and never treats a request as live", () => {
  assert.equal(appleStep("not_started", false, 0), 0);
  assert.equal(appleStep("not_started", false, 1), 1);
  assert.equal(appleStep("not_started", false, 4), 1);
  assert.equal(appleStep("draft", false, 0), 2);
  assert.equal(appleStep("requested", false, 0), 3);
  assert.equal(appleStep("requested", true, 0), 4);
});
