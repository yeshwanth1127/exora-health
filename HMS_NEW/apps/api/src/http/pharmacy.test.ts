// Pharmacy over HTTP: a store and drugs → goods received from a supplier (batches with expiry and MRP) →
// a doctor prescribes and signs (allergy warning needs an override) → the pharmacist dispenses first-
// expiry-first-out across batches, never above MRP, never from an expired batch → stock falls → billing
// charges each line at the MRP-inclusive price (GST worked back out) → a tax invoice from the sale →
// a return re-charges the rest. Counter sales refuse Schedule H drugs without a prescription and bill
// a walk-in buyer. Inpatients: ward indent → dispense onto the stay's account → MAR with witness rules.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let admin: Person;
let doctor: Person;
let nurse: Person;
let nurse2: Person;
let pharmacist: Person;
let store: string;
let paracetamol: string;
let amoxicillin: string;
let tramadol: string;
let supplier: string;

const f = () => k.tenant.facilityId;
const switchOn = async (module: string) => {
  const m = (await k.call(admin, 'GET', '/v1/modules')).body.items.find((x: { module: string }) => x.module === module);
  expect((await k.call(admin, 'PUT', `/v1/modules/${module}`, { state: 'active', version: m.version, reason: 'Clinic opens its pharmacy' })).status).toBe(200);
};
const patient = async (name: string) => (await k.call(admin, 'POST', '/v1/patients', { givenName: name, sex: 'female', registeredFacilityId: f(), source: 'front_desk' })).body.patientId as string;
const onHand = async (itemId: string) => (await k.call(pharmacist, 'GET', `/v1/inventory/stock?storeId=${store}&itemId=${itemId}`)).body.items
  .map((b: { batchNo: string; onHand: number }) => [b.batchNo, b.onHand]);
const drug = (code: string, name: string, generic: string, schedule: string, extra: Record<string, unknown> = {}) => k.call(admin, 'POST', '/v1/inventory/items', {
  code, name, itemType: 'drug', baseUom: 'tablet', packUom: 'strip', packSize: 10, hsnCode: '3004', reorderLevel: 20,
  drug: { genericName: generic, strength: '500 mg', dosageForm: 'tablet', defaultRoute: 'oral', regulatorySchedule: schedule, ...extra },
});

beforeAll(async () => {
  k = await startKit('pharmacy');
  admin = await k.person('Meera Admin', 'tenant_admin', null);
  doctor = await k.person('Dr Anand', 'doctor', null, 'doctor');
  nurse = await k.person('Sister Mary', 'nurse', f(), 'nurse');
  nurse2 = await k.person('Sister Rose', 'nurse', f(), 'nurse');
  pharmacist = await k.person('Kiran Pharmacist', 'pharmacist', f(), 'pharmacist');
  await k.admin.query(`INSERT INTO platform.staff_registration (tenant_id, staff_id, council, registration_no, valid_until) VALUES ($1, $2, 'NMC', $3, '2099-12-31')`, [k.tenant.tenantId, doctor.staffId, `R-${k.run}`]);
  // Medicines: 12% GST by HSN 3004 (rates are the clinic's CA's call; this is test data).
  await k.admin.query(`INSERT INTO catalog.tax_rule (tenant_id, tax_code, description, hsn_sac_code, item_type, gst_rate_bp, valid_from) VALUES ($1, 'GST12-3004', 'Medicaments', '3004', 'drug', 1200, '2024-01-01')`, [k.tenant.tenantId]);
});
afterAll(() => k.close());

