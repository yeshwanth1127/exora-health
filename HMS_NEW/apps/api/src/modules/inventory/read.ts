// Inventory reads: catalogue, stores, stock by store (batches, levels), low stock, expiring batches, the
// ledger, and the working lists (orders, receipts, invoices, indents, transfers, counts).
import { sql, type DB, type Kysely } from '@hms/db';
import { notFound, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { istDate } from './state.ts';

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listItems(db: Kysely<DB>, caller: Caller, f: { q?: string | undefined; itemType?: string | undefined; includeInactive?: boolean | undefined; limit: number }) {
  return runQuery(db, caller.tenantId, (tx) => {
    let q = tx
      .selectFrom('inventory.item as i')
      .leftJoin('inventory.drug_product as d', 'd.item_id', 'i.id')
      .leftJoin('inventory.item_group as g', 'g.id', 'i.item_group_id')
      .select([
        'i.id', 'i.code', 'i.name', 'i.item_type', 'i.base_uom', 'i.hsn_code', 'i.status', 'i.version', 'i.reorder_level', 'i.is_batch_tracked', 'i.is_expiry_tracked',
        'i.is_serial_tracked', 'i.is_cold_chain', 'i.is_billable', 'g.name as group_name', 'd.generic_name', 'd.strength', 'd.dosage_form', 'd.regulatory_schedule',
        'd.is_ndps', 'd.is_high_alert',
      ])
      .orderBy('i.name')
      .limit(f.limit);
    if (f.q) q = q.where((eb) => eb.or([eb(eb.fn('lower', ['i.name']), 'like', like(f.q!.toLowerCase())), eb('i.code', 'ilike', like(f.q!)), eb(eb.fn('lower', ['d.generic_name']), 'like', like(f.q!.toLowerCase()))]));
    if (f.itemType) q = q.where('i.item_type', '=', f.itemType);
    if (!f.includeInactive) q = q.where('i.status', '=', 'active');
    return q.execute();
  });
}

export async function getItem(db: Kysely<DB>, caller: Caller, itemId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const item = await tx.selectFrom('inventory.item').selectAll().where('id', '=', itemId).executeTakeFirst();
    if (!item) throw notFound('item', { itemId });
    const [drug, uoms, batches] = await Promise.all([
      tx.selectFrom('inventory.drug_product').selectAll().where('item_id', '=', itemId).executeTakeFirst(),
      tx.selectFrom('inventory.item_uom').select(['uom', 'factor_to_base', 'is_purchase_uom', 'is_issue_uom']).where('item_id', '=', itemId).orderBy('factor_to_base').execute(),
      tx.selectFrom('inventory.item_batch').select(['id', 'batch_no', 'expiry_date', 'mrp_minor', 'unit_cost_minor', 'status', 'status_reason']).where('item_id', '=', itemId).orderBy('expiry_date').limit(100).execute(),
    ]);
    return { ...item, drug: drug ?? null, uoms, batches };
  });
}

export async function listItemGroups(db: Kysely<DB>, caller: Caller) {
  return runQuery(db, caller.tenantId, (tx) => tx.selectFrom('inventory.item_group').select(['id', 'code', 'name', 'parent_id', 'status']).orderBy('name').execute());
}

export async function listStores(db: Kysely<DB>, caller: Caller, facilityId: string) {
  return runQuery(db, caller.tenantId, (tx) =>
    tx
      .selectFrom('inventory.store')
      .select(['id', 'code', 'name', 'store_type', 'parent_store_id', 'location_id', 'can_dispense_to_patient', 'drug_licence_no', 'status', 'version'])
      .where('facility_id', '=', facilityId)
      .orderBy('name')
      .execute(),
  );
}

export async function listSuppliers(db: Kysely<DB>, caller: Caller, f: { q?: string | undefined }) {
  return runQuery(db, caller.tenantId, (tx) => {
    let q = tx.selectFrom('inventory.supplier').select(['id', 'code', 'name', 'gstin', 'state_code', 'drug_licence_no', 'phone', 'email', 'payment_terms_days', 'status', 'version']).orderBy('name').limit(200);
    if (f.q) q = q.where((eb) => eb.or([eb('name', 'ilike', like(f.q!)), eb('code', 'ilike', like(f.q!)), eb('gstin', 'ilike', like(f.q!))]));
    return q.execute();
  });
}

