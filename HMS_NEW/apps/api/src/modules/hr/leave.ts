// Leave: clinic leave types, grants to a person's balance (an append-only ledger whose sum is the balance),
// requests, and their approval (consumes the balance, recomputes attendance, and closes a doctor's
// bookable calendar through booking) or cancellation (gives the days back, reopens the calendar).
// Requested days exclude the clinic's holidays; overlapping live requests are refused by the database.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, forbidden, invalid, notFound, pgCode, preconditionFailed, runCommand, runQuery, type CommandContext } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { recomputeRange } from './attendance.ts';

export async function createLeaveType(
  db: Kysely<DB>, caller: Caller, input: { code: string; name: string; isPaid: boolean; annualQuotaDays: number; carryForwardMax: number; allowNegative: boolean }, idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.create_leave_type', idempotencyKey, request: input }, async (ctx) => {
    try {
      const t = await ctx.tx.insertInto('hr.leave_type').values({
        tenant_id: ctx.tenantId, code: input.code, name: input.name, is_paid: input.isPaid, annual_quota_days: input.annualQuotaDays,
        carry_forward_max: input.carryForwardMax, allow_negative: input.allowNegative, created_by: ctx.actor.staffId ?? null,
      }).returning(['id', 'version']).executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'hr.leave_type', subjectId: t.id, diff: input });
      return { leaveTypeId: t.id, version: t.version };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('another leave type uses that code', { reason: 'duplicate_code' });
      throw err;
    }
  });
}

/** Adds (or, negative, takes away) days on a person's balance with a note: annual quota, carry-forward, corrections. */
export async function grantLeave(db: Kysely<DB>, caller: Caller, input: { staffId: string; leaveTypeId: string; days: number; effectiveOn: string; note: string }, idempotencyKey: string) {
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.grant_leave', idempotencyKey, request: input }, async (ctx) => {
    const p = await ctx.tx.selectFrom('hr.employee_profile').select('status').where('staff_id', '=', input.staffId).executeTakeFirst();
    if (!p) throw preconditionFailed('this person has no employment profile yet', { reason: 'profile_required' });
    const r = await ctx.tx.insertInto('hr.leave_ledger').values({
      tenant_id: ctx.tenantId, staff_id: input.staffId, leave_type_id: input.leaveTypeId, entry: input.days > 0 ? 'grant' : 'adjust', days: input.days,
      effective_on: input.effectiveOn, note: input.note, recorded_by: ctx.actor.staffId ?? null,
    }).returning('id').executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'hr.leave_ledger', subjectId: r.id, reason: input.note, diff: { staffId: input.staffId, leaveTypeId: input.leaveTypeId, days: input.days } });
    return { ledgerEntryId: r.id, balance: await balanceOf(ctx.tx, input.staffId, input.leaveTypeId) };
  });
}

async function balanceOf(tx: Transaction<DB>, staffId: string, leaveTypeId: string) {
  const { rows: [r] } = await sql<{ b: string }>`SELECT coalesce(sum(days), 0) AS b FROM hr.leave_ledger WHERE staff_id = ${staffId} AND leave_type_id = ${leaveTypeId}`.execute(tx);
  return Number(r!.b);
}

/** A person's balances: available (ledger) and pending (requested, not yet decided). */
export async function leaveBalances(db: Kysely<DB>, caller: Caller, staffId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<{ leave_type_id: string; code: string; name: string; is_paid: boolean; balance: string; pending: string }>`
      SELECT t.id AS leave_type_id, t.code, t.name, t.is_paid,
             coalesce((SELECT sum(l.days) FROM hr.leave_ledger l WHERE l.staff_id = ${staffId} AND l.leave_type_id = t.id), 0) AS balance,
             coalesce((SELECT sum(r.days) FROM hr.leave_request r WHERE r.staff_id = ${staffId} AND r.leave_type_id = t.id AND r.status = 'requested'), 0) AS pending
      FROM hr.leave_type t WHERE t.status = 'active' ORDER BY t.name`.execute(tx);
    return rows.map((r) => ({ leaveTypeId: r.leave_type_id, code: r.code, name: r.name, isPaid: r.is_paid, balance: Number(r.balance), pending: Number(r.pending), available: Number(r.balance) - Number(r.pending) }));
  });
}

