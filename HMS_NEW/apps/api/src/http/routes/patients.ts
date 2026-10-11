import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { authorize } from '../../auth/principal.ts';
import { getPatient, listClinicPatients, searchPatients } from '../../modules/patient/read.ts';
import { registerPatient } from '../../modules/patient/register.ts';
import { callerOf, e164, idempotencyKey, isoDate, parse, principalOf, uuid } from '../support.ts';

const RegisterBody = z.object({
  givenName: z.string().trim().min(1).max(100),
  familyName: z.string().trim().max(100).optional(),
  birthDate: isoDate.optional(),
  birthDateEstimated: z.boolean().optional(),
  sex: z.enum(['male', 'female', 'other', 'unknown']),
  phone: e164.optional(),
  abhaNumber: z.string().regex(/^\d{2}-?\d{4}-?\d{4}-?\d{4}$/, 'ABHA number is 14 digits').optional(),
  registeredFacilityId: uuid,
  source: z.enum(['front_desk', 'portal', 'whatsapp', 'voice', 'abha_scan', 'emergency']),
});

export function registerPatientRoutes(app: FastifyInstance, db: Kysely<DB>) {
  app.post('/v1/patients', async (request, reply) => {
    const body = parse(RegisterBody, request.body);
    authorize(principalOf(request), 'patients.register', body.registeredFacilityId);
    const result = await registerPatient(db, callerOf(request), body, idempotencyKey(request));
    return reply.status(201).send(result);
  });

  app.get('/v1/patients', async (request) => {
    const q = parse(
      z.object({
        q: z.string().trim().min(2).max(100).optional(),
        phone: e164.optional(),
        abhaNumber: z.string().max(20).optional(),
        facilityId: uuid.optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
        offset: z.coerce.number().int().min(0).max(10_000).optional(),
      }),
      request.query,
    );
    // Without search terms, list one clinic's registered patients; that needs read access at that clinic.
    if (!q.q && !q.phone && !q.abhaNumber && q.facilityId) {
      authorize(principalOf(request), 'patients.read', q.facilityId);
      const limit = q.limit ?? 20;
      const items = await listClinicPatients(db, callerOf(request), q.facilityId, limit + 1, q.offset ?? 0);
      return { items: items.slice(0, limit), more: items.length > limit };
    }
    authorize(principalOf(request), 'patients.read');
    return { items: await searchPatients(db, callerOf(request), q) };
  });

  app.get('/v1/patients/:patientId', async (request) => {
    const { patientId } = parse(z.object({ patientId: uuid }), request.params);
    authorize(principalOf(request), 'patients.read');
    return getPatient(db, callerOf(request), patientId);
  });
}
