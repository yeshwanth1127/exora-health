// Procurement (ERD m10): purchase orders (raised, approved by someone else, sent), goods receipts with
// batch details, supplier invoices three-way matched against PO prices and goods received, vendor returns.
// GRN quantities are base units; PO quantities are in the line's purchase unit (strip, box).
import type { DB, Kysely, Transaction } from '@hms/db';
import { conflict, forbidden, invalid, notFound, preconditionFailed, runCommand, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { activeItems, actor, assertInventoryActive, lockStore, nextNo, pad, postMovement, round3, stockError } from './state.ts';
import { ensureBatch, registerSerials } from './stock.ts';

type Opt<T> = T | undefined;

/** Paise either way that still counts as a match (rounding on the supplier's side). */
const MATCH_TOLERANCE_MINOR = 100;

async function activeSupplier(tx: Transaction<DB>, supplierId: string) {
  const s = await tx.selectFrom('inventory.supplier').select(['id', 'status', 'name', 'payment_terms_days']).where('id', '=', supplierId).executeTakeFirst();
  if (!s) throw notFound('supplier', { supplierId });
  if (s.status !== 'active') throw preconditionFailed(`${s.name} is blocked`, { reason: 'supplier_blocked' });
  return s;
}

// ---- purchase orders ----------------------------------------------------------------------------------------

export interface PoLine {
  itemId: string;
  uom?: Opt<string>;
  quantity: number;
  freeQty?: Opt<number>;
  unitPriceMinor: number;
  gstRateBp: 0 | 500 | 1200 | 1800 | 2800;
}

export async function createPurchaseOrder(
  db: Kysely<DB>,
  caller: Caller,
  input: { storeId: string; supplierId: string; expectedOn?: Opt<string>; notes?: Opt<string>; lines: PoLine[] },
  idempotencyKey: string,
) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.create_purchase_order', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    const store = await lockStore(ctx.tx, input.storeId);
    await activeSupplier(ctx.tx, input.supplierId);
    const ids = input.lines.map((l) => l.itemId);
    if (new Set(ids).size !== ids.length) throw invalid('list each item once', { reason: 'duplicate_item' });
    const items = await activeItems(ctx.tx, ids);
    const uoms = await ctx.tx.selectFrom('inventory.item_uom').select(['item_id', 'uom', 'factor_to_base']).where('item_id', 'in', ids).execute();
    const rows = input.lines.map((l) => {
      const item = items.get(l.itemId)!;
      const uom = l.uom ?? item.base_uom;
      const factor = uom === item.base_uom ? 1 : Number(uoms.find((u) => u.item_id === l.itemId && u.uom === uom)?.factor_to_base ?? 0);
      if (!factor) throw invalid(`${item.name} has no pack size "${uom}"`, { reason: 'unknown_uom', itemId: l.itemId });
      const taxable = Math.round(l.quantity * l.unitPriceMinor);
      return { l, uom, factor, taxable, tax: Math.round((taxable * l.gstRateBp) / 10_000) };
    });
    const taxable = rows.reduce((s, r) => s + r.taxable, 0);
    const tax = rows.reduce((s, r) => s + r.tax, 0);
    const year = String(now.getUTCFullYear());
    const poNo = `PO/${year}/${pad(await nextNo(ctx.tx, 'po', store.facility_id, year))}`;
    const { id } = await ctx.tx
      .insertInto('inventory.purchase_order')
      .values({ tenant_id: ctx.tenantId, facility_id: store.facility_id, po_no: poNo, supplier_id: input.supplierId, store_id: store.id, expected_on: input.expectedOn ?? null, notes: input.notes?.trim() || null, taxable_minor: taxable, tax_minor: tax, total_minor: taxable + tax, created_by: me, updated_by: me })
      .returning('id')
      .executeTakeFirstOrThrow();
    await ctx.tx
      .insertInto('inventory.purchase_order_line')
      .values(rows.map((r) => ({ tenant_id: ctx.tenantId, purchase_order_id: id, item_id: r.l.itemId, uom: r.uom, factor_to_base: r.factor, quantity: r.l.quantity, free_qty: r.l.freeQty ?? 0, unit_price_minor: r.l.unitPriceMinor, gst_rate_bp: r.l.gstRateBp, created_by: me, updated_by: me })))
      .execute();
    ctx.audit({ action: 'create', subjectType: 'inventory.purchase_order', subjectId: id, diff: { poNo, supplierId: input.supplierId, totalMinor: taxable + tax } });
    return { purchaseOrderId: id, poNo, status: 'draft', taxableMinor: taxable, taxMinor: tax, totalMinor: taxable + tax };
  }).catch(stockError);
}

