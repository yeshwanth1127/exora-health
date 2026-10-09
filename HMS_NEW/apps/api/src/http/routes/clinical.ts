import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize } from '../../auth/principal.ts';
import {
  addDiagnosis,
  addParticipant,
  breakGlass,
  cancelEncounter,
  correctObservation,
  createNote,
  encounterFacility,
  encounterForAppointment,
  finishEncounter,
  getEncounterDetail,
  getPatientChart,
  listEncounters,
  listNoteTemplates,
  openEncounter,
  recordAllergy,
  recordFacility,
  recordVitals,
  saveNote,
  signNote,
  startEncounter,
  updateAllergyStatus,
  updateCondition,
  voidNote,
} from '../../modules/clinical/index.ts';
import { getAppointment } from '../../modules/booking/read.ts';
import { callerOf, idempotencyKey, isoDate, parse, principalOf, uuid } from '../support.ts';

const EncounterParams = z.object({ encounterId: uuid });
const NoteParams = z.object({ noteId: uuid });
const PatientParams = z.object({ patientId: uuid });
const NoteType = z.enum(['consultation', 'history', 'examination', 'progress', 'nursing', 'procedure', 'discharge_summary', 'referral_letter']);
const NoteData = z.record(z.string(), z.unknown());

export function registerClinicalRoutes(app: FastifyInstance, db: Kysely<DB>) {
  /** Facility of an encounter (404 if missing), then the permission for it. */
  async function authorizeEncounter(request: Parameters<typeof callerOf>[0], encounterId: string, permission: string) {
    const facilityId = await encounterFacility(db, callerOf(request), encounterId);
    if (!facilityId) throw new DomainError('not_found', 'encounter not found');
    authorize(principalOf(request), permission, facilityId);
  }
  async function authorizeRecord(request: Parameters<typeof callerOf>[0], kind: 'note' | 'observation', id: string, permission: string) {
    const facilityId = await recordFacility(db, callerOf(request), kind, id);
    if (!facilityId) throw new DomainError('not_found', `${kind} not found`);
    authorize(principalOf(request), permission, facilityId);
  }

  // ---- worklist and lifecycle -------------------------------------------------------------------
  app.get('/v1/encounters', async (request) => {
    const q = parse(z.object({ facilityId: uuid, date: isoDate, staffId: uuid.optional(), status: z.enum(['arrived', 'in_progress', 'finished', 'cancelled']).optional() }), request.query);
    authorize(principalOf(request), 'encounters.read', q.facilityId);
    return { items: await listEncounters(db, callerOf(request), q) };
  });

  app.get('/v1/appointments/:appointmentId/encounter', async (request) => {
    const { appointmentId } = parse(z.object({ appointmentId: uuid }), request.params);
    const appt = await getAppointment(db, callerOf(request), appointmentId);
    authorize(principalOf(request), 'encounters.read', appt.facilityId);
    return encounterForAppointment(db, callerOf(request), appointmentId);
  });

  app.post('/v1/encounters', async (request, reply) => {
    const body = parse(
      z.object({
        patientId: uuid,
        facilityId: uuid,
        attendingStaffId: uuid,
        encounterClass: z.enum(['outpatient', 'emergency', 'day_care', 'virtual']),
        departmentId: uuid.optional(),
        chiefComplaint: z.string().max(500).optional(),
      }),
      request.body,
    );
    authorize(principalOf(request), 'encounters.manage', body.facilityId);
    return reply.status(201).send(await openEncounter(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.get('/v1/encounters/:encounterId', async (request) => {
    const { encounterId } = parse(EncounterParams, request.params);
    await authorizeEncounter(request, encounterId, 'clinical.read');
    return getEncounterDetail(db, callerOf(request), encounterId);
  });

  app.post('/v1/encounters/:encounterId/start', async (request) => {
    const { encounterId } = parse(EncounterParams, request.params);
    await authorizeEncounter(request, encounterId, 'encounters.manage');
    return startEncounter(db, callerOf(request), { encounterId });
  });

  app.post('/v1/encounters/:encounterId/finish', async (request) => {
    const { encounterId } = parse(EncounterParams, request.params);
    const body = parse(
      z.object({ disposition: z.enum(['discharged_home', 'admitted', 'referred_out', 'lama', 'absconded', 'died', 'follow_up']), followUpAdvisedOn: isoDate.optional() }),
      request.body,
    );
    await authorizeEncounter(request, encounterId, 'encounters.manage');
    return finishEncounter(db, callerOf(request), { encounterId, ...body });
  });

  app.post('/v1/encounters/:encounterId/cancel', async (request) => {
    const { encounterId } = parse(EncounterParams, request.params);
    const body = parse(z.object({ reason: z.string().trim().min(1).max(500) }), request.body);
    await authorizeEncounter(request, encounterId, 'encounters.manage');
    return cancelEncounter(db, callerOf(request), { encounterId, reason: body.reason });
  });

  app.post('/v1/encounters/:encounterId/participants', async (request, reply) => {
    const { encounterId } = parse(EncounterParams, request.params);
    const body = parse(z.object({ staffId: uuid, role: z.enum(['consulting', 'resident', 'nurse', 'other']) }), request.body);
    await authorizeEncounter(request, encounterId, 'encounters.manage');
    return reply.status(201).send(await addParticipant(db, callerOf(request), { encounterId, ...body }));
  });

  // ---- vitals ------------------------------------------------------------------------------------
  app.post('/v1/encounters/:encounterId/vitals', async (request, reply) => {
    const { encounterId } = parse(EncounterParams, request.params);
    const body = parse(
      z.object({
        effectiveAt: z.iso.datetime({ offset: true }).optional(),
        values: z.array(z.object({ code: z.string().min(1).max(40), value: z.union([z.number(), z.string().max(200)]) })).min(1).max(30),
      }),
      request.body,
    );
    await authorizeEncounter(request, encounterId, 'clinical.write');
    return reply.status(201).send(await recordVitals(db, callerOf(request), { encounterId, ...body }));
  });

  app.post('/v1/observations/:observationId/correct', async (request) => {
    const { observationId } = parse(z.object({ observationId: uuid }), request.params);
    const body = parse(z.object({ reason: z.string().trim().min(3).max(500), value: z.union([z.number(), z.string().max(200)]).optional() }), request.body);
    await authorizeRecord(request, 'observation', observationId, 'clinical.write');
    return correctObservation(db, callerOf(request), { observationId, ...body });
  });

  // ---- notes -------------------------------------------------------------------------------------
  app.get('/v1/note-templates', async (request) => {
    authorize(principalOf(request), 'clinical.read');
    return { items: await listNoteTemplates(db, callerOf(request)) };
  });

  app.post('/v1/encounters/:encounterId/notes', async (request, reply) => {
    const { encounterId } = parse(EncounterParams, request.params);
    const body = parse(z.object({ noteType: NoteType, templateCode: z.string().max(64).optional(), data: NoteData.optional(), narrative: z.string().max(20000).optional() }), request.body);
    await authorizeEncounter(request, encounterId, 'clinical.write');
    return reply.status(201).send(await createNote(db, callerOf(request), { encounterId, ...body }, idempotencyKey(request)));
  });

  app.put('/v1/notes/:noteId', async (request) => {
    const { noteId } = parse(NoteParams, request.params);
    const body = parse(
      z.object({ baseVersion: z.number().int().min(1), data: NoteData.optional(), narrative: z.string().max(20000).optional(), amendmentReason: z.string().max(500).optional() }),
      request.body,
    );
    await authorizeRecord(request, 'note', noteId, 'clinical.write');
    return saveNote(db, callerOf(request), { noteId, ...body });
  });

  app.post('/v1/notes/:noteId/sign', async (request) => {
    const { noteId } = parse(NoteParams, request.params);
    await authorizeRecord(request, 'note', noteId, 'clinical.sign');
    return signNote(db, callerOf(request), { noteId });
  });

  app.post('/v1/notes/:noteId/entered-in-error', async (request) => {
    const { noteId } = parse(NoteParams, request.params);
    const body = parse(z.object({ reason: z.string().trim().min(3).max(500) }), request.body);
    await authorizeRecord(request, 'note', noteId, 'clinical.write');
    return voidNote(db, callerOf(request), { noteId, reason: body.reason });
  });

  // ---- diagnoses, problems, allergies ---------------------------------------------------------------
  app.post('/v1/encounters/:encounterId/diagnoses', async (request, reply) => {
    const { encounterId } = parse(EncounterParams, request.params);
    const body = parse(
      z.object({
        role: z.enum(['admitting', 'provisional', 'primary', 'secondary', 'discharge']),
        rank: z.number().int().min(1).max(50).optional(),
        conditionId: uuid.optional(),
        display: z.string().trim().min(1).max(300).optional(),
        codeSystem: z.enum(['icd10_who', 'snomed_ct', 'local']).optional(),
        code: z.string().max(40).optional(),
        verificationStatus: z.enum(['provisional', 'differential', 'confirmed']).optional(),
        isChronic: z.boolean().optional(),
        onsetOn: isoDate.optional(),
      }),
      request.body,
    );
    await authorizeEncounter(request, encounterId, 'clinical.write');
    return reply.status(201).send(await addDiagnosis(db, callerOf(request), { encounterId, ...body }));
  });

  app.patch('/v1/conditions/:conditionId', async (request) => {
    const { conditionId } = parse(z.object({ conditionId: uuid }), request.params);
    const body = parse(
      z.object({
        clinicalStatus: z.enum(['active', 'recurrence', 'remission', 'resolved']).optional(),
        verificationStatus: z.enum(['provisional', 'differential', 'confirmed', 'refuted', 'entered_in_error']).optional(),
        abatementOn: isoDate.optional(),
      }),
      request.body,
    );
    authorize(principalOf(request), 'clinical.write');
    return updateCondition(db, callerOf(request), { conditionId, ...body });
  });

  app.get('/v1/patients/:patientId/chart', async (request) => {
    const { patientId } = parse(PatientParams, request.params);
    authorize(principalOf(request), 'clinical.read');
    return getPatientChart(db, callerOf(request), patientId);
  });

  app.post('/v1/patients/:patientId/allergies', async (request, reply) => {
    const { patientId } = parse(PatientParams, request.params);
    const body = parse(
      z.object({
        category: z.enum(['drug', 'food', 'environment', 'other']),
        substance: z.string().trim().min(1).max(200),
        reaction: z.string().max(500).optional(),
        severity: z.enum(['mild', 'moderate', 'severe']).optional(),
        criticality: z.enum(['low', 'high', 'unable_to_assess']).optional(),
      }),
      request.body,
    );
    authorize(principalOf(request), 'clinical.write');
    return reply.status(201).send(await recordAllergy(db, callerOf(request), { patientId, ...body }));
  });

  app.patch('/v1/allergies/:allergyId', async (request) => {
    const { allergyId } = parse(z.object({ allergyId: uuid }), request.params);
    const body = parse(z.object({ status: z.enum(['active', 'inactive', 'refuted', 'entered_in_error']) }), request.body);
    authorize(principalOf(request), 'clinical.write');
    return updateAllergyStatus(db, callerOf(request), { allergyId, status: body.status });
  });

  app.post('/v1/patients/:patientId/break-glass', async (request, reply) => {
    const { patientId } = parse(PatientParams, request.params);
    const body = parse(z.object({ reason: z.string().trim().min(10).max(500), hours: z.number().int().min(1).max(24).optional() }), request.body);
    authorize(principalOf(request), 'break_glass.use');
    return reply.status(201).send(await breakGlass(db, callerOf(request), { patientId, ...body }));
  });
}
