import type { BookingReadiness } from "@hms/contracts";
import type {
  ClinicDirectory,
  FacilityDetail,
  Practitioner,
  PriceBookItem,
  Session,
  Slot,
} from "./types";
export type Evidence<T> =
  { state: "loading" | "unknown" } | { state: "known"; value: T };
export type SetupState =
  | "loading"
  | "unknown"
  | "not_started"
  | "blocked"
  | "complete"
  | "optional_deferred";
export type SetupItem = {
  id: string;
  title: string;
  state: SetupState;
  detail: string;
  destination: string;
  permission: string;
};
export type SetupEvidence = {
  facilityId: string;
  day: string;
  mode: "in_person" | "virtual";
  clinic: Evidence<FacilityDetail>;
  doctors: Evidence<Practitioner[]>;
  doctor: Practitioner | null;
  directory: Evidence<ClinicDirectory>;
  prices: Evidence<PriceBookItem[]>;
  sessions: Evidence<Session[]>;
  slots: Evidence<Slot[]>;
  readiness?: Evidence<BookingReadiness>;
};
const missingRead = (e: Evidence<unknown>): SetupState | null =>
  e.state === "known" ? null : e.state;
export function deriveSetup(e: SetupEvidence): SetupItem[] {
  const item = (
    id: string,
    title: string,
    state: SetupState,
    detail: string,
    destination: string,
    permission: string,
  ): SetupItem => ({ id, title, state, detail, destination, permission });
  const clinic = e.clinic.state === "known" ? e.clinic.value : null;
  const clinicOk =
    !!clinic &&
    clinic.facilityId === e.facilityId &&
    clinic.status === "active" &&
    !!clinic.addressLine1 &&
    !!clinic.city &&
    !!clinic.stateCode &&
    !!clinic.timezone;
  const doctorKnown =
    e.doctors.state === "known" &&
    e.doctors.value.some(
      (d) => d.staffId === e.doctor?.staffId && d.facilityId === e.facilityId,
    );
  const doctorState =
    missingRead(e.doctors) ??
    (e.doctor && doctorKnown
      ? e.mode === "virtual" && e.doctor.acceptsVirtual !== true
        ? "blocked"
        : e.doctor.calendarId
          ? "complete"
          : "not_started"
      : "not_started");
  const serviceState = missingRead(e.directory) ?? missingRead(e.prices);
  const services =
    e.directory.state === "known" &&
    e.directory.value.facilityId === e.facilityId
      ? e.directory.value.services.filter(
          (s) =>
            s.status === "active" &&
            (s.serviceMode === e.mode || s.serviceMode === "both"),
        )
      : [];
  const prices = e.prices.state === "known" ? e.prices.value : [];
  const priced = services.some((s) =>
    prices.some(
      (p) =>
        p.healthcareServiceId === s.healthcareServiceId &&
        (!p.staffId || p.staffId === e.doctor?.staffId) &&
        (p.mode === e.mode || p.mode === "any") &&
        typeof p.feeMinor === "number" &&
        p.feeMinor >= 0 &&
        p.validFrom <= e.day &&
        (!p.validTo || p.validTo > e.day),
    ),
  );
  const sessions =
    e.sessions.state === "known"
      ? e.sessions.value.filter(
          (s) =>
            s.facilityId === e.facilityId &&
            s.visitMode === e.mode &&
            s.slotMinutes !== null &&
            s.sessionOn >= e.day &&
            s.sessionOn <=
              new Date(Date.parse(`${e.day}T12:00:00Z`) + 30 * 86400000)
                .toISOString()
                .slice(0, 10),
        )
      : [];
  const hoursState =
    missingRead(e.doctors) ??
    (!e.doctor?.calendarId || !doctorKnown || doctorState === "blocked"
      ? "blocked"
      : (missingRead(e.sessions) ??
        (sessions.length ? "complete" : "not_started")));
  const configured =
    clinicOk &&
    doctorState === "complete" &&
    priced &&
    hoursState === "complete";
  const previewState = [
    missingRead(e.clinic),
    doctorState === "unknown" || doctorState === "loading" ? doctorState : null,
    serviceState,
    missingRead(e.sessions),
    missingRead(e.slots),
  ].find(Boolean);
  const available =
    e.slots.state === "known"
      ? e.slots.value.filter(
          (s) =>
            s.facilityId === e.facilityId &&
            s.visitMode === e.mode &&
            s.status === "free" &&
            Date.parse(s.slotStart) >=
              Date.parse(`${e.day}T00:00:00Z`) - 86400000 &&
            Date.parse(s.slotStart) <=
              Date.parse(`${e.day}T00:00:00Z`) + 31 * 86400000,
        )
      : [];
  const exact = e.readiness?.state === "known" ? e.readiness.value : null;
  const exactState = e.readiness ? missingRead(e.readiness) : null;
  const exactInScope = exact && exact.facilityId === e.facilityId && exact.staffId === e.doctor?.staffId && exact.visitMode === e.mode &&
    e.slots.state === "known" && e.slots.value.some((s) => s.slotStart === exact.slotStart && s.facilityId === exact.facilityId && s.visitMode === exact.visitMode && (s.healthcareServiceId ?? null) === exact.healthcareServiceId);
  const exactDetail = exactInScope
    ? `${exact.configuration.complete ? "Configuration confirmed" : "Configuration needs review"} for the selected doctor’s session on ${exact.sessionOn}. ${exact.fee ? `Exact fee: ₹${(exact.fee.feeMinor / 100).toFixed(2)}.` : "No eligible fee recorded; a missing fee is not free."} ${exact.occupancy === "free" ? "This time was open when checked." : `Capacity: ${exact.occupancy.replaceAll("_", " ")}.`} Saving rechecks availability and pricing; this read never holds a time. Video provider, consent and signing are separate checks.`
    : null;
  return [
    item(
      "clinic",
      "Clinic details",
      missingRead(e.clinic) ?? (clinicOk ? "complete" : "not_started"),
      clinicOk
        ? "Address and timezone are recorded; public publishing and contact verification are separate."
        : "Confirm the active clinic’s address and timezone.",
      "catalogue",
      "facility.manage",
    ),
    item(
      "doctor",
      "Doctor and calendar",
      doctorState,
      e.doctor
        ? e.doctor.calendarId
          ? e.mode === "virtual" && e.doctor.acceptsVirtual !== true
            ? "Enable teleconsultations on this doctor’s booking profile before publishing video hours."
            : `${e.doctor.name} has a calendar. Account access and professional registration are separate checks.`
          : `${e.doctor.name} needs a calendar before hours can be published.`
        : "Add the doctor patients can book.",
      e.doctor
        ? `doctors?doctor=${encodeURIComponent(e.doctor.staffId)}`
        : "doctors",
      "catalog.manage",
    ),
    item(
      "service",
      "Consultation and fee",
      exactState ?? (exactInScope ? (exact.fee ? "complete" : "not_started") : serviceState ?? (priced ? "complete" : "not_started")),
      exactInScope ? (exact.fee ? `The selected session on ${exact.sessionOn} has an eligible fee of ₹${(exact.fee.feeMinor / 100).toFixed(2)}. Zero is a deliberate free consultation.` : "The selected session has no eligible fee recorded; a missing fee is not free.") : priced
        ? "An active compatible consultation has a fee effective today. Zero is a deliberate free consultation."
        : "Add a compatible consultation and its effective fee; a blank fee is not free.",
      "catalogue",
      "pricing.manage",
    ),
    item(
      "hours",
      "Upcoming bookable hours",
      hoursState,
      sessions.length
        ? `${sessions.length} published session(s) in the next 31 days. Full, held or blocked times still count as configured hours.`
        : "Publish upcoming hours for this doctor and visit type. The checked period is the next 31 days.",
      e.doctor
        ? `schedules?doctor=${encodeURIComponent(e.doctor.staffId)}&mode=${e.mode}`
        : "schedules",
      "schedules.manage",
    ),
    item(
      "preview",
      "Exact session and fee",
      exactState ?? (exactInScope ? (exact.configuration.complete ? "complete" : "blocked") : previewState ?? (configured ? "optional_deferred" : "blocked")),
      exactDetail ?? (configured
        ? available.length
          ? `${available.length} times were returned as open. Choose a time in Book appointment; the actual session, service and effective fee are checked when saving. Clinic-level configuration is not proof every time can be booked.`
          : "Recorded configuration is present; no free times in this period. Choose another period or review the schedule. Exact session, service and fee eligibility is checked during booking."
        : "Resolve the configuration checks above. This read-only guide never reserves a time or creates a booking."),
      e.mode === "virtual"
        ? "appointments?book=1&mode=virtual"
        : "appointments",
      "appointments.book",
    ),
  ];
}