/** Stock in a store, one row per item with its batches (earliest expiry first) and its level. */
export async function storeStock(db: Kysely<DB>, caller: Caller, storeId: string, f: { q?: string | undefined }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let q = tx
      .selectFrom('inventory.stock_balance as b')
      .innerJoin('inventory.item as i', 'i.id', 'b.item_id')
      .innerJoin('inventory.item_batch as ib', 'ib.id', 'b.item_batch_id')
      .leftJoin('inventory.store_item_setting as s', (j) => j.onRef('s.store_id', '=', 'b.store_id').onRef('s.item_id', '=', 'b.item_id'))
      .select(['i.id as item_id', 'i.code', 'i.name', 'i.base_uom', 'i.item_type', 'i.reorder_level', 's.min_level', 's.max_level', 's.bin_location', 'ib.id as batch_id', 'ib.batch_no', 'ib.expiry_date', 'ib.mrp_minor', 'ib.status as batch_status', 'b.on_hand'])
      .where('b.store_id', '=', storeId)
      .where('b.on_hand', '>', '0')
      .orderBy('i.name')
      .orderBy(sql`ib.expiry_date NULLS LAST`);
    if (f.q) q = q.where((eb) => eb.or([eb('i.name', 'ilike', like(f.q!)), eb('i.code', 'ilike', like(f.q!))]));
    const rows = await q.limit(2000).execute();
    const today = istDate(clock(caller));
    const items = new Map<string, { itemId: string; code: string; name: string; baseUom: string; itemType: string; onHand: number; usable: number; minLevel: number; low: boolean; binLocation: string | null; batches: unknown[] }>();
    for (const r of rows) {
      let it = items.get(r.item_id);
      if (!it) {
        it = { itemId: r.item_id, code: r.code, name: r.name, baseUom: r.base_uom, itemType: r.item_type, onHand: 0, usable: 0, minLevel: Number(r.min_level ?? r.reorder_level), low: false, binLocation: r.bin_location, batches: [] };
        items.set(r.item_id, it);
      }
      const qty = Number(r.on_hand);
      const expired = r.expiry_date !== null && (r.expiry_date as string) < today;
      it.onHand += qty;
      if (r.batch_status === 'available' && !expired) it.usable += qty;
      it.batches.push({ batchId: r.batch_id, batchNo: r.batch_no, expiryDate: r.expiry_date, mrpMinor: r.mrp_minor, status: expired && r.batch_status === 'available' ? 'expired' : r.batch_status, onHand: qty });
    }
    for (const it of items.values()) it.low = it.usable <= it.minLevel && it.minLevel > 0;
    return [...items.values()];
  });
}

/** Items at or below their level in each store of the clinic (store level, else the item's reorder level). */
export async function lowStock(db: Kysely<DB>, caller: Caller, facilityId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<{ store_id: string; store_name: string; item_id: string; code: string; name: string; base_uom: string; level: string; usable: string; reorder_qty: string | null }>`
      WITH levels AS (
        SELECT st.id AS store_id, st.name AS store_name, i.id AS item_id, i.code, i.name, i.base_uom,
               coalesce(s.min_level, i.reorder_level) AS level, s.reorder_qty
        FROM inventory.store st
        CROSS JOIN inventory.item i
        LEFT JOIN inventory.store_item_setting s ON s.store_id = st.id AND s.item_id = i.id
        WHERE st.facility_id = ${facilityId} AND st.status = 'active' AND i.status = 'active'
          AND (s.id IS NOT NULL OR (i.reorder_level > 0 AND st.store_type IN ('central', 'pharmacy')))
      )
      SELECT l.*, coalesce(sum(b.on_hand) FILTER (WHERE ib.status = 'available' AND (ib.expiry_date IS NULL OR ib.expiry_date >= ${istDate(clock(caller))}::date)), 0) AS usable
      FROM levels l
      LEFT JOIN inventory.stock_balance b ON b.store_id = l.store_id AND b.item_id = l.item_id
      LEFT JOIN inventory.item_batch ib ON ib.id = b.item_batch_id
      WHERE l.level > 0
      GROUP BY l.store_id, l.store_name, l.item_id, l.code, l.name, l.base_uom, l.level, l.reorder_qty
      HAVING coalesce(sum(b.on_hand) FILTER (WHERE ib.status = 'available' AND (ib.expiry_date IS NULL OR ib.expiry_date >= ${istDate(clock(caller))}::date)), 0) <= l.level
      ORDER BY l.store_name, l.name
      LIMIT 500`.execute(tx);
    return rows.map((r) => ({ storeId: r.store_id, storeName: r.store_name, itemId: r.item_id, code: r.code, name: r.name, baseUom: r.base_uom, level: Number(r.level), usable: Number(r.usable), reorderQty: r.reorder_qty === null ? null : Number(r.reorder_qty) }));
  });
}

