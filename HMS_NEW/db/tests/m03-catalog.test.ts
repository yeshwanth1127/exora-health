// M03 catalogue and pricing: global reference data, category rules, panels, reference ranges,
// price lists (overlap, freeze, default), tax rules and practitioner affiliations.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PG, adminPool, appPool, asTenant, createBedCategory, createTenant, type TenantFixture } from './db.ts';

const admin = adminPool();
const app = appPool();
let a: TenantFixture;
let b: TenantFixture;
let consult: string;
let hb: string;
let bedGen: string;
let bedIcu: string;

async function item(t: TenantFixture, code: string, category: string, modality: string | null = null): Promise<string> {
  const { rows: [r] } = await admin.query<{ id: string }>(
    `INSERT INTO catalog.service_item (tenant_id, code, name, category, modality) VALUES ($1, $2, $2, $3, $4) RETURNING id`,
    [t.tenantId, code, category, modality],
  );
  return r!.id;
}

async function draftList(t: TenantFixture, code: string): Promise<string> {
  const { rows: [r] } = await admin.query<{ id: string }>(
    `INSERT INTO catalog.price_list (tenant_id, code, name, kind, valid_from) VALUES ($1, $2, $2, 'cash', '2026-04-01') RETURNING id`,
    [t.tenantId, code],
  );
  return r!.id;
}