/** Days a request takes: calendar days in the range less the clinic's holidays (½ for a half day). */
async function requestDays(tx: Transaction<DB>, facilityId: string, startsOn: string, endsOn: string, halfDay: string) {
  if (halfDay !== 'none') return 0.5;
  const { rows: [h] } = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM booking.facility_holiday WHERE facility_id = ${facilityId} AND revoked_at IS NULL AND holiday_on BETWEEN ${startsOn}::date AND ${endsOn}::date`.execute(tx);
  return (Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000 + 1 - h!.n;
}

export async function requestLeave(
  db: Kysely<DB>, caller: Caller,
  input: { leaveTypeId: string; startsOn: string; endsOn: string; halfDay?: 'none' | 'first_half' | 'second_half' | undefined; reason: string }, idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.request_leave', idempotencyKey, request: input }, async (ctx) => {
    const staffId = ctx.actor.staffId!;
    const p = await ctx.tx.selectFrom('hr.employee_profile').select(['facility_id', 'status']).where('staff_id', '=', staffId).executeTakeFirst();
    if (!p || p.status === 'exited') throw preconditionFailed('you have no active employment profile', { reason: 'profile_required' });
    const type = await ctx.tx.selectFrom('hr.leave_type').selectAll().where('id', '=', input.leaveTypeId).executeTakeFirst();
    if (!type || type.status !== 'active') throw notFound('leave type', { leaveTypeId: input.leaveTypeId });
    const halfDay = input.halfDay ?? 'none';
    if (halfDay !== 'none' && input.startsOn !== input.endsOn) throw invalid('a half day is a single date', { reason: 'half_day_range' });
    const days = await requestDays(ctx.tx, p.facility_id, input.startsOn, input.endsOn, halfDay);
    if (days <= 0) throw invalid('those dates are all clinic holidays', { reason: 'no_working_days' });
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`leave:${staffId}`}, 0))`.execute(ctx.tx);
    if (type.is_paid && !type.allow_negative) {
      const balance = await balanceOf(ctx.tx, staffId, type.id);
      const { rows: [pend] } = await sql<{ d: string }>`SELECT coalesce(sum(days), 0) AS d FROM hr.leave_request WHERE staff_id = ${staffId} AND leave_type_id = ${type.id} AND status = 'requested'`.execute(ctx.tx);
      if (balance - Number(pend!.d) < days) throw preconditionFailed(`only ${balance - Number(pend!.d)} day(s) of ${type.name} available`, { reason: 'insufficient_balance', available: balance - Number(pend!.d) });
    }
    try {
      const r = await ctx.tx.insertInto('hr.leave_request').values({
        tenant_id: ctx.tenantId, staff_id: staffId, leave_type_id: type.id, starts_on: input.startsOn, ends_on: input.endsOn, half_day: halfDay, days, reason: input.reason, created_by: staffId,
      }).returning(['id', 'version']).executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'hr.leave_request', subjectId: r.id, reason: input.reason, diff: { leaveType: type.code, startsOn: input.startsOn, endsOn: input.endsOn, days } });
      ctx.emit({ eventType: 'leave.requested', aggregateType: 'hr.leave_request', aggregateId: r.id, payload: { leaveRequestId: r.id, staffId } });
      return { leaveRequestId: r.id, days, status: 'requested' as const, version: r.version };
    } catch (err) {
      if (pgCode(err) === '23P01') throw conflict('you already have leave on some of these dates', { reason: 'leave_overlap' });
      throw err;
    }
  });
}