/** Batches in stock in the clinic's stores that expire within `days` (or already have). */
export async function expiringStock(db: Kysely<DB>, caller: Caller, facilityId: string, days: number) {
  const until = istDate(new Date(clock(caller).getTime() + days * 86_400_000));
  return runQuery(db, caller.tenantId, (tx) =>
    tx
      .selectFrom('inventory.stock_balance as b')
      .innerJoin('inventory.store as st', 'st.id', 'b.store_id')
      .innerJoin('inventory.item_batch as ib', 'ib.id', 'b.item_batch_id')
      .innerJoin('inventory.item as i', 'i.id', 'b.item_id')
      .select(['st.id as store_id', 'st.name as store_name', 'i.id as item_id', 'i.name', 'i.base_uom', 'ib.id as batch_id', 'ib.batch_no', 'ib.expiry_date', 'ib.status', 'ib.supplier_id', 'b.on_hand'])
      .where('st.facility_id', '=', facilityId)
      .where('b.on_hand', '>', '0')
      .where('ib.expiry_date', '<=', until)
      .orderBy('ib.expiry_date')
      .limit(500)
      .execute(),
  );
}

export async function stockLedger(db: Kysely<DB>, caller: Caller, f: { storeId: string; itemId?: string | undefined; limit: number }) {
  return runQuery(db, caller.tenantId, (tx) => {
    let q = tx
      .selectFrom('inventory.stock_movement as m')
      .innerJoin('inventory.item as i', 'i.id', 'm.item_id')
      .innerJoin('inventory.item_batch as ib', 'ib.id', 'm.item_batch_id')
      .leftJoin('platform.staff as s', 's.id', 'm.actor_staff_id')
      .select(['m.id', 'm.occurred_at', 'm.movement_type', 'm.quantity', 'm.unit_cost_minor', 'i.name as item_name', 'i.base_uom', 'ib.batch_no', 's.display_name as actor_name', 'm.patient_id'])
      .where('m.store_id', '=', f.storeId)
      .orderBy('m.occurred_at', 'desc')
      .orderBy('m.id', 'desc')
      .limit(f.limit);
    if (f.itemId) q = q.where('m.item_id', '=', f.itemId);
    return q.execute();
  });
}

export async function listPurchaseOrders(db: Kysely<DB>, caller: Caller, f: { facilityId: string; status?: string | undefined }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let q = tx
      .selectFrom('inventory.purchase_order as po')
      .innerJoin('inventory.supplier as s', 's.id', 'po.supplier_id')
      .innerJoin('inventory.store as st', 'st.id', 'po.store_id')
      .leftJoin('platform.staff as c', 'c.id', 'po.created_by')
      .select(['po.id', 'po.po_no', 'po.status', 'po.expected_on', 'po.total_minor', 'po.created_at', 'po.created_by', 's.name as supplier_name', 'po.supplier_id', 'st.name as store_name', 'po.store_id', 'c.display_name as created_by_name'])
      .where('po.facility_id', '=', f.facilityId)
      .orderBy('po.created_at', 'desc')
      .limit(200);
    if (f.status) q = q.where('po.status', '=', f.status);
    const orders = await q.execute();
    const lines = orders.length
      ? await tx
          .selectFrom('inventory.purchase_order_line as l')
          .innerJoin('inventory.item as i', 'i.id', 'l.item_id')
          .select(['l.id', 'l.purchase_order_id', 'l.item_id', 'i.name as item_name', 'i.base_uom', 'l.uom', 'l.factor_to_base', 'l.quantity', 'l.free_qty', 'l.unit_price_minor', 'l.gst_rate_bp', 'l.received_base_qty'])
          .where('l.purchase_order_id', 'in', orders.map((o) => o.id))
          .execute()
      : [];
    return orders.map((o) => ({ ...o, lines: lines.filter((l) => l.purchase_order_id === o.id) }));
  });
}

