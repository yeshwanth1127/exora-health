import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize, authorizeEvery } from '../../auth/principal.ts';
import { quoteFees } from '../../modules/booking/index.ts';
import { facilityDirectory, listFacilities, listPractitioners, listSpecialties } from '../../modules/directory/read.ts';
import {
  createConsultRoom,
  createDepartment,
  createFacility,
  createService,
  departmentFacility,
  facilityPriceBook,
  getFacility,
  roomFacility,
  serviceFacility,
  setServiceFee,
  updateConsultRoom,
  updateDepartment,
  updateFacility,
  updateService,
} from '../../modules/directory/admin.ts';
import {
  addAffiliation,
  affiliationFacility,
  endAffiliation,
  getPractitioner,
  practitionerReach,
  savePractitionerProfile,
  updateStaffDetails,
} from '../../modules/directory/practitioners.ts';
import { staffFacilities } from '../../modules/access/index.ts';
import { callerOf, e164, idempotencyKey, isoDate, parse, principalOf, uuid } from '../support.ts';

const missing = (what: string) => new DomainError('not_found', `${what} not found`);
const Status = z.enum(['active', 'inactive']);
const Version = z.number().int().min(1);
const Code = z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9_-]+$/, 'letters, digits, _ and - only');
const Name = z.string().trim().min(2).max(120);
/** Optional free text: blank clears it. */
const text = (max: number) => z.string().trim().max(max).nullable().transform((v) => v || null);
const Timezone = z.string().max(64).refine((tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'unknown time zone');
const FacilityType = z.enum(['hospital', 'clinic', 'diagnostic_centre', 'pharmacy', 'virtual']);
const StateCode = z.string().regex(/^[0-9]{2}$/, '2-digit GST state code');

const FacilityFields = z.object({
  name: Name.optional(),
  facilityType: FacilityType.optional(),
  addressLine1: text(200).optional(),
  addressLine2: text(200).optional(),
  city: text(80).optional(),
  district: text(80).optional(),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, '6-digit pincode').nullable().optional(),
  stateCode: StateCode.optional(),
  phone: e164.nullable().optional(),
  email: z.email().max(254).nullable().optional(),
  timezone: Timezone.optional(),
  directionsUrl: z.string().max(500).regex(/^https:\/\/\S{3,}$/, 'an https:// link').nullable().optional(),
  arrivalInstructions: text(1000).optional(),
});
const ServiceMode = z.enum(['in_person', 'virtual', 'both']);
const PriceMode = z.enum(['in_person', 'virtual', 'any']);
const Fee = z.number().int().min(0).max(10_000_000); // paise; up to ₹1,00,000
const Reason = z.string().trim().min(3).max(500);
const Kind = z.enum(['clinical', 'diagnostic', 'support', 'administrative']);
const Specialty = z.string().regex(/^[a-z][a-z0-9_]*$/).max(64).nullable();
const Duration = z.number().int().min(5).max(480);

