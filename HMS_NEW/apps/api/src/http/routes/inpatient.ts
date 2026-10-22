import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize } from '../../auth/principal.ts';
import { createBed, createBedCategory, createWard, listBedCategories, setBedPrice, updateBed, wardFacility } from '../../modules/directory/wards.ts';
import {
  admissionFacility, admit, assignBed, bedBoard, bedFacility, cancelAdmission, decideClearance, depart, dischargeFacility, getAdmission,
  listAdmissions, planDischarge, setBedStatus, transfer,
} from '../../modules/inpatient/index.ts';
import { moduleRoutes } from '../module-routes.ts';
import { callerOf, idempotencyKey, isoDate, optionalIdempotencyKey, parse, principalOf, uuid } from '../support.ts';

const Reason = z.string().trim().min(3).max(500);
const Version = z.number().int().min(1);
const Code = z.string().trim().regex(/^[A-Za-z0-9_-]{1,20}$/, 'letters, digits, - and _ (up to 20)');
const Name = z.string().trim().min(1).max(100);
const Limit = z.coerce.number().int().min(1).max(200).default(50);
const WardType = z.enum(['general', 'icu', 'nicu', 'picu', 'hdu', 'maternity', 'isolation', 'daycare', 'emergency', 'burns', 'dialysis']);

