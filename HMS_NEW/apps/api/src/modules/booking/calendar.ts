// Doctor calendars: the practitioner's bookable calendar, weekly sessions, leave/blocks/extra hours,
// facility holidays and one-day plans.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** The calendar (schedulable resource) of a practitioner, or not_found. */
export async function practitionerResourceId(tx: Transaction<DB>, staffId: string): Promise<string> {
  const row = await tx
    .selectFrom('booking.schedulable_resource')
    .select('id')
    .where('staff_id', '=', staffId)
    .where('is_active', '=', true)
    .executeTakeFirst();
  if (!row) throw notFound('practitioner calendar', { staffId });
  return row.id;
}

// Facility reach of calendar changes, resolved before authorizing (G01). The practitioner's calendar
// spans every facility they work at, so a change is authorized against each facility it can affect.

/** Facilities the practitioner is affiliated with on a date (all affiliations when no date). */
export async function practitionerFacilities(db: Kysely<DB>, caller: Caller, staffId: string, onDate?: string): Promise<string[]> {
  return runQuery(db, caller.tenantId, async (tx) => {
    let q = tx.selectFrom('catalog.practitioner_affiliation').select('facility_id').distinct().where('staff_id', '=', staffId);
    if (onDate) q = q.where('valid_from', '<=', onDate).where((eb) => eb.or([eb('valid_to', 'is', null), eb('valid_to', '>', onDate)]));
    return (await q.execute()).map((r) => r.facility_id);
  });
}

export async function scheduleRuleFacility(db: Kysely<DB>, caller: Caller, scheduleRuleId: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('booking.schedule_rule').select('facility_id').where('id', '=', scheduleRuleId).executeTakeFirst())?.facility_id);
}

/** Facilities whose sessions a new day plan can change: that weekday's weekly rules and the current plan's blocks. */
export async function dayPlanFacilities(db: Kysely<DB>, caller: Caller, staffId: string, planOn: string): Promise<string[]> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<{ facility_id: string }>`
      SELECT r.facility_id FROM booking.schedule_rule r
      JOIN booking.schedulable_resource sr ON sr.id = r.resource_id AND sr.staff_id = ${staffId}
      WHERE r.weekday = extract(isodow FROM ${planOn}::date) AND r.withdrawn_at IS NULL
        AND r.effective_from <= ${planOn}::date AND (r.effective_to IS NULL OR r.effective_to > ${planOn}::date)
      UNION
      SELECT b.facility_id FROM booking.day_plan_block b
      JOIN (SELECT dp.id FROM booking.day_plan dp
            JOIN booking.schedulable_resource sr ON sr.id = dp.resource_id AND sr.staff_id = ${staffId}
            WHERE dp.plan_on = ${planOn}::date ORDER BY dp.revision DESC LIMIT 1) latest ON latest.id = b.day_plan_id`.execute(tx);
    return rows.map((r) => r.facility_id);
  });
}

export interface ClosureWindow {
  onDate: string;
  start?: string; // omit both for the whole day
  end?: string;
  facilityId?: string; // omit for every facility
}

/** Booked appointments (confirmed/checked-in) a closure or block would clash with, in each appointment's facility time. */
async function affectedAppointments(tx: Transaction<DB>, resourceId: string, w: ClosureWindow): Promise<string[]> {
  const { rows } = await sql<{ id: string }>`
    SELECT a.id FROM booking.appointment a
    JOIN platform.facility f ON f.id = a.facility_id
    WHERE a.resource_id = ${resourceId} AND a.status IN ('confirmed', 'checked_in') AND a.booking_kind = 'slot'
      AND (${w.facilityId ?? null}::uuid IS NULL OR a.facility_id = ${w.facilityId ?? null}::uuid)
      AND tstzrange(a.starts_at, a.ends_at) && tstzrange(
            (${w.onDate}::date + coalesce(${w.start ?? null}::time, '00:00')) AT TIME ZONE f.timezone,
            CASE WHEN ${w.end ?? null}::time IS NULL THEN (${w.onDate}::date + 1)::timestamp AT TIME ZONE f.timezone
                 ELSE (${w.onDate}::date + ${w.end ?? null}::time) AT TIME ZONE f.timezone END)
    ORDER BY a.starts_at`.execute(tx);
  return rows.map((r) => r.id);
}

