// Phase 0 smoke test: the database server provides what the schema plan relies on.
import { afterAll, describe, expect, it } from 'vitest';
import { adminPool } from './db.ts';

const pool = adminPool();
afterAll(() => pool.end());

describe('database environment', () => {
  it('runs PostgreSQL 18 or newer', async () => {
    const { rows } = await pool.query<{ v: string }>("SELECT current_setting('server_version_num') AS v");
    expect(Number(rows[0]!.v)).toBeGreaterThanOrEqual(180000);
  });

  it('generates time-ordered version-7 UUIDs with uuidv7()', async () => {
    const { rows } = await pool.query<{ id: string }>('SELECT uuidv7() AS id FROM generate_series(1, 50)');
    const ids = rows.map((r) => r.id);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect([...ids].sort()).toEqual(ids);
  });

  it.each(['btree_gist', 'pg_trgm', 'citext'])('can install the %s extension', async (ext) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`CREATE EXTENSION IF NOT EXISTS ${ext}`);
      const { rowCount } = await client.query('SELECT 1 FROM pg_extension WHERE extname = $1', [ext]);
      expect(rowCount).toBe(1);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('supports exclusion constraints over uuid and tstzrange (btree_gist)', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
      await client.query(`CREATE TEMP TABLE slot (
        resource_id uuid NOT NULL,
        period tstzrange NOT NULL,
        EXCLUDE USING gist (resource_id WITH =, period WITH &&)
      )`);
      const r = '00000000-0000-7000-8000-000000000001';
      await client.query(`INSERT INTO slot VALUES ($1, '[2026-10-10 09:00+05:30, 2026-10-10 09:15+05:30)')`, [r]);
      await expect(
        client.query(`INSERT INTO slot VALUES ($1, '[2026-10-10 09:10+05:30, 2026-10-10 09:25+05:30)')`, [r]),
      ).rejects.toMatchObject({ code: '23P01' });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('has every migration applied', async () => {
    const { rows } = await pool.query<{ n: string }>('SELECT count(*) AS n FROM schema_migrations');
    const { readdirSync } = await import('node:fs');
    const { config } = await import('../scripts/config.mjs');
    const files = readdirSync(config.migrationsDir).filter((f) => f.endsWith('.sql'));
    expect(Number(rows[0]!.n)).toBe(files.length);
  });
});
