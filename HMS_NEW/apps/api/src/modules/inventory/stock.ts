// Inventory: the clinic's pharmacy store, items (drugs with their profile), suppliers, goods received
// against a supplier's bill (each line creates or tops up a batch), stock adjustments and batch status.
// Every quantity change is a stock_movement; balances follow by trigger and never go below zero.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';

/** Indian financial year of an instant in a timezone, e.g. '2026-27'. */
export function fyOf(at: Date, timezone: string) {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(at).split('-').map(Number) as [number, number];
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export async function docNo(tx: Transaction<DB>, kind: string, prefix: string, facilityId: string, at: Date) {
  const f = await tx.selectFrom('platform.facility').select('timezone').where('id', '=', facilityId).executeTakeFirstOrThrow();
  const fy = fyOf(at, f.timezone);
  const { rows: [n] } = await sql<{ n: number }>`SELECT platform.next_number(${kind}, ${facilityId}::uuid, ${fy}) AS n`.execute(tx);
  return `${prefix}/${fy}/${String(n!.n).padStart(6, '0')}`;
}

const dup = (err: unknown, what: string) => (pgCode(err) === '23505' ? conflict(`another ${what} uses that code`, { reason: 'duplicate_code' }) : null);

export async function createStore(db: Kysely<DB>, caller: Caller, input: { facilityId: string; code: string; name: string; drugLicenceNo: string }, idempotencyKey: string) {
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.create_store', idempotencyKey, request: input }, async (ctx) => {
    try {
      const s = await ctx.tx.insertInto('inventory.store').values({
        tenant_id: ctx.tenantId, facility_id: input.facilityId, code: input.code, name: input.name, drug_licence_no: input.drugLicenceNo, created_by: ctx.actor.staffId ?? null,
      }).returning(['id', 'version']).executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'inventory.store', subjectId: s.id, diff: input });
      return { storeId: s.id, version: s.version };
    } catch (err) {
      throw dup(err, 'store at this clinic') ?? err;
    }
  });
}

export interface DrugProfile {
  genericName: string;
  brandName?: string | undefined;
  strength?: string | undefined;
  dosageForm: 'tablet' | 'capsule' | 'syrup' | 'suspension' | 'injection' | 'infusion' | 'ointment' | 'cream' | 'drops' | 'inhaler' | 'suppository' | 'powder' | 'patch' | 'other';
  defaultRoute?: 'oral' | 'iv' | 'im' | 'sc' | 'topical' | 'inhalation' | 'sublingual' | 'rectal' | 'ophthalmic' | 'otic' | 'nasal' | 'vaginal' | 'other' | undefined;
  manufacturer?: string | undefined;
  regulatorySchedule: 'none' | 'G' | 'H' | 'H1' | 'X';
  isNdps: boolean;
  isHighAlert: boolean;
}

export interface ItemInput {
  code: string;
  name: string;
  itemType: 'drug' | 'consumable' | 'vaccine' | 'general';
  baseUom: string;
  packUom?: string | undefined;
  packSize?: number | undefined;
  hsnCode?: string | undefined;
  isExpiryTracked: boolean;
  reorderLevel: number;
  drug?: DrugProfile | undefined;
}

export async function createItem(db: Kysely<DB>, caller: Caller, input: ItemInput, idempotencyKey: string) {
  if ((input.itemType === 'drug') !== !!input.drug) throw invalid('a drug needs its drug profile, and only drugs have one', { reason: 'drug_profile' });
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.create_item', idempotencyKey, request: input }, async (ctx) => {
    try {
      const item = await ctx.tx.insertInto('inventory.item').values({
        tenant_id: ctx.tenantId, code: input.code, name: input.name, item_type: input.itemType, base_uom: input.baseUom,
        pack_uom: input.packUom ?? null, pack_size: input.packSize ?? null, hsn_code: input.hsnCode ?? null,
        is_expiry_tracked: input.isExpiryTracked, reorder_level: input.reorderLevel, created_by: ctx.actor.staffId ?? null,
      }).returning(['id', 'version']).executeTakeFirstOrThrow();
      if (input.drug) {
        const d = input.drug;
        await ctx.tx.insertInto('inventory.drug_product').values({
          tenant_id: ctx.tenantId, item_id: item.id, generic_name: d.genericName, brand_name: d.brandName ?? null, strength: d.strength ?? null,
          dosage_form: d.dosageForm, default_route: d.defaultRoute ?? null, manufacturer: d.manufacturer ?? null,
          regulatory_schedule: d.regulatorySchedule, is_ndps: d.isNdps, is_high_alert: d.isHighAlert, created_by: ctx.actor.staffId ?? null,
        }).execute();
      }
      ctx.audit({ action: 'create', subjectType: 'inventory.item', subjectId: item.id, diff: { ...input } });
      return { itemId: item.id, version: item.version };
    } catch (err) {
      throw dup(err, 'item') ?? err;
    }
  });
}

