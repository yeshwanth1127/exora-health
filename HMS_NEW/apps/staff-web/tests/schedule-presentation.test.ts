import assert from "node:assert/strict";
import test from "node:test";
import {
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
