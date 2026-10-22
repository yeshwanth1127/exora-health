// M07 inpatient: one occupant per bed, one primary bed per admission, occupancies only ever end, one
// open stay per patient per clinic, bed status only on beds, write ownership and tenant isolation.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PG, adminPool, appPool, asTenant, createBedCategory, createPatient, createTenant, type TenantFixture } from './db.ts';

const admin = adminPool();
const app = appPool();
let a: TenantFixture;
let b: TenantFixture;
let bed1: string;
let bed2: string;
let ward: string;
let category: string;
let doctor: string;

const one = async (text: string, values: unknown[]) => (await admin.query<{ id: string }>(text, values)).rows[0]!.id;

async function admission(patientId: string, ipNo: string) {
  return asTenant(app, a.tenantId, 'mod_inpatient', async (c) => (await c.query<{ id: string }>(
    `INSERT INTO inpatient.admission (tenant_id, facility_id, ip_no, patient_id, admission_type, admitting_staff_id, admission_reason)
     VALUES ($1, $2, $3, $4, 'elective', $5, 'Observation') RETURNING id`, [a.tenantId, a.facilityId, ipNo, patientId, doctor])).rows[0]!.id, { commit: true });
}

const occupy = (admissionId: string, bedId: string, from: string, to: string | null, kind = 'primary') => asTenant(app, a.tenantId, 'mod_inpatient', (c) => c.query(
  `INSERT INTO inpatient.bed_occupancy (tenant_id, facility_id, admission_id, bed_location_id, billed_bed_category_id, period, kind, reason)
   VALUES ($1, $2, $3, $4, $5, tstzrange($6::timestamptz, $7::timestamptz), $8, 'admit') RETURNING id`,
  [a.tenantId, a.facilityId, admissionId, bedId, category, from, to, kind]), { commit: true });

beforeAll(async () => {
  a = await createTenant(admin, 'inpatient-a');
  b = await createTenant(admin, 'inpatient-b');
  category = await createBedCategory(admin, a.tenantId, 'GEN', 1);
  doctor = await one(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, 'D1', 'Doc', 'Doc', 'doctor') RETURNING id`, [a.tenantId]);
  ward = await one(`INSERT INTO platform.location (tenant_id, facility_id, kind, code, name, ward_type) VALUES ($1, $2, 'ward', 'W1', 'Ward', 'general') RETURNING id`, [a.tenantId, a.facilityId]);
  bed1 = await one(`INSERT INTO platform.location (tenant_id, facility_id, parent_location_id, kind, code, name, bed_category_id) VALUES ($1, $2, $3, 'bed', 'B1', 'Bed 1', $4) RETURNING id`, [a.tenantId, a.facilityId, ward, category]);
  bed2 = await one(`INSERT INTO platform.location (tenant_id, facility_id, parent_location_id, kind, code, name, bed_category_id) VALUES ($1, $2, $3, 'bed', 'B2', 'Bed 2', $4) RETURNING id`, [a.tenantId, a.facilityId, ward, category]);
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe('beds and occupancy', () => {
  it('a bed has one occupant at a time; an admission one primary bed', async () => {
    const x = await admission(await createPatient(admin, a.tenantId, 'X'), 'IP-1');
    const y = await admission(await createPatient(admin, a.tenantId, 'Y'), 'IP-2');
    await occupy(x, bed1, '2026-10-01T10:00+05:30', null);
    await expect(occupy(y, bed1, '2026-10-02T10:00+05:30', null)).rejects.toMatchObject({ code: PG.exclusionViolation });
    await expect(occupy(x, bed2, '2026-10-02T10:00+05:30', null)).rejects.toMatchObject({ code: PG.exclusionViolation });
    // …but a retained bed alongside the primary is allowed
    await expect(occupy(x, bed2, '2026-10-02T10:00+05:30', null, 'retained')).resolves.toBeTruthy();
  });

  it('an occupancy only ends, once', async () => {
    const z = await admission(await createPatient(admin, a.tenantId, 'Z'), 'IP-3');
    const ward2 = await one(`INSERT INTO platform.location (tenant_id, facility_id, kind, code, name, ward_type) VALUES ($1, $2, 'ward', 'W2', 'Ward 2', 'general') RETURNING id`, [a.tenantId, a.facilityId]);
    const bed = await one(`INSERT INTO platform.location (tenant_id, facility_id, parent_location_id, kind, code, name, bed_category_id) VALUES ($1, $2, $3, 'bed', 'B3', 'Bed 3', $4) RETURNING id`, [a.tenantId, a.facilityId, ward2, category]);
    const { rows: [o] } = await occupy(z, bed, '2026-10-01T10:00+05:30', null);
    const end = (sql: string) => asTenant(app, a.tenantId, 'mod_inpatient', (c) => c.query(sql, [o.id]), { commit: true });
    await end(`UPDATE inpatient.bed_occupancy SET period = tstzrange(lower(period), '2026-10-03T10:00+05:30') WHERE id = $1`);
    await expect(end(`UPDATE inpatient.bed_occupancy SET period = tstzrange(lower(period), '2026-10-04T10:00+05:30') WHERE id = $1`)).rejects.toMatchObject({ code: PG.objectNotInPrerequisiteState });
  });

  it('one open stay per patient; bed status only for beds', async () => {
    const p = await createPatient(admin, a.tenantId, 'Twice');
    await admission(p, 'IP-4');
    await expect(admission(p, 'IP-5')).rejects.toMatchObject({ code: PG.uniqueViolation });
    await expect(asTenant(app, a.tenantId, 'mod_inpatient', (c) => c.query(
      `INSERT INTO inpatient.bed_status (tenant_id, facility_id, bed_location_id) VALUES ($1, $2, $3)`, [a.tenantId, a.facilityId, ward]))).rejects.toMatchObject({ code: PG.checkViolation });
  });
});

describe('ownership and isolation', () => {
  it('only mod_inpatient writes inpatient; other tenants see nothing', async () => {
    await expect(asTenant(app, a.tenantId, 'mod_billing', (c) => c.query(
      `INSERT INTO inpatient.bed_status (tenant_id, facility_id, bed_location_id) VALUES ($1, $2, $3)`, [a.tenantId, a.facilityId, bed1]))).rejects.toMatchObject({ code: PG.insufficientPrivilege });
    const seen = await asTenant(app, b.tenantId, null, async (c) => (await c.query('SELECT 1 FROM inpatient.admission')).rowCount);
    expect(seen).toBe(0);
  });
});
