// Database lifecycle helpers shared by reset.mjs and the test global setup.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { ROOT, config, databaseName } from './config.mjs';

/** Drops (terminating open connections) and recreates the database named in `url`. */
export async function recreateDatabase(url) {
  const name = databaseName(url);
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Refusing unsafe database name: ${name}`);
  const admin = new pg.Client({ connectionString: config.adminUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${name} TEMPLATE template0 ENCODING 'UTF8'`);
  } finally {
    await admin.end();
  }
}

/** Runs dbmate against `url`. Schema dump needs a pg_dump matching the server major version. */
export function dbmate(url, args, { stdio = 'inherit' } = {}) {
  const dumpArgs = process.env.DBMATE_DUMP === '1' ? ['--schema-file', config.schemaFile] : ['--no-dump-schema'];
  execFileSync(
    path.join(ROOT, 'node_modules', '.bin', 'dbmate'),
    ['--url', url, '--migrations-dir', config.migrationsDir, ...dumpArgs, ...args],
    { stdio },
  );
}

/** Applies every .sql file in `dirs`, in file-name order, each in its own transaction. */
export async function applySeeds(url, dirs) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    for (const dir of dirs) {
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
        await client.query('BEGIN');
        try {
          await client.query(readFileSync(path.join(dir, file), 'utf8'));
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw new Error(`Seed ${file} failed: ${err.message}`);
        }
      }
    }
  } finally {
    await client.end();
  }
}

/** Lets the application role log in locally (migrations create it NOLOGIN). */
export async function enableLocalAppLogin() {
  const admin = new pg.Client({ connectionString: config.adminUrl });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = 'hms_app'");
    if (rowCount) await admin.query(`ALTER ROLE hms_app WITH LOGIN PASSWORD '${config.appPassword.replaceAll("'", "''")}'`);
  } finally {
    await admin.end();
  }
}

/** Fresh database with all migrations and the requested seeds. */
export async function resetDatabase(url, { devSeeds = false, stdio = 'inherit' } = {}) {
  await recreateDatabase(url);
  // dbmate errors when the folder has no migrations (true until Phase 1).
  if (readdirSync(config.migrationsDir).some((f) => f.endsWith('.sql'))) dbmate(url, ['up'], { stdio });
  await applySeeds(url, devSeeds ? [config.referenceSeedsDir, config.devSeedsDir] : [config.referenceSeedsDir]);
  await enableLocalAppLogin();
}