const PO_MOVES: Record<'approve' | 'send' | 'cancel' | 'close', { from: string[]; to: string }> = {
  approve: { from: ['draft'], to: 'approved' },
  send: { from: ['approved'], to: 'sent' },
  cancel: { from: ['draft', 'approved', 'sent'], to: 'cancelled' },
  close: { from: ['partially_received'], to: 'closed' },
};

/** Approve (not your own order), send, cancel (nothing received yet) or short-close a purchase order. */
export async function movePurchaseOrder(db: Kysely<DB>, caller: Caller, input: { purchaseOrderId: string; action: keyof typeof PO_MOVES; reason?: Opt<string> }) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: `inventory.${input.action}_purchase_order` }, async (ctx) => {
    const me = actor(ctx);
    const po = await ctx.tx.selectFrom('inventory.purchase_order').select(['id', 'status', 'created_by', 'po_no', 'supplier_id', 'total_minor']).where('id', '=', input.purchaseOrderId).forUpdate().executeTakeFirst();
    if (!po) throw notFound('purchase order', { purchaseOrderId: input.purchaseOrderId });
    const move = PO_MOVES[input.action];
    if (!move.from.includes(po.status)) throw preconditionFailed(`a ${po.status.replace('_', ' ')} order can't be ${move.to.replace('_', ' ')}`, { reason: 'invalid_state', status: po.status });
    if (input.action === 'approve' && po.created_by === me) throw forbidden('someone other than whoever raised the order approves it', { reason: 'own_order' });
    if (input.action === 'cancel' && !input.reason?.trim()) throw invalid('say why the order is cancelled', { reason: 'reason_required' });
    await ctx.tx
      .updateTable('inventory.purchase_order')
      .set({
        status: move.to,
        ...(input.action === 'approve' && { approved_by: me, approved_at: now }),
        ...(input.action === 'send' && { sent_at: now }),
        ...(input.action === 'cancel' && { cancel_reason: input.reason!.trim() }),
        updated_by: me,
      })
      .where('id', '=', po.id)
      .execute();
    ctx.audit({ action: 'update', subjectType: 'inventory.purchase_order', subjectId: po.id, ...(input.reason && { reason: input.reason }), diff: { from: po.status, to: move.to } });
    if (input.action === 'send') ctx.emit({ eventType: 'inventory.purchase_order_sent', aggregateType: 'inventory.purchase_order', aggregateId: po.id, payload: { purchaseOrderId: po.id, poNo: po.po_no, supplierId: po.supplier_id, totalMinor: po.total_minor } });
    return { purchaseOrderId: po.id, status: move.to };
  }).catch(stockError);
}

// ---- goods receipt ------------------------------------------------------------------------------------------

export interface GrnLine {
  purchaseOrderLineId?: Opt<string>;
  itemId: string;
  batchNo?: Opt<string>;
  expiryDate?: Opt<string>;
  manufacturedOn?: Opt<string>;
  mrpMinor?: Opt<number>;
  unitCostMinor?: Opt<number>;
  qtyReceived: number;
  qtyFree?: Opt<number>;
  qtyRejected?: Opt<number>;
  rejectReason?: Opt<string>;
  serialNos?: Opt<string[]>;
}

/**
 * Receives goods into a store — against a purchase order or direct. Accepted units (received + free) go on
 * the ledger by batch; drugs need MRP; nothing arrives already expired; a PO line can't be over-received.
 */
