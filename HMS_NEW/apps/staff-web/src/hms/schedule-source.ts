// Maps the original schedule components' reads and writes onto the /v1 API.
// Every write is authorized by the backend for the clinic it affects; nothing is simulated here.
import type { OriginalResourceSource } from "@/components/resource-source";
import type { DeskAppointment } from "@/modules/NurseDesk";
import { HmsError, query, request } from "./client";
import { can } from "./model";
import {
  localParts,
  scheduleAppointment,
  scheduleCatalogue,
  scheduleDoctors,
  scheduleRow,
} from "./schedule-presentation";
import type {
  Appointment,
  Facility,
  FacilityHoliday,
  Me,
  Practitioner,
  ScheduleException,
  Session,
  Slot,
  WeeklyPlanResult,
  WeeklyRule,
} from "./types";

type Body = Record<string, unknown>;
type Board = {
  asOf: string;
  rows: {
    staffId: string;
    calendar: boolean;
    sessions: { startsAt: string; endsAt: string; visitMode: string; slotMinutes: number | null; maxWalkInTokens: number; source: string }[];
    slots: { slotStart: string; slotEnd: string; visitMode: string; status: string }[];
    holds: { startsAt: string; endsAt: string; holdExpiresAt: string; kind: string }[];
    exceptions: { scheduleExceptionId: string; kind: ScheduleException["kind"]; start: string | null; end: string | null; facilityId: string | null; reason: string | null }[];
  }[];
};
type Group = { days: number[]; windows: { start: string; end: string }[] };

const unavailable = (what: string) =>
  new HmsError(`${what} is not available yet.`, 501, "backend_pending");
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** One key per intent (G26): retrying the same change after a lost response replays it, not repeats it. */
const intents = new Map<string, string>();
const keyFor = (intent: unknown) => {
  const k = JSON.stringify(intent);
  if (!intents.has(k)) intents.set(k, crypto.randomUUID());
  return intents.get(k)!;
};

