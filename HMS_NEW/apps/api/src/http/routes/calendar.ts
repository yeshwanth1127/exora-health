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
  listSessions,
  listSlots,
  practitionerFacilities,
  saveDayPlan,
  scheduleRuleFacility,
} from '../../modules/booking/index.ts';
import { DomainError } from '@hms/platform';
import { callerOf, hhmm, isoDate, parse, principalOf, uuid } from '../support.ts';

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
  healthcareServiceId: uuid.optional(),
  reason: z.string().max(500).optional(),
});

const DayPlanBody = z.object({
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

/** Keeps rows from facilities the principal may read (a facility-scoped grant sees only its facilities). */
function visible<T extends { facilityId: string }>(principal: Principal, permission: string, rows: T[]): T[] {
  authorize(principal, permission);
  const granted = grantedFacilities(principal, permission);
  return granted === null ? rows : rows.filter((r) => granted.has(r.facilityId));
}

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
    return reply.status(201).send(await addWeeklySession(db, callerOf(request), { staffId, ...body }));
  });

  app.post('/v1/weekly-sessions/:scheduleRuleId/end', async (request) => {
    const { scheduleRuleId } = parse(z.object({ scheduleRuleId: uuid }), request.params);
    const body = parse(z.object({ effectiveTo: isoDate }), request.body);
    const facilityId = await scheduleRuleFacility(db, callerOf(request), scheduleRuleId);
    if (!facilityId) throw new DomainError('not_found', 'schedule rule not found');
    authorize(principalOf(request), 'schedules.manage', facilityId);
    return endWeeklySession(db, callerOf(request), { scheduleRuleId, ...body });
  });

  app.post('/v1/practitioners/:staffId/exceptions', async (request, reply) => {
    const { staffId } = parse(StaffParams, request.params);
    const body = parse(ExceptionBody, request.body);
    // Extra hours belong to one facility; leave and blocks reach every facility the doctor works at that day.
    if (body.facilityId) authorize(principalOf(request), 'schedules.manage', body.facilityId);
    else authorizeEvery(principalOf(request), 'schedules.manage', await practitionerFacilities(db, callerOf(request), staffId, body.onDate));
    return reply.status(201).send(await addScheduleException(db, callerOf(request), { staffId, ...body }));
  });

  app.post('/v1/facilities/:facilityId/holidays', async (request, reply) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.params);
    const body = parse(z.object({ date: isoDate, name: z.string().trim().min(1).max(100) }), request.body);
    authorize(principalOf(request), 'schedules.manage', facilityId);
    return reply.status(201).send(await addFacilityHoliday(db, callerOf(request), { facilityId, ...body }));
  });

  app.put('/v1/practitioners/:staffId/day-plans/:planOn', async (request) => {
    const { staffId, planOn } = parse(z.object({ staffId: uuid, planOn: isoDate }), request.params);
    const body = parse(DayPlanBody, request.body);
    const principal = principalOf(request);
    // A new revision replaces the whole day: cover the new blocks and every facility it can take sessions from.
    const reach = await dayPlanFacilities(db, callerOf(request), staffId, planOn);
    authorizeEvery(principal, 'schedules.manage', [...reach, ...body.blocks.map((b) => b.facilityId)]);
    return saveDayPlan(db, callerOf(request), { staffId, planOn, ...body });
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
