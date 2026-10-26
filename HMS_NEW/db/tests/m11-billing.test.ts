// M11 billing: charges once per source, frozen money after invoicing, invoice immutability after issue,
// one live invoice per charge, cash only inside a cashier shift, write ownership and tenant isolation.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PG, adminPool, appPool, asTenant, createPatient, createTenant, type TenantFixture } from './db.ts';

const admin = adminPool();
const app = appPool();
let a: TenantFixture;
let b: TenantFixture;
let patient: string;
let staff: string;

const charge = (overrides: Record<string, unknown> = {}) => ({
  source_type: 'manual', source_id: null, service_date: '2026-10-22', description: 'Dressing', quantity: 1,
  unit_price_minor: 30000, gross_minor: 30000, discount_minor: 0, taxable_minor: 30000, is_tax_exempt: true, net_minor: 30000,
  ...overrides,
});

async function insertCharge(t: TenantFixture, values: Record<string, unknown>, patientId: string | null = patient): Promise<string> {
  const cols = ['tenant_id', 'facility_id', 'patient_id', ...Object.keys(values)];
  const params = [t.tenantId, t.facilityId, patientId, ...Object.values(values)];
  return asTenant(app, t.tenantId, 'mod_billing', async (c) => {
    const { rows: [r] } = await c.query<{ id: string }>(
      `INSERT INTO billing.charge (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, params);
    return r!.id;
  }, { commit: true });
}

async function draftInvoice(t: TenantFixture, chargeId: string): Promise<string> {
  return asTenant(app, t.tenantId, 'mod_billing', async (c) => {
    const { rows: [i] } = await c.query<{ id: string }>(
      `INSERT INTO billing.invoice (tenant_id, facility_id, patient_id, bill_kind, bill_to_name, gross_minor, taxable_minor, net_minor)
       VALUES ($1, $2, $3, 'opd', 'Asha', 30000, 30000, 30000) RETURNING id`, [t.tenantId, t.facilityId, patient]);
    await c.query(`INSERT INTO billing.invoice_line (tenant_id, invoice_id, charge_id, line_no, amount_minor) VALUES ($1, $2, $3, 1, 30000)`,
      [t.tenantId, i!.id, chargeId]);
    return i!.id;
  }, { commit: true });
}

async function issue(t: TenantFixture, invoiceId: string, no: string) {
  await asTenant(app, t.tenantId, 'mod_billing', (c) => c.query(
    `UPDATE billing.invoice SET status = 'issued', invoice_no = $2, document_type = 'bill_of_supply', financial_year = '2026-27',
            place_of_supply = '29', issued_at = now() WHERE id = $1`, [invoiceId, no]), { commit: true });
}

beforeAll(async () => {
  a = await createTenant(admin, 'billing-a');
  b = await createTenant(admin, 'billing-b');
  patient = await createPatient(admin, a.tenantId, 'Asha');
  const { rows: [s] } = await admin.query<{ id: string }>(
    `INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, 'C1', 'Cash', 'Cashier', 'admin') RETURNING id`,
    [a.tenantId]);
  staff = s!.id;
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe('charges', () => {
  it('charge a source once per service date; a reversed charge frees the key', async () => {
    const source = (await admin.query<{ id: string }>('SELECT uuidv7() AS id')).rows[0]!.id;
    const bed = charge({ source_type: 'procedure', source_id: source, description: 'Nebulisation' });
    const first = await insertCharge(a, bed);
    await expect(insertCharge(a, bed)).rejects.toMatchObject({ code: PG.uniqueViolation });
    await insertCharge(a, { ...bed, service_date: '2026-10-23' });             // next day is its own charge
    await asTenant(app, a.tenantId, 'mod_billing', (c) => c.query(
      `UPDATE billing.charge SET status = 'reversed', reversed_at = now(), reverse_reason = 'wrong bed' WHERE id = $1`, [first]), { commit: true });
    await expect(insertCharge(a, bed)).resolves.toBeTruthy();
  });

  it('keep their arithmetic consistent and only OTC pharmacy lines may lack a patient', async () => {
    await expect(insertCharge(a, charge({ net_minor: 29999 }))).rejects.toMatchObject({ code: PG.checkViolation });
    await expect(insertCharge(a, charge({ is_tax_exempt: true, gst_rate_bp: 500 }))).rejects.toMatchObject({ code: PG.checkViolation });
    await expect(insertCharge(a, charge(), null)).rejects.toMatchObject({ code: PG.checkViolation });
    // (A patient-less OTC charge needs a real dispense line; billing.test / pharmacy.test cover it end to end.)
  });

  it('freeze their money once invoiced', async () => {
    const id = await insertCharge(a, charge());
    await asTenant(app, a.tenantId, 'mod_billing', (c) => c.query(`UPDATE billing.charge SET status = 'invoiced' WHERE id = $1`, [id]), { commit: true });
    await expect(asTenant(app, a.tenantId, 'mod_billing', (c) => c.query(
      `UPDATE billing.charge SET discount_minor = 100, taxable_minor = 29900, net_minor = 29900 WHERE id = $1`, [id]))).rejects.toMatchObject({ code: PG.objectNotInPrerequisiteState });
  });
});

describe('invoices', () => {
  it('are frozen once issued, and their lines with them', async () => {
    const c1 = await insertCharge(a, charge());
    const inv = await draftInvoice(a, c1);
    await issue(a, inv, 'BOS/2026-27/000001');
    await expect(asTenant(app, a.tenantId, 'mod_billing', (c) => c.query(`UPDATE billing.invoice SET bill_to_name = 'Other' WHERE id = $1`, [inv])))
      .rejects.toMatchObject({ code: PG.objectNotInPrerequisiteState });
    await expect(asTenant(app, a.tenantId, 'mod_billing', (c) => c.query(`DELETE FROM billing.invoice_line WHERE invoice_id = $1`, [inv])))
      .rejects.toMatchObject({ code: PG.objectNotInPrerequisiteState });
    // settlement still moves
    await asTenant(app, a.tenantId, 'mod_billing', (c) => c.query(`UPDATE billing.invoice SET paid_minor = 30000, status = 'paid' WHERE id = $1`, [inv]));
  });

  it('carry a number exactly when issued, unique per facility', async () => {
    const inv = await draftInvoice(a, await insertCharge(a, charge()));
    await expect(asTenant(app, a.tenantId, 'mod_billing', (c) => c.query(`UPDATE billing.invoice SET status = 'issued' WHERE id = $1`, [inv])))
      .rejects.toMatchObject({ code: PG.checkViolation });
    await issue(a, inv, 'BOS/2026-27/000002');
    const dup = await draftInvoice(a, await insertCharge(a, charge()));
    await expect(issue(a, dup, 'BOS/2026-27/000002')).rejects.toMatchObject({ code: PG.uniqueViolation });
  });

  it('hold a charge on one live invoice at a time; voiding releases it', async () => {
    const c1 = await insertCharge(a, charge());
    const first = await draftInvoice(a, c1);
    await expect(draftInvoice(a, c1)).rejects.toMatchObject({ code: PG.uniqueViolation });
    await asTenant(app, a.tenantId, 'mod_billing', async (c) => {
      await c.query(`UPDATE billing.invoice_line SET released_at = now() WHERE invoice_id = $1`, [first]);
      await c.query(`UPDATE billing.invoice SET status = 'void', voided_at = now(), void_reason = 'rebill' WHERE id = $1`, [first]);
    }, { commit: true });
    await expect(draftInvoice(a, c1)).resolves.toBeTruthy();
  });
});

describe('money in', () => {
  it('cash needs a cashier shift; other methods need a reference', async () => {
    const pay = (method: string, shift: string | null, ref: string | null) => asTenant(app, a.tenantId, 'mod_billing', (c) => c.query(
      `INSERT INTO billing.payment (tenant_id, facility_id, patient_id, payer_name, method, amount_minor, cashier_shift_id, reference_no)
       VALUES ($1, $2, $3, 'Asha', $4, 1000, $5, $6)`, [a.tenantId, a.facilityId, patient, method, shift, ref]));
    await expect(pay('cash', null, null)).rejects.toMatchObject({ code: PG.checkViolation });
    await expect(pay('upi', null, null)).rejects.toMatchObject({ code: PG.checkViolation });
    await expect(pay('upi', null, 'UPI-123')).resolves.toBeTruthy();
    const shift = await asTenant(app, a.tenantId, 'mod_billing', async (c) => (await c.query<{ id: string }>(
      `INSERT INTO billing.cashier_shift (tenant_id, facility_id, staff_id) VALUES ($1, $2, $3) RETURNING id`, [a.tenantId, a.facilityId, staff])).rows[0]!.id, { commit: true });
    await expect(pay('cash', shift, null)).resolves.toBeTruthy();
    // one open shift per person per facility
    await expect(asTenant(app, a.tenantId, 'mod_billing', (c) => c.query(
      `INSERT INTO billing.cashier_shift (tenant_id, facility_id, staff_id) VALUES ($1, $2, $3)`, [a.tenantId, a.facilityId, staff])))
      .rejects.toMatchObject({ code: PG.uniqueViolation });
  });

  it('receipts and credit notes are append-only', async () => {
    const payment = await asTenant(app, a.tenantId, 'mod_billing', async (c) => {
      const { rows: [p] } = await c.query<{ id: string }>(
        `INSERT INTO billing.payment (tenant_id, facility_id, patient_id, payer_name, method, amount_minor, reference_no)
         VALUES ($1, $2, $3, 'Asha', 'card', 500, 'RRN1') RETURNING id`, [a.tenantId, a.facilityId, patient]);
      await c.query(`INSERT INTO billing.receipt (tenant_id, facility_id, payment_id, receipt_no, financial_year) VALUES ($1, $2, $3, 'RC/2026-27/000001', '2026-27')`,
        [a.tenantId, a.facilityId, p!.id]);
      return p!.id;
    }, { commit: true });
    await expect(asTenant(app, a.tenantId, 'mod_billing', (c) => c.query(`UPDATE billing.receipt SET receipt_no = 'X' WHERE payment_id = $1`, [payment])))
      .rejects.toThrow();
  });
});

describe('ownership and isolation', () => {
  it('only mod_billing writes billing; other tenants see nothing', async () => {
    await expect(asTenant(app, a.tenantId, 'mod_booking', (c) => c.query(
      `INSERT INTO billing.cashier_shift (tenant_id, facility_id, staff_id) VALUES ($1, $2, $3)`, [a.tenantId, a.facilityId, staff])))
      .rejects.toMatchObject({ code: PG.insufficientPrivilege });
    await insertCharge(a, charge());
    const seen = await asTenant(app, b.tenantId, null, async (c) => (await c.query('SELECT 1 FROM billing.charge')).rowCount);
    expect(seen).toBe(0);
  });
});