export async function receiveGoods(
  db: Kysely<DB>,
  caller: Caller,
  input: { storeId: string; supplierId?: Opt<string>; purchaseOrderId?: Opt<string>; supplierInvoiceRef?: Opt<string>; lines: GrnLine[] },
  idempotencyKey: string,
) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.receive_goods', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    const store = await lockStore(ctx.tx, input.storeId);
    let supplierId = input.supplierId;
    const poLines = new Map<string, { item_id: string; factor_to_base: string; unit_price_minor: number }>();
    if (input.purchaseOrderId) {
      const po = await ctx.tx.selectFrom('inventory.purchase_order').select(['id', 'status', 'store_id', 'supplier_id']).where('id', '=', input.purchaseOrderId).forUpdate().executeTakeFirst();
      if (!po) throw notFound('purchase order', { purchaseOrderId: input.purchaseOrderId });
      if (!['approved', 'sent', 'partially_received'].includes(po.status)) throw preconditionFailed(`a ${po.status} order can't be received against`, { reason: 'po_not_open' });
      if (po.store_id !== store.id) throw invalid('receive into the store the order was raised for', { reason: 'store_mismatch' });
      if (supplierId && supplierId !== po.supplier_id) throw invalid('the supplier must match the order', { reason: 'supplier_mismatch' });
      supplierId = po.supplier_id;
      for (const l of await ctx.tx.selectFrom('inventory.purchase_order_line').select(['id', 'item_id', 'factor_to_base', 'unit_price_minor']).where('purchase_order_id', '=', po.id).execute()) poLines.set(l.id, l);
    }
    if (!supplierId) throw invalid('name the supplier or the purchase order', { reason: 'supplier_required' });
    await activeSupplier(ctx.tx, supplierId);
    const items = await activeItems(ctx.tx, [...new Set(input.lines.map((l) => l.itemId))]);
    const drugs = new Set((await ctx.tx.selectFrom('inventory.drug_product').select('item_id').where('item_id', 'in', [...items.keys()]).execute()).map((d) => d.item_id));

    const year = String(now.getUTCFullYear());
    const grnNo = `GRN/${year}/${pad(await nextNo(ctx.tx, 'grn', store.facility_id, year))}`;
    const { id } = await ctx.tx
      .insertInto('inventory.goods_receipt')
      .values({ tenant_id: ctx.tenantId, facility_id: store.facility_id, grn_no: grnNo, store_id: store.id, supplier_id: supplierId, purchase_order_id: input.purchaseOrderId ?? null, supplier_invoice_ref: input.supplierInvoiceRef?.trim() || null, received_at: now, received_by: me, created_by: me, updated_by: me })
      .returning('id')
      .executeTakeFirstOrThrow();

    const received: { itemId: string; batchId: string; quantity: number }[] = [];
    for (const l of input.lines) {
      const item = items.get(l.itemId)!;
      let unitCost = l.unitCostMinor;
      if (input.purchaseOrderId) {
        const pl = l.purchaseOrderLineId ? poLines.get(l.purchaseOrderLineId) : undefined;
        if (!pl || pl.item_id !== l.itemId) throw invalid('each line points at a line of this order for the same item', { reason: 'po_line_mismatch', itemId: l.itemId });
        unitCost ??= Math.round(pl.unit_price_minor / Number(pl.factor_to_base));
      } else if (l.purchaseOrderLineId) throw invalid('a direct receipt has no order lines', { reason: 'po_line_mismatch' });
      if (unitCost === undefined) throw invalid(`give the unit cost of ${item.name}`, { reason: 'cost_required', itemId: l.itemId });
      if (drugs.has(l.itemId) && l.mrpMinor === undefined) throw invalid(`${item.name} is a drug; record the MRP printed on the pack`, { reason: 'mrp_required', itemId: l.itemId });
      const accepted = round3(l.qtyReceived + (l.qtyFree ?? 0));
      const batch = await ensureBatch(ctx.tx, ctx.tenantId, item, { ...l, unitCostMinor: unitCost, supplierId }, now, me);
      const { id: lineId } = await ctx.tx
        .insertInto('inventory.goods_receipt_line')
        .values({
          tenant_id: ctx.tenantId,
          goods_receipt_id: id,
          purchase_order_line_id: l.purchaseOrderLineId ?? null,
          item_id: l.itemId,
          item_batch_id: batch.id,
          batch_no: l.batchNo?.trim() || 'NA',
          expiry_date: l.expiryDate ?? null,
          mrp_minor: l.mrpMinor ?? null,
          unit_cost_minor: unitCost,
          qty_received: l.qtyReceived,
          qty_free: l.qtyFree ?? 0,
          qty_rejected: l.qtyRejected ?? 0,
          reject_reason: l.qtyRejected ? l.rejectReason?.trim() || 'rejected at receipt' : null,
          serial_nos: l.serialNos ?? [],
          created_by: me,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (accepted > 0) {
        if (item.is_serial_tracked) await registerSerials(ctx.tx, ctx.tenantId, l.itemId, batch.id, store.id, l.serialNos ?? [], accepted, me);
        await postMovement(ctx.tx, ctx.tenantId, { storeId: store.id, itemId: l.itemId, batchId: batch.id, type: 'receipt', quantity: accepted, unitCostMinor: unitCost, at: now, by: me, source: { goods_receipt_line_id: lineId } });
        received.push({ itemId: l.itemId, batchId: batch.id, quantity: accepted });
      }
      if (l.purchaseOrderLineId && accepted > 0) {
        try {
          await ctx.tx.updateTable('inventory.purchase_order_line').set((eb) => ({ received_base_qty: eb('received_base_qty', '+', String(accepted)), updated_by: me })).where('id', '=', l.purchaseOrderLineId).execute();
        } catch (err) {
          if ((err as { code?: string }).code === '23514') throw conflict(`more ${item.name} than was ordered`, { reason: 'over_receipt', itemId: l.itemId });
          throw err;
        }
      }
    }
    if (input.purchaseOrderId) {
      const open = await ctx.tx
        .selectFrom('inventory.purchase_order_line')
        .select('id')
        .where('purchase_order_id', '=', input.purchaseOrderId)
        .where((eb) => eb('received_base_qty', '<', eb('quantity', '*', eb.ref('factor_to_base'))))
        .executeTakeFirst();
      await ctx.tx.updateTable('inventory.purchase_order').set({ status: open ? 'partially_received' : 'received', updated_by: me }).where('id', '=', input.purchaseOrderId).where('status', '<>', open ? 'partially_received' : 'received').execute();
    }
    ctx.audit({ action: 'create', subjectType: 'inventory.goods_receipt', subjectId: id, diff: { grnNo, supplierId, purchaseOrderId: input.purchaseOrderId ?? null, received } });
    ctx.emit({ eventType: 'inventory.goods_received', aggregateType: 'inventory.goods_receipt', aggregateId: id, payload: { goodsReceiptId: id, grnNo, storeId: store.id, supplierId, purchaseOrderId: input.purchaseOrderId ?? null } });
    return { goodsReceiptId: id, grnNo, received };
  }).catch(stockError);
}

