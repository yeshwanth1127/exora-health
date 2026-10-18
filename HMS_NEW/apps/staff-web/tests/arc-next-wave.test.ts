import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
const { Stepper, RadioCards, DropdownMenu, ActivityFeed, activityEvents, PatientHover, patientPreview, WorkspaceContext, MultiStepForm, SettingsPage, SettingsSaveBar } = await tsImport("./arc-next-fixtures.ts", {
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
test("patient hover context uses recorded visit reason, DOB and language without repeating table identifiers", () => {
  const preview = patientPreview({ ...detail, birthDate: "1990-10-20", birthDateEstimated: true, preferredLanguage: "Kannada" }, "Review dizziness", "2026-10-19");
  assert.equal(preview.name, "Riya Shah");
  assert.deepEqual(preview.stats, [{ label: "Date of birth", value: "1990-10-20 (estimated)" }, { label: "Language", value: "Kannada" }]);
  assert.equal(preview.meta, "Approximately 35 years old");
  assert.equal(preview.bio, "Visit reason: Review dizziness");
  for (const value of ["000123", "+919000000002", "private@example.test", "active"]) assert.ok(!JSON.stringify(preview).includes(value));
  const empty = patientPreview({ ...detail, contacts: [] });
  assert.deepEqual(empty.stats, []);
  assert.equal(empty.bio, "No additional context recorded.");
  assert.ok(!JSON.stringify(empty).includes("note"), "do not invent a note when the patient endpoint has no notes field");
});

test("DOB age respects the clinic day, birthday boundary and exact/estimated distinction", () => {
  const patient = { ...detail, birthDate: "2025-10-20", birthDateEstimated: false };
  assert.equal(patientPreview(patient, null, "2026-10-19").meta, "0 years old");
  assert.equal(patientPreview(patient, null, "2026-10-20").meta, "1 year old");
  assert.equal(patientPreview(patient, null, "2024-10-20").meta, undefined);
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

test("doctor wizard shows saved stages without clickable bypass, nested forms or an unconfirmed success screen", () => {
  const html = render(h(MultiStepForm, { current: 1,
    steps: [{ id: "staff", title: "Staff account", content: "Selected account" }, { id: "clinic", title: "Clinic", content: h("form", { id: "clinic-write" }, h("input", { name: "departmentId", required: true })) }, { id: "calendar", title: "Calendar", content: "Unfinished" }],
    nextForm: "clinic-write", nextLabel: "Save clinic affiliation", onBack: () => assert.fail("render cannot navigate") }));
  assert.equal(html.match(/<form/g)?.length, 1, "stage owns the sole real write form");
  assert.match(html, /<button[^>]+type="submit"[^>]+form="clinic-write"/);
  const progress = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
  assert.ok(!progress.includes("<button"));
  assert.ok(progress.includes('aria-current="step"'));
  assert.ok(!html.includes("Your response has been saved") && !html.includes("All set"));
  assert.ok(!html.includes("Unfinished"), "future stage content is not actionable");
});

test("busy doctor stage blocks both forward and backward navigation", () => {
  const html = render(h(MultiStepForm, { steps: [{ id: "calendar", title: "Calendar", content: "Recover original request" }], current: 0, busy: true,
    onNext: () => assert.fail("must not create a calendar"), onBack: () => assert.fail("must not leave a pending command") }));
  const buttons = html.match(/<button[^>]*>/g) ?? [];
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every((button: string) => button.includes('disabled=""')));
});

test("Settings navigation exposes only supplied permitted sections and the real account", () => {
  const html = render(h(SettingsPage, { current: "appearance", sections: [{ id: "appearance", label: "Appearance", description: "This browser", icon: null }, { id: "account", label: "My account", description: "Clinic", icon: null }],
    account: { name: "Priya", detail: "Clinic administrator" }, onChange: () => assert.fail("render cannot navigate") }, "Existing settings forms"));
  assert.ok(html.includes('aria-current="page"'));
  assert.ok(html.includes("Priya") && html.includes("Existing settings forms"));
  assert.ok(!html.includes("Billing") && !html.includes("Save all") && !html.includes("Northwind"));
});

test("scoped settings save bar appears only for dirty fields and blocks discard during recovery", () => {
  const bar = (count: number, busy: boolean) => render(h(SettingsSaveBar, { count, busy, onDiscard: () => assert.fail("render cannot discard") }, h("button", { disabled: busy }, "Save changes")));
  assert.ok(!bar(0, false).includes("Save changes"));
  const html = bar(2, true);
  assert.ok(html.includes("Unsaved name and phone changes"));
  assert.ok((html.match(/<button[^>]*>/g) ?? []).every((button: string) => button.includes('disabled=""')));
  assert.ok(!html.includes("Changes saved"), "no simulated successful outcome");
});
