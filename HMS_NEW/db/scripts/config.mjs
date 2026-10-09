// Shared database configuration for scripts and tests.
// Values come from the environment (or HMS_NEW/.env) with local-development defaults.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const envFile = path.join(ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const port = process.env.PG_PORT ?? '54329';
const base = `postgres://postgres:postgres@127.0.0.1:${port}`;
// Local-only password for the hms_app role (real environments provision logins separately).
const appPassword = process.env.HMS_APP_PASSWORD ?? 'hms_app_local';

export const config = {
  port,
  dataDir: process.env.PG_DATA_DIR ?? path.join(ROOT, '.pgdata'),
  adminUrl: process.env.ADMIN_DATABASE_URL ?? `${base}/postgres?sslmode=disable`,
  databaseUrl: process.env.DATABASE_URL ?? `${base}/hms?sslmode=disable`,
  testDatabaseUrl: process.env.TEST_DATABASE_URL ?? `${base}/hms_test?sslmode=disable`,
  appPassword,
  // The dev database as the application role — what the API and worker use.
  appDatabaseUrl:
    process.env.APP_DATABASE_URL ?? `postgres://hms_app:${appPassword}@127.0.0.1:${port}/hms?sslmode=disable`,
  // Same database, connecting as the application role (no superuser powers, RLS applies).
  testAppDatabaseUrl:
    process.env.TEST_APP_DATABASE_URL ?? `postgres://hms_app:${appPassword}@127.0.0.1:${port}/hms_test?sslmode=disable`,
  migrationsDir: path.join(ROOT, 'db', 'migrations'),
  schemaFile: path.join(ROOT, 'db', 'schema.sql'),
  referenceSeedsDir: path.join(ROOT, 'db', 'seeds', 'reference'),
  devSeedsDir: path.join(ROOT, 'db', 'seeds', 'dev'),
};

/** Database name from a connection URL. */
export function databaseName(url) {
  return new URL(url).pathname.replace(/^\//, '');
}
