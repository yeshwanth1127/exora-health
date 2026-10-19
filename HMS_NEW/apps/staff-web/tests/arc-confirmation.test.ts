import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
import {
  reviewedTarget,
  sameReviewedValue,
  canCancelPreviewCampaign,
  confirmationCommit,
} from "../src/hms/growth-confirmation.ts";

const opts = {
  parentURL: import.meta.url,
  tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
};
const { GrowthSwitch, GrowthCheckbox, GrowthConfirm } = await tsImport(
  "./arc-growth-fixtures.ts",
  opts,
);

test("a reviewed target survives polling copies/reordering but cannot select another row", () => {
  const target = { id: "a", text: "Reviewed post", status: "scheduled" };
  const other = { id: "b", text: "Other post", status: "scheduled" };
  const refreshed = { ...target };
  assert.equal(reviewedTarget([other, refreshed], target), refreshed);
  assert.equal(reviewedTarget([other], target), undefined);
  assert.equal(reviewedTarget([refreshed], null), undefined);
  assert.equal(
    reviewedTarget([{ ...target, text: "Edited post" }], target),
    undefined,
  );
});

test("a replacement reply or changed setup/profile requires a new confirmation", () => {
  const review = { id: "r", reply: { text: "Original reply", at: 100 } };
  assert.equal(
    reviewedTarget(
      [{ ...review, reply: { text: "New reply", at: 101 } }],
      review,
    ),
    undefined,
  );
  assert.equal(
    sameReviewedValue(
      { phone: "+919000000001", shape: "solo" },
      { phone: "+919000000002", shape: "solo" },
    ),
    false,
  );
  assert.equal(
    sameReviewedValue({ name: "Changed clinic" }, { name: "Reviewed clinic" }),
    false,
  );
  assert.equal(sameReviewedValue(undefined, null), false);
});

test("cancellation refuses a campaign that started sending while its dialog was open", () => {
  for (const status of ["in_review", "scheduled"])
    assert.equal(canCancelPreviewCampaign({ status, stats: null }), true);
  for (const status of ["sending", "sent", "rejected", "future_status"])
    assert.equal(canCancelPreviewCampaign({ status, stats: null }), false);
  assert.equal(
    canCancelPreviewCampaign({ status: "scheduled", stats: { sent: 1 } }),
    false,
  );
  assert.equal(canCancelPreviewCampaign(undefined), false);
});

test("permission refusal does not commit, and repeated activation commits only once", () => {
  const commit = confirmationCommit();
  let calls = 0;
  assert.equal(
    commit(true, () => calls++),
    false,
  );
  assert.equal(calls, 0);
  assert.equal(
    commit(false, () => calls++),
    true,
  );
  assert.equal(
    commit(false, () => calls++),
    false,
  );
  assert.equal(calls, 1);
});

test("a synchronous refusal can be reviewed and retried without consuming confirmation", () => {
  const commit = confirmationCommit();
  assert.throws(
    () =>
      commit(false, () => {
        throw new Error("Refused");
      }),
    /Refused/,
  );
  let calls = 0;
  assert.equal(
    commit(false, () => calls++),
    true,
  );
  assert.equal(calls, 1);
});

test("Arc switches retain controlled checked state, accessible names and disabled state", () => {
  const html = render(
    h(GrowthSwitch, {
      checked: true,
      disabled: true,
      "aria-label": "Accept bookings",
      onCheckedChange: () => assert.fail("render cannot toggle"),
    }),
  );
  assert.match(html, /role="switch"/);
  assert.match(html, /aria-checked="true"/);
  assert.match(html, /aria-label="Accept bookings"/);
  assert.match(html, /disabled=""/);
  const off = render(
    h(GrowthSwitch, { checked: false, "aria-label": "Quiet hours" }),
  );
  assert.match(off, /aria-checked="false"/);
});

test("Arc checkbox copy and descriptions remain associated with the actual form control", () => {
  const html = render(
    h(GrowthCheckbox, {
      id: "enrol",
      label: "Family membership",
      description: "Select at enrolment",
      checked: true,
      disabled: true,
      onCheckedChange: () => assert.fail("render cannot enrol"),
    }),
  );
  assert.match(html, /role="checkbox"/);
  assert.match(html, /id="enrol"/);
  assert.match(html, /for="enrol"/);
  assert.match(html, /aria-checked="true"/);
  assert.match(html, /aria-describedby="enrol-description"/);
  assert.match(html, /id="enrol-description"/);
  assert.match(html, /disabled=""/);
});

test("rendering a confirmation cannot invoke or cancel an action", () => {
  for (const open of [false, true])
    render(
      h(GrowthConfirm, {
        open,
        title: "Delete post?",
        description: "Browser preview only",
        confirmLabel: "Delete",
        blockedReason: "Permission revoked",
        onConfirm: () => assert.fail("render cannot delete"),
        onDismiss: () => assert.fail("render cannot dismiss"),
      }),
    );
});
