import { test } from "node:test";
import assert from "node:assert/strict";
import {
  can,
  permittedFacilities,
  practitionersFor,
  money,
  time,
  filterLoadedAppointments,
} from "../src/hms/model.ts";
import type {
  Me,
  Facility,
  Practitioner,
  Appointment,
} from "../src/hms/types.ts";
const me: Me = {
  tenantId: "hospital",
  staffId: "staff",
  displayName: "Reception",
  staffType: "admin",
  isSystemAccount: false,
  permissions: {
    "appointments.book": ["clinic-a"],
    "clinical.read": ["clinic-b"],
  },
};
test("facility permission never becomes a global boolean or an admin-type grant", () => {
  assert.ok(can(me, "appointments.book", "clinic-a"));
  assert.equal(can(me, "appointments.book", "clinic-b"), false);
  assert.equal(can(me, "staff.manage", "clinic-a"), false);
  assert.ok(
    can(
      { ...me, permissions: { "appointments.book": ["*"] } },
      "appointments.book",
      "clinic-b",
    ),
  );
});
test("facility selector only lists scope granted by some permission", () => {
  const facilities = ["clinic-a", "clinic-b", "clinic-c"].map(
    (facilityId) => ({ facilityId }) as Facility,
  );
  assert.deepEqual(
    permittedFacilities(me, facilities).map((f) => f.facilityId),
    ["clinic-a", "clinic-b"],
  );
});
test("practitioner affiliations are grouped within selected facility", () => {
  const rows = [
    { staffId: "d1", facilityId: "a" },
    { staffId: "d1", facilityId: "a" },
    { staffId: "d2", facilityId: "b" },
  ] as Practitioner[];
  assert.deepEqual(
    practitionersFor(rows, "a").map((p) => p.staffId),
    ["d1"],
  );
});
test("unknown fee and walk-in time remain explicit", () => {
  assert.equal(money(null), "Fee not available");
  assert.notEqual(money(0), money(null));
  assert.equal(time(null, "Asia/Kolkata"), "Walk-in");
});
test("loaded-row search distinguishes booking party and nullable patient data", () => {
  const rows = [
    {
      appointmentId: "a",
      patientName: null,
      bookingPartyName: "Relative",
      bookingPartyPhone: "+919999999999",
      visitMode: "virtual",
    },
    {
      appointmentId: "b",
      patientName: "Patient",
      mrn: "123",
      visitMode: "in_person",
    },
  ] as Appointment[];
  assert.deepEqual(
    filterLoadedAppointments(rows, "relative", "virtual").map(
      (a) => a.appointmentId,
    ),
    ["a"],
  );
  assert.equal(
    filterLoadedAppointments(rows, "relative", "in_person").length,
    0,
  );
});
