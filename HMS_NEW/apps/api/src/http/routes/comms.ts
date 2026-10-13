import { registerWhatsAppRoutes } from './whatsapp.ts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import {
  ContactPointCreateSchema,
  MessagingConsentCreateSchema,
  FollowupRuleKindSchema,
  FollowupRuleUpsertSchema,
  AppointmentFollowupCreateSchema,
  NotificationHistoryQuerySchema,
} from '@hms/contracts';
import { authorize, grantedFacilities, type Principal } from '../../auth/principal.ts';
import {
  followupRules,
  upsertFollowupRule,
  scheduleFollowup,
  offerFacility,
  appointmentFacility,
  capabilities,
  contactOwner,
  createContact,
  listContacts,
  messages,
  recordMessagingConsent,
  requireBookingPartyAtFacility,
} from '../../modules/comms/notifications.ts';
import { callerOf, idempotencyKey, parse, principalOf, uuid } from '../support.ts';
function authorizeOwner(
  p: Principal,
  owner: { facilityId: string; patientId?: string | null; bookingPartyId?: string | null },
) {
  authorize(p, owner.patientId ? 'patients.read' : 'appointments.read', owner.facilityId);
}
export function registerCommsRoutes(app: FastifyInstance, db: Kysely<DB>) {
  registerWhatsAppRoutes(app,db);
  app.get('/v1/comms/capabilities', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
    authorize(principalOf(request), 'comms.read', facilityId);
    return capabilities(db, callerOf(request), facilityId);
  });
  app.get('/v1/contact-points', async (request) => {
    const filter = parse(
      z
        .object({ facilityId: uuid, patientId: uuid.optional(), bookingPartyId: uuid.optional() })
        .refine((v) => !!v.patientId !== !!v.bookingPartyId, 'choose exactly one owner'),
      request.query,
    );
    authorize(principalOf(request), 'comms.read', filter.facilityId);
    authorizeOwner(principalOf(request), filter);
    if (filter.bookingPartyId)
      await requireBookingPartyAtFacility(db, callerOf(request), filter.bookingPartyId, filter.facilityId);
    const replyFacilities = grantedFacilities(principalOf(request), 'comms.reply');
    return listContacts(db, callerOf(request), filter, {
      revealAddress: replyFacilities === null || replyFacilities.has(filter.facilityId),
    });
  });
  app.post('/v1/contact-points', async (request, reply) => {
    const input = parse(ContactPointCreateSchema, request.body);
    authorize(principalOf(request), 'comms.reply', input.facilityId);
    authorizeOwner(principalOf(request), input);
    return reply.status(201).send(await createContact(db, callerOf(request), input, idempotencyKey(request)));
  });
  app.post('/v1/contact-points/:id/consents', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params),
      input = parse(MessagingConsentCreateSchema, request.body);
    const owner = await contactOwner(db, callerOf(request), id);
    authorizeOwner(principalOf(request), owner);
    if (owner.bookingPartyId)
      await requireBookingPartyAtFacility(db, callerOf(request), owner.bookingPartyId, owner.facilityId);
    const facility = owner.facilityId;
    authorize(
      principalOf(request),
      input.purpose === 'marketing' && input.action === 'opt_in' ? 'comms.manage' : 'comms.reply',
      facility,
    );
    return recordMessagingConsent(db, callerOf(request), id, input, idempotencyKey(request));
  });
  app.get('/v1/appointments/:id/messages', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const facilityId = await appointmentFacility(db, callerOf(request), id);
    authorize(principalOf(request), 'appointments.read', facilityId);
    authorize(principalOf(request), 'comms.read', facilityId);
    return messages(db, callerOf(request), { appointmentId: id });
  });
  app.get('/v1/comms/followup-rules', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
    authorize(principalOf(request), 'comms.read', facilityId);
    return followupRules(db, callerOf(request), facilityId);
  });
  app.put('/v1/comms/followup-rules/:kind', async (request) => {
    const { kind } = parse(z.object({ kind: FollowupRuleKindSchema }), request.params),
      input = parse(FollowupRuleUpsertSchema, request.body);
    authorize(principalOf(request), 'comms.manage', input.facilityId);
    return upsertFollowupRule(db, callerOf(request), kind, input, idempotencyKey(request));
  });
  app.post('/v1/appointments/:id/followup', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params),
      input = parse(AppointmentFollowupCreateSchema, request.body),
      facilityId = await appointmentFacility(db, callerOf(request), id);
    authorize(principalOf(request), 'appointments.read', facilityId);
    authorize(principalOf(request), 'comms.reply', facilityId);
    return scheduleFollowup(db, callerOf(request), id, input, idempotencyKey(request));
  });
  app.get('/v1/waitlist-offers/:id/messages', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params),
      facilityId = await offerFacility(db, callerOf(request), id);
    authorize(principalOf(request), 'appointments.read', facilityId);
    authorize(principalOf(request), 'comms.read', facilityId);
    return messages(db, callerOf(request), { offerId: id });
  });
  app.get('/v1/outbound-messages', async (request) => {
    const filter = parse(NotificationHistoryQuerySchema, request.query);
    authorize(principalOf(request), 'comms.read', filter.facilityId);
    return messages(db, callerOf(request), filter);
  });
}
