// Clinical records over HTTP (ERD m05): triage, MLC, immunizations, care plans, referrals, births,
// deaths. Authorized at the encounter's clinic; the commands then check the care relationship.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError, runQuery } from '@hms/platform';
import { authorize, authorizeAny } from '../../auth/principal.ts';
import {
  certifyDeath,
  createCarePlan,
  createReferral,
  encounterFacility,
  markImmunizationInError,
  openMlc,
  recordBirth,
  recordDeath,
  recordImmunization,
  recordTriage,
  recordsFacility,
  referralFacility,
  referralInbox,
  reportBirth,
  respondToReferral,
  setActivityStatus,
  setCarePlanStatus,
  updateMlc,
} from '../../modules/clinical/index.ts';
import { callerOf, e164, isoDate, parse, principalOf, uuid } from '../support.ts';

const Reason = z.string().trim().min(3).max(500);
const missing = (what: string) => new DomainError('not_found', `${what} not found`);
const When = z.iso.datetime({ offset: true });

export function registerRecordRoutes(app: FastifyInstance, db: Kysely<DB>) {
  async function atEncounter(request: Parameters<typeof callerOf>[0], encounterId: string, permission: string) {
    const facilityId = await encounterFacility(db, callerOf(request), encounterId);
    if (!facilityId) throw missing('encounter');
    authorize(principalOf(request), permission, facilityId);
  }
  async function atRecord(request: Parameters<typeof callerOf>[0], table: Parameters<typeof recordsFacility>[2], id: string, permission: string) {
    const facilityId = await recordsFacility(db, callerOf(request), table, id);
    if (!facilityId) throw missing(table.replace('_', ' '));
    authorize(principalOf(request), permission, facilityId);
  }
  const careActivity = (request: Parameters<typeof callerOf>[0], activityId: string) =>
    runQuery(db, callerOf(request).tenantId, async (tx) => (await tx.selectFrom('clinical.care_plan_activity').select('care_plan_id').where('id', '=', activityId).executeTakeFirst())?.care_plan_id);

  // ---- triage ---------------------------------------------------------------------------------------
  app.post('/v1/encounters/:encounterId/triage', async (request, reply) => {
    const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
    const body = parse(
      z.object({
        triageScale: z.enum(['india_colour', 'esi', 'mts']),
        category: z.enum(['red', 'yellow', 'green', 'black', '1', '2', '3', '4', '5']),
        arrivalMode: z.enum(['walk_in', 'ambulance_108', 'private_ambulance', 'police', 'referred']).optional(),
        chiefComplaint: z.string().trim().max(500).optional(),
        reassessInMinutes: z.number().int().min(5).max(720).optional(),
      }),
      request.body,
    );
    await atEncounter(request, encounterId, 'clinical.write');
    return reply.status(201).send(await recordTriage(db, callerOf(request), { encounterId, ...body }));
  });

  // ---- medico-legal case ------------------------------------------------------------------------------
  const MlcFields = z.object({
    mlcType: z.enum(['road_traffic', 'assault', 'burns', 'poisoning', 'fall', 'sexual_assault', 'animal_bite', 'industrial', 'suspected_suicide', 'brought_dead', 'other']),
    incidentAt: When.nullable().optional(),
    incidentPlace: z.string().trim().max(300).nullable().optional(),
    broughtByName: z.string().trim().max(100).nullable().optional(),
    broughtByRelation: z.string().trim().max(60).nullable().optional(),
    broughtByPhone: e164.nullable().optional(),
    policeStation: z.string().trim().max(150).nullable().optional(),
    policeIntimatedAt: When.nullable().optional(),
    intimationMode: z.enum(['phone', 'in_person', 'written', 'email']).nullable().optional(),
    intimationRef: z.string().trim().max(100).nullable().optional(),
    officerName: z.string().trim().max(100).nullable().optional(),
    officerBadgeNo: z.string().trim().max(40).nullable().optional(),
    injuryDetails: z.array(z.object({ site: z.string().max(100), kind: z.string().max(100), size: z.string().max(60).optional(), notes: z.string().max(500).optional() })).max(50).optional(),
    evidenceHandover: z.array(z.object({ item: z.string().max(200), handedTo: z.string().max(100), at: When, receipt: z.string().max(100).optional() })).max(50).optional(),
    isPocso: z.boolean().optional(),
  });

  app.post('/v1/encounters/:encounterId/mlc', async (request, reply) => {
    const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
    const body = parse(MlcFields, request.body);
    await atEncounter(request, encounterId, 'mlc.record');
    return reply.status(201).send(await openMlc(db, callerOf(request), { encounterId, ...body }));
  });

  app.patch('/v1/mlc-records/:mlcId', async (request) => {
    const { mlcId } = parse(z.object({ mlcId: uuid }), request.params);
    const body = parse(MlcFields.partial().extend({ version: z.number().int().min(1) }), request.body);
    await atRecord(request, 'mlc_record', mlcId, 'mlc.record');
    return updateMlc(db, callerOf(request), { mlcId, ...body });
  });

  // ---- immunizations ----------------------------------------------------------------------------------
  app.post('/v1/encounters/:encounterId/immunizations', async (request, reply) => {
    const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
    const body = parse(
      z.object({
        vaccine: z.string().trim().min(2).max(120),
        lotNumber: z.string().trim().max(60).nullable().optional(),
        doseNumber: z.number().int().min(1).max(20).nullable().optional(),
        administeredAt: When.optional(),
        route: z.enum(['intramuscular', 'subcutaneous', 'intradermal', 'oral', 'intranasal']).nullable().optional(),
        site: z.string().trim().max(60).nullable().optional(),
        status: z.enum(['completed', 'not_done']).optional(),
        notDoneReason: z.string().trim().max(300).nullable().optional(),
      }),
      request.body,
    );
    await atEncounter(request, encounterId, 'clinical.write');
    return reply.status(201).send(await recordImmunization(db, callerOf(request), { encounterId, ...body }));
  });

  app.post('/v1/immunizations/:immunizationId/entered-in-error', async (request) => {
    const { immunizationId } = parse(z.object({ immunizationId: uuid }), request.params);
    const { reason } = parse(z.object({ reason: Reason }), request.body);
    await atRecord(request, 'immunization', immunizationId, 'clinical.write');
    return markImmunizationInError(db, callerOf(request), { immunizationId, reason });
  });

  // ---- care plans -------------------------------------------------------------------------------------
  const ActivityKind = z.enum(['medication', 'observation', 'procedure', 'education', 'diet', 'follow_up', 'other']);
  app.post('/v1/encounters/:encounterId/care-plans', async (request, reply) => {
    const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
    const body = parse(
      z.object({
        title: z.string().trim().min(3).max(200),
        periodEnd: isoDate.nullable().optional(),
        activities: z.array(z.object({ kind: ActivityKind, description: z.string().trim().min(2).max(500), frequency: z.string().trim().max(100).nullable().optional() })).max(50),
      }),
      request.body,
    );
    await atEncounter(request, encounterId, 'clinical.write');
    return reply.status(201).send(await createCarePlan(db, callerOf(request), { encounterId, ...body }));
  });

  app.post('/v1/care-plans/:carePlanId/status', async (request) => {
    const { carePlanId } = parse(z.object({ carePlanId: uuid }), request.params);
    const body = parse(z.object({ status: z.enum(['completed', 'revoked']), reason: Reason }), request.body);
    await atRecord(request, 'care_plan', carePlanId, 'clinical.write');
    return setCarePlanStatus(db, callerOf(request), { carePlanId, ...body });
  });

  app.post('/v1/care-plan-activities/:activityId/status', async (request) => {
    const { activityId } = parse(z.object({ activityId: uuid }), request.params);
    const body = parse(z.object({ status: z.enum(['in_progress', 'completed', 'cancelled']) }), request.body);
    const planId = await careActivity(request, activityId);
    if (!planId) throw missing('care plan activity');
    await atRecord(request, 'care_plan', planId, 'clinical.write');
    return setActivityStatus(db, callerOf(request), { activityId, ...body });
  });

  // ---- referrals --------------------------------------------------------------------------------------
  app.post('/v1/encounters/:encounterId/referrals', async (request, reply) => {
    const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
    const body = parse(
      z.object({
        direction: z.enum(['internal', 'outbound', 'inbound']),
        reason: z.string().trim().min(3).max(2000),
        urgency: z.enum(['routine', 'urgent', 'emergency']).default('routine'),
        toFacilityId: uuid.nullable().optional(),
        toDepartmentId: uuid.nullable().optional(),
        toStaffId: uuid.nullable().optional(),
        externalOrg: z.string().trim().max(200).nullable().optional(),
        externalDoctor: z.string().trim().max(100).nullable().optional(),
      }),
      request.body,
    );
    await atEncounter(request, encounterId, 'clinical.write');
    return reply.status(201).send(await createReferral(db, callerOf(request), { encounterId, ...body }));
  });

  app.post('/v1/referrals/:referralId/respond', async (request) => {
    const { referralId } = parse(z.object({ referralId: uuid }), request.params);
    const body = parse(z.object({ status: z.enum(['accepted', 'rejected', 'completed', 'cancelled']), note: z.string().trim().max(1000).optional() }), request.body);
    const where = await referralFacility(db, callerOf(request), referralId);
    if (!where) throw missing('referral');
    // The referring clinic or the clinic referred to.
    authorizeAny(principalOf(request), 'clinical.write', where);
    return respondToReferral(db, callerOf(request), { referralId, ...body });
  });

  app.get('/v1/referrals', async (request) => {
    const q = parse(z.object({ facilityId: uuid, staffId: uuid.optional(), status: z.enum(['sent', 'accepted', 'rejected', 'completed', 'cancelled']).optional() }), request.query);
    authorize(principalOf(request), 'encounters.read', q.facilityId);
    return { items: await referralInbox(db, callerOf(request), q) };
  });

  // ---- births and deaths ------------------------------------------------------------------------------
  app.post('/v1/encounters/:encounterId/births', async (request, reply) => {
    const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
    const body = parse(
      z.object({
        bornAt: When,
        sex: z.enum(['male', 'female', 'other', 'unknown']),
        birthWeightG: z.number().int().min(200).max(7000).nullable().optional(),
        gestationWeeks: z.number().int().min(20).max(45).nullable().optional(),
        deliveryMethod: z.enum(['normal_vaginal', 'assisted_vaginal', 'lscs', 'other']),
        birthOrder: z.number().int().min(1).max(9).optional(),
        apgar1: z.number().int().min(0).max(10).nullable().optional(),
        apgar5: z.number().int().min(0).max(10).nullable().optional(),
        isLiveBirth: z.boolean(),
        babyPatientId: uuid.nullable().optional(),
      }),
      request.body,
    );
    await atEncounter(request, encounterId, 'vital_records.record');
    return reply.status(201).send(await recordBirth(db, callerOf(request), { encounterId, ...body }));
  });

  app.post('/v1/birth-records/:birthId/report', async (request) => {
    const { birthId } = parse(z.object({ birthId: uuid }), request.params);
    const body = parse(z.object({ civilRegistrationRef: z.string().trim().min(3).max(60) }), request.body);
    await atRecord(request, 'birth_record', birthId, 'vital_records.record');
    return reportBirth(db, callerOf(request), { birthId, ...body });
  });

  app.post('/v1/encounters/:encounterId/death', async (request, reply) => {
    const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
    const body = parse(
      z.object({
        diedAt: When,
        causeChain: z.array(z.string().trim().min(2).max(300)).min(1).max(4),
        contributingConditions: z.array(z.string().trim().min(2).max(300)).max(10).optional(),
        manner: z.enum(['natural', 'accident', 'suicide', 'homicide', 'pending_investigation', 'undetermined']),
        isMlc: z.boolean().optional(),
        postMortemRequired: z.boolean().optional(),
      }),
      request.body,
    );
    await atEncounter(request, encounterId, 'vital_records.record');
    return reply.status(201).send(await recordDeath(db, callerOf(request), { encounterId, ...body }));
  });

  app.post('/v1/death-records/:deathId/certify', async (request) => {
    const { deathId } = parse(z.object({ deathId: uuid }), request.params);
    const body = parse(z.object({ mccdForm: z.enum(['form_4', 'form_4a']).optional(), bodyReleasedTo: z.string().trim().min(2).max(200).optional() }), request.body);
    await atRecord(request, 'death_record', deathId, 'vital_records.record');
    return certifyDeath(db, callerOf(request), { deathId, ...body });
  });
}
