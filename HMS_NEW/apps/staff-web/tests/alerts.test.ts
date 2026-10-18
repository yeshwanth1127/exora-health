import { test } from "node:test";
import assert from "node:assert/strict";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
const opts = { parentURL: import.meta.url, tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)) };
const { deriveAlerts, applyMarks, tomorrowStart } = await tsImport("../src/hms/alerts.ts", opts);

const now = Date.parse("2026-10-18T05:00:00Z"); // 10:30 IST
const at = (min: number) => new Date(now + min * 60_000).toISOString();
const known = <T>(value: T) => ({ state: "known", value }) as const;
const base = { now, timezone: "Asia/Kolkata", staffId: "doc" };
const appt = (o: Record<string, unknown>) => ({
  appointmentId: "a", status: "confirmed", practitionerStaffId: "doc", practitionerName: "Dr Asha", patientName: "Ravi K",
  bookingPartyName: null, startsAt: at(0), tokenStatus: null, tokenNo: null, visitMode: "in_person", ...o,
});

test("doctor sees own queue now and own next appointment coming up", () => {
  const { alerts } = deriveAlerts({
    ...base,
    appointments: known([
      appt({ appointmentId: "w", tokenStatus: "waiting", tokenNo: 4, startsAt: at(-10) }),
      appt({ appointmentId: "n", startsAt: at(30) }),
      appt({ appointmentId: "far", startsAt: at(180) }),
    ]),
  });
  assert.deepEqual(alerts.map((a: { key: string; bucket: string }) => [a.key, a.bucket]), [["appt_wait:w:waiting", "now"], ["appt_soon:n", "upcoming"]]);
  assert.equal(alerts[0].destination, "queue");
});

test("front desk sees late arrivals and expiring holds; the key changes with the record state", () => {
  const { alerts } = deriveAlerts({
    ...base,
    staffId: "desk",
    appointments: known([appt({ appointmentId: "late", startsAt: at(-20) }), appt({ appointmentId: "ok", startsAt: at(-10) })]),
    waitlist: known([
      { waitlistEntryId: "e1", status: "offered", bookingPartyName: "Meena", patientName: null, practitionerName: "Dr Asha", offer: { offerId: "o1", slotStart: at(60), expiresAt: at(4) } },
      { waitlistEntryId: "e2", status: "offered", bookingPartyName: "Kiran", patientName: null, practitionerName: null, offer: { offerId: "o2", slotStart: at(90), expiresAt: at(30) } },
      { waitlistEntryId: "e3", status: "offered", bookingPartyName: "Gone", patientName: null, practitionerName: null, offer: { offerId: "o3", slotStart: at(90), expiresAt: at(-1) } },
    ]),
  });
  const keys = alerts.map((a: { key: string }) => a.key);
  assert.deepEqual(keys, ["appt_late:late", "hold_expiring:o1", "hold:o2"]);
  assert.ok(alerts[1].title.includes("4 min"));
});

test("a failed source is reported unavailable, never as nothing due", () => {
  const { alerts, unavailable } = deriveAlerts({ ...base, appointments: { state: "unknown" }, teleconsults: { state: "loading" } });
  assert.equal(alerts.length, 0);
  assert.deepEqual(unavailable, ["Appointment"]);
});

test("sources a person may not read are left out entirely", () => {
  const { unavailable } = deriveAlerts({ ...base });
  assert.deepEqual(unavailable, []);
});

test("registrations, invites and setup checks", () => {
  const { alerts } = deriveAlerts({
    ...base,
    registrations: known([{ registrationId: "r1", council: "KMC", validUntil: "2026-11-02" }, { registrationId: "r2", council: "NMC", validUntil: "2027-06-01" }]),
    team: known([{ registrationId: "r3", staffId: "s9", staffName: "Dr Vikram", council: "KMC", validUntil: "2026-10-10" }]),
    accounts: known([
      { staffId: "s1", displayName: "Meena", account: { linked: false, inviteExpiresAt: at(2 * 24 * 60) } },
      { staffId: "s2", displayName: "Old", account: { linked: true, inviteExpiresAt: at(60) } },
    ]),
    setup: [
      { id: "hours", title: "Doctor hours", state: "not_started", detail: "No sessions", destination: "schedules", permission: "schedules.manage" },
      { id: "clinic", title: "Clinic details", state: "complete", detail: "Saved", destination: "settings", permission: "facility.manage" },
    ],
  });
  const keys = alerts.map((a: { key: string }) => a.key);
  assert.ok(keys.includes("reg:r1:2026-11-02"));
  assert.ok(!keys.some((k: string) => k.startsWith("reg:r2")));
  assert.ok(keys.includes("reg_expired:r3:2026-10-10"));
  assert.ok(keys.includes(`invite:s1:${at(2 * 24 * 60)}`));
  assert.ok(!keys.some((k: string) => k.includes("s2")));
  assert.ok(keys.includes("setup:hours:not_started") && !keys.some((k: string) => k.startsWith("setup:clinic")));
  for (const k of keys) assert.match(k, /^[a-z_]{2,20}:[A-Za-z0-9:._-]{1,200}$/, "keys fit the server's key format");
});

test("marks: read, dismissed and an active snooze; an expired snooze is open again", () => {
  const alerts = [{ key: "a:1" }, { key: "a:2" }, { key: "a:3" }, { key: "a:4" }];
  const marked = applyMarks(alerts, [
    { key: "a:1", readAt: at(-5), dismissedAt: null, snoozedUntil: null },
    { key: "a:2", readAt: null, dismissedAt: at(-1), snoozedUntil: null },
    { key: "a:3", readAt: null, dismissedAt: null, snoozedUntil: at(60) },
    { key: "a:4", readAt: null, dismissedAt: null, snoozedUntil: at(-1) },
  ], now);
  assert.deepEqual(marked.map((a: { read: boolean; folder: string }) => [a.read, a.folder]), [[true, "open"], [false, "done"], [false, "snoozed"], [false, "open"]]);
});

test("snooze runs to the clinic's next local midnight", () => {
  assert.equal(tomorrowStart(now, "Asia/Kolkata"), "2026-10-18T18:30:00.000Z");
  assert.equal(tomorrowStart(Date.parse("2026-10-18T19:00:00Z"), "Asia/Kolkata"), "2026-10-19T18:30:00.000Z");
});


test("registration expiry follows the clinic day rather than UTC midnight", () => {
  const input = { ...base, now: Date.parse("2026-10-18T19:00:00Z"), registrations: known([{ registrationId: "r", council: "KMC", validUntil: "2026-10-18" }]) };
  const india = deriveAlerts(input).alerts[0];
  assert.ok(india.key.startsWith("reg_expired:"));
  assert.equal(india.destination, "settings?section=account");
  const west = deriveAlerts({ ...input, timezone: "America/Los_Angeles" }).alerts[0];
  assert.ok(west.key.startsWith("reg:"));
});
test("snooze uses the clinic's next midnight through DST changes", () => {
  assert.equal(tomorrowStart(Date.parse("2026-03-08T05:30:00Z"), "America/New_York"), "2026-03-09T04:00:00.000Z");
  assert.equal(tomorrowStart(Date.parse("2026-11-01T04:30:00Z"), "America/New_York"), "2026-11-02T05:00:00.000Z");
});