export async function listGoodsReceipts(db: Kysely<DB>, caller: Caller, f: { facilityId: string; uninvoiced?: boolean | undefined; supplierId?: string | undefined }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let q = tx
      .selectFrom('inventory.goods_receipt as g')
      .innerJoin('inventory.supplier as s', 's.id', 'g.supplier_id')
      .innerJoin('inventory.store as st', 'st.id', 'g.store_id')
      .leftJoin('inventory.purchase_order as po', 'po.id', 'g.purchase_order_id')
      .select(['g.id', 'g.grn_no', 'g.received_at', 'g.supplier_id', 's.name as supplier_name', 'st.name as store_name', 'po.po_no', 'g.supplier_invoice_ref', 'g.supplier_invoice_id'])
      .select((eb) =>
        eb
          .selectFrom('inventory.goods_receipt_line as l')
          .select(sql<string>`coalesce(sum(round(l.qty_received * l.unit_cost_minor)), 0)`.as('v'))
          .whereRef('l.goods_receipt_id', '=', 'g.id')
          .as('value_minor'),
      )
      .where('g.facility_id', '=', f.facilityId)
      .orderBy('g.received_at', 'desc')
      .limit(200);
    if (f.uninvoiced) q = q.where('g.supplier_invoice_id', 'is', null);
    if (f.supplierId) q = q.where('g.supplier_id', '=', f.supplierId);
    return (await q.execute()).map((g) => ({ ...g, value_minor: Number(g.value_minor) }));
  });
}

export async function listSupplierInvoices(db: Kysely<DB>, caller: Caller, f: { facilityId: string; status?: string | undefined }) {
  return runQuery(db, caller.tenantId, (tx) => {
    let q = tx
      .selectFrom('inventory.supplier_invoice as v')
      .innerJoin('inventory.supplier as s', 's.id', 'v.supplier_id')
      .select(['v.id', 'v.invoice_no', 'v.invoice_date', 'v.due_on', 'v.taxable_minor', 'v.total_minor', 'v.expected_minor', 'v.match_status', 'v.status', 'v.created_by', 's.name as supplier_name'])
      .where((eb) => eb.exists(eb.selectFrom('inventory.goods_receipt as g').select('g.id').whereRef('g.supplier_invoice_id', '=', 'v.id').where('g.facility_id', '=', f.facilityId)))
      .orderBy('v.invoice_date', 'desc')
      .limit(200);
    if (f.status) q = q.where('v.status', '=', f.status);
    return q.execute();
  });
}

export async function listRequisitions(db: Kysely<DB>, caller: Caller, f: { facilityId: string; storeId?: string | undefined; status?: string | undefined }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let q = tx
      .selectFrom('inventory.requisition as r')
      .innerJoin('inventory.store as a', 'a.id', 'r.requesting_store_id')
      .innerJoin('inventory.store as b', 'b.id', 'r.supplying_store_id')
      .leftJoin('platform.staff as s', 's.id', 'r.requested_by')
      .select(['r.id', 'r.indent_no', 'r.status', 'r.note', 'r.requested_at', 'r.requested_by', 's.display_name as requested_by_name', 'r.requesting_store_id', 'a.name as requesting_store', 'r.supplying_store_id', 'b.name as supplying_store'])
      .where('r.facility_id', '=', f.facilityId)
      .orderBy('r.requested_at', 'desc')
      .limit(200);
    if (f.storeId) q = q.where((eb) => eb.or([eb('r.requesting_store_id', '=', f.storeId!), eb('r.supplying_store_id', '=', f.storeId!)]));
    if (f.status) q = q.where('r.status', '=', f.status);
    const reqs = await q.execute();
    const lines = reqs.length
      ? await tx
          .selectFrom('inventory.requisition_line as l')
          .innerJoin('inventory.item as i', 'i.id', 'l.item_id')
          .select(['l.id', 'l.requisition_id', 'l.item_id', 'i.name as item_name', 'i.base_uom', 'l.qty_requested', 'l.qty_approved', 'l.qty_issued'])
          .where('l.requisition_id', 'in', reqs.map((r) => r.id))
          .execute()
      : [];
    return reqs.map((r) => ({ ...r, lines: lines.filter((l) => l.requisition_id === r.id) }));
  });
}