// ---- supplier invoices --------------------------------------------------------------------------------------

/** Facilities of goods receipts, for the route's permission check. */
export async function receiptFacilities(db: Kysely<DB>, caller: Caller, ids: string[]) {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('inventory.goods_receipt').select('facility_id').where('id', 'in', ids).execute()).map((r) => r.facility_id));
}
export async function invoiceFacilities(db: Kysely<DB>, caller: Caller, supplierInvoiceId: string) {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('inventory.goods_receipt').select('facility_id').where('supplier_invoice_id', '=', supplierInvoiceId).execute()).map((r) => r.facility_id));
}

export interface InvoiceInput {
  supplierId: string;
  invoiceNo: string;
  invoiceDate: string;
  dueOn?: Opt<string>;
  taxableMinor: number;
  cgstMinor?: Opt<number>;
  sgstMinor?: Opt<number>;
  igstMinor?: Opt<number>;
  roundOffMinor?: Opt<number>;
  totalMinor: number;
  goodsReceiptIds: string[];
}

/**
 * Records a supplier's invoice for one or more receipts. Three-way match: the invoice's taxable value
 * against the goods accepted at their receipt cost (PO price unless overridden) — within ₹1 is a match.
 */
export async function recordSupplierInvoice(db: Kysely<DB>, caller: Caller, input: InvoiceInput, idempotencyKey: string) {
  await assertInventoryActive(db, caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.record_supplier_invoice', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    const supplier = await activeSupplier(ctx.tx, input.supplierId);
    const grns = await ctx.tx.selectFrom('inventory.goods_receipt').select(['id', 'supplier_id', 'supplier_invoice_id']).where('id', 'in', input.goodsReceiptIds).forUpdate().execute();
    if (grns.length !== new Set(input.goodsReceiptIds).size) throw notFound('goods receipt', { goodsReceiptIds: input.goodsReceiptIds });
    if (grns.some((g) => g.supplier_id !== input.supplierId)) throw invalid('every receipt must be from this supplier', { reason: 'supplier_mismatch' });
    if (grns.some((g) => g.supplier_invoice_id)) throw conflict('a receipt is already on another invoice', { reason: 'already_invoiced' });
    const lines = await ctx.tx.selectFrom('inventory.goods_receipt_line').select(['qty_received', 'unit_cost_minor']).where('goods_receipt_id', 'in', input.goodsReceiptIds).execute();
    const expected = lines.reduce((s, l) => s + Math.round(Number(l.qty_received) * l.unit_cost_minor), 0);
    const cgst = input.cgstMinor ?? 0;
    const sgst = input.sgstMinor ?? 0;
    const igst = input.igstMinor ?? 0;
    const roundOff = input.roundOffMinor ?? 0;
    if (input.totalMinor !== input.taxableMinor + cgst + sgst + igst + roundOff) throw invalid('the total must equal taxable value + GST + round-off', { reason: 'total_mismatch' });
    const matchStatus = Math.abs(input.taxableMinor - expected) <= MATCH_TOLERANCE_MINOR ? 'matched' : 'variance';
    const dueOn = input.dueOn ?? new Date(Date.parse(input.invoiceDate) + supplier.payment_terms_days * 86_400_000).toISOString().slice(0, 10);
    const { id } = await ctx.tx
      .insertInto('inventory.supplier_invoice')
      .values({ tenant_id: ctx.tenantId, supplier_id: input.supplierId, invoice_no: input.invoiceNo.trim(), invoice_date: input.invoiceDate, due_on: dueOn, taxable_minor: input.taxableMinor, cgst_minor: cgst, sgst_minor: sgst, igst_minor: igst, round_off_minor: roundOff, total_minor: input.totalMinor, expected_minor: expected, match_status: matchStatus, created_by: me, updated_by: me })
      .returning('id')
      .executeTakeFirstOrThrow();
    await ctx.tx.updateTable('inventory.goods_receipt').set({ supplier_invoice_id: id, updated_by: me }).where('id', 'in', input.goodsReceiptIds).execute();
    ctx.audit({ action: 'create', subjectType: 'inventory.supplier_invoice', subjectId: id, diff: { invoiceNo: input.invoiceNo, totalMinor: input.totalMinor, expectedMinor: expected, matchStatus } });
    return { supplierInvoiceId: id, matchStatus, expectedMinor: expected, varianceMinor: input.taxableMinor - expected, dueOn };
  }).catch(stockError);
}

