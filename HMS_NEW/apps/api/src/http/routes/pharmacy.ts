import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize } from '../../auth/principal.ts';
import { admissionFacility } from '../../modules/inpatient/read.ts';
import { storeFacility } from '../../modules/inventory/read.ts';
import {
  cancelIndent, cancelPrescription, changeOrderLine, controlledRegister, dispense, dispenseLineFacility, dispensingQueue, draftPrescription, encounterFacility,
  encounterPrescriptions, getDispense, getPrescription, indentQueue, listDispenses, marForDay, pharmacyFacility, prescriptionItemFacility, raiseIndent,
  recordAdministration, returnMedication, signPrescription, updateDraftPrescription,
} from '../../modules/pharmacy/index.ts';
import { moduleRoutes } from '../module-routes.ts';
import { callerOf, idempotencyKey, isoDate, optionalIdempotencyKey, parse, principalOf, uuid } from '../support.ts';

const Reason = z.string().trim().min(3).max(500);
const Version = z.number().int().min(1);
const Qty = z.number().positive().max(100_000);
const Limit = z.coerce.number().int().min(1).max(200).default(50);
const Route = z.enum(['oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'sublingual', 'rectal', 'ophthalmic', 'otic', 'nasal', 'vaginal', 'other']);

const Line = z.object({
  itemId: uuid, dose: z.number().positive().max(100_000), doseUnit: z.string().trim().min(1).max(20), route: Route.optional(),
  frequencyCode: z.enum(['OD', 'BD', 'TDS', 'QID', 'HS', 'SOS', 'STAT', 'Q4H', 'Q6H', 'Q8H', 'WEEKLY', 'CUSTOM']), frequencyText: z.string().trim().max(200).optional(),
  durationValue: z.number().int().min(1).max(365).optional(), durationUnit: z.enum(['days', 'weeks', 'months', 'doses']).optional(), quantity: Qty.optional(),
  isPrn: z.boolean().optional(), prnMinIntervalMinutes: z.number().int().min(15).max(10080).optional(),
  foodRelation: z.enum(['before_food', 'after_food', 'with_food', 'empty_stomach', 'any']).optional(), instructions: z.string().trim().max(1000).optional(),
  substitutionAllowed: z.boolean().optional(),
});

export function registerPharmacyRoutes(app: FastifyInstance, db: Kysely<DB>) {
  const scoped = async (request: FastifyRequest, lookup: Promise<string | undefined>, what: string, permission: string) => {
    const facilityId = await lookup;
    if (!facilityId) throw new DomainError('not_found', `${what} not found`);
    authorize(principalOf(request), permission, facilityId);
    return facilityId;
  };

  moduleRoutes(app, db, 'pharmacy', (r) => {
    // ---- prescriptions ---------------------------------------------------------------------------------
    r.get('/v1/encounters/:encounterId/prescriptions', async (request) => {
      const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
      await scoped(request, encounterFacility(db, callerOf(request), encounterId), 'encounter', 'prescriptions.read');
      return { items: await encounterPrescriptions(db, callerOf(request), encounterId) };
    });
    r.post('/v1/encounters/:encounterId/prescriptions', async (request, reply) => {
      const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
      const body = parse(z.object({ discharge: z.boolean().optional(), advice: z.string().trim().max(4000).optional(), lines: z.array(Line).min(1).max(30) }), request.body);
      await scoped(request, encounterFacility(db, callerOf(request), encounterId), 'encounter', 'prescriptions.write');
      return reply.status(201).send(await draftPrescription(db, callerOf(request), { encounterId, ...body }, idempotencyKey(request)));
    });
    r.get('/v1/prescriptions/:prescriptionId', async (request) => {
      const { prescriptionId } = parse(z.object({ prescriptionId: uuid }), request.params);
      await scoped(request, pharmacyFacility(db, callerOf(request), 'pharmacy.prescription', prescriptionId), 'prescription', 'prescriptions.read');
      return getPrescription(db, callerOf(request), prescriptionId);
    });
    r.put('/v1/prescriptions/:prescriptionId', async (request) => {
      const { prescriptionId } = parse(z.object({ prescriptionId: uuid }), request.params);
      const body = parse(z.object({ version: Version, advice: z.string().trim().max(4000).optional(), lines: z.array(Line).min(1).max(30) }), request.body);
      await scoped(request, pharmacyFacility(db, callerOf(request), 'pharmacy.prescription', prescriptionId), 'prescription', 'prescriptions.write');
      return updateDraftPrescription(db, callerOf(request), { prescriptionId, ...body }, optionalIdempotencyKey(request));
    });
    r.post('/v1/prescriptions/:prescriptionId/sign', async (request) => {
      const { prescriptionId } = parse(z.object({ prescriptionId: uuid }), request.params);
      const body = parse(z.object({ version: Version, overrideReason: Reason.optional(), validDays: z.number().int().min(1).max(180).optional() }), request.body);
      await scoped(request, pharmacyFacility(db, callerOf(request), 'pharmacy.prescription', prescriptionId), 'prescription', 'prescriptions.write');
      return signPrescription(db, callerOf(request), { prescriptionId, ...body }, optionalIdempotencyKey(request));
    });
    r.post('/v1/prescriptions/:prescriptionId/cancel', async (request) => {
      const { prescriptionId } = parse(z.object({ prescriptionId: uuid }), request.params);
      const body = parse(z.object({ reason: Reason, version: Version }), request.body);
      await scoped(request, pharmacyFacility(db, callerOf(request), 'pharmacy.prescription', prescriptionId), 'prescription', 'prescriptions.write');
      return cancelPrescription(db, callerOf(request), { prescriptionId, ...body }, optionalIdempotencyKey(request));
    });
    r.post('/v1/prescription-items/:prescriptionItemId/:action', async (request) => {
      const p = parse(z.object({ prescriptionItemId: uuid, action: z.enum(['hold', 'resume', 'stop']) }), request.params);
      const body = parse(z.object({ reason: Reason.optional(), version: Version }), request.body);
      await scoped(request, prescriptionItemFacility(db, callerOf(request), p.prescriptionItemId), 'prescription line', 'prescriptions.write');
      return changeOrderLine(db, callerOf(request), { ...p, ...body }, optionalIdempotencyKey(request));
    });

    // ---- dispensing and counter sales -------------------------------------------------------------------
    r.get('/v1/pharmacy/queue', async (request) => {
      const q = parse(z.object({ facilityId: uuid, limit: Limit }), request.query);
      authorize(principalOf(request), 'pharmacy.read', q.facilityId);
      return { items: await dispensingQueue(db, callerOf(request), q) };
    });
    r.get('/v1/pharmacy/dispenses', async (request) => {
      const q = parse(z.object({ facilityId: uuid, type: z.enum(['prescription', 'ipd_indent', 'otc']).optional(), patientId: uuid.optional(), date: isoDate.optional(), limit: Limit }), request.query);
      authorize(principalOf(request), 'pharmacy.read', q.facilityId);
      return { items: await listDispenses(db, callerOf(request), q) };
    });
    r.get('/v1/pharmacy/dispenses/:dispenseId', async (request) => {
      const { dispenseId } = parse(z.object({ dispenseId: uuid }), request.params);
      await scoped(request, pharmacyFacility(db, callerOf(request), 'pharmacy.dispense', dispenseId), 'dispense', 'pharmacy.read');
      return getDispense(db, callerOf(request), dispenseId);
    });
    r.post('/v1/pharmacy/dispenses', async (request, reply) => {
      const body = parse(z.object({
        storeId: uuid, prescriptionId: uuid.optional(), indentId: uuid.optional(),
        otc: z.object({ patientId: uuid.optional(), buyerName: z.string().trim().min(1).max(200).optional(), buyerPhone: z.string().trim().min(6).max(20).optional() }).optional(),
        handedOverTo: z.string().trim().max(200).optional(),
        lines: z.array(z.object({ prescriptionItemId: uuid.optional(), indentLineId: uuid.optional(), itemId: uuid.optional(), quantity: Qty, itemBatchId: uuid.optional() })).min(1).max(50),
      }), request.body);
      await scoped(request, storeFacility(db, callerOf(request), body.storeId), 'store', body.otc ? 'pharmacy.sell' : 'pharmacy.dispense');
      return reply.status(201).send(await dispense(db, callerOf(request), body, idempotencyKey(request)));
    });
    r.post('/v1/pharmacy/returns', async (request, reply) => {
      const body = parse(z.object({ dispenseLineId: uuid, quantity: Qty, reason: Reason, restockable: z.boolean() }), request.body);
      await scoped(request, dispenseLineFacility(db, callerOf(request), body.dispenseLineId), 'dispense line', 'pharmacy.dispense');
      return reply.status(201).send(await returnMedication(db, callerOf(request), body, idempotencyKey(request)));
    });
    r.get('/v1/pharmacy/registers/controlled', async (request) => {
      const q = parse(z.object({ facilityId: uuid, from: isoDate, to: isoDate }), request.query);
      authorize(principalOf(request), 'pharmacy.registers', q.facilityId);
      return { items: await controlledRegister(db, callerOf(request), q) };
    });

    // ---- ward indents and MAR (admitted patients) -------------------------------------------------------
    r.get('/v1/pharmacy/indents', async (request) => {
      const q = parse(z.object({ facilityId: uuid, admissionId: uuid.optional(), open: z.enum(['true', 'false']).default('true'), limit: Limit }), request.query);
      authorize(principalOf(request), 'pharmacy.read', q.facilityId);
      return { items: await indentQueue(db, callerOf(request), { ...q, open: q.open === 'true' }) };
    });
    r.post('/v1/admissions/:admissionId/indents', async (request, reply) => {
      const { admissionId } = parse(z.object({ admissionId: uuid }), request.params);
      const body = parse(z.object({
        storeId: uuid.optional(), notes: z.string().trim().max(1000).optional(),
        lines: z.array(z.object({ prescriptionItemId: uuid.optional(), itemId: uuid.optional(), quantity: Qty })).min(1).max(50),
      }), request.body);
      await scoped(request, admissionFacility(db, callerOf(request), admissionId), 'admission', 'pharmacy.indent');
      return reply.status(201).send(await raiseIndent(db, callerOf(request), { admissionId, ...body }, idempotencyKey(request)));
    });
    r.post('/v1/pharmacy/indents/:indentId/cancel', async (request) => {
      const { indentId } = parse(z.object({ indentId: uuid }), request.params);
      const body = parse(z.object({ reason: Reason, version: Version }), request.body);
      await scoped(request, pharmacyFacility(db, callerOf(request), 'pharmacy.patient_indent', indentId), 'indent', 'pharmacy.indent');
      return cancelIndent(db, callerOf(request), { indentId, ...body }, optionalIdempotencyKey(request));
    });
    r.get('/v1/admissions/:admissionId/mar', async (request) => {
      const { admissionId } = parse(z.object({ admissionId: uuid }), request.params);
      const { date } = parse(z.object({ date: isoDate }), request.query);
      await scoped(request, admissionFacility(db, callerOf(request), admissionId), 'admission', 'prescriptions.read');
      return marForDay(db, callerOf(request), { admissionId, date });
    });
    r.post('/v1/admissions/:admissionId/mar', async (request, reply) => {
      const { admissionId } = parse(z.object({ admissionId: uuid }), request.params);
      const body = parse(z.object({
        prescriptionItemId: uuid, status: z.enum(['given', 'not_given', 'held', 'refused', 'self_administered']),
        scheduledAt: z.iso.datetime({ offset: true }).optional(), administeredAt: z.iso.datetime({ offset: true }).optional(),
        doseGiven: z.number().positive().max(100_000).optional(), doseUnit: z.string().trim().min(1).max(20).optional(), route: Route.optional(),
        site: z.string().trim().max(100).optional(), reason: z.string().trim().max(500).optional(), prnReason: z.string().trim().max(500).optional(),
        witnessStaffId: uuid.optional(), dispenseLineId: uuid.optional(),
      }), request.body);
      await scoped(request, admissionFacility(db, callerOf(request), admissionId), 'admission', 'medication.administer');
      return reply.status(201).send(await recordAdministration(db, callerOf(request), { admissionId, ...body }, idempotencyKey(request)));
    });
  });
}
