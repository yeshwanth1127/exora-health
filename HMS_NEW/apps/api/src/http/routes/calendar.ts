import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { authorize, authorizeAny, authorizeEvery, grantedFacilities, type Principal } from '../../auth/principal.ts';
import {
  addFacilityHoliday,
  addScheduleException,
  addWeeklySession,
  createPractitionerCalendar,
  dayPlanFacilities,
  endWeeklySession,
  getDayPlan,
  holidayFacility,
  listFacilityHolidays,
  listScheduleExceptions,
  listSessions,
  listSlots,
  listWeeklySessions,
  practitionerFacilities,
  previewClosure,
  replaceWeeklyPlan,
  revokeFacilityHoliday,
  revokeScheduleException,
  saveDayPlan,
  scheduleExceptionScope,
  scheduleRuleFacility,
} from '../../modules/booking/index.ts';
import { DomainError } from '@hms/platform';
import { callerOf, hhmm, isoDate, optionalIdempotencyKey, parse, principalOf, uuid } from '../support.ts';

const StaffParams = z.object({ staffId: uuid });
const Range = z.object({ from: isoDate, to: isoDate }).refine((r) => r.to >= r.from, 'to must not be before from');

const SessionBody = z.object({
  facilityId: uuid,
  weekday: z.number().int().min(1).max(7),
  start: hhmm,
  end: hhmm,
  slotMinutes: z.number().int().min(5).max(240).nullable().optional(),
  maxWalkInTokens: z.number().int().min(0).max(500).optional(),
  healthcareServiceId: uuid.nullable().optional(),
  consultLocationId: uuid.nullable().optional(),
  visitMode: z.enum(['in_person', 'virtual']).optional(),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
});

const ExceptionBody = z.object({
  onDate: isoDate,
  kind: z.enum(['closed', 'block', 'extra_hours']),
  start: hhmm.optional(),
  end: hhmm.optional(),
  facilityId: uuid.optional(),
  slotMinutes: z.number().int().min(5).max(240).optional(),
  visitMode: z.enum(['in_person', 'virtual']).optional(),
  healthcareServiceId: uuid.optional(),
  reason: z.string().max(500).optional(),
}).refine((b) => b.visitMode === undefined || b.kind === 'extra_hours', 'visitMode applies only to extra hours');

const DayPlanBody = z.object({
  baseRevision: z.number().int().min(0).optional(),
  replacesWeekly: z.boolean(),
  note: z.string().max(500).optional(),
  blocks: z
    .array(
      z.object({
        facilityId: uuid,
        start: hhmm,
        end: hhmm,
        slotMinutes: z.number().int().min(5).max(240).nullable().optional(),
        maxWalkInTokens: z.number().int().min(0).max(500).optional(),
        healthcareServiceId: uuid.nullable().optional(),
        consultLocationId: uuid.nullable().optional(),
        visitMode: z.enum(['in_person', 'virtual']).optional(),
      }),
    )
    .max(20),
});

/**
 * Keeps rows from facilities the principal may read (a facility-scoped grant sees only its facilities).
 * Rows with no facility are practitioner-wide (leave across every clinic) and stay visible.
 */
function visible<T extends { facilityId: string | null }>(principal: Principal, permission: string, rows: T[]): T[] {
  authorize(principal, permission);
  const granted = grantedFacilities(principal, permission);
  return granted === null ? rows : rows.filter((r) => r.facilityId === null || granted.has(r.facilityId));
}

const WeeklyPlanBody = z.object({
  facilityId: uuid,
  visitMode: z.enum(['in_person', 'virtual']),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
  slotMinutes: z.number().int().min(5).max(240),
  sessions: z.array(z.object({ weekday: z.number().int().min(1).max(7), start: hhmm, end: hhmm })).max(50),
  // What the hours offer; omitted keeps what the replaced hours offered (or the clinic's one matching service).
  healthcareServiceId: uuid.nullable().optional(),
  consultLocationId: uuid.nullable().optional(),
});

const ClosureBody = z.object({ onDate: isoDate, start: hhmm.optional(), end: hhmm.optional(), facilityId: uuid.optional() });
const RevokeBody = z.object({ reason: z.string().trim().min(3).max(500) });