export async function updateItem(
  db: Kysely<DB>, caller: Caller, input: { itemId: string; version: number; name?: string | undefined; reorderLevel?: number | undefined; hsnCode?: string | null | undefined; status?: 'active' | 'inactive' | undefined },
  idempotencyKey?: string,
) {
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.update_item', idempotencyKey, request: input }, async (ctx) => {
    const item = await ctx.tx.selectFrom('inventory.item').selectAll().where('id', '=', input.itemId).forUpdate().executeTakeFirst();
    if (!item) throw notFound('item', { itemId: input.itemId });
    if (item.version !== input.version) throw conflict('this item was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: item.version });
    const set = Object.fromEntries(Object.entries({ name: input.name, reorder_level: input.reorderLevel, hsn_code: input.hsnCode, status: input.status }).filter(([, v]) => v !== undefined));
    if (!Object.keys(set).length) return { itemId: item.id, version: item.version };
    const { version } = await ctx.tx.updateTable('inventory.item').set({ ...set, updated_by: ctx.actor.staffId ?? null }).where('id', '=', item.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: input.status ? 'status_change' : 'update', subjectType: 'inventory.item', subjectId: item.id, diff: set });
    return { itemId: item.id, version };
  });
}

export async function createSupplier(
  db: Kysely<DB>, caller: Caller,
  input: { code: string; name: string; gstin?: string | undefined; stateCode?: string | undefined; drugLicenceNo?: string | undefined; phone?: string | undefined; email?: string | undefined; address?: string | undefined; paymentTermsDays?: number | undefined },
  idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.create_supplier', idempotencyKey, request: input }, async (ctx) => {
    try {
      const s = await ctx.tx.insertInto('inventory.supplier').values({
        tenant_id: ctx.tenantId, code: input.code, name: input.name, gstin: input.gstin ?? null, state_code: input.stateCode ?? input.gstin?.slice(0, 2) ?? null,
        drug_licence_no: input.drugLicenceNo ?? null, phone: input.phone ?? null, email: input.email ?? null, address: input.address ?? null,
        payment_terms_days: input.paymentTermsDays ?? 30, created_by: ctx.actor.staffId ?? null,
      }).returning(['id', 'version']).executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'inventory.supplier', subjectId: s.id, diff: input });
      return { supplierId: s.id, version: s.version };
    } catch (err) {
      throw dup(err, 'supplier (code or GSTIN)') ?? err;
    }
  });
}

async function lockStore(tx: Transaction<DB>, storeId: string) {
  const store = await tx.selectFrom('inventory.store').selectAll().where('id', '=', storeId).forShare().executeTakeFirst();
  if (!store) throw notFound('store', { storeId });
  if (store.status !== 'active') throw preconditionFailed('the store is switched off', { reason: 'store_inactive' });
  return store;
}

export interface ReceiptLine {
  itemId: string;
  batchNo: string;
  expiryDate?: string | undefined;
  /** Per base unit. */
  mrpMinor?: number | undefined;
  /** Per base unit, before GST. */
  unitCostMinor: number;
  qtyReceived: number;
  qtyFree?: number | undefined;
  gstRateBp?: number | undefined;
}

