import type { HmsError } from "./client";
import type {
  Appointment,
  Facility,
  Me,
  NoteTemplate,
  Practitioner,
} from "./types";
export function can(me: Me, permission: string, facilityId?: string) {
  const scopes = me.permissions[permission] ?? [];
  return facilityId
    ? scopes.includes("*") || scopes.includes(facilityId)
    : scopes.length > 0;
}
export function permittedFacilities(me: Me, facilities: Facility[]) {
  return facilities.filter((f) =>
    Object.values(me.permissions).some(
      (scopes) => scopes.includes("*") || scopes.includes(f.facilityId),
    ),
  );
}
export function practitionersFor(items: Practitioner[], facilityId: string) {
  return [
    ...new Map(
      items
        .filter((p) => p.facilityId === facilityId)
        .map((p) => [p.staffId, p]),
    ).values(),
  ];
}
export const label = (value: string) =>
  value.replaceAll("_", " ").replace(/^./, (v) => v.toUpperCase());
export function today(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function time(value: string | null, timezone: string) {
  return value
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "Walk-in";
}
export function money(value: number | null) {
  return value === null
    ? "Fee not available"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(value / 100);
}
export function filterLoadedAppointments(
  items: Appointment[],
  text: string,
  mode: string,
) {
  const needle = text.trim().toLowerCase();
  return items.filter(
    (a) =>
      (!mode || a.visitMode === mode) &&
      (!needle ||
        [
          a.patientName,
          a.bookingPartyName,
          a.bookingPartyPhone,
          a.mrn,
          a.confirmationCode,
          a.practitionerName,
        ].some((v) => v?.toLowerCase().includes(needle))),
  );
}
/**
 * String fields of a note template with display titles. Stored jsonb does not keep key order,
 * so an explicit `propertyOrder` wins when the template provides one.
 */
export function templateFields(schema: NoteTemplate["schema"]) {
  const order = schema.propertyOrder ?? [];
  const rank = (key: string) =>
    order.includes(key) ? order.indexOf(key) : order.length;
  return Object.entries(schema.properties ?? {})
    .filter(([, spec]) => !spec.type || spec.type === "string")
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([key, spec]) => [key, spec.title ?? label(key)] as const);
}
export const needsCareAccess = (failure: HmsError | null) =>
  failure?.status === 403 && failure.details.reason === "no_care_relationship";
