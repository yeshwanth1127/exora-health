// Prescriptions, pharmacy and the MAR over HTTP (ERD m09). Permissions are checked at the clinic of the
// encounter / prescription / indent / dispense; clinician commands then check the care relationship.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize, forbidden, type Principal } from '../../auth/principal.ts';
import {
  cancelPatientIndent,
  cancelPrescription,
  changePrescriptionItem,
  controlledDrugRegister,
  createPatientIndent,
  createPrescription,
  dispense,
  encounterPrescriptions,
  handOverDispense,
  listDispenses,
  listWitnesses,
  locate,
  medicationChart,
  pharmacyQueue,
  pharmacyView,
  recordAdministration,
  returnMedication,
  searchDrugs,
  signPrescription,
  verifyPrescription,
  type Kind,
} from '../../modules/pharmacy/index.ts';
import { callerOf, idempotencyKey, isoDate, parse, principalOf, uuid } from '../support.ts';

const missing = (what: string) => new DomainError('not_found', `${what} not found`);
const Reason = z.string().trim().min(3).max(500);
const When = z.iso.datetime({ offset: true });
const Qty = z.number().positive().max(100_000);
const Route = z.enum(['oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'sublingual', 'rectal', 'ophthalmic', 'otic', 'nasal', 'vaginal', 'other']);
const Line = z.object({
  itemId: uuid,
  dose: z.number().positive().max(100_000),
  doseUnit: z.string().trim().min(1).max(20),
  route: Route.optional(),
  frequencyCode: z.enum(['OD', 'BD', 'TDS', 'QID', 'HS', 'SOS', 'STAT', 'Q4H', 'Q6H', 'Q8H', 'WEEKLY', 'CUSTOM']),
  frequencyText: z.string().trim().max(200).optional(),
  durationValue: z.number().int().positive().max(3650).optional(),
  durationUnit: z.enum(['days', 'weeks', 'months', 'doses']).optional(),
  quantity: Qty.optional(),
  isPrn: z.boolean().optional(),
  prnMinIntervalMinutes: z.number().int().min(15).max(10080).optional(),
  foodRelation: z.enum(['before_food', 'after_food', 'with_food', 'empty_stomach', 'any']).optional(),
  instructions: z.string().trim().max(1000).optional(),
  substitutionAllowed: z.boolean().optional(),
  startAt: When.optional(),
});

function authorizeOneOf(principal: Principal, permissions: string[], facilityId: string) {
  for (const p of permissions) {
    try {
      authorize(principal, p, facilityId);
      return;
    } catch {
      /* try the next one */
    }
  }
  throw forbidden(`missing permission ${permissions.join(' or ')} for this facility`, { permission: permissions[0], facilityId });
}

export function registerPharmacyRoutes(app: FastifyInstance, db: Kysely<DB>) {
  async function at(request: FastifyRequest, kind: Kind, id: string, permission: string | string[]) {
    const where = await locate(db, callerOf(request), kind, id);
    if (!where) throw missing(kind.replace('_', ' '));
    authorizeOneOf(principalOf(request), Array.isArray(permission) ? permission : [permission], where.facilityId);
    return where;
  }

  // ---- prescribing --------------------------------------------------------------------------------------
  app.get('/v1/pharmacy/drugs', async (request) => {
    const q = parse(z.object({ q: z.string().trim().max(100).optional(), limit: z.coerce.number().int().min(1).max(50).optional() }), request.query);
    authorize(principalOf(request), 'prescriptions.read');
    return { items: await searchDrugs(db, callerOf(request), q) };
  });

  app.post('/v1/encounters/:encounterId/prescriptions', async (request, reply) => {
    const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
    const body = parse(
      z.object({
        setting: z.enum(['outpatient', 'inpatient', 'discharge', 'virtual']).optional(),
        advice: z.string().trim().max(4000).optional(),
        validUntil: isoDate.optional(),
        items: z.array(Line).min(1).max(30),
      }),
      request.body,
    );
    await at(request, 'encounter', encounterId, 'prescriptions.write');
    return reply.code(201).send(await createPrescription(db, callerOf(request), { encounterId, ...body }, idempotencyKey(request)));
  });

  app.get('/v1/encounters/:encounterId/prescriptions', async (request) => {
    const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
    await at(request, 'encounter', encounterId, 'prescriptions.read');
    return encounterPrescriptions(db, callerOf(request), encounterId);
  });

  app.post('/v1/prescriptions/:prescriptionId/sign', async (request) => {
    const { prescriptionId } = parse(z.object({ prescriptionId: uuid }), request.params);
    const body = parse(z.object({ overrides: z.record(z.string().regex(/^\d{1,2}$/), Reason).optional() }), request.body ?? {});
    await at(request, 'prescription', prescriptionId, 'prescriptions.write');
    return signPrescription(db, callerOf(request), { prescriptionId, ...body });
  });

  app.post('/v1/prescriptions/:prescriptionId/cancel', async (request) => {
    const { prescriptionId } = parse(z.object({ prescriptionId: uuid }), request.params);
    const body = parse(z.object({ reason: Reason }), request.body);
    await at(request, 'prescription', prescriptionId, 'prescriptions.write');
    return cancelPrescription(db, callerOf(request), { prescriptionId, ...body });
  });

  for (const action of ['stop', 'hold', 'resume'] as const) {
    app.post(`/v1/prescription-items/:prescriptionItemId/${action}`, async (request) => {
      const { prescriptionItemId } = parse(z.object({ prescriptionItemId: uuid }), request.params);
      const body = parse(z.object({ reason: Reason.optional() }), request.body ?? {});
      await at(request, 'prescription_item', prescriptionItemId, 'prescriptions.write');
      return changePrescriptionItem(db, callerOf(request), { prescriptionItemId, action, ...body });
    });
  }

  // ---- pharmacist ---------------------------------------------------------------------------------------
  app.post('/v1/prescriptions/:prescriptionId/verify', async (request) => {
    const { prescriptionId } = parse(z.object({ prescriptionId: uuid }), request.params);
    const body = parse(z.object({ outcome: z.enum(['approved', 'rejected', 'query']), notes: z.string().trim().max(2000).optional() }), request.body);
    await at(request, 'prescription', prescriptionId, 'pharmacy.verify');
    return verifyPrescription(db, callerOf(request), { prescriptionId, ...body });
  });

  app.get('/v1/pharmacy/queue', async (request) => {
    const q = parse(z.object({ facilityId: uuid, stage: z.enum(['verify', 'dispense', 'indents']) }), request.query);
    authorize(principalOf(request), q.stage === 'verify' ? 'pharmacy.verify' : 'pharmacy.dispense', q.facilityId);
    return { items: await pharmacyQueue(db, callerOf(request), q) };
  });

  app.get('/v1/prescriptions/:prescriptionId/dispensing', async (request) => {
    const { prescriptionId } = parse(z.object({ prescriptionId: uuid }), request.params);
    const q = parse(z.object({ storeId: uuid.optional() }), request.query);
    await at(request, 'prescription', prescriptionId, ['pharmacy.verify', 'pharmacy.dispense']);
    return pharmacyView(db, callerOf(request), { prescriptionId, storeId: q.storeId });
  });

  app.get('/v1/patient-indents/:patientIndentId/dispensing', async (request) => {
    const { patientIndentId } = parse(z.object({ patientIndentId: uuid }), request.params);
    const q = parse(z.object({ storeId: uuid.optional() }), request.query);
    await at(request, 'patient_indent', patientIndentId, 'pharmacy.dispense');
    return pharmacyView(db, callerOf(request), { patientIndentId, storeId: q.storeId });
  });

  app.post('/v1/dispenses', async (request, reply) => {
    const body = parse(
      z.object({
        prescriptionId: uuid.optional(),
        patientIndentId: uuid.optional(),
        storeId: uuid,
        handedOverTo: z.string().trim().min(2).max(200).optional(),
        lines: z
          .array(z.object({ prescriptionItemId: uuid.optional(), patientIndentLineId: uuid.optional(), quantity: Qty, itemBatchId: uuid.optional(), substituteItemId: uuid.optional(), unitPriceMinor: z.number().int().min(0).optional() }))
          .min(1)
          .max(50),
      }),
      request.body,
    );
    if (body.prescriptionId) await at(request, 'prescription', body.prescriptionId, 'pharmacy.dispense');
    else if (body.patientIndentId) await at(request, 'patient_indent', body.patientIndentId, 'pharmacy.dispense');
    else throw new DomainError('validation', 'dispense either a prescription or a patient indent', { reason: 'one_source' });
    return reply.code(201).send(await dispense(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.get('/v1/dispenses', async (request) => {
    const q = parse(z.object({ facilityId: uuid, days: z.coerce.number().int().min(1).max(90).optional() }), request.query);
    authorize(principalOf(request), 'pharmacy.dispense', q.facilityId);
    return { items: await listDispenses(db, callerOf(request), q) };
  });

  app.post('/v1/dispenses/:dispenseId/hand-over', async (request) => {
    const { dispenseId } = parse(z.object({ dispenseId: uuid }), request.params);
    const body = parse(z.object({ handedOverTo: z.string().trim().min(2).max(200) }), request.body);
    await at(request, 'dispense', dispenseId, 'pharmacy.dispense');
    return handOverDispense(db, callerOf(request), { dispenseId, ...body });
  });

  app.post('/v1/dispense-lines/:dispenseLineId/returns', async (request, reply) => {
    const { dispenseLineId } = parse(z.object({ dispenseLineId: uuid }), request.params);
    const body = parse(z.object({ quantity: Qty, reason: Reason, isRestockable: z.boolean() }), request.body);
    await at(request, 'dispense_line', dispenseLineId, 'pharmacy.dispense');
    return reply.code(201).send(await returnMedication(db, callerOf(request), { dispenseLineId, ...body }, idempotencyKey(request)));
  });

  app.get('/v1/pharmacy/register', async (request) => {
    const q = parse(z.object({ facilityId: uuid, from: isoDate, to: isoDate }).refine((v) => v.from <= v.to, 'from must not be after to'), request.query);
    authorize(principalOf(request), 'pharmacy.registers', q.facilityId);
    return { items: await controlledDrugRegister(db, callerOf(request), q) };
  });

  // ---- wards: patient indents and the MAR -----------------------------------------------------------------
  app.post('/v1/encounters/:encounterId/patient-indents', async (request, reply) => {
    const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
    const body = parse(
      z.object({
        pharmacyStoreId: uuid,
        wardStoreId: uuid.optional(),
        notes: z.string().trim().max(1000).optional(),
        lines: z.array(z.object({ prescriptionItemId: uuid.optional(), itemId: uuid.optional(), quantity: Qty })).min(1).max(30),
      }),
      request.body,
    );
    await at(request, 'encounter', encounterId, 'pharmacy.indent');
    return reply.code(201).send(await createPatientIndent(db, callerOf(request), { encounterId, ...body }, idempotencyKey(request)));
  });

  app.post('/v1/patient-indents/:patientIndentId/cancel', async (request) => {
    const { patientIndentId } = parse(z.object({ patientIndentId: uuid }), request.params);
    const body = parse(z.object({ reason: Reason }), request.body);
    await at(request, 'patient_indent', patientIndentId, ['pharmacy.indent', 'pharmacy.dispense']);
    return cancelPatientIndent(db, callerOf(request), { patientIndentId, ...body });
  });

  app.get('/v1/pharmacy/witnesses', async (request) => {
    const q = parse(z.object({ facilityId: uuid }), request.query);
    authorize(principalOf(request), 'medication.administer', q.facilityId);
    return { items: await listWitnesses(db, callerOf(request), q.facilityId) };
  });

  app.get('/v1/encounters/:encounterId/mar', async (request) => {
    const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
    await at(request, 'encounter', encounterId, 'prescriptions.read');
    return medicationChart(db, callerOf(request), encounterId);
  });

  app.post('/v1/prescription-items/:prescriptionItemId/administrations', async (request, reply) => {
    const { prescriptionItemId } = parse(z.object({ prescriptionItemId: uuid }), request.params);
    const body = parse(
      z.object({
        status: z.enum(['given', 'not_given', 'held', 'refused', 'self_administered']),
        scheduledAt: When.optional(),
        administeredAt: When.optional(),
        doseGiven: z.number().positive().max(100_000).optional(),
        doseUnit: z.string().trim().min(1).max(20).optional(),
        route: Route.optional(),
        site: z.string().trim().max(100).optional(),
        reason: z.string().trim().max(500).optional(),
        prnReason: z.string().trim().max(500).optional(),
        witnessStaffId: uuid.optional(),
        dispenseLineId: uuid.optional(),
      }),
      request.body,
    );
    await at(request, 'prescription_item', prescriptionItemId, 'medication.administer');
    return reply.code(201).send(await recordAdministration(db, callerOf(request), { prescriptionItemId, ...body }, idempotencyKey(request)));
  });
}
