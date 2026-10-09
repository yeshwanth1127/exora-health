// Background worker: delivers outbox events and runs housekeeping jobs.
//   pnpm worker:dev
import { createDb } from '@hms/db';
import { config } from '../../../db/scripts/config.mjs';
import { dispatchOnce } from './dispatcher.ts';
import { handlers } from './handlers.ts';
import { expireHolds, maintainPartitions, purgeIdempotencyRecords } from './jobs.ts';

const db = createDb({ connectionString: config.appDatabaseUrl, maxConnections: 5 });
const log = (msg: string, data: Record<string, unknown> = {}) => console.log(JSON.stringify({ time: new Date().toISOString(), msg, ...data }));
let stopping = false;

/** Runs `job` every `ms` until shutdown; logs results worth seeing and any failure. */
async function every(name: string, ms: number, job: () => Promise<unknown>) {
  while (!stopping) {
    try {
      const result = await job();
      if (typeof result === 'number' && result > 0) log(name, { count: result });
      else if (result && typeof result === 'object' && (result as { claimed?: number }).claimed) log(name, result as Record<string, unknown>);
    } catch (err) {
      log(`${name} failed`, { error: err instanceof Error ? err.message : String(err) });
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log('stopping', { signal });
    stopping = true;
    setTimeout(() => void db.destroy().then(() => process.exit(0)), 1500);
  });
}

log('worker started', { handlers: handlers.map((h) => h.consumer) });
void every('outbox', 1_000, () => dispatchOnce(db, handlers, { log }));
void every('expire-holds', 30_000, () => expireHolds(db));
void every('partitions', 24 * 3600_000, () => maintainPartitions(db));
void every('purge-idempotency', 3600_000, () => purgeIdempotencyRecords(db));