export async function listTransfers(db: Kysely<DB>, caller: Caller, f: { facilityId: string; storeId?: string | undefined; status?: string | undefined }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let q = tx
      .selectFrom('inventory.stock_transfer as t')
      .innerJoin('inventory.store as a', 'a.id', 't.from_store_id')
      .innerJoin('inventory.store as b', 'b.id', 't.to_store_id')
      .leftJoin('inventory.requisition as r', 'r.id', 't.requisition_id')
      .select(['t.id', 't.transfer_no', 't.status', 't.dispatched_at', 't.received_at', 't.from_store_id', 'a.name as from_store', 't.to_store_id', 'b.name as to_store', 'r.indent_no'])
      .where('t.facility_id', '=', f.facilityId)
      .orderBy('t.dispatched_at', 'desc')
      .limit(200);
    if (f.storeId) q = q.where((eb) => eb.or([eb('t.from_store_id', '=', f.storeId!), eb('t.to_store_id', '=', f.storeId!)]));
    if (f.status) q = q.where('t.status', '=', f.status);
    const transfers = await q.execute();
    const lines = transfers.length
      ? await tx
          .selectFrom('inventory.stock_transfer_line as l')
          .innerJoin('inventory.item as i', 'i.id', 'l.item_id')
          .innerJoin('inventory.item_batch as ib', 'ib.id', 'l.item_batch_id')
          .select(['l.id', 'l.stock_transfer_id', 'i.name as item_name', 'i.base_uom', 'ib.batch_no', 'ib.expiry_date', 'l.qty_sent', 'l.qty_received', 'l.discrepancy_reason'])
          .where('l.stock_transfer_id', 'in', transfers.map((t) => t.id))
          .execute()
      : [];
    return transfers.map((t) => ({ ...t, lines: lines.filter((l) => l.stock_transfer_id === t.id) }));
  });
}

export async function listStockCounts(db: Kysely<DB>, caller: Caller, f: { facilityId: string }) {
  return runQuery(db, caller.tenantId, (tx) =>
    tx
      .selectFrom('inventory.stock_count as c')
      .innerJoin('inventory.store as st', 'st.id', 'c.store_id')
      .select(['c.id', 'c.count_no', 'c.status', 'c.store_id', 'st.name as store_name', 'c.created_at', 'c.counted_at', 'c.approved_at', 'c.submitted_by'])
      .where('c.facility_id', '=', f.facilityId)
      .orderBy('c.created_at', 'desc')
      .limit(100)
      .execute(),
  );
}

export async function getStockCount(db: Kysely<DB>, caller: Caller, stockCountId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const c = await tx.selectFrom('inventory.stock_count as c').innerJoin('inventory.store as st', 'st.id', 'c.store_id').select(['c.id', 'c.count_no', 'c.status', 'c.store_id', 'st.name as store_name', 'c.submitted_by', 'c.approved_at']).where('c.id', '=', stockCountId).executeTakeFirst();
    if (!c) throw notFound('stock count', { stockCountId });
    const lines = await tx
      .selectFrom('inventory.stock_count_line as l')
      .innerJoin('inventory.item as i', 'i.id', 'l.item_id')
      .innerJoin('inventory.item_batch as ib', 'ib.id', 'l.item_batch_id')
      .select(['l.id', 'l.item_id', 'i.name as item_name', 'i.base_uom', 'l.item_batch_id', 'ib.batch_no', 'ib.expiry_date', 'l.system_qty', 'l.counted_qty', 'l.note'])
      .where('l.stock_count_id', '=', c.id)
      .orderBy('i.name')
      .execute();
    return { ...c, lines };
  });
}
