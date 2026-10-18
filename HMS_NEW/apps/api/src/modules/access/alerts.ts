// Per-person marks on derived alerts (docs/prd/staff-alerts.md). Alerts are computed in the staff app from
// records the person may already read; only who read, dismissed or snoozed which alert key is stored here.
import { sql, type DB, type Kysely } from '@hms/db';
import { runCommand, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';

export interface AlertStateView {
  key: string;
  readAt: string | null;
  dismissedAt: string | null;
  snoozedUntil: string | null;
}

/** Marks older than this are not returned; an alert that old has long since changed key or gone away. */
const KEEP_DAYS = 90;

const staffOf = (caller: Caller) => {
  if (!caller.actor.staffId) throw new Error('alert marks belong to a staff member');
  return caller.actor.staffId;
};

export async function listAlertState(db: Kysely<DB>, caller: Caller): Promise<AlertStateView[]> {
  const since = new Date(clock(caller).getTime() - KEEP_DAYS * 86_400_000);
  const rows = await runQuery(db, caller.tenantId, (tx) =>
    tx
      .selectFrom('platform.staff_alert_state')
      .select(['alert_key', 'read_at', 'dismissed_at', 'snoozed_until'])
      .where('staff_id', '=', staffOf(caller))
      .where('updated_at', '>=', since)
      .execute(),
  );
  return rows.map(view);
}

export interface AlertMark {
  read?: boolean | undefined;
  dismissed?: boolean | undefined;
  /** ISO instant, or null to un-snooze. */
  snoozedUntil?: string | null | undefined;
}

export async function markAlert(db: Kysely<DB>, caller: Caller, key: string, mark: AlertMark): Promise<AlertStateView> {
  const now = clock(caller);
  const set = {
    ...(mark.read !== undefined ? { read_at: mark.read ? now : null } : {}),
    ...(mark.dismissed !== undefined ? { dismissed_at: mark.dismissed ? now : null } : {}),
    ...(mark.snoozedUntil !== undefined ? { snoozed_until: mark.snoozedUntil ? new Date(mark.snoozedUntil) : null } : {}),
  };
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.mark_alert' }, async (ctx) => {
    const row = await ctx.tx
      .insertInto('platform.staff_alert_state')
      .values({ tenant_id: caller.tenantId, staff_id: staffOf(caller), alert_key: key, ...set })
      .onConflict((oc) => oc.columns(['tenant_id', 'staff_id', 'alert_key']).doUpdateSet(set))
      .returning(['alert_key', 'read_at', 'dismissed_at', 'snoozed_until'])
      .executeTakeFirstOrThrow();
    return view(row);
  });
}

/** Mark all read: one statement, existing dismiss/snooze marks untouched. */
export async function markAlertsRead(db: Kysely<DB>, caller: Caller, keys: string[]): Promise<{ updated: number }> {
  const now = clock(caller);
  const staffId = staffOf(caller);
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.mark_alerts_read' }, async (ctx) => {
    const rows = await ctx.tx
      .insertInto('platform.staff_alert_state')
      .values([...new Set(keys)].map((alert_key) => ({ tenant_id: caller.tenantId, staff_id: staffId, alert_key, read_at: now })))
      .onConflict((oc) => oc.columns(['tenant_id', 'staff_id', 'alert_key']).doUpdateSet({ read_at: now }))
      .returning('alert_key')
      .execute();
    return { updated: rows.length };
  });
}

const iso = (v: Date | string | null) => (v === null ? null : new Date(v).toISOString());
function view(r: { alert_key: string; read_at: Date | string | null; dismissed_at: Date | string | null; snoozed_until: Date | string | null }): AlertStateView {
  return { key: r.alert_key, readAt: iso(r.read_at), dismissedAt: iso(r.dismissed_at), snoozedUntil: iso(r.snoozed_until) };
}

export interface ExpiringRegistrationView {
  registrationId: string;
  staffId: string;
  staffName: string;
  council: string;
  validUntil: string;
}

/** Other staff members' registrations ending within `days` (or already ended), for people who manage staff. */
export async function listExpiringRegistrations(db: Kysely<DB>, caller: Caller, days: number, facilities: Set<string> | null): Promise<ExpiringRegistrationView[]> {
  const until = new Date(clock(caller).getTime() + days * 86_400_000).toISOString().slice(0, 10);
  // Registration management reaches every active clinic where the staff member works.
  // A clinic-scoped manager must not receive registrations for unrelated or cross-clinic staff.
  const visible = facilities === null ? sql<boolean>`true` : facilities.size === 0 ? sql<boolean>`false` : sql<boolean>`
    EXISTS (SELECT 1 FROM platform.role_grant g WHERE g.staff_id = s.id
      AND g.revoked_at IS NULL AND g.valid_from <= ${clock(caller)} AND (g.valid_to IS NULL OR g.valid_to > ${clock(caller)})
      AND g.facility_id IN (${sql.join([...facilities])}))
    AND NOT EXISTS (SELECT 1 FROM platform.role_grant g WHERE g.staff_id = s.id
      AND g.revoked_at IS NULL AND g.valid_from <= ${clock(caller)} AND (g.valid_to IS NULL OR g.valid_to > ${clock(caller)})
      AND (g.facility_id IS NULL OR g.facility_id NOT IN (${sql.join([...facilities])})))`;
  return runQuery(db, caller.tenantId, (tx) =>
    tx
      .selectFrom('platform.staff_registration as r')
      .innerJoin('platform.staff as s', 's.id', 'r.staff_id')
      .select(['r.id as registrationId', 'r.staff_id as staffId', 's.display_name as staffName', 'r.council', 'r.valid_until as validUntil'])
      .where('r.valid_until', 'is not', null)
      .where('r.valid_until', '<=', until)
      .where('r.staff_id', '!=', staffOf(caller))
      .where('s.is_system_account', '=', false)
      .where(visible)
      .orderBy('r.valid_until')
      .limit(200)
      .execute() as Promise<ExpiringRegistrationView[]>,
  );
}
