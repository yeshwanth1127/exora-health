// M10 over HTTP: items with drug profiles and pack sizes, stores, suppliers; purchase orders with four-eyes
// approval, goods receipts by batch (MRP, expiry, over-receipt), supplier invoices with three-way match;
// FEFO issues, batch quarantine, two concurrent issues racing for the last units; indents and transfers
// with short receipt; stock counts (four eyes, stock moved since snapshot); vendor returns; the
// append-only ledger; clinic scoping and the module switch.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let f1: string;
let f2: string;
const p = {} as Record<'admin' | 'admin2' | 'keeper' | 'keeper2' | 'nurse' | 'doctor', Person>;
const ok = (res: { status: number; body: any }, status = 200) => {
  expect(res, JSON.stringify(res.body)).toMatchObject({ status });
  return res.body;
};
const reason = (res: { body: any }) => res.body?.error?.details?.reason;
const one = async <T = Record<string, unknown>>(q: string, args: unknown[] = []) => (await k.admin.query(q, args)).rows[0] as T;
const events = async (type: string) => Number((await one<{ n: string }>(`SELECT count(*) AS n FROM platform.outbox_event WHERE tenant_id = $1 AND event_type = $2`, [k.tenant.tenantId, type])).n);

const id = {} as Record<'para' | 'gloves' | 'supplier' | 'main' | 'ward' | 'po' | 'grn1' | 'grn2' | 'batchA' | 'batchB', string>;
const stockOf = async (storeId: string, itemId: string) => {
  const items = ok(await k.call(p.admin, 'GET', `/v1/inventory/stores/${storeId}/stock`)).items as { itemId: string; onHand: number; usable: number; batches: { batchId: string; batchNo: string; onHand: number }[] }[];
  return items.find((i) => i.itemId === itemId);
};

beforeAll(async () => {
  k = await startKit('inventory');
  f1 = k.tenant.facilityId;
  const t = k.tenant;
  f2 = (await one<{ id: string }>(`INSERT INTO platform.facility (tenant_id, organization_id, code, name, facility_type, state_code) VALUES ($1, $2, 'F2', 'Branch 2', 'clinic', '29') RETURNING id`, [t.tenantId, t.organizationId])).id;
  p.admin = await k.person('Priya Admin', 'tenant_admin', null);
  p.admin2 = await k.person('Suresh Admin', 'tenant_admin', null);
  p.keeper = await k.person('Ramesh Stores', 'store_keeper', f1);
  p.keeper2 = await k.person('Branch Stores', 'store_keeper', f2);
  p.nurse = await k.person('Meena Nurse', 'nurse', f1, 'nurse');
  p.doctor = await k.person('Dr Kavya', 'doctor', f1, 'doctor');
});
afterAll(() => k.close());

