import { query, request } from "./client";
import type { Appointment, Slot } from "./types";

export type AppointmentMode = "in_person" | "virtual";
export const appointmentModeLabel = (mode: string) =>
  mode === "virtual" ? "Teleconsultation" : "In person";
export const bookableSlots = (slots: Slot[], mode: AppointmentMode) =>
  slots.filter((s) => s.status === "free" && s.visitMode === mode);
export const activeAppointments = (items: Appointment[], excludeId?: string) =>
  items.filter(
    (a) =>
      a.appointmentId !== excludeId &&
      ["confirmed", "checked_in"].includes(a.status),
  );

// Follow every cursor: an empty first page of active matches is not a complete check.
export async function upcomingPatientAppointments(
  facilityId: string,
  patientId: string,
  from: string,
  signal?: AbortSignal,
) {
  const items = new Map<string, Appointment>();
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await request<{
      items: Appointment[];
      nextCursor: string | null;
    }>(
      `/v1/appointments?${query({ facilityId, patientId, from, to: "9999-12-31", limit: 500, cursor })}`,
      { signal },
    );
    for (const a of page.items) items.set(a.appointmentId, a);
    cursor = page.nextCursor ?? undefined;
    if (cursor && seen.has(cursor))
      throw new Error(
        "Appointment history could not be checked completely. Please retry.",
      );
    if (cursor) seen.add(cursor);
  } while (cursor);
  return activeAppointments([...items.values()]);
}