/** Preview (G05): the appointments a closure or block would affect. Nothing is saved. */
export async function previewClosure(db: Kysely<DB>, caller: Caller, input: ClosureWindow & { staffId: string }) {
  return runQuery(db, caller.tenantId, async (tx) => ({ affectedAppointmentIds: await affectedAppointments(tx, await practitionerResourceId(tx, input.staffId), input) }));
}

export async function createPractitionerCalendar(db: Kysely<DB>, caller: Caller, input: { staffId: string }) {
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.create_practitioner_calendar', request: input }, async (ctx) => {
    const staff = await ctx.tx
      .selectFrom('platform.staff')
      .select(['id', 'display_name', 'status'])
      .where('id', '=', input.staffId)
      .executeTakeFirst();
    if (!staff) throw notFound('staff member', input);
    if (staff.status !== 'active') throw preconditionFailed('staff member is not active');
    const existing = await ctx.tx.selectFrom('booking.schedulable_resource').select('id').where('staff_id', '=', staff.id).executeTakeFirst();
    if (existing) return { resourceId: existing.id, created: false };
    const { id } = await ctx.tx
      .insertInto('booking.schedulable_resource')
      .values({ tenant_id: ctx.tenantId, kind: 'practitioner', staff_id: staff.id, name: staff.display_name })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'booking.schedulable_resource', subjectId: id });
    return { resourceId: id, created: true };
  });
}

export interface WeeklySessionInput {
  staffId: string;
  facilityId: string;
  weekday: number; // ISO 1 = Monday … 7 = Sunday
  start: string; // 'HH:MM' local to the facility
  end: string;
  slotMinutes?: number | null; // null/undefined = walk-in token session only
  maxWalkInTokens?: number;
  healthcareServiceId?: string | null;
  consultLocationId?: string | null;
  visitMode?: 'in_person' | 'virtual';
  effectiveFrom: string; // 'YYYY-MM-DD'
  effectiveTo?: string | null; // exclusive
}

export async function addWeeklySession(db: Kysely<DB>, caller: Caller, input: WeeklySessionInput, idempotencyKey?: string) {
  if (!Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 7) throw invalid('weekday must be 1 (Mon) … 7 (Sun)');
  if (!TIME.test(input.start) || !TIME.test(input.end) || input.end <= input.start) throw invalid('start/end must be HH:MM with end after start');
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.add_weekly_session', request: input, idempotencyKey }, async (ctx) => {
    const resourceId = await practitionerResourceId(ctx.tx, input.staffId);
    // A doctor can only hold sessions where they are affiliated.
    const affiliated = await ctx.tx
      .selectFrom('catalog.practitioner_affiliation')
      .select('id')
      .where('staff_id', '=', input.staffId)
      .where('facility_id', '=', input.facilityId)
      .where('valid_from', '<=', input.effectiveFrom)
      .where((eb) => eb.or([eb('valid_to', 'is', null), eb('valid_to', '>', input.effectiveFrom)]))
      .executeTakeFirst();
    if (!affiliated) throw preconditionFailed('practitioner is not affiliated with this facility on that date');
    try {
      const { id } = await ctx.tx
        .insertInto('booking.schedule_rule')
        .values({
          tenant_id: ctx.tenantId,
          resource_id: resourceId,
          facility_id: input.facilityId,
          consult_location_id: input.consultLocationId ?? null,
          healthcare_service_id: input.healthcareServiceId ?? null,
          weekday: input.weekday,
          start_local: input.start,
          end_local: input.end,
          slot_minutes: input.slotMinutes ?? null,
          max_walk_in_tokens: input.maxWalkInTokens ?? 0,
          visit_mode: input.visitMode ?? 'in_person',
          effective_from: input.effectiveFrom,
          effective_to: input.effectiveTo ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'booking.schedule_rule', subjectId: id });
      return { scheduleRuleId: id };
    } catch (err) {
      if (pgCode(err) === '23P01') throw conflict('the practitioner already has a session at that time (at this or another facility)');
      throw err;
    }
  });
}

