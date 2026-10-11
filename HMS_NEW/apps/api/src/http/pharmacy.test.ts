// M09 over HTTP: prescriptions (draft, signing with registration, allergy / duplicate overrides, frozen once
// signed, teleconsult limits), pharmacist verification (not one's own), dispensing (FEFO, MRP cap, over-dispense,
// substitution, races for the last units), the ledger gateway, returns, the controlled-drug register, patient
// indents, the MAR (witness, once per scheduled dose, PRN interval, stopped lines) and the module switch.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localDay, startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let f1: string;
const p = {} as Record<'admin' | 'keeper' | 'doctor' | 'doctor2' | 'unregistered' | 'nurse' | 'nurse2' | 'pharmacist' | 'frontDesk', Person>;
const ok = (res: { status: number; body: any }, status = 200) => {
  expect(res, JSON.stringify(res.body)).toMatchObject({ status });
  return res.body;
};
const reason = (res: { body: any }) => res.body?.error?.details?.reason;
const one = async <T = Record<string, unknown>>(q: string, args: unknown[] = []) => (await k.admin.query(q, args)).rows[0] as T;
const events = async (type: string) => Number((await one<{ n: string }>(`SELECT count(*) AS n FROM platform.outbox_event WHERE tenant_id = $1 AND event_type = $2`, [k.tenant.tenantId, type])).n);

const id = {} as Record<'pharm' | 'ward' | 'para' | 'amox' | 'amox2' | 'morph' | 'insulin' | 'cetri' | 'gloves' | 'patient' | 'opd' | 'ipd', string>;
const stock = async (itemId: string) => {
  const items = ok(await k.call(p.admin, 'GET', `/v1/inventory/stores/${id.pharm}/stock`)).items as { itemId: string; onHand: number; batches: { batchNo: string; onHand: number }[] }[];
  return items.find((i) => i.itemId === itemId);
};
const drug = async (code: string, name: string, generic: string, extra: Record<string, unknown> = {}) =>
  ok(await k.call(p.keeper, 'POST', '/v1/inventory/items', { code, name, itemType: 'drug', baseUom: 'unit', drug: { genericName: generic, strength: '500 mg', dosageForm: 'tablet', defaultRoute: 'oral', ...extra } }, true), 201).itemId as string;
const line = (itemId: string, extra: Record<string, unknown> = {}) => ({ itemId, dose: 1, doseUnit: 'tablet', frequencyCode: 'TDS', durationValue: 5, durationUnit: 'days', quantity: 15, ...extra });
const prescribe = async (who: Person, encounterId: string, items: unknown[], extra: Record<string, unknown> = {}) => k.call(who, 'POST', `/v1/encounters/${encounterId}/prescriptions`, { items, ...extra }, true);
const signed = async (encounterId: string, items: unknown[], extra: Record<string, unknown> = {}, overrides?: Record<string, string>) => {
  const rx = ok(await prescribe(p.doctor, encounterId, items, extra), 201);
  ok(await k.call(p.doctor, 'POST', `/v1/prescriptions/${rx.prescriptionId}/sign`, overrides ? { overrides } : {}));
  return rx as { prescriptionId: string; items: { prescriptionItemId: string; lineNo: number; itemId: string }[] };
};
const verified = async (encounterId: string, items: unknown[], extra: Record<string, unknown> = {}) => {
  const rx = await signed(encounterId, items, extra);
  ok(await k.call(p.pharmacist, 'POST', `/v1/prescriptions/${rx.prescriptionId}/verify`, { outcome: 'approved' }));
  return rx;
};

