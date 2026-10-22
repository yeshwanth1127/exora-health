// Workspace administration beyond accounts and roles (ERD m01): professional registrations, care
// assignments, break-glass review, module switches, invites that expire, and the session context.
import { sql, type DB, type Kysely } from '@hms/db';
import { conflict, DomainError, invalid, notFound, pgCode, preconditionFailed, runCommand, runQuery, SWITCHED_MODULES } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';

// ---- professional registrations (signing needs a current one) -----------------------------------------

export interface RegistrationView {
  registrationId: string;
  staffId: string;
  council: string;
  registrationNo: string;
  validUntil: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  version: number;
}

export async function listRegistrations(db: Kysely<DB>, caller: Caller, staffId: string): Promise<RegistrationView[]> {
  return runQuery(db, caller.tenantId, (tx) =>
    tx
      .selectFrom('platform.staff_registration')
      .select([
        'id as registrationId', 'staff_id as staffId', 'council', 'registration_no as registrationNo', 'valid_until as validUntil',
        'verified_at as verifiedAt', 'verified_by as verifiedBy', 'version',
      ])
      .where('staff_id', '=', staffId)
      .orderBy('valid_until', 'desc')
      .execute() as Promise<RegistrationView[]>,
  );
}

export async function registrationStaff(db: Kysely<DB>, caller: Caller, registrationId: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('platform.staff_registration').select('staff_id').where('id', '=', registrationId).executeTakeFirst())?.staff_id);
}

export async function addRegistration(
  db: Kysely<DB>,
  caller: Caller,
  input: { staffId: string; council: string; registrationNo: string; validUntil: string | null },
  idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.add_registration', idempotencyKey, request: input }, async (ctx) => {
    const staff = await ctx.tx.selectFrom('platform.staff').select('is_system_account').where('id', '=', input.staffId).executeTakeFirst();
    if (!staff || staff.is_system_account) throw notFound('staff member', { staffId: input.staffId });
    try {
      const { id } = await ctx.tx
        .insertInto('platform.staff_registration')
        .values({ tenant_id: ctx.tenantId, staff_id: input.staffId, council: input.council, registration_no: input.registrationNo, valid_until: input.validUntil, created_by: ctx.actor.staffId ?? null })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'platform.staff_registration', subjectId: id, diff: { staffId: input.staffId, council: input.council, registrationNo: input.registrationNo, validUntil: input.validUntil } });
      return { registrationId: id };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('that council registration is already recorded', { reason: 'duplicate_registration' });
      throw err;
    }
  });
}

/** Renewing changes the expiry and clears verification; verifying is done by someone else. */
export async function updateRegistration(
  db: Kysely<DB>,
  caller: Caller,
  input: { registrationId: string; version: number; validUntil?: string | null | undefined; verify?: boolean | undefined },

  idempotencyKey?: string,
) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.update_registration', idempotencyKey, request: input }, async (ctx) => {
    const r = await ctx.tx.selectFrom('platform.staff_registration').selectAll().where('id', '=', input.registrationId).forUpdate().executeTakeFirst();
    if (!r) throw notFound('registration', { registrationId: input.registrationId });
    if (r.version !== input.version) throw conflict('this registration was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: r.version });
    const set: Record<string, unknown> = {};
    if (input.validUntil !== undefined && input.validUntil !== r.valid_until) Object.assign(set, { valid_until: input.validUntil, verified_at: null, verified_by: null });
    if (input.verify) {
      if (r.staff_id === ctx.actor.staffId) throw new DomainError('forbidden', "you can't verify your own registration", { reason: 'self' });
      Object.assign(set, { verified_at: clock(caller), verified_by: ctx.actor.staffId ?? null });
    }
    if (!Object.keys(set).length) return { registrationId: r.id, version: r.version };
    const { version } = await ctx.tx.updateTable('platform.staff_registration').set({ ...set, updated_by: ctx.actor.staffId ?? null }).where('id', '=', r.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'update', subjectType: 'platform.staff_registration', subjectId: r.id, diff: { validUntil: input.validUntil, verified: !!input.verify } });
    return { registrationId: r.id, version };
  });
}

