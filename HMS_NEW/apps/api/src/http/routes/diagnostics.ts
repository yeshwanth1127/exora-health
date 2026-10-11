// Orders, laboratory and imaging over HTTP (ERD m06). Permissions are checked at the clinic of the
// encounter / order / specimen / study; the commands then check the care relationship where a clinician
// acts on a patient (ordering, cancelling, reading results, acknowledging).
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize, authorizeEvery, forbidden, type Principal } from '../../auth/principal.ts';
import {
  acknowledgeReport,
  addIsolate,
  addSusceptibility,
  amendReport,
  cancelOrderItem,
  cancelReport,
  collectSpecimen,
  correctResult,
  createOrderSet,
  departmentFacility,
  encounterFacilityOf,
  enterResults,
  getEncounterOrders,
  getLabItem,
  getPatientResults,
  imagingWorklist,
  labWorklist,
  listFormF,
  listOrderables,
  listOrderSets,
  locate,
  orderItemFacilities,
  orderSetScope,
  placeOrder,
  receiveSpecimen,
  recordCriticalAlert,
  rejectSpecimen,
  releaseReport,
  saveFormF,
  saveReportDraft,
  setStudyStatus,
  submitFormF,
  unacknowledgedResults,
  updateOrderSet,
} from '../../modules/diagnostics/index.ts';
import { callerOf, idempotencyKey, optionalIdempotencyKey, parse, principalOf, uuid } from '../support.ts';

const missing = (what: string) => new DomainError('not_found', `${what} not found`);
const Reason = z.string().trim().min(3).max(500);
const When = z.iso.datetime({ offset: true });
const Version = z.number().int().min(1);
const Priority = z.enum(['routine', 'urgent', 'stat']);
const Details = z.record(z.string(), z.unknown()).refine((d) => JSON.stringify(d).length <= 4000, 'details are too large');
const Month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'expected YYYY-MM');
const ReportText = { conclusion: z.string().trim().max(4000).optional(), findings: z.string().trim().max(20000).optional(), impression: z.string().trim().max(4000).optional(), comment: z.string().trim().max(4000).optional() };
const Value = { valueNum: z.number().finite().optional(), valueText: z.string().trim().max(2000).optional(), valueOptionId: uuid.optional() };
const SetItems = z.array(z.object({ serviceItemId: uuid, priority: Priority.optional(), details: Details.optional() })).max(50);

/** The principal must hold at least one of the permissions at the facility. */
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

