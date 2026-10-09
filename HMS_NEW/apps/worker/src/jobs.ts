// Housekeeping jobs (cross-tenant, via narrowly-scoped SECURITY DEFINER functions).
import { sql, type DB, type Kysely } from '@hms/db';

/** Marks lapsed slot holds as expired. Returns how many. */
export async function expireHolds(db: Kysely<DB>): Promise<number> {
  const { rows: [r] } = await sql<{ n: number }>`SELECT booking.expire_holds() AS n`.execute(db);
  return r!.n;
}

/** Keeps three months of audit/outbox partitions ahead. */
export async function maintainPartitions(db: Kysely<DB>): Promise<void> {
  await sql`SELECT platform.maintain_partitions()`.execute(db);
}

/** Removes idempotency records past their expiry. Returns how many. */
export async function purgeIdempotencyRecords(db: Kysely<DB>): Promise<number> {
  const { rows: [r] } = await sql<{ n: number }>`SELECT platform.purge_idempotency_records() AS n`.execute(db);
  return r!.n;
}
