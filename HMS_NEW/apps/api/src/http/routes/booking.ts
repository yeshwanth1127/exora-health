import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize, authorizeEvery } from '../../auth/principal.ts';
import {
  bookAppointment,
  bookWalkIn,
  cancelAppointment,
  checkIn,
  getAppointment,
  holdSlot,
  listAppointments,
  operationsSummary,
  listWaitlist,
  addToWaitlist,
  offerWaitlistSlot,
  acceptWaitlistOffer,
  declineWaitlistOffer,
  withdrawFromWaitlist,
  waitlistFacility,
  waitlistOfferFacility,
  recentOutboxEvents,
  getOverbooking,
  markNoShow,
  overbookAppointment,
  releaseHold,
  rescheduleAppointment,
  reservationFacility,
  setOverbooking,
  slotFacility,
} from '../../modules/booking/index.ts';
import { callerOf, e164, idempotencyKey, isoDate, parse, principalOf, uuid } from '../support.ts';

const AppointmentParams = z.object({ appointmentId: uuid });
const Priority = z.enum(['normal', 'senior_citizen', 'emergency', 'vip']);
const VisitType = z.enum(['new', 'follow_up', 'review', 'procedure']);

const BookFields = z.object({
  patientId: uuid.optional(),
  bookingParty: z
    .object({
      name: z.string().trim().min(1).max(100),
      phone: e164.optional(),
      email: z.email().optional(),
      verifiedChannel: z.enum(['otp_sms', 'whatsapp', 'portal', 'staff']).optional(),
    })
    .refine((p) => p.phone || p.email, 'bookingParty needs a phone or email')
    .optional(),
  visitType: VisitType.optional(),
  originChannel: z.enum(['web', 'portal', 'whatsapp', 'voice', 'front_desk', 'referral']),
  priority: Priority.optional(),
  reason: z.string().max(500).optional(),
});
const party = (b: { patientId?: string | undefined; bookingParty?: unknown }) => !!(b.patientId || b.bookingParty);
const BookBody = BookFields.extend({ reservationId: uuid }).refine(party, 'give patientId, bookingParty, or both');
const OverbookBody = BookFields.extend({
  staffId: uuid,
  slotStart: z.iso.datetime({ offset: true }),
  overbookReason: z.string().trim().min(3).max(500),
}).refine(party, 'give patientId, bookingParty, or both');
const FacilityParams = z.object({ facilityId: uuid });

