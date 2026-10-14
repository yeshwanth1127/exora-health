// The Schedules board (G04), exact-time holds (G08) and request outcome lookup (G26).
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize, authorizeEvery } from '../../auth/principal.ts';
import { calendarBoard, holdRange, rangeFacility, requestOutcome } from '../../modules/booking/board.ts';
import { getAppointment, waitlistFacility, waitlistOfferFacility } from '../../modules/booking/index.ts';
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
    const { scope } = parse(z.object({ scope: z.string().min(3).max(100).optional() }), request.query);
    const caller = callerOf(request), principal = principalOf(request);
    const receipt = await requestOutcome(db, caller, key, scope);
    const result = receipt.result as Record<string, unknown> | null;
    const id = (field: string): string | undefined => uuid.safeParse(result?.[field]).success ? result?.[field] as string : undefined;
    const appointments: Record<string, string> = {
      'booking.hold_slot': 'appointments.book', 'booking.hold_range': 'appointments.book',
      'booking.book_appointment': 'appointments.book', 'booking.book_walk_in': 'appointments.book',
      'booking.overbook_appointment': 'appointments.book', 'booking.reschedule_appointment': 'appointments.reschedule',
      'booking.cancel_appointment': 'appointments.cancel', 'booking.check_in': 'appointments.check_in',
    };
    const permission = appointments[receipt.scope];
    if (permission) {
      let facilityId = id('facilityId');
      if (id('appointmentId')) {
        const appointment = await getAppointment(db, caller, id('appointmentId')!);
        facilityId = appointment.facilityId;
        if (receipt.scope === 'booking.reschedule_appointment' && appointment.rescheduledFromId) {
          authorize(principal, permission, (await getAppointment(db, caller, appointment.rescheduledFromId)).facilityId);
        }
      }
      // Missing scope evidence is not an invitation to authorize at an arbitrary clinic.
      authorizeEvery(principal, permission, facilityId ? [facilityId] : []);
      if (receipt.scope === 'booking.overbook_appointment') authorizeEvery(principal, 'appointments.overbook', facilityId ? [facilityId] : []);
    } else if (['booking.waitlist_add', 'booking.waitlist_offer', 'booking.waitlist_accept', 'booking.waitlist_decline', 'booking.waitlist_withdraw'].includes(receipt.scope)) {
      const entry = id('waitlistEntryId'), offer = id('offerId');
      let facilityId = entry ? await waitlistFacility(db, caller, entry) : offer ? await waitlistOfferFacility(db, caller, offer) : undefined;
      if (!facilityId && id('appointmentId')) facilityId = (await getAppointment(db, caller, id('appointmentId')!)).facilityId;
      authorizeEvery(principal, receipt.scope === 'booking.waitlist_withdraw' ? 'appointments.cancel' : 'appointments.book', facilityId ? [facilityId] : []);
    } else {
      throw new DomainError('forbidden', 'this command has no authorized receipt lookup; replay the original request instead');
    }
    return receipt;
  });
}