beforeAll(async () => {
  k = await startKit('pharmacy');
  f1 = k.tenant.facilityId;
  const t = k.tenant.tenantId;
  p.admin = await k.person('Priya Admin', 'tenant_admin', null);
  p.keeper = await k.person('Ramesh Stores', 'store_keeper', f1);
  p.frontDesk = await k.person('Ravi Desk', 'front_desk', f1);
  p.doctor = await k.person('Dr Kavya', 'doctor', f1, 'doctor');
  p.doctor2 = await k.person('Dr Arjun', 'doctor', f1, 'doctor');
  p.unregistered = await k.person('Dr New', 'doctor', f1, 'doctor');
  p.nurse = await k.person('Meena Nurse', 'nurse', f1, 'nurse');
  p.nurse2 = await k.person('Sita Nurse', 'nurse', f1, 'nurse');
  p.pharmacist = await k.person('Anil Pharmacist', 'pharmacist', f1, 'pharmacist');
  for (const d of [p.doctor, p.doctor2]) {
    await k.admin.query(`INSERT INTO platform.staff_registration (tenant_id, staff_id, council, registration_no, valid_until) VALUES ($1, $2, 'NMC', $3, $4)`, [t, d.staffId, `NMC-${d.staffId}`, localDay(365)]);
  }

  id.pharm = ok(await k.call(p.keeper, 'POST', '/v1/inventory/stores', { facilityId: f1, code: 'PHARM', name: 'OPD pharmacy', storeType: 'pharmacy', canDispenseToPatient: true, drugLicenceNo: 'KA-20B-777' }, true), 201).storeId;
  id.ward = ok(await k.call(p.keeper, 'POST', '/v1/inventory/stores', { facilityId: f1, code: 'WARD', name: 'Ward store', storeType: 'ward' }, true), 201).storeId;
  id.para = await drug('PARA', 'Paracetamol 500 mg', 'Paracetamol', { regulatorySchedule: 'H' });
  id.amox = await drug('AMOX', 'Amoxicillin 500 mg (Brand A)', 'Amoxicillin', { regulatorySchedule: 'H' });
  id.amox2 = await drug('AMOX2', 'Amoxicillin 500 mg (Brand B)', 'Amoxicillin', { regulatorySchedule: 'H' });
  id.morph = await drug('MORPH', 'Morphine 10 mg', 'Morphine', { strength: '10 mg', regulatorySchedule: 'X', isNdps: true, isHighAlert: true, teleList: 'prohibited' });
  id.insulin = await drug('INS', 'Insulin regular', 'Insulin regular', { strength: '100 IU/ml', dosageForm: 'injection', defaultRoute: 'sc', isHighAlert: true });
  id.cetri = await drug('CETRI', 'Cetirizine 10 mg', 'Cetirizine', { strength: '10 mg' });
  id.gloves = ok(await k.call(p.keeper, 'POST', '/v1/inventory/items', { code: 'GLV', name: 'Gloves', itemType: 'consumable', baseUom: 'pair' }, true), 201).itemId;
  const far = localDay(700);
  ok(
    await k.call(p.keeper, 'POST', `/v1/inventory/stores/${id.pharm}/opening`, {
      lines: [
        { itemId: id.para, batchNo: 'P-LATE', expiryDate: far, mrpMinor: 250, unitCostMinor: 150, quantity: 100 },
        { itemId: id.para, batchNo: 'P-SOON', expiryDate: localDay(60), mrpMinor: 200, unitCostMinor: 150, quantity: 20 },
        { itemId: id.amox, batchNo: 'A1', expiryDate: far, mrpMinor: 1000, unitCostMinor: 600, quantity: 10 },
        { itemId: id.amox2, batchNo: 'B1', expiryDate: far, mrpMinor: 900, unitCostMinor: 500, quantity: 50 },
        { itemId: id.morph, batchNo: 'M1', expiryDate: far, mrpMinor: 5000, unitCostMinor: 3000, quantity: 10 },
        { itemId: id.insulin, batchNo: 'I1', expiryDate: far, mrpMinor: 40000, unitCostMinor: 30000, quantity: 5 },
        { itemId: id.cetri, batchNo: 'C1', expiryDate: far, mrpMinor: 300, unitCostMinor: 100, quantity: 10 },
        { itemId: id.gloves, batchNo: 'G1', expiryDate: far, quantity: 100, unitCostMinor: 500 },
      ],
    }, true),
    201,
  );

  id.patient = ok(await k.call(p.frontDesk, 'POST', '/v1/patients', { givenName: 'Lakshmi', familyName: 'Rao', sex: 'female', birthDate: '1980-03-02', registeredFacilityId: f1, source: 'front_desk' }, true), 201).patientId;
  id.opd = ok(await k.call(p.doctor, 'POST', '/v1/encounters', { patientId: id.patient, facilityId: f1, attendingStaffId: p.doctor.staffId, encounterClass: 'outpatient' }, true), 201).encounterId;
  id.ipd = ok(await k.call(p.doctor, 'POST', '/v1/encounters', { patientId: id.patient, facilityId: f1, attendingStaffId: p.doctor.staffId, encounterClass: 'day_care' }, true), 201).encounterId;
  ok(await k.call(p.doctor, 'POST', `/v1/patients/${id.patient}/allergies`, { category: 'drug', substance: 'Amoxicillin', reaction: 'rash', severity: 'moderate' }), 201);
  // Nurses and the second doctor join the patient's care.
  for (const who of [p.nurse, p.nurse2, p.doctor2, p.unregistered]) await k.admin.query(`INSERT INTO clinical.encounter_participant (tenant_id, encounter_id, staff_id, role) VALUES ($1, $2, $3, 'other'), ($1, $4, $3, 'other')`, [t, id.opd, who.staffId, id.ipd]);
});
afterAll(() => k?.close());

