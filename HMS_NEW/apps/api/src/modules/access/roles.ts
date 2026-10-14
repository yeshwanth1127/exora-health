// Roles and what they allow (G16). Built-in roles (tenant_id NULL) are shared by every hospital and read-only.
import { randomBytes } from 'node:crypto';
import { sql, type DB, type Kysely } from '@hms/db';
import { conflict, DomainError, notFound, runCommand, runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';
import { assertAdministratorRemains, assertCanGrant, assertLiveAccessManager, lockAccess } from './staff.ts';

export interface RoleView {
  roleId: string;
  code: string;
  name: string;
  builtIn: boolean;
  copiedFromRoleId: string | null;
  permissions: string[];
  version: number;
}

/** Active roles that can be granted from the workspace, and the permission list with descriptions. */
export async function listRoles(db: Kysely<DB>, caller: Caller) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows: roles } = await sql<RoleView>`
      SELECT r.id AS "roleId", r.code, r.name, r.is_system AS "builtIn", r.version, r.cloned_from_id AS "copiedFromRoleId",
             coalesce(array_agg(p.code ORDER BY p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
      FROM platform.role r
      LEFT JOIN platform.role_permission rp ON rp.role_id = r.id
      LEFT JOIN platform.permission p ON p.id = rp.permission_id
      WHERE r.status = 'active' AND r.code <> 'booking_agent'
      GROUP BY r.id
      ORDER BY r.is_system DESC, r.name`.execute(tx);
    const permissions = await tx
      .selectFrom('platform.permission')
      .select(['code', 'module_code as module', 'description', 'is_sensitive as sensitive'])
      .orderBy('module_code')
      .orderBy('code')
      .execute();
    return { roles, permissions };
  });
}

/** A clinic-owned copy of a role, which can then be edited. You must hold everything it copies, at every clinic. */
export async function copyRole(db: Kysely<DB>, caller: Caller, input: { name: string; copyOfRoleId: string }, idempotencyKey: string) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.copy_role', idempotencyKey, request: input }, async (ctx) => {
    await lockAccess(ctx);
    await assertLiveAccessManager(ctx);
    await assertCanGrant(ctx, input.copyOfRoleId, null);
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'role';
    const role = await ctx.tx
      .insertInto('platform.role')
      .values({ tenant_id: ctx.tenantId, code: `custom_${slug}_${randomBytes(3).toString('hex')}`, name: input.name, cloned_from_id: input.copyOfRoleId, created_by: ctx.actor.staffId ?? null })
      .returning(['id', 'code'])
      .executeTakeFirstOrThrow();
    await sql`INSERT INTO platform.role_permission (role_id, permission_id, created_by)
              SELECT ${role.id}, permission_id, ${ctx.actor.staffId ?? null} FROM platform.role_permission WHERE role_id = ${input.copyOfRoleId}`.execute(ctx.tx);
    ctx.audit({ action: 'create', subjectType: 'platform.role', subjectId: role.id, diff: { name: input.name, copyOf: input.copyOfRoleId } });
    return { roleId: role.id, code: role.code, name: input.name };
  });
}

/**
 * Switches one permission on or off for a clinic-owned role. Switching on needs that permission yourself
 * at every clinic (the role may be granted anywhere); switching off can't leave the tenant without an
 * every-clinic access manager.
 */
export async function setRolePermission(db: Kysely<DB>, caller: Caller, input: { roleId: string; permission: string; allowed: boolean; version: number }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.set_role_permission', idempotencyKey, request: input }, async (ctx) => {
    await lockAccess(ctx);
    await assertLiveAccessManager(ctx);
    const role = await ctx.tx.selectFrom('platform.role').select(['tenant_id', 'status', 'version']).where('id', '=', input.roleId).forUpdate().executeTakeFirst();
    if (!role || role.status !== 'active') throw notFound('role not found');
    if (role.tenant_id === null) throw conflict('built-in roles can\'t be changed; make a copy to customise', { reason: 'built_in' });
    if (role.version !== input.version) throw conflict('this role was changed by someone else; reload and review again', { reason: 'stale_version', currentVersion: role.version });
    const permission = await ctx.tx.selectFrom('platform.permission').select('id').where('code', '=', input.permission).executeTakeFirst();
    if (!permission) throw notFound('permission not found');
    if (input.allowed) {
      const { rows } = await sql`
        SELECT 1 FROM platform.staff_permission sp
        WHERE sp.staff_id = ${ctx.actor.staffId!} AND sp.facility_id IS NULL
          AND (sp.permission = ${input.permission} OR (${input.permission} = 'break_glass.use' AND sp.permission = 'break_glass.review'))
        LIMIT 1`.execute(ctx.tx);
      if (!rows.length) throw new DomainError('forbidden', "you can't switch on a permission you don't hold at every clinic", { reason: 'exceeds_own_access' });
      await ctx.tx
        .insertInto('platform.role_permission')
        .values({ role_id: input.roleId, permission_id: permission.id, created_by: ctx.actor.staffId ?? null })
        .onConflict((oc) => oc.columns(['role_id', 'permission_id']).doNothing())
        .execute();
    } else {
      await ctx.tx.deleteFrom('platform.role_permission').where('role_id', '=', input.roleId).where('permission_id', '=', permission.id).execute();
      await assertAdministratorRemains(ctx);
    }
    const saved = await ctx.tx.updateTable('platform.role').set({ updated_by: ctx.actor.staffId ?? null }).where('id', '=', input.roleId).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'update', subjectType: 'platform.role', subjectId: input.roleId, diff: { permission: input.permission, allowed: input.allowed } });
    return { roleId: input.roleId, permission: input.permission, allowed: input.allowed, version: saved.version };
  });
}

/** Retires a clinic-owned role nobody holds any more. Built-in roles and roles still granted stay. */
export async function retireRole(db: Kysely<DB>, caller: Caller, input: { roleId: string; reason: string }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.retire_role', idempotencyKey, request: input }, async (ctx) => {
    await lockAccess(ctx);
    await assertLiveAccessManager(ctx);
    const role = await ctx.tx.selectFrom('platform.role').select(['tenant_id', 'status', 'name']).where('id', '=', input.roleId).forUpdate().executeTakeFirst();
    if (!role || role.status !== 'active') throw notFound('role not found');
    if (role.tenant_id === null) throw conflict("built-in roles can't be retired", { reason: 'built_in' });
    const { rows: [held] } = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM platform.role_grant
      WHERE role_id = ${input.roleId} AND revoked_at IS NULL AND (valid_to IS NULL OR valid_to > now())`.execute(ctx.tx);
    if (held!.n) throw conflict('remove this role from everyone who holds it first', { reason: 'in_use', grants: held!.n });
    await ctx.tx.updateTable('platform.role').set({ status: 'inactive', updated_by: ctx.actor.staffId ?? null }).where('id', '=', input.roleId).execute();
    ctx.audit({ action: 'status_change', subjectType: 'platform.role', subjectId: input.roleId, reason: input.reason, diff: { status: ['active', 'inactive'] } });
    return { roleId: input.roleId, status: 'inactive' };
  });
}