export function registerInpatientRoutes(app: FastifyInstance, db: Kysely<DB>) {
  const atAdmission = async (request: Parameters<typeof callerOf>[0], admissionId: string, permission: string) => {
    const facilityId = await admissionFacility(db, callerOf(request), admissionId);
    if (!facilityId) throw new DomainError('not_found', 'admission not found');
    authorize(principalOf(request), permission, facilityId);
  };

  moduleRoutes(app, db, 'inpatient', (r) => {
    // ---- setup: bed categories, wards, beds, bed prices -----------------------------------------------
    r.get('/v1/bed-categories', async (request) => {
      authorize(principalOf(request), 'inpatient.read');
      return { items: await listBedCategories(db, callerOf(request)) };
    });
    r.post('/v1/bed-categories', async (request, reply) => {
      const body = parse(z.object({ code: Code, name: Name, rank: z.number().int().min(0).max(100).default(1), isIcu: z.boolean().default(false) }), request.body);
      authorize(principalOf(request), 'catalog.manage', null);
      return reply.status(201).send(await createBedCategory(db, callerOf(request), body, idempotencyKey(request)));
    });
    r.put('/v1/bed-categories/:bedCategoryId/price', async (request) => {
      const { bedCategoryId } = parse(z.object({ bedCategoryId: uuid }), request.params);
      const body = parse(z.object({ priceMinor: z.number().int().min(0).max(10_000_000_00).nullable(), effectiveFrom: isoDate }), request.body);
      authorize(principalOf(request), 'pricing.manage', null);
      return setBedPrice(db, callerOf(request), { bedCategoryId, ...body }, idempotencyKey(request));
    });
    r.post('/v1/facilities/:facilityId/wards', async (request, reply) => {
      const { facilityId } = parse(z.object({ facilityId: uuid }), request.params);
      const body = parse(z.object({ code: Code, name: Name, wardType: WardType, departmentId: uuid.optional(), genderRestriction: z.enum(['male', 'female', 'any']).optional() }), request.body);
      authorize(principalOf(request), 'facility.manage', facilityId);
      return reply.status(201).send(await createWard(db, callerOf(request), { facilityId, ...body }, idempotencyKey(request)));
    });
    r.post('/v1/wards/:wardId/beds', async (request, reply) => {
      const { wardId } = parse(z.object({ wardId: uuid }), request.params);
      const body = parse(z.object({ code: Code, name: Name, bedCategoryId: uuid }), request.body);
      const facilityId = await wardFacility(db, callerOf(request), wardId);
      if (!facilityId) throw new DomainError('not_found', 'ward not found');
      authorize(principalOf(request), 'facility.manage', facilityId);
      return reply.status(201).send(await createBed(db, callerOf(request), { wardId, ...body }, idempotencyKey(request)));
    });
    r.patch('/v1/beds/:bedId', async (request) => {
      const { bedId } = parse(z.object({ bedId: uuid }), request.params);
      const body = parse(z.object({ version: Version, name: Name.optional(), bedCategoryId: uuid.optional(), status: z.enum(['active', 'inactive']).optional() }), request.body);
      const facilityId = await bedFacility(db, callerOf(request), bedId);
      if (!facilityId) throw new DomainError('not_found', 'bed not found');
      authorize(principalOf(request), 'facility.manage', facilityId);
      return updateBed(db, callerOf(request), { bedId, ...body }, optionalIdempotencyKey(request));
    });

    // ---- bed board and bed status ---------------------------------------------------------------------
    r.get('/v1/inpatient/bed-board', async (request) => {
      const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
      authorize(principalOf(request), 'inpatient.read', facilityId);
      return bedBoard(db, callerOf(request), facilityId);
    });
    r.post('/v1/beds/:bedId/:action', async (request) => {
      const { bedId, action } = parse(z.object({ bedId: uuid, action: z.enum(['ready', 'block', 'unblock', 'maintenance']) }), request.params);
      const body = parse(z.object({ reason: Reason.optional() }), request.body ?? {});
      const facilityId = await bedFacility(db, callerOf(request), bedId);
      if (!facilityId) throw new DomainError('not_found', 'bed not found');
      authorize(principalOf(request), 'inpatient.manage', facilityId);
      return setBedStatus(db, callerOf(request), { bedId, action, ...body }, optionalIdempotencyKey(request));
    });

    // ---- admissions -----------------------------------------------------------------------------------
    r.get('/v1/admissions', async (request) => {
      const q = parse(z.object({
        facilityId: uuid, status: z.enum(['bed_pending', 'admitted', 'discharge_planned', 'discharged', 'cancelled']).optional(),
        open: z.enum(['true', 'false']).optional(), patientId: uuid.optional(), limit: Limit,
      }), request.query);
      authorize(principalOf(request), 'inpatient.read', q.facilityId);
      return { items: await listAdmissions(db, callerOf(request), { ...q, open: q.open === 'true' }) };
    });
    r.get('/v1/admissions/:admissionId', async (request) => {
      const { admissionId } = parse(z.object({ admissionId: uuid }), request.params);
      await atAdmission(request, admissionId, 'inpatient.read');
      return getAdmission(db, callerOf(request), admissionId);
    });
    r.post('/v1/admissions', async (request, reply) => {
      const body = parse(z.object({
        facilityId: uuid, patientId: uuid, admittingStaffId: uuid,
        admissionType: z.enum(['elective', 'emergency', 'day_care', 'maternity', 'transfer_in']), admissionReason: z.string().trim().min(3).max(1000),
        departmentId: uuid.optional(), sourceEncounterId: uuid.optional(), bedId: uuid.optional(), requestedBedCategoryId: uuid.optional(), expectedDischargeOn: isoDate.optional(),
      }), request.body);
      authorize(principalOf(request), 'inpatient.manage', body.facilityId);
      return reply.status(201).send(await admit(db, callerOf(request), body, idempotencyKey(request)));
    });
    r.post('/v1/admissions/:admissionId/assign-bed', async (request) => {
      const { admissionId } = parse(z.object({ admissionId: uuid }), request.params);
      const body = parse(z.object({ bedId: uuid, version: Version }), request.body);
      await atAdmission(request, admissionId, 'inpatient.manage');
      return assignBed(db, callerOf(request), { admissionId, ...body }, idempotencyKey(request));
    });
    r.post('/v1/admissions/:admissionId/transfer', async (request) => {
      const { admissionId } = parse(z.object({ admissionId: uuid }), request.params);
      const body = parse(z.object({ toBedId: uuid, reason: Reason, retainCurrent: z.boolean().optional(), version: Version }), request.body);
      await atAdmission(request, admissionId, 'inpatient.manage');
      return transfer(db, callerOf(request), { admissionId, ...body }, idempotencyKey(request));
    });
    r.post('/v1/admissions/:admissionId/cancel', async (request) => {
      const { admissionId } = parse(z.object({ admissionId: uuid }), request.params);
      const body = parse(z.object({ reason: Reason, version: Version }), request.body);
      await atAdmission(request, admissionId, 'inpatient.manage');
      return cancelAdmission(db, callerOf(request), { admissionId, ...body }, idempotencyKey(request));
    });
    r.post('/v1/admissions/:admissionId/discharge', async (request, reply) => {
      const { admissionId } = parse(z.object({ admissionId: uuid }), request.params);
      const body = parse(z.object({
        dischargeType: z.enum(['routine', 'lama', 'dama', 'absconded', 'transfer_out', 'referred', 'death']),
        expectedDepartureAt: z.iso.datetime({ offset: true }).optional(), summaryNoteId: uuid.optional(), notes: z.string().trim().max(2000).optional(), version: Version,
      }), request.body);
      await atAdmission(request, admissionId, 'inpatient.discharge');
      return reply.status(201).send(await planDischarge(db, callerOf(request), { admissionId, ...body }, idempotencyKey(request)));
    });

    // ---- discharge clearances and departure ---------------------------------------------------------
    r.post('/v1/discharges/:dischargeId/clearances/:kind/:decision', async (request) => {
      const p = parse(z.object({ dischargeId: uuid, kind: z.enum(['clinical', 'pharmacy', 'nursing', 'finance']), decision: z.enum(['clear', 'waive']) }), request.params);
      const body = parse(z.object({ reason: Reason.optional(), note: z.string().trim().max(1000).optional() }), request.body ?? {});
      const facilityId = await dischargeFacility(db, callerOf(request), p.dischargeId);
      if (!facilityId) throw new DomainError('not_found', 'discharge not found');
      if (p.decision === 'waive') {
        if (!body.reason) throw new DomainError('validation', 'a waiver needs a reason');
        authorize(principalOf(request), 'inpatient.discharge.override', facilityId);
      } else {
        // The pharmacist clears pharmacy; doctors and nurses clear their own (checked in the command).
        authorize(principalOf(request), p.kind === 'pharmacy' ? 'pharmacy.dispense' : 'inpatient.discharge', facilityId);
      }
      return decideClearance(db, callerOf(request), { dischargeId: p.dischargeId, kind: p.kind, waive: p.decision === 'waive' ? body.reason : undefined, note: body.note }, optionalIdempotencyKey(request));
    });
    r.post('/v1/discharges/:dischargeId/depart', async (request) => {
      const { dischargeId } = parse(z.object({ dischargeId: uuid }), request.params);
      const facilityId = await dischargeFacility(db, callerOf(request), dischargeId);
      if (!facilityId) throw new DomainError('not_found', 'discharge not found');
      authorize(principalOf(request), 'inpatient.manage', facilityId);
      return depart(db, callerOf(request), { dischargeId }, idempotencyKey(request));
    });
  });
}
