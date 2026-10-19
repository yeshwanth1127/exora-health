import { sql, type DB, type Kysely } from '@hms/db';
import { invalid, notFound, runQuery } from '@hms/platform';
import { REPORT_RANGES, type OperationsKpiId, type OperationsKpiReport } from '@hms/contracts';
import { clock, type Caller } from '../../caller.ts';

export type KpiBucket = { metric: OperationsKpiId; date: string; doctorId: string; doctorName: string; channel: string; count: number };
const definitions = [
  ['bookings', 'New bookings', 'Original bookings by creation date. Reschedule replacements are excluded.', false],
  ['visits', 'Visits due', 'Non-cancelled appointments by scheduled visit date, using their current status. This is not attendance.', false],
  ['checkIns', 'Check-ins', 'Recorded check-ins by check-in date, including visits completed later.', false],
  ['completed', 'Completed visits', 'Recorded completions by completion date, including rescheduled appointments.', false],
  ['cancelled', 'Cancellations', 'Cancelled appointments by cancellation date. Superseded appointments with a reschedule successor are excluded.', true],
  ['noShows', 'No-shows', 'Appointments currently marked no-show by scheduled visit date, not by the day they were marked.', true],
] as const;
const channels: Record<string, string> = { web: 'Website', portal: 'Patient portal', whatsapp: 'WhatsApp', voice: 'Voice', front_desk: 'Front desk', walk_in: 'Walk-in', referral: 'Referral' };
export function reportDay(day: string, offset: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Exact counts, not last-day snapshots or rounded share-derived estimates. No patient data. */
export function aggregateKpis(meta: Omit<OperationsKpiReport, 'metrics'>, buckets: KpiBucket[]): OperationsKpiReport {
  const days = Array.from({ length: 180 }, (_, i) => reportDay(meta.end, i - 179));
  const metrics = definitions.map(([id, label, description, lowerIsBetter]) => {
    const rows = buckets.filter((r) => r.metric === id);
    const daily = new Map<string, number>();
    for (const r of rows) daily.set(r.date, (daily.get(r.date) ?? 0) + r.count);
    const periods = Object.fromEntries(REPORT_RANGES.map((range) => {
      const n = Number(range), start = reportDay(meta.end, 1 - n), before = reportDay(start, -n);
      const comparable = before >= meta.availableFrom;
      const currentRows = rows.filter((r) => r.date >= start && r.date <= meta.end);
      const previousRows = rows.filter((r) => r.date >= before && r.date < start);
      const total = (items: KpiBucket[]) => items.reduce((sum, r) => sum + r.count, 0);
      const dimension = (kind: 'doctor' | 'channel') => {
        const grouped = new Map<string, { id: string; name: string; value: number; previous: number | null }>();
        for (const [items, key] of [[currentRows, 'value'], [previousRows, 'previous']] as const) for (const r of items) {
          const groupId = kind === 'doctor' ? r.doctorId : r.channel;
          const item = grouped.get(groupId) ?? { id: groupId, name: kind === 'doctor' ? r.doctorName : (channels[r.channel] ?? r.channel), value: 0, previous: comparable ? 0 : null };
          if (key === 'value') item.value += r.count;
          else if (comparable) item.previous = (item.previous ?? 0) + r.count;
          grouped.set(groupId, item);
        }
        return [...grouped.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      };
      return [range, { current: total(currentRows), previous: comparable ? total(previousRows) : null, complete: start >= meta.availableFrom, breakdowns: { doctor: dimension('doctor'), channel: dimension('channel') } }];
    })) as OperationsKpiReport['metrics'][number]['periods'];
    return { id, label, description, lowerIsBetter, series: days.map((day) => day < meta.availableFrom ? null : (daily.get(day) ?? 0)), periods };
  });
  return { ...meta, metrics };
}

export async function operationsKpis(db: Kysely<DB>, caller: Caller, facilityId: string, end: string): Promise<OperationsKpiReport> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const facility = await tx.selectFrom('platform.facility').select(['timezone', 'created_at']).where('id', '=', facilityId).executeTakeFirst();
    if (!facility) throw notFound('facility', { facilityId });
    const asOf = clock(caller).toISOString();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: facility.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(asOf));
    if (end > today) throw invalid('report end must not be after today at this clinic');
    const { rows: [coverage] } = await sql<{ date: string }>`
      SELECT (least(${facility.created_at}::timestamptz, coalesce(min(created_at), ${facility.created_at}::timestamptz)) AT TIME ZONE ${facility.timezone})::date::text AS date
      FROM booking.appointment WHERE facility_id = ${facilityId}`.execute(tx);
    const { rows } = await sql<KpiBucket>`
      WITH facts AS (
        SELECT a.practitioner_staff_id, a.origin_channel, event.metric, event.day
        FROM booking.appointment a
        CROSS JOIN LATERAL (VALUES
          ('bookings', CASE WHEN a.rescheduled_from_id IS NULL THEN (a.created_at AT TIME ZONE ${facility.timezone})::date END),
          ('visits', CASE WHEN a.status <> 'cancelled' THEN a.session_on END),
          ('checkIns', (a.checked_in_at AT TIME ZONE ${facility.timezone})::date),
          ('completed', (a.completed_at AT TIME ZONE ${facility.timezone})::date),
          ('cancelled', CASE WHEN a.status = 'cancelled' AND NOT EXISTS (SELECT 1 FROM booking.appointment successor WHERE successor.rescheduled_from_id = a.id) THEN (a.cancelled_at AT TIME ZONE ${facility.timezone})::date END),
          ('noShows', CASE WHEN a.status = 'no_show' THEN a.session_on END)
        ) event(metric, day)
        WHERE a.facility_id = ${facilityId} AND event.day BETWEEN ${end}::date - 179 AND ${end}::date
      )
      SELECT f.metric, f.day::text AS date, f.practitioner_staff_id AS "doctorId", s.display_name AS "doctorName", f.origin_channel AS channel, count(*)::int AS count
      FROM facts f JOIN platform.staff s ON s.id = f.practitioner_staff_id
      GROUP BY f.metric, f.day, f.practitioner_staff_id, s.display_name, f.origin_channel
      ORDER BY f.day, f.metric, f.practitioner_staff_id, f.origin_channel`.execute(tx);
    return aggregateKpis({ facilityId, end, timezone: facility.timezone, asOf, availableFrom: coverage!.date }, rows);
  });
}