describe('master data', () => {
  it('creates a drug with its profile and pack size, a consumable, a supplier and stores', async () => {
    const para = ok(
      await k.call(p.keeper, 'POST', '/v1/inventory/items', {
        code: 'para500', name: 'Paracetamol 500 mg tablet', itemType: 'drug', baseUom: 'tablet', hsnCode: '30049099',
        drug: { genericName: 'Paracetamol', strength: '500 mg', dosageForm: 'tablet', defaultRoute: 'oral', regulatorySchedule: 'H', isNlem: true },
        uoms: [{ uom: 'strip', factorToBase: 10, isPurchaseUom: true }],
      }, true),
      201,
    );
    id.para = para.itemId;
    id.gloves = ok(await k.call(p.keeper, 'POST', '/v1/inventory/items', { code: 'GLV-M', name: 'Examination gloves (M)', itemType: 'consumable', baseUom: 'pair' }, true), 201).itemId;
    const item = ok(await k.call(p.nurse, 'GET', `/v1/inventory/items/${id.para}`));
    expect(item).toMatchObject({ code: 'PARA500', is_batch_tracked: true, is_expiry_tracked: true, drug: { generic_name: 'Paracetamol', regulatory_schedule: 'H' } });
    expect(item.uoms).toEqual([expect.objectContaining({ uom: 'strip', factor_to_base: '10.000' })]);
    expect(ok(await k.call(p.nurse, 'GET', '/v1/inventory/items?q=paracet')).items.map((i: { id: string }) => i.id)).toEqual([id.para]);

    id.supplier = ok(await k.call(p.keeper, 'POST', '/v1/inventory/suppliers', { code: 'medline', name: 'Medline Distributors', gstin: '29ABCDE1234F1Z5', paymentTermsDays: 45 }, true), 201).supplierId;
    expect(ok(await k.call(p.keeper, 'GET', '/v1/inventory/suppliers?q=29ABCDE')).items[0]).toMatchObject({ code: 'MEDLINE', state_code: '29' });

    id.main = ok(await k.call(p.keeper, 'POST', '/v1/inventory/stores', { facilityId: f1, code: 'MAIN', name: 'Main pharmacy', storeType: 'pharmacy', canDispenseToPatient: true, drugLicenceNo: 'KA-B1-20B-12345' }, true), 201).storeId;
    id.ward = ok(await k.call(p.keeper, 'POST', '/v1/inventory/stores', { facilityId: f1, code: 'WARD1', name: 'Ward 1 sub-store', storeType: 'ward', parentStoreId: id.main }, true), 201).storeId;
    expect(ok(await k.call(p.nurse, 'GET', `/v1/inventory/stores?facilityId=${f1}`)).items.map((s: { code: string }) => s.code)).toEqual(['MAIN', 'WARD1']);
  });

  it('refuses bad master data', async () => {
    expect(reason(await k.call(p.keeper, 'POST', '/v1/inventory/items', { code: 'X1', name: 'Drug without profile', itemType: 'drug', baseUom: 'tablet' }, true))).toBe('drug_profile');
    expect(reason(await k.call(p.keeper, 'POST', '/v1/inventory/items', { code: 'PARA500', name: 'Duplicate', itemType: 'general', baseUom: 'piece' }, true))).toBe('duplicate');
    expect(reason(await k.call(p.keeper, 'POST', '/v1/inventory/stores', { facilityId: f1, code: 'OPD', name: 'OPD counter', storeType: 'pharmacy', canDispenseToPatient: true }, true))).toBe('drug_licence_required');
    expect((await k.call(p.keeper, 'POST', '/v1/inventory/suppliers', { code: 'BAD', name: 'Bad GSTIN', gstin: '29ABC' }, true)).status).toBe(400);
    expect((await k.call(p.nurse, 'POST', '/v1/inventory/items', { code: 'N1', name: 'Nurse item', itemType: 'general', baseUom: 'piece' }, true)).status).toBe(403);
    expect((await k.call(p.keeper2, 'POST', '/v1/inventory/stores', { facilityId: f1, code: 'B2', name: 'Not my clinic', storeType: 'central' }, true)).status).toBe(403);
    expect((await k.call(p.keeper2, 'GET', `/v1/inventory/stores/${id.main}/stock`)).status).toBe(403);
    expect((await k.call(p.doctor, 'GET', '/v1/inventory/items')).status).toBe(403);
    const stale = await k.call(p.keeper, 'PATCH', `/v1/inventory/items/${id.para}`, { version: 9, name: 'Renamed' });
    expect([stale.status, reason(stale)]).toEqual([409, 'stale_version']);
  });
});

