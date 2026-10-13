import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { authorize } from '../../auth/principal.ts';
import { getPatient, listClinicPatients, searchPatients } from '../../modules/patient/read.ts';
import { registerPatient } from '../../modules/patient/register.ts';
import { updatePatient } from '../../modules/patient/update.ts';
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

const optionalText = (max: number) => z.string().trim().max(max).nullable().transform((v) => v || null).optional();
const UpdateBody = z.object({
  version: z.number().int().min(1),
  givenName: z.string().trim().min(1).max(100).optional(),
  familyName: optionalText(100),
  birthDate: isoDate.nullable().optional(),
  birthDateEstimated: z.boolean().optional(),
  sex: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  preferredLanguage: optionalText(40),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).nullable().optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed', 'separated', 'unknown']).nullable().optional(),
  occupation: optionalText(80),
  phone: e164.nullable().optional(),
  email: z.email().max(254).nullable().optional(),
  address: z
    .object({
      line1: z.string().trim().max(200).nullable().transform((v) => v || null),
      line2: z.string().trim().max(200).nullable().transform((v) => v || null),
      city: z.string().trim().max(80).nullable().transform((v) => v || null),
      district: z.string().trim().max(80).nullable().transform((v) => v || null),
      stateCode: z.string().regex(/^[0-9]{2}$/, '2-digit state code').nullable(),
      pincode: z.string().regex(/^[1-9][0-9]{5}$/, '6-digit pincode').nullable(),
    })
    .nullable()
    .optional(),
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

  // Patients are tenant-wide (one MRN across clinics), so, as for reading, a grant at any clinic suffices.
  app.patch('/v1/patients/:patientId', async (request) => {
    const { patientId } = parse(z.object({ patientId: uuid }), request.params);
    const body = parse(UpdateBody, request.body);
    authorize(principalOf(request), 'patients.update');
    return updatePatient(db, callerOf(request), { patientId, ...body });
  });

  app.get('/v1/patients/:patientId', async (request) => {
    const { patientId } = parse(z.object({ patientId: uuid }), request.params);
    authorize(principalOf(request), 'patients.read');
    return getPatient(db, callerOf(request), patientId);
  });
}
