// Outbox delivery. Claims a batch of committed events (across tenants), and hands each to every
// matching handler in its own transaction — tenant context set, handler's module write role, and an
// inbox record so a redelivered event is never handled twice by the same consumer. An event is marked
// delivered only when all its handlers succeed; otherwise it is retried with backoff and eventually
// dead-lettered.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { setTransactionContext, type ModuleName } from '@hms/platform';

export interface OutboxEvent {
  id: string;
  occurredAt: Date;
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number | null;
  payload: Record<string, unknown>;
  correlationId: string | null;
  attempts: number;
}

export interface EventHandler {
  /** Stable consumer name; part of the inbox key. */
  consumer: string;
  /** Event types this handler wants, or '*' for all. */
  eventTypes: readonly string[] | '*';
  /** Write role the handler runs under. */
  module: ModuleName;
  handle(tx: Transaction<DB>, event: OutboxEvent): Promise<void>;
}

export interface DispatchResult {
  claimed: number;
  delivered: number;
  failed: number;
}

export interface DispatchOptions {
  batchSize?: number;
  leaseSeconds?: number;
  maxAttempts?: number;
  log?: (msg: string, data?: Record<string, unknown>) => void;
}

const handles = (h: EventHandler, eventType: string) => h.eventTypes === '*' || h.eventTypes.includes(eventType);

export async function dispatchOnce(db: Kysely<DB>, handlers: readonly EventHandler[], opts: DispatchOptions = {}): Promise<DispatchResult> {
  const { rows } = await sql<{
    id: string;
    occurred_at: Date;
    tenant_id: string;
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    aggregate_version: number | null;
    payload: Record<string, unknown>;
    correlation_id: string | null;
    attempts: number;
  }>`SELECT * FROM platform.claim_outbox_events(${opts.batchSize ?? 50}, make_interval(secs => ${opts.leaseSeconds ?? 60}))`.execute(db);

  let delivered = 0;
  let failed = 0;
  for (const r of rows) {
    const event: OutboxEvent = {
      id: r.id,
      occurredAt: r.occurred_at,
      tenantId: r.tenant_id,
      eventType: r.event_type,
      aggregateType: r.aggregate_type,
      aggregateId: r.aggregate_id,
      aggregateVersion: r.aggregate_version,
      payload: r.payload,
      correlationId: r.correlation_id,
      attempts: r.attempts,
    };
    try {
      for (const handler of handlers.filter((h) => handles(h, event.eventType))) {
        await db.transaction().execute(async (tx) => {
          await setTransactionContext(tx, event.tenantId);
          await sql`SET LOCAL ROLE ${sql.id(`mod_${handler.module}`)}`.execute(tx);
          const fresh = await tx
            .insertInto('platform.inbox_record')
            .values({ tenant_id: event.tenantId, consumer: handler.consumer, event_id: event.id })
            .onConflict((oc) => oc.columns(['tenant_id', 'consumer', 'event_id']).doNothing())
            .returning('id')
            .executeTakeFirst();
          if (fresh) await handler.handle(tx, event);
        });
      }
      await sql`SELECT platform.complete_outbox_event(${event.id})`.execute(db);
      delivered++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      opts.log?.('event handler failed', { eventId: event.id, eventType: event.eventType, attempts: event.attempts, error: message });
      await sql`SELECT platform.fail_outbox_event(${event.id}, ${message}, ${opts.maxAttempts ?? 10})`.execute(db);
    }
  }
  return { claimed: rows.length, delivered, failed };
}
