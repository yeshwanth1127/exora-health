// Worker: outbox delivery (exactly-once per consumer, retry with backoff, dead-letter) and
// housekeeping jobs, against real PostgreSQL as the application role.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@hms/db';
import { config } from '../../../db/scripts/config.mjs';
import { adminPool, createTenant, type TenantFixture } from '../../../db/tests/db.ts';
import { dispatchOnce, type EventHandler, type OutboxEvent } from './dispatcher.ts';
import { expireHolds, maintainPartitions, purgeIdempotencyRecords } from './jobs.ts';

const admin = adminPool();
const db = createDb({ connectionString: config.testAppDatabaseUrl, maxConnections: 5 });
let t: TenantFixture;

beforeAll(async () => {
  t = await createTenant(admin, 'worker');
});
afterAll(async () => {
  await db.destroy();
  await admin.end();
});

async function emit(eventType: string): Promise<string> {
  const { rows: [e] } = await admin.query<{ id: string }>(
    `INSERT INTO platform.outbox_event (tenant_id, event_type, aggregate_type, aggregate_id, payload)
     VALUES ($1, $2, 'test', uuidv7(), '{}') RETURNING id`,
    [t.tenantId, eventType],
  );
  return e!.id;
}

const outboxRow = async (id: string) =>
  (await admin.query(`SELECT processed_at, dead_lettered_at, attempts, last_error, claimed_until FROM platform.outbox_event WHERE id = $1`, [id])).rows[0];

/** Dispatches until the given event is no longer pending (other test files' events get delivered too). */
async function drain(handlers: EventHandler[], opts: Parameters<typeof dispatchOnce>[2] = {}) {
  for (let i = 0; i < 20; i++) if ((await dispatchOnce(db, handlers, { batchSize: 200, ...opts })).claimed === 0) break;
}

describe('outbox delivery', () => {
  it('delivers each event once to each matching consumer, in the tenant context', async () => {
    const seen: OutboxEvent[] = [];
    const recorder: EventHandler = {
      consumer: 'test-recorder',
      eventTypes: ['test.happened'],
      module: 'platform',
      async handle(tx, event) {
        if (event.tenantId !== t.tenantId) return;
        // Runs under RLS for the event's tenant: it can see this tenant's rows only.
        const tenants = await tx.selectFrom('platform.tenant').select('id').execute();
        expect(tenants.map((r) => r.id)).toEqual([t.tenantId]);
        seen.push(event);
      },
    };
    const id = await emit('test.happened');
    const other = await emit('test.ignored');
    await drain([recorder]);
    expect(seen.map((e) => e.id)).toEqual([id]);
    expect((await outboxRow(id)).processed_at).not.toBeNull();
    expect((await outboxRow(other)).processed_at).not.toBeNull(); // no consumer: still marked delivered

    // Redelivery (e.g. the worker crashed after handling but before marking it delivered) is harmless.
    await admin.query(`UPDATE platform.outbox_event SET processed_at = NULL, claimed_until = NULL WHERE id = $1`, [id]);
    await drain([recorder]);
    expect(seen).toHaveLength(1);
  });

  it('retries a failing consumer with backoff and dead-letters it after the attempt limit', async () => {
    const id = await emit('test.flaky');
    const failing: EventHandler = {
      consumer: 'test-failing',
      eventTypes: ['test.flaky'],
      module: 'platform',
      async handle(_tx, event) {
        if (event.id === id) throw new Error('downstream unavailable');
      },
    };
    await drain([failing], { maxAttempts: 2 });
    let row = await outboxRow(id);
    expect(row).toMatchObject({ processed_at: null, dead_lettered_at: null, attempts: 1, last_error: 'downstream unavailable' });
    expect(row.claimed_until.getTime()).toBeGreaterThan(Date.now()); // backing off: not offered again yet

    await admin.query(`UPDATE platform.outbox_event SET claimed_until = now() - interval '1 second' WHERE id = $1`, [id]);
    await drain([failing], { maxAttempts: 2 });
    row = await outboxRow(id);
    expect(row.attempts).toBe(2);
    expect(row.dead_lettered_at).not.toBeNull();

    // Dead-lettered events are not offered again.
    await admin.query(`UPDATE platform.outbox_event SET claimed_until = NULL WHERE id = $1`, [id]);
    await drain([failing], { maxAttempts: 2 });
    expect((await outboxRow(id)).attempts).toBe(2);
  });

  it("a consumer can't write outside its module's tables", async () => {
    const id = await emit('test.sneaky');
    const sneaky: EventHandler = {
      consumer: 'test-sneaky',
      eventTypes: ['test.sneaky'],
      module: 'booking',
      async handle(tx, event) {
        if (event.id !== id) return;
        await tx.updateTable('platform.facility').set({ name: 'changed' }).where('id', '=', t.facilityId).execute();
      },
    };
    await drain([sneaky], { maxAttempts: 1 });
    expect((await outboxRow(id)).last_error).toMatch(/permission denied/);
    const { rows } = await admin.query(`SELECT name FROM platform.facility WHERE id = $1`, [t.facilityId]);
    expect(rows[0].name).toBe('Facility 1');
  });
});

describe('housekeeping jobs', () => {
  it('expires lapsed holds in every tenant', async () => {
    const { rows: [s] } = await admin.query<{ id: string }>(
      `INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, 'D', 'D', 'D', 'doctor') RETURNING id`,
      [t.tenantId],
    );
    const { rows: [r] } = await admin.query<{ id: string }>(
      `INSERT INTO booking.schedulable_resource (tenant_id, kind, staff_id, name) VALUES ($1, 'practitioner', $2, 'D') RETURNING id`,
      [t.tenantId, s!.id],
    );
    const { rows: [hold] } = await admin.query<{ id: string }>(
      `INSERT INTO booking.reservation (tenant_id, resource_id, facility_id, period, status, hold_expires_at)
       VALUES ($1, $2, $3, tstzrange(now() + interval '1 day', now() + interval '1 day 15 minutes'), 'held', now() - interval '1 minute') RETURNING id`,
      [t.tenantId, r!.id, t.facilityId],
    );
    expect(await expireHolds(db)).toBeGreaterThanOrEqual(1);
    const { rows } = await admin.query(`SELECT status FROM booking.reservation WHERE id = $1`, [hold!.id]);
    expect(rows[0].status).toBe('expired');
  });

  it('keeps future monthly partitions in place', async () => {
    await maintainPartitions(db);
    const { rows } = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_inherits WHERE inhparent = 'platform.audit_event'::regclass`,
    );
    expect(rows[0]!.n).toBeGreaterThanOrEqual(5); // default + current month + 3 ahead
  });

  it('purges expired idempotency records only', async () => {
    await admin.query(
      `INSERT INTO platform.idempotency_record (tenant_id, scope, key, request_hash, expires_at)
       VALUES ($1, 'test', 'old-key', 'h', now() - interval '1 day'), ($1, 'test', 'live-key', 'h', now() + interval '1 day')`,
      [t.tenantId],
    );
    expect(await purgeIdempotencyRecords(db)).toBeGreaterThanOrEqual(1);
    const { rows } = await admin.query(`SELECT key FROM platform.idempotency_record WHERE tenant_id = $1 AND scope = 'test'`, [t.tenantId]);
    expect(rows.map((r) => r.key)).toEqual(['live-key']);
  });
});
