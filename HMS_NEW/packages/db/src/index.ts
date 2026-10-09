// Database access: a Kysely instance typed from the live schema (see `pnpm db:codegen`).
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { DB } from './generated/db.ts';

export type { DB } from './generated/db.ts';
export { sql, type Kysely, type Transaction } from 'kysely';

// Return bigint (int8) columns as JS numbers when safe; money in paise stays well below 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new RangeError(`int8 value ${value} exceeds Number.MAX_SAFE_INTEGER`);
  return n;
});
// Keep DATE columns as 'YYYY-MM-DD' strings: a date has no time zone, a JS Date would invent one.
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

export interface CreateDbOptions {
  connectionString: string;
  maxConnections?: number;
}

export function createDb({ connectionString, maxConnections = 10 }: CreateDbOptions): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: maxConnections }) }),
  });
}