// ---- care assignments (who may open a patient's chart besides the encounter team) -----------------------

export interface CareAssignmentView {
  careAssignmentId: string;
  staffId: string;
  staffName: string;
  patientId: string | null;
  encounterId: string | null;
  reason: string;
  validFrom: string;
  validTo: string | null;
}

export async function listCareAssignments(db: Kysely<DB>, caller: Caller, f: { patientId?: string | undefined; staffId?: string | undefined }): Promise<CareAssignmentView[]> {
  return runQuery(db, caller.tenantId, async (tx) => {
    let q = tx
      .selectFrom('platform.care_assignment as c')
      .innerJoin('platform.staff as s', 's.id', 'c.staff_id')
      .select(['c.id as careAssignmentId', 'c.staff_id as staffId', 's.display_name as staffName', 'c.patient_id as patientId', 'c.encounter_id as encounterId', 'c.reason', 'c.valid_from as validFrom', 'c.valid_to as validTo']);
    if (f.patientId) q = q.where('c.patient_id', '=', f.patientId);
    if (f.staffId) q = q.where('c.staff_id', '=', f.staffId);
    return (await q.orderBy('c.valid_from', 'desc').limit(200).execute()).map((r) => ({ ...r, validFrom: new Date(r.validFrom).toISOString(), validTo: r.validTo ? new Date(r.validTo).toISOString() : null }));
  });
}

export async function assignCare(
  db: Kysely<DB>,
  caller: Caller,
  input: { staffId: string; patientId: string; reason: 'attending' | 'consulting' | 'nursing' | 'cover' | 'other'; validTo: string | null },
  idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.assign_care', idempotencyKey, request: input }, async (ctx) => {
    const staff = await ctx.tx.selectFrom('platform.staff').select(['status', 'is_system_account']).where('id', '=', input.staffId).executeTakeFirst();
    if (!staff || staff.is_system_account) throw notFound('staff member', { staffId: input.staffId });
    if (staff.status !== 'active') throw preconditionFailed('this person is not active');
    const now = clock(caller);
    if (input.validTo && new Date(input.validTo) <= now) throw invalid('the end must be in the future');
    try {
      const { id } = await ctx.tx
        .insertInto('platform.care_assignment')
        .values({ tenant_id: ctx.tenantId, staff_id: input.staffId, patient_id: input.patientId, reason: input.reason, valid_from: now, valid_to: input.validTo, created_by: ctx.actor.staffId ?? null })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'platform.care_assignment', subjectId: id, patientId: input.patientId, diff: { staffId: input.staffId, reason: input.reason, validTo: input.validTo } });
      return { careAssignmentId: id };
    } catch (err) {
      if (pgCode(err) === '23503') throw notFound('patient', { patientId: input.patientId });
      throw err;
    }
  });
}

export async function endCareAssignment(db: Kysely<DB>, caller: Caller, input: { careAssignmentId: string; reason: string }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.end_care_assignment', idempotencyKey, request: input }, async (ctx) => {
    const c = await ctx.tx.selectFrom('platform.care_assignment').selectAll().where('id', '=', input.careAssignmentId).forUpdate().executeTakeFirst();
    if (!c) throw notFound('care assignment', { careAssignmentId: input.careAssignmentId });
    const now = clock(caller);
    if (c.valid_to && c.valid_to <= now) return { careAssignmentId: c.id, validTo: c.valid_to };
    await ctx.tx.updateTable('platform.care_assignment').set({ valid_to: now, updated_by: ctx.actor.staffId ?? null }).where('id', '=', c.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'platform.care_assignment', subjectId: c.id, patientId: c.patient_id, reason: input.reason, diff: { validTo: [c.valid_to, now] } });
    return { careAssignmentId: c.id, validTo: now };
  });
}

// ---- break-glass review (G18): someone other than the user reviews each emergency access ----------------

export interface BreakGlassView {
  grantId: string;
  staffId: string;
  staffName: string;
  patientId: string;
  mrn: string;
  reason: string;
  grantedAt: string;
  expiresAt: string;
  reviewedBy: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewOutcome: string | null;
  chartViews: number;
}