/** Approves an invoice for payment (not by whoever recorded it); a variance needs a stated reason. */
export async function approveSupplierInvoice(db: Kysely<DB>, caller: Caller, input: { supplierInvoiceId: string; reason?: Opt<string> }) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.approve_supplier_invoice' }, async (ctx) => {
    const me = actor(ctx);
    const inv = await ctx.tx.selectFrom('inventory.supplier_invoice').select(['id', 'status', 'created_by', 'match_status', 'supplier_id', 'total_minor', 'due_on', 'invoice_no']).where('id', '=', input.supplierInvoiceId).forUpdate().executeTakeFirst();
    if (!inv) throw notFound('supplier invoice', { supplierInvoiceId: input.supplierInvoiceId });
    if (inv.status !== 'recorded') throw preconditionFailed(`this invoice is ${inv.status}`, { reason: 'already_approved' });
    if (inv.created_by === me) throw forbidden('someone other than whoever recorded the invoice approves it', { reason: 'own_invoice' });
    if (inv.match_status === 'variance' && !input.reason?.trim()) throw invalid('the invoice does not match the goods received; say why it is accepted', { reason: 'variance_reason_required' });
    await ctx.tx.updateTable('inventory.supplier_invoice').set({ status: 'approved', approved_by: me, approved_at: now, updated_by: me }).where('id', '=', inv.id).execute();
    ctx.audit({ action: 'update', subjectType: 'inventory.supplier_invoice', subjectId: inv.id, ...(input.reason && { reason: input.reason }), diff: { status: 'approved', matchStatus: inv.match_status } });
    ctx.emit({ eventType: 'inventory.supplier_invoice_approved', aggregateType: 'inventory.supplier_invoice', aggregateId: inv.id, payload: { supplierInvoiceId: inv.id, invoiceNo: inv.invoice_no, supplierId: inv.supplier_id, totalMinor: inv.total_minor, dueOn: inv.due_on } });
    return { supplierInvoiceId: inv.id, status: 'approved' };
  }).catch(stockError);
}

