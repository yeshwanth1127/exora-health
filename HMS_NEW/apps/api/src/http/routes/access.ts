// Workspace administration (G16) and the activity log (G18).
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { authorize, authorizeEvery } from '../../auth/principal.ts';
import {
  copyRole,
  createStaffAccount,
  exportAuditEvents,
  grantFacility,
  grantRole,
  listAuditEvents,
  listRoles,
  listStaffAccounts,
  revokeGrant,
  setRolePermission,
  setStaffStatus,
  STAFF_TYPES,
  staffFacilities,
} from '../../modules/access/index.ts';
import { DomainError } from '@hms/platform';
import { callerOf, e164, idempotencyKey, isoDate, parse, principalOf, uuid } from '../support.ts';

const Reason = z.string().trim().min(3).max(500);
// A grant's clinic: one clinic id, or null for every clinic.
const Scope = uuid.nullable();

const AuditFilter = z
  .object({
    actor: z.string().trim().max(100).optional(),
    record: z.string().trim().max(64).optional(),
    action: z.string().trim().max(100).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine((f) => !f.from || !f.to || f.from <= f.to, { message: 'from must be on or before to', path: ['to'] });

export function registerAccessRoutes(app: FastifyInstance, db: Kysely<DB>) {
  // `permission` at one clinic, or at every clinic when the scope is null. Unknown records are 404.
  const atScope = (request: FastifyRequest, permission: string, scope: string | null | undefined) => {
    if (scope === undefined) throw new DomainError('not_found', 'not found');
    authorizeEvery(principalOf(request), permission, scope ? [scope] : []);
  };

  app.get('/v1/roles', async (request) => {
    authorize(principalOf(request), 'access.manage');
    return listRoles(db, callerOf(request));
  });

  // Roles are tenant-wide (grantable at any clinic), so editing them needs access.manage at every clinic.
  app.post('/v1/roles', async (request, reply) => {
    const body = parse(z.object({ name: z.string().trim().min(2).max(60), copyOfRoleId: uuid }), request.body);
    authorizeEvery(principalOf(request), 'access.manage', []);
    return reply.status(201).send(await copyRole(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.put('/v1/roles/:roleId/permissions/:permission', async (request) => {
    const params = parse(z.object({ roleId: uuid, permission: z.string().regex(/^[a-z_]+(\.[a-z_]+)+$/).max(64) }), request.params);
    const { allowed } = parse(z.object({ allowed: z.boolean() }), request.body);
    authorizeEvery(principalOf(request), 'access.manage', []);
    return setRolePermission(db, callerOf(request), { ...params, allowed });
  });

  app.get('/v1/staff-accounts', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
    const principal = principalOf(request);
    authorize(principal, 'access.manage', facilityId);
    // People with no active grant belong to no clinic, so only every-clinic managers see them.
    const everywhere = principal.grants.get('access.manage')?.has(null) ?? false;
    return { items: await listStaffAccounts(db, callerOf(request), facilityId, everywhere) };
  });

  app.post('/v1/staff-accounts', async (request, reply) => {
    const body = parse(
      z.object({
        displayName: z.string().trim().min(2).max(100),
        employeeNo: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9._\/-]+$/),
        staffType: z.enum(STAFF_TYPES),
        email: z.email().max(254),
        phone: e164.optional(),
        roleId: uuid,
        facilityId: Scope,
      }),
      request.body,
    );
    atScope(request, 'staff.manage', body.facilityId);
    atScope(request, 'access.manage', body.facilityId);
    return reply.status(201).send(await createStaffAccount(db, callerOf(request), body, idempotencyKey(request)));
  });

  app.post('/v1/staff/:staffId/grants', async (request, reply) => {
    const { staffId } = parse(z.object({ staffId: uuid }), request.params);
    const body = parse(z.object({ roleId: uuid, facilityId: Scope }), request.body);
    atScope(request, 'access.manage', body.facilityId);
    return reply.status(201).send(await grantRole(db, callerOf(request), { staffId, ...body }, idempotencyKey(request)));
  });

  app.post('/v1/role-grants/:grantId/revoke', async (request) => {
    const { grantId } = parse(z.object({ grantId: uuid }), request.params);
    const { reason } = parse(z.object({ reason: Reason }), request.body);
    atScope(request, 'access.manage', await grantFacility(db, callerOf(request), grantId));
    return revokeGrant(db, callerOf(request), { grantId, reason });
  });

  // Status applies everywhere the person works, so staff.manage is needed at each of those clinics.
  app.post('/v1/staff/:staffId/status', async (request) => {
    const { staffId } = parse(z.object({ staffId: uuid }), request.params);
    const body = parse(z.object({ status: z.enum(['active', 'inactive']), reason: Reason }), request.body);
    const where = await staffFacilities(db, callerOf(request), staffId);
    if (where === undefined) throw new DomainError('not_found', 'staff member not found');
    authorizeEvery(principalOf(request), 'staff.manage', where ?? []);
    return setStaffStatus(db, callerOf(request), { staffId, ...body });
  });

  // The log spans every clinic and module and names patients by id: audit.read at every clinic.
  app.get('/v1/audit-events', async (request) => {
    const q = parse(AuditFilter.and(z.object({ limit: z.coerce.number().int().min(1).max(500).optional() })), request.query ?? {});
    authorizeEvery(principalOf(request), 'audit.read', []);
    const { limit, ...filter } = q;
    return listAuditEvents(db, callerOf(request), filter, limit ?? 50);
  });

  app.post('/v1/audit-events/export', async (request) => {
    const filter = parse(AuditFilter, request.body ?? {});
    authorizeEvery(principalOf(request), 'audit.read', []);
    return exportAuditEvents(db, callerOf(request), filter);
  });
}
