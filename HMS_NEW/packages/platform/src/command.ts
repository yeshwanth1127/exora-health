// The command runner: every write in the system goes through runCommand. One transaction that
//   1. sets the tenant (RLS) and acting staff member, and switches into the module's write role,
//   2. claims the idempotency key (a retried command returns the first result instead of acting twice),
//   3. runs the command,
//   4. writes its audit events and outbox events,
// and commits them together — or none of them.
import { createHash, randomUUID } from 'node:crypto';
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { DomainError } from './errors.ts';

export const MODULES = ['platform', 'patient', 'catalog', 'booking', 'clinical'] as const;
export type ModuleName = (typeof MODULES)[number];

export interface Actor {
  kind: 'staff' | 'patient' | 'system';
  staffId?: string | undefined;
  userId?: string | undefined;
}

export interface AuditInput {
  action: 'create' | 'update' | 'status_change' | 'view' | 'export' | 'print' | 'break_glass';
  subjectType: string;
  subjectId?: string | undefined;
  patientId?: string | null | undefined;
  reason?: string | undefined;
  diff?: Record<string, unknown> | undefined;
}

export interface EventInput {
  eventType: `${string}.${string}`;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion?: number | undefined;
  payload: Record<string, unknown>;
}

export interface CommandContext {
  readonly tx: Transaction<DB>;
  readonly tenantId: string;
  readonly actor: Actor;
  readonly correlationId: string;
  audit(entry: AuditInput): void;
  emit(event: EventInput): void;
}

export interface CommandOptions {
  tenantId: string;
  actor: Actor;
  module: ModuleName;
  /** Command name, e.g. 'booking.book_appointment'; scopes the idempotency key. */
  name: string;
  /** Client-supplied key. The same key with the same request returns the stored result. */
  idempotencyKey?: string | undefined;
  /** The request, hashed to detect a reused key with different input. */
  request?: unknown;
  correlationId?: string | undefined;
}

/** Deterministic JSON (sorted keys) so the same request always hashes the same. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sets the tenant (and optionally the acting staff member) for the current transaction. */
export async function setTransactionContext(tx: Transaction<DB>, tenantId: string, actorStaffId?: string): Promise<void> {
  if (!UUID.test(tenantId)) throw new DomainError('validation', 'tenantId must be a UUID');
  await sql`SELECT set_config('app.tenant_id', ${tenantId}, true), set_config('app.actor_staff_id', ${actorStaffId ?? ''}, true)`.execute(tx);
}

export async function runCommand<T>(db: Kysely<DB>, options: CommandOptions, fn: (ctx: CommandContext) => Promise<T>): Promise<T> {
  if (!MODULES.includes(options.module)) throw new DomainError('validation', `unknown module ${options.module}`);
  const correlationId = options.correlationId ?? randomUUID();

  return db.transaction().execute(async (tx) => {
    await setTransactionContext(tx, options.tenantId, options.actor.staffId);
    await sql`SET LOCAL ROLE ${sql.id(`mod_${options.module}`)}`.execute(tx);

    let idempotencyId: string | undefined;
    if (options.idempotencyKey) {
      const requestHash = createHash('sha256').update(stableStringify(options.request ?? null)).digest('hex');
      // ON CONFLICT DO NOTHING waits for a concurrent holder of the same key to finish first.
      const claimed = await tx
        .insertInto('platform.idempotency_record')
        .values({ tenant_id: options.tenantId, scope: options.name, key: options.idempotencyKey, request_hash: requestHash })
        .onConflict((oc) => oc.columns(['tenant_id', 'scope', 'key']).doNothing())
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        const existing = await tx
          .selectFrom('platform.idempotency_record')
          .select(['request_hash', 'status', 'result_ref'])
          .where('scope', '=', options.name)
          .where('key', '=', options.idempotencyKey)
          .executeTakeFirstOrThrow();
        if (existing.request_hash !== requestHash) {
          throw new DomainError('idempotency_conflict', 'idempotency key was already used with a different request');
        }
        if (existing.status === 'completed') return existing.result_ref as T;
        throw new DomainError('idempotency_conflict', 'a request with this idempotency key is still in progress');
      }
      idempotencyId = claimed.id;
    }

    const audits: AuditInput[] = [];
    const events: EventInput[] = [];
    const result = await fn({
      tx,
      tenantId: options.tenantId,
      actor: options.actor,
      correlationId,
      audit: (entry) => audits.push(entry),
      emit: (event) => events.push(event),
    });

    await writeAudit(tx, options.tenantId, options.actor, correlationId, audits);
    await writeOutbox(tx, options.tenantId, correlationId, events);
    if (idempotencyId) {
      await tx
        .updateTable('platform.idempotency_record')
        .set({ status: 'completed', result_ref: JSON.stringify(result ?? null) })
        .where('id', '=', idempotencyId)
        .execute();
    }
    return result;
  });
}

/** Inserts audit events in the current transaction (used by runCommand and by event consumers). */
export async function writeAudit(tx: Transaction<DB>, tenantId: string, actor: Actor | null, correlationId: string | null, audits: AuditInput[]): Promise<void> {
  if (!audits.length) return;
  await tx
    .insertInto('platform.audit_event')
    .values(
      audits.map((a) => ({
        tenant_id: tenantId,
        actor_staff_id: actor?.staffId ?? null,
        actor_user_id: actor?.userId ?? null,
        action: a.action,
        subject_type: a.subjectType,
        subject_id: a.subjectId ?? null,
        patient_id: a.patientId ?? null,
        reason: a.reason ?? null,
        diff: a.diff ? JSON.stringify(a.diff) : null,
        correlation_id: correlationId,
      })),
    )
    .execute();
}

/** Inserts outbox events in the current transaction (used by runCommand and by event consumers). */
export async function writeOutbox(tx: Transaction<DB>, tenantId: string, correlationId: string | null, events: EventInput[]): Promise<void> {
  if (!events.length) return;
  await tx
    .insertInto('platform.outbox_event')
    .values(
      events.map((e) => ({
        tenant_id: tenantId,
        event_type: e.eventType,
        aggregate_type: e.aggregateType,
        aggregate_id: e.aggregateId,
        aggregate_version: e.aggregateVersion ?? null,
        payload: JSON.stringify(e.payload),
        correlation_id: correlationId,
      })),
    )
    .execute();
}

/** Read-only work for a tenant (no module role needed: the app role reads every module). */
export async function runQuery<T>(db: Kysely<DB>, tenantId: string, fn: (tx: Transaction<DB>) => Promise<T>): Promise<T> {
  return db.transaction().execute(async (tx) => {
    await setTransactionContext(tx, tenantId);
    return fn(tx);
  });
}
