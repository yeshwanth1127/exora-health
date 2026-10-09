// Connection helpers for DB tests.
import pg from 'pg';
import { config } from '../scripts/config.mjs';

/** A pool on the test database; close it in afterAll. */
export function testPool(max = 10): pg.Pool {
  return new pg.Pool({ connectionString: config.testDatabaseUrl, max });
}
