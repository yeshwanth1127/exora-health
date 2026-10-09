// Connection helpers and fixtures for DB tests.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { config } from '../scripts/config.mjs';

/** Superuser pool on the test database (bypasses RLS) — for fixtures and catalog queries only. */
export function adminPool(max = 5): pg.Pool {
  return new pg.Pool({ connectionString: config.testDatabaseUrl, max });
}

/** Pool connected as the application role `hms_app`: no superuser powers, RLS and grants apply. */
export function appPool(max = 10): pg.Pool {
  return new pg.Pool({ connectionString: config.testAppDatabaseUrl, max });
}

export type ModuleRole = 'mod_platform' | 'mod_patient' | 'mod_catalog' | 'mod_booking';

/**
 * Runs `fn` in one transaction acting for `tenantId`, optionally switched into a module write role —
 * exactly how the command runner will work. Rolls back unless `commit` is true.
 */
export async function asTenant<T>(
  pool: pg.Pool,
  tenantId: string | null,
  role: ModuleRole | null,
  fn: (client: pg.PoolClient) => Promise<T>,
  { commit = false }: { commit?: boolean } = {},
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (tenantId) await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    if (role) await client.query(`SET LOCAL ROLE ${role}`);
    const result = await fn(client);
    await client.query(commit ? 'COMMIT' : 'ROLLBACK');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export interface TenantFixture {
  tenantId: string;
  organizationId: string;
  facilityId: string;
}

/** Creates a tenant with one organization and one facility (as superuser, like provisioning does). */
export async function createTenant(admin: pg.Pool, label = 'fixture'): Promise<TenantFixture> {
  const suffix = randomUUID().slice(0, 8);
  const { rows: [t] } = await admin.query<{ id: string }>(
    `INSERT INTO platform.tenant (name, slug, status) VALUES ($1, $2, 'active') RETURNING id`,
    [`${label} ${suffix}`, `${label}-${suffix}`],
  );
  const { rows: [o] } = await admin.query<{ id: string }>(
    `INSERT INTO platform.organization (tenant_id, name, org_type) VALUES ($1, 'Org', 'hospital') RETURNING id`,
    [t!.id],
  );
  const { rows: [f] } = await admin.query<{ id: string }>(
    `INSERT INTO platform.facility (tenant_id, organization_id, code, name, facility_type, state_code)
     VALUES ($1, $2, 'F1', 'Facility 1', 'hospital', '29') RETURNING id`,
    [t!.id, o!.id],
  );
  return { tenantId: t!.id, organizationId: o!.id, facilityId: f!.id };
}

/** Registers a patient directly (as superuser) and returns its id. */
export async function createPatient(admin: pg.Pool, tenantId: string, givenName = 'Test'): Promise<string> {
  const { rows: [p] } = await admin.query<{ id: string }>(
    `INSERT INTO patient.patient (tenant_id, mrn, given_name, sex, registration_source)
     VALUES ($1, 'T-' || uuidv7(), $2, 'unknown', 'front_desk') RETURNING id`,
    [tenantId, givenName],
  );
  return p!.id;
}

/** Creates a bed category for the tenant and returns its id. */
export async function createBedCategory(admin: pg.Pool, tenantId: string, code = 'GEN', rank = 1): Promise<string> {
  const { rows: [c] } = await admin.query<{ id: string }>(
    `INSERT INTO catalog.bed_category (tenant_id, code, name, rank) VALUES ($1, $2, $2, $3) RETURNING id`,
    [tenantId, code, rank],
  );
  return c!.id;
}

/** Postgres SQLSTATE codes used in assertions. */
export const PG = {
  insufficientPrivilege: '42501', // also raised for RLS WITH CHECK violations and missing app.tenant_id
  foreignKeyViolation: '23503',
  uniqueViolation: '23505',
  checkViolation: '23514',
  exclusionViolation: '23P01',
  objectNotInPrerequisiteState: '55000', // raised by lifecycle guards (e.g. editing an active price list)
} as const;
