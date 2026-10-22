// Inventory reads: stores, items with stock on hand, a store's stock by batch, alerts (low stock, expiring
// soon, expired still on the shelf), suppliers, receipts and an item's ledger.
import { sql, type DB, type Kysely } from '@hms/db';
import { runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';

export async function storeFacility(db: Kysely<DB>, caller: Caller, storeId: string) {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('inventory.store').select('facility_id').where('id', '=', storeId).executeTakeFirst())?.facility_id);
}

export async function listStores(db: Kysely<DB>, caller: Caller, facilityId: string) {
  return runQuery(db, caller.tenantId, (tx) => tx.selectFrom('inventory.store').select(['id as storeId', 'code', 'name', 'store_type as storeType', 'drug_licence_no as drugLicenceNo', 'status', 'version'])
    .where('facility_id', '=', facilityId).orderBy('name').execute());
}

export async function listItems(db: Kysely<DB>, caller: Caller, q: { search?: string | undefined; itemType?: string | undefined; storeId?: string | undefined; limit: number }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<Record<string, unknown>>`
      SELECT i.id AS "itemId", i.code, i.name, i.item_type AS "itemType", i.base_uom AS "baseUom", i.pack_uom AS "packUom", i.pack_size::float AS "packSize",
             i.hsn_code AS "hsnCode", i.reorder_level::float AS "reorderLevel", i.status, i.version,
             d.generic_name AS "genericName", d.brand_name AS "brandName", d.strength, d.dosage_form AS "dosageForm",
             d.regulatory_schedule AS "regulatorySchedule", d.is_ndps AS "isNdps", d.is_high_alert AS "isHighAlert",
             coalesce((SELECT sum(b.on_hand) FROM inventory.stock_balance b JOIN inventory.item_batch ib ON ib.id = b.item_batch_id
                       WHERE b.item_id = i.id AND ib.status = 'available' AND (${q.storeId ?? null}::uuid IS NULL OR b.store_id = ${q.storeId ?? null}::uuid)), 0)::float AS "onHand"
      FROM inventory.item i LEFT JOIN inventory.drug_product d ON d.item_id = i.id
      WHERE i.deleted_at IS NULL
        AND (${q.itemType ?? null}::text IS NULL OR i.item_type = ${q.itemType ?? null})
        AND (${q.search ?? null}::text IS NULL OR lower(i.name) LIKE '%' || lower(${q.search ?? ''}) || '%' OR lower(d.generic_name) LIKE '%' || lower(${q.search ?? ''}) || '%'
             OR i.code = upper(${q.search ?? ''}))
      ORDER BY i.name LIMIT ${q.limit}`.execute(tx);
    return rows;
  });
}

export async function storeStock(db: Kysely<DB>, caller: Caller, q: { storeId: string; itemId?: string | undefined; includeEmpty?: boolean | undefined }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<Record<string, unknown>>`
      SELECT b.item_id AS "itemId", i.name AS "itemName", ib.id AS "itemBatchId", ib.batch_no AS "batchNo", ib.expiry_date::text AS "expiryDate",
             ib.mrp_minor AS "mrpMinor", ib.unit_cost_minor AS "unitCostMinor", ib.status, b.on_hand::float AS "onHand", ib.version
      FROM inventory.stock_balance b JOIN inventory.item_batch ib ON ib.id = b.item_batch_id JOIN inventory.item i ON i.id = b.item_id
      WHERE b.store_id = ${q.storeId} AND (${q.itemId ?? null}::uuid IS NULL OR b.item_id = ${q.itemId ?? null}::uuid)
        AND (${q.includeEmpty ?? false} OR b.on_hand > 0)
      ORDER BY i.name, ib.expiry_date NULLS LAST, ib.batch_no`.execute(tx);
    return rows;
  });
}

