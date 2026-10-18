import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
const { Stepper, RadioCards, DropdownMenu, ActivityFeed, activityEvents, PatientHover, patientPreview, WorkspaceContext } = await tsImport("./arc-next-fixtures.ts", {
  parentURL: import.meta.url, tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
});

const steps = [{ id: "patient", label: "Patient" }, { id: "time", label: "Doctor & time" }, { id: "review", label: "Review & confirm" }];
test("booking progress reports its current step without allowing prerequisite bypass", () => {
  const html = render(h(Stepper, { steps, current: 1, label: "Booking progress" }));
  assert.ok(html.includes('aria-current="step"'));
  assert.ok(html.includes("Doctor &amp; time"));
  assert.ok(!html.includes("<button"), "read-only progress cannot navigate past the booking state machine");
  assert.ok(!html.includes('type="submit"'));
});

test("booking radio cards retain exact mode values and disabled state for both choices", () => {
  const html = render(h(RadioCards, { value: "virtual", disabled: true, "aria-label": "Appointment type", name: "mode",
    options: [{ value: "in_person", label: "In person" }, { value: "virtual", label: "Video consultation" }],
    onValueChange: () => assert.fail("render must not change the visit mode") }));
  const radios = html.match(/<div[^>]+role="radio"[^>]*>/g) ?? [];
  assert.equal(radios.length, 2);
  assert.ok(radios.every((radio: string) => radio.includes('aria-disabled="true"')));
  assert.ok(radios[1].includes('aria-checked="true"'));
  assert.match(html, /<input[^>]+name="mode"[^>]+value="virtual"/);
});

test("locked appointment menu cannot expose an enabled trigger or execute a command while rendering", () => {
  const html = render(h(DropdownMenu, { label: "More actions", disabled: true,
    items: [{ label: "Cancel appointment", destructive: true, onSelect: () => assert.fail("render must not cancel") }] }));
  assert.match(html, /<button[^>]+disabled=""/);
  assert.ok(html.includes("More actions"));
  assert.ok(html.includes('aria-haspopup="menu"'));
});

test("Activity feed retains exact audit IDs, raw action, changes and request metadata", () => {
  const item = { id: "evt", created_at: "2026-10-18T20:00:00Z", actor: "Priya", actor_type: "staff", action: "status_change · booking.appointment",
    targets: { record: "appt", patient: "pt" }, change: { status: ["confirmed", "cancelled"], reason: "Requested by patient" }, request_id: "request-123" };
  const [event] = activityEvents([item]);
  assert.equal(event.id, item.id);
  assert.equal(event.at, item.created_at);
  assert.equal(event.action, item.action);
  assert.deepEqual(event.changes, item.change);
  assert.equal(event.requestId, item.request_id);
  assert.ok(event.meta.includes("record: appt") && event.meta.includes("patient: pt"));
  const html = render(h(ActivityFeed, { items: [item], timezone: "Asia/Kolkata" }));
  assert.ok(html.includes("Staff activity feed"));
  assert.ok(html.includes("Priya"));
  assert.ok(html.includes('aria-expanded="false"'), "event details stay expandable rather than flattening or dropping the diff");
  assert.ok(!html.includes("Deploy failed"), "no reference sample event");
});

const detail = { patientId: "pt", givenName: "Riya", familyName: "Shah", mrn: "000123", status: "active",
  contacts: [{ kind: "email", value: "private@example.test", is_primary: true }, { kind: "phone", value: "+919000000001", is_primary: false }, { kind: "phone", value: "+919000000002", is_primary: true }] };
test("patient identity preview uses the recorded primary patient phone and has an explicit missing-phone value", () => {
  const preview = patientPreview(detail);
  assert.equal(preview.name, "Riya Shah");
  assert.deepEqual(preview.stats, [{ label: "MRN", value: "000123" }, { label: "Phone", value: "+919000000002" }]);
  assert.ok(!JSON.stringify(preview).includes("private@example.test"));
  assert.equal(patientPreview({ ...detail, contacts: [] }).stats[1].value, "Not recorded");
});

test("patient previews respect patient-read permission and do not preload contact data into closed cards", () => {
  const workspace = (allowed: boolean) => ({ me: { tenantId: "tenant", staffId: "staff", permissions: allowed ? { "patients.read": ["clinic"] } : {} },
    facility: { facilityId: "clinic" }, practitioners: [], go: () => assert.fail("render cannot navigate") });
  const html = (allowed: boolean) => render(h(WorkspaceContext.Provider, { value: workspace(allowed) }, h(PatientHover, { patientId: "pt", name: "Riya Shah", detail })));
  assert.ok(!html(false).includes("data-hover-card"));
  const permitted = html(true);
  assert.ok(permitted.includes('data-hover-card="closed"'));
  assert.ok(permitted.includes("Open patient Riya Shah"));
  assert.ok(!permitted.includes("+919000000002"));
  assert.ok(!permitted.includes('role="tooltip"'));
});
