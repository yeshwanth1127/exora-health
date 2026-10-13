import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveSetup, type SetupEvidence } from "../src/hms/setup-readiness";
const known = <T>(value: T) => ({ state: "known" as const, value });
function ready(): SetupEvidence {
  return {
    facilityId: "clinic",
    day: "2026-10-13",
    mode: "in_person",
    clinic: known({
      facilityId: "clinic",
      code: "C",
      name: "Clinic",
      facilityType: "clinic",
      addressLine1: "Road",
      addressLine2: null,
      city: "City",
      district: null,
      pincode: null,
      stateCode: "KA",
      phone: null,
      email: null,
      timezone: "Asia/Kolkata",
      directionsUrl: null,
      arrivalInstructions: null,
      status: "active",
      version: 1,
    }),
    doctors: known([
      {
        staffId: "doctor",
        facilityId: "clinic",
        name: "Doctor",
        specialty: null,
        specialtyName: null,
        department: "Medicine",
        acceptsVirtual: false,
        calendarId: "calendar",
      },
    ]),
    doctor: {
      staffId: "doctor",
      name: "Doctor",
      facilityId: "clinic",
      specialty: null,
      specialtyName: null,
      department: "Medicine",
      acceptsVirtual: false,
      calendarId: "calendar",
    },
    directory: known({
      facilityId: "clinic",
      departments: [],
      consultRooms: [],
      services: [
        {
          healthcareServiceId: "service",
          code: "S",
          name: "Consultation",
          departmentId: "dept",
          serviceMode: "in_person",
          defaultDurationMin: 15,
          isPublic: true,
          status: "active",
          version: 1,
        },
      ],
    }),
    prices: known([
      {
        healthcareServiceId: "service",
        staffId: null,
        mode: "any",
        feeMinor: 0,
        validFrom: "2026-10-13",
        validTo: null,
      },
    ]),
    sessions: known([
      {
        sessionOn: "2026-10-14",
        facilityId: "clinic",
        visitMode: "in_person",
        startsAt: "2026-10-14T03:30:00Z",
        endsAt: "2026-10-14T04:30:00Z",
        slotMinutes: 15,
        maxWalkInTokens: 0,
        source: "weekly",
      },
    ]),
    slots: known([
      {
        slotStart: "2026-10-14T03:30:00Z",
        slotEnd: "2026-10-14T03:45:00Z",
        facilityId: "clinic",
        visitMode: "in_person",
        status: "taken",
      },
    ]),
  };
}
const state = (e: SetupEvidence, id: string) =>
  deriveSetup(e).find((i) => i.id === id)!;
