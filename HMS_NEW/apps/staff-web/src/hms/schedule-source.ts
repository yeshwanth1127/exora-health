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
type Group = { days: number[]; windows: { start: string; end: string }[] };

const unavailable = (what: string) =>
  new HmsError(`${what} is not available yet.`, 501, "backend_pending");
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const key = () => crypto.randomUUID();

export function scheduleSource(
  me: Me,
  facility: Facility,
  practitioners: Practitioner[],
  day: string,
): OriginalResourceSource {
  const catalogue = scheduleCatalogue(facility, practitioners),
    doctors = scheduleDoctors(facility, practitioners);
  const local = (iso: string) => localParts(iso, facility.timezone);
  const manage = can(me, "schedules.manage", facility.facilityId);
  const allowed = {
    "schedules.manage": manage,
    "schedule.block": manage,
    // Exact-time booking and moves need the staff range-booking contract (G08); book from Booking.
    "appointments.create": false,
    "appointments.overbook": false,
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

  async function readBoard(url: URL, signal: AbortSignal) {
    const date = url.searchParams.get("day") ?? day;
    const branch = url.searchParams.get("branch_id");
    if (branch && branch !== facility.facilityId)
      throw new HmsError("Switch clinic to inspect another facility.", 403, "facility_scope");
    const range = { from: date, to: date };
    const [appointments, holidays] = await Promise.all([
      request<{ items: Appointment[] }>(
        `/v1/appointments?${query({ facilityId: facility.facilityId, ...range, limit: 500 })}`,
        { signal },
      ),
      request<{ items: FacilityHoliday[] }>(
        `/v1/facilities/${facility.facilityId}/holidays?${query(range)}`,
        { signal },
      ),
    ]);
    const rows = await Promise.all(
      doctors.map(async (doctor) => {
        if (!practitioners.find((p) => p.staffId === doctor.id)?.calendarId)
          return scheduleRow(doctor, [], appointments.items, facility);
        const base = `/v1/practitioners/${doctor.id}`;
        const [slots, sessions, exceptions] = await Promise.all([
          request<{ items: Slot[] }>(
            `${base}/slots?${query({ facilityId: facility.facilityId, ...range, includeUnavailable: true })}`,
            { signal },
          ),
          request<{ items: Session[] }>(`${base}/sessions?${query(range)}`, { signal }),
          request<{ items: ScheduleException[] }>(`${base}/exceptions?${query(range)}`, { signal }),
        ]);
        return scheduleRow(doctor, slots.items, appointments.items, facility, {
          day: date,
          sessions: sessions.items,
          exceptions: exceptions.items,
          holidays: holidays.items,
        });
      }),
    );
    return { day: date, as_of: new Date().toISOString(), rows };
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
        return request<T>(base, { method: "POST", idempotencyKey: key(), body: { ...window, kind: "block", reason: b.reason } });
      }
      const unblock = path.match(/^\/api\/v1\/admin\/schedule-exceptions\/([0-9a-f-]{36})$/);
      if (unblock && method === "DELETE")
        return request<T>(`/v1/schedule-exceptions/${unblock[1]}/revoke`, { method: "POST", body: { reason: b.reason } });
      if (path === "/api/v1/admin/schedule-timeline/open") {
        if (b.consultation_type !== "in_person") throw unavailable("Extra virtual hours");
        return request<T>(`/v1/practitioners/${b.doctor_id}/exceptions`, {
          method: "POST",
          idempotencyKey: key(),
          body: {
            onDate: b.schedule_date,
            kind: "extra_hours",
            facilityId: b.branch_id,
            start: b.starts_at_local,
            end: b.ends_at_local,
            slotMinutes: b.slot_minutes,
          },
        });
      }
      if (path === "/api/v1/admin/schedule-timeline/weekly/preview" || path === "/api/v1/admin/schedule-timeline/weekly") {
        const preview = path.endsWith("/preview");
        const r = await request<WeeklyPlanResult>(`/v1/practitioners/${b.doctor_id}/weekly-plan${preview ? "/preview" : ""}`, {
          method: preview ? "POST" : "PUT",
          ...(preview ? {} : { idempotencyKey: key() }),
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
      const cancel = path.match(/^\/api\/v1\/admin\/schedule-timeline\/appointments\/([0-9a-f-]{36})$/);
      if (cancel && method === "DELETE")
        return request<T>(`/v1/appointments/${cancel[1]}/cancel`, { method: "POST", body: { reason: b.reason } });
      throw unavailable("This change");
    },
  };
}