async function lockRequest(tx: Transaction<DB>, id: string, version: number) {
  const r = await tx.selectFrom('hr.leave_request as r').innerJoin('hr.leave_type as t', 't.id', 'r.leave_type_id').innerJoin('hr.employee_profile as p', 'p.staff_id', 'r.staff_id')
    .select(['r.id', 'r.staff_id', 'r.leave_type_id', 'r.starts_on', 'r.ends_on', 'r.half_day', 'r.days', 'r.status', 'r.version', 't.is_paid', 't.allow_negative', 't.name', 'p.facility_id'])
    .where('r.id', '=', id).forUpdate('r').executeTakeFirst();
  if (!r) throw notFound('leave request', { leaveRequestId: id });
  if (r.version !== version) throw conflict('this request was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: r.version });
  return r;
}

async function lockedPayroll(tx: Transaction<DB>, staffId: string, from: string, to: string) {
  return !!(await tx.selectFrom('hr.attendance_day').select('id').where('staff_id', '=', staffId).where('on_date', '>=', from).where('on_date', '<=', to).where('is_locked', '=', true).executeTakeFirst());
}

export async function decideLeave(db: Kysely<DB>, caller: Caller, input: { leaveRequestId: string; decision: 'approved' | 'rejected'; note?: string | undefined; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.decide_leave', idempotencyKey, request: input }, async (ctx) => {
    const r = await lockRequest(ctx.tx, input.leaveRequestId, input.version);
    if (r.status !== 'requested') throw preconditionFailed(`request is ${r.status}`, { reason: 'not_requested' });
    if (r.staff_id === ctx.actor.staffId) throw forbidden('someone else approves your leave', { reason: 'own_request' });
    const from = String(r.starts_on), to = String(r.ends_on);
    if (input.decision === 'approved') {
      if (await lockedPayroll(ctx.tx, r.staff_id, from, to)) throw preconditionFailed('those dates are in a locked payroll month', { reason: 'payroll_locked' });
      if (r.is_paid) {
        if (!r.allow_negative && (await balanceOf(ctx.tx, r.staff_id, r.leave_type_id)) < Number(r.days)) throw preconditionFailed(`not enough ${r.name} left`, { reason: 'insufficient_balance' });
        await ctx.tx.insertInto('hr.leave_ledger').values({
          tenant_id: ctx.tenantId, staff_id: r.staff_id, leave_type_id: r.leave_type_id, entry: 'consume', days: -Number(r.days), effective_on: from, leave_request_id: r.id, recorded_by: ctx.actor.staffId ?? null,
        }).execute();
      }
    }
    const { version } = await ctx.tx.updateTable('hr.leave_request').set({ status: input.decision, decided_by: ctx.actor.staffId ?? null, decided_at: now, decision_note: input.note ?? null, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', r.id).returning('version').executeTakeFirstOrThrow();
    let affectedAppointments = 0;
    if (input.decision === 'approved') {
      await recomputeRange(ctx, r.facility_id, from, to, now, [r.staff_id]);
      affectedAppointments = await bookedAppointments(ctx, r.staff_id, from, to);
      ctx.emit({ eventType: 'leave.approved', aggregateType: 'hr.leave_request', aggregateId: r.id, aggregateVersion: version, payload: { leaveRequestId: r.id, staffId: r.staff_id, startsOn: from, endsOn: to, halfDay: r.half_day } });
    }
    ctx.audit({ action: 'status_change', subjectType: 'hr.leave_request', subjectId: r.id, reason: input.note, diff: { status: ['requested', input.decision], affectedAppointments } });
    return { leaveRequestId: r.id, status: input.decision, version, affectedAppointments };
  });
}

/** Appointments a doctor already has booked in a date range (shown to the approver; they are not moved). */
async function bookedAppointments(ctx: CommandContext, staffId: string, from: string, to: string) {
  const { rows: [r] } = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM booking.appointment WHERE practitioner_staff_id = ${staffId} AND status = 'confirmed'
      AND session_on BETWEEN ${from}::date AND ${to}::date`.execute(ctx.tx);
  return r!.n;
}

/** The requester (before it starts) or an approver cancels leave; approved days go back on the balance. */
export async function cancelLeave(db: Kysely<DB>, caller: Caller, input: { leaveRequestId: string; canApprove: boolean; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.cancel_leave', idempotencyKey, request: input }, async (ctx) => {
    const r = await lockRequest(ctx.tx, input.leaveRequestId, input.version);
    if (r.status !== 'requested' && r.status !== 'approved') throw preconditionFailed(`request is ${r.status}`, { reason: 'not_cancellable' });
    const own = r.staff_id === ctx.actor.staffId;
    if (!own && !input.canApprove) throw forbidden('only the requester or an approver cancels leave', { reason: 'not_yours' });
    const from = String(r.starts_on), to = String(r.ends_on);
    const f = await ctx.tx.selectFrom('platform.facility').select('timezone').where('id', '=', r.facility_id).executeTakeFirstOrThrow();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: f.timezone }).format(now);
    if (own && !input.canApprove && r.status === 'approved' && from <= today) throw preconditionFailed('leave that has started is cancelled by an approver', { reason: 'leave_started' });
    if (await lockedPayroll(ctx.tx, r.staff_id, from, to)) throw preconditionFailed('those dates are in a locked payroll month', { reason: 'payroll_locked' });
    if (r.status === 'approved' && r.is_paid) {
      await ctx.tx.insertInto('hr.leave_ledger').values({
        tenant_id: ctx.tenantId, staff_id: r.staff_id, leave_type_id: r.leave_type_id, entry: 'reverse', days: Number(r.days), effective_on: from, leave_request_id: r.id, recorded_by: ctx.actor.staffId ?? null,
      }).execute();
    }
    const { version } = await ctx.tx.updateTable('hr.leave_request').set({ status: 'cancelled', cancelled_at: now, updated_by: ctx.actor.staffId ?? null }).where('id', '=', r.id).returning('version').executeTakeFirstOrThrow();
    if (r.status === 'approved') {
      if (from <= today) await recomputeRange(ctx, r.facility_id, from, to < today ? to : today, now, [r.staff_id]);
      ctx.emit({ eventType: 'leave.cancelled', aggregateType: 'hr.leave_request', aggregateId: r.id, aggregateVersion: version, payload: { leaveRequestId: r.id, staffId: r.staff_id } });
    }
    ctx.audit({ action: 'status_change', subjectType: 'hr.leave_request', subjectId: r.id, diff: { status: [r.status, 'cancelled'] } });
    return { leaveRequestId: r.id, status: 'cancelled' as const, version };
  });
}

export async function listLeaveRequests(db: Kysely<DB>, caller: Caller, q: { facilityId?: string | undefined; staffId?: string | undefined; status?: string | undefined; limit: number }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<Record<string, unknown>>`
      SELECT r.id AS "leaveRequestId", r.staff_id AS "staffId", s.display_name AS "staffName", t.code AS "leaveType", t.name AS "leaveTypeName", r.starts_on::text AS "startsOn",
             r.ends_on::text AS "endsOn", r.half_day AS "halfDay", r.days::float AS days, r.reason, r.status, r.decided_at AS "decidedAt", r.version
      FROM hr.leave_request r JOIN hr.leave_type t ON t.id = r.leave_type_id JOIN platform.staff s ON s.id = r.staff_id JOIN hr.employee_profile p ON p.staff_id = r.staff_id
      WHERE (${q.facilityId ?? null}::uuid IS NULL OR p.facility_id = ${q.facilityId ?? null}::uuid) AND (${q.staffId ?? null}::uuid IS NULL OR r.staff_id = ${q.staffId ?? null}::uuid)
        AND (${q.status ?? null}::text IS NULL OR r.status = ${q.status ?? null})
      ORDER BY r.starts_on DESC LIMIT ${q.limit}`.execute(tx);
    return rows;
  });
}