describe('prescribing', () => {
  let rx: { prescriptionId: string; items: { prescriptionItemId: string; lineNo: number }[] };

  it('a doctor drafts a prescription; others without the right cannot', async () => {
    expect((await prescribe(p.nurse, id.opd, [line(id.para)])).status).toBe(403);
    expect(reason(await prescribe(p.doctor, id.opd, [line(id.gloves)]))).toBe('not_a_drug');
    expect(reason(await prescribe(p.doctor, id.opd, [line(id.para, { quantity: undefined })]))).toBe('quantity_required');
    rx = ok(await prescribe(p.doctor, id.opd, [line(id.para), line(id.amox, { dose: 1, frequencyCode: 'BD', quantity: 10 })], { advice: 'Plenty of fluids' }), 201);
    expect(rx).toMatchObject({ status: 'draft', setting: 'outpatient', items: [{ lineNo: 1 }, { lineNo: 2 }] });
  });

  it('only the prescriber signs, with a registration, and every warning needs an override reason', async () => {
    expect(reason(await k.call(p.doctor2, 'POST', `/v1/prescriptions/${rx.prescriptionId}/sign`, {}))).toBe('not_prescriber');
    const draft = ok(await prescribe(p.unregistered, id.opd, [line(id.cetri)]), 201);
    expect(reason(await k.call(p.unregistered, 'POST', `/v1/prescriptions/${draft.prescriptionId}/sign`, {}))).toBe('registration_required');

    const refused = await k.call(p.doctor, 'POST', `/v1/prescriptions/${rx.prescriptionId}/sign`, {});
    expect(refused).toMatchObject({ status: 422, body: { error: { details: { reason: 'override_required', lines: [{ lineNo: 2, warnings: [{ kind: 'allergy' }] }] } } } });
    const s = ok(await k.call(p.doctor, 'POST', `/v1/prescriptions/${rx.prescriptionId}/sign`, { overrides: { 2: 'Mild rash only; benefit outweighs risk' } }));
    expect(s).toMatchObject({ status: 'signed', overridden: [{ lineNo: 2, reason: 'Mild rash only; benefit outweighs risk' }] });
    expect(await one(`SELECT warnings, override_reason FROM pharmacy.prescription_item WHERE id = $1`, [rx.items[1]!.prescriptionItemId])).toMatchObject({ warnings: [{ kind: 'allergy' }], override_reason: 'Mild rash only; benefit outweighs risk' });
    expect(await events('prescription.signed')).toBe(1);

    // Signed means frozen, in the database too.
    await expect(k.admin.query(`UPDATE pharmacy.prescription SET advice = 'changed' WHERE id = $1`, [rx.prescriptionId])).rejects.toThrow(/cannot be changed/);
    await expect(k.admin.query(`UPDATE pharmacy.prescription_item SET dose = 2 WHERE id = $1`, [rx.items[0]!.prescriptionItemId])).rejects.toThrow(/cannot be changed/);

    // The same generic again on another prescription is duplicate therapy.
    const dup = ok(await prescribe(p.doctor, id.opd, [line(id.para, { quantity: 5 })]), 201);
    expect((await k.call(p.doctor, 'POST', `/v1/prescriptions/${dup.prescriptionId}/sign`, {})).body.error.details.lines[0].warnings[0].kind).toBe('duplicate_therapy');
    ok(await k.call(p.doctor, 'POST', `/v1/prescriptions/${dup.prescriptionId}/cancel`, { reason: 'Already prescribed' }));
  });

  it('a teleconsult prescription cannot carry prohibited drugs', async () => {
    const tele = ok(await prescribe(p.doctor, id.opd, [line(id.morph, { quantity: 2 })], { setting: 'virtual' }), 201);
    expect(reason(await k.call(p.doctor, 'POST', `/v1/prescriptions/${tele.prescriptionId}/sign`, {}))).toBe('not_for_teleconsult');
  });

  it('a pharmacist verifies (not their own); rejection and queries need notes and put it on hold', async () => {
    expect((await k.call(p.doctor2, 'POST', `/v1/prescriptions/${rx.prescriptionId}/verify`, { outcome: 'approved' })).status).toBe(403);
    expect(reason(await k.call(p.pharmacist, 'POST', '/v1/dispenses', { prescriptionId: rx.prescriptionId, storeId: id.pharm, lines: [{ prescriptionItemId: rx.items[0]!.prescriptionItemId, quantity: 1 }] }, true))).toBe('not_verified');
    expect(ok(await k.call(p.pharmacist, 'GET', `/v1/pharmacy/queue?facilityId=${f1}&stage=verify`)).items.map((i: { prescriptionId: string }) => i.prescriptionId)).toContain(rx.prescriptionId);
    expect(reason(await k.call(p.pharmacist, 'POST', `/v1/prescriptions/${rx.prescriptionId}/verify`, { outcome: 'query' }))).toBe('notes_required');
    ok(await k.call(p.pharmacist, 'POST', `/v1/prescriptions/${rx.prescriptionId}/verify`, { outcome: 'query', notes: 'Confirm amoxicillin despite allergy' }));
    expect(ok(await k.call(p.pharmacist, 'POST', `/v1/prescriptions/${rx.prescriptionId}/verify`, { outcome: 'approved', notes: 'Confirmed by phone' }))).toMatchObject({ status: 'verified' });
    expect(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM pharmacy.pharmacy_verification WHERE prescription_id = $1`, [rx.prescriptionId])).n)).toBe(2);
  });

  it('dispenses FEFO at no more than MRP, substitutes an equivalent, and never more than prescribed', async () => {
    const view = ok(await k.call(p.pharmacist, 'GET', `/v1/prescriptions/${rx.prescriptionId}/dispensing?storeId=${id.pharm}`));
    expect(view.allergies).toEqual([expect.objectContaining({ substance: 'Amoxicillin' })]);
    expect(view.stock[id.amox].alternatives).toEqual([expect.objectContaining({ itemId: id.amox2 })]);
    expect(view.stock[id.para].batches.map((b: { batchNo: string }) => b.batchNo)).toEqual(['P-SOON', 'P-LATE']);

    const [paraLine, amoxLine] = rx.items.map((i) => i.prescriptionItemId) as [string, string];
    expect(reason(await k.call(p.pharmacist, 'POST', '/v1/dispenses', { prescriptionId: rx.prescriptionId, storeId: id.pharm, lines: [{ prescriptionItemId: paraLine, quantity: 15, unitPriceMinor: 260 }] }, true))).toBe('above_mrp');
    expect(reason(await k.call(p.pharmacist, 'POST', '/v1/dispenses', { prescriptionId: rx.prescriptionId, storeId: id.pharm, lines: [{ prescriptionItemId: amoxLine, quantity: 1, substituteItemId: id.cetri }] }, true))).toBe('not_equivalent');
    expect(reason(await k.call(p.pharmacist, 'POST', '/v1/dispenses', { prescriptionId: rx.prescriptionId, storeId: id.ward, lines: [{ prescriptionItemId: paraLine, quantity: 1 }] }, true))).toBe('not_a_dispensing_store');

    // 25 paracetamol asked against 15 prescribed: the line's ceiling refuses it.
    expect(reason(await k.call(p.pharmacist, 'POST', '/v1/dispenses', { prescriptionId: rx.prescriptionId, storeId: id.pharm, lines: [{ prescriptionItemId: paraLine, quantity: 25 }] }, true))).toBe('over_dispense');

    const first = ok(await k.call(p.pharmacist, 'POST', '/v1/dispenses', { prescriptionId: rx.prescriptionId, storeId: id.pharm, handedOverTo: 'Patient', lines: [{ prescriptionItemId: paraLine, quantity: 15 }, { prescriptionItemId: amoxLine, quantity: 4 }] }, true), 201);
    expect(first).toMatchObject({ status: 'handed_over', sourceStatus: 'partially_dispensed', dispenseNo: expect.stringMatching(/^DSP\/\d{4}\/000001$/) });
    expect(first.lines).toEqual([
      expect.objectContaining({ batchNo: 'P-SOON', quantity: 15, mrpMinor: 200, unitPriceMinor: 200 }),
      expect.objectContaining({ batchNo: 'A1', quantity: 4, unitPriceMinor: 1000 }),
    ]);
    // Brand A has 6 left; the rest comes as brand B (same generic and strength), recorded as a substitution.
    const second = ok(await k.call(p.pharmacist, 'POST', '/v1/dispenses', { prescriptionId: rx.prescriptionId, storeId: id.pharm, lines: [{ prescriptionItemId: amoxLine, quantity: 6, substituteItemId: id.amox2 }] }, true), 201);
    expect(second).toMatchObject({ status: 'prepared', sourceStatus: 'completed', lines: [{ itemId: id.amox2, substitutedFromItemId: id.amox, batchNo: 'B1', quantity: 6 }] });
    expect(reason(await k.call(p.pharmacist, 'POST', '/v1/dispenses', { prescriptionId: rx.prescriptionId, storeId: id.pharm, lines: [{ prescriptionItemId: paraLine, quantity: 1 }] }, true))).toBe('invalid_state');
    ok(await k.call(p.pharmacist, 'POST', `/v1/dispenses/${second.dispenseId}/hand-over`, { handedOverTo: 'Son (Ravi)' }));

    expect((await stock(id.para))!.batches.find((b) => b.batchNo === 'P-SOON')!.onHand).toBe(5);
    expect((await stock(id.amox2))!.onHand).toBe(44);
    expect(await events('pharmacy.dispensed')).toBe(2);
    const mv = await one<{ n: string }>(`SELECT count(*) AS n FROM inventory.stock_movement WHERE tenant_id = $1 AND movement_type = 'issue_to_patient' AND patient_id = $2`, [k.tenant.tenantId, id.patient]);
    expect(Number(mv.n)).toBe(3);
  });

  it('pharmacy writes stock only through the gateway, which checks the movement against its line', async () => {
    const l = await one<{ id: string; item_batch_id: string; quantity: string }>(`SELECT l.id, l.item_batch_id, l.quantity FROM pharmacy.dispense_line l JOIN pharmacy.dispense d ON d.id = l.dispense_id WHERE d.tenant_id = $1 LIMIT 1`, [k.tenant.tenantId]);
    const c = await k.admin.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.tenant_id', $1, true)`, [k.tenant.tenantId]);
      await c.query('SET LOCAL ROLE mod_pharmacy');
      await expect(c.query(`SELECT inventory.post_patient_movement($1, $2, 999, $3, NULL, $4, NULL)`, [id.pharm, l.item_batch_id, id.patient, l.id])).rejects.toThrow(/does not match/);
    } finally {
      await c.query('ROLLBACK');
    }
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.tenant_id', $1, true)`, [k.tenant.tenantId]);
      await c.query('SET LOCAL ROLE mod_pharmacy');
      await expect(c.query(`SELECT inventory.post_patient_movement($1, $2, $3, $4, NULL, $5, NULL)`, [id.pharm, l.item_batch_id, l.quantity, id.patient, l.id])).rejects.toThrow(/stock_movement_dispense_line_once/);
    } finally {
      await c.query('ROLLBACK');
    }
    try {
      await c.query('BEGIN');
      await c.query('SET LOCAL ROLE mod_pharmacy');
      await expect(c.query(`INSERT INTO inventory.stock_movement (tenant_id, store_id, item_id, item_batch_id, movement_type, quantity, unit_cost_minor) VALUES ($1, $2, $3, $4, 'adjustment', 5, 0)`, [k.tenant.tenantId, id.pharm, id.para, l.item_batch_id])).rejects.toThrow(/permission denied/);
    } finally {
      await c.query('ROLLBACK');
      c.release();
    }
  });

  it('two dispenses racing for the last units: one wins, the other is refused and stock stays non-negative', async () => {
    const a = await verified(id.opd, [line(id.cetri, { quantity: 6 })]);
    const enc2 = ok(await k.call(p.doctor, 'POST', '/v1/encounters', { patientId: id.patient, facilityId: f1, attendingStaffId: p.doctor.staffId, encounterClass: 'emergency' }, true), 201).encounterId;
    const b = await signed(enc2, [line(id.cetri, { quantity: 6 })], {}, { 1: 'Second visit, separate supply' });
    ok(await k.call(p.pharmacist, 'POST', `/v1/prescriptions/${b.prescriptionId}/verify`, { outcome: 'approved' }));
    const res = await Promise.all(
      [a, b].map((r) => k.call(p.pharmacist, 'POST', '/v1/dispenses', { prescriptionId: r.prescriptionId, storeId: id.pharm, lines: [{ prescriptionItemId: r.items[0]!.prescriptionItemId, quantity: 6 }] }, true)),
    );
    expect(res.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(reason(res.find((r) => r.status === 409)!)).toBe('insufficient_stock');
    expect((await stock(id.cetri))!.onHand).toBe(4);
  });
});