export function registerBookingRoutes(app: FastifyInstance, db: Kysely<DB>) {
  /** Loads an appointment and checks the permission for its facility (404 before 403). */
  async function authorizedAppointment(request: Parameters<typeof callerOf>[0], appointmentId: string, permission: string) {
    const appt = await getAppointment(db, callerOf(request), appointmentId);
    authorize(principalOf(request), permission, appt.facilityId);
    return appt;
  }

  app.post('/v1/holds', async (request, reply) => {
    const body = parse(z.object({ staffId: uuid, slotStart: z.iso.datetime({ offset: true }), holdMinutes: z.number().int().min(1).max(30).optional() }), request.body);
    const facilityId = await slotFacility(db, callerOf(request), body.staffId, new Date(body.slotStart));
    if (!facilityId) throw new DomainError('not_found', 'slot not found');
    authorize(principalOf(request), 'appointments.book', facilityId);
    return reply.status(201).send(await holdSlot(db, callerOf(request), { ...body, facilityId }, idempotencyKey(request)));
  });

  app.delete('/v1/holds/:reservationId', async (request) => {
    const { reservationId } = parse(z.object({ reservationId: uuid }), request.params);
    authorize(principalOf(request), 'appointments.book', await reservationFacility(db, callerOf(request), reservationId));
    return releaseHold(db, callerOf(request), { reservationId });
  });

  app.post('/v1/appointments', async (request, reply) => {
    const body = parse(BookBody, request.body);
    const facilityId = await reservationFacility(db, callerOf(request), body.reservationId);
    if (!facilityId) throw new DomainError('not_found', 'reservation not found');
    authorize(principalOf(request), 'appointments.book', facilityId);
    return reply.status(201).send(await bookAppointment(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.post('/v1/appointments/overbook', async (request, reply) => {
    const body = parse(OverbookBody, request.body);
    const facilityId = await slotFacility(db, callerOf(request), body.staffId, new Date(body.slotStart));
    if (!facilityId) throw new DomainError('not_found', 'slot not found');
    authorize(principalOf(request), 'appointments.book', facilityId);
    authorize(principalOf(request), 'appointments.overbook', facilityId);
    return reply.status(201).send(await overbookAppointment(db, callerOf(request), { ...body, facilityId }, idempotencyKey(request)));
  });

  app.get('/v1/facilities/:facilityId/overbooking', async (request) => {
    const { facilityId } = parse(FacilityParams, request.params);
    authorize(principalOf(request), 'appointments.read', facilityId);
    return getOverbooking(db, callerOf(request), facilityId);
  });

  app.put('/v1/facilities/:facilityId/overbooking', async (request) => {
    const { facilityId } = parse(FacilityParams, request.params);
    const body = parse(z.object({ enabled: z.boolean() }), request.body);
    authorize(principalOf(request), 'config.manage', facilityId);
    return setOverbooking(db, callerOf(request), { facilityId, enabled: body.enabled });
  });

  // Clinic overview (G12): the same appointment data the list shows, so the same permission at that clinic.
  app.get('/v1/operations/summary', async (request) => {
    const q = parse(z.object({ facilityId: uuid, date: isoDate }), request.query);
    authorize(principalOf(request), 'appointments.read', q.facilityId);
    return operationsSummary(db, callerOf(request), q.facilityId, q.date);
  });

  // The outbox spans every clinic and module (clinical included), so it needs audit.read for every clinic.
  app.get('/v1/operations/events', async (request) => {
    const q = parse(z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }), request.query ?? {});
    authorizeEvery(principalOf(request), 'audit.read', []);
    return { items: await recentOutboxEvents(db, callerOf(request), q.limit ?? 100) };
  });

  // Waitlist (G11). Each action is authorized at the request's clinic; a request without one needs every clinic.
  const atClinic = (request: FastifyRequest, permission: string, facilityId: string | null | undefined) => {
    if (facilityId === undefined) throw new DomainError('not_found', 'waitlist request not found');
    authorizeEvery(principalOf(request), permission, facilityId ? [facilityId] : []);
  };
  const WaitlistParams = z.object({ waitlistEntryId: uuid });
  const OfferParams = z.object({ offerId: uuid });

  app.get('/v1/waitlist', async (request) => {
    const q = parse(
      z.object({ facilityId: uuid, staffId: uuid.optional(), status: z.enum(['waiting', 'offered', 'accepted', 'withdrawn', 'expired']).optional() }),
      request.query,
    );
    authorize(principalOf(request), 'appointments.read', q.facilityId);
    return { items: await listWaitlist(db, callerOf(request), q) };
  });

  app.post('/v1/waitlist', async (request, reply) => {
    const body = parse(
      z.object({
        facilityId: uuid,
        staffId: uuid,
        preferredFrom: isoDate,
        preferredTo: isoDate,
        bookingParty: z.object({
          name: z.string().trim().min(1).max(100),
          phone: e164,
          verifiedChannel: z.enum(['otp_sms', 'whatsapp', 'portal', 'staff']).optional(),
        }),
        patientId: uuid.optional(),
        notes: z.string().trim().max(500).optional(),
      }),
      request.body,
    );
    authorize(principalOf(request), 'appointments.book', body.facilityId);
    return reply.status(201).send(await addToWaitlist(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.post('/v1/waitlist/:waitlistEntryId/offer', async (request, reply) => {
    const { waitlistEntryId } = parse(WaitlistParams, request.params);
    const body = parse(z.object({ slotStart: z.iso.datetime({ offset: true }) }), request.body);
    atClinic(request, 'appointments.book', await waitlistFacility(db, callerOf(request), waitlistEntryId));
    return reply.status(201).send(await offerWaitlistSlot(db, callerOf(request), { waitlistEntryId, ...body }, idempotencyKey(request)));
  });

  app.post('/v1/waitlist-offers/:offerId/accept', async (request, reply) => {
    const { offerId } = parse(OfferParams, request.params);
    atClinic(request, 'appointments.book', await waitlistOfferFacility(db, callerOf(request), offerId));
    return reply.status(201).send(await acceptWaitlistOffer(db, callerOf(request), { offerId }, idempotencyKey(request)));
  });

  app.post('/v1/waitlist-offers/:offerId/decline', async (request) => {
    const { offerId } = parse(OfferParams, request.params);
    atClinic(request, 'appointments.book', await waitlistOfferFacility(db, callerOf(request), offerId));
    return declineWaitlistOffer(db, callerOf(request), { offerId });
  });

  app.post('/v1/waitlist/:waitlistEntryId/withdraw', async (request) => {
    const { waitlistEntryId } = parse(WaitlistParams, request.params);
    const body = parse(z.object({ reason: z.string().trim().min(3).max(500) }), request.body);
    atClinic(request, 'appointments.cancel', await waitlistFacility(db, callerOf(request), waitlistEntryId));
    return withdrawFromWaitlist(db, callerOf(request), { waitlistEntryId, reason: body.reason });
  });

  app.get('/v1/appointments', async (request) => {
    const q = parse(
      z
        .object({
          from: isoDate,
          to: isoDate,
          facilityId: uuid.optional(),
          staffId: uuid.optional(),
          patientId: uuid.optional(),
          status: z.enum(['confirmed', 'checked_in', 'completed', 'cancelled', 'no_show']).optional(),
          q: z.string().trim().min(2).max(100).optional(),
          cursor: z.string().max(300).optional(),
          limit: z.coerce.number().int().min(1).max(500).optional(),
        })
        .refine((r) => r.to >= r.from, 'to must not be before from'),
      request.query,
    );
    const principal = principalOf(request);
    if (!q.facilityId && !principal.grants.get('appointments.read')?.has(null)) {
      // Staff whose access is limited to some facilities must say which one they're looking at.
      throw new DomainError('validation', 'facilityId is required for your access level');
    }
    authorize(principal, 'appointments.read', q.facilityId);
    return listAppointments(db, callerOf(request), q);
  });

  app.get('/v1/appointments/:appointmentId', async (request) => {
    const { appointmentId } = parse(AppointmentParams, request.params);
    return authorizedAppointment(request, appointmentId, 'appointments.read');
  });

  app.post('/v1/appointments/:appointmentId/cancel', async (request) => {
    const { appointmentId } = parse(AppointmentParams, request.params);
    const body = parse(z.object({ reason: z.string().trim().min(1).max(500) }), request.body);
    await authorizedAppointment(request, appointmentId, 'appointments.cancel');
    return cancelAppointment(db, callerOf(request), { appointmentId, reason: body.reason });
  });

  app.post('/v1/appointments/:appointmentId/reschedule', async (request) => {
    const { appointmentId } = parse(AppointmentParams, request.params);
    const body = parse(z.object({ newReservationId: uuid, reason: z.string().max(500).optional() }), request.body);
    await authorizedAppointment(request, appointmentId, 'appointments.reschedule');
    authorize(principalOf(request), 'appointments.reschedule', await reservationFacility(db, callerOf(request), body.newReservationId));
    return rescheduleAppointment(db, callerOf(request), { appointmentId, ...body }, idempotencyKey(request));
  });

  app.post('/v1/appointments/:appointmentId/no-show', async (request) => {
    const { appointmentId } = parse(AppointmentParams, request.params);
    await authorizedAppointment(request, appointmentId, 'appointments.check_in');
    return markNoShow(db, callerOf(request), { appointmentId });
  });

  app.post('/v1/appointments/:appointmentId/check-in', async (request) => {
    const { appointmentId } = parse(AppointmentParams, request.params);
    const body = parse(z.object({ patientId: uuid.optional() }), request.body ?? {});
    await authorizedAppointment(request, appointmentId, 'appointments.check_in');
    return checkIn(db, callerOf(request), { appointmentId, patientId: body.patientId }, idempotencyKey(request));
  });

  app.post('/v1/walk-ins', async (request, reply) => {
    const body = parse(
      z.object({ staffId: uuid, facilityId: uuid, patientId: uuid, priority: Priority.optional(), visitType: VisitType.optional(), reason: z.string().max(500).optional() }),
      request.body,
    );
    authorize(principalOf(request), 'appointments.check_in', body.facilityId);
    return reply.status(201).send(await bookWalkIn(db, callerOf(request), body, idempotencyKey(request)));
  });
}
