// Patient registry over HTTP (ERD m02, G24): identifiers, related people, consents, flags, duplicates.
// Patients are tenant-wide (one MRN across clinics), so, as for reading, a grant at any clinic suffices;
// merging needs patients.merge, flags patient_flags.manage, consents consents.record.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { authorize } from '../../auth/principal.ts';
import {
  addIdentifier,
  addRelatedPerson,
  clearFlag,
  confirmNoKnownAllergies,
  decideDuplicate,
  listLinks,
  patientRegistry,
  proposeDuplicate,
  recordConsent,
  removeIdentifier,
  setFlag,
  unmerge,
  updateRelatedPerson,
  withdrawConsent,
} from '../../modules/patient/registry.ts';
import { callerOf, e164, idempotencyKey, parse, principalOf, uuid } from '../support.ts';

const Reason = z.string().trim().min(3).max(500);
const PatientParams = z.object({ patientId: uuid });
const Relationship = z.enum(['spouse', 'parent', 'child', 'sibling', 'grandparent', 'grandchild', 'guardian', 'relative', 'friend', 'other']);

export function registerRegistryRoutes(app: FastifyInstance, db: Kysely<DB>) {
  app.get('/v1/patients/:patientId/registry', async (request) => {
    const { patientId } = parse(PatientParams, request.params);
    const p = principalOf(request);
    authorize(p, 'patients.read');
    return patientRegistry(db, callerOf(request), patientId, { confidentialFlags: !!p.grants.get('patient_flags.manage')?.size });
  });

  // ---- identifiers ----------------------------------------------------------------------------------
  app.post('/v1/patients/:patientId/identifiers', async (request, reply) => {
    const { patientId } = parse(PatientParams, request.params);
    const body = parse(
      z.object({
        system: z.enum(['abha_number', 'abha_address', 'pan', 'passport', 'voter_id', 'driving_licence', 'insurer_member_no', 'scheme_id', 'other']),
        value: z.string().trim().min(2).max(64),
        issuer: z.string().trim().max(100).nullable().optional(),
        verifiedVia: z.enum(['document', 'staff']).optional(),
        isPrimary: z.boolean().optional(),
      }),
      request.body,
    );
    authorize(principalOf(request), 'patients.update');
    return reply.status(201).send(await addIdentifier(db, callerOf(request), { patientId, ...body }, idempotencyKey(request)));
  });

  app.post('/v1/patient-identifiers/:identifierId/remove', async (request) => {
    const { identifierId } = parse(z.object({ identifierId: uuid }), request.params);
    const { reason } = parse(z.object({ reason: Reason }), request.body);
    authorize(principalOf(request), 'patients.update');
    return removeIdentifier(db, callerOf(request), { identifierId, reason });
  });

  // ---- related people -----------------------------------------------------------------------------------
  const RelatedFields = z.object({
    name: z.string().trim().min(2).max(100),
    relationship: Relationship,
    phone: e164.nullable(),
    isGuardian: z.boolean(),
    isEmergencyContact: z.boolean(),
    isLegalRepresentative: z.boolean(),
    representativeScope: z.string().trim().max(200).nullable(),
    relatedPatientId: uuid.nullable(),
  });

  app.post('/v1/patients/:patientId/related-persons', async (request, reply) => {
    const { patientId } = parse(PatientParams, request.params);
    const body = parse(RelatedFields, request.body);
    authorize(principalOf(request), 'patients.update');
    return reply.status(201).send(await addRelatedPerson(db, callerOf(request), { patientId, ...body }, idempotencyKey(request)));
  });

  app.patch('/v1/related-persons/:relatedPersonId', async (request) => {
    const { relatedPersonId } = parse(z.object({ relatedPersonId: uuid }), request.params);
    const body = parse(RelatedFields.partial().extend({ version: z.number().int().min(1), ended: z.boolean().optional() }), request.body);
    authorize(principalOf(request), 'patients.update');
    return updateRelatedPerson(db, callerOf(request), { relatedPersonId, ...body });
  });

  // ---- consents ----------------------------------------------------------------------------------------
  app.post('/v1/patients/:patientId/consents', async (request, reply) => {
    const { patientId } = parse(PatientParams, request.params);
    const body = parse(
      z.object({
        consentType: z.enum(['treatment', 'admission', 'procedure', 'anaesthesia', 'blood_transfusion', 'high_risk', 'teleconsult', 'data_sharing_abdm', 'research', 'lama_dama']),
        status: z.enum(['signed', 'refused']),
        signedBy: z.enum(['patient', 'guardian', 'representative']),
        relatedPersonId: uuid.nullable().optional(),
        encounterId: uuid.nullable().optional(),
        expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
        language: z.string().max(20).nullable().optional(),
        notes: z.string().trim().max(1000).nullable().optional(),
      }),
      request.body,
    );
    authorize(principalOf(request), 'consents.record');
    return reply.status(201).send(await recordConsent(db, callerOf(request), { patientId, ...body }, idempotencyKey(request)));
  });

  app.post('/v1/patient-consents/:consentId/withdraw', async (request) => {
    const { consentId } = parse(z.object({ consentId: uuid }), request.params);
    const { reason } = parse(z.object({ reason: Reason }), request.body);
    authorize(principalOf(request), 'consents.record');
    return withdrawConsent(db, callerOf(request), { consentId, reason });
  });

  // ---- flags -------------------------------------------------------------------------------------------
  app.post('/v1/patients/:patientId/flags', async (request, reply) => {
    const { patientId } = parse(PatientParams, request.params);
    const body = parse(
      z.object({
        flagType: z.enum(['isolation', 'fall_risk', 'allergy_alert', 'safeguarding', 'vip', 'confidential', 'mlc', 'do_not_resuscitate']),
        reason: Reason,
        activeTo: z.iso.datetime({ offset: true }).nullable().optional(),
      }),
      request.body,
    );
    authorize(principalOf(request), 'patient_flags.manage');
    return reply.status(201).send(await setFlag(db, callerOf(request), { patientId, ...body }, idempotencyKey(request)));
  });

  app.post('/v1/patient-flags/:flagId/clear', async (request) => {
    const { flagId } = parse(z.object({ flagId: uuid }), request.params);
    const { reason } = parse(z.object({ reason: Reason }), request.body);
    authorize(principalOf(request), 'patient_flags.manage');
    return clearFlag(db, callerOf(request), { flagId, reason });
  });

  app.post('/v1/patients/:patientId/no-known-allergies', async (request) => {
    const { patientId } = parse(PatientParams, request.params);
    authorize(principalOf(request), 'clinical.write');
    return confirmNoKnownAllergies(db, callerOf(request), { patientId });
  });

  // ---- duplicates --------------------------------------------------------------------------------------
  app.get('/v1/patient-links', async (request) => {
    const q = parse(z.object({ patientId: uuid.optional(), open: z.enum(['true', 'false']).optional() }), request.query);
    authorize(principalOf(request), 'patients.merge');
    return { items: await listLinks(db, callerOf(request), { patientId: q.patientId, open: q.open === 'true' }) };
  });

  app.post('/v1/patient-links', async (request, reply) => {
    const body = parse(z.object({ survivorPatientId: uuid, otherPatientId: uuid, reason: Reason }), request.body);
    // Anyone who registers or edits patients may flag a likely duplicate; deciding needs patients.merge.
    authorize(principalOf(request), 'patients.update');
    return reply.status(201).send(await proposeDuplicate(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.post('/v1/patient-links/:linkId/decide', async (request) => {
    const { linkId } = parse(z.object({ linkId: uuid }), request.params);
    const body = parse(z.object({ decision: z.enum(['merge', 'not_duplicate']), reason: Reason }), request.body);
    authorize(principalOf(request), 'patients.merge');
    return decideDuplicate(db, callerOf(request), { linkId, ...body });
  });

  app.post('/v1/patient-links/:linkId/unmerge', async (request) => {
    const { linkId } = parse(z.object({ linkId: uuid }), request.params);
    const { reason } = parse(z.object({ reason: Reason }), request.body);
    authorize(principalOf(request), 'patients.merge');
    return unmerge(db, callerOf(request), { linkId, reason });
  });
}