export function scheduleSource(
  me: Me,
  facility: Facility,
  practitioners: Practitioner[],
  day: string,
  overbooking: boolean,
): OriginalResourceSource {
  const catalogue = scheduleCatalogue(facility, practitioners),
    doctors = scheduleDoctors(facility, practitioners);
  const local = (iso: string) => localParts(iso, facility.timezone);
  const manage = can(me, "schedules.manage", facility.facilityId);
  const allowed = {
    "schedules.manage": manage,
    "schedule.block": manage,
    // Booking and moves take one published slot (hold, then book or reschedule); free-form ranges stay G08.
    "appointments.create": can(me, "appointments.book", facility.facilityId),
    "appointments.reschedule":
      can(me, "appointments.book", facility.facilityId) &&
      can(me, "appointments.reschedule", facility.facilityId),
    // Overbooking needs the clinic switch and the permission; the backend enforces both and the cap.
    "appointments.overbook":
      overbooking &&
      can(me, "appointments.book", facility.facilityId) &&
      can(me, "appointments.overbook", facility.facilityId),
    // The original Delete is a reasoned cancellation; the record and audit history stay.
    "appointments.delete": can(me, "appointments.cancel", facility.facilityId),
  };
  const appointmentsById = async (ids: string[]) =>
    (
      await Promise.all(
        ids.map((id) => request<Appointment>(`/v1/appointments/${id}`)),
      )
    )
      .map((a) => scheduleAppointment(a, facility))
      .filter((a): a is DeskAppointment => !!a);
  const weeklyBody = (b: Body) => ({
    facilityId: b.branch_id,
    visitMode: b.consultation_type,
    effectiveFrom: b.effective_from,
    // The editor's "repeat until" is inclusive; the API's end is exclusive.
    effectiveTo: b.effective_until ? addDays(String(b.effective_until), 1) : null,
    slotMinutes: b.slot_minutes,
    sessions: (b.groups as Group[]).flatMap((g) =>
      g.days.flatMap((d) =>
        g.windows.map((w) => ({ weekday: d + 1, start: w.start, end: w.end })),
      ),
    ),
  });

  async function readWeekly(url: URL) {
    const doctor = url.searchParams.get("doctor_id")!,
      branch = url.searchParams.get("branch_id"),
      mode = url.searchParams.get("consultation_type"),
      on = url.searchParams.get("day")!;
    const { items } = await request<{ items: WeeklyRule[] }>(
      `/v1/practitioners/${doctor}/weekly-sessions?${query({ from: on })}`,
    );
    const rules = items.filter(
      (r) =>
        r.facilityId === branch &&
        r.visitMode === mode &&
        r.slotMinutes &&
        r.effectiveFrom <= on &&
        (!r.effectiveTo || r.effectiveTo > on),
    );
    // Days with identical windows form one group, as the editor expects.
    const byDay = new Map<number, { start: string; end: string }[]>();
    for (const r of rules)
      byDay.set(r.weekday - 1, [
        ...(byDay.get(r.weekday - 1) ?? []),
        { start: r.start.slice(0, 5), end: r.end.slice(0, 5) },
      ]);
    const groups: Group[] = [];
    for (const [d, windows] of [...byDay].sort(([a], [b]) => a - b)) {
      const same = groups.find(
        (g) => JSON.stringify(g.windows) === JSON.stringify(windows),
      );
      if (same) same.days.push(d);
      else groups.push({ days: [d], windows });
    }
    return { groups, slot_minutes: rules[0]?.slotMinutes ?? 30 };
  }

  /** The one published slot at this clinic that the chosen time must match exactly. */
  async function slotAt(doctor: string, starts: string, ends: string, mode: string | null, signal?: AbortSignal) {
    const date = local(starts).date;
    const { items } = await request<{ items: Slot[] }>(
      `/v1/practitioners/${doctor}/slots?${query({ facilityId: facility.facilityId, from: date, to: date, includeUnavailable: true })}`,
      { signal },
    );
    const at = Date.parse(starts);
    const slot = items.find((s) => Date.parse(s.slotStart) === at && Date.parse(s.slotEnd) === Date.parse(ends));
    if (!slot) {
      const near = items.find((s) => Date.parse(s.slotStart) <= at && at < Date.parse(s.slotEnd));
      throw new HmsError(
        near
          ? `Appointments here are one slot each: choose ${local(near.slotStart).time}–${local(near.slotEnd).time}.`
          : "Choose a time inside the doctor's published hours at this clinic.",
        422,
        "validation",
      );
    }
    if (mode && slot.visitMode !== mode)
      throw new HmsError(`This slot is for ${slot.visitMode === "virtual" ? "virtual" : "in-person"} visits.`, 422, "validation");
    if (slot.status === "blocked") throw new HmsError("This time is blocked.", 409, "slot_blocked");
    return slot;
  }
  /** Holds one slot briefly. The same key replays the same hold, so a retried save returns the first
   * booking; a slot someone else holds or booked is refused by the backend. */
  const hold = (doctor: string, slotStart: string, operation: string) =>
    request<{ reservationId: string }>("/v1/holds", {
      method: "POST",
      idempotencyKey: `${operation}:hold`,
      body: { staffId: doctor, slotStart, holdMinutes: 5 },
    });
  /** Holds the exact time chosen (G08) when it isn't one whole published slot. */
  const holdExact = (doctor: string, startsAt: string, endsAt: string, mode: string | null, operation: string) =>
    request<{ reservationId: string }>("/v1/holds/range", {
      method: "POST",
      idempotencyKey: `${operation}:range`,
      body: { staffId: doctor, startsAt, endsAt, holdMinutes: 5, ...(mode ? { visitMode: mode } : {}) },
    });
  /** A whole published slot when the time matches one exactly, else the exact range. */
  async function holdFor(doctor: string, starts: string, ends: string, mode: string | null, operation: string) {
    try {
      const slot = await slotAt(doctor, starts, ends, mode);
      return hold(doctor, slot.slotStart, operation);
    } catch (e) {
      if (e instanceof HmsError && e.code === "validation" && e.status === 422) return holdExact(doctor, starts, ends, mode, operation);
      throw e;
    }
  }

  /** The original pre-save check, answered from the doctor's slots: overbooking needs a taken slot. */
  async function readCheck(url: URL, signal: AbortSignal) {
    const p = url.searchParams;
    const slot = await slotAt(p.get("doctor_id")!, p.get("starts_at")!, p.get("ends_at")!, p.get("consultation_type"), signal);
    return { overlapping_bookings: slot.status === "taken" ? 1 : 0 };
  }

  async function readBoard(url: URL, signal: AbortSignal) {
    const date = url.searchParams.get("day") ?? day;
    const branch = url.searchParams.get("branch_id");
    if (branch && branch !== facility.facilityId)
      throw new HmsError("Switch clinic to inspect another facility.", 403, "facility_scope");
    const range = { from: date, to: date };
    // One consistent snapshot of the clinic's day (G04), plus the full appointment rows for the sheets.
    const [appointments, holidays, board] = await Promise.all([
      request<{ items: Appointment[] }>(
        `/v1/appointments?${query({ facilityId: facility.facilityId, ...range, limit: 500 })}`,
        { signal },
      ),
      request<{ items: FacilityHoliday[] }>(
        `/v1/facilities/${facility.facilityId}/holidays?${query(range)}`,
        { signal },
      ),
      request<Board>(`/v1/calendar-board?${query({ facilityId: facility.facilityId, date })}`, { signal }),
    ]);
    const byDoctor = new Map(board.rows.map((r) => [r.staffId, r]));
    const rows = doctors.map((doctor) => {
      const b = byDoctor.get(doctor.id);
      if (!b?.calendar) return scheduleRow(doctor, [], appointments.items, facility);
      const slots: Slot[] = b.slots.map((s) => ({ ...s, facilityId: facility.facilityId, status: s.status as Slot["status"] }));
      const sessions: Session[] = b.sessions.map((s) => ({ ...s, sessionOn: date, facilityId: facility.facilityId, source: s.source as Session["source"] }));
      const exceptions: ScheduleException[] = b.exceptions.map((e) => ({ ...e, onDate: date, revokedAt: null }));
      return scheduleRow(doctor, slots, appointments.items, facility, { day: date, sessions, exceptions, holidays: holidays.items, holds: b.holds });
    });
    return { day: date, as_of: board.asOf, rows };
  }

  return {
    scope: `${me.tenantId}:${facility.facilityId}:${me.staffId}`,
    permissions: { role: me.staffType, allowed, staff: [] },
    unavailableWrite: "This change is not available yet. Nothing was saved.",
    async read<T>(path: string, signal: AbortSignal): Promise<T> {
      if (path === "/api/v1/admin/doctors") return doctors as T;
      if (path === "/api/v1/admin/catalogue") return catalogue as T;
      const url = new URL(path, "https://frontend.invalid");
      if (url.pathname === "/api/v1/admin/schedule-timeline")
        return (await readBoard(url, signal)) as T;
      if (url.pathname === "/api/v1/admin/schedule-timeline/weekly")
        return (await readWeekly(url)) as T;
      if (url.pathname === "/api/v1/admin/schedule-timeline/check")
        return (await readCheck(url, signal)) as T;
      throw unavailable("Exact-time booking checks");
    },
    async write<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
      const b = (options.body ?? {}) as Body;
      const method = options.method ?? "GET";
      if (path === "/api/v1/admin/schedule-exceptions/preview" || path === "/api/v1/admin/schedule-exceptions") {
        const from = local(String(b.starts_at)),
          to = local(String(b.ends_at));
        if (from.date !== to.date) throw new HmsError("A block must start and end on the same day.", 400, "validation");
        const window = { onDate: from.date, start: from.time, end: to.time, facilityId: b.branch_id };
        const base = `/v1/practitioners/${b.doctor_id}/exceptions`;
        if (path.endsWith("/preview")) {
          const r = await request<{ affectedAppointmentIds: string[] }>(`${base}/preview`, { method: "POST", body: window });
          return { affected_appointments: await appointmentsById(r.affectedAppointmentIds) } as T;
        }
        const body = { ...window, kind: "block", reason: b.reason };
        return request<T>(base, { method: "POST", idempotencyKey: keyFor([base, body]), body });
      }
      const unblock = path.match(/^\/api\/v1\/admin\/schedule-exceptions\/([0-9a-f-]{36})$/);
      if (unblock && method === "DELETE")
        return request<T>(`/v1/schedule-exceptions/${unblock[1]}/revoke`, { method: "POST", body: { reason: b.reason } });
      if (path === "/api/v1/admin/schedule-timeline/open") {
        if (b.consultation_type !== "in_person") throw unavailable("Extra virtual hours");
        const body = {
          onDate: b.schedule_date,
          kind: "extra_hours",
          facilityId: b.branch_id,
          start: b.starts_at_local,
          end: b.ends_at_local,
          slotMinutes: b.slot_minutes,
        };
        return request<T>(`/v1/practitioners/${b.doctor_id}/exceptions`, { method: "POST", idempotencyKey: keyFor(["extra", b.doctor_id, body]), body });
      }
      if (path === "/api/v1/admin/schedule-timeline/weekly/preview" || path === "/api/v1/admin/schedule-timeline/weekly") {
        const preview = path.endsWith("/preview");
        const r = await request<WeeklyPlanResult>(`/v1/practitioners/${b.doctor_id}/weekly-plan${preview ? "/preview" : ""}`, {
          method: preview ? "POST" : "PUT",
          ...(preview ? {} : { idempotencyKey: keyFor(["weekly", b.doctor_id, weeklyBody(b)]) }),
          body: weeklyBody(b),
        });
        return {
          affected_appointments: await appointmentsById(r.affectedAppointmentIds),
          can_save: r.canSave,
          other_published_hours: r.otherPublishedHours.map((h) => ({
            branch: h.facilityName,
            consultation_type: h.visitMode,
            weekday: h.weekday - 1,
            start: h.start,
            end: h.end,
          })),
        } as T;
      }
      if (path === "/api/v1/admin/schedule-timeline/appointments" && method === "POST") {
        const bookingParty = { name: b.patient_name, phone: b.patient_phone };
        if (!b.overbook) {
          const { reservationId } = await holdFor(String(b.doctor_id), String(b.starts_at), String(b.ends_at), String(b.consultation_type), String(b.idempotency_key));
          return request<T>("/v1/appointments", {
            method: "POST",
            idempotencyKey: String(b.idempotency_key),
            body: { reservationId, bookingParty, originChannel: "front_desk", ...(b.reason ? { reason: b.reason } : {}) },
          });
        }
        return request<T>("/v1/appointments/overbook", {
          method: "POST",
          idempotencyKey: String(b.idempotency_key),
          body: {
            staffId: b.doctor_id,
            slotStart: b.starts_at,
            bookingParty,
            originChannel: "front_desk",
            ...(b.reason ? { reason: b.reason } : {}),
            overbookReason: b.overbook_reason,
          },
        });
      }
      const move = path.match(/^\/api\/v1\/admin\/schedule-timeline\/appointments\/([0-9a-f-]{36})\/move$/);
      if (move && method === "POST") {
        // A move is an audited replacement: the new appointment links back through rescheduledFromId.
        const a = await request<Appointment>(`/v1/appointments/${move[1]}`);
        const { reservationId } = await holdFor(a.practitionerStaffId, String(b.starts_at), String(b.ends_at), a.visitMode, String(b.idempotency_key));
        return request<T>(`/v1/appointments/${move[1]}/reschedule`, {
          method: "POST",
          idempotencyKey: String(b.idempotency_key),
          body: { newReservationId: reservationId, reason: b.reason },
        });
      }
      const cancel = path.match(/^\/api\/v1\/admin\/schedule-timeline\/appointments\/([0-9a-f-]{36})$/);
      if (cancel && method === "DELETE")
        return request<T>(`/v1/appointments/${cancel[1]}/cancel`, { method: "POST", body: { reason: b.reason } });
      throw unavailable("This change");
    },
  };
}
