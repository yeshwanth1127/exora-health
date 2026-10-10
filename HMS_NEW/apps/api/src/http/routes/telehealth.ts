import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize } from '../../auth/principal.ts';
import type { TelehealthSettings } from '../../config.ts';
import { getAppointment } from '../../modules/booking/read.ts';
import {
  doctorJoinGrant,
  endTeleconsult,
  getTeleconsult,
  issuePatientLink,
  listTeleconsults,
  patientCheckIn,
  patientConsent,
  patientJoinGrant,
  patientLeave,
  patientSessionView,
  recordVerbalConsent,
  resolvePatientLink,
  sha256,
  startTeleconsult,
  teleconsultFacility,
  verifyPatientIdentity,
  type LinkCaller,
} from '../../modules/telehealth/index.ts';
import { callerOf, isoDate, parse, principalOf, uuid } from '../support.ts';

const SessionParams = z.object({ sessionId: uuid });
const AppointmentParams = z.object({ appointmentId: uuid });
const DocVersion = z.string().regex(/^[A-Za-z0-9._-]{1,40}$/);

export const TELE_TOKEN_HEADER = 'x-teleconsult-token';

export function registerTelehealthRoutes(app: FastifyInstance, db: Kysely<DB>, settings: TelehealthSettings) {
  async function authorizeSession(request: FastifyRequest, sessionId: string, permission: string) {
    const facilityId = await teleconsultFacility(db, callerOf(request), sessionId);
    if (!facilityId) throw new DomainError('not_found', 'teleconsultation not found');
    authorize(principalOf(request), permission, facilityId);
  }

  // ---- staff ------------------------------------------------------------------------------------
  app.get('/v1/teleconsults', async (request) => {
    const q = parse(
      z.object({ facilityId: uuid, date: isoDate, staffId: uuid.optional(), status: z.enum(['scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show']).optional() }),
      request.query,
    );
    authorize(principalOf(request), 'teleconsult.read', q.facilityId);
    return { items: await listTeleconsults(db, callerOf(request), q) };
  });

  app.get('/v1/teleconsults/:sessionId', async (request) => {
    const { sessionId } = parse(SessionParams, request.params);
    await authorizeSession(request, sessionId, 'teleconsult.read');
    return getTeleconsult(db, callerOf(request), { sessionId });
  });

  app.get('/v1/appointments/:appointmentId/teleconsult', async (request) => {
    const { appointmentId } = parse(AppointmentParams, request.params);
    const appt = await getAppointment(db, callerOf(request), appointmentId);
    authorize(principalOf(request), 'teleconsult.read', appt.facilityId);
    return getTeleconsult(db, callerOf(request), { appointmentId });
  });

  app.post('/v1/appointments/:appointmentId/teleconsult/link', async (request, reply) => {
    const { appointmentId } = parse(AppointmentParams, request.params);
    const appt = await getAppointment(db, callerOf(request), appointmentId);
    authorize(principalOf(request), 'teleconsult.manage', appt.facilityId);
    // The response holds a secret: never cache it.
    return reply.status(201).header('cache-control', 'no-store').send(await issuePatientLink(db, callerOf(request), settings, { appointmentId }));
  });

  app.post('/v1/teleconsults/:sessionId/consent', async (request, reply) => {
    const { sessionId } = parse(SessionParams, request.params);
    const body = parse(z.object({ documentVersion: DocVersion, note: z.string().trim().min(5).max(500) }), request.body);
    await authorizeSession(request, sessionId, 'consents.record');
    return reply.status(201).send(await recordVerbalConsent(db, callerOf(request), { sessionId, ...body }));
  });

  app.post('/v1/teleconsults/:sessionId/start', async (request) => {
    const { sessionId } = parse(SessionParams, request.params);
    await authorizeSession(request, sessionId, 'teleconsult.conduct');
    return startTeleconsult(db, callerOf(request), settings, { sessionId });
  });

  app.post('/v1/teleconsults/:sessionId/join', async (request, reply) => {
    const { sessionId } = parse(SessionParams, request.params);
    await authorizeSession(request, sessionId, 'teleconsult.conduct');
    return reply.header('cache-control', 'no-store').send(await doctorJoinGrant(db, callerOf(request), settings, { sessionId }));
  });

  app.post('/v1/teleconsults/:sessionId/identity', async (request) => {
    const { sessionId } = parse(SessionParams, request.params);
    const body = parse(z.object({ method: z.enum(['known_patient', 'photo_id', 'abha', 'verified_by_staff']), note: z.string().trim().max(500).optional() }), request.body);
    await authorizeSession(request, sessionId, 'teleconsult.conduct');
    return verifyPatientIdentity(db, callerOf(request), { sessionId, ...body });
  });

  app.post('/v1/teleconsults/:sessionId/end', async (request) => {
    const { sessionId } = parse(SessionParams, request.params);
    const body = parse(z.object({ outcome: z.enum(['consulted', 'patient_did_not_join', 'technical_failure']), note: z.string().trim().max(500).optional() }), request.body);
    await authorizeSession(request, sessionId, 'teleconsult.conduct');
    return endTeleconsult(db, callerOf(request), { sessionId, ...body });
  });

  // ---- patient (join link) ------------------------------------------------------------------------
  // The link is <patient page>#t=<token>; the page sends the token in X-Teleconsult-Token. No staff
  // login, no tenant header: the token identifies the tenant and the session, nothing else.
  async function linkCaller(request: FastifyRequest): Promise<LinkCaller> {
    const token = request.headers[TELE_TOKEN_HEADER];
    if (typeof token !== 'string') throw new DomainError('forbidden', 'video consultation link missing', { reason: 'invalid_link' });
    const now = request.clockOverride ?? new Date();
    const { tenantId, sessionId } = await resolvePatientLink(db, token, now);
    return { tenantId, sessionId, actor: { kind: 'patient' }, now: request.clockOverride, correlationId: request.id };
  }

  app.get('/tele/v1/session', async (request, reply) => {
    const caller = await linkCaller(request);
    return reply.header('cache-control', 'no-store').send(await patientSessionView(db, caller, settings));
  });

  app.post('/tele/v1/session/consent', async (request, reply) => {
    const caller = await linkCaller(request);
    const body = parse(z.object({ documentVersion: DocVersion, accepted: z.literal(true) }), request.body);
    const ua = request.headers['user-agent'];
    return reply.status(201).send(await patientConsent(db, caller, { documentVersion: body.documentVersion, ipHash: sha256(request.ip), userAgentHash: typeof ua === 'string' ? sha256(ua) : undefined }));
  });

  app.post('/tele/v1/session/check-in', async (request) => patientCheckIn(db, await linkCaller(request), settings));

  app.post('/tele/v1/session/join', async (request, reply) =>
    reply.header('cache-control', 'no-store').send(await patientJoinGrant(db, await linkCaller(request), settings)),
  );

  app.post('/tele/v1/session/leave', async (request) => patientLeave(db, await linkCaller(request)));
}