export function registerDiagnosticsRoutes(app: FastifyInstance, db: Kysely<DB>) {
  type Kind = Parameters<typeof locate>[2];
  async function at(request: FastifyRequest, kind: Kind, id: string) {
    const where = await locate(db, callerOf(request), kind, id);
    if (!where) throw missing(kind.replace('_', ' '));
    return where;
  }
  async function atEncounter(request: FastifyRequest, encounterId: string, permission: string) {
    const facilityId = await encounterFacilityOf(db, callerOf(request), encounterId);
    if (!facilityId) throw missing('encounter');
    authorize(principalOf(request), permission, facilityId);
  }
  /** Lab reports are signed by lab.verify holders; imaging reports by imaging.report holders. */
  const reportPermission = (type: string | null | undefined, step: 'draft' | 'sign') => (type === 'imaging' ? 'imaging.report' : step === 'draft' ? 'lab.process' : 'lab.verify');
  async function atOrderSet(request: FastifyRequest, orderSetId: string) {
    const scope = await orderSetScope(db, callerOf(request), orderSetId);
    if (!scope) throw missing('order set');
    // Department sets are managed by clinic leads; personal sets by their owner (checked by the command).
    if (scope.facilityId) authorize(principalOf(request), 'order_sets.manage', scope.facilityId);
    else authorize(principalOf(request), 'orders.place');
  }

  // ---- catalogue and order sets -----------------------------------------------------------------------
  app.get('/v1/orderables', async (request) => {
    const q = parse(z.object({ facilityId: uuid, q: z.string().trim().max(100).optional(), category: z.enum(['lab_test', 'lab_panel', 'imaging', 'procedure', 'nursing', 'diet', 'physiotherapy', 'referral', 'equipment', 'misc']).optional() }), request.query);
    authorize(principalOf(request), 'orders.place', q.facilityId);
    return { items: await listOrderables(db, callerOf(request), q) };
  });

  app.get('/v1/order-sets', async (request) => {
    const q = parse(z.object({ facilityId: uuid }), request.query);
    authorize(principalOf(request), 'orders.place', q.facilityId);
    return { items: await listOrderSets(db, callerOf(request), q) };
  });

  app.post('/v1/order-sets', async (request, reply) => {
    const body = parse(z.object({ name: z.string().trim().min(2).max(120), departmentId: uuid.nullable().optional(), items: SetItems.min(1) }), request.body);
    if (body.departmentId) {
      const facilityId = await departmentFacility(db, callerOf(request), body.departmentId);
      if (!facilityId) throw missing('department');
      authorize(principalOf(request), 'order_sets.manage', facilityId);
    } else authorize(principalOf(request), 'orders.place');
    return reply.status(201).send(await createOrderSet(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.patch('/v1/order-sets/:orderSetId', async (request) => {
    const { orderSetId } = parse(z.object({ orderSetId: uuid }), request.params);
    const body = parse(z.object({ version: Version, name: z.string().trim().min(2).max(120).optional(), items: SetItems.optional() }), request.body);
    await atOrderSet(request, orderSetId);
    return updateOrderSet(db, callerOf(request), { orderSetId, ...body });
  });

  app.post('/v1/order-sets/:orderSetId/retire', async (request) => {
    const { orderSetId } = parse(z.object({ orderSetId: uuid }), request.params);
    const body = parse(z.object({ version: Version }), request.body);
    await atOrderSet(request, orderSetId);
    return updateOrderSet(db, callerOf(request), { orderSetId, version: body.version, retire: true });
  });

  // ---- orders -----------------------------------------------------------------------------------------
  app.post('/v1/encounters/:encounterId/orders', async (request, reply) => {
    const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
    const body = parse(
      z.object({
        priority: Priority.optional(),
        clinicalIndication: z.string().trim().max(1000).optional(),
        orderSetId: uuid.optional(),
        items: z
          .array(z.object({ serviceItemId: uuid, quantity: z.number().positive().max(1000).optional(), details: Details.optional(), scheduledAt: When.optional(), targetStaffId: uuid.optional() }))
          .max(50)
          .optional(),
      }),
      request.body,
    );
    await atEncounter(request, encounterId, 'orders.place');
    return reply.status(201).send(await placeOrder(db, callerOf(request), { encounterId, ...body }, idempotencyKey(request)));
  });

  app.get('/v1/encounters/:encounterId/orders', async (request) => {
    const { encounterId } = parse(z.object({ encounterId: uuid }), request.params);
    await atEncounter(request, encounterId, 'results.read');
    return getEncounterOrders(db, callerOf(request), encounterId);
  });

  app.post('/v1/order-items/:orderItemId/cancel', async (request) => {
    const { orderItemId } = parse(z.object({ orderItemId: uuid }), request.params);
    const { reason } = parse(z.object({ reason: Reason }), request.body);
    authorize(principalOf(request), 'orders.cancel', (await at(request, 'order_item', orderItemId)).facilityId);
    return cancelOrderItem(db, callerOf(request), { orderItemId, reason });
  });

  // ---- specimens --------------------------------------------------------------------------------------
  const SpecimenFields = {
    specimenType: z.enum(['whole_blood', 'serum', 'plasma', 'urine', 'stool', 'csf', 'sputum', 'swab', 'tissue', 'fluid', 'other']).optional(),
    containerType: z.enum(['edta', 'plain', 'sst', 'fluoride', 'citrate', 'heparin', 'sterile', 'other']).optional(),
    collectionSite: z.string().trim().max(100).optional(),
    collectedAt: When.optional(),
    barcode: z.string().trim().regex(/^[A-Za-z0-9-]{4,40}$/, 'letters, digits and dashes (4–40)').optional(),
  };

  app.post('/v1/specimens', async (request, reply) => {
    const body = parse(z.object({ orderItemIds: z.array(uuid).min(1).max(30), ...SpecimenFields }), request.body);
    const facilities = await orderItemFacilities(db, callerOf(request), body.orderItemIds);
    if (!facilities.length) throw missing('order item');
    authorizeEvery(principalOf(request), 'lab.collect', facilities);
    return reply.status(201).send(await collectSpecimen(db, callerOf(request), body, optionalIdempotencyKey(request)));
  });

  app.post('/v1/specimens/:specimenId/recollect', async (request, reply) => {
    const { specimenId } = parse(z.object({ specimenId: uuid }), request.params);
    const body = parse(z.object(SpecimenFields), request.body ?? {});
    authorize(principalOf(request), 'lab.collect', (await at(request, 'specimen', specimenId)).facilityId);
    return reply.status(201).send(await collectSpecimen(db, callerOf(request), { ...body, recollectionOfId: specimenId }, optionalIdempotencyKey(request)));
  });

  app.post('/v1/specimens/:specimenId/receive', async (request) => {
    const { specimenId } = parse(z.object({ specimenId: uuid }), request.params);
    authorize(principalOf(request), 'lab.process', (await at(request, 'specimen', specimenId)).facilityId);
    return receiveSpecimen(db, callerOf(request), { specimenId });
  });

  app.post('/v1/specimens/:specimenId/reject', async (request) => {
    const { specimenId } = parse(z.object({ specimenId: uuid }), request.params);
    const body = parse(z.object({ reason: z.enum(['haemolysed', 'clotted', 'insufficient', 'mislabelled', 'wrong_container', 'delayed', 'other']), note: z.string().trim().max(500).optional() }), request.body);
    authorize(principalOf(request), 'lab.process', (await at(request, 'specimen', specimenId)).facilityId);
    return rejectSpecimen(db, callerOf(request), { specimenId, ...body });
  });

  // ---- lab worklists, entry and verification ------------------------------------------------------------
  app.get('/v1/lab/worklist', async (request) => {
    const q = parse(z.object({ facilityId: uuid, stage: z.enum(['collect', 'receive', 'result', 'verify']) }), request.query);
    authorize(principalOf(request), { collect: 'lab.collect', receive: 'lab.process', result: 'lab.process', verify: 'lab.verify' }[q.stage], q.facilityId);
    return { items: await labWorklist(db, callerOf(request), q) };
  });

  app.get('/v1/order-items/:orderItemId/lab', async (request) => {
    const { orderItemId } = parse(z.object({ orderItemId: uuid }), request.params);
    authorizeOneOf(principalOf(request), ['lab.process', 'lab.verify'], (await at(request, 'order_item', orderItemId)).facilityId);
    return getLabItem(db, callerOf(request), orderItemId);
  });

  app.post('/v1/order-items/:orderItemId/results', async (request, reply) => {
    const { orderItemId } = parse(z.object({ orderItemId: uuid }), request.params);
    const body = parse(
      z.object({
        values: z.array(z.object({ observationDefinitionId: uuid, ...Value, specimenId: uuid.optional(), comment: z.string().trim().max(500).optional() })).min(1).max(100),
        source: z.enum(['manual', 'instrument']).optional(),
      }),
      request.body,
    );
    authorize(principalOf(request), 'lab.process', (await at(request, 'order_item', orderItemId)).facilityId);
    return reply.status(201).send(await enterResults(db, callerOf(request), { orderItemId, ...body }));
  });

  app.post('/v1/result-items/:resultItemId/correct', async (request, reply) => {
    const { resultItemId } = parse(z.object({ resultItemId: uuid }), request.params);
    const body = parse(z.object({ ...Value, reason: Reason, comment: z.string().trim().max(500).optional() }), request.body);
    authorize(principalOf(request), 'lab.process', (await at(request, 'result_item', resultItemId)).facilityId);
    return reply.status(201).send(await correctResult(db, callerOf(request), { resultItemId, ...body }));
  });

  app.post('/v1/result-items/:resultItemId/critical-alerts', async (request, reply) => {
    const { resultItemId } = parse(z.object({ resultItemId: uuid }), request.params);
    const body = parse(
      z.object({
        notifiedToStaffId: uuid.optional(),
        notifiedToName: z.string().trim().min(2).max(100).optional(),
        channel: z.enum(['phone', 'in_person', 'app']),
        readBackConfirmed: z.boolean(),
        notifiedAt: When.optional(),
        note: z.string().trim().max(500).optional(),
      }),
      request.body,
    );
    authorizeOneOf(principalOf(request), ['lab.process', 'lab.verify'], (await at(request, 'result_item', resultItemId)).facilityId);
    return reply.status(201).send(await recordCriticalAlert(db, callerOf(request), { resultItemId, ...body }));
  });

  app.post('/v1/order-items/:orderItemId/isolates', async (request, reply) => {
    const { orderItemId } = parse(z.object({ orderItemId: uuid }), request.params);
    const body = parse(z.object({ organismName: z.string().trim().min(2).max(200), organismConceptId: uuid.optional(), colonyCount: z.string().trim().max(60).optional(), comment: z.string().trim().max(500).optional() }), request.body);
    authorize(principalOf(request), 'lab.process', (await at(request, 'order_item', orderItemId)).facilityId);
    return reply.status(201).send(await addIsolate(db, callerOf(request), { orderItemId, ...body }));
  });

  app.post('/v1/micro-isolates/:isolateId/susceptibilities', async (request, reply) => {
    const { isolateId } = parse(z.object({ isolateId: uuid }), request.params);
    const body = parse(
      z.object({
        antibioticName: z.string().trim().min(2).max(120),
        antibioticItemId: uuid.optional(),
        method: z.enum(['disc', 'mic']),
        micValue: z.number().positive().max(10000).optional(),
        zoneMm: z.number().min(0).max(100).optional(),
        interpretation: z.enum(['S', 'I', 'R']),
      }),
      request.body,
    );
    authorize(principalOf(request), 'lab.process', (await at(request, 'micro_isolate', isolateId)).facilityId);
    return reply.status(201).send(await addSusceptibility(db, callerOf(request), { isolateId, ...body }));
  });

  // ---- reports ------------------------------------------------------------------------------------------
  app.post('/v1/order-items/:orderItemId/report', async (request) => {
    const { orderItemId } = parse(z.object({ orderItemId: uuid }), request.params);
    const body = parse(z.object({ ...ReportText, version: Version.optional() }), request.body ?? {});
    const where = await at(request, 'order_item', orderItemId);
    authorize(principalOf(request), reportPermission(where.category === 'imaging' ? 'imaging' : 'lab', 'draft'), where.facilityId);
    return saveReportDraft(db, callerOf(request), { orderItemId, ...body });
  });

  app.post('/v1/diagnostic-reports/:reportId/release', async (request) => {
    const { reportId } = parse(z.object({ reportId: uuid }), request.params);
    const body = parse(z.object({ ...ReportText, version: Version }), request.body);
    const where = await at(request, 'diagnostic_report', reportId);
    authorize(principalOf(request), reportPermission(where.reportType, 'sign'), where.facilityId);
    return releaseReport(db, callerOf(request), { reportId, ...body });
  });

  app.post('/v1/diagnostic-reports/:reportId/amend', async (request) => {
    const { reportId } = parse(z.object({ reportId: uuid }), request.params);
    const body = parse(z.object({ ...ReportText, version: Version, reason: Reason }), request.body);
    const where = await at(request, 'diagnostic_report', reportId);
    authorize(principalOf(request), reportPermission(where.reportType, 'sign'), where.facilityId);
    return amendReport(db, callerOf(request), { reportId, ...body });
  });

  app.post('/v1/diagnostic-reports/:reportId/cancel', async (request) => {
    const { reportId } = parse(z.object({ reportId: uuid }), request.params);
    const body = parse(z.object({ version: Version, reason: Reason }), request.body);
    const where = await at(request, 'diagnostic_report', reportId);
    authorize(principalOf(request), reportPermission(where.reportType, 'draft'), where.facilityId);
    return cancelReport(db, callerOf(request), { reportId, ...body });
  });

  app.post('/v1/diagnostic-reports/:reportId/acknowledge', async (request, reply) => {
    const { reportId } = parse(z.object({ reportId: uuid }), request.params);
    const body = parse(z.object({ actionTaken: z.string().trim().max(1000).optional() }), request.body ?? {});
    authorize(principalOf(request), 'results.acknowledge', (await at(request, 'diagnostic_report', reportId)).facilityId);
    return reply.status(201).send(await acknowledgeReport(db, callerOf(request), { reportId, ...body }));
  });

  app.get('/v1/results/unacknowledged', async (request) => {
    const q = parse(z.object({ facilityId: uuid.optional() }), request.query);
    authorize(principalOf(request), 'results.acknowledge', q.facilityId);
    return { items: await unacknowledgedResults(db, callerOf(request), q) };
  });

  app.get('/v1/patients/:patientId/results', async (request) => {
    const { patientId } = parse(z.object({ patientId: uuid }), request.params);
    authorize(principalOf(request), 'results.read');
    return getPatientResults(db, callerOf(request), patientId);
  });

  // ---- imaging and PC-PNDT ------------------------------------------------------------------------------
  app.get('/v1/imaging/worklist', async (request) => {
    const q = parse(z.object({ facilityId: uuid, status: z.enum(['scheduled', 'arrived', 'in_progress', 'completed', 'reported', 'cancelled']).optional() }), request.query);
    authorizeOneOf(principalOf(request), ['imaging.manage', 'imaging.report'], q.facilityId);
    return { items: await imagingWorklist(db, callerOf(request), q) };
  });

  app.post('/v1/imaging-studies/:imagingStudyId/status', async (request) => {
    const { imagingStudyId } = parse(z.object({ imagingStudyId: uuid }), request.params);
    const body = parse(
      z.object({
        version: Version,
        status: z.enum(['scheduled', 'arrived', 'in_progress', 'completed', 'cancelled']),
        isObstetric: z.boolean().optional(),
        doseDlpMgyCm: z.number().min(0).max(100000).optional(),
        pacsUrl: z.url({ protocol: /^https?$/ }).max(500).optional(),
        equipmentId: uuid.optional(),
        reason: z.string().trim().max(500).optional(),
      }),
      request.body,
    );
    authorize(principalOf(request), 'imaging.manage', (await at(request, 'imaging_study', imagingStudyId)).facilityId);
    return setStudyStatus(db, callerOf(request), { imagingStudyId, ...body });
  });

  app.put('/v1/imaging-studies/:imagingStudyId/form-f', async (request) => {
    const { imagingStudyId } = parse(z.object({ imagingStudyId: uuid }), request.params);
    const body = parse(
      z.object({
        formData: z.record(z.string(), z.unknown()).refine((d) => JSON.stringify(d).length <= 20000, 'form is too large'),
        patientDeclared: z.boolean(),
        doctorDeclared: z.boolean(),
        version: Version.optional(),
      }),
      request.body,
    );
    authorize(principalOf(request), 'pcpndt.manage', (await at(request, 'imaging_study', imagingStudyId)).facilityId);
    return saveFormF(db, callerOf(request), { imagingStudyId, ...body });
  });

  app.get('/v1/form-f', async (request) => {
    const q = parse(z.object({ facilityId: uuid, month: Month }), request.query);
    authorize(principalOf(request), 'pcpndt.manage', q.facilityId);
    return { items: await listFormF(db, callerOf(request), q) };
  });

  app.post('/v1/form-f/submit', async (request) => {
    const body = parse(z.object({ facilityId: uuid, month: Month, submissionRef: z.string().trim().max(100).optional() }), request.body);
    authorize(principalOf(request), 'pcpndt.manage', body.facilityId);
    return submitFormF(db, callerOf(request), body);
  });
}
