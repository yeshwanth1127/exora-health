import { BookingReadinessSchema, type BookingReadiness } from "@hms/contracts";
import { query } from "./client";
import { useQuery, useWorkspace } from "./hooks";
import { today } from "./model";
import { addDays } from "./forms";
import { deriveSetup, type Evidence } from "./setup-readiness";
import type {
  ClinicDirectory,
  FacilityDetail,
  Practitioner,
  PriceBookItem,
  Session,
  Slot,
} from "./types";
function evidence<T>(
  r: { loading: boolean; error: string; data: T | null },
  allowed: boolean,
): Evidence<T> {
  if (!allowed || r.error) return { state: "unknown" };
  if (r.loading) return { state: "loading" };
  return r.data === null
    ? { state: "unknown" }
    : { state: "known", value: r.data };
}
function rows<T>(e: Evidence<{ items: T[] }>): Evidence<T[]> {
  return e.state === "known" ? { state: "known", value: e.value.items } : e;
}
/** Booking setup evidence for one doctor and visit type (Overview setup guide and admin alerts). Read-only. */
export function useSetupItems(mode: "in_person" | "virtual", selected: string) {
  const { facility, can } = useWorkspace();
  const day = today(facility.timezone),
    until = addDays(day, 30);
  const admin = [
    "facility.manage",
    "catalog.manage",
    "pricing.manage",
    "schedules.manage",
  ].some(can);
  const readCatalog = admin && can("catalog.read"),
    readHours = admin && can("appointments.read");
  const doctors = useQuery<{ items: Practitioner[] }>(
    readCatalog ? `/v1/practitioners?facilityId=${facility.facilityId}` : null,
  );
  const practitioners =
    doctors.data?.items.filter((p) => p.facilityId === facility.facilityId) ??
    [];
  const doctor =
    practitioners.find((p) => p.staffId === selected) ??
    practitioners[0] ??
    null;
  const clinic = useQuery<FacilityDetail>(
    readCatalog ? `/v1/facilities/${facility.facilityId}` : null,
  );
  const directory = useQuery<ClinicDirectory>(
    readCatalog ? `/v1/facilities/${facility.facilityId}/directory` : null,
  );
  const prices = useQuery<{ items: PriceBookItem[] }>(
    readCatalog
      ? `/v1/facilities/${facility.facilityId}/price-book?on=${day}`
      : null,
  );
  const sessions = useQuery<{ items: Session[] }>(
    readHours && doctor?.calendarId
      ? `/v1/practitioners/${doctor.staffId}/sessions?from=${day}&to=${until}`
      : null,
  );
  const slots = useQuery<{ items: Slot[] }>(
    readHours && doctor?.calendarId
      ? `/v1/practitioners/${doctor.staffId}/slots?facilityId=${facility.facilityId}&from=${day}&to=${until}&includeUnavailable=true`
      : null,
  );
  const exactSlot = slots.data?.items.find((s) => s.facilityId === facility.facilityId && s.visitMode === mode);
  const readiness = useQuery<BookingReadiness>(
    readHours && doctor && exactSlot
      ? `/v1/booking/readiness?${query({ facilityId: facility.facilityId, staffId: doctor.staffId, slotStart: exactSlot.slotStart, visitMode: mode, healthcareServiceId: exactSlot.healthcareServiceId ?? "null" })}`
      : null,
    0,
    (value) => BookingReadinessSchema.parse(value),
  );
  const items = deriveSetup({
    facilityId: facility.facilityId,
    day,
    mode,
    clinic: evidence(clinic, readCatalog),
    doctors: rows(evidence(doctors, readCatalog)),
    doctor,
    directory: evidence(directory, readCatalog),
    prices: rows(evidence(prices, readCatalog)),
    sessions: rows(evidence(sessions, readHours)),
    slots: rows(evidence(slots, readHours)),
    readiness: exactSlot ? evidence(readiness, readHours) : undefined,
  });
  const recheck = async () => {
    const active: [{ refresh: () => Promise<boolean> }, boolean][] = [
      [doctors, readCatalog],
      [clinic, readCatalog],
      [directory, readCatalog],
      [prices, readCatalog],
      [sessions, readHours && !!doctor?.calendarId],
      [slots, readHours && !!doctor?.calendarId],
      [readiness, readHours && !!doctor && !!exactSlot],
    ];
    const results = await Promise.all(active.map(([q, on]) => (on ? q.refresh() : Promise.resolve(true))));
    if (results.includes(false)) throw new Error("recheck failed");
    return "Saved setup rechecked.";
  };
  return { admin, day, until, practitioners, doctor, items, recheck };
}
