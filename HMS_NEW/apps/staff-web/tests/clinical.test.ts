import { test } from "node:test";
import assert from "node:assert/strict";
import { needsCareAccess, templateFields } from "../src/hms/model.ts";
import { HmsError } from "../src/hms/client.ts";

test("template fields follow propertyOrder, titles and string fields only", () => {
  assert.deepEqual(
    templateFields({
      properties: {
        plan_notes: { type: "string" },
        score: { type: "number" },
        subjective: { type: "string", title: "History" },
      },
      propertyOrder: ["subjective", "plan_notes"],
    }),
    [
      ["subjective", "History"],
      ["plan_notes", "Plan notes"],
    ],
  );
});

test("break-glass is offered only for a missing care relationship", () => {
  const care = new HmsError("x", 403, "forbidden", {
    reason: "no_care_relationship",
  });
  assert.equal(needsCareAccess(care), true);
  assert.equal(needsCareAccess(new HmsError("x", 403, "forbidden")), false);
  assert.equal(
    needsCareAccess(
      new HmsError("x", 404, "not_found", { reason: "no_care_relationship" }),
    ),
    false,
  );
  assert.equal(needsCareAccess(null), false);
});
