// Staff accounts and role grants (G16). Routes check the caller's permission at the clinic involved;
// these commands add the rules that need the database: no one grants more than they hold, nobody
// locks themselves out, and the tenant always keeps an every-clinic administrator.
import { sql, type DB, type Kysely } from '@hms/db';
import { conflict, DomainError, invalid, notFound, pgCode, runCommand, runQuery, type CommandContext } from '@hms/platform';
import type { Caller } from '../../caller.ts';

const deny = (message: string, details?: Record<string, unknown>) => new DomainError('forbidden', message, details);

export const STAFF_TYPES = ['doctor', 'nurse', 'technician', 'pharmacist', 'admin', 'support', 'other'] as const;
/** Integration roles belong to service accounts and are never granted from the workspace. */
const UNGRANTABLE_ROLES = ['booking_agent'];

export interface StaffAccountView {
  staffId: string;
  displayName: string;
  employeeNo: string;
  staffType: string;
  status: string;
  phone: string | null;
  email: string | null;
  /** Staff record version, for PATCH /v1/staff/:id. */
  version: number;
  account: { status: string; linked: boolean; inviteExpiresAt: string | null } | null;
  grants: { grantId: string; roleId: string; roleName: string; facilityId: string | null; facilityName: string | null }[];
}

/**
 * Staff with an active grant at this clinic or at every clinic (and, for every-clinic managers, staff
 * with no active grant at all). Grants elsewhere are not shown. Service accounts are never listed.
 */
export async function listStaffAccounts(db: Kysely<DB>, caller: Caller, facilityId: string, includeUngranted: boolean): Promise<StaffAccountView[]> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<StaffAccountView>`
      WITH grants AS (
        SELECT g.staff_id, g.id, g.role_id, r.name AS role_name, g.facility_id, f.name AS facility_name
        FROM platform.role_grant g
        JOIN platform.role r ON r.id = g.role_id
        LEFT JOIN platform.facility f ON f.id = g.facility_id
        WHERE g.revoked_at IS NULL AND g.valid_from <= now() AND (g.valid_to IS NULL OR g.valid_to > now())
      )
      SELECT s.id AS "staffId", s.display_name AS "displayName", s.employee_no AS "employeeNo", s.staff_type AS "staffType",
             s.status, s.phone, s.version, coalesce(ua.email::text, s.email::text) AS email,
             CASE WHEN ua.id IS NULL THEN NULL ELSE jsonb_build_object('status', ua.status, 'linked', ua.identity_subject IS NOT NULL, 'inviteExpiresAt', ua.invite_expires_at) END AS account,
             coalesce((SELECT jsonb_agg(jsonb_build_object('grantId', g.id, 'roleId', g.role_id, 'roleName', g.role_name,
                                                           'facilityId', g.facility_id, 'facilityName', g.facility_name)
                                        ORDER BY g.facility_name NULLS FIRST, g.role_name)
                       FROM grants g WHERE g.staff_id = s.id AND (g.facility_id IS NULL OR g.facility_id = ${facilityId})), '[]') AS grants
      FROM platform.staff s
      LEFT JOIN platform.user_account ua ON ua.staff_id = s.id
      WHERE NOT s.is_system_account
        AND (EXISTS (SELECT 1 FROM grants g WHERE g.staff_id = s.id AND (g.facility_id IS NULL OR g.facility_id = ${facilityId}))
             OR (${includeUngranted} AND NOT EXISTS (SELECT 1 FROM grants g WHERE g.staff_id = s.id)))
      ORDER BY s.display_name`.execute(tx);
    return rows;
  });
}

/** The grant scope, including revoked grants so permission-gated replay can reach its frozen receipt. */
export async function grantFacility(db: Kysely<DB>, caller: Caller, grantId: string): Promise<string | null | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const g = await tx.selectFrom('platform.role_grant').select('facility_id').where('id', '=', grantId).executeTakeFirst();
    return g ? g.facility_id : undefined;
  });
}

/** Clinics where a staff member holds active grants: null when any grant covers every clinic (or there are none). */
export async function staffFacilities(db: Kysely<DB>, caller: Caller, staffId: string): Promise<string[] | null | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const staff = await tx.selectFrom('platform.staff').select('is_system_account').where('id', '=', staffId).executeTakeFirst();
    if (!staff || staff.is_system_account) return undefined;
    const grants = await tx
      .selectFrom('platform.role_grant')
      .select('facility_id')
      .where('staff_id', '=', staffId)
      .where('revoked_at', 'is', null)
      .where((eb) => eb.or([eb('valid_to', 'is', null), eb('valid_to', '>', new Date())]))
      .execute();
    if (!grants.length || grants.some((g) => g.facility_id === null)) return null;
    return [...new Set(grants.map((g) => g.facility_id!))];
  });
}

// Access changes in a tenant run one at a time, so two administrators can't remove each other at once.
export const lockAccess = (ctx: CommandContext) => sql`SELECT pg_advisory_xact_lock(hashtextextended('access:' || ${ctx.tenantId}, 0))`.execute(ctx.tx);

