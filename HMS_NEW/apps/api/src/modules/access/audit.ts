// The activity log (G18): the tenant's audit events, newest first, with the acting staff member's name.
// Rows span every clinic and carry patient ids, so routes require audit.read at every clinic.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { runCommand, runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';

export const EXPORT_LIMIT = 5000;

export interface AuditFilter {
  actor?: string | undefined;
  /** A record id (any subject or patient) or a patient MRN. */
  record?: string | undefined;
  action?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export interface AuditEventView {
  auditEventId: string;
  occurredAt: Date;
  actorStaffId: string | null;
  actorName: string | null;
  actorIsSystem: boolean;
  action: string;
  subjectType: string;
  subjectId: string | null;
  patientId: string | null;
  reason: string | null;
  diff: unknown;
  correlationId: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Wildcards typed by the user are literal.
const contains = (s: string | undefined) => (s ? `%${s.toLowerCase().replace(/[\\%_]/g, '\\$&')}%` : null);

async function selectEvents(tx: Transaction<DB>, f: AuditFilter, limit: number) {
  const record = f.record?.trim() || null;
  const recordId = record && UUID.test(record) ? record : null;
  const mrn = record && !recordId ? record : null;
  const { rows } = await sql<AuditEventView>`
    WITH tz AS (SELECT default_timezone AS zone FROM platform.tenant WHERE id = platform.current_tenant_id())
    SELECT a.id AS "auditEventId", a.occurred_at AS "occurredAt", a.actor_staff_id AS "actorStaffId",
           s.display_name AS "actorName", coalesce(s.is_system_account, a.actor_staff_id IS NULL) AS "actorIsSystem",
           a.action, a.subject_type AS "subjectType", a.subject_id AS "subjectId", a.patient_id AS "patientId",
           a.reason, a.diff, a.correlation_id AS "correlationId"
    FROM platform.audit_event a
    CROSS JOIN tz
    LEFT JOIN platform.staff s ON s.id = a.actor_staff_id
    WHERE (${contains(f.actor)}::text IS NULL OR lower(s.display_name) LIKE ${contains(f.actor)})
      AND (${recordId}::uuid IS NULL OR a.subject_id = ${recordId}::uuid OR a.patient_id = ${recordId}::uuid)
      AND (${mrn}::text IS NULL OR a.patient_id = (SELECT p.id FROM patient.patient p WHERE p.mrn = ${mrn}))
      AND (${contains(f.action)}::text IS NULL OR lower(a.action || ' ' || a.subject_type) LIKE ${contains(f.action)})
      AND (${f.from ?? null}::date IS NULL OR a.occurred_at >= (${f.from ?? null}::date::timestamp AT TIME ZONE tz.zone))
      AND (${f.to ?? null}::date IS NULL OR a.occurred_at < ((${f.to ?? null}::date + 1)::timestamp AT TIME ZONE tz.zone))
    ORDER BY a.occurred_at DESC, a.id DESC
    LIMIT ${limit}`.execute(tx);
  return rows;
}

/** One page of the log; `more` says whether older matching events exist. */
export async function listAuditEvents(db: Kysely<DB>, caller: Caller, f: AuditFilter, limit: number) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const rows = await selectEvents(tx, f, limit + 1);
    return { items: rows.slice(0, limit), more: rows.length > limit };
  });
}

/** Up to EXPORT_LIMIT matching events. The export is recorded (filters and row count) before any row is returned. */
export async function exportAuditEvents(db: Kysely<DB>, caller: Caller, f: AuditFilter) {
  const rows = await runQuery(db, caller.tenantId, (tx) => selectEvents(tx, f, EXPORT_LIMIT + 1));
  const items = rows.slice(0, EXPORT_LIMIT),
    truncated = rows.length > EXPORT_LIMIT;
  await runCommand(db, { ...caller, module: 'platform', name: 'platform.export_audit_events' }, async (ctx) => {
    ctx.audit({ action: 'export', subjectType: 'platform.audit_event', diff: { filters: f, rows: items.length, truncated } });
  });
  return { items, truncated };
}