export async function endWeeklySession(db: Kysely<DB>, caller: Caller, input: { scheduleRuleId: string; effectiveTo: string }) {
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.end_weekly_session', request: input }, async (ctx) => {
    const row = await ctx.tx
      .updateTable('booking.schedule_rule')
      .set({ effective_to: input.effectiveTo })
      .where('id', '=', input.scheduleRuleId)
      .where('withdrawn_at', 'is', null)
      .where('effective_from', '<', input.effectiveTo)
      .returning('id')
      .executeTakeFirst();
    if (!row) throw notFound('schedule rule (or effectiveTo is not after effectiveFrom)', input);
    ctx.audit({ action: 'update', subjectType: 'booking.schedule_rule', subjectId: row.id, diff: { effective_to: input.effectiveTo } });
    return { scheduleRuleId: row.id };
  });
}

export interface ScheduleExceptionInput {
  staffId: string;
  onDate: string;
  kind: 'closed' | 'block' | 'extra_hours';
  start?: string; // omit both for a whole-day closure
  end?: string;
  facilityId?: string; // required for extra_hours; for closed/block, one clinic only (omit = every clinic)
  slotMinutes?: number; // required for extra_hours
  healthcareServiceId?: string;
  reason?: string;
}

/** Leave, a blocked window, or extra hours. Returns booked appointments that now clash, for rescheduling. */
export async function addScheduleException(db: Kysely<DB>, caller: Caller, input: ScheduleExceptionInput, idempotencyKey?: string) {
  if ((input.start === undefined) !== (input.end === undefined)) throw invalid('give both start and end, or neither');
  if (input.start && (!TIME.test(input.start) || !TIME.test(input.end!) || input.end! <= input.start)) throw invalid('start/end must be HH:MM with end after start');
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.add_schedule_exception', request: input, idempotencyKey }, async (ctx) => {
    const resourceId = await practitionerResourceId(ctx.tx, input.staffId);
    if (input.facilityId) {
      const affiliated = await ctx.tx
        .selectFrom('catalog.practitioner_affiliation')
        .select('id')
        .where('staff_id', '=', input.staffId)
        .where('facility_id', '=', input.facilityId)
        .where('valid_from', '<=', input.onDate)
        .where((eb) => eb.or([eb('valid_to', 'is', null), eb('valid_to', '>', input.onDate)]))
        .executeTakeFirst();
      if (!affiliated) throw preconditionFailed('practitioner is not affiliated with this facility on that date');
    }
    const { id } = await ctx.tx
      .insertInto('booking.schedule_exception')
      .values({
        tenant_id: ctx.tenantId,
        resource_id: resourceId,
        on_date: input.onDate,
        kind: input.kind,
        start_local: input.start ?? null,
        end_local: input.end ?? null,
        facility_id: input.facilityId ?? null,
        slot_minutes: input.slotMinutes ?? null,
        healthcare_service_id: input.healthcareServiceId ?? null,
        reason: input.reason ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'booking.schedule_exception', subjectId: id, reason: input.reason });

    const affectedAppointmentIds = input.kind === 'extra_hours' ? [] : await affectedAppointments(ctx.tx, resourceId, input);
    return { scheduleExceptionId: id, affectedAppointmentIds };
  });
}