describe('returns and registers', () => {
  it('takes back restockable units onto the shelf, never more than dispensed', async () => {
    const d = ok(await k.call(p.pharmacist, 'GET', `/v1/dispenses?facilityId=${f1}`)).items as { lines: { dispenseLineId: string; batchNo: string; quantity: string }[] }[];
    const paraLine = d.flatMap((x) => x.lines).find((l) => l.batchNo === 'P-SOON')!;
    ok(await k.call(p.pharmacist, 'POST', `/v1/dispense-lines/${paraLine.dispenseLineId}/returns`, { quantity: 5, reason: 'Course changed', isRestockable: true }, true), 201);
    expect((await stock(id.para))!.batches.find((b) => b.batchNo === 'P-SOON')!.onHand).toBe(10);
    ok(await k.call(p.pharmacist, 'POST', `/v1/dispense-lines/${paraLine.dispenseLineId}/returns`, { quantity: 2, reason: 'Strip opened', isRestockable: false }, true), 201);
    expect((await stock(id.para))!.batches.find((b) => b.batchNo === 'P-SOON')!.onHand).toBe(10);
    expect(reason(await k.call(p.pharmacist, 'POST', `/v1/dispense-lines/${paraLine.dispenseLineId}/returns`, { quantity: 9, reason: 'Too many', isRestockable: true }, true))).toBe('over_return');
    expect(await events('pharmacy.medication_returned')).toBe(2);
    expect(await one(`SELECT on_hand FROM inventory.stock_balance_drift WHERE tenant_id = $1`, [k.tenant.tenantId])).toBeUndefined();
  });

  it('a ward indents for a patient and the pharmacy fills it; drugs need a prescription line', async () => {
    const ip = await verified(id.ipd, [{ itemId: id.morph, dose: 5, doseUnit: 'mg', route: 'iv', frequencyCode: 'Q6H' }], { setting: 'inpatient' });
    expect(reason(await k.call(p.nurse, 'POST', `/v1/encounters/${id.ipd}/patient-indents`, { pharmacyStoreId: id.pharm, lines: [{ itemId: id.morph, quantity: 2 }] }, true))).toBe('prescription_required');
    expect((await k.call(p.doctor, 'POST', `/v1/encounters/${id.ipd}/patient-indents`, { pharmacyStoreId: id.pharm, lines: [{ itemId: id.gloves, quantity: 2 }] }, true)).status).toBe(403);
    const ind = ok(await k.call(p.nurse, 'POST', `/v1/encounters/${id.ipd}/patient-indents`, { pharmacyStoreId: id.pharm, wardStoreId: id.ward, lines: [{ prescriptionItemId: ip.items[0]!.prescriptionItemId, quantity: 2 }, { itemId: id.gloves, quantity: 4 }] }, true), 201);
    const queue = ok(await k.call(p.pharmacist, 'GET', `/v1/pharmacy/queue?facilityId=${f1}&stage=indents`)).items;
    expect(queue.map((q: { patientIndentId: string }) => q.patientIndentId)).toContain(ind.patientIndentId);
    const view = ok(await k.call(p.pharmacist, 'GET', `/v1/patient-indents/${ind.patientIndentId}/dispensing?storeId=${id.pharm}`));
    const lines = view.indent.lines.map((l: { patientIndentLineId: string; itemId: string }) => ({ patientIndentLineId: l.patientIndentLineId, quantity: l.itemId === id.morph ? 2 : 4, ...(l.itemId === id.gloves ? { unitPriceMinor: 800 } : {}) }));
    const d = ok(await k.call(p.pharmacist, 'POST', '/v1/dispenses', { patientIndentId: ind.patientIndentId, storeId: id.pharm, handedOverTo: 'Ward nurse Meena', lines }, true), 201);
    expect(d).toMatchObject({ sourceStatus: 'dispensed' });
    expect(await one(`SELECT quantity_dispensed FROM pharmacy.prescription_item WHERE id = $1`, [ip.items[0]!.prescriptionItemId])).toEqual({ quantity_dispensed: '2.000' });
  });

  it('the controlled-drug register lists Schedule X / NDPS dispenses only, for those allowed to see it', async () => {
    expect((await k.call(p.nurse, 'GET', `/v1/pharmacy/register?facilityId=${f1}&from=${localDay(-1)}&to=${localDay(1)}`)).status).toBe(403);
    const reg = ok(await k.call(p.pharmacist, 'GET', `/v1/pharmacy/register?facilityId=${f1}&from=${localDay(-1)}&to=${localDay(1)}`)).items;
    expect(reg).toEqual([expect.objectContaining({ itemName: 'Morphine 10 mg', schedule: 'X', isNdps: true, patientName: 'Lakshmi Rao', prescriberName: 'Dr Kavya', batchNo: 'M1', quantity: '2.000' })]);
  });
});

