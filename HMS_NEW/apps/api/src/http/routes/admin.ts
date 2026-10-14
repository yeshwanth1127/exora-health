// Workspace administration (ERD m01, G02/G14/G16/G17/G18/G34): registrations, care assignments,
// break-glass review, module switches, invite renewal, session context and consent documents.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize, authorizeEvery } from '../../auth/principal.ts';
import {
  addRegistration,
  assignCare,
  endCareAssignment,
  listBreakGlass,
  listCareAssignments,
  listRegistrations,
  MODULES,
  moduleStates,
  registrationStaff,
  renewInvite,
  reviewBreakGlass,
  sessionContext,
  setModuleState,
  updateRegistration,
} from '../../modules/access/admin.ts';
import { staffFacilities } from '../../modules/access/index.ts';
import { draftConsentDocument, listConsentDocuments, publishConsentDocument, retireConsentDocument, updateConsentDraft } from '../../modules/telehealth/documents.ts';
import { callerOf, idempotencyKey, isoDate, parse, principalOf, uuid } from '../support.ts';

const Reason = z.string().trim().min(3).max(500);
const missing = (what: string) => new DomainError('not_found', `${what} not found`);

export function registerAdminRoutes(app: FastifyInstance, db: Kysely<DB>) {
  /** staff.manage wherever the person holds a grant (every clinic when they hold none or an every-clinic one). */
  async function manageStaff(request: Parameters<typeof callerOf>[0], staffId: string, permission = 'staff.manage') {
    const where = await staffFacilities(db, callerOf(request), staffId);
    if (where === undefined) throw missing('staff member');
    authorizeEvery(principalOf(request), permission, where ?? []);
  }

  // ---- session context (G02) ------------------------------------------------------------------------
  app.get('/v1/session-context', async (request) => {
    const p = principalOf(request);
    // Facilities the caller holds any permission at (null when some grant covers every clinic).
    const all = [...p.grants.values()].some((s) => s.has(null));
    const ids = all ? null : [...new Set([...p.grants.values()].flatMap((s) => [...s].filter((f): f is string => f !== null)))];
    const ctx = await sessionContext(db, callerOf(request), ids);
    return { ...ctx, modules: await moduleStates(db, callerOf(request)), staff: { staffId: p.staffId, displayName: p.displayName, staffType: p.staffType } };
  });

  // ---- professional registrations ---------------------------------------------------------------------
  app.get('/v1/staff/:staffId/registrations', async (request) => {
    const { staffId } = parse(z.object({ staffId: uuid }), request.params);
    authorize(principalOf(request), 'staff.read');
    return { items: await listRegistrations(db, callerOf(request), staffId) };
  });

  app.post('/v1/staff/:staffId/registrations', async (request, reply) => {
    const { staffId } = parse(z.object({ staffId: uuid }), request.params);
    const body = parse(z.object({ council: z.string().trim().min(2).max(100), registrationNo: z.string().trim().min(2).max(40), validUntil: isoDate.nullable() }), request.body);
    await manageStaff(request, staffId);
    return reply.status(201).send(await addRegistration(db, callerOf(request), { staffId, ...body }, idempotencyKey(request)));
  });

  app.patch('/v1/staff-registrations/:registrationId', async (request) => {
    const { registrationId } = parse(z.object({ registrationId: uuid }), request.params);
    const body = parse(z.object({ version: z.number().int().min(1), validUntil: isoDate.nullable().optional(), verify: z.boolean().optional() }), request.body);
    const staffId = await registrationStaff(db, callerOf(request), registrationId);
    if (!staffId) throw missing('registration');
    await manageStaff(request, staffId);
    return updateRegistration(db, callerOf(request), { registrationId, ...body }, idempotencyKey(request));
  });

  // ---- care assignments ---------------------------------------------------------------------------------
  app.get('/v1/care-assignments', async (request) => {
    const q = parse(z.object({ patientId: uuid.optional(), staffId: uuid.optional() }).refine((x) => x.patientId || x.staffId, 'give patientId or staffId'), request.query);
    authorize(principalOf(request), 'care_assignment.manage');
    return { items: await listCareAssignments(db, callerOf(request), q) };
  });

  app.post('/v1/care-assignments', async (request, reply) => {
    const body = parse(
      z.object({ staffId: uuid, patientId: uuid, reason: z.enum(['attending', 'consulting', 'nursing', 'cover', 'other']), validTo: z.iso.datetime({ offset: true }).nullable() }),
      request.body,
    );
    authorize(principalOf(request), 'care_assignment.manage');
    return reply.status(201).send(await assignCare(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.post('/v1/care-assignments/:careAssignmentId/end', async (request) => {
    const { careAssignmentId } = parse(z.object({ careAssignmentId: uuid }), request.params);
    const { reason } = parse(z.object({ reason: Reason }), request.body);
    authorize(principalOf(request), 'care_assignment.manage');
    return endCareAssignment(db, callerOf(request), { careAssignmentId, reason }, idempotencyKey(request));
  });

  // ---- break-glass review (G18) ---------------------------------------------------------------------------
  // Emergency access spans clinics and names patients, so review needs break_glass.review at every clinic.
  app.get('/v1/break-glass', async (request) => {
    const q = parse(z.object({ status: z.enum(['pending', 'reviewed', 'all']).default('pending'), limit: z.coerce.number().int().min(1).max(500).default(100) }), request.query);
    authorizeEvery(principalOf(request), 'break_glass.review', []);
    return { items: await listBreakGlass(db, callerOf(request), q) };
  });

  app.post('/v1/break-glass/:grantId/review', async (request) => {
    const { grantId } = parse(z.object({ grantId: uuid }), request.params);
    const body = parse(z.object({ outcome: z.enum(['appropriate', 'inappropriate']), note: Reason }), request.body);
    authorizeEvery(principalOf(request), 'break_glass.review', []);
    return reviewBreakGlass(db, callerOf(request), { grantId, ...body }, idempotencyKey(request));
  });

  // ---- module switches (G17) ------------------------------------------------------------------------------
  app.get('/v1/modules', async (request) => {
    authorize(principalOf(request), 'catalog.read');
    return { items: await moduleStates(db, callerOf(request)) };
  });

  app.put('/v1/modules/:module', async (request) => {
    const { module } = parse(z.object({ module: z.enum(MODULES) }), request.params);
    const body = parse(
      z.object({ state: z.enum(['not_provisioned', 'configured', 'validated', 'active', 'suspended', 'retired']), version: z.number().int().min(0), reason: Reason }),
      request.body,
    );
    authorizeEvery(principalOf(request), 'tenant.manage', []);
    return setModuleState(db, callerOf(request), { module, ...body }, idempotencyKey(request));
  });

  // ---- invites -----------------------------------------------------------------------------------------
  app.post('/v1/staff/:staffId/invite/renew', async (request) => {
    const { staffId } = parse(z.object({ staffId: uuid }), request.params);
    await manageStaff(request, staffId, 'access.manage');
    return renewInvite(db, callerOf(request), { staffId }, idempotencyKey(request));
  });

  // ---- teleconsultation consent documents (G34) ----------------------------------------------------------
  app.get('/v1/consent-documents', async (request) => {
    const p = principalOf(request);
    // Readable by whoever records verbal consent or manages the documents.
    if (!p.grants.get('teleconsult.read')?.size && !p.grants.get('consent_documents.manage')?.size) authorize(p, 'teleconsult.read');
    return { items: await listConsentDocuments(db, callerOf(request)) };
  });

  const Lang = z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'a language code such as en or kn');
  app.post('/v1/consent-documents', async (request, reply) => {
    const body = parse(z.object({ docVersion: z.string().regex(/^[A-Za-z0-9._-]{1,40}$/), language: Lang, title: z.string().trim().min(3).max(200), body: z.string().trim().min(20).max(50_000) }), request.body);
    authorizeEvery(principalOf(request), 'consent_documents.manage', []);
    return reply.status(201).send(await draftConsentDocument(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.patch('/v1/consent-documents/:documentId', async (request) => {
    const { documentId } = parse(z.object({ documentId: uuid }), request.params);
    const body = parse(z.object({ version: z.number().int().min(1), title: z.string().trim().min(3).max(200).optional(), body: z.string().trim().min(20).max(50_000).optional() }), request.body);
    authorizeEvery(principalOf(request), 'consent_documents.manage', []);
    return updateConsentDraft(db, callerOf(request), { documentId, ...body }, idempotencyKey(request));
  });

  app.post('/v1/consent-documents/:documentId/publish', async (request) => {
    const { documentId } = parse(z.object({ documentId: uuid }), request.params);
    authorizeEvery(principalOf(request), 'consent_documents.manage', []);
    return publishConsentDocument(db, callerOf(request), { documentId }, idempotencyKey(request));
  });

  app.post('/v1/consent-documents/:documentId/retire', async (request) => {
    const { documentId } = parse(z.object({ documentId: uuid }), request.params);
    const { reason } = parse(z.object({ reason: Reason }), request.body);
    authorizeEvery(principalOf(request), 'consent_documents.manage', []);
    return retireConsentDocument(db, callerOf(request), { documentId, reason }, idempotencyKey(request));
  });
}
