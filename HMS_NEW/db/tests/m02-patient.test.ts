// M02 patient registry: MRNs, identifiers, guardians and consents, merges, search, isolation.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PG, adminPool, appPool, asTenant, createPatient, createTenant, type TenantFixture } from './db.ts';

const admin = adminPool();
const app = appPool();
let a: TenantFixture;
let b: TenantFixture;
let staff1: string;
let staff2: string;

beforeAll(async () => {
  a = await createTenant(admin, 'patients-a');
  b = await createTenant(admin, 'patients-b');
  const { rows } = await admin.query<{ id: string }>(
    `INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type)
     VALUES ($1, 'S1', 'One', 'Staff One', 'admin'), ($1, 'S2', 'Two', 'Staff Two', 'admin') RETURNING id`,
    [a.tenantId],
  );
  [staff1, staff2] = rows.map((r) => r.id) as [string, string];
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

/** Registers a patient the way the registration command will: MRN from the tenant's series. */
function register(t: TenantFixture, givenName: string, familyName: string | null = null) {
  return asTenant(
    app,
    t.tenantId,
    'mod_patient',
    async (c) => {
      const { rows: [r] } = await c.query<{ id: string; mrn: string }>(
        `INSERT INTO patient.patient (tenant_id, mrn, registered_facility_id, given_name, family_name, sex, registration_source)
         VALUES ($1, lpad(platform.next_number('mrn')::text, 6, '0'), $2, $3, $4, 'female', 'front_desk')
         RETURNING id, mrn`,
        [t.tenantId, t.facilityId, givenName, familyName],
      );
      return r!;
    },
    { commit: true },
  );
}

describe('registration', () => {
  it('assigns consecutive MRNs per tenant; tenants number independently', async () => {
    const p1 = await register(a, 'Kavya', 'Reddy');
    const p2 = await register(a, 'Sneha', 'Pillai');
    const q1 = await register(b, 'Ananya');
    expect([p1.mrn, p2.mrn]).toEqual(['000001', '000002']);
    expect(q1.mrn).toBe('000001');
  });

  it('only the patient module can register patients', async () => {
    await expect(
      asTenant(app, a.tenantId, 'mod_booking', (c) =>
        c.query(
          `INSERT INTO patient.patient (tenant_id, mrn, given_name, sex, registration_source)
           VALUES ($1, 'X1', 'Nope', 'male', 'front_desk')`,
          [a.tenantId],
        ),
      ),
    ).rejects.toMatchObject({ code: PG.insufficientPrivilege });
  });

  it('finds patients by approximate name (typos) via trigram search', async () => {
    const names = await asTenant(app, a.tenantId, null, async (c) =>
      (
        await c.query<{ search_name: string }>(
          `SELECT search_name FROM patient.patient WHERE search_name % $1 ORDER BY similarity(search_name, $1) DESC`,
          ['kavia redy'],
        )
      ).rows.map((r) => r.search_name),
    );
    expect(names[0]).toBe('kavya reddy');
  });

  it("other tenants' patients are invisible", async () => {
    const count = await asTenant(app, b.tenantId, null, async (c) => (await c.query('SELECT 1 FROM patient.patient')).rowCount);
    expect(count).toBe(1);
  });
});

describe('identifiers', () => {
  it('stores ABHA numbers as 14 digits and rejects other formats', async () => {
    const patientId = await createPatient(admin, a.tenantId);
    const insert = (system: string, value: string) =>
      admin.query(`INSERT INTO patient.patient_identifier (tenant_id, patient_id, system, value) VALUES ($1, $2, $3, $4)`, [
        a.tenantId,
        patientId,
        system,
        value,
      ]);
    await expect(insert('abha_number', '12345678901234')).resolves.toBeDefined();
    await expect(insert('abha_number', '12-3456-7890-1234')).rejects.toMatchObject({ code: PG.checkViolation });
    await expect(insert('pan', 'abcde1234f')).rejects.toMatchObject({ code: PG.checkViolation });
  });

  it('one ABHA number belongs to one patient per tenant, but may exist in another tenant', async () => {
    const [p1, p2, q1] = await Promise.all([createPatient(admin, a.tenantId), createPatient(admin, a.tenantId), createPatient(admin, b.tenantId)]);
    const insert = (tenantId: string, patientId: string) =>
      admin.query(
        `INSERT INTO patient.patient_identifier (tenant_id, patient_id, system, value) VALUES ($1, $2, 'abha_number', '55555555555555')`,
        [tenantId, patientId],
      );
    await insert(a.tenantId, p1);
    await expect(insert(a.tenantId, p2)).rejects.toMatchObject({ code: PG.uniqueViolation });
    await expect(insert(b.tenantId, q1)).resolves.toBeDefined();
  });

  it('allows only one current primary phone per patient', async () => {
    const patientId = await createPatient(admin, a.tenantId);
    const insert = (value: string) =>
      admin.query(
        `INSERT INTO patient.patient_contact (tenant_id, patient_id, kind, value, is_primary) VALUES ($1, $2, 'phone', $3, true)`,
        [a.tenantId, patientId, value],
      );
    await insert('+919811111111');
    await expect(insert('+919822222222')).rejects.toMatchObject({ code: PG.uniqueViolation });
    await expect(insert('9833333333')).rejects.toMatchObject({ code: PG.checkViolation }); // not E.164
  });
});

describe('guardians and consents', () => {
  it("a guardian's consent must name a related person of that same patient", async () => {
    const child = await createPatient(admin, a.tenantId, 'Child');
    const other = await createPatient(admin, a.tenantId, 'Other');
    const { rows: [mother] } = await admin.query<{ id: string }>(
      `INSERT INTO patient.related_person (tenant_id, patient_id, name, relationship, is_guardian)
       VALUES ($1, $2, 'Mother', 'parent', true) RETURNING id`,
      [a.tenantId, child],
    );
    const consent = (patientId: string, relatedPersonId: string | null) =>
      admin.query(
        `INSERT INTO patient.patient_consent (tenant_id, patient_id, consent_type, status, signed_by, related_person_id)
         VALUES ($1, $2, 'treatment', 'signed', 'guardian', $3)`,
        [a.tenantId, patientId, relatedPersonId],
      );
    await expect(consent(child, mother!.id)).resolves.toBeDefined();
    await expect(consent(child, null)).rejects.toMatchObject({ code: PG.checkViolation });
    await expect(consent(other, mother!.id)).rejects.toMatchObject({ code: PG.foreignKeyViolation });
  });
});

describe('merging duplicates', () => {
  it('a merge needs two different reviewers', async () => {
    const [survivor, duplicate] = await Promise.all([createPatient(admin, a.tenantId), createPatient(admin, a.tenantId)]);
    const link = (decidedBy: string, reviewer: string) =>
      admin.query(
        `INSERT INTO patient.patient_link (tenant_id, survivor_patient_id, other_patient_id, link_type, decided_by, second_reviewer_id)
         VALUES ($1, $2, $3, 'merged', $4, $5)`,
        [a.tenantId, survivor, duplicate, decidedBy, reviewer],
      );
    await expect(link(staff1, staff1)).rejects.toMatchObject({ code: PG.checkViolation });
    await expect(link(staff1, staff2)).resolves.toBeDefined();
  });

  it('a merged patient must point at its survivor, and only then', async () => {
    const [survivor, duplicate] = await Promise.all([createPatient(admin, a.tenantId), createPatient(admin, a.tenantId)]);
    await expect(
      admin.query(`UPDATE patient.patient SET status = 'merged' WHERE id = $1`, [duplicate]),
    ).rejects.toMatchObject({ code: PG.checkViolation });
    await expect(
      admin.query(`UPDATE patient.patient SET status = 'merged', merged_into_patient_id = $1 WHERE id = $2`, [survivor, duplicate]),
    ).resolves.toBeDefined();
  });
});

describe('links from platform tables', () => {
  it("a portal login cannot point at another tenant's patient", async () => {
    const otherTenantPatient = await createPatient(admin, b.tenantId);
    await expect(
      admin.query(
        `INSERT INTO platform.user_account (tenant_id, patient_id, identity_issuer, identity_subject)
         VALUES ($1, $2, 'portal', 'p-1')`,
        [a.tenantId, otherTenantPatient],
      ),
    ).rejects.toMatchObject({ code: PG.foreignKeyViolation });
  });
});