export async function addFacilityHoliday(db: Kysely<DB>, caller: Caller, input: { facilityId: string; date: string; name: string }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.add_facility_holiday', request: input, idempotencyKey }, async (ctx) => {
    try {
      const { id } = await ctx.tx
        .insertInto('booking.facility_holiday')
        .values({ tenant_id: ctx.tenantId, facility_id: input.facilityId, holiday_on: input.date, name: input.name })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'booking.facility_holiday', subjectId: id });
      const affected = await ctx.tx
        .selectFrom('booking.appointment')
        .select('id')
        .where('facility_id', '=', input.facilityId)
        .where('session_on', '=', input.date)
        .where('status', 'in', ['confirmed', 'checked_in'])
        .execute();
      return { facilityHolidayId: id, affectedAppointmentIds: affected.map((a) => a.id) };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('that date is already a holiday at this facility');
      throw err;
    }
  });
}

export interface DayPlanInput {
  staffId: string;
  planOn: string;
  /** The revision the editor started from (0 = none yet); a stale value is rejected with 409. */
  baseRevision?: number;
  replacesWeekly: boolean;
  note?: string;
  blocks: Array<{
    facilityId: string;
    start: string;
    end: string;
    slotMinutes?: number | null;
    maxWalkInTokens?: number;
    healthcareServiceId?: string | null;
    consultLocationId?: string | null;
    visitMode?: 'in_person' | 'virtual';
  }>;
}

/** Saves a new revision of the plan for one day (the latest revision wins). */
export async function saveDayPlan(db: Kysely<DB>, caller: Caller, input: DayPlanInput, idempotencyKey?: string) {
  for (const b of input.blocks) {
    if (!TIME.test(b.start) || !TIME.test(b.end) || b.end <= b.start) throw invalid('block start/end must be HH:MM with end after start');
  }
  const sorted = [...input.blocks].sort((x, y) => (x.start < y.start ? -1 : 1));
  for (let i = 1; i < sorted.length; i++) if (sorted[i]!.start < sorted[i - 1]!.end) throw invalid('day plan blocks overlap');
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.save_day_plan', request: input, idempotencyKey }, async (ctx) => {
    const resourceId = await practitionerResourceId(ctx.tx, input.staffId);
    // Lock the calendar so two editors can't both save "revision N+1".
    await ctx.tx.selectFrom('booking.schedulable_resource').select('id').where('id', '=', resourceId).forUpdate().execute();
    const { max } = await ctx.tx
      .selectFrom('booking.day_plan')
      .select((eb) => eb.fn.max<number | null>('revision').as('max'))
      .where('resource_id', '=', resourceId)
      .where('plan_on', '=', input.planOn)
      .executeTakeFirstOrThrow();
    if (input.baseRevision !== undefined && input.baseRevision !== (max ?? 0)) {
      throw conflict('the day plan changed since you opened it; reload and review', { reason: 'stale_revision', currentRevision: max ?? 0 });
    }
    const { id } = await ctx.tx
      .insertInto('booking.day_plan')
      .values({
        tenant_id: ctx.tenantId,
        resource_id: resourceId,
        plan_on: input.planOn,
        revision: (max ?? 0) + 1,
        replaces_weekly: input.replacesWeekly,
        saved_by: ctx.actor.staffId ?? null,
        note: input.note ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    if (input.blocks.length) {
      await ctx.tx
        .insertInto('booking.day_plan_block')
        .values(
          input.blocks.map((b) => ({
            tenant_id: ctx.tenantId,
            day_plan_id: id,
            facility_id: b.facilityId,
            consult_location_id: b.consultLocationId ?? null,
            healthcare_service_id: b.healthcareServiceId ?? null,
            start_local: b.start,
            end_local: b.end,
            slot_minutes: b.slotMinutes ?? null,
            max_walk_in_tokens: b.maxWalkInTokens ?? 0,
            visit_mode: b.visitMode ?? 'in_person',
          })),
        )
        .execute();
    }
    ctx.audit({ action: 'create', subjectType: 'booking.day_plan', subjectId: id });
    return { dayPlanId: id, revision: (max ?? 0) + 1 };
  });
}

// ---- reads and reversals (G06, G07) -------------------------------------------------------------