describe('purchasing', () => {
  it('a purchase order is approved by someone other than whoever raised it', async () => {
    const own = ok(await k.call(p.admin, 'POST', '/v1/inventory/purchase-orders', { storeId: id.main, supplierId: id.supplier, lines: [{ itemId: id.gloves, quantity: 10, unitPriceMinor: 500, gstRateBp: 1200 }] }, true), 201);
    expect(reason(await k.call(p.admin, 'POST', `/v1/inventory/purchase-orders/${own.purchaseOrderId}/approve`, {}))).toBe('own_order');
    ok(await k.call(p.admin, 'POST', `/v1/inventory/purchase-orders/${own.purchaseOrderId}/cancel`, { reason: 'Raised by mistake' }));

    const po = ok(
      await k.call(p.keeper, 'POST', '/v1/inventory/purchase-orders', {
        storeId: id.main, supplierId: id.supplier, expectedOn: '2026-10-20',
        lines: [{ itemId: id.para, uom: 'strip', quantity: 20, unitPriceMinor: 2000, gstRateBp: 1200 }, { itemId: id.gloves, quantity: 100, unitPriceMinor: 500, gstRateBp: 1200 }],
      }, true),
      201,
    );
    expect(po).toMatchObject({ status: 'draft', taxableMinor: 90_000, taxMinor: 10_800, totalMinor: 100_800 });
    expect(po.poNo).toMatch(/^PO\/\d{4}\/\d{6}$/);
    id.po = po.purchaseOrderId;
    expect(reason(await k.call(p.keeper, 'POST', '/v1/inventory/purchase-orders', { storeId: id.main, supplierId: id.supplier, lines: [{ itemId: id.para, uom: 'box', quantity: 1, unitPriceMinor: 1, gstRateBp: 0 }] }, true))).toBe('unknown_uom');
    expect((await k.call(p.keeper, 'POST', `/v1/inventory/purchase-orders/${id.po}/approve`, {})).status).toBe(403);
    expect(reason(await k.call(p.keeper, 'POST', `/v1/inventory/purchase-orders/${id.po}/send`, {}))).toBe('invalid_state');
    ok(await k.call(p.admin, 'POST', `/v1/inventory/purchase-orders/${id.po}/approve`, {}));
    ok(await k.call(p.keeper, 'POST', `/v1/inventory/purchase-orders/${id.po}/send`, {}));
    expect(await events('inventory.purchase_order_sent')).toBe(1);
  });

  it('receives by batch: MRP for drugs, nothing expired, no more than ordered', async () => {
    const lines = ok(await k.call(p.keeper, 'GET', `/v1/inventory/purchase-orders?facilityId=${f1}&status=sent`)).items[0].lines as { id: string; item_id: string }[];
    const lineOf = (itemId: string) => lines.find((l) => l.item_id === itemId)!.id;
    const grn = (body: object) => k.call(p.keeper, 'POST', '/v1/inventory/goods-receipts', { storeId: id.main, purchaseOrderId: id.po, ...body }, true);

    expect(reason(await grn({ lines: [{ purchaseOrderLineId: lineOf(id.para), itemId: id.para, batchNo: 'PA1', expiryDate: '2027-03-31', qtyReceived: 100 }] }))).toBe('mrp_required');
    expect(reason(await grn({ lines: [{ purchaseOrderLineId: lineOf(id.para), itemId: id.para, batchNo: 'OLD', expiryDate: '2025-01-31', mrpMinor: 250, qtyReceived: 10 }] }))).toBe('expired_on_arrival');
    expect(reason(await grn({ lines: [{ purchaseOrderLineId: lineOf(id.para), itemId: id.para, batchNo: 'PA1', qtyReceived: 10, mrpMinor: 250 }] }))).toBe('expiry_required');
    expect(reason(await grn({ lines: [{ purchaseOrderLineId: lineOf(id.gloves), itemId: id.para, batchNo: 'PA1', expiryDate: '2027-03-31', mrpMinor: 250, qtyReceived: 1 }] }))).toBe('po_line_mismatch');

    const g1 = ok(await grn({ supplierInvoiceRef: 'MD/4411', lines: [
      { purchaseOrderLineId: lineOf(id.para), itemId: id.para, batchNo: 'PA1', expiryDate: '2027-03-31', mrpMinor: 250, qtyReceived: 100 },
      { purchaseOrderLineId: lineOf(id.gloves), itemId: id.gloves, batchNo: 'G1', expiryDate: '2029-01-31', qtyReceived: 100, qtyRejected: 4, rejectReason: 'Torn packs' },
    ] }), 201);
    id.grn1 = g1.goodsReceiptId;
    expect(g1.grnNo).toMatch(/^GRN\/\d{4}\/\d{6}$/);
    expect(ok(await k.call(p.keeper, 'GET', `/v1/inventory/purchase-orders?facilityId=${f1}&status=partially_received`)).items).toHaveLength(1);
    expect(reason(await grn({ lines: [{ purchaseOrderLineId: lineOf(id.para), itemId: id.para, batchNo: 'PB2', expiryDate: '2028-06-30', mrpMinor: 260, qtyReceived: 150 }] }))).toBe('over_receipt');
    id.grn2 = ok(await grn({ lines: [{ purchaseOrderLineId: lineOf(id.para), itemId: id.para, batchNo: 'PB2', expiryDate: '2028-06-30', mrpMinor: 260, qtyReceived: 100 }] }), 201).goodsReceiptId;
    expect(ok(await k.call(p.keeper, 'GET', `/v1/inventory/purchase-orders?facilityId=${f1}&status=received`)).items).toHaveLength(1);

    const para = (await stockOf(id.main, id.para))!;
    expect(para.onHand).toBe(200);
    expect(para.batches.map((b) => [b.batchNo, b.onHand])).toEqual([['PA1', 100], ['PB2', 100]]);
    id.batchA = para.batches[0]!.batchId;
    id.batchB = para.batches[1]!.batchId;
    expect((await stockOf(id.main, id.gloves))!.onHand).toBe(100);
    expect(await events('inventory.goods_received')).toBe(2);
  });

  it('three-way matches supplier invoices and approves them with four eyes', async () => {
    const uninvoiced = ok(await k.call(p.keeper, 'GET', `/v1/inventory/goods-receipts?facilityId=${f1}&uninvoiced=true`)).items;
    expect(uninvoiced.find((g: { id: string }) => g.id === id.grn1)).toMatchObject({ value_minor: 70_000 });
    const inv = ok(await k.call(p.keeper, 'POST', '/v1/inventory/supplier-invoices', { supplierId: id.supplier, invoiceNo: 'MD/4411', invoiceDate: '2026-10-12', taxableMinor: 70_050, cgstMinor: 4_200, sgstMinor: 4_200, totalMinor: 78_450, goodsReceiptIds: [id.grn1] }, true), 201);
    expect(inv).toMatchObject({ matchStatus: 'matched', expectedMinor: 70_000, varianceMinor: 50, dueOn: '2026-11-26' });
    expect(reason(await k.call(p.keeper, 'POST', '/v1/inventory/supplier-invoices', { supplierId: id.supplier, invoiceNo: 'MD/4411', invoiceDate: '2026-10-12', taxableMinor: 20_000, totalMinor: 20_000, goodsReceiptIds: [id.grn2] }, true))).toBe('duplicate');
    expect(reason(await k.call(p.keeper, 'POST', '/v1/inventory/supplier-invoices', { supplierId: id.supplier, invoiceNo: 'MD/9', invoiceDate: '2026-10-12', taxableMinor: 1, totalMinor: 1, goodsReceiptIds: [id.grn1] }, true))).toBe('already_invoiced');
    expect(reason(await k.call(p.keeper, 'POST', '/v1/inventory/supplier-invoices', { supplierId: id.supplier, invoiceNo: 'MD/10', invoiceDate: '2026-10-12', taxableMinor: 100, cgstMinor: 5, sgstMinor: 5, totalMinor: 100, goodsReceiptIds: [id.grn2] }, true))).toBe('total_mismatch');
    const variance = ok(await k.call(p.keeper, 'POST', '/v1/inventory/supplier-invoices', { supplierId: id.supplier, invoiceNo: 'MD/4420', invoiceDate: '2026-10-13', taxableMinor: 25_000, igstMinor: 0, totalMinor: 25_000, goodsReceiptIds: [id.grn2] }, true), 201);
    expect(variance).toMatchObject({ matchStatus: 'variance', expectedMinor: 20_000 });

    expect((await k.call(p.keeper, 'POST', `/v1/inventory/supplier-invoices/${inv.supplierInvoiceId}/approve`, {})).status).toBe(403);
    ok(await k.call(p.admin, 'POST', `/v1/inventory/supplier-invoices/${inv.supplierInvoiceId}/approve`, {}));
    expect(reason(await k.call(p.admin, 'POST', `/v1/inventory/supplier-invoices/${variance.supplierInvoiceId}/approve`, {}))).toBe('variance_reason_required');
    ok(await k.call(p.admin, 'POST', `/v1/inventory/supplier-invoices/${variance.supplierInvoiceId}/approve`, { reason: 'Price revision agreed by phone' }));
    expect(ok(await k.call(p.admin, 'GET', `/v1/inventory/supplier-invoices?facilityId=${f1}&status=approved`)).items).toHaveLength(2);
    expect(await events('inventory.supplier_invoice_approved')).toBe(2);
  });
});

