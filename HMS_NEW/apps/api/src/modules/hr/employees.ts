// Employment records for staff: the profile (where and as what they work, joining and exit), and the
// sensitive statutory and bank details payroll needs. platform.staff stays the identity; an exit is
// passed to the platform module (employee.exited) to end the staff record's active period.
import type { DB, Kysely, Transaction } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand } from '@hms/platform';
import type { Caller } from '../../caller.ts';

export interface ProfileInput {
  staffId: string;
  facilityId: string;
  designation: string;
  departmentId?: string | null | undefined;
  reportingToStaffId?: string | null | undefined;
  dateOfJoining: string;
  emergencyContactName?: string | null | undefined;
  emergencyContactPhone?: string | null | undefined;
  emergencyContactRelation?: string | null | undefined;
  address?: string | null | undefined;
  /** Required when updating an existing profile. */
  version?: number | undefined;
}

export async function saveProfile(db: Kysely<DB>, caller: Caller, input: ProfileInput, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.save_profile', idempotencyKey, request: input }, async (ctx) => {
    const staff = await ctx.tx.selectFrom('platform.staff').select(['id', 'is_system_account']).where('id', '=', input.staffId).executeTakeFirst();
    if (!staff || staff.is_system_account) throw notFound('staff member', { staffId: input.staffId });
    const values = {
      facility_id: input.facilityId, designation: input.designation, department_id: input.departmentId ?? null, reporting_to_staff_id: input.reportingToStaffId ?? null,
      date_of_joining: input.dateOfJoining, emergency_contact_name: input.emergencyContactName ?? null, emergency_contact_phone: input.emergencyContactPhone ?? null,
      emergency_contact_relation: input.emergencyContactRelation ?? null, address: input.address ?? null,
    };
    const existing = await ctx.tx.selectFrom('hr.employee_profile').selectAll().where('staff_id', '=', input.staffId).forUpdate().executeTakeFirst();
    try {
      if (!existing) {
        const p = await ctx.tx.insertInto('hr.employee_profile').values({ tenant_id: ctx.tenantId, staff_id: input.staffId, ...values, created_by: ctx.actor.staffId ?? null })
          .returning(['id', 'version']).executeTakeFirstOrThrow();
        ctx.audit({ action: 'create', subjectType: 'hr.employee_profile', subjectId: p.id, diff: { ...input } });
        return { staffId: input.staffId, version: p.version };
      }
      if (existing.version !== input.version) throw conflict('this profile was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: existing.version });
      if (existing.status === 'exited') throw preconditionFailed('this person has left; their profile is closed', { reason: 'exited' });
      const { version } = await ctx.tx.updateTable('hr.employee_profile').set({ ...values, updated_by: ctx.actor.staffId ?? null }).where('id', '=', existing.id).returning('version').executeTakeFirstOrThrow();
      ctx.audit({ action: 'update', subjectType: 'hr.employee_profile', subjectId: existing.id, diff: { ...input } });
      return { staffId: input.staffId, version };
    } catch (err) {
      if (pgCode(err) === '23503') throw invalid('the clinic, department or manager is not valid here', { reason: 'reference_mismatch' });
      throw err;
    }
  });
}

/** Records a resignation (notice) or the exit itself. */
export async function setEmploymentStatus(
  db: Kysely<DB>, caller: Caller, input: { staffId: string; status: 'active' | 'on_notice' | 'exited'; dateOfExit?: string | undefined; exitReason?: string | undefined; version: number },
  idempotencyKey?: string,
) {
  if (input.status === 'exited' && (!input.dateOfExit || !input.exitReason)) throw invalid('an exit needs the last working day and a reason', { reason: 'exit_details_required' });
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.set_employment_status', idempotencyKey, request: input }, async (ctx) => {
    const p = await ctx.tx.selectFrom('hr.employee_profile').selectAll().where('staff_id', '=', input.staffId).forUpdate().executeTakeFirst();
    if (!p) throw notFound('employment profile', { staffId: input.staffId });
    if (p.version !== input.version) throw conflict('this profile was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: p.version });
    if (p.status === 'exited') throw preconditionFailed('this person has already left', { reason: 'exited' });
    const { version } = await ctx.tx.updateTable('hr.employee_profile').set({
      status: input.status, date_of_exit: input.status === 'exited' ? input.dateOfExit! : null, exit_reason: input.status === 'exited' ? input.exitReason! : null,
      updated_by: ctx.actor.staffId ?? null,
    }).where('id', '=', p.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'hr.employee_profile', subjectId: p.id, reason: input.exitReason, diff: { status: [p.status, input.status], dateOfExit: input.dateOfExit ?? null } });
    if (input.status === 'exited') ctx.emit({ eventType: 'employee.exited', aggregateType: 'hr.employee_profile', aggregateId: p.id, payload: { staffId: input.staffId, dateOfExit: input.dateOfExit } });
    return { staffId: input.staffId, status: input.status, version };
  });
}

/** Consumer (platform): an exited employee's staff record ends on their last working day. */
export async function endStaffOnExit(tx: Transaction<DB>, staffId: string, dateOfExit: string) {
  await tx.updateTable('platform.staff').set({ active_to: dateOfExit }).where('id', '=', staffId).where((eb) => eb.or([eb('active_to', 'is', null), eb('active_to', '>', dateOfExit)])).execute();
}

export interface StatutoryInput {
  staffId: string;
  pan?: string | null | undefined;
  uan?: string | null | undefined;
  esicNo?: string | null | undefined;
  bankAccountNo?: string | null | undefined;
  bankIfsc?: string | null | undefined;
  bankName?: string | null | undefined;
  accountHolder?: string | null | undefined;
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptStateCode?: string | null | undefined;
}

export async function saveStatutory(db: Kysely<DB>, caller: Caller, input: StatutoryInput, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.save_statutory', idempotencyKey, request: input }, async (ctx) => {
    const profile = await ctx.tx.selectFrom('hr.employee_profile').select('id').where('staff_id', '=', input.staffId).executeTakeFirst();
    if (!profile) throw preconditionFailed('create the employment profile first', { reason: 'profile_required' });
    const values = {
      pan: input.pan ?? null, uan: input.uan ?? null, esic_no: input.esicNo ?? null, bank_account_no: input.bankAccountNo ?? null, bank_ifsc: input.bankIfsc ?? null,
      bank_name: input.bankName ?? null, account_holder: input.accountHolder ?? null, pf_applicable: input.pfApplicable, esi_applicable: input.esiApplicable,
      pt_state_code: input.ptStateCode ?? null,
    };
    const row = await ctx.tx.insertInto('hr.employee_statutory').values({ tenant_id: ctx.tenantId, staff_id: input.staffId, ...values, created_by: ctx.actor.staffId ?? null })
      .onConflict((oc) => oc.columns(['tenant_id', 'staff_id']).doUpdateSet({ ...values, updated_by: ctx.actor.staffId ?? null }))
      .returning(['id', 'version']).executeTakeFirstOrThrow();
    // Never echo the numbers into the audit trail.
    ctx.audit({ action: 'update', subjectType: 'hr.employee_statutory', subjectId: row.id, diff: { staffId: input.staffId, fields: Object.keys(values).filter((k) => values[k as keyof typeof values] !== null) } });
    return { staffId: input.staffId, version: row.version };
  });
}