/** Goods received against a supplier's bill: batches created (or topped up) and stock added. */
export async function receiveGoods(
  db: Kysely<DB>, caller: Caller,
  input: { storeId: string; supplierId: string; supplierInvoiceNo: string; supplierInvoiceOn: string; invoiceTotalMinor?: number | undefined; notes?: string | undefined; lines: ReceiptLine[] },
  idempotencyKey: string,
) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.receive_goods', idempotencyKey, request: input }, async (ctx) => {
    const store = await lockStore(ctx.tx, input.storeId);
    const supplier = await ctx.tx.selectFrom('inventory.supplier').select(['id', 'status']).where('id', '=', input.supplierId).executeTakeFirst();
    if (!supplier) throw notFound('supplier', { supplierId: input.supplierId });
    if (supplier.status !== 'active') throw preconditionFailed('the supplier is blocked', { reason: 'supplier_blocked' });
    const grnNo = await docNo(ctx.tx, 'grn', 'GRN', store.facility_id, now);
    let receipt: { id: string };
    try {
      receipt = await ctx.tx.insertInto('inventory.goods_receipt').values({
        tenant_id: ctx.tenantId, facility_id: store.facility_id, grn_no: grnNo, store_id: store.id, supplier_id: supplier.id,
        supplier_invoice_no: input.supplierInvoiceNo, supplier_invoice_on: input.supplierInvoiceOn, invoice_total_minor: input.invoiceTotalMinor ?? null,
        received_at: now, received_by: ctx.actor.staffId!, notes: input.notes ?? null, created_by: ctx.actor.staffId ?? null,
      }).returning('id').executeTakeFirstOrThrow();
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('this supplier bill was already received', { reason: 'duplicate_supplier_invoice' });
      throw err;
    }
    const lines: { itemId: string; itemBatchId: string; quantity: number }[] = [];
    for (const l of input.lines) {
      const item = await ctx.tx.selectFrom('inventory.item').select(['id', 'status', 'is_expiry_tracked', 'name']).where('id', '=', l.itemId).executeTakeFirst();
      if (!item) throw notFound('item', { itemId: l.itemId });
      if (item.status !== 'active') throw preconditionFailed(`${item.name} is switched off`, { reason: 'item_inactive', itemId: item.id });
      if (item.is_expiry_tracked && !l.expiryDate) throw invalid(`${item.name} needs the batch expiry date`, { reason: 'expiry_required', itemId: item.id });
      const existing = await ctx.tx.selectFrom('inventory.item_batch').selectAll().where('item_id', '=', item.id).where('batch_no', '=', l.batchNo).forUpdate().executeTakeFirst();
      if (existing && (String(existing.expiry_date ?? '') !== String(l.expiryDate ?? '') || (l.mrpMinor !== undefined && existing.mrp_minor !== l.mrpMinor))) {
        throw conflict(`batch ${l.batchNo} of ${item.name} is already recorded with a different expiry or MRP`, { reason: 'batch_mismatch', itemId: item.id, batchNo: l.batchNo });
      }
      const batchId = existing?.id ?? (await ctx.tx.insertInto('inventory.item_batch').values({
        tenant_id: ctx.tenantId, item_id: item.id, supplier_id: supplier.id, batch_no: l.batchNo, expiry_date: l.expiryDate ?? null,
        mrp_minor: l.mrpMinor ?? null, unit_cost_minor: l.unitCostMinor, received_at: now, created_by: ctx.actor.staffId ?? null,
      }).returning('id').executeTakeFirstOrThrow()).id;
      const line = await ctx.tx.insertInto('inventory.goods_receipt_line').values({
        tenant_id: ctx.tenantId, goods_receipt_id: receipt.id, item_id: item.id, item_batch_id: batchId, qty_received: l.qtyReceived,
        qty_free: l.qtyFree ?? 0, unit_cost_minor: l.unitCostMinor, gst_rate_bp: l.gstRateBp ?? 0, created_by: ctx.actor.staffId ?? null,
      }).returning('id').executeTakeFirstOrThrow();
      const quantity = l.qtyReceived + (l.qtyFree ?? 0);
      await ctx.tx.insertInto('inventory.stock_movement').values({
        tenant_id: ctx.tenantId, store_id: store.id, item_id: item.id, item_batch_id: batchId, movement_type: 'receipt', quantity,
        unit_cost_minor: l.unitCostMinor, occurred_at: now, actor_staff_id: ctx.actor.staffId ?? null, goods_receipt_line_id: line.id,
      }).execute();
      lines.push({ itemId: item.id, itemBatchId: batchId, quantity });
    }
    ctx.audit({ action: 'create', subjectType: 'inventory.goods_receipt', subjectId: receipt.id, diff: { grnNo, supplierInvoiceNo: input.supplierInvoiceNo, lines: lines.length } });
    ctx.emit({ eventType: 'goods.received', aggregateType: 'inventory.goods_receipt', aggregateId: receipt.id, payload: { goodsReceiptId: receipt.id, storeId: store.id, supplierId: supplier.id } });
    return { goodsReceiptId: receipt.id, grnNo, lines };
  });
}

type AdjustmentKind = 'opening' | 'consumption' | 'adjustment' | 'expiry_disposal' | 'damage' | 'vendor_return';

/**
 * Stock that changes for a reason other than a receipt or a patient: opening balances (new batches),
 * corrections (signed), consumption, damage, expiry disposal, returns to a supplier (all out).
 */