/** Low stock (available on hand below the item's reorder level), expiring within `days`, and expired on hand. */
export async function stockAlerts(db: Kysely<DB>, caller: Caller, q: { storeId: string; days: number }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows: low } = await sql<Record<string, unknown>>`
      SELECT i.id AS "itemId", i.name, i.reorder_level::float AS "reorderLevel",
             coalesce(sum(b.on_hand) FILTER (WHERE ib.status = 'available' AND (ib.expiry_date IS NULL OR ib.expiry_date >= current_date)), 0)::float AS "onHand"
      FROM inventory.item i
      LEFT JOIN inventory.stock_balance b ON b.item_id = i.id AND b.store_id = ${q.storeId}
      LEFT JOIN inventory.item_batch ib ON ib.id = b.item_batch_id
      WHERE i.status = 'active' AND i.reorder_level > 0
      GROUP BY i.id HAVING coalesce(sum(b.on_hand) FILTER (WHERE ib.status = 'available' AND (ib.expiry_date IS NULL OR ib.expiry_date >= current_date)), 0) < i.reorder_level
      ORDER BY i.name`.execute(tx);
    const { rows: expiring } = await sql<Record<string, unknown>>`
      SELECT i.id AS "itemId", i.name, ib.id AS "itemBatchId", ib.batch_no AS "batchNo", ib.expiry_date::text AS "expiryDate", b.on_hand::float AS "onHand",
             (ib.expiry_date < current_date) AS expired
      FROM inventory.stock_balance b JOIN inventory.item_batch ib ON ib.id = b.item_batch_id JOIN inventory.item i ON i.id = b.item_id
      WHERE b.store_id = ${q.storeId} AND b.on_hand > 0 AND ib.expiry_date IS NOT NULL AND ib.expiry_date < current_date + ${q.days}::int
      ORDER BY ib.expiry_date`.execute(tx);
    return { lowStock: low, expiring: expiring.filter((r) => !r['expired']), expired: expiring.filter((r) => r['expired']) };
  });
}

export async function listSuppliers(db: Kysely<DB>, caller: Caller) {
  return runQuery(db, caller.tenantId, (tx) => tx.selectFrom('inventory.supplier').select([
    'id as supplierId', 'code', 'name', 'gstin', 'state_code as stateCode', 'drug_licence_no as drugLicenceNo', 'phone', 'email', 'payment_terms_days as paymentTermsDays', 'status', 'version',
  ]).orderBy('name').execute());
}

export async function listReceipts(db: Kysely<DB>, caller: Caller, q: { storeId: string; limit: number }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<Record<string, unknown>>`
      SELECT g.id AS "goodsReceiptId", g.grn_no AS "grnNo", g.supplier_id AS "supplierId", s.name AS "supplierName", g.supplier_invoice_no AS "supplierInvoiceNo",
             g.supplier_invoice_on::text AS "supplierInvoiceOn", g.invoice_total_minor AS "invoiceTotalMinor", g.received_at AS "receivedAt",
             (SELECT count(*) FROM inventory.goods_receipt_line l WHERE l.goods_receipt_id = g.id)::int AS lines,
             (SELECT coalesce(sum(round(l.qty_received * l.unit_cost_minor * (1 + l.gst_rate_bp / 10000.0))), 0) FROM inventory.goods_receipt_line l WHERE l.goods_receipt_id = g.id)::bigint AS "computedTotalMinor"
      FROM inventory.goods_receipt g JOIN inventory.supplier s ON s.id = g.supplier_id
      WHERE g.store_id = ${q.storeId} ORDER BY g.received_at DESC LIMIT ${q.limit}`.execute(tx);
    return rows.map((r) => ({ ...r, computedTotalMinor: Number(r['computedTotalMinor']) }));
  });
}

export async function itemLedger(db: Kysely<DB>, caller: Caller, q: { storeId: string; itemId: string; limit: number }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<Record<string, unknown>>`
      SELECT m.id AS "movementId", m.occurred_at AS "occurredAt", m.movement_type AS "movementType", m.quantity::float AS quantity, ib.batch_no AS "batchNo",
             m.patient_id AS "patientId", m.actor_staff_id AS "actorStaffId",
             coalesce(a.adjustment_no, g.grn_no, d.dispense_no) AS "documentNo"
      FROM inventory.stock_movement m JOIN inventory.item_batch ib ON ib.id = m.item_batch_id
      LEFT JOIN inventory.stock_adjustment a ON a.id = m.adjustment_id
      LEFT JOIN inventory.goods_receipt_line gl ON gl.id = m.goods_receipt_line_id LEFT JOIN inventory.goods_receipt g ON g.id = gl.goods_receipt_id
      LEFT JOIN pharmacy.dispense_line dl ON dl.id = m.dispense_line_id LEFT JOIN pharmacy.dispense d ON d.id = dl.dispense_id
      WHERE m.store_id = ${q.storeId} AND m.item_id = ${q.itemId}
      ORDER BY m.occurred_at DESC, m.id DESC LIMIT ${q.limit}`.execute(tx);
    return rows;
  });
}
