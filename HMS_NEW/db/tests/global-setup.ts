// Builds a fresh test database (all migrations + reference seeds) once per test run.
import pg from 'pg';
import { config } from '../scripts/config.mjs';
import { resetDatabase } from '../scripts/lib.mjs';

export default async function setup(): Promise<void> {
  const probe = new pg.Client({ connectionString: config.adminUrl });
  try {
    await probe.connect();
  } catch (err) {
    throw new Error(
      `Cannot reach PostgreSQL at ${new URL(config.adminUrl).host}. ` +
        'Start it with `pnpm pg:start` (bundled binaries) or `docker compose up -d`.',
      { cause: err },
    );
  } finally {
    await probe.end().catch(() => {});
  }
  await resetDatabase(config.testDatabaseUrl, { stdio: 'pipe' });
}