// ---- returns to the vendor ----------------------------------------------------------------------------------

export async function returnToVendor(
  db: Kysely<DB>,
  caller: Caller,
  input: { storeId: string; supplierId: string; reason: 'expired' | 'damaged' | 'recalled' | 'excess'; debitNoteRef?: Opt<string>; lines: { batchId: string; quantity: number }[] },
  idempotencyKey: string,
) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.return_to_vendor', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    const store = await lockStore(ctx.tx, input.storeId);
    await ctx.tx.selectFrom('inventory.supplier').select('id').where('id', '=', input.supplierId).executeTakeFirst().then((s) => {
      if (!s) throw notFound('supplier', { supplierId: input.supplierId });
    });
    const ids = input.lines.map((l) => l.batchId);
    if (new Set(ids).size !== ids.length) throw invalid('list each batch once', { reason: 'duplicate_batch' });
    const batches = await ctx.tx.selectFrom('inventory.item_batch').select(['id', 'item_id', 'supplier_id', 'unit_cost_minor']).where('id', 'in', ids).execute();
    if (batches.length !== ids.length) throw notFound('batch', { batchIds: ids });
    if (batches.some((b) => b.supplier_id && b.supplier_id !== input.supplierId)) throw invalid('a batch goes back to the supplier it came from', { reason: 'supplier_mismatch' });
    const year = String(now.getUTCFullYear());
    const returnNo = `PRN/${year}/${pad(await nextNo(ctx.tx, 'purchase_return', store.facility_id, year))}`;
    const { id } = await ctx.tx
      .insertInto('inventory.purchase_return')
      .values({ tenant_id: ctx.tenantId, facility_id: store.facility_id, return_no: returnNo, supplier_id: input.supplierId, store_id: store.id, reason: input.reason, debit_note_ref: input.debitNoteRef?.trim() || null, returned_at: now, created_at: now, created_by: me })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const l of input.lines) {
      const b = batches.find((x) => x.id === l.batchId)!;
      const { id: lineId } = await ctx.tx.insertInto('inventory.purchase_return_line').values({ tenant_id: ctx.tenantId, purchase_return_id: id, item_id: b.item_id, item_batch_id: b.id, quantity: l.quantity, created_by: me }).returning('id').executeTakeFirstOrThrow();
      await postMovement(ctx.tx, ctx.tenantId, { storeId: store.id, itemId: b.item_id, batchId: b.id, type: 'vendor_return', quantity: -l.quantity, unitCostMinor: b.unit_cost_minor, at: now, by: me, source: { purchase_return_line_id: lineId } });
    }
    ctx.audit({ action: 'create', subjectType: 'inventory.purchase_return', subjectId: id, reason: input.reason, diff: { returnNo, lines: input.lines } });
    return { purchaseReturnId: id, returnNo };
  }).catch(stockError);
}