export async function listBreakGlass(db: Kysely<DB>, caller: Caller, f: { status: 'pending' | 'reviewed' | 'all'; limit: number }): Promise<BreakGlassView[]> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<BreakGlassView>`
      SELECT g.id AS "grantId", g.staff_id AS "staffId", s.display_name AS "staffName", g.patient_id AS "patientId", p.mrn,
             g.reason, g.granted_at AS "grantedAt", g.expires_at AS "expiresAt", g.reviewed_by AS "reviewedBy",
             r.display_name AS "reviewerName", g.reviewed_at AS "reviewedAt", g.review_outcome AS "reviewOutcome",
             (SELECT count(*)::int FROM platform.audit_event a
               WHERE a.patient_id = g.patient_id AND a.actor_staff_id = g.staff_id AND a.occurred_at BETWEEN g.granted_at AND g.expires_at) AS "chartViews"
      FROM platform.emergency_access_grant g
      JOIN platform.staff s ON s.id = g.staff_id
      JOIN patient.patient p ON p.id = g.patient_id
      LEFT JOIN platform.staff r ON r.id = g.reviewed_by
      WHERE ${f.status} = 'all' OR (${f.status} = 'pending') = (g.reviewed_at IS NULL)
      ORDER BY g.granted_at DESC
      LIMIT ${f.limit}`.execute(tx);
    return rows;
  });
}

export async function reviewBreakGlass(db: Kysely<DB>, caller: Caller, input: { grantId: string; outcome: 'appropriate' | 'inappropriate'; note: string }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.review_break_glass', idempotencyKey, request: input }, async (ctx) => {
    const g = await ctx.tx.selectFrom('platform.emergency_access_grant').selectAll().where('id', '=', input.grantId).forUpdate().executeTakeFirst();
    if (!g) throw notFound('emergency access', { grantId: input.grantId });
    if (g.reviewed_at) throw conflict('this emergency access was already reviewed', { reason: 'already_reviewed' });
    if (g.staff_id === ctx.actor.staffId) throw new DomainError('forbidden', "you can't review your own emergency access", { reason: 'self' });
    const now = clock(caller);
    await ctx.tx.updateTable('platform.emergency_access_grant').set({ reviewed_by: ctx.actor.staffId ?? null, reviewed_at: now, review_outcome: input.outcome, updated_by: ctx.actor.staffId ?? null }).where('id', '=', g.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'platform.emergency_access_grant', subjectId: g.id, patientId: g.patient_id, reason: input.note, diff: { outcome: input.outcome } });
    if (input.outcome === 'inappropriate') {
      ctx.emit({ eventType: 'access.break_glass_inappropriate', aggregateType: 'platform.emergency_access_grant', aggregateId: g.id, payload: { grantId: g.id, staffId: g.staff_id } });
    }
    return { grantId: g.id, reviewOutcome: input.outcome, reviewedAt: now, reviewerStaffId: ctx.actor.staffId! };
  });
}

// ---- module switches (G17) ------------------------------------------------------------------------------

export const MODULES = [
  'platform', 'patient', 'catalog', 'booking', 'clinical', 'diagnostics', 'inpatient', 'theatre', 'pharmacy', 'inventory', 'billing',
  'insurance', 'comms', 'documents', 'operations', 'integration', 'abdm', 'hr',
] as const;
export type ModuleCode = (typeof MODULES)[number];
/** The core never switches off: everything else hangs off it. */
const CORE: ModuleCode[] = ['platform', 'patient', 'catalog', 'booking', 'clinical'];
type ModuleStatus = 'not_provisioned' | 'configured' | 'validated' | 'active' | 'suspended' | 'retired';
const NEXT: Record<ModuleStatus, ModuleStatus[]> = {
  not_provisioned: ['configured', 'active'],
  configured: ['validated', 'active', 'not_provisioned'],
  validated: ['active', 'configured'],
  active: ['suspended'],
  suspended: ['active', 'retired'],
  retired: ['configured'],
};