describe('issuing stock', () => {
  it('consumption picks the earliest expiry first; a held batch is skipped and refused', async () => {
    const used = ok(await k.call(p.keeper, 'POST', `/v1/inventory/stores/${id.main}/adjustments`, { kind: 'consumption', reason: 'OPD procedure room', lines: [{ itemId: id.para, quantity: 30 }] }, true), 201);
    expect(used.moved).toEqual([{ itemId: id.para, batchId: id.batchA, quantity: -30 }]);

    expect(reason(await k.call(p.keeper, 'POST', `/v1/inventory/batches/${id.batchA}/status`, { status: 'quarantined' }))).toBe('reason_required');
    ok(await k.call(p.keeper, 'POST', `/v1/inventory/batches/${id.batchA}/status`, { status: 'quarantined', reason: 'Discoloured tablets reported' }));
    const next = ok(await k.call(p.keeper, 'POST', `/v1/inventory/stores/${id.main}/adjustments`, { kind: 'consumption', reason: 'OPD', lines: [{ itemId: id.para, quantity: 5 }] }, true), 201);
    expect(next.moved).toEqual([{ itemId: id.para, batchId: id.batchB, quantity: -5 }]);
    expect(reason(await k.call(p.keeper, 'POST', `/v1/inventory/stores/${id.main}/adjustments`, { kind: 'consumption', reason: 'OPD', lines: [{ itemId: id.para, batchId: id.batchA, quantity: 1 }] }, true))).toBe('batch_unavailable');
    ok(await k.call(p.keeper, 'POST', `/v1/inventory/batches/${id.batchA}/status`, { status: 'available' }));
    const para = (await stockOf(id.main, id.para))!;
    expect([para.onHand, para.usable]).toEqual([165, 165]);
  });

  it('two issues racing for the same units: one wins, the other gets 409 and stock never goes negative', async () => {
    const take = () => k.call(p.keeper, 'POST', `/v1/inventory/stores/${id.main}/adjustments`, { kind: 'consumption', reason: 'Ward round', lines: [{ itemId: id.gloves, quantity: 60 }] }, true);
    const results = await Promise.all([take(), take()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(reason(results.find((r) => r.status === 409)!)).toBe('insufficient_stock');
    expect((await stockOf(id.main, id.gloves))!.onHand).toBe(40);
    expect(reason(await k.call(p.keeper, 'POST', `/v1/inventory/stores/${id.main}/adjustments`, { kind: 'damage', reason: 'Dropped', lines: [{ itemId: id.gloves, batchId: (await stockOf(id.main, id.gloves))!.batches[0]!.batchId, quantity: 41 }] }, true))).toBe('insufficient_stock');
  });

  it('a book correction needs an approver', async () => {
    const batchId = (await stockOf(id.main, id.gloves))!.batches[0]!.batchId;
    expect((await k.call(p.keeper, 'POST', `/v1/inventory/stores/${id.main}/adjustments`, { kind: 'adjustment', reason: 'Miscount', lines: [{ itemId: id.gloves, batchId, quantity: 2 }] }, true)).status).toBe(403);
    ok(await k.call(p.admin, 'POST', `/v1/inventory/stores/${id.main}/adjustments`, { kind: 'adjustment', reason: 'Found a box behind the rack', lines: [{ itemId: id.gloves, batchId, quantity: 2 }] }, true), 201);
    ok(await k.call(p.admin, 'POST', `/v1/inventory/stores/${id.main}/adjustments`, { kind: 'adjustment', reason: 'Recount', lines: [{ itemId: id.gloves, batchId, quantity: -2 }] }, true), 201);
  });
});

describe('indents and transfers', () => {
  it('a ward indents, someone else approves, the store dispatches FEFO and the ward receives', async () => {
    const ind = ok(await k.call(p.nurse, 'POST', '/v1/inventory/requisitions', { requestingStoreId: id.ward, supplyingStoreId: id.main, note: 'Weekly top-up', lines: [{ itemId: id.para, quantity: 50 }] }, true), 201);
    expect(ind.indentNo).toMatch(/^IND\/\d{4}\/\d{6}$/);
    expect(await events('inventory.indent_raised')).toBe(1);
    expect((await k.call(p.nurse, 'POST', `/v1/inventory/requisitions/${ind.requisitionId}/approve`, {})).status).toBe(403);
    expect(reason(await k.call(p.keeper, 'POST', '/v1/inventory/transfers', { requisitionId: ind.requisitionId, lines: [{ itemId: id.para, quantity: 10 }] }, true))).toBe('not_approved');
    const lineId = ok(await k.call(p.admin, 'GET', `/v1/inventory/requisitions?facilityId=${f1}&status=submitted`)).items[0].lines[0].id;
    ok(await k.call(p.admin, 'POST', `/v1/inventory/requisitions/${ind.requisitionId}/approve`, { lines: [{ lineId, quantity: 40 }] }));

    expect(reason(await k.call(p.keeper, 'POST', '/v1/inventory/transfers', { requisitionId: ind.requisitionId, lines: [{ itemId: id.para, quantity: 50 }] }, true))).toBe('over_issue');
    expect(reason(await k.call(p.keeper, 'POST', '/v1/inventory/transfers', { requisitionId: ind.requisitionId, lines: [{ itemId: id.gloves, quantity: 1 }] }, true))).toBe('not_on_indent');
    const tr = ok(await k.call(p.keeper, 'POST', '/v1/inventory/transfers', { requisitionId: ind.requisitionId, lines: [{ itemId: id.para, quantity: 40 }] }, true), 201);
    expect(tr.lines).toEqual([expect.objectContaining({ batchId: id.batchA, quantity: 40 })]);
    expect(ok(await k.call(p.nurse, 'GET', `/v1/inventory/requisitions?facilityId=${f1}&storeId=${id.ward}`)).items[0]).toMatchObject({ status: 'issued' });
    expect((await stockOf(id.main, id.para))!.onHand).toBe(125);
    expect(await stockOf(id.ward, id.para)).toBeUndefined(); // in transit

    const tLine = ok(await k.call(p.nurse, 'GET', `/v1/inventory/transfers?facilityId=${f1}&status=in_transit`)).items[0].lines[0].id;
    expect(reason(await k.call(p.nurse, 'POST', `/v1/inventory/transfers/${tr.transferId}/receive`, { lines: [{ lineId: tLine, quantity: 38 }] }))).toBe('discrepancy_reason_required');
    expect(reason(await k.call(p.nurse, 'POST', `/v1/inventory/transfers/${tr.transferId}/receive`, { lines: [{ lineId: tLine, quantity: 41 }] }))).toBe('over_receipt');
    expect(ok(await k.call(p.nurse, 'POST', `/v1/inventory/transfers/${tr.transferId}/receive`, { lines: [{ lineId: tLine, quantity: 38, reason: 'Two strips crushed in transit' }] }))).toMatchObject({ status: 'partially_received' });
    expect(reason(await k.call(p.nurse, 'POST', `/v1/inventory/transfers/${tr.transferId}/receive`, {}))).toBe('already_received');
    expect((await stockOf(id.ward, id.para))!.onHand).toBe(38);
  });

  it('transfers stay inside the clinic and need the sending store', async () => {
    const other = ok(await k.call(p.keeper2, 'POST', '/v1/inventory/stores', { facilityId: f2, code: 'B2', name: 'Branch store', storeType: 'central' }, true), 201).storeId;
    expect(reason(await k.call(p.admin, 'POST', '/v1/inventory/transfers', { fromStoreId: id.main, toStoreId: other, lines: [{ itemId: id.para, quantity: 1 }] }, true))).toBe('other_facility');
    expect((await k.call(p.keeper2, 'POST', '/v1/inventory/transfers', { fromStoreId: id.main, toStoreId: other, lines: [{ itemId: id.para, quantity: 1 }] }, true)).status).toBe(403);
  });
});

describe('stock counts', () => {
  it('differences post as adjustments once someone other than the counter approves', async () => {
    const c = ok(await k.call(p.keeper, 'POST', `/v1/inventory/stores/${id.main}/counts`, undefined, true), 201);
    expect(c.lines).toBe(3);
    expect(reason(await k.call(p.keeper, 'POST', `/v1/inventory/stores/${id.main}/counts`, undefined, true))).toBe('duplicate');
    const sheet = ok(await k.call(p.keeper, 'GET', `/v1/inventory/counts/${c.stockCountId}`));
    expect(reason(await k.call(p.keeper, 'POST', `/v1/inventory/counts/${c.stockCountId}/submit`))).toBe('uncounted_lines');
    const lines = sheet.lines.map((l: { id: string; batch_no: string; system_qty: string }) => ({ lineId: l.id, countedQty: l.batch_no === 'PB2' ? Number(l.system_qty) - 2 : Number(l.system_qty) }));
    ok(await k.call(p.keeper, 'POST', `/v1/inventory/counts/${c.stockCountId}/record`, { lines }));
    ok(await k.call(p.keeper, 'POST', `/v1/inventory/counts/${c.stockCountId}/submit`));
    expect((await k.call(p.keeper, 'POST', `/v1/inventory/counts/${c.stockCountId}/approve`, {})).status).toBe(403);
    expect(ok(await k.call(p.admin, 'POST', `/v1/inventory/counts/${c.stockCountId}/approve`, {}))).toMatchObject({ status: 'approved', adjusted: [{ batchId: id.batchB, quantity: -2 }] });
    expect((await stockOf(id.main, id.para))!.batches.find((b) => b.batchId === id.batchB)!.onHand).toBe(93);
  });

  it('refuses a variance if stock moved after the count opened, and the counter approving their own count', async () => {
    const c = ok(await k.call(p.admin, 'POST', `/v1/inventory/stores/${id.main}/counts`, undefined, true), 201);
    const sheet = ok(await k.call(p.admin, 'GET', `/v1/inventory/counts/${c.stockCountId}`));
    ok(await k.call(p.admin, 'POST', `/v1/inventory/counts/${c.stockCountId}/record`, { lines: sheet.lines.map((l: { id: string; system_qty: string }) => ({ lineId: l.id, countedQty: Number(l.system_qty) })) }));
    ok(await k.call(p.admin, 'POST', `/v1/inventory/counts/${c.stockCountId}/submit`));
    expect(reason(await k.call(p.admin, 'POST', `/v1/inventory/counts/${c.stockCountId}/approve`, {}))).toBe('own_count');
    ok(await k.call(p.keeper, 'POST', `/v1/inventory/stores/${id.main}/adjustments`, { kind: 'consumption', reason: 'Dressing', lines: [{ itemId: id.gloves, quantity: 1 }] }, true), 201);
    expect(reason(await k.call(p.admin2, 'POST', `/v1/inventory/counts/${c.stockCountId}/approve`, {}))).toBe('stock_moved');
    expect(ok(await k.call(p.admin2, 'POST', `/v1/inventory/counts/${c.stockCountId}/approve`, { reject: true }))).toMatchObject({ status: 'open' });
  });
});

describe('returns, reports and the ledger', () => {
  it('returns a batch to its supplier', async () => {
    const r = ok(await k.call(p.keeper, 'POST', '/v1/inventory/purchase-returns', { storeId: id.main, supplierId: id.supplier, reason: 'excess', lines: [{ batchId: id.batchB, quantity: 10 }] }, true), 201);
    expect(r.returnNo).toMatch(/^PRN\/\d{4}\/\d{6}$/);
    expect((await stockOf(id.main, id.para))!.batches.find((b) => b.batchId === id.batchB)!.onHand).toBe(83);
  });

  it('reports low stock and expiring batches, and shows the ledger', async () => {
    ok(await k.call(p.keeper, 'PUT', `/v1/inventory/stores/${id.main}/levels/${id.gloves}`, { minLevel: 50, reorderQty: 200, binLocation: 'R2-S3' }));
    expect(ok(await k.call(p.nurse, 'GET', `/v1/inventory/low-stock?facilityId=${f1}`)).items).toEqual([expect.objectContaining({ storeId: id.main, itemId: id.gloves, level: 50, usable: 39, reorderQty: 200 })]);
    const exp = ok(await k.call(p.nurse, 'GET', `/v1/inventory/expiring?facilityId=${f1}&days=200`)).items;
    expect(exp.map((e: { batch_no: string; store_name: string }) => `${e.store_name}:${e.batch_no}`).sort()).toEqual(['Main pharmacy:PA1', 'Ward 1 sub-store:PA1']);
    const ledger = ok(await k.call(p.keeper, 'GET', `/v1/inventory/stores/${id.main}/ledger?itemId=${id.para}`)).items;
    expect(ledger.map((m: { movement_type: string }) => m.movement_type)).toEqual(['vendor_return', 'adjustment', 'transfer_out', 'consumption', 'consumption', 'receipt', 'receipt']);
  });

  it('keeps the ledger append-only and balances equal to the sum of movements', async () => {
    await expect(k.admin.query(`UPDATE inventory.stock_movement SET quantity = 1000 WHERE tenant_id = $1`, [k.tenant.tenantId])).rejects.toThrow();
    await expect(k.admin.query(`DELETE FROM inventory.stock_movement WHERE tenant_id = $1`, [k.tenant.tenantId])).rejects.toThrow();
    expect(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM inventory.stock_balance_drift WHERE tenant_id = $1`, [k.tenant.tenantId])).n)).toBe(0);
    expect(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM inventory.stock_balance WHERE tenant_id = $1 AND on_hand < 0`, [k.tenant.tenantId])).n)).toBe(0);
  });

  it('a suspended inventory module refuses stock work but keeps stock readable', async () => {
    const m = ok(await k.call(p.admin, 'GET', '/v1/modules')).items.find((x: { module: string }) => x.module === 'inventory');
    const s = ok(await k.call(p.admin, 'PUT', '/v1/modules/inventory', { state: 'suspended', version: m.version, reason: 'Stock audit freeze' }));
    expect(reason(await k.call(p.keeper, 'POST', `/v1/inventory/stores/${id.main}/adjustments`, { kind: 'consumption', reason: 'OPD', lines: [{ itemId: id.gloves, quantity: 1 }] }, true))).toBe('module_inactive');
    ok(await k.call(p.keeper, 'GET', `/v1/inventory/stores/${id.main}/stock`));
    ok(await k.call(p.admin, 'PUT', '/v1/modules/inventory', { state: 'active', version: s.version, reason: 'Audit done' }));
  });
});