export async function adjustStock(
  db: Kysely<DB>, caller: Caller,
  input: {
    storeId: string; kind: AdjustmentKind; reason: string; supplierId?: string | undefined;
    lines: { itemBatchId?: string | undefined; quantity: number; opening?: (Omit<ReceiptLine, 'qtyReceived' | 'qtyFree' | 'gstRateBp'>) | undefined }[];
  },
  idempotencyKey: string,
) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.adjust_stock', idempotencyKey, request: input }, async (ctx) => {
    const store = await lockStore(ctx.tx, input.storeId);
    if ((input.kind === 'vendor_return') !== !!input.supplierId) throw invalid('a return to a supplier names the supplier (and only then)', { reason: 'supplier_required' });
    const adjustmentNo = await docNo(ctx.tx, 'stock_adjustment', 'ADJ', store.facility_id, now);
    const adj = await ctx.tx.insertInto('inventory.stock_adjustment').values({
      tenant_id: ctx.tenantId, facility_id: store.facility_id, adjustment_no: adjustmentNo, store_id: store.id, kind: input.kind,
      supplier_id: input.supplierId ?? null, reason: input.reason, created_at: now, created_by: ctx.actor.staffId!,
    }).returning('id').executeTakeFirstOrThrow();
    for (const l of input.lines) {
      let batchId = l.itemBatchId;
      if (input.kind === 'opening') {
        if (!l.opening || l.quantity <= 0) throw invalid('opening stock gives the item, batch and a positive quantity', { reason: 'opening_line' });
        const o = l.opening;
        const existing = await ctx.tx.selectFrom('inventory.item_batch').select('id').where('item_id', '=', o.itemId).where('batch_no', '=', o.batchNo).executeTakeFirst();
        batchId = existing?.id ?? (await ctx.tx.insertInto('inventory.item_batch').values({
          tenant_id: ctx.tenantId, item_id: o.itemId, batch_no: o.batchNo, expiry_date: o.expiryDate ?? null, mrp_minor: o.mrpMinor ?? null,
          unit_cost_minor: o.unitCostMinor, received_at: now, created_by: ctx.actor.staffId ?? null,
        }).returning('id').executeTakeFirstOrThrow()).id;
      }
      if (!batchId) throw invalid('choose the batch', { reason: 'batch_required' });
      const batch = await ctx.tx.selectFrom('inventory.item_batch').select(['id', 'item_id', 'unit_cost_minor']).where('id', '=', batchId).executeTakeFirst();
      if (!batch) throw notFound('batch', { itemBatchId: batchId });
      const out = ['consumption', 'expiry_disposal', 'damage', 'vendor_return'].includes(input.kind);
      if (input.kind !== 'adjustment' && l.quantity <= 0) throw invalid('give a positive quantity', { reason: 'quantity' });
      const quantity = out ? -l.quantity : l.quantity;
      try {
        await ctx.tx.insertInto('inventory.stock_movement').values({
          tenant_id: ctx.tenantId, store_id: store.id, item_id: batch.item_id, item_batch_id: batch.id, movement_type: input.kind, quantity,
          unit_cost_minor: batch.unit_cost_minor, occurred_at: now, actor_staff_id: ctx.actor.staffId ?? null, adjustment_id: adj.id,
        }).execute();
      } catch (err) {
        throw stockError(err) ?? err;
      }
    }
    ctx.audit({ action: 'create', subjectType: 'inventory.stock_adjustment', subjectId: adj.id, reason: input.reason, diff: { kind: input.kind, adjustmentNo, lines: input.lines.length } });
    return { adjustmentId: adj.id, adjustmentNo };
  });
}

/** Maps the ledger's database refusals to domain errors. */
export function stockError(err: unknown) {
  const e = err as { constraint?: string; hint?: string; message?: string };
  if (pgCode(err) === '23514' && e.constraint === 'stock_balance_on_hand_check') return preconditionFailed('not enough stock in that batch', { reason: 'insufficient_stock' });
  if (pgCode(err) === '55000' && (e.hint === 'batch_unavailable' || e.hint === 'batch_expired')) return preconditionFailed(e.message ?? 'batch cannot be issued', { reason: e.hint });
  return null;
}

/** Quarantine, recall, expire or release a batch. */
export async function setBatchStatus(db: Kysely<DB>, caller: Caller, input: { itemBatchId: string; status: 'available' | 'quarantined' | 'recalled' | 'expired'; reason?: string | undefined; version: number }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.set_batch_status', idempotencyKey, request: input }, async (ctx) => {
    const b = await ctx.tx.selectFrom('inventory.item_batch').selectAll().where('id', '=', input.itemBatchId).forUpdate().executeTakeFirst();
    if (!b) throw notFound('batch', { itemBatchId: input.itemBatchId });
    if (b.version !== input.version) throw conflict('this batch was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: b.version });
    if ((input.status === 'quarantined' || input.status === 'recalled') && !input.reason) throw invalid('give a reason', { reason: 'reason_required' });
    const { version } = await ctx.tx.updateTable('inventory.item_batch').set({ status: input.status, status_reason: input.reason ?? null, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', b.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'inventory.item_batch', subjectId: b.id, reason: input.reason, diff: { status: [b.status, input.status] } });
    return { itemBatchId: b.id, status: input.status, version };
  });
}

