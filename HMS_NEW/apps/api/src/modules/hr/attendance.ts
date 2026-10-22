// Attendance: staff clock in and out (or a manager records it, with a note); each person's day is derived
// from their roster (shift or week off), approved leave, the clinic's holidays and their punches. Without a
// roster a day is an 8-hour working day and Sunday is the week off. A regularised day keeps what was
// approved; a day in a locked payroll month never changes.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand, type CommandContext } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';

type DayStatus = 'present' | 'half_day' | 'absent' | 'paid_leave' | 'unpaid_leave' | 'holiday' | 'week_off';
const DAY = 86_400_000;

export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const localDay = (at: Date, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(at);
function localInstant(day: string, time: string, tz: string) {
  const noon = new Date(`${day}T12:00:00Z`);
  const offset = new Date(noon.toLocaleString('en-US', { timeZone: tz })).getTime() - noon.getTime();
  return new Date(Date.parse(`${day}T${time.slice(0, 5)}:00Z`) - offset);
}

async function profileOf(tx: Transaction<DB>, staffId: string) {
  const p = await tx.selectFrom('hr.employee_profile as p').innerJoin('platform.facility as f', 'f.id', 'p.facility_id')
    .select(['p.id', 'p.staff_id', 'p.facility_id', 'p.status', 'p.date_of_joining', 'p.date_of_exit', 'f.timezone']).where('p.staff_id', '=', staffId).executeTakeFirst();
  if (!p) throw preconditionFailed('this person has no employment profile yet', { reason: 'profile_required', staffId });
  return p;
}

export async function punch(
  db: Kysely<DB>, caller: Caller, input: { staffId: string; direction: 'in' | 'out'; at?: string | undefined; source: 'self' | 'manager'; note?: string | undefined }, idempotencyKey?: string,
) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.punch', idempotencyKey, request: input }, async (ctx) => {
    const p = await profileOf(ctx.tx, input.staffId);
    if (p.status === 'exited') throw preconditionFailed('this person has left', { reason: 'exited' });
    if (input.source === 'manager' && !input.note) throw invalid('say why the punch is recorded for them', { reason: 'note_required' });
    const at = input.source === 'self' ? now : new Date(input.at ?? now.toISOString());
    if (at.getTime() > now.getTime() + 60_000) throw invalid('a punch cannot be in the future', { reason: 'future_punch' });
    const day = localDay(at, p.timezone);
    // Serialize one person's punches; the same direction twice in a row is a mistake.
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`punch:${input.staffId}`}, 0))`.execute(ctx.tx);
    const last = await ctx.tx.selectFrom('hr.attendance_punch').select(['direction', 'punched_at']).where('staff_id', '=', input.staffId)
      .where('punched_at', '>=', localInstant(day, '00:00', p.timezone)).where('punched_at', '<=', at).orderBy('punched_at', 'desc').executeTakeFirst();
    if ((last?.direction ?? 'out') === input.direction) throw preconditionFailed(input.direction === 'in' ? 'already clocked in' : 'not clocked in', { reason: 'punch_sequence' });
    const r = await ctx.tx.insertInto('hr.attendance_punch').values({
      tenant_id: ctx.tenantId, staff_id: input.staffId, facility_id: p.facility_id, punched_at: at, direction: input.direction, source: input.source,
      recorded_by: ctx.actor.staffId!, note: input.note ?? null,
    }).returning('id').executeTakeFirstOrThrow();
    await computeDay(ctx, input.staffId, day);
    ctx.audit({ action: 'create', subjectType: 'hr.attendance_punch', subjectId: r.id, reason: input.note, diff: { staffId: input.staffId, direction: input.direction, source: input.source, at: at.toISOString() } });
    return { punchId: r.id, direction: input.direction, at: at.toISOString(), day };
  });
}

/** Derives one person's attendance for a date (in the caller's HR command). Locked and regularised days stay. */
export async function computeDay(ctx: CommandContext, staffId: string, day: string): Promise<DayStatus | null> {
  const tx = ctx.tx;
  const p = await profileOf(tx, staffId);
  if (day < String(p.date_of_joining) || (p.date_of_exit && day > String(p.date_of_exit))) return null;
  const existing = await tx.selectFrom('hr.attendance_day').select(['id', 'is_locked', 'source']).where('staff_id', '=', staffId).where('on_date', '=', day).forUpdate().executeTakeFirst();
  if (existing?.is_locked || existing?.source === 'regularised') return null;
  const roster = await tx.selectFrom('hr.roster_assignment as r').leftJoin('hr.shift_definition as s', 's.id', 'r.shift_definition_id')
    .select(['r.kind', 's.start_local', 's.end_local', 's.break_minutes', 's.grace_minutes']).where('r.staff_id', '=', staffId).where('r.on_date', '=', day).executeTakeFirst();
  const leave = await tx.selectFrom('hr.leave_request as l').innerJoin('hr.leave_type as t', 't.id', 'l.leave_type_id').select(['l.half_day', 't.is_paid'])
    .where('l.staff_id', '=', staffId).where('l.status', '=', 'approved').where('l.starts_on', '<=', day).where('l.ends_on', '>=', day).executeTakeFirst();
  const holiday = await tx.selectFrom('booking.facility_holiday').select('id').where('facility_id', '=', p.facility_id).where('holiday_on', '=', day).where('revoked_at', 'is', null).executeTakeFirst();
  const start = roster?.start_local ? localInstant(day, String(roster.start_local), p.timezone) : localInstant(day, '09:00', p.timezone);
  let end = roster?.end_local ? localInstant(day, String(roster.end_local), p.timezone) : localInstant(day, '17:00', p.timezone);
  if (end <= start) end = new Date(end.getTime() + DAY);                           // overnight shift
  const expected = Math.max(60, (end.getTime() - start.getTime()) / 60_000 - (roster?.break_minutes ?? 0));
  // Punches that belong to this working day: from 4 hours before its start to 8 hours after its end.
  const punches = await tx.selectFrom('hr.attendance_punch').select(['direction', 'punched_at']).where('staff_id', '=', staffId)
    .where('punched_at', '>=', new Date(start.getTime() - 4 * 3_600_000)).where('punched_at', '<', new Date(end.getTime() + 8 * 3_600_000)).orderBy('punched_at').execute();
  let worked = 0;
  let open: Date | null = null;
  for (const x of punches) {
    const at = new Date(x.punched_at);
    if (x.direction === 'in') open ??= at;
    else if (open) { worked += (at.getTime() - open.getTime()) / 60_000; open = null; }
  }
  const firstIn = punches.find((x) => x.direction === 'in')?.punched_at ?? null;
  const lastOut = [...punches].reverse().find((x) => x.direction === 'out')?.punched_at ?? null;
  const weekOff = roster ? roster.kind === 'week_off' : new Date(`${day}T12:00:00Z`).getUTCDay() === 0;
  let status: DayStatus;
  if (leave && leave.half_day === 'none') status = leave.is_paid ? 'paid_leave' : 'unpaid_leave';
  else if (!punches.length && holiday) status = 'holiday';
  else if (!punches.length && weekOff) status = 'week_off';
  else {
    // A half-day leave covers half the expected hours.
    const need = leave ? expected / 2 : expected;
    status = worked >= need * 0.75 ? 'present' : worked >= need * 0.4 ? (leave ? 'present' : 'half_day') : leave ? (leave.is_paid ? 'half_day' : 'absent') : 'absent';
  }
  const late = firstIn ? Math.max(0, Math.round((new Date(firstIn).getTime() - start.getTime()) / 60_000) - (roster?.grace_minutes ?? 10)) : 0;
  const values = { status, first_in: firstIn, last_out: lastOut, worked_minutes: Math.round(worked), late_minutes: late, source: 'computed' as const };
  if (existing) await tx.updateTable('hr.attendance_day').set({ ...values, updated_by: ctx.actor.staffId ?? null }).where('id', '=', existing.id).execute();
  else await tx.insertInto('hr.attendance_day').values({ tenant_id: ctx.tenantId, staff_id: staffId, facility_id: p.facility_id, on_date: day, ...values, created_by: ctx.actor.staffId ?? null }).execute();
  return status;
}

/** Recomputes a facility's attendance for a date range (up to today). */
export async function computeAttendance(db: Kysely<DB>, caller: Caller, input: { facilityId: string; from: string; to: string }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.compute_attendance', idempotencyKey, request: input }, async (ctx) => recomputeRange(ctx, input.facilityId, input.from, input.to, now));
}

export async function recomputeRange(ctx: CommandContext, facilityId: string, from: string, to: string, now: Date, staffIds?: string[]) {
  if (to < from) throw invalid('the range ends before it starts', { reason: 'bad_range' });
  if (Date.parse(to) - Date.parse(from) > 62 * DAY) throw invalid('compute at most two months at a time', { reason: 'range_too_long' });
  const f = await ctx.tx.selectFrom('platform.facility').select('timezone').where('id', '=', facilityId).executeTakeFirstOrThrow();
  const today = localDay(now, f.timezone);
  let q = ctx.tx.selectFrom('hr.employee_profile').select('staff_id').where('facility_id', '=', facilityId).where('date_of_joining', '<=', to)
    .where((eb) => eb.or([eb('date_of_exit', 'is', null), eb('date_of_exit', '>=', from)]));
  if (staffIds) q = q.where('staff_id', 'in', staffIds.length ? staffIds : ['00000000-0000-0000-0000-000000000000']);
  const people = await q.execute();
  let days = 0;
  for (const p of people) {
    for (let d = from; d <= to && d <= today; d = addDays(d, 1)) if (await computeDay(ctx, p.staff_id, d)) days++;
  }
  return { facilityId, from, to, people: people.length, daysComputed: days };
}

export async function requestRegularisation(db: Kysely<DB>, caller: Caller, input: { onDate: string; requestedStatus: 'present' | 'half_day'; reason: string }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.request_regularisation', idempotencyKey, request: input }, async (ctx) => {
    const staffId = ctx.actor.staffId!;
    await profileOf(ctx.tx, staffId);
    const day = await ctx.tx.selectFrom('hr.attendance_day').select('is_locked').where('staff_id', '=', staffId).where('on_date', '=', input.onDate).executeTakeFirst();
    if (day?.is_locked) throw preconditionFailed('that month’s payroll is locked', { reason: 'payroll_locked' });
    try {
      const r = await ctx.tx.insertInto('hr.attendance_regularisation').values({
        tenant_id: ctx.tenantId, staff_id: staffId, on_date: input.onDate, requested_status: input.requestedStatus, reason: input.reason, created_by: staffId,
      }).returning(['id', 'version']).executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'hr.attendance_regularisation', subjectId: r.id, reason: input.reason, diff: { onDate: input.onDate, requestedStatus: input.requestedStatus } });
      return { regularisationId: r.id, status: 'requested' as const, version: r.version };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('a request for that day is already waiting', { reason: 'regularisation_pending' });
      throw err;
    }
  });
}

export async function decideRegularisation(db: Kysely<DB>, caller: Caller, input: { regularisationId: string; decision: 'approved' | 'rejected'; note?: string | undefined; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.decide_regularisation', idempotencyKey, request: input }, async (ctx) => {
    const r = await ctx.tx.selectFrom('hr.attendance_regularisation').selectAll().where('id', '=', input.regularisationId).forUpdate().executeTakeFirst();
    if (!r) throw notFound('regularisation request', { regularisationId: input.regularisationId });
    if (r.version !== input.version) throw conflict('this request was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: r.version });
    if (r.status !== 'requested') throw preconditionFailed(`request is ${r.status}`, { reason: 'not_requested' });
    if (r.staff_id === ctx.actor.staffId) throw preconditionFailed('someone else decides your request', { reason: 'own_request' });
    if (input.decision === 'approved') {
      const p = await profileOf(ctx.tx, r.staff_id);
      const day = await ctx.tx.selectFrom('hr.attendance_day').select(['id', 'is_locked']).where('staff_id', '=', r.staff_id).where('on_date', '=', r.on_date).forUpdate().executeTakeFirst();
      if (day?.is_locked) throw preconditionFailed('that month’s payroll is locked', { reason: 'payroll_locked' });
      if (day) await ctx.tx.updateTable('hr.attendance_day').set({ status: r.requested_status, source: 'regularised', updated_by: ctx.actor.staffId ?? null }).where('id', '=', day.id).execute();
      else await ctx.tx.insertInto('hr.attendance_day').values({ tenant_id: ctx.tenantId, staff_id: r.staff_id, facility_id: p.facility_id, on_date: r.on_date, status: r.requested_status, source: 'regularised', created_by: ctx.actor.staffId ?? null }).execute();
    }
    const { version } = await ctx.tx.updateTable('hr.attendance_regularisation').set({ status: input.decision, decided_by: ctx.actor.staffId ?? null, decided_at: now, decision_note: input.note ?? null, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', r.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'hr.attendance_regularisation', subjectId: r.id, reason: input.note, diff: { status: ['requested', input.decision] } });
    return { regularisationId: r.id, status: input.decision, version };
  });
}

// ---- shifts and roster ---------------------------------------------------------------------------------

export async function createShift(
  db: Kysely<DB>, caller: Caller, input: { facilityId: string; code: string; name: string; start: string; end: string; breakMinutes: number; graceMinutes: number }, idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.create_shift', idempotencyKey, request: input }, async (ctx) => {
    try {
      const s = await ctx.tx.insertInto('hr.shift_definition').values({
        tenant_id: ctx.tenantId, facility_id: input.facilityId, code: input.code, name: input.name, start_local: input.start, end_local: input.end,
        break_minutes: input.breakMinutes, grace_minutes: input.graceMinutes, created_by: ctx.actor.staffId ?? null,
      }).returning(['id', 'version']).executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'hr.shift_definition', subjectId: s.id, diff: input });
      return { shiftId: s.id, version: s.version };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('another shift at this clinic uses that code', { reason: 'duplicate_code' });
      throw err;
    }
  });
}

/** Sets (or clears, with null) roster days; recomputes those days' attendance. Locked days are refused. */
export async function setRoster(
  db: Kysely<DB>, caller: Caller,
  input: { facilityId: string; entries: { staffId: string; onDate: string; shiftId: string | null; weekOff?: boolean | undefined }[] }, idempotencyKey?: string,
) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.set_roster', idempotencyKey, request: input }, async (ctx) => {
    for (const e of input.entries) {
      const locked = await ctx.tx.selectFrom('hr.attendance_day').select('is_locked').where('staff_id', '=', e.staffId).where('on_date', '=', e.onDate).executeTakeFirst();
      if (locked?.is_locked) throw preconditionFailed(`${e.onDate} is in a locked payroll month`, { reason: 'payroll_locked', onDate: e.onDate });
      await ctx.tx.deleteFrom('hr.roster_assignment').where('staff_id', '=', e.staffId).where('on_date', '=', e.onDate).execute();
      if (e.shiftId || e.weekOff) {
        await ctx.tx.insertInto('hr.roster_assignment').values({
          tenant_id: ctx.tenantId, staff_id: e.staffId, facility_id: input.facilityId, on_date: e.onDate, kind: e.weekOff ? 'week_off' : 'shift',
          shift_definition_id: e.weekOff ? null : e.shiftId, created_by: ctx.actor.staffId ?? null,
        }).execute();
      }
      const f = await ctx.tx.selectFrom('platform.facility').select('timezone').where('id', '=', input.facilityId).executeTakeFirstOrThrow();
      if (e.onDate <= localDay(now, f.timezone)) await computeDay(ctx, e.staffId, e.onDate);
    }
    ctx.audit({ action: 'update', subjectType: 'hr.roster_assignment', diff: { facilityId: input.facilityId, entries: input.entries.length } });
    return { entries: input.entries.length };
  });
}