/** Called under lockAccess: a principal resolved before a concurrent revocation is not write authority. */
export async function assertLiveAccessManager(ctx: CommandContext) {
  const { rows } = await sql`
    SELECT 1 FROM platform.staff_permission sp
    JOIN platform.staff s ON s.id = sp.staff_id AND s.status = 'active' AND NOT s.is_system_account
    JOIN platform.user_account ua ON ua.staff_id = s.id AND ua.status = 'active'
    WHERE sp.staff_id = ${ctx.actor.staffId ?? null} AND sp.permission = 'access.manage' AND sp.facility_id IS NULL
    LIMIT 1`.execute(ctx.tx);
  if (ctx.actor.kind !== 'staff' || !rows.length) throw deny('organization-wide access management was revoked; reload your account', { reason: 'access_revoked', permission: 'access.manage' });
}

/**
 * The caller may grant this role here only if they hold every permission in it here (or everywhere, for
 * every clinic). Emergency chart access (break_glass.use) is the one exception: whoever reviews its use
 * there (break_glass.review) may hand it out without holding it, so administrators can set up doctors.
 */
export async function assertCanGrant(ctx: CommandContext, roleId: string, facilityId: string | null) {
  const role = await ctx.tx.selectFrom('platform.role').select(['code', 'status', 'name']).where('id', '=', roleId).executeTakeFirst();
  if (!role || role.status !== 'active' || UNGRANTABLE_ROLES.includes(role.code)) throw notFound('role not found');
  const { rows: missing } = await sql<{ code: string }>`
    SELECT p.code FROM platform.role_permission rp JOIN platform.permission p ON p.id = rp.permission_id
    WHERE rp.role_id = ${roleId}
      AND NOT EXISTS (SELECT 1 FROM platform.staff_permission sp
                       WHERE sp.staff_id = ${ctx.actor.staffId!}
                         AND (sp.permission = p.code OR (p.code = 'break_glass.use' AND sp.permission = 'break_glass.review'))
                         AND (sp.facility_id IS NULL OR sp.facility_id = ${facilityId}))
    ORDER BY p.code`.execute(ctx.tx);
  if (missing.length) throw deny(`you can't grant ${role.name}: it includes permissions you don't hold there`, { reason: 'exceeds_own_access', permissions: missing.map((m) => m.code) });
  return role;
}

/** After a change: some active, signed-in-capable staff member must still manage access at every clinic. */
export async function assertAdministratorRemains(ctx: CommandContext) {
  const { rows } = await sql`
    SELECT 1 FROM platform.staff_permission sp
    JOIN platform.staff s ON s.id = sp.staff_id AND s.status = 'active' AND NOT s.is_system_account
    JOIN platform.user_account ua ON ua.staff_id = s.id AND ua.status IN ('active', 'invited')
    WHERE sp.permission = 'access.manage' AND sp.facility_id IS NULL
    LIMIT 1`.execute(ctx.tx);
  if (!rows.length) throw conflict('this would leave no one able to manage access at every clinic', { reason: 'last_administrator' });
}

async function insertGrant(ctx: CommandContext, staffId: string, roleId: string, facilityId: string | null) {
  const dup = await ctx.tx
    .selectFrom('platform.role_grant')
    .select('id')
    .where('staff_id', '=', staffId)
    .where('role_id', '=', roleId)
    .where((eb) => (facilityId ? eb('facility_id', '=', facilityId) : eb('facility_id', 'is', null)))
    .where('revoked_at', 'is', null)
    .executeTakeFirst();
  if (dup) throw conflict('this person already has that role there', { reason: 'already_granted' });
  const { id } = await ctx.tx
    .insertInto('platform.role_grant')
    .values({ tenant_id: ctx.tenantId, staff_id: staffId, role_id: roleId, facility_id: facilityId, granted_by: ctx.actor.staffId ?? null, created_by: ctx.actor.staffId ?? null })
    .returning('id')
    .executeTakeFirstOrThrow();
  ctx.audit({ action: 'create', subjectType: 'platform.role_grant', subjectId: id, diff: { staffId, roleId, facilityId } });
  return id;
}

export interface CreateStaffInput {
  displayName: string;
  employeeNo: string;
  staffType: (typeof STAFF_TYPES)[number];
  email: string;
  phone?: string | undefined;
  roleId: string;
  facilityId: string | null;
}

