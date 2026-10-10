import type { Catalogue } from "@/lib/api";
import type { Doctor } from "@/modules/clinic-types";
import type { DeskAppointment } from "@/modules/NurseDesk";
import type { Period } from "@/modules/schedule-timeline";
import type { Appointment, Facility, Practitioner, Slot } from "./types";

export function scheduleCatalogue(
  facility: Facility,
  practitioners: Practitioner[],
): Catalogue {
  return {
    branches: [
      {
        id: facility.facilityId,
        name: facility.name,
        area: facility.city ?? "",
        is_active: true,
        is_virtual: facility.facilityType === "virtual",
        address: "",
        directions_url: "",
        arrival_instructions: "",
      },
    ],
    // These are local filter keys from affiliation names, never backend department identifiers.
    departments: [...new Set(practitioners.map((p) => p.department))].map(
      (name) => ({
        id: `department-name:${name}`,
        name,
        slug: "",
        is_active: true,
      }),
    ),
  };
}
export function scheduleDoctors(
  facility: Facility,
  practitioners: Practitioner[],
): Doctor[] {
  return practitioners.map((p) => ({
    id: p.staffId,
    name: p.name,
    title: p.specialtyName ?? p.department,
    bio: "",
    experience_years: null,
    consultation_fee: null,
    is_active: true,
    accepts_virtual: p.acceptsVirtual === true,
    departments: [
      { id: `department-name:${p.department}`, name: p.department },
    ],
    branches: [{ id: facility.facilityId, name: facility.name }],
  }));
}
export function scheduleAppointment(
  a: Appointment,
  facility: Facility,
): DeskAppointment | null {
  if (!a.startsAt || !a.endsAt) return null;
  return {
    id: a.appointmentId,
    confirmation_code: a.confirmationCode,
    patient_name:
      a.patientName ??
      (a.patientId ? "Patient name unavailable" : "Patient not linked"),
    patient_phone: "", // Booking-party phone is not patient contact data.
    status: a.status,
    origin_channel: a.originChannel,
    starts_at: a.startsAt,
    ends_at: a.endsAt,
    consultation_type: a.visitMode,
    doctor: { id: a.practitionerStaffId, name: a.practitionerName },
    branch: {
      id: facility.facilityId,
      name: facility.name,
      area: facility.city ?? "",
    },
  };
}
export function scheduleRow(
  doctor: Doctor,
  slots: Slot[],
  appointments: Appointment[],
  facility: Facility,
) {
  const visits = appointments.filter(
    (a) =>
      a.practitionerStaffId === doctor.id &&
      a.facilityId === facility.facilityId &&
      !["cancelled", "rescheduled"].includes(a.status),
  );
  const periods: Period[] = slots
    .filter((s) => s.facilityId === facility.facilityId && s.status === "free")
    .map((s) => ({
      kind: "available",
      starts_at: s.slotStart,
      ends_at: s.slotEnd,
      branch_id: facility.facilityId,
      consultation_type: s.visitMode,
    }));
  for (const visit of visits) {
    const appointment = scheduleAppointment(visit, facility);
    if (appointment)
      periods.push({
        kind: "booked",
        starts_at: appointment.starts_at,
        ends_at: appointment.ends_at,
        branch_id: facility.facilityId,
        consultation_type: visit.visitMode,
        appointment,
      });
  }
  // Missing closure/hold metadata and taken slots are deliberately not converted into invented periods.
  return {
    doctor_id: doctor.id,
    blocks: [],
    has_override: false,
    reason:
      "Published hours, closures and holds require the complete calendar read model.",
    periods: periods.sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    available_slots: periods.filter((p) => p.kind === "available").length,
    bookings: periods.filter((p) => p.kind === "booked").length,
  };
}
