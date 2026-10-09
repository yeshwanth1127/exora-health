// Schema conventions (docs/plan/SCHEMA_PLAN.md §5), checked against the live catalog so every
// future migration is held to them automatically.
import { afterAll, describe, expect, it } from 'vitest';
import { adminPool } from './db.ts';

const pool = adminPool();
afterAll(() => pool.end());

/** Module schemas and the role that may write each one. Extend as modules are added. */
const MODULE_ROLE: Record<string, string> = {
  platform: 'mod_platform',
  patient: 'mod_patient',
  catalog: 'mod_catalog',
  booking: 'mod_booking',
};
const SCHEMAS = Object.keys(MODULE_ROLE);

/** Global reference tables: no tenant_id. */
const GLOBAL_TABLES = new Set(['platform.tenant', 'platform.permission']);
/** tenant_id may be NULL (system rows shared by all tenants). */
const NULLABLE_TENANT = new Set(['platform.role', 'platform.role_permission']);
/** Partitioned (PK includes the partition key) or link tables: no UNIQUE (tenant_id, id). */
const NO_TENANT_ID_KEY = new Set(['platform.audit_event', 'platform.outbox_event', 'platform.role_permission']);
/** Tables every module role may write. */
const SHARED_WRITE = new Set([
  'platform.audit_event',
  'platform.outbox_event',
  'platform.number_series',
  'platform.idempotency_record',
]);
/** Tables where DELETE is a legitimate (audited) admin action. */
const DELETE_ALLOWED = new Set(['platform.role_permission']);

interface TableRow {
  oid: number;
  name: string;
  schema: string;
  is_partition: boolean;
  rls: boolean;
  force_rls: boolean;
  has_tenant_id: boolean;
  tenant_not_null: boolean;
  has_version: boolean;
  has_touch: boolean;
  has_tenant_id_key: boolean;
}

async function tables(): Promise<TableRow[]> {
  const { rows } = await pool.query<TableRow>(
    `SELECT c.oid,
            n.nspname || '.' || c.relname AS name,
            n.nspname AS schema,
            c.relispartition AS is_partition,
            c.relrowsecurity AS rls,
            c.relforcerowsecurity AS force_rls,
            t.attnum IS NOT NULL AS has_tenant_id,
            coalesce(t.attnotnull, false) AS tenant_not_null,
            EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'version' AND NOT a.attisdropped) AS has_version,
            EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = c.oid AND tg.tgname = 'touch_row') AS has_touch,
            EXISTS (
              SELECT 1 FROM pg_index i
              WHERE i.indrelid = c.oid AND i.indisunique
                AND string_to_array(i.indkey::text, ' ')::int2[] = ARRAY[
                  t.attnum,
                  (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'id')
                ]::int2[]
            ) AS has_tenant_id_key
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_attribute t ON t.attrelid = c.oid AND t.attname = 'tenant_id' AND NOT t.attisdropped
     WHERE n.nspname = ANY($1) AND c.relkind IN ('r', 'p')
     ORDER BY 2`,
    [SCHEMAS],
  );
  return rows;
}

describe('schema conventions', () => {
  it('finds the module tables', async () => {
    expect((await tables()).length).toBeGreaterThan(15);
  });

  it('every table except global reference tables has tenant_id, NOT NULL unless allowed', async () => {
    const bad = (await tables())
      .filter((t) => !GLOBAL_TABLES.has(t.name))
      .filter((t) => !t.has_tenant_id || (!t.tenant_not_null && !NULLABLE_TENANT.has(t.name)))
      .map((t) => t.name);
    expect(bad).toEqual([]);
  });

  it('every table (partitions included) has row-level security enabled and forced', async () => {
    const bad = (await tables())
      .filter((t) => t.name !== 'platform.permission')
      .filter((t) => !t.rls || !t.force_rls)
      .map((t) => t.name);
    expect(bad).toEqual([]);
  });

  it('every tenant table has UNIQUE (tenant_id, id) as a composite-FK target', async () => {
    const bad = (await tables())
      .filter((t) => !t.is_partition && t.has_tenant_id && !NO_TENANT_ID_KEY.has(t.name))
      .filter((t) => !t.has_tenant_id_key)
      .map((t) => t.name);
    expect(bad).toEqual([]);
  });

  it('every table with a version column has the touch_row trigger', async () => {
    const bad = (await tables()).filter((t) => !t.is_partition && t.has_version && !t.has_touch).map((t) => t.name);
    expect(bad).toEqual([]);
  });

  it('every foreign key has an index starting with its columns', async () => {
    const { rows } = await pool.query<{ fk: string }>(
      `SELECT con.conrelid::regclass::text || ' ' || con.conname AS fk
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE con.contype = 'f' AND n.nspname = ANY($1) AND NOT c.relispartition
         AND NOT EXISTS (
           SELECT 1 FROM pg_index i
           WHERE i.indrelid = con.conrelid
             AND (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(con.conkey)] = con.conkey
         )
       ORDER BY 1`,
      [SCHEMAS],
    );
    expect(rows.map((r) => r.fk)).toEqual([]);
  });

  it('the app role cannot write any table directly (only through SET ROLE mod_*)', async () => {
    const { rows } = await pool.query<{ name: string }>(
      `SELECT n.nspname || '.' || c.relname AS name
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = ANY($1) AND c.relkind IN ('r', 'p')
         AND has_table_privilege('hms_app', c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')`,
      [SCHEMAS],
    );
    expect(rows.map((r) => r.name)).toEqual([]);
  });

  it('each module role writes only its own schema (plus shared platform tables)', async () => {
    const { rows } = await pool.query<{ name: string; schema: string; role: string }>(
      `SELECT n.nspname || '.' || c.relname AS name, n.nspname AS schema, r.rolname AS role
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN pg_roles r
       WHERE n.nspname = ANY($1) AND c.relkind IN ('r', 'p') AND NOT c.relispartition
         AND r.rolname LIKE 'mod\\_%'
         AND has_table_privilege(r.rolname, c.oid, 'INSERT, UPDATE')`,
      [SCHEMAS],
    );
    const bad = rows
      .filter((r) => MODULE_ROLE[r.schema] !== r.role && !SHARED_WRITE.has(r.name))
      .map((r) => `${r.role} → ${r.name}`);
    expect(bad).toEqual([]);
  });

  it('no module role can DELETE or TRUNCATE, except allow-listed tables', async () => {
    const { rows } = await pool.query<{ name: string; role: string }>(
      `SELECT n.nspname || '.' || c.relname AS name, r.rolname AS role
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN pg_roles r
       WHERE n.nspname = ANY($1) AND c.relkind IN ('r', 'p')
         AND r.rolname LIKE 'mod\\_%'
         AND has_table_privilege(r.rolname, c.oid, 'DELETE, TRUNCATE')`,
      [SCHEMAS],
    );
    expect(rows.filter((r) => !DELETE_ALLOWED.has(r.name)).map((r) => `${r.role} → ${r.name}`)).toEqual([]);
  });
});