describe('medication administration (MAR)', () => {
  let ins: string;
  let prn: string;
  const slot = new Date(Date.now() - 60 * 60_000).toISOString();

  beforeAll(async () => {
    const r = await signed(id.ipd, [
      { itemId: id.insulin, dose: 6, doseUnit: 'IU', route: 'sc', frequencyCode: 'TDS' },
      { itemId: id.para, dose: 1, doseUnit: 'tablet', frequencyCode: 'SOS', prnMinIntervalMinutes: 240 },
    ], { setting: 'inpatient' });
    [ins, prn] = r.items.map((i) => i.prescriptionItemId) as [string, string];
  });

  it('a high-alert dose needs a witness and is charted once per slot', async () => {
    expect((await k.call(p.pharmacist, 'POST', `/v1/prescription-items/${ins}/administrations`, { status: 'given', scheduledAt: slot }, true)).status).toBe(403);
    expect(reason(await k.call(p.nurse, 'POST', `/v1/prescription-items/${ins}/administrations`, { status: 'given', scheduledAt: slot }, true))).toBe('witness_required');
    expect(reason(await k.call(p.nurse, 'POST', `/v1/prescription-items/${ins}/administrations`, { status: 'given', scheduledAt: slot, witnessStaffId: p.nurse.staffId }, true))).toBe('self_witness');
    expect(reason(await k.call(p.nurse, 'POST', `/v1/prescription-items/${ins}/administrations`, { status: 'given', scheduledAt: slot, witnessStaffId: p.pharmacist.staffId }, true))).toBe('witness_not_eligible');
    const witnesses = ok(await k.call(p.nurse, 'GET', `/v1/pharmacy/witnesses?facilityId=${f1}`)).items.map((w: { staffId: string }) => w.staffId);
    expect(witnesses).toEqual(expect.arrayContaining([p.nurse2.staffId, p.doctor.staffId]));
    expect(witnesses).not.toContain(p.pharmacist.staffId);
    const g = ok(await k.call(p.nurse, 'POST', `/v1/prescription-items/${ins}/administrations`, { status: 'given', scheduledAt: slot, witnessStaffId: p.nurse2.staffId, site: 'abdomen' }, true), 201);
    expect(g).toMatchObject({ requiresWitness: true });
    expect(reason(await k.call(p.nurse2, 'POST', `/v1/prescription-items/${ins}/administrations`, { status: 'given', scheduledAt: slot, witnessStaffId: p.nurse.staffId }, true))).toBe('already_given');
    expect(reason(await k.call(p.nurse, 'POST', `/v1/prescription-items/${ins}/administrations`, { status: 'refused', scheduledAt: new Date().toISOString() }, true))).toBe('reason_required');
    ok(await k.call(p.nurse, 'POST', `/v1/prescription-items/${ins}/administrations`, { status: 'refused', scheduledAt: new Date().toISOString(), reason: 'Patient nil by mouth, sugar 90' }, true), 201);
    await expect(k.admin.query(`UPDATE pharmacy.medication_administration SET site = 'arm' WHERE prescription_item_id = $1`, [ins])).rejects.toThrow();
  });

  it('PRN doses keep their minimum interval', async () => {
    const t0 = new Date(Date.now() - 300 * 60_000);
    expect(reason(await k.call(p.nurse, 'POST', `/v1/prescription-items/${prn}/administrations`, { status: 'given', administeredAt: t0.toISOString() }, true))).toBe('prn_reason_required');
    ok(await k.call(p.nurse, 'POST', `/v1/prescription-items/${prn}/administrations`, { status: 'given', administeredAt: t0.toISOString(), prnReason: 'Fever 101F' }, true), 201);
    const soon = await k.call(p.nurse, 'POST', `/v1/prescription-items/${prn}/administrations`, { status: 'given', administeredAt: new Date(t0.getTime() + 60 * 60_000).toISOString(), prnReason: 'Fever' }, true);
    expect(soon).toMatchObject({ status: 422, body: { error: { details: { reason: 'too_soon' } } } });
    ok(await k.call(p.nurse, 'POST', `/v1/prescription-items/${prn}/administrations`, { status: 'given', administeredAt: new Date(t0.getTime() + 241 * 60_000).toISOString(), prnReason: 'Fever 100F' }, true), 201);
  });

  it('a stopped line cannot be given, and the chart shows every dose', async () => {
    expect(reason(await k.call(p.doctor, 'POST', `/v1/prescription-items/${ins}/stop`, {}))).toBe('reason_required');
    ok(await k.call(p.doctor2, 'POST', `/v1/prescription-items/${ins}/stop`, { reason: 'Switched to sliding scale' }));
    expect(reason(await k.call(p.nurse, 'POST', `/v1/prescription-items/${ins}/administrations`, { status: 'given', scheduledAt: new Date().toISOString(), witnessStaffId: p.nurse2.staffId }, true))).toBe('line_not_active');
    const mar = ok(await k.call(p.nurse, 'GET', `/v1/encounters/${id.ipd}/mar`));
    const insLine = mar.lines.find((l: { prescriptionItemId: string }) => l.prescriptionItemId === ins);
    expect(insLine).toMatchObject({ status: 'stopped', requiresWitness: true, stopReason: 'Switched to sliding scale' });
    expect(insLine.doses.map((d: { status: string }) => d.status).sort()).toEqual(['given', 'refused']);
    expect(mar.lines.find((l: { prescriptionItemId: string }) => l.prescriptionItemId === prn).doses).toHaveLength(2);
    expect((await k.call(p.pharmacist, 'GET', `/v1/encounters/${id.ipd}/mar`)).status).toBe(403);
  });
});

describe('module switch', () => {
  it('a suspended pharmacy refuses new prescriptions but keeps them readable', async () => {
    const m = ok(await k.call(p.admin, 'GET', '/v1/modules')).items.find((x: { module: string }) => x.module === 'pharmacy');
    const s = ok(await k.call(p.admin, 'PUT', '/v1/modules/pharmacy', { state: 'suspended', version: m.version, reason: 'Pharmacy audit' }));
    expect(reason(await prescribe(p.doctor, id.opd, [line(id.para)]))).toBe('module_inactive');
    ok(await k.call(p.doctor, 'GET', `/v1/encounters/${id.opd}/prescriptions`));
    ok(await k.call(p.admin, 'PUT', '/v1/modules/pharmacy', { state: 'active', version: s.version, reason: 'Audit done' }));
  });
});