export function registerDirectoryRoutes(app: FastifyInstance, db: Kysely<DB>) {
  // ---- reads ------------------------------------------------------------------------------------------
  app.get('/v1/facilities', async (request) => {
    const q = parse(z.object({ includeInactive: z.enum(['true', 'false']).optional() }), request.query);
    const principal = principalOf(request);
    authorize(principal, 'catalog.read');
    // Switched-off clinics are listed only for people who could switch them back on.
    const includeInactive = q.includeInactive === 'true' && (principal.grants.get('facility.manage')?.size ?? 0) > 0;
    return { items: await listFacilities(db, callerOf(request), { includeInactive }) };
  });

  app.get('/v1/facilities/:facilityId', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.params);
    authorize(principalOf(request), 'catalog.read', facilityId);
    return getFacility(db, callerOf(request), facilityId);
  });

  app.get('/v1/specialties', async (request) => {
    authorize(principalOf(request), 'catalog.read');
    return { items: await listSpecialties(db, callerOf(request)) };
  });

  app.get('/v1/practitioners', async (request) => {
    const q = parse(z.object({ facilityId: uuid.optional(), specialty: z.string().max(64).optional() }), request.query);
    authorize(principalOf(request), 'catalog.read', q.facilityId);
    return { items: await listPractitioners(db, callerOf(request), q) };
  });

  app.get('/v1/facilities/:facilityId/directory', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.params);
    const q = parse(z.object({ includeInactive: z.enum(['true', 'false']).optional() }), request.query);
    const principal = principalOf(request);
    authorize(principal, 'catalog.read', facilityId);
    const manages = ['facility.manage', 'catalog.manage'].some((p) => {
      const scopes = principal.grants.get(p);
      return !!scopes && (scopes.has(null) || scopes.has(facilityId));
    });
    return facilityDirectory(db, callerOf(request), facilityId, { includeInactive: q.includeInactive === 'true' && manages });
  });

  app.get('/v1/facilities/:facilityId/price-book', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.params);
    const { on } = parse(z.object({ on: isoDate }), request.query);
    authorize(principalOf(request), 'catalog.read', facilityId);
    return facilityPriceBook(db, callerOf(request), facilityId, on);
  });

  app.get('/v1/practitioners/:staffId/fees', async (request) => {
    const { staffId } = parse(z.object({ staffId: uuid }), request.params);
    const q = parse(z.object({ facilityId: uuid, on: isoDate }), request.query);
    authorize(principalOf(request), 'catalog.read', q.facilityId);
    return { items: await quoteFees(db, callerOf(request), { staffId, ...q }) };
  });

  app.get('/v1/practitioners/:staffId/profile', async (request) => {
    const { staffId } = parse(z.object({ staffId: uuid }), request.params);
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
    const principal = principalOf(request);
    authorize(principal, 'catalog.read', facilityId);
    const detail = await getPractitioner(db, callerOf(request), staffId);
    // Only doctors who work (or worked) at that clinic are read through it, so the clinic grant can't
    // be used to look up anyone else; contact details also need staff.read there.
    if (!detail.affiliations.some((a) => a.facilityId === facilityId)) throw missing('practitioner');
    const scopes = principal.grants.get('staff.read');
    const contact = !!scopes && (scopes.has(null) || scopes.has(facilityId));
    return contact ? detail : { ...detail, phone: null, email: null };
  });

  // ---- clinics (facility.manage) -----------------------------------------------------------------------
  app.post('/v1/facilities', async (request, reply) => {
    const body = parse(FacilityFields.extend({ code: Code, name: Name, facilityType: FacilityType, stateCode: StateCode }), request.body);
    // A new clinic is outside every clinic-scoped grant, so creating one needs the grant everywhere.
    authorizeEvery(principalOf(request), 'facility.manage', []);
    return reply.status(201).send(await createFacility(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.patch('/v1/facilities/:facilityId', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.params);
    const body = parse(FacilityFields.extend({ version: Version, status: Status.optional() }), request.body);
    authorize(principalOf(request), 'facility.manage', facilityId);
    return updateFacility(db, callerOf(request), { facilityId, ...body });
  });

  // ---- departments and consult rooms (facility.manage at their clinic) --------------------------------------
  app.post('/v1/facilities/:facilityId/departments', async (request, reply) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.params);
    const body = parse(z.object({ code: Code, name: Name, kind: Kind.default('clinical'), specialty: Specialty.optional() }), request.body);
    authorize(principalOf(request), 'facility.manage', facilityId);
    return reply.status(201).send(await createDepartment(db, callerOf(request), { facilityId, ...body }, idempotencyKey(request)));
  });

  app.patch('/v1/departments/:departmentId', async (request) => {
    const { departmentId } = parse(z.object({ departmentId: uuid }), request.params);
    const body = parse(z.object({ version: Version, name: Name.optional(), kind: Kind.optional(), specialty: Specialty.optional(), status: Status.optional() }), request.body);
    const facilityId = await departmentFacility(db, callerOf(request), departmentId);
    if (!facilityId) throw missing('department');
    authorize(principalOf(request), 'facility.manage', facilityId);
    return updateDepartment(db, callerOf(request), { departmentId, ...body });
  });

  app.post('/v1/facilities/:facilityId/consult-rooms', async (request, reply) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.params);
    const body = parse(z.object({ code: Code, name: Name, departmentId: uuid.nullable().optional() }), request.body);
    authorize(principalOf(request), 'facility.manage', facilityId);
    return reply.status(201).send(await createConsultRoom(db, callerOf(request), { facilityId, ...body }, idempotencyKey(request)));
  });

  app.patch('/v1/consult-rooms/:locationId', async (request) => {
    const { locationId } = parse(z.object({ locationId: uuid }), request.params);
    const body = parse(z.object({ version: Version, name: Name.optional(), departmentId: uuid.nullable().optional(), status: Status.optional() }), request.body);
    const facilityId = await roomFacility(db, callerOf(request), locationId);
    if (!facilityId) throw missing('consult room');
    authorize(principalOf(request), 'facility.manage', facilityId);
    return updateConsultRoom(db, callerOf(request), { locationId, ...body });
  });

  // ---- services (catalog.manage) and fees (pricing.manage) at the service's clinic ------------------------------
  app.post('/v1/departments/:departmentId/services', async (request, reply) => {
    const { departmentId } = parse(z.object({ departmentId: uuid }), request.params);
    const body = parse(z.object({ code: Code, name: Name, serviceMode: ServiceMode, defaultDurationMin: Duration, isPublic: z.boolean().default(true), feeMinor: Fee.optional() }), request.body);
    const facilityId = await departmentFacility(db, callerOf(request), departmentId);
    if (!facilityId) throw missing('department');
    authorize(principalOf(request), 'catalog.manage', facilityId);
    if (body.feeMinor !== undefined) authorize(principalOf(request), 'pricing.manage', facilityId);
    return reply.status(201).send(await createService(db, callerOf(request), { departmentId, ...body }, idempotencyKey(request)));
  });

  app.patch('/v1/healthcare-services/:healthcareServiceId', async (request) => {
    const { healthcareServiceId } = parse(z.object({ healthcareServiceId: uuid }), request.params);
    const body = parse(
      z.object({ version: Version, name: Name.optional(), serviceMode: ServiceMode.optional(), defaultDurationMin: Duration.optional(), isPublic: z.boolean().optional(), status: Status.optional() }),
      request.body,
    );
    const facilityId = await serviceFacility(db, callerOf(request), healthcareServiceId);
    if (!facilityId) throw missing('service');
    authorize(principalOf(request), 'catalog.manage', facilityId);
    return updateService(db, callerOf(request), { healthcareServiceId, ...body });
  });

  const FeeBody = z.object({ mode: PriceMode, feeMinor: Fee.nullable(), effectiveFrom: isoDate });

  app.put('/v1/healthcare-services/:healthcareServiceId/fee', async (request) => {
    const { healthcareServiceId } = parse(z.object({ healthcareServiceId: uuid }), request.params);
    const body = parse(FeeBody, request.body);
    const facilityId = await serviceFacility(db, callerOf(request), healthcareServiceId);
    if (!facilityId) throw missing('service');
    authorize(principalOf(request), 'pricing.manage', facilityId);
    return setServiceFee(db, callerOf(request), { healthcareServiceId, ...body });
  });

  app.put('/v1/practitioners/:staffId/fees', async (request) => {
    const { staffId } = parse(z.object({ staffId: uuid }), request.params);
    const body = parse(FeeBody.extend({ healthcareServiceId: uuid }), request.body);
    const facilityId = await serviceFacility(db, callerOf(request), body.healthcareServiceId);
    if (!facilityId) throw missing('service');
    authorize(principalOf(request), 'pricing.manage', facilityId);
    return setServiceFee(db, callerOf(request), { ...body, staffId });
  });

  // ---- doctors ------------------------------------------------------------------------------------------
  // The booking profile is shown at every clinic the doctor works at, so it needs catalog.manage at each.
  app.put('/v1/practitioners/:staffId/profile', async (request) => {
    const { staffId } = parse(z.object({ staffId: uuid }), request.params);
    const body = parse(
      z.object({
        version: Version.optional(),
        specialty: Specialty,
        qualifications: z.array(z.string().trim().min(1).max(80)).max(20),
        bio: text(2000),
        experienceYears: z.number().int().min(0).max(80).nullable(),
        languages: z.array(z.string().trim().min(2).max(40)).max(20),
        acceptsVirtual: z.boolean(),
        publicSlug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/, 'lower-case letters, digits and -').nullable(),
        published: z.boolean(),
      }),
      request.body,
    );
    const reach = await practitionerReach(db, callerOf(request), staffId);
    if (reach === undefined) throw missing('staff member');
    authorizeEvery(principalOf(request), 'catalog.manage', reach);
    return savePractitionerProfile(db, callerOf(request), { staffId, ...body });
  });

  app.post('/v1/practitioners/:staffId/affiliations', async (request, reply) => {
    const { staffId } = parse(z.object({ staffId: uuid }), request.params);
    const body = parse(z.object({ facilityId: uuid, departmentId: uuid, roleTitle: text(80).optional(), validFrom: isoDate }), request.body);
    authorize(principalOf(request), 'catalog.manage', body.facilityId);
    return reply.status(201).send(await addAffiliation(db, callerOf(request), { staffId, ...body }, idempotencyKey(request)));
  });

  app.post('/v1/practitioner-affiliations/:affiliationId/end', async (request) => {
    const { affiliationId } = parse(z.object({ affiliationId: uuid }), request.params);
    const body = parse(z.object({ validTo: isoDate, reason: Reason }), request.body);
    const facilityId = await affiliationFacility(db, callerOf(request), affiliationId);
    if (!facilityId) throw missing('affiliation');
    authorize(principalOf(request), 'catalog.manage', facilityId);
    return endAffiliation(db, callerOf(request), { affiliationId, ...body });
  });

  // Name and phone apply everywhere the person works: staff.manage at each clinic they hold a grant at.
  app.patch('/v1/staff/:staffId', async (request) => {
    const { staffId } = parse(z.object({ staffId: uuid }), request.params);
    const body = parse(z.object({ version: Version, displayName: z.string().trim().min(2).max(100).optional(), phone: e164.nullable().optional() }), request.body);
    const where = await staffFacilities(db, callerOf(request), staffId);
    if (where === undefined) throw missing('staff member');
    authorizeEvery(principalOf(request), 'staff.manage', where ?? []);
    return updateStaffDetails(db, callerOf(request), { staffId, ...body });
  });
}