/**
 * A module's state. A module with no row is active (tenants created before switches existed keep
 * working), except the separately switched clinic modules (SWITCHED_MODULES), which stay off until
 * switched on. Suspended modules refuse new work; their records stay readable.
 */
const stateOf = (module: string, row: { state: string } | undefined) =>
  (row?.state ?? (SWITCHED_MODULES.includes(module) ? 'not_provisioned' : 'active')) as ModuleStatus;
/** Inventory is the pharmacy's stock: it is switched with pharmacy, never on its own. */
const SWITCHED_TOGETHER: Partial<Record<ModuleCode, ModuleCode[]>> = { pharmacy: ['pharmacy', 'inventory'] };
/** A module that can only be on while another is (inpatient discharge needs finance clearance). */
const REQUIRES: Partial<Record<ModuleCode, ModuleCode>> = { inpatient: 'billing' };
export async function moduleStates(db: Kysely<DB>, caller: Caller) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const rows = await tx.selectFrom('platform.module_state').select(['module_code', 'state', 'config_version', 'version', 'updated_at']).execute();
    const by = new Map(rows.map((r) => [r.module_code, r]));
    return MODULES.map((m) => {
      const r = by.get(m);
      return { module: m, state: stateOf(m, r), core: CORE.includes(m), version: r?.version ?? 0, updatedAt: r?.updated_at ?? null };
    });
  });
}

export async function setModuleState(db: Kysely<DB>, caller: Caller, input: { module: ModuleCode; state: ModuleStatus; version: number; reason: string }, idempotencyKey?: string) {
  if (CORE.includes(input.module)) throw invalid('core modules are always on', { reason: 'core_module' });
  if (input.module === 'inventory') throw invalid('inventory is switched on and off with pharmacy', { reason: 'switched_with', module: 'pharmacy' });
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.set_module_state', idempotencyKey, request: input }, async (ctx) => {
    const rows = await ctx.tx.selectFrom('platform.module_state').selectAll().forUpdate().execute();
    const by = new Map(rows.map((x) => [x.module_code as string, x]));
    const r = by.get(input.module);
    const from = stateOf(input.module, r);
    if ((r?.version ?? 0) !== input.version) throw conflict('this module was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: r?.version ?? 0 });
    if (from === input.state) return { module: input.module, state: from, version: r?.version ?? 0 };
    if (!NEXT[from].includes(input.state)) throw preconditionFailed(`a module can't go from ${from} to ${input.state}`, { reason: 'invalid_transition', allowed: NEXT[from] });
    const needs = REQUIRES[input.module];
    if (needs && input.state === 'active' && stateOf(needs, by.get(needs)) !== 'active') {
      throw preconditionFailed(`switch on ${needs} before ${input.module}`, { reason: 'module_required', module: needs });
    }
    if (input.state !== 'active') {
      const dependant = (Object.entries(REQUIRES) as [ModuleCode, ModuleCode][]).find(([m, req]) => req === input.module && stateOf(m, by.get(m)) === 'active');
      if (dependant) throw preconditionFailed(`${dependant[0]} needs ${input.module}; switch ${dependant[0]} off first`, { reason: 'module_required_by', module: dependant[0] });
    }
    let version = 0;
    for (const module of SWITCHED_TOGETHER[input.module] ?? [input.module]) {
      const cur = by.get(module);
      const was = stateOf(module, cur);
      if (was === input.state) continue;
      const row = cur
        ? await ctx.tx.updateTable('platform.module_state').set({ state: input.state, config_version: cur.config_version + 1, changed_by: ctx.actor.staffId ?? null, updated_by: ctx.actor.staffId ?? null }).where('id', '=', cur.id).returning(['id', 'version']).executeTakeFirstOrThrow()
        : await ctx.tx.insertInto('platform.module_state').values({ tenant_id: ctx.tenantId, module_code: module, state: input.state, changed_by: ctx.actor.staffId ?? null, created_by: ctx.actor.staffId ?? null }).returning(['id', 'version']).executeTakeFirstOrThrow();
      if (module === input.module) version = row.version;
      ctx.audit({ action: 'status_change', subjectType: 'platform.module_state', subjectId: row.id, reason: input.reason, diff: { module, state: [was, input.state] } });
      ctx.emit({ eventType: input.state === 'suspended' ? 'module.suspended' : 'module.state_changed', aggregateType: 'platform.module_state', aggregateId: row.id, payload: { module, from: was, to: input.state } });
    }
    return { module: input.module, state: input.state, version };
  });
}

