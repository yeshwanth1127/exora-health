import { patientDisplayName } from "./patient-presentation";
import type { Catalogue } from "@/lib/api";
import type { Doctor, TimeBlock } from "@/modules/clinic-types";
import type { DeskAppointment } from "@/modules/NurseDesk";
import type { Period } from "@/modules/schedule-timeline";
import type {
  Appointment,
  Facility,
  FacilityHoliday,
  Practitioner,
  ScheduleException,
  Session,
  Slot,
} from "./types";

/** Facility-local date and HH:MM of an instant. */
export function localParts(iso: string, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}

export type CalendarDay = {
  day: string;
  sessions: Session[];
  exceptions: ScheduleException[];
  holidays: FacilityHoliday[];
  /** Live holds (time only, no patient) from the calendar board. */
  holds?: {
    startsAt: string;
    endsAt: string;
    holdExpiresAt: string;
    kind: string;
  }[];
};

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
    patient_name: patientDisplayName(
      a.patientId,
      a.patientName ??
        (a.patientId ? "Patient name unavailable" : "Patient not linked"),
    ),
    patient_phone: "", // Booking-party phone is not patient contact data.
    booked_by: a.bookingPartyName
      ? {
          name: a.bookingPartyName,
          phone: a.bookingPartyPhone,
          patient_linked: !!a.patientId,
        }
      : null,
    status: a.status,
    origin_channel: a.originChannel,
    starts_at: a.startsAt,
    ends_at: a.endsAt,
    consultation_type: a.visitMode,
    overbooking_reason: a.overbookReason,
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
  calendar?: CalendarDay,
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
  let blocks: TimeBlock[] = [],
    reason = "";
  if (calendar) {
    for (const h of calendar.holds ?? [])
      periods.push({
        kind: "held",
        starts_at: h.startsAt,
        ends_at: h.endsAt,
        branch_id: facility.facilityId,
        reason: `${h.kind === "waitlist_offer" ? "Offered from the waitlist" : "Being booked"} · held until ${localParts(h.holdExpiresAt, facility.timezone).time}`,
      });
    const local = (iso: string) => localParts(iso, facility.timezone).time;
    blocks = calendar.sessions
      .filter((x) => x.facilityId === facility.facilityId && x.slotMinutes)
      .map((x) => ({
        branch_id: x.facilityId,
        consultation_type: x.visitMode,
        starts_at_local: local(x.startsAt),
        ends_at_local: local(x.endsAt),
        slot_minutes: x.slotMinutes!,
      }));
    // Blocked slots carry the exception that blocks them, so it can be reviewed and unblocked.
    const applies = (e: ScheduleException) =>
      !e.revokedAt &&
      e.kind !== "extra_hours" &&
      (e.facilityId === null || e.facilityId === facility.facilityId);
    for (const s of slots) {
      if (s.facilityId !== facility.facilityId || s.status !== "blocked")
        continue;
      const t = local(s.slotStart);
      const e = calendar.exceptions.find(
        (x) =>
          applies(x) &&
          x.start &&
          x.start.slice(0, 5) <= t &&
          t < x.end!.slice(0, 5),
      );
      periods.push({
        kind: "blocked",
        starts_at: s.slotStart,
        ends_at: s.slotEnd,
        branch_id: facility.facilityId,
        consultation_type: s.visitMode,
        reason: e?.reason ?? "Blocked",
        exception_id: e?.scheduleExceptionId,
      });
    }
    // Whole-day closures and holidays remove the sessions entirely: show the day as blocked.
    const dayStart = new Date(`${calendar.day}T00:00:00+05:30`).toISOString(),
      dayEnd = new Date(`${calendar.day}T23:59:00+05:30`).toISOString();
    for (const e of calendar.exceptions.filter(
      (x) => applies(x) && x.kind === "closed" && !x.start,
    ))
      periods.push({
        kind: "blocked",
        starts_at: dayStart,
        ends_at: dayEnd,
        branch_id: e.facilityId,
        reason: `Closed all day${e.reason ? `: ${e.reason}` : ""}`,
        exception_id: e.scheduleExceptionId,
      });
    for (const h of calendar.holidays.filter((x) => !x.revokedAt))
      periods.push({
        kind: "blocked",
        starts_at: dayStart,
        ends_at: dayEnd,
        branch_id: facility.facilityId,
        reason: `Clinic holiday: ${h.name}`,
      });
  }
  return {
    doctor_id: doctor.id,
    blocks,
    has_override: !!calendar?.sessions.some((x) => x.source === "day_plan"),
    reason,
    periods: periods.sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    available_slots: periods.filter((p) => p.kind === "available").length,
    bookings: periods.filter((p) => p.kind === "booked").length,
  };
}
