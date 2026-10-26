// M10 inventory / M09 pharmacy: stock never goes negative, expired or recalled batches are never issued,
// a dispense is never priced above MRP or beyond what was prescribed, signed prescriptions are frozen,
// pharmacy reaches the ledger only through post_patient_movement (which must match its line), and
// write ownership holds.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PG, adminPool, appPool, asTenant, createPatient, createTenant, type TenantFixture } from './db.ts';

const admin = adminPool();
const app = appPool();
let a: TenantFixture;
let store: string;
let item: string;
let batch: string;
let expired: string;
let staff: string;
let patient: string;
let encounter: string;

const one = async (text: string, values: unknown[]) => (await admin.query<{ id: string }>(text, values)).rows[0]!.id;
const adjustment = (kind: string) => one(`INSERT INTO inventory.stock_adjustment (tenant_id, facility_id, adjustment_no, store_id, kind, reason, created_by)
  VALUES ($1, $2, 'ADJ-' || uuidv7(), $3, $4, 'test', $5) RETURNING id`, [a.tenantId, a.facilityId, store, kind, staff]);
const move = (batchId: string, type: string, qty: number, adjId: string) => asTenant(app, a.tenantId, 'mod_inventory', (c) => c.query(
  `INSERT INTO inventory.stock_movement (tenant_id, store_id, item_id, item_batch_id, movement_type, quantity, unit_cost_minor, adjustment_id)
   VALUES ($1, $2, $3, $4, $5, $6, 100, $7)`, [a.tenantId, store, item, batchId, type, qty, adjId]), { commit: true });

