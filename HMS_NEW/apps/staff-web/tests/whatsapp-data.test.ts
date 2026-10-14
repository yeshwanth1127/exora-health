import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HOUR,
  progress,
  queue,
  render,
  seed,
  templateIssues,
  templateState,
  windowLeft,
} from "../src/hms/whatsapp-data.ts";

const clinic = { name: "Sri Lakshmi Clinic", doctors: ["Dr. Rao", "Dr. Iqbal"] };

test("template rules match Meta's before anything is submitted", () => {
  const ok = { body: "Hello {{patient_name}}, see you at {{time}}.", buttons: ["Confirm"] };
  assert.deepEqual(templateIssues(ok), []);
  assert.match(templateIssues({ ...ok, body: "{{patient_name}}, hi" })[0], /start or end/);
  assert.match(templateIssues({ ...ok, body: "Hi {{patient_name}}" })[0], /start or end/);
  assert.match(templateIssues({ ...ok, body: "Hi {{date}} {{time}} ok" })[0], /between two variables/);
  assert.match(templateIssues({ ...ok, body: "Hi {{name}} ok" })[0], /Unknown variable \{\{name\}\}/);
  assert.match(templateIssues({ ...ok, body: "a".repeat(1025) })[0], /1024/);
  assert.equal(templateIssues({ ...ok, buttons: ["a", "b", "c", "d"] }).length, 1);
  assert.match(templateIssues({ ...ok, buttons: ["x".repeat(26)] })[0], /25/);
  assert.match(templateIssues({ ...ok, buttons: ["Yes", "yes"] })[0], /different/);
});

test("render fills known variables and leaves unknown ones visible", () => {
  assert.equal(render("Hi {{patient_name}} {{ time }} {{x}}", { patient_name: "Ravi", time: "10 am" }), "Hi Ravi 10 am {{x}}");
});

test("free replies close 24 hours after the patient's last message", () => {
  assert.equal(windowLeft(null, 0), 0);
  assert.equal(windowLeft(0, 23 * HOUR), HOUR);
  assert.equal(windowLeft(0, 25 * HOUR), 0);
});

test("an approved template keeps sending while an edit is reviewed", () => {
  const d = seed(clinic, 1_000_000, "2026-10-14");
  const a = d.automations.find((x) => x.id === "reminder_day")!;
  assert.equal(templateState(a), "approved");
  const edited = { ...a, body: a.body + " Thanks." };
  assert.equal(templateState(edited), "edited");
  const submitted = { ...edited, review: "in_review" as const, submittedAt: 0 };
  assert.equal(templateState(submitted), "in_review");
  assert.ok(submitted.approved, "old version still approved");
  const after = progress({ ...d, automations: [submitted] }, 10_000).automations[0];
  assert.equal(templateState(after), "approved");
  assert.equal(after.approved!.body, edited.body);
});

test("sent messages walk through Meta's statuses and seeded history stays put", () => {
  const d = seed(clinic, 0, "2026-10-14");
  const [queued, id] = queue(d, { patient: "Ravi", phone: "+919800000000", kind: "Staff reply", template: null, category: "service", body: "Hi" }, 0);
  assert.equal(progress(queued, 500), queued, "nothing due yet returns the same object");
  const at = (t: number, s = queued) => progress(s, t).log.find((e) => e.id === id)!;
  let s = progress(queued, 1000);
  assert.equal(s.log.find((e) => e.id === id)!.status, "sent");
  s = progress(s, 3500);
  s = progress(s, 9500);
  assert.deepEqual(s.log.find((e) => e.id === id)!.history.map((h) => h.status), ["queued", "sent", "delivered", "read"]);
  assert.equal(at(1000).status, "sent");
  assert.deepEqual(s.log.slice(1), queued.log.slice(1), "seeded entries never change");
});

test("a promotion goes in review, then sends and reports stats", () => {
  const d = seed(clinic, 0, "2026-10-14");
  const c = { ...d.campaigns[0], id: "new", status: "in_review" as const, changedAt: 0, sendAt: null, stats: null };
  let s = progress({ ...d, campaigns: [c] }, 6000);
  assert.equal(s.campaigns[0].status, "sending");
  s = progress(s, 11_000);
  assert.equal(s.campaigns[0].status, "sent");
  assert.ok(s.campaigns[0].stats!.delivered <= s.campaigns[0].stats!.sent);
});