beforeAll(async () => {
  a = await createTenant(admin, 'catalog-a');
  b = await createTenant(admin, 'catalog-b');
  consult = await item(a, 'CONS', 'consultation');
  hb = await item(a, 'HB', 'lab_test');
  bedGen = await createBedCategory(admin, a.tenantId, 'GEN', 1);
  bedIcu = await createBedCategory(admin, a.tenantId, 'ICU', 4);
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe('global reference data', () => {
  it('is readable by every tenant and writable by no module', async () => {
    const count = await asTenant(app, a.tenantId, 'mod_catalog', async (c) => (await c.query('SELECT 1 FROM catalog.specialty')).rowCount);
    expect(count).toBeGreaterThan(20);
    await expect(
      asTenant(app, a.tenantId, 'mod_catalog', (c) => c.query(`INSERT INTO catalog.specialty (code, name) VALUES ('made_up', 'Made up')`)),
    ).rejects.toMatchObject({ code: PG.insufficientPrivilege });
  });
});

describe('service catalogue rules', () => {
  it('imaging services need a DICOM modality; other services must not have one', async () => {
    await expect(item(a, 'XR-CHEST', 'imaging', 'DX')).resolves.toBeDefined();
    await expect(item(a, 'CT-HEAD', 'imaging')).rejects.toMatchObject({ code: PG.checkViolation });
    await expect(item(a, 'CONS-2', 'consultation', 'CT')).rejects.toMatchObject({ code: PG.checkViolation });
  });

  it('a lab test definition must point at a lab_test service', async () => {
    const insert = (serviceItemId: string) =>
      admin.query(
        `INSERT INTO catalog.lab_test_def (tenant_id, service_item_id, section, specimen_type) VALUES ($1, $2, 'haematology', 'whole_blood')`,
        [a.tenantId, serviceItemId],
      );
    await expect(insert(consult)).rejects.toMatchObject({ code: PG.checkViolation });
    await expect(insert(hb)).resolves.toBeDefined();
  });

  it('panels cannot contain themselves, directly or indirectly', async () => {
    const [p1, p2, p3] = await Promise.all([item(a, 'P1', 'lab_panel'), item(a, 'P2', 'lab_panel'), item(a, 'P3', 'lab_panel')]);
    const component = (parent: string, child: string) =>
      admin.query(`INSERT INTO catalog.service_component (tenant_id, parent_item_id, child_item_id) VALUES ($1, $2, $3)`, [
        a.tenantId,
        parent,
        child,
      ]);
    await component(p1, p2);
    await component(p2, p3);
    await expect(component(p3, p1)).rejects.toMatchObject({ code: PG.checkViolation });
  });
});

describe('reference ranges', () => {
  it('rejects overlapping age bands for the same parameter and sex, accepts adjacent ones', async () => {
    const { rows: [def] } = await admin.query<{ id: string }>(
      `INSERT INTO catalog.observation_definition (tenant_id, lab_test_item_id, code, name, category, value_type, unit)
       VALUES ($1, $2, 'HB-T', 'Haemoglobin', 'lab', 'numeric', 'g/dL') RETURNING id`,
      [a.tenantId, hb],
    );
    const range = (sex: string, minDays: number, maxDays: number | null) =>
      admin.query(
        `INSERT INTO catalog.reference_range (tenant_id, observation_definition_id, sex, age_min_days, age_max_days, low, high, valid_from)
         VALUES ($1, $2, $3, $4, $5, 11, 16, '2026-01-01')`,
        [a.tenantId, def!.id, sex, minDays, maxDays],
      );
    await range('male', 6570, null);
    await expect(range('male', 365, 6570)).resolves.toBeDefined(); // adjacent: [365, 6570) then [6570, ∞)
    await expect(range('male', 6000, 7000)).rejects.toMatchObject({ code: PG.exclusionViolation });
    await expect(range('female', 6570, null)).resolves.toBeDefined();
  });
});

describe('price lists', () => {
  it('rejects two prices for the same service, bed category and doctor in overlapping periods', async () => {
    const list = await draftList(a, 'OVERLAP');
    const price = (bed: string | null, from: string, to: string | null) =>
      admin.query(
        `INSERT INTO catalog.price_list_item (tenant_id, price_list_id, service_item_id, bed_category_id, unit_price_minor, valid_from, valid_to)
         VALUES ($1, $2, $3, $4, 50000, $5, $6)`,
        [a.tenantId, list, consult, bed, from, to],
      );
    await price(null, '2026-04-01', '2026-10-01');
    await expect(price(null, '2026-09-01', null)).rejects.toMatchObject({ code: PG.exclusionViolation });
    await expect(price(null, '2026-10-01', null)).resolves.toBeDefined(); // starts when the first ends
    await expect(price(bedGen, '2026-04-01', null)).resolves.toBeDefined(); // a different bed category is a different key
    await expect(price(bedIcu, '2026-04-01', null)).resolves.toBeDefined();
  });

  it('services need a fixed price; a price is either fixed or a pricing rule', async () => {
    const list = await draftList(a, 'SHAPE');
    await expect(
      admin.query(
        `INSERT INTO catalog.price_list_item (tenant_id, price_list_id, service_item_id, item_pricing_method, percent_bp, valid_from)
         VALUES ($1, $2, $3, 'cost_plus_markup', 1000, '2026-04-01')`,
        [a.tenantId, list, consult],
      ),
    ).rejects.toMatchObject({ code: PG.checkViolation });
  });

  it('freezes prices once a list is active, and never goes back to draft', async () => {
    const list = await draftList(a, 'FREEZE');
    const { rows: [line] } = await admin.query<{ id: string }>(
      `INSERT INTO catalog.price_list_item (tenant_id, price_list_id, service_item_id, unit_price_minor, valid_from)
       VALUES ($1, $2, $3, 50000, '2026-04-01') RETURNING id`,
      [a.tenantId, list, consult],
    );
    await admin.query(`UPDATE catalog.price_list SET status = 'active', activated_at = now() WHERE id = $1`, [list]);
    await expect(
      admin.query(`UPDATE catalog.price_list_item SET unit_price_minor = 1 WHERE id = $1`, [line!.id]),
    ).rejects.toMatchObject({ code: PG.objectNotInPrerequisiteState });
    await expect(
      admin.query(
        `INSERT INTO catalog.price_list_item (tenant_id, price_list_id, service_item_id, unit_price_minor, valid_from)
         VALUES ($1, $2, $3, 1, '2027-04-01')`,
        [a.tenantId, list, hb],
      ),
    ).rejects.toMatchObject({ code: PG.objectNotInPrerequisiteState });
    await expect(admin.query(`UPDATE catalog.price_list SET name = 'Renamed' WHERE id = $1`, [list])).rejects.toMatchObject({
      code: PG.objectNotInPrerequisiteState,
    });
    await expect(
      admin.query(`UPDATE catalog.price_list SET status = 'draft', activated_at = NULL WHERE id = $1`, [list]),
    ).rejects.toMatchObject({ code: PG.objectNotInPrerequisiteState });
  });

  it('allows only one active default price list per tenant', async () => {
    const activate = async (code: string) => {
      const list = await draftList(a, code);
      return admin.query(`UPDATE catalog.price_list SET status = 'active', activated_at = now(), is_default = true WHERE id = $1`, [list]);
    };
    await activate('DEFAULT-1');
    await expect(activate('DEFAULT-2')).rejects.toMatchObject({ code: PG.uniqueViolation });
  });
});

describe('tax rules', () => {
  it('tenants see system rules plus their own, and cannot write system rules', async () => {
    await admin.query(
      `INSERT INTO catalog.tax_rule (tenant_id, tax_code, description, gst_rate_bp, valid_from)
       VALUES (NULL, 'SYS-EXEMPT', 'System example', 0, '2026-01-01'),
              ($1, 'A-ONLY', 'Tenant A rule', 500, '2026-01-01'),
              ($2, 'B-ONLY', 'Tenant B rule', 1800, '2026-01-01')`,
      [a.tenantId, b.tenantId],
    );
    const codes = await asTenant(app, a.tenantId, null, async (c) =>
      (await c.query<{ tax_code: string }>('SELECT tax_code FROM catalog.tax_rule ORDER BY tax_code')).rows.map((r) => r.tax_code),
    );
    expect(codes).toEqual(['A-ONLY', 'SYS-EXEMPT']);
    await expect(
      asTenant(app, a.tenantId, 'mod_catalog', (c) =>
        c.query(`INSERT INTO catalog.tax_rule (tenant_id, tax_code, description, gst_rate_bp, valid_from) VALUES (NULL, 'X', 'X', 0, '2026-01-01')`),
      ),
    ).rejects.toMatchObject({ code: PG.insufficientPrivilege });
  });
});

describe('beds and practitioners', () => {
  it("a bed cannot use another tenant's bed category", async () => {
    const otherCategory = await createBedCategory(admin, b.tenantId, 'GEN', 1);
    const { rows: [ward] } = await admin.query<{ id: string }>(
      `INSERT INTO platform.location (tenant_id, facility_id, kind, code, name, ward_type)
       VALUES ($1, $2, 'ward', 'WX', 'Ward X', 'general') RETURNING id`,
      [a.tenantId, a.facilityId],
    );
    await expect(
      admin.query(
        `INSERT INTO platform.location (tenant_id, facility_id, parent_location_id, kind, code, name, bed_category_id)
         VALUES ($1, $2, $3, 'bed', 'WX-B1', 'Bed', $4)`,
        [a.tenantId, a.facilityId, ward!.id, otherCategory],
      ),
    ).rejects.toMatchObject({ code: PG.foreignKeyViolation });
  });

  it('a practitioner cannot have overlapping affiliations to the same department', async () => {
    const { rows: [staff] } = await admin.query<{ id: string }>(
      `INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, 'D1', 'Doc', 'Doc', 'doctor') RETURNING id`,
      [a.tenantId],
    );
    const { rows: [dept] } = await admin.query<{ id: string }>(
      `INSERT INTO platform.department (tenant_id, facility_id, code, name, kind) VALUES ($1, $2, 'CARD', 'Cardiology', 'clinical') RETURNING id`,
      [a.tenantId, a.facilityId],
    );
    const affiliate = (from: string, to: string | null) =>
      admin.query(
        `INSERT INTO catalog.practitioner_affiliation (tenant_id, staff_id, facility_id, department_id, valid_from, valid_to)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [a.tenantId, staff!.id, a.facilityId, dept!.id, from, to],
      );
    await affiliate('2025-01-01', '2026-01-01');
    await expect(affiliate('2025-06-01', null)).rejects.toMatchObject({ code: PG.exclusionViolation });
    await expect(affiliate('2026-01-01', null)).resolves.toBeDefined();
  });
});