export function registerCalendarRoutes(app: FastifyInstance, db: Kysely<DB>) {
  app.post('/v1/practitioners/:staffId/calendar', async (request, reply) => {
    const { staffId } = parse(StaffParams, request.params);
    authorizeAny(principalOf(request), 'schedules.manage', await practitionerFacilities(db, callerOf(request), staffId));
    const result = await createPractitionerCalendar(db, callerOf(request), { staffId });
    return reply.status(result.created ? 201 : 200).send(result);
  });

  app.post('/v1/practitioners/:staffId/weekly-sessions', async (request, reply) => {
    const { staffId } = parse(StaffParams, request.params);
    const body = parse(SessionBody, request.body);
    authorize(principalOf(request), 'schedules.manage', body.facilityId);
    return reply.status(201).send(await addWeeklySession(db, callerOf(request), { staffId, ...body }, optionalIdempotencyKey(request)));
  });

  app.post('/v1/weekly-sessions/:scheduleRuleId/end', async (request) => {
    const { scheduleRuleId } = parse(z.object({ scheduleRuleId: uuid }), request.params);
    const body = parse(z.object({ effectiveTo: isoDate }), request.body);
    const facilityId = await scheduleRuleFacility(db, callerOf(request), scheduleRuleId);
    if (!facilityId) throw new DomainError('not_found', 'schedule rule not found');
    authorize(principalOf(request), 'schedules.manage', facilityId);
    return endWeeklySession(db, callerOf(request), { scheduleRuleId, ...body });
  });

  /** A clinic-specific change needs that clinic; an every-clinic one needs each clinic the doctor works at that day. */
  async function authorizeReach(request: Parameters<typeof callerOf>[0], staffId: string, onDate: string, facilityId: string | null | undefined) {
    if (facilityId) authorize(principalOf(request), 'schedules.manage', facilityId);
    else authorizeEvery(principalOf(request), 'schedules.manage', await practitionerFacilities(db, callerOf(request), staffId, onDate));
  }

  app.post('/v1/practitioners/:staffId/exceptions', async (request, reply) => {
    const { staffId } = parse(StaffParams, request.params);
    const body = parse(ExceptionBody, request.body);
    await authorizeReach(request, staffId, body.onDate, body.facilityId);
    return reply.status(201).send(await addScheduleException(db, callerOf(request), { staffId, ...body }, optionalIdempotencyKey(request)));
  });

  app.post('/v1/practitioners/:staffId/exceptions/preview', async (request) => {
    const { staffId } = parse(StaffParams, request.params);
    const body = parse(ClosureBody.refine((b) => (b.start === undefined) === (b.end === undefined), 'give both start and end, or neither'), request.body);
    await authorizeReach(request, staffId, body.onDate, body.facilityId);
    return previewClosure(db, callerOf(request), { staffId, ...body });
  });

  app.get('/v1/practitioners/:staffId/exceptions', async (request) => {
    const { staffId } = parse(StaffParams, request.params);
    const range = parse(Range, request.query);
    return { items: visible(principalOf(request), 'appointments.read', await listScheduleExceptions(db, callerOf(request), { staffId, ...range })) };
  });

  app.post('/v1/schedule-exceptions/:scheduleExceptionId/revoke', async (request) => {
    const { scheduleExceptionId } = parse(z.object({ scheduleExceptionId: uuid }), request.params);
    const body = parse(RevokeBody, request.body);
    const scope = await scheduleExceptionScope(db, callerOf(request), scheduleExceptionId);
    if (!scope) throw new DomainError('not_found', 'schedule exception not found');
    await authorizeReach(request, scope.staffId!, scope.onDate, scope.facilityId);
    return revokeScheduleException(db, callerOf(request), { scheduleExceptionId, reason: body.reason });
  });

  app.post('/v1/facilities/:facilityId/holidays', async (request, reply) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.params);
    const body = parse(z.object({ date: isoDate, name: z.string().trim().min(1).max(100) }), request.body);
    authorize(principalOf(request), 'schedules.manage', facilityId);
    return reply.status(201).send(await addFacilityHoliday(db, callerOf(request), { facilityId, ...body }, optionalIdempotencyKey(request)));
  });

  app.get('/v1/facilities/:facilityId/holidays', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.params);
    const range = parse(Range, request.query);
    authorize(principalOf(request), 'appointments.read', facilityId);
    return { items: await listFacilityHolidays(db, callerOf(request), { facilityId, ...range }) };
  });

  app.post('/v1/facility-holidays/:facilityHolidayId/revoke', async (request) => {
    const { facilityHolidayId } = parse(z.object({ facilityHolidayId: uuid }), request.params);
    const body = parse(RevokeBody, request.body);
    const facilityId = await holidayFacility(db, callerOf(request), facilityHolidayId);
    if (!facilityId) throw new DomainError('not_found', 'facility holiday not found');
    authorize(principalOf(request), 'schedules.manage', facilityId);
    return revokeFacilityHoliday(db, callerOf(request), { facilityHolidayId, reason: body.reason });
  });

  for (const [path, dryRun] of [['weekly-plan/preview', true], ['weekly-plan', false]] as const) {
    app[dryRun ? 'post' : 'put'](`/v1/practitioners/:staffId/${path}`, async (request) => {
      const { staffId } = parse(StaffParams, request.params);
      const body = parse(WeeklyPlanBody, request.body);
      authorize(principalOf(request), 'schedules.manage', body.facilityId);
      return replaceWeeklyPlan(db, callerOf(request), { staffId, ...body }, { dryRun, idempotencyKey: optionalIdempotencyKey(request) });
    });
  }

  app.get('/v1/practitioners/:staffId/weekly-sessions', async (request) => {
    const { staffId } = parse(StaffParams, request.params);
    const q = parse(z.object({ from: isoDate }), request.query);
    return { items: visible(principalOf(request), 'appointments.read', await listWeeklySessions(db, callerOf(request), { staffId, from: q.from })) };
  });

  app.get('/v1/practitioners/:staffId/day-plans/:planOn', async (request) => {
    const { staffId, planOn } = parse(z.object({ staffId: uuid, planOn: isoDate }), request.params);
    const plan = await getDayPlan(db, callerOf(request), { staffId, planOn });
    return { ...plan, blocks: visible(principalOf(request), 'appointments.read', plan.blocks) };
  });

  app.put('/v1/practitioners/:staffId/day-plans/:planOn', async (request) => {
    const { staffId, planOn } = parse(z.object({ staffId: uuid, planOn: isoDate }), request.params);
    const body = parse(DayPlanBody, request.body);
    const principal = principalOf(request);
    // A new revision replaces the whole day: cover the new blocks and every facility it can take sessions from.
    const reach = await dayPlanFacilities(db, callerOf(request), staffId, planOn);
    authorizeEvery(principal, 'schedules.manage', [...reach, ...body.blocks.map((b) => b.facilityId)]);
    return saveDayPlan(db, callerOf(request), { staffId, planOn, ...body }, optionalIdempotencyKey(request));
  });

  app.get('/v1/practitioners/:staffId/sessions', async (request) => {
    const { staffId } = parse(StaffParams, request.params);
    const range = parse(Range, request.query);
    return { items: visible(principalOf(request), 'appointments.read', await listSessions(db, callerOf(request), { staffId, ...range })) };
  });

  app.get('/v1/practitioners/:staffId/slots', async (request) => {
    const { staffId } = parse(StaffParams, request.params);
    const q = parse(
      z.object({ from: isoDate, to: isoDate, facilityId: uuid.optional(), includeUnavailable: z.enum(['true', 'false']).optional() }).refine(
        (r) => r.to >= r.from && Date.parse(r.to) - Date.parse(r.from) <= 31 * 86_400_000,
        'range must be 0–31 days',
      ),
      request.query,
    );
    const principal = principalOf(request);
    authorize(principal, 'appointments.read', q.facilityId);
    const items = await listSlots(db, callerOf(request), {
      staffId,
      from: q.from,
      to: q.to,
      facilityId: q.facilityId,
      includeUnavailable: q.includeUnavailable === 'true',
    });
    return { items: visible(principal, 'appointments.read', items) };
  });
}
