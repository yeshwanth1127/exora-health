// Who is making the request, for which tenant, and what they may do.
// A principal is resolved per request from the verified identity:
//   identity → user account(s) (any tenant) → chosen tenant → active staff member → permissions by facility.
import { sql, type DB, type Kysely } from '@hms/db';
import { DomainError, runQuery } from '@hms/platform';
import type { Identity } from './verify.ts';

export interface Principal {
  tenantId: string;
  userAccountId: string;
  staffId: string;
  staffType: string;
  displayName: string;
  isSystemAccount: boolean;
  /** permission → facilities it applies to (null = every facility). */
  grants: Map<string, Set<string | null>>;
}

export const forbidden = (message: string, details?: Record<string, unknown>) => new DomainError('forbidden', message, details);

export async function resolvePrincipal(db: Kysely<DB>, identity: Identity, requestedTenantId: string | undefined): Promise<Principal> {
  const { rows: accounts } = await sql<{ tenant_id: string; user_account_id: string; staff_id: string | null; patient_id: string | null; status: string }>`
    SELECT * FROM platform.accounts_for_identity(${identity.issuer}, ${identity.subject})`.execute(db);
  const active = accounts.filter((a) => a.status === 'active');
  if (!active.length) throw forbidden('no active account for this identity');

  let account = active[0]!;
  if (requestedTenantId) {
    const match = active.find((a) => a.tenant_id === requestedTenantId);
    if (!match) throw forbidden('no active account for this identity in the requested tenant');
    account = match;
  } else if (active.length > 1) {
    throw new DomainError('validation', 'this identity has accounts in several tenants; send the X-Tenant-Id header', {
      tenants: active.map((a) => a.tenant_id),
    });
  }
  if (!account.staff_id) throw forbidden('patient portal accounts are not supported by this API yet');

  return runQuery(db, account.tenant_id, async (tx) => {
    const staff = await tx
      .selectFrom('platform.staff')
      .select(['id', 'staff_type', 'display_name', 'status', 'is_system_account'])
      .where('id', '=', account.staff_id!)
      .executeTakeFirst();
    if (!staff || staff.status !== 'active') throw forbidden('staff member is not active');
    const rows = await tx.selectFrom('platform.staff_permission').select(['permission', 'facility_id']).where('staff_id', '=', staff.id).execute();
    const grants = new Map<string, Set<string | null>>();
    for (const r of rows) {
      if (!r.permission) continue;
      if (!grants.has(r.permission)) grants.set(r.permission, new Set());
      grants.get(r.permission)!.add(r.facility_id);
    }
    return {
      tenantId: account.tenant_id,
      userAccountId: account.user_account_id,
      staffId: staff.id,
      staffType: staff.staff_type,
      displayName: staff.display_name,
      isSystemAccount: staff.is_system_account,
      grants,
    };
  });
}

/**
 * Throws forbidden unless the principal holds `permission` — for the given facility when one is
 * known (a facility-wide grant or a grant for that facility), or anywhere when it isn't.
 */
export function authorize(principal: Principal, permission: string, facilityId?: string | null): void {
  const scopes = principal.grants.get(permission);
  let ok = false;
  if (scopes && scopes.size > 0) {
    if (scopes.has(null)) ok = true; // granted for every facility
    else if (facilityId == null) ok = true; // no specific facility involved: any grant suffices
    else ok = scopes.has(facilityId); // facility-scoped grant must match
  }
  if (!ok) throw forbidden(`missing permission ${permission}${facilityId ? ' for this facility' : ''}`, { permission, facilityId: facilityId ?? null });
}