/** A staff member, an invited login for their work email, and their first role, together. */
export async function createStaffAccount(db: Kysely<DB>, caller: Caller, input: CreateStaffInput, idempotencyKey: string) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.create_staff_account', idempotencyKey, request: input }, async (ctx) => {
    await lockAccess(ctx);
    await assertCanGrant(ctx, input.roleId, input.facilityId);
    const email = input.email.trim().toLowerCase();
    const [given, ...rest] = input.displayName.trim().split(/\s+/);
    try {
      const staff = await ctx.tx
        .insertInto('platform.staff')
        .values({
          tenant_id: ctx.tenantId,
          employee_no: input.employeeNo,
          given_name: given!,
          family_name: rest.join(' ') || null,
          display_name: input.displayName.trim(),
          staff_type: input.staffType,
          email,
          phone: input.phone ?? null,
          created_by: ctx.actor.staffId ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const account = await ctx.tx
        .insertInto('platform.user_account')
        .values({ tenant_id: ctx.tenantId, staff_id: staff.id, email, status: 'invited', invite_expires_at: sql`now() + interval '14 days'`, created_by: ctx.actor.staffId ?? null })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'platform.staff', subjectId: staff.id, diff: { displayName: input.displayName.trim(), employeeNo: input.employeeNo, staffType: input.staffType } });
      ctx.audit({ action: 'create', subjectType: 'platform.user_account', subjectId: account.id, diff: { email, status: 'invited' } });
      const grantId = await insertGrant(ctx, staff.id, input.roleId, input.facilityId);
      return { staffId: staff.id, userAccountId: account.id, grantId, accountStatus: 'invited' };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('that employee number or work email is already in use', { reason: 'duplicate_staff' });
      throw err;
    }
  });
}

export async function grantRole(db: Kysely<DB>, caller: Caller, input: { staffId: string; roleId: string; facilityId: string | null }, idempotencyKey: string) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.grant_role', idempotencyKey, request: input }, async (ctx) => {
    await lockAccess(ctx);
    if (input.staffId === ctx.actor.staffId) throw conflict("you can't grant roles to yourself", { reason: 'self' });
    const staff = await ctx.tx.selectFrom('platform.staff').select(['is_system_account']).where('id', '=', input.staffId).executeTakeFirst();
    if (!staff || staff.is_system_account) throw notFound('staff member not found');
    await assertCanGrant(ctx, input.roleId, input.facilityId);
    return { grantId: await insertGrant(ctx, input.staffId, input.roleId, input.facilityId) };
  });
}

export async function revokeGrant(db: Kysely<DB>, caller: Caller, input: { grantId: string; reason: string }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.revoke_grant', idempotencyKey, request: input }, async (ctx) => {
    await lockAccess(ctx);
    const g = await ctx.tx
      .selectFrom('platform.role_grant as g')
      .innerJoin('platform.staff as s', 's.id', 'g.staff_id')
      .select(['g.staff_id', 'g.role_id', 'g.facility_id', 'g.revoked_at', 's.is_system_account'])
      .where('g.id', '=', input.grantId)
      .forUpdate('g')
      .executeTakeFirst();
    if (!g || g.revoked_at || g.is_system_account) throw notFound('grant not found');
    if (g.staff_id === ctx.actor.staffId) {
      const { rows } = await sql`
        SELECT 1 FROM platform.role_permission rp JOIN platform.permission p ON p.id = rp.permission_id
        WHERE rp.role_id = ${g.role_id} AND p.code = 'access.manage'`.execute(ctx.tx);
      if (rows.length) throw conflict("you can't remove your own access management", { reason: 'own_access' });
    }
    await ctx.tx.updateTable('platform.role_grant').set({ revoked_at: new Date(), revoked_by: ctx.actor.staffId ?? null }).where('id', '=', input.grantId).execute();
    await assertAdministratorRemains(ctx);
    ctx.audit({ action: 'status_change', subjectType: 'platform.role_grant', subjectId: input.grantId, reason: input.reason, diff: { status: ['active', 'revoked'] } });
    return { grantId: input.grantId, status: 'revoked' };
  });
}

export async function setStaffStatus(db: Kysely<DB>, caller: Caller, input: { staffId: string; status: 'active' | 'inactive'; reason: string }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.set_staff_status', idempotencyKey, request: input }, async (ctx) => {
    await lockAccess(ctx);
    if (input.staffId === ctx.actor.staffId) throw conflict("you can't change your own status", { reason: 'self' });
    const staff = await ctx.tx
      .selectFrom('platform.staff')
      .select(['status', 'is_system_account'])
      .where('id', '=', input.staffId)
      .forUpdate()
      .executeTakeFirst();
    if (!staff || staff.is_system_account) throw notFound('staff member not found');
    if (staff.status === input.status) return { staffId: input.staffId, status: input.status };
    if (staff.status === 'suspended') throw invalid('suspended staff are managed outside the workspace');
    await ctx.tx.updateTable('platform.staff').set({ status: input.status, updated_by: ctx.actor.staffId ?? null }).where('id', '=', input.staffId).execute();
    if (input.status === 'inactive') await assertAdministratorRemains(ctx);
    ctx.audit({ action: 'status_change', subjectType: 'platform.staff', subjectId: input.staffId, reason: input.reason, diff: { status: [staff.status, input.status] } });
    return { staffId: input.staffId, status: input.status };
  });
}