/** A practitioner's exceptions in a date range, revoked ones included (with who/why). */
export async function listScheduleExceptions(db: Kysely<DB>, caller: Caller, input: { staffId: string; from: string; to: string }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const resourceId = await practitionerResourceId(tx, input.staffId);
    return tx
      .selectFrom('booking.schedule_exception')
      .select([
        'id as scheduleExceptionId', 'on_date as onDate', 'kind', 'start_local as start', 'end_local as end', 'facility_id as facilityId',
        'slot_minutes as slotMinutes', 'healthcare_service_id as healthcareServiceId', 'reason', 'created_at as createdAt',
        'revoked_at as revokedAt', 'revoke_reason as revokeReason',
      ])
      .where('resource_id', '=', resourceId)
      .where('on_date', '>=', input.from)
      .where('on_date', '<=', input.to)
      .orderBy('on_date')
      .orderBy('start_local')
      .execute();
  });
}

/** Facility and date an exception reaches, for authorization; undefined when not found. */
export async function scheduleExceptionScope(db: Kysely<DB>, caller: Caller, scheduleExceptionId: string) {
  return runQuery(db, caller.tenantId, async (tx) =>
    tx
      .selectFrom('booking.schedule_exception as e')
      .innerJoin('booking.schedulable_resource as r', 'r.id', 'e.resource_id')
      .select(['e.facility_id as facilityId', 'e.on_date as onDate', 'r.staff_id as staffId'])
      .where('e.id', '=', scheduleExceptionId)
      .executeTakeFirst(),
  );
}

export async function revokeScheduleException(db: Kysely<DB>, caller: Caller, input: { scheduleExceptionId: string; reason: string }) {
  if (input.reason.trim().length < 3) throw invalid('a reason is required');
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.revoke_schedule_exception', request: input }, async (ctx) => {
    const row = await ctx.tx.selectFrom('booking.schedule_exception').select(['id', 'revoked_at']).where('id', '=', input.scheduleExceptionId).forUpdate().executeTakeFirst();
    if (!row) throw notFound('schedule exception', input);
    if (row.revoked_at) return { scheduleExceptionId: row.id, revokedAt: row.revoked_at };
    await ctx.tx
      .updateTable('booking.schedule_exception')
      .set({ revoked_at: now, revoked_by: ctx.actor.staffId ?? null, revoke_reason: input.reason.trim() })
      .where('id', '=', row.id)
      .execute();
    ctx.audit({ action: 'status_change', subjectType: 'booking.schedule_exception', subjectId: row.id, reason: input.reason.trim() });
    return { scheduleExceptionId: row.id, revokedAt: now };
  });
}

export async function listFacilityHolidays(db: Kysely<DB>, caller: Caller, input: { facilityId: string; from: string; to: string }) {
  return runQuery(db, caller.tenantId, (tx) =>
    tx
      .selectFrom('booking.facility_holiday')
      .select(['id as facilityHolidayId', 'facility_id as facilityId', 'holiday_on as date', 'name', 'revoked_at as revokedAt', 'revoke_reason as revokeReason'])
      .where('facility_id', '=', input.facilityId)
      .where('holiday_on', '>=', input.from)
      .where('holiday_on', '<=', input.to)
      .orderBy('holiday_on')
      .execute(),
  );
}

export async function holidayFacility(db: Kysely<DB>, caller: Caller, facilityHolidayId: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('booking.facility_holiday').select('facility_id').where('id', '=', facilityHolidayId).executeTakeFirst())?.facility_id);
}

