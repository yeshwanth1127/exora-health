// Doctor calendars: the practitioner's bookable calendar, weekly sessions, leave/blocks/extra hours,
// facility holidays and one-day plans.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand } from '@hms/platform';
import type { Caller } from '../../caller.ts';

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

/** Appointments still confirmed/checked-in for a resource that overlap a window — to warn the caller. */
async function affectedAppointments(tx: Transaction<DB>, resourceId: string, from: Date, to: Date): Promise<string[]> {
  const rows = await tx
    .selectFrom('booking.appointment')
    .select('id')
    .where('resource_id', '=', resourceId)
    .where('status', 'in', ['confirmed', 'checked_in'])
    .where('booking_kind', '=', 'slot')
    .where(sql<boolean>`tstzrange(starts_at, ends_at) && tstzrange(${from}, ${to})`)
    .execute();
  return rows.map((r) => r.id);
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

export async function addWeeklySession(db: Kysely<DB>, caller: Caller, input: WeeklySessionInput) {
  if (!Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 7) throw invalid('weekday must be 1 (Mon) … 7 (Sun)');
  if (!TIME.test(input.start) || !TIME.test(input.end) || input.end <= input.start) throw invalid('start/end must be HH:MM with end after start');
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.add_weekly_session', request: input }, async (ctx) => {
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
  facilityId?: string; // required for extra_hours
  slotMinutes?: number; // required for extra_hours
  healthcareServiceId?: string;
  reason?: string;
}

/** Leave, a blocked window, or extra hours. Returns booked appointments that now clash, for rescheduling. */
export async function addScheduleException(db: Kysely<DB>, caller: Caller, input: ScheduleExceptionInput) {
  if ((input.start === undefined) !== (input.end === undefined)) throw invalid('give both start and end, or neither');
  if (input.start && (!TIME.test(input.start) || !TIME.test(input.end!) || input.end! <= input.start)) throw invalid('start/end must be HH:MM with end after start');
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.add_schedule_exception', request: input }, async (ctx) => {
    const resourceId = await practitionerResourceId(ctx.tx, input.staffId);
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

    let affectedAppointmentIds: string[] = [];
    if (input.kind !== 'extra_hours') {
      // The window in absolute time, per facility the doctor works at that day.
      const windows = await sql<{ from_ts: Date; to_ts: Date }>`
        SELECT DISTINCT (${input.onDate}::date + coalesce(${input.start ?? null}::time, '00:00')) AT TIME ZONE f.timezone AS from_ts,
               CASE WHEN ${input.end ?? null}::time IS NULL
                    THEN (${input.onDate}::date + 1)::timestamp AT TIME ZONE f.timezone
                    ELSE (${input.onDate}::date + ${input.end ?? null}::time) AT TIME ZONE f.timezone END AS to_ts
        FROM platform.facility f`.execute(ctx.tx);
      const ids = new Set<string>();
      for (const w of windows.rows) for (const a of await affectedAppointments(ctx.tx, resourceId, w.from_ts, w.to_ts)) ids.add(a);
      affectedAppointmentIds = [...ids];
    }
    return { scheduleExceptionId: id, affectedAppointmentIds };
  });
}

export async function addFacilityHoliday(db: Kysely<DB>, caller: Caller, input: { facilityId: string; date: string; name: string }) {
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.add_facility_holiday', request: input }, async (ctx) => {
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
export async function saveDayPlan(db: Kysely<DB>, caller: Caller, input: DayPlanInput) {
  for (const b of input.blocks) {
    if (!TIME.test(b.start) || !TIME.test(b.end) || b.end <= b.start) throw invalid('block start/end must be HH:MM with end after start');
  }
  const sorted = [...input.blocks].sort((x, y) => (x.start < y.start ? -1 : 1));
  for (let i = 1; i < sorted.length; i++) if (sorted[i]!.start < sorted[i - 1]!.end) throw invalid('day plan blocks overlap');
  return runCommand(db, { ...caller, module: 'booking', name: 'booking.save_day_plan', request: input }, async (ctx) => {
    const resourceId = await practitionerResourceId(ctx.tx, input.staffId);
    // Lock the calendar so two editors can't both save "revision N+1".
    await ctx.tx.selectFrom('booking.schedulable_resource').select('id').where('id', '=', resourceId).forUpdate().execute();
    const { max } = await ctx.tx
      .selectFrom('booking.day_plan')
      .select((eb) => eb.fn.max<number | null>('revision').as('max'))
      .where('resource_id', '=', resourceId)
      .where('plan_on', '=', input.planOn)
      .executeTakeFirstOrThrow();
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