/** Refuses new work in a module that isn't active (reads stay available). */
export async function assertModuleActive(db: Kysely<DB>, caller: Caller, module: ModuleCode) {
  const state = await runQuery(db, caller.tenantId, async (tx) => stateOf(module, await tx.selectFrom('platform.module_state').select('state').where('module_code', '=', module).executeTakeFirst()));
  if (state !== 'active') throw preconditionFailed(`the ${module} module is ${state.replaceAll('_', ' ')} for this hospital`, { reason: 'module_inactive', module, state });
}

// ---- invites ---------------------------------------------------------------------------------------------

/** Gives an unused invite 14 more days (e.g. it expired before the person first signed in). */
export async function renewInvite(db: Kysely<DB>, caller: Caller, input: { staffId: string }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.renew_invite', idempotencyKey, request: input }, async (ctx) => {
    const ua = await ctx.tx.selectFrom('platform.user_account').select(['id', 'status', 'identity_subject']).where('staff_id', '=', input.staffId).forUpdate().executeTakeFirst();
    if (!ua) throw notFound('invite', { staffId: input.staffId });
    if (ua.identity_subject || ua.status !== 'invited') throw conflict('this person has already signed in', { reason: 'already_linked' });
    const expires = new Date(clock(caller).getTime() + 14 * 86_400_000);
    await ctx.tx.updateTable('platform.user_account').set({ invite_expires_at: expires, updated_by: ctx.actor.staffId ?? null }).where('id', '=', ua.id).execute();
    ctx.audit({ action: 'update', subjectType: 'platform.user_account', subjectId: ua.id, diff: { inviteExpiresAt: expires.toISOString() } });
    return { staffId: input.staffId, inviteExpiresAt: expires };
  });
}

// ---- session context (G02) ------------------------------------------------------------------------------

export async function sessionContext(db: Kysely<DB>, caller: Caller, facilityIds: string[] | null) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const tenant = await tx.selectFrom('platform.tenant').select(['id as tenantId', 'name', 'slug', 'status', 'default_currency as currency', 'default_timezone as timezone']).executeTakeFirstOrThrow();
    let q = tx.selectFrom('platform.facility').select(['id as facilityId', 'code', 'name', 'facility_type as facilityType', 'city', 'timezone']).where('status', '=', 'active');
    if (facilityIds) q = q.where('id', 'in', facilityIds.length ? facilityIds : ['00000000-0000-0000-0000-000000000000']);
    const facilities = await q.orderBy('name').execute();
    const total = await tx.selectFrom('platform.facility').select(({ fn }) => fn.countAll<number>().as('n')).where('status', '=', 'active').executeTakeFirstOrThrow();
    const organization = await tx.selectFrom('platform.organization').select('id').where('parent_id', 'is', null).where('status', '=', 'active').executeTakeFirst();
    const setup = await tx.selectFrom('platform.staff_permission').select('staff_id').where('staff_id', '=', caller.actor.staffId ?? '').where('permission', '=', 'facility.manage').where('facility_id', 'is', null).executeTakeFirst();
    return { tenant, facilities, bootstrap: { state: Number(total.n) === 0 ? 'zero_clinics' : facilities.length === 0 ? 'inaccessible_clinics' : 'ready', canCreateClinic: !!setup && !!organization && caller.actor.kind === 'staff', organizationProvisioned: !!organization } };
  });
}

export async function tenantsForIdentity(db: Kysely<DB>, issuer: string, subject: string) {
  const { rows } = await sql<{ tenant_id: string; name: string }>`SELECT * FROM platform.tenants_for_identity(${issuer}, ${subject})`.execute(db);
  return rows.map((r) => ({ tenantId: r.tenant_id, name: r.name }));
}
