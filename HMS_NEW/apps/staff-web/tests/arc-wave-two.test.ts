import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
import { toast, attachToastStack } from "../src/components/toast-events.ts";
import type { ToastOptions } from "../src/components/arc/toast-stack/toast-stack.tsx";
const opts = { parentURL: import.meta.url, tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)) };
const { PhoneField, MoneyField, TimeField, DateField, SharedField, ErrorMessage, LoadingState, Status } = await tsImport("./arc-wave-fixtures.ts", opts);
const render = renderToStaticMarkup;

test("phone picker preserves unsupported and overlength persisted numbers without reinterpreting them", () => {
  for (const value of ["+99912345678", "+91987654321099"]) {
    const html = render(h(PhoneField, { label: "Phone", value, onValueChange: () => assert.fail("render cannot edit a number") }));
    assert.ok(html.includes(`value="${value}"`));
    assert.ok(!html.includes('aria-label="Country,'));
  }
  const india = render(h(PhoneField, { value: "+919876543210", onValueChange: () => {} }));
  assert.ok(india.includes("India"));
});

test("required and disabled phone/time fields retain native constraint controls", () => {
  const phone = render(h(PhoneField, { value: "", required: true, disabled: true, onValueChange: () => {} }));
  assert.match(phone, /<input[^>]+aria-hidden="true"[^>]+disabled=""[^>]+required=""/);
  assert.ok(phone.includes('pattern="\\+[1-9][0-9]{6,14}"'));
  const time = render(h(TimeField, { label: "Start time", value: "09:07", required: true, onValueChange: () => assert.fail("render cannot round a time") }));
  const nativeTime = time.match(/<input[^>]+type="time"[^>]*>/)?.[0] ?? "";
  assert.ok(nativeTime.includes('value="09:07"'));
  assert.ok(nativeTime.includes('required=""'));
  assert.ok(time.includes("09:07"));
});

test("INR money fields keep exact paise, null and external validation associations", () => {
  const amount = render(h(SharedField, { label: "Fee", id: "fee", hint: "In rupees", serverError: "Review this fee" },
    h(MoneyField, { id: "fee", value: 45050, onValueChange: () => assert.fail("render cannot edit a fee") })));
  assert.ok(amount.includes('aria-valuenow="450.5"'));
  assert.ok(amount.includes('aria-invalid="true"'));
  assert.ok(amount.includes("fee-description fee-error"));
  const empty = render(h(MoneyField, { value: null, onValueChange: () => {} }));
  assert.ok(empty.includes('aria-valuetext="Empty"'));
  assert.ok(!empty.includes('aria-valuenow="0"'));
});

test("error and status presentation retains the original message and unknown server status", () => {
  assert.ok(render(h(ErrorMessage, { text: "Request outcome unknown" })).includes("Request outcome unknown"));
  assert.ok(render(h(Status, { value: "future_status", text: "Future state" })).includes("Future state"));
  const loading = render(h(LoadingState, { loading: true, error: "", data: null, refresh: () => {} }, h("button", {}, "Create patient")));
  assert.ok(!loading.includes("Create patient"));
  assert.ok(loading.includes("Loading workspace"));
});

test("toast bridge buffers actual result messages, supports same-id updates and never invents success", () => {
  toast.dismiss();
  toast.loading("Saving", { id: "operation" });
  toast.error("Could not confirm the original request", { id: "operation", duration: Infinity });
  const notices: ToastOptions[] = [];
  const detach = attachToastStack({ toast: (notice) => { notices.push(notice); return notice.id ?? "id"; }, update: () => {}, dismiss: () => {} });
  try {
    assert.deepEqual(notices.map((notice) => notice.type), ["loading", "error"]);
    assert.equal(notices[1].id, "operation");
    assert.equal(notices[1].duration, Infinity);
    assert.equal(notices[1].title, "Could not confirm the original request");
  } finally { detach(); toast.dismiss(); }
});

test("dismissed buffered toasts do not appear after a stack mounts", () => {
  toast.dismiss();
  const id = toast.info("Do not replay this notification");
  toast.dismiss(id);
  const notices: ToastOptions[] = [];
  const detach = attachToastStack({ toast: (notice) => { notices.push(notice); return "id"; }, update: () => {}, dismiss: () => {} });
  try { assert.equal(notices.length, 0); } finally { detach(); toast.dismiss(); }
});


test("birth date uses one labelled calendar trigger and preserves calendar-day form constraints", () => {
  const html = render(h(DateField, { label: "Date of birth", id: "dob", value: "1968-02-14", onValueChange: () => assert.fail("render must not change DOB") }));
  assert.equal((html.match(/<label/g) ?? []).length, 1);
  assert.match(html, /<label[^>]+for="dob"/);
  assert.match(html, /<button[^>]+id="dob"[^>]+aria-haspopup="dialog"/);
  assert.match(html, /<input[^>]+aria-hidden="true"[^>]+type="date"[^>]+value="1968-02-14"/);
  assert.ok(html.includes("1968"));
  assert.ok(!html.includes('type="date" id="dob"'));
});

test("date picker shares parent validation and keeps required bounds when disabled", () => {
  const html = render(h(SharedField, { label: "Date of birth", id: "dob", required: true, serverError: "Check this date" },
    h(DateField, { label: "Date of birth", id: "dob", value: "", min: "1900-01-01", max: "2026-10-18", disabled: true, onValueChange: () => {} })));
  assert.equal((html.match(/<label/g) ?? []).length, 1);
  const trigger = html.match(/<button[^>]+id="dob"[^>]*>/)?.[0] ?? "";
  assert.ok(trigger.includes('disabled=""'));
  assert.ok(trigger.includes('aria-describedby="dob-error"'));
  assert.ok(!html.includes('field="[object Object]"'));
  assert.match(html, /<input[^>]+required=""[^>]+disabled=""[^>]+min="1900-01-01"[^>]+max="2026-10-18"/);
});