beforeAll(async () => {
  a = await createTenant(admin, 'pharmacy-db');
  staff = await one(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, 'P1', 'Pharm', 'Pharm', 'pharmacist') RETURNING id`, [a.tenantId]);
  patient = await createPatient(admin, a.tenantId, 'Rx');
  encounter = await one(`INSERT INTO clinical.encounter (tenant_id, encounter_no, patient_id, facility_id, attending_staff_id, encounter_class) VALUES ($1, 'OP-T1', $2, $3, $4, 'outpatient') RETURNING id`, [a.tenantId, patient, a.facilityId, staff]);
  store = await one(`INSERT INTO inventory.store (tenant_id, facility_id, code, name, drug_licence_no) VALUES ($1, $2, 'PH', 'Pharmacy', 'DL-1') RETURNING id`, [a.tenantId, a.facilityId]);
  item = await one(`INSERT INTO inventory.item (tenant_id, code, name, item_type, base_uom) VALUES ($1, 'PCM', 'Paracetamol', 'drug', 'tablet') RETURNING id`, [a.tenantId]);
  await admin.query(`INSERT INTO inventory.drug_product (tenant_id, item_id, generic_name, dosage_form) VALUES ($1, $2, 'Paracetamol', 'tablet')`, [a.tenantId, item]);
  batch = await one(`INSERT INTO inventory.item_batch (tenant_id, item_id, batch_no, expiry_date, mrp_minor, unit_cost_minor) VALUES ($1, $2, 'B1', '2099-12-31', 200, 100) RETURNING id`, [a.tenantId, item]);
  expired = await one(`INSERT INTO inventory.item_batch (tenant_id, item_id, batch_no, expiry_date, mrp_minor, unit_cost_minor) VALUES ($1, $2, 'OLD', '2020-01-31', 200, 100) RETURNING id`, [a.tenantId, item]);
  const opening = await adjustment('opening');
  await move(batch, 'opening', 10, opening);
  await move(expired, 'opening', 5, opening);
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe('stock ledger', () => {
  it('keeps balances in step and never below zero', async () => {
    const use = await adjustment('consumption');
    await move(batch, 'consumption', -4, use);
    const { rows: [b] } = await admin.query(`SELECT on_hand::float AS on_hand FROM inventory.stock_balance WHERE item_batch_id = $1`, [batch]);
    expect(b.on_hand).toBe(6);
    await expect(move(batch, 'consumption', -7, use)).rejects.toMatchObject({ code: PG.checkViolation, constraint: 'stock_balance_on_hand_check' });
    expect((await admin.query(`SELECT count(*)::int AS n FROM inventory.stock_balance_drift WHERE tenant_id = $1`, [a.tenantId])).rows[0].n).toBe(0);
  });

  it('never issues an expired or recalled batch, but can dispose of it', async () => {
    const use = await adjustment('consumption');
    await expect(move(expired, 'consumption', -1, use)).rejects.toMatchObject({ code: PG.objectNotInPrerequisiteState });
    await expect(move(expired, 'expiry_disposal', -5, await adjustment('expiry_disposal'))).resolves.toBeTruthy();
  });

  it('is append-only and written only by inventory', async () => {
    await expect(asTenant(app, a.tenantId, 'mod_inventory', (c) => c.query(`UPDATE inventory.stock_movement SET quantity = 1 WHERE item_batch_id = $1`, [batch]))).rejects.toThrow();
    await expect(asTenant(app, a.tenantId, 'mod_pharmacy', (c) => c.query(
      `INSERT INTO inventory.stock_movement (tenant_id, store_id, item_id, item_batch_id, movement_type, quantity, unit_cost_minor, adjustment_id)
       VALUES ($1, $2, $3, $4, 'consumption', -1, 100, NULL)`, [a.tenantId, store, item, batch]))).rejects.toMatchObject({ code: PG.insufficientPrivilege });
  });
});

describe('prescriptions and dispensing', () => {
  async function signedRx(quantity: number) {
    return asTenant(app, a.tenantId, 'mod_pharmacy', async (c) => {
      const { rows: [rx] } = await c.query<{ id: string }>(
        `INSERT INTO pharmacy.prescription (tenant_id, encounter_id, patient_id, facility_id, setting, prescriber_staff_id) VALUES ($1, $2, $3, $4, 'outpatient', $5) RETURNING id`,
        [a.tenantId, encounter, patient, a.facilityId, staff]);
      const { rows: [line] } = await c.query<{ id: string }>(
        `INSERT INTO pharmacy.prescription_item (tenant_id, prescription_id, line_no, item_id, generic_name, dose, dose_unit, route, frequency_code, quantity_prescribed)
         VALUES ($1, $2, 1, $3, 'Paracetamol', 1, 'tablet', 'oral', 'TDS', $4) RETURNING id`, [a.tenantId, rx!.id, item, quantity]);
      await c.query(`UPDATE pharmacy.prescription SET status = 'signed', signed_at = now() WHERE id = $1`, [rx!.id]);
      return { rx: rx!.id, line: line!.id };
    }, { commit: true });
  }

  it('freezes a signed prescription and caps dispensing at the prescribed quantity', async () => {
    const { rx, line } = await signedRx(5);
    await expect(asTenant(app, a.tenantId, 'mod_pharmacy', (c) => c.query(`UPDATE pharmacy.prescription SET advice = 'changed' WHERE id = $1`, [rx]))).rejects.toMatchObject({ code: PG.objectNotInPrerequisiteState });
    await expect(asTenant(app, a.tenantId, 'mod_pharmacy', (c) => c.query(`UPDATE pharmacy.prescription_item SET quantity_dispensed = 6 WHERE id = $1`, [line]))).rejects.toMatchObject({ code: PG.checkViolation });
  });

  it('never prices above MRP, and posts stock only for the line it names', async () => {
    const { rx, line } = await signedRx(5);
    await asTenant(app, a.tenantId, 'mod_pharmacy', async (c) => {
      const { rows: [d] } = await c.query<{ id: string }>(
        `INSERT INTO pharmacy.dispense (tenant_id, dispense_no, dispense_type, prescription_id, patient_id, encounter_id, facility_id, store_id, dispensed_by)
         VALUES ($1, 'D-' || uuidv7(), 'prescription', $2, $3, $4, $5, $6, $7) RETURNING id`, [a.tenantId, rx, patient, encounter, a.facilityId, store, staff]);
      await c.query('SAVEPOINT s');
      await expect(c.query(`INSERT INTO pharmacy.dispense_line (tenant_id, dispense_id, prescription_item_id, item_id, item_batch_id, quantity, mrp_snapshot_minor, unit_price_minor)
        VALUES ($1, $2, $3, $4, $5, 1, 200, 250)`, [a.tenantId, d!.id, line, item, batch])).rejects.toMatchObject({ code: PG.checkViolation });
      await c.query('ROLLBACK TO SAVEPOINT s');
      const { rows: [l] } = await c.query<{ id: string }>(`INSERT INTO pharmacy.dispense_line (tenant_id, dispense_id, prescription_item_id, item_id, item_batch_id, quantity, mrp_snapshot_minor, unit_price_minor)
        VALUES ($1, $2, $3, $4, $5, 2, 200, 200) RETURNING id`, [a.tenantId, d!.id, line, item, batch]);
      // A movement that doesn't match the line (wrong quantity) is refused…
      await c.query('SAVEPOINT m');
      await expect(c.query(`SELECT inventory.post_patient_movement($1, $2, 3, $3, $4, $5, NULL)`, [store, batch, patient, staff, l!.id])).rejects.toMatchObject({ code: '22023' });
      await c.query('ROLLBACK TO SAVEPOINT m');
      // …the matching one posts once
      await c.query(`SELECT inventory.post_patient_movement($1, $2, 2, $3, $4, $5, NULL)`, [store, batch, patient, staff, l!.id]);
      await c.query('SAVEPOINT n');
      await expect(c.query(`SELECT inventory.post_patient_movement($1, $2, 2, $3, $4, $5, NULL)`, [store, batch, patient, staff, l!.id])).rejects.toMatchObject({ code: PG.uniqueViolation });
      await c.query('ROLLBACK TO SAVEPOINT n');
    });
  });

  it('keeps every OTC sale free of a prescription', async () => {
    await expect(asTenant(app, a.tenantId, 'mod_pharmacy', (c) => c.query(
      `INSERT INTO pharmacy.dispense (tenant_id, dispense_no, dispense_type, buyer_name, encounter_id, facility_id, store_id, dispensed_by)
       VALUES ($1, 'D-X', 'otc', 'Walk-in', $2, $3, $4, $5)`, [a.tenantId, encounter, a.facilityId, store, staff]))).rejects.toMatchObject({ code: PG.checkViolation });
  });
});
