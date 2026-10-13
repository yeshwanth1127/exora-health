// The Schedules board (G04), exact-time holds (G08) and request outcome lookup (G26).
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize } from '../../auth/principal.ts';
import { calendarBoard, holdRange, rangeFacility, requestOutcome } from '../../modules/booking/board.ts';
import { callerOf, idempotencyKey, isoDate, parse, principalOf, uuid } from '../support.ts';

export function registerBoardRoutes(app: FastifyInstance, db: Kysely<DB>) {
  app.get('/v1/calendar-board', async (request) => {
    const q = parse(z.object({ facilityId: uuid, date: isoDate, staffId: uuid.optional() }), request.query);
    authorize(principalOf(request), 'appointments.read', q.facilityId);
    return calendarBoard(db, callerOf(request), q);
  });

  // Staff only: a booking channel (service account) keeps to whole published slots.
  app.post('/v1/holds/range', async (request, reply) => {
    const body = parse(
      z.object({ staffId: uuid, startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }), holdMinutes: z.number().int().min(1).max(30).optional(), visitMode: z.enum(['in_person', 'virtual']).optional() }),
      request.body,
    );
    const p = principalOf(request);
    if (p.isSystemAccount) throw new DomainError('forbidden', 'booking channels hold whole slots', { reason: 'staff_only' });
    const facilityId = await rangeFacility(db, callerOf(request), body.staffId, new Date(body.startsAt), new Date(body.endsAt));
    if (!facilityId) throw new DomainError('precondition_failed', "that time isn't inside the doctor's published hours", { reason: 'outside_hours' });
    authorize(p, 'appointments.book', facilityId);
    return reply.status(201).send(await holdRange(db, callerOf(request), { ...body, facilityId }, idempotencyKey(request)));
  });

  app.get('/v1/request-outcomes/:key', async (request) => {
    const { key } = parse(z.object({ key: z.string().regex(/^[A-Za-z0-9_.:-]{8,128}$/) }), request.params);
    principalOf(request);
    return requestOutcome(db, callerOf(request), key);
  });
}