describe('pharmacy', () => {
  it('is off until switched on, and switching it on brings inventory', async () => {
    expect((await k.call(pharmacist, 'GET', `/v1/pharmacy/queue?facilityId=${f()}`)).body.error.details.reason).toBe('module_inactive');
    await switchOn('billing');
    await switchOn('pharmacy');
    expect((await k.call(pharmacist, 'GET', `/v1/inventory/stores?facilityId=${f()}`)).status).toBe(200);
  });

  it('sets up the store, drugs and a supplier, and receives stock', async () => {
    store = (await k.call(admin, 'POST', '/v1/inventory/stores', { facilityId: f(), code: 'PHARM', name: 'Pharmacy', drugLicenceNo: 'KA-B-20-12345' })).body.storeId;
    paracetamol = (await drug('PCM500', 'Paracetamol 500 mg', 'Paracetamol', 'none')).body.itemId;
    amoxicillin = (await drug('AMX500', 'Amoxicillin 500 mg', 'Amoxicillin', 'H')).body.itemId;
    tramadol = (await drug('TRM50', 'Tramadol 50 mg', 'Tramadol', 'H1', { isHighAlert: true })).body.itemId;
    supplier = (await k.call(admin, 'POST', '/v1/inventory/suppliers', { code: 'MEDCO', name: 'Medco Distributors', gstin: '29ABCDE1234F1Z5' })).body.supplierId;
    const grn = await k.call(pharmacist, 'POST', '/v1/inventory/receipts', {
      storeId: store, supplierId: supplier, supplierInvoiceNo: 'MD-1001', supplierInvoiceOn: '2026-10-01',
      lines: [
        { itemId: amoxicillin, batchNo: 'AMX-LATE', expiryDate: '2028-06-30', mrpMinor: 1200, unitCostMinor: 700, qtyReceived: 100 },
        { itemId: amoxicillin, batchNo: 'AMX-SOON', expiryDate: '2027-01-31', mrpMinor: 1000, unitCostMinor: 600, qtyReceived: 10 },
        { itemId: paracetamol, batchNo: 'PCM-1', expiryDate: '2027-12-31', mrpMinor: 200, unitCostMinor: 100, qtyReceived: 200, qtyFree: 20 },
        { itemId: tramadol, batchNo: 'TRM-1', expiryDate: '2027-12-31', mrpMinor: 1500, unitCostMinor: 900, qtyReceived: 30 },
      ],
    });
    expect(grn.status).toBe(201);
    expect(grn.body.grnNo).toMatch(/^GRN\/2026-27\/000001$/);
    expect((await k.call(pharmacist, 'POST', '/v1/inventory/receipts', { storeId: store, supplierId: supplier, supplierInvoiceNo: 'MD-1001', supplierInvoiceOn: '2026-10-01', lines: [{ itemId: paracetamol, batchNo: 'PCM-2', expiryDate: '2027-12-31', unitCostMinor: 100, qtyReceived: 1 }] })).body.error.details.reason).toBe('duplicate_supplier_invoice');
    // An expired batch on the shelf (opening stock) is never picked
    expect((await k.call(pharmacist, 'POST', '/v1/inventory/adjustments', { storeId: store, kind: 'opening', reason: 'Opening stock', lines: [{ quantity: 50, opening: { itemId: amoxicillin, batchNo: 'AMX-OLD', expiryDate: '2025-12-31', mrpMinor: 900, unitCostMinor: 500 } }] })).status).toBe(201);
    expect(await onHand(paracetamol)).toEqual([['PCM-1', 220]]);
    const alerts = (await k.call(pharmacist, 'GET', `/v1/inventory/alerts?storeId=${store}`)).body;
    expect(alerts.expired.map((b: { batchNo: string }) => b.batchNo)).toEqual(['AMX-OLD']);
  });

  it('dispenses a signed prescription first-expiry-first-out and bills it MRP-inclusive', async () => {
    const lata = await patient('Lata');
    const enc = await k.call(admin, 'POST', '/v1/encounters', { patientId: lata, facilityId: f(), attendingStaffId: doctor.staffId, encounterClass: 'outpatient' });
    expect(enc.status).toBe(201);
    expect((await k.call(doctor, 'POST', `/v1/patients/${lata}/allergies`, { category: 'drug', substance: 'amoxicillin', reaction: 'rash', severity: 'mild' })).status).toBe(201);
    expect((await k.call(nurse, 'POST', `/v1/encounters/${enc.body.encounterId}/prescriptions`, { lines: [{ itemId: paracetamol, dose: 1, doseUnit: 'tablet', frequencyCode: 'TDS', quantity: 15 }] })).status).toBe(403);
    const rx = await k.call(doctor, 'POST', `/v1/encounters/${enc.body.encounterId}/prescriptions`, {
      lines: [
        { itemId: amoxicillin, dose: 1, doseUnit: 'tablet', frequencyCode: 'TDS', durationValue: 5, durationUnit: 'days', quantity: 15 },
        { itemId: paracetamol, dose: 1, doseUnit: 'tablet', frequencyCode: 'SOS', quantity: 10, isPrn: true },
      ],
    });
    expect(rx.status).toBe(201);
    const warn = await k.call(doctor, 'POST', `/v1/prescriptions/${rx.body.prescriptionId}/sign`, { version: rx.body.version });
    expect(warn.body.error.details.reason).toBe('allergy_warning');
    const signed = await k.call(doctor, 'POST', `/v1/prescriptions/${rx.body.prescriptionId}/sign`, { version: rx.body.version, overrideReason: 'Mild rash years ago; patient tolerated since' });
    expect(signed.body.status).toBe('signed');
    expect((await k.call(pharmacist, 'GET', `/v1/pharmacy/queue?facilityId=${f()}`)).body.items).toEqual([expect.objectContaining({ prescriptionId: rx.body.prescriptionId, openLines: 2 })]);

    const detail = (await k.call(pharmacist, 'GET', `/v1/prescriptions/${rx.body.prescriptionId}`)).body;
    const [amxLine, pcmLine] = detail.lines;
    expect(amxLine.warnings).toHaveLength(1);
    expect((await k.call(pharmacist, 'POST', '/v1/pharmacy/dispenses', { storeId: store, prescriptionId: rx.body.prescriptionId, lines: [{ prescriptionItemId: amxLine.prescriptionItemId, quantity: 16 }] })).body.error.details.reason).toBe('exceeds_prescribed');
    const sale = await k.call(pharmacist, 'POST', '/v1/pharmacy/dispenses', {
      storeId: store, prescriptionId: rx.body.prescriptionId,
      lines: [{ prescriptionItemId: amxLine.prescriptionItemId, quantity: 15 }, { prescriptionItemId: pcmLine.prescriptionItemId, quantity: 10 }],
    });
    expect(sale.status).toBe(201);
    // 10 from the batch expiring first (₹10 MRP), 5 from the next (₹12); never the expired AMX-OLD
    expect(sale.body.lines.map((l: { quantity: number; unitPriceMinor: number }) => [l.quantity, l.unitPriceMinor])).toEqual([[10, 1000], [5, 1200], [10, 200]]);
    expect(await onHand(amoxicillin)).toEqual([['AMX-OLD', 50], ['AMX-LATE', 95]]);
    expect((await k.call(pharmacist, 'GET', `/v1/prescriptions/${rx.body.prescriptionId}`)).body.status).toBe('completed');

    // Billing charges the lines; the bill is a tax invoice and the patient pays exactly the MRP-based total
    await k.dispatch();
    const draft = await k.call(pharmacist, 'POST', '/v1/billing/invoices', { facilityId: f(), dispenseId: sale.body.dispenseId });
    expect(draft.status).toBe(201);
    const issued = await k.call(pharmacist, 'POST', `/v1/billing/invoices/${draft.body.invoiceId}/issue`, { version: draft.body.version });
    expect(issued.body).toMatchObject({ documentType: 'tax_invoice', netMinor: 18000 });     // 10×₹10 + 5×₹12 + 10×₹2
    expect(issued.body.taxableMinor + issued.body.cgstMinor + issued.body.sgstMinor + issued.body.roundOffMinor).toBe(18000);
    expect(issued.body.cgstMinor).toBeGreaterThan(0);

    // A return of 5 paracetamol on an unbilled line would re-charge; this line is billed, so it stays for a credit note
    const pcmDispensed = (await k.call(pharmacist, 'GET', `/v1/pharmacy/dispenses/${sale.body.dispenseId}`)).body.lines.find((l: { itemName: string }) => l.itemName.startsWith('Paracetamol'));
    const ret = await k.call(pharmacist, 'POST', '/v1/pharmacy/returns', { dispenseLineId: pcmDispensed.dispenseLineId, quantity: 5, reason: 'Not needed', restockable: true });
    expect(ret.status).toBe(201);
    expect(await onHand(paracetamol)).toEqual([['PCM-1', 215]]);
    await k.dispatch();
    const charge = (await k.call(pharmacist, 'GET', `/v1/billing/charges?facilityId=${f()}&patientId=${lata}`)).body.items.find((c: { description: string }) => c.description.startsWith('Paracetamol'));
    expect(charge).toMatchObject({ status: 'invoiced', quantity: '10.000' });
  });

  it('sells over the counter, but not Schedule H/H1 drugs, and bills the walk-in buyer', async () => {
    const refused = await k.call(pharmacist, 'POST', '/v1/pharmacy/dispenses', { storeId: store, otc: { buyerName: 'Walk-in' }, lines: [{ itemId: amoxicillin, quantity: 6 }] });
    expect(refused.body.error.details.reason).toBe('prescription_required');
    const sale = await k.call(pharmacist, 'POST', '/v1/pharmacy/dispenses', { storeId: store, otc: { buyerName: 'Ramesh', buyerPhone: '+919800000001' }, lines: [{ itemId: paracetamol, quantity: 10 }] });
    expect(sale.status).toBe(201);
    expect(sale.body.type).toBe('otc');
    await k.dispatch();
    const bill = await k.call(pharmacist, 'POST', '/v1/billing/invoices', { facilityId: f(), dispenseId: sale.body.dispenseId });
    expect(bill.status).toBe(201);
    const issued = await k.call(pharmacist, 'POST', `/v1/billing/invoices/${bill.body.invoiceId}/issue`, { version: bill.body.version });
    expect(issued.body.netMinor).toBe(2000);
    expect((await k.call(pharmacist, 'GET', `/v1/billing/invoices/${bill.body.invoiceId}`)).body.billTo).toMatchObject({ name: 'Ramesh', phone: '+919800000001', patientId: null });
  });

  it('runs ward indents and the MAR for an admitted patient', async () => {
    await switchOn('inpatient');
    const cat = (await k.call(admin, 'POST', '/v1/bed-categories', { code: 'GEN', name: 'General' })).body.bedCategoryId;
    const ward = (await k.call(admin, 'POST', `/v1/facilities/${f()}/wards`, { code: 'W1', name: 'Ward', wardType: 'general' })).body.wardId;
    const bed = (await k.call(admin, 'POST', `/v1/wards/${ward}/beds`, { code: 'B1', name: 'Bed 1', bedCategoryId: cat })).body.bedId;
    const asha = await patient('Asha');
    const adm = await k.call(admin, 'POST', '/v1/admissions', { facilityId: f(), patientId: asha, admittingStaffId: doctor.staffId, admissionType: 'emergency', admissionReason: 'Fracture pain', bedId: bed });
    expect(adm.status).toBe(201);
    await k.dispatch();
    const stay = (await k.call(admin, 'GET', `/v1/admissions/${adm.body.admissionId}`)).body;

    // Ongoing inpatient order (no quantity): tramadol TDS (H1, high alert)
    const rx = await k.call(doctor, 'POST', `/v1/encounters/${stay.encounter.encounterId}/prescriptions`, { lines: [{ itemId: tramadol, dose: 1, doseUnit: 'tablet', frequencyCode: 'TDS' }] });
    expect(rx.body.setting).toBe('inpatient');
    await k.call(doctor, 'POST', `/v1/prescriptions/${rx.body.prescriptionId}/sign`, { version: rx.body.version });
    const order = (await k.call(nurse, 'GET', `/v1/prescriptions/${rx.body.prescriptionId}`)).body.lines[0];

    // Nurse indents 3 tablets; pharmacist dispenses onto the stay's account
    const indent = await k.call(nurse, 'POST', `/v1/admissions/${adm.body.admissionId}/indents`, { lines: [{ prescriptionItemId: order.prescriptionItemId, quantity: 3 }] });
    expect(indent.status).toBe(201);
    const queue = (await k.call(pharmacist, 'GET', `/v1/pharmacy/indents?facilityId=${f()}`)).body.items;
    expect(queue).toEqual([expect.objectContaining({ indentId: indent.body.indentId, bed: 'Bed 1' })]);
    const out = await k.call(pharmacist, 'POST', '/v1/pharmacy/dispenses', { storeId: store, indentId: indent.body.indentId, lines: [{ indentLineId: queue[0].lines[0].indentLineId, quantity: 3 }] });
    expect(out.status).toBe(201);
    await k.dispatch();
    const statement = (await k.call(admin, 'GET', `/v1/billing/accounts/${stay.billingAccount.accountId}/statement`)).body;
    expect(statement.charges).toEqual([expect.objectContaining({ sourceType: 'dispense_line', netMinor: 4500 })]);

    // MAR: today's 08:00 dose needs a witness; charted once; a second charting is refused
    const tomorrow = new Date(Date.now() + 86_400_000);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(tomorrow);
    const mar = (await k.call(nurse, 'GET', `/v1/admissions/${adm.body.admissionId}/mar?date=${day}`)).body;
    expect(mar.orders[0]).toMatchObject({ frequency: 'TDS', requiresWitness: true });
    const slot = mar.orders[0].slots[0].scheduledAt;
    expect(mar.orders[0].slots).toHaveLength(3);
    const noWitness = await k.call(nurse, 'POST', `/v1/admissions/${adm.body.admissionId}/mar`, { prescriptionItemId: order.prescriptionItemId, status: 'given', scheduledAt: slot });
    expect(noWitness.body.error.details.reason).toBe('witness_required');
    const given = await k.call(nurse, 'POST', `/v1/admissions/${adm.body.admissionId}/mar`, { prescriptionItemId: order.prescriptionItemId, status: 'given', scheduledAt: slot, witnessStaffId: nurse2.staffId });
    expect(given.status).toBe(201);
    const twice = await k.call(nurse2, 'POST', `/v1/admissions/${adm.body.admissionId}/mar`, { prescriptionItemId: order.prescriptionItemId, status: 'given', scheduledAt: slot, witnessStaffId: nurse.staffId });
    expect(twice.body.error.details.reason).toBe('dose_already_given');
    expect((await k.call(nurse, 'GET', `/v1/admissions/${adm.body.admissionId}/mar?date=${day}`)).body.orders[0].slots[0].charted).toEqual([expect.objectContaining({ status: 'given' })]);

    // The controlled-drug register shows the tramadol issue
    const register = (await k.call(pharmacist, 'GET', `/v1/pharmacy/registers/controlled?facilityId=${f()}&from=2026-01-01&to=2099-12-31`)).body.items;
    expect(register).toEqual([expect.objectContaining({ genericName: 'Tramadol', schedule: 'H1', quantity: 3, patientName: 'Asha' })]);
  });
});