export async function revokeFacilityHoliday(db: Kysely<DB>, caller: Caller, input: { facilityHolidayId: string; reason: string }) {
  if (input.reason.trim().length < 3) throw invalid('a reason is required');
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.revoke_facility_holiday', request: input }, async (ctx) => {
    const row = await ctx.tx.selectFrom('booking.facility_holiday').select(['id', 'revoked_at']).where('id', '=', input.facilityHolidayId).forUpdate().executeTakeFirst();
    if (!row) throw notFound('facility holiday', input);
    if (row.revoked_at) return { facilityHolidayId: row.id, revokedAt: row.revoked_at };
    await ctx.tx
      .updateTable('booking.facility_holiday')
      .set({ revoked_at: now, revoked_by: ctx.actor.staffId ?? null, revoke_reason: input.reason.trim() })
      .where('id', '=', row.id)
      .execute();
    ctx.audit({ action: 'status_change', subjectType: 'booking.facility_holiday', subjectId: row.id, reason: input.reason.trim() });
    return { facilityHolidayId: row.id, revokedAt: now };
  });
}

/** Weekly sessions in force on or after a date (current and future rules). */
export async function listWeeklySessions(db: Kysely<DB>, caller: Caller, input: { staffId: string; from: string }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const resourceId = await practitionerResourceId(tx, input.staffId);
    return tx
      .selectFrom('booking.schedule_rule')
      .select([
        'id as scheduleRuleId', 'facility_id as facilityId', 'weekday', 'start_local as start', 'end_local as end', 'slot_minutes as slotMinutes',
        'max_walk_in_tokens as maxWalkInTokens', 'healthcare_service_id as healthcareServiceId', 'consult_location_id as consultLocationId',
        'visit_mode as visitMode', 'effective_from as effectiveFrom', 'effective_to as effectiveTo',
      ])
      .where('resource_id', '=', resourceId)
      .where('withdrawn_at', 'is', null)
      .where((eb) => eb.or([eb('effective_to', 'is', null), eb('effective_to', '>', input.from)]))
      .orderBy('weekday')
      .orderBy('start_local')
      .execute();
  });
}

/** The latest day plan for a date (revision 0 and no blocks when none was saved). */
export async function getDayPlan(db: Kysely<DB>, caller: Caller, input: { staffId: string; planOn: string }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const resourceId = await practitionerResourceId(tx, input.staffId);
    const plan = await tx
      .selectFrom('booking.day_plan')
      .select(['id', 'revision', 'replaces_weekly as replacesWeekly', 'note', 'saved_by as savedBy', 'created_at as savedAt'])
      .where('resource_id', '=', resourceId)
      .where('plan_on', '=', input.planOn)
      .orderBy('revision', 'desc')
      .executeTakeFirst();
    if (!plan) return { planOn: input.planOn, dayPlanId: null, revision: 0, replacesWeekly: false, note: null, blocks: [] };
    const blocks = await tx
      .selectFrom('booking.day_plan_block')
      .select([
        'facility_id as facilityId', 'start_local as start', 'end_local as end', 'slot_minutes as slotMinutes', 'max_walk_in_tokens as maxWalkInTokens',
        'healthcare_service_id as healthcareServiceId', 'consult_location_id as consultLocationId', 'visit_mode as visitMode',
      ])
      .where('day_plan_id', '=', plan.id)
      .orderBy('start_local')
      .execute();
    return { planOn: input.planOn, dayPlanId: plan.id, revision: plan.revision, replacesWeekly: plan.replacesWeekly, note: plan.note, savedBy: plan.savedBy, savedAt: plan.savedAt, blocks };
  });
}

// ---- weekly plan replacement (G07) --------------------------------------------------------------

export interface WeeklyPlanInput {
  staffId: string;
  facilityId: string;
  visitMode: 'in_person' | 'virtual';
  effectiveFrom: string; // first day of the new plan; after today at the facility
  effectiveTo?: string | null; // exclusive; null = keeps repeating
  slotMinutes: number;
  sessions: Array<{ weekday: number; start: string; end: string }>;
}

export interface WeeklyPlanResult {
  affectedAppointmentIds: string[];
  otherPublishedHours: Array<{ facilityId: string; facilityName: string; visitMode: string; weekday: number; start: string; end: string }>;
  canSave: boolean;
}

class DryRun extends Error {
  constructor(readonly result: WeeklyPlanResult) {
    super('dry run');
  }
}