test("fully booked clinic remains configured; zero inherited fee is valid", () => {
  const e = ready();
  assert.equal(state(e, "service").state, "complete");
  assert.equal(state(e, "hours").state, "complete");
  assert.equal(state(e, "preview").state, "optional_deferred");
  assert.match(state(e, "preview").detail, /no free times/);
});
test("failed or forbidden read is unknown, never missing setup", () => {
  const e = ready();
  e.prices = { state: "unknown" };
  assert.equal(state(e, "service").state, "unknown");
  assert.equal(state(e, "preview").state, "unknown");
});
test("loading doctors is not a zero-doctor empty state", () => {
  const e = ready();
  e.doctors = { state: "loading" };
  e.doctor = null;
  assert.equal(state(e, "doctor").state, "loading");
});
test("future and expired fees don't establish a current price", () => {
  const e = ready();
  if (e.prices.state !== "known") return;
  e.prices.value[0].validFrom = "2026-10-14";
  assert.equal(state(e, "service").state, "not_started");
  e.prices.value[0].validFrom = "2026-10-01";
  e.prices.value[0].validTo = e.day;
  assert.equal(state(e, "service").state, "not_started");
});
test("another mode's service cannot establish video configuration", () => {
  const e = ready();
  e.mode = "virtual";
  e.doctor!.acceptsVirtual = true;
  assert.equal(state(e, "service").state, "not_started");
  assert.equal(state(e, "hours").state, "not_started");
});
test("missing calendar blocks hours and cannot be called bookable", () => {
  const e = ready();
  e.doctor!.calendarId = null;
  assert.equal(state(e, "doctor").state, "not_started");
  assert.equal(state(e, "hours").state, "blocked");
  assert.equal(state(e, "preview").state, "blocked");
});
test("past or other clinic sessions don't establish scoped future hours", () => {
  const e = ready();
  if (e.sessions.state !== "known") return;
  e.sessions.value[0].facilityId = "other";
  assert.equal(state(e, "hours").state, "not_started");
  e.sessions.value[0].facilityId = "clinic";
  e.sessions.value[0].sessionOn = "2026-10-12";
  assert.equal(state(e, "hours").state, "not_started");
});
test("inactive clinic cannot count as configured", () => {
  const e = ready();
  if (e.clinic.state !== "known") return;
  e.clinic.value.status = "inactive";
  assert.equal(state(e, "clinic").state, "not_started");
  assert.equal(state(e, "preview").state, "blocked");
});
test("doctor identity and virtual acceptance must match scoped directory evidence", () => {
  const e = ready();
  e.mode = "virtual";
  assert.equal(state(e, "doctor").state, "blocked");
  e.mode = "in_person";
  e.doctor!.facilityId = "other";
  e.doctors = known([]);
  assert.equal(state(e, "doctor").state, "not_started");
  assert.equal(state(e, "hours").state, "blocked");
});
test("unavailable doctor evidence cannot become a missing-hours instruction", () => {
  const e = ready();
  e.doctors = { state: "unknown" };
  e.doctor = null;
  assert.equal(state(e, "hours").state, "unknown");
  assert.equal(state(e, "preview").state, "unknown");
});
test("wrong clinic detail cannot certify selected clinic setup", () => {
  const e = ready();
  if (e.clinic.state === "known") e.clinic.value.facilityId = "other";
  assert.equal(state(e, "clinic").state, "not_started");
});
test("a priced service from another clinic directory cannot certify this clinic", () => {
  const e = ready();
  assert.equal(e.directory.state, "known");
  if (e.directory.state !== "known")
    throw new Error("fixture requires known directory");
  e.directory.value.facilityId = "other";
  assert.equal(state(e, "service").state, "not_started");
  assert.equal(state(e, "preview").state, "blocked");
});
test("the checked 31-day period includes its last date and excludes later sessions", () => {
  const e = ready();
  if (e.sessions.state !== "known")
    throw new Error("fixture requires known sessions");
  e.sessions.value[0].sessionOn = "2026-11-12"; // Start plus 30 days: 31 inclusive clinic dates.
  assert.equal(state(e, "hours").state, "complete");
  e.sessions.value[0].sessionOn = "2026-11-13";
  assert.equal(state(e, "hours").state, "not_started");
  assert.equal(state(e, "preview").state, "blocked");
});
test("all configuration and open capacity cannot certify an exact session/service/date booking", () => {
  const e = ready();
  if (e.slots.state !== "known" || e.prices.state !== "known")
    throw new Error("fixture requires known price and capacity");
  e.slots.value[0].status = "free";
  // The current-date quote expires before the next-day session. The available
  // session contract does not bind this clinic-wide service price to that slot.
  e.prices.value[0].validTo = "2026-10-14";
  const items = deriveSetup(e);
  assert.equal(
    items.filter((i) => i.id !== "preview" && i.state === "complete").length,
    4,
  );
  assert.equal(state(e, "preview").state, "optional_deferred");
  assert.match(
    state(e, "preview").detail,
    /actual session, service and effective fee/,
  );
  assert.match(
    state(e, "preview").detail,
    /not proof every time can be booked/,
  );
});
