import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize } from '../../auth/principal.ts';
import {
  bookAppointment,
  bookWalkIn,
  cancelAppointment,
  checkIn,
  getAppointment,
  holdSlot,
  listAppointments,
  markNoShow,
  releaseHold,
  rescheduleAppointment,
  reservationFacility,
  slotFacility,
} from '../../modules/booking/index.ts';
import { callerOf, e164, idempotencyKey, isoDate, parse, principalOf, uuid } from '../support.ts';

const AppointmentParams = z.object({ appointmentId: uuid });
const Priority = z.enum(['normal', 'senior_citizen', 'emergency', 'vip']);
const VisitType = z.enum(['new', 'follow_up', 'review', 'procedure']);

const BookBody = z
  .object({
    reservationId: uuid,
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
  })
  .refine((b) => b.patientId || b.bookingParty, 'give patientId, bookingParty, or both');

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
    authorize(principalOf(request), 'appointments.book', facilityId);
    return reply.status(201).send(await holdSlot(db, callerOf(request), body, idempotencyKey(request)));
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
    return { items: await listAppointments(db, callerOf(request), q) };
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
