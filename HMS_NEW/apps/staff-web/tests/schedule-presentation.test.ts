import assert from "node:assert/strict";
import test from "node:test";
import {
  localParts,
  scheduleAppointment,
  scheduleCatalogue,
  scheduleDoctors,
  scheduleRow,
} from "../src/hms/schedule-presentation";
import type {
  Appointment,
  Facility,
  Practitioner,
  Slot,
} from "../src/hms/types";

const facility = {
  facilityId: "clinic-a",
  name: "Clinic A",
  city: "Bengaluru",
  facilityType: "clinic",
} as Facility;
const practitioner = {
  staffId: "doctor-a",
  name: "Doctor A",
  department: "Medicine",
  acceptsVirtual: null,
} as Practitioner;
const visit = {
  appointmentId: "visit-a",
  practitionerStaffId: "doctor-a",
  practitionerName: "Doctor A",
  facilityId: "clinic-a",
  status: "confirmed",
  startsAt: "2026-10-11T04:00:00Z",
  endsAt: "2026-10-11T04:15:00Z",
  bookingPartyName: "Booker",
  bookingPartyPhone: "+919876543210",
  visitMode: "in_person",
} as Appointment;
const free = {
  facilityId: "clinic-a",
  slotStart: "2026-10-11T05:00:00Z",
  slotEnd: "2026-10-11T05:15:00Z",
  status: "free",
  visitMode: "virtual",
} as Slot;

test("original directory presentation keeps fee and experience unknown", () => {
  const doctor = scheduleDoctors(facility, [practitioner])[0];
  assert.equal(doctor.consultation_fee, null);
  assert.equal(doctor.experience_years, null);
  assert.equal(doctor.accepts_virtual, false);
  assert.equal(
    scheduleCatalogue(facility, [practitioner]).departments[0].id,
    "department-name:Medicine",
  );
});
test("timeline never invents walk-in slot times or substitutes booker contact", () => {
  assert.equal(
    scheduleAppointment({ ...visit, startsAt: null, endsAt: null }, facility),
    null,
  );
  assert.equal(scheduleAppointment(visit, facility)?.patient_phone, "");
  assert.equal(
    scheduleAppointment(visit, facility)?.patient_name,
    "Patient not linked",
  );
  assert.equal(
    scheduleAppointment({ ...visit, patientName: "Actual patient" }, facility)
      ?.patient_name,
    "Actual patient",
  );
  // The booker is reported separately, never as the patient.
  assert.deepEqual(scheduleAppointment(visit, facility)?.booked_by, {
    name: "Booker",
    phone: "+919876543210",
    patient_linked: false,
  });
});
test("partial timeline includes only permitted facility and doctor visits", () => {
  const doctor = scheduleDoctors(facility, [practitioner])[0];
  const row = scheduleRow(
    doctor,
    [free, { ...free, facilityId: "clinic-b" }],
    [
      visit,
      { ...visit, facilityId: "clinic-b" },
      { ...visit, practitionerStaffId: "doctor-b" },
    ],
    facility,
  );
  assert.equal(row.periods.length, 2);
  assert.equal(row.bookings, 1);
  assert.equal(row.available_slots, 1);
});
test("unidentified taken slots are not labelled as held or booked", () => {
  const doctor = scheduleDoctors(facility, [practitioner])[0];
  const row = scheduleRow(doctor, [{ ...free, status: "taken" }], [], facility);
  assert.deepEqual(row.periods, []);
  assert.deepEqual(row.blocks, []);
});
test("cancelled and replaced visits do not occupy the restored timeline", () => {
  const doctor = scheduleDoctors(facility, [practitioner])[0];
  const row = scheduleRow(
    doctor,
    [],
    [
      { ...visit, status: "cancelled" },
      { ...visit, status: "rescheduled" },
    ],
    facility,
  );
  assert.equal(row.bookings, 0);
});
test("calendar day: published hours, blocks with their exception, closures and holidays", () => {
  const doctor = scheduleDoctors(facility, [practitioner])[0];
  const clinic = { ...facility, timezone: "Asia/Kolkata" } as Facility;
  assert.deepEqual(localParts("2026-10-11T04:00:00Z", "Asia/Kolkata"), { date: "2026-10-11", time: "09:30" });
  const blocked = { ...free, status: "blocked", slotStart: "2026-10-11T04:30:00Z", slotEnd: "2026-10-11T04:45:00Z" } as Slot;
  const row = scheduleRow(doctor, [blocked], [], clinic, {
    day: "2026-10-11",
    sessions: [{ sessionOn: "2026-10-11", facilityId: "clinic-a", visitMode: "in_person", startsAt: "2026-10-11T03:30:00Z", endsAt: "2026-10-11T05:30:00Z", slotMinutes: 15, maxWalkInTokens: 0, source: "weekly" }],
    exceptions: [
      { scheduleExceptionId: "block-b", onDate: "2026-10-11", kind: "block", start: "10:00:00", end: "10:30:00", facilityId: "clinic-b", reason: "Other clinic", revokedAt: null },
      { scheduleExceptionId: "block-a", onDate: "2026-10-11", kind: "block", start: "10:00:00", end: "10:30:00", facilityId: "clinic-a", reason: "Meeting", revokedAt: null },
      { scheduleExceptionId: "old", onDate: "2026-10-11", kind: "closed", start: null, end: null, facilityId: null, reason: "Revoked leave", revokedAt: "2026-10-01T00:00:00Z" },
    ],
    holidays: [{ facilityHolidayId: "h", date: "2026-10-11", name: "Festival", revokedAt: null }],
  });
  assert.deepEqual(row.blocks, [{ branch_id: "clinic-a", consultation_type: "in_person", starts_at_local: "09:00", ends_at_local: "11:00", slot_minutes: 15 }]);
  const blocks = row.periods.filter((p) => p.kind === "blocked");
  assert.deepEqual(blocks.map((p) => [p.exception_id, p.reason]), [[undefined, "Clinic holiday: Festival"], ["block-a", "Meeting"]]);
});