/**
 * Replaces the practitioner's weekly hours at one facility and visit mode for a date range, atomically.
 * Earlier dates and hours elsewhere are kept; rules that never took effect are withdrawn. Refused (409)
 * while booked appointments would fall outside the new hours, so they're resolved first. `dryRun`
 * runs the same checks and rolls back: the preview and the save can't disagree.
 */
export async function replaceWeeklyPlan(db: Kysely<DB>, caller: Caller, input: WeeklyPlanInput, opts: { dryRun?: boolean; idempotencyKey?: string } = {}): Promise<WeeklyPlanResult> {
  const to = input.effectiveTo ?? null;
  if (to !== null && to <= input.effectiveFrom) throw invalid('effectiveTo must be after effectiveFrom');
  for (const x of input.sessions) {
    if (!Number.isInteger(x.weekday) || x.weekday < 1 || x.weekday > 7) throw invalid('weekday must be 1 (Mon) … 7 (Sun)');
    if (!TIME.test(x.start) || !TIME.test(x.end) || x.end <= x.start) throw invalid('session start/end must be HH:MM with end after start');
  }
  for (const a of input.sessions) {
    if (input.sessions.some((b) => b !== a && b.weekday === a.weekday && b.start < a.end && a.start < b.end)) throw invalid('sessions on the same day overlap');
  }
  const now = clock(caller);
  try {
    return await runCommand(db, { ...caller, module: 'booking', name: 'booking.replace_weekly_plan', request: input, idempotencyKey: opts.dryRun ? undefined : opts.idempotencyKey }, async (ctx) => {
      const tx = ctx.tx;
      const resourceId = await practitionerResourceId(tx, input.staffId);
      await tx.selectFrom('booking.schedulable_resource').select('id').where('id', '=', resourceId).forUpdate().execute();
      const { rows: [f] } = await sql<{ local_today: string; affiliated: boolean }>`
        SELECT (${now}::timestamptz AT TIME ZONE f.timezone)::date::text AS local_today,
               EXISTS (SELECT 1 FROM catalog.practitioner_affiliation pa
                       WHERE pa.staff_id = ${input.staffId} AND pa.facility_id = f.id AND pa.valid_from <= ${input.effectiveFrom}::date
                         AND (pa.valid_to IS NULL OR pa.valid_to > ${input.effectiveFrom}::date)) AS affiliated
        FROM platform.facility f WHERE f.id = ${input.facilityId}`.execute(tx);
      if (!f) throw notFound('facility', { facilityId: input.facilityId });
      if (!f.affiliated) throw preconditionFailed('practitioner is not affiliated with this facility on that date');
      if (input.effectiveFrom <= f.local_today) throw preconditionFailed('weekly hours can change from tomorrow; use a day plan for today', { reason: 'starts_too_soon' });

      const existing = await tx
        .selectFrom('booking.schedule_rule')
        .selectAll()
        .where('resource_id', '=', resourceId)
        .where('facility_id', '=', input.facilityId)
        .where('visit_mode', '=', input.visitMode)
        .where('withdrawn_at', 'is', null)
        .where(sql<boolean>`daterange(effective_from, effective_to) && daterange(${input.effectiveFrom}::date, ${to}::date)`)
        .orderBy('weekday')
        .orderBy('start_local')
        .execute();
      const outlasts = (r: (typeof existing)[number]) => to !== null && (r.effective_to === null || r.effective_to > to);
      for (const r of existing) {
        if (r.effective_from < input.effectiveFrom) {
          await tx.updateTable('booking.schedule_rule').set({ effective_to: input.effectiveFrom }).where('id', '=', r.id).execute();
          if (outlasts(r)) {
            const { id: _id, created_at: _c, updated_at: _u, version: _v, start_minute: _s, end_minute: _e, ...copy } = r;
            await tx.insertInto('booking.schedule_rule').values({ ...copy, effective_from: to!, created_by: ctx.actor.staffId ?? null, updated_by: ctx.actor.staffId ?? null }).execute();
          }
        } else if (outlasts(r)) {
          await tx.updateTable('booking.schedule_rule').set({ effective_from: to! }).where('id', '=', r.id).execute();
        } else {
          await tx.updateTable('booking.schedule_rule').set({ withdrawn_at: now, withdrawn_by: ctx.actor.staffId ?? null }).where('id', '=', r.id).execute();
        }
      }
      // New sessions keep the service, room and walk-in capacity of the hours they replace.
      for (const x of input.sessions) {
        const like = existing.find((r) => r.weekday === x.weekday) ?? existing[0];
        try {
          await tx
            .insertInto('booking.schedule_rule')
            .values({
              tenant_id: ctx.tenantId,
              resource_id: resourceId,
              facility_id: input.facilityId,
              consult_location_id: like?.consult_location_id ?? null,
              healthcare_service_id: like?.healthcare_service_id ?? null,
              weekday: x.weekday,
              start_local: x.start,
              end_local: x.end,
              slot_minutes: input.slotMinutes,
              max_walk_in_tokens: like?.max_walk_in_tokens ?? 0,
              visit_mode: input.visitMode,
              effective_from: input.effectiveFrom,
              effective_to: to,
            })
            .execute();
        } catch (err) {
          if (pgCode(err) === '23P01') throw conflict('these hours overlap hours the doctor has at another clinic or for another visit type', { reason: 'overlaps_other_hours', weekday: x.weekday });
          throw err;
        }
      }
      const { rows: affected } = await sql<{ id: string }>`
        SELECT a.id FROM booking.appointment a
        WHERE a.resource_id = ${resourceId} AND a.facility_id = ${input.facilityId} AND a.visit_mode = ${input.visitMode}
          AND a.status IN ('confirmed', 'checked_in') AND a.booking_kind = 'slot'
          AND a.session_on >= ${input.effectiveFrom}::date AND (${to}::date IS NULL OR a.session_on < ${to}::date)
          AND NOT EXISTS (
            SELECT 1 FROM booking.sessions(${resourceId}, a.session_on, a.session_on) s
            WHERE s.facility_id = a.facility_id AND s.visit_mode = a.visit_mode AND s.slot_minutes IS NOT NULL
              AND s.starts_at <= a.starts_at AND s.ends_at >= a.ends_at)
        ORDER BY a.starts_at`.execute(tx);
      const { rows: other } = await sql<WeeklyPlanResult['otherPublishedHours'][number]>`
        SELECT r.facility_id AS "facilityId", f.name AS "facilityName", r.visit_mode AS "visitMode", r.weekday,
               to_char(r.start_local, 'HH24:MI') AS start, to_char(r.end_local, 'HH24:MI') AS end
        FROM booking.schedule_rule r JOIN platform.facility f ON f.id = r.facility_id
        WHERE r.resource_id = ${resourceId} AND r.withdrawn_at IS NULL AND (r.facility_id <> ${input.facilityId} OR r.visit_mode <> ${input.visitMode})
          AND daterange(r.effective_from, r.effective_to) && daterange(${input.effectiveFrom}::date, ${to}::date)
        ORDER BY r.weekday, r.start_local`.execute(tx);
      const result: WeeklyPlanResult = { affectedAppointmentIds: affected.map((a) => a.id), otherPublishedHours: other, canSave: affected.length === 0 };
      if (opts.dryRun) throw new DryRun(result);
      if (!result.canSave) throw conflict('resolve the appointments outside the new hours before saving', { reason: 'affected_appointments', appointmentIds: result.affectedAppointmentIds });
      ctx.audit({ action: 'update', subjectType: 'booking.schedulable_resource', subjectId: resourceId, reason: 'weekly plan replaced', diff: { facilityId: input.facilityId, visitMode: input.visitMode, effectiveFrom: input.effectiveFrom, effectiveTo: to, sessions: input.sessions, slotMinutes: input.slotMinutes } });
      return result;
    });
  } catch (err) {
    if (err instanceof DryRun) return err.result;
    throw err;
  }
}
