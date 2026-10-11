// Shared pieces of M10: the module switch, where a record lives (for authorization), database error
// mapping, and the two ways stock moves — a movement row on a chosen batch, or FEFO picks across batches.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, DomainError, forbidden, pgCode, preconditionFailed, runQuery } from '@hms/platform';
import { hospitalDay, type Caller } from '../../caller.ts';
import { assertModuleActive } from '../access/admin.ts';

export { nextNo, pad } from '../diagnostics/state.ts';

export const actor = (ctx: { actor: { staffId?: string | undefined } }): string => {
  if (!ctx.actor.staffId) throw forbidden('only staff can work with stock');
  return ctx.actor.staffId;
};

export const assertInventoryActive = (db: Kysely<DB>, caller: Caller) => assertModuleActive(db, caller, 'inventory');

/** The hospital day of an instant (expiry dates are calendar dates in IST). */
export const istDate = hospitalDay;

/** Turns the ledger's database refusals into API errors; anything else passes through. */
export function stockError(err: unknown): never {
  if (err instanceof DomainError) throw err;
  const e = err as { constraint?: string; hint?: string; message?: string };
  const code = pgCode(err);
  if (code === '23514' && (e.constraint === 'stock_balance_on_hand_check' || e.constraint === 'stock_balance_reserved_check')) throw conflict('not enough stock in this store', { reason: 'insufficient_stock' });
  if (code === '55000') throw preconditionFailed(e.message ?? 'not allowed in this state', { reason: e.hint ?? 'invalid_state' });
  if (code === '23505') throw conflict('that already exists', { reason: 'duplicate', constraint: e.constraint });
  if (code === '23503') throw new DomainError('not_found', 'a referenced record was not found', { reason: 'missing_reference', constraint: e.constraint });
  if (code === '23514') throw new DomainError('validation', 'the values break a stock rule', { reason: 'check_violation', constraint: e.constraint });
  throw err;
}

export type Kind = 'store' | 'purchase_order' | 'goods_receipt' | 'requisition' | 'stock_transfer' | 'stock_count' | 'item_batch';

/** Facility of an inventory record, for the route's permission check (a batch: any store holding it). */
export async function facilityOf(db: Kysely<DB>, caller: Caller, kind: Kind, id: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const q = {
      store: sql`SELECT facility_id FROM inventory.store WHERE id = ${id}`,
      purchase_order: sql`SELECT facility_id FROM inventory.purchase_order WHERE id = ${id}`,
      goods_receipt: sql`SELECT facility_id FROM inventory.goods_receipt WHERE id = ${id}`,
      requisition: sql`SELECT facility_id FROM inventory.requisition WHERE id = ${id}`,
      stock_transfer: sql`SELECT facility_id FROM inventory.stock_transfer WHERE id = ${id}`,
      stock_count: sql`SELECT facility_id FROM inventory.stock_count WHERE id = ${id}`,
      item_batch: sql`SELECT s.facility_id FROM inventory.stock_balance b JOIN inventory.store s ON s.id = b.store_id WHERE b.item_batch_id = ${id} ORDER BY b.on_hand DESC LIMIT 1`,
    }[kind];
    const { rows: [r] } = await sql<{ facility_id: string }>`${q}`.execute(tx);
    return r?.facility_id;
  });
}

export interface Movement {
  storeId: string;
  itemId: string;
  batchId: string;
  type: string;
  quantity: number;
  unitCostMinor: number;
  at: Date;
  by: string;
  patientId?: string | null;
  source: Partial<Record<'adjustment_id' | 'goods_receipt_line_id' | 'transfer_line_id' | 'count_line_id' | 'purchase_return_line_id', string>>;
}

export async function postMovement(tx: Transaction<DB>, tenantId: string, m: Movement) {
  await tx
    .insertInto('inventory.stock_movement')
    .values({
      tenant_id: tenantId,
      store_id: m.storeId,
      item_id: m.itemId,
      item_batch_id: m.batchId,
      movement_type: m.type,
      quantity: m.quantity,
      unit_cost_minor: m.unitCostMinor,
      occurred_at: m.at,
      actor_staff_id: m.by,
      patient_id: m.patientId ?? null,
      ...m.source,
    })
    .execute();
}

export interface Pick {
  batchId: string;
  batchNo: string;
  expiryDate: string | null;
  quantity: number;
  unitCostMinor: number;
  mrpMinor: number | null;
}

/**
 * First-expiry-first-out: takes `quantity` of an item from a store's usable batches (available, not
 * expired), earliest expiry first. Locks the balance rows it reads, so a concurrent issue waits and then
 * sees what is left; not enough left is a 409 insufficient_stock.
 */
export async function fefo(tx: Transaction<DB>, storeId: string, itemId: string, quantity: number, at: Date): Promise<Pick[]> {
  const rows = await tx
    .selectFrom('inventory.stock_balance as b')
    .innerJoin('inventory.item_batch as ib', 'ib.id', 'b.item_batch_id')
    .select(['b.item_batch_id', 'b.on_hand', 'ib.batch_no', 'ib.expiry_date', 'ib.unit_cost_minor', 'ib.mrp_minor'])
    .where('b.store_id', '=', storeId)
    .where('b.item_id', '=', itemId)
    .where('b.on_hand', '>', '0')
    .where('ib.status', '=', 'available')
    .where((eb) => eb.or([eb('ib.expiry_date', 'is', null), eb('ib.expiry_date', '>=', istDate(at))]))
    .orderBy(sql`ib.expiry_date NULLS LAST`)
    .orderBy('ib.received_at')
    .forUpdate('b')
    .execute();
  const picks: Pick[] = [];
  let left = quantity;
  for (const r of rows) {
    if (left <= 0) break;
    const take = Math.min(left, Number(r.on_hand));
    picks.push({ batchId: r.item_batch_id, batchNo: r.batch_no, expiryDate: r.expiry_date as string | null, quantity: take, unitCostMinor: r.unit_cost_minor, mrpMinor: r.mrp_minor });
    left = round3(left - take);
  }
  if (left > 0) throw conflict('not enough usable stock in this store', { reason: 'insufficient_stock', itemId, requested: quantity, available: round3(quantity - left) });
  return picks;
}

export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Item ids that exist and are active, else a 404 naming the missing ones. */
export async function activeItems(tx: Transaction<DB>, ids: string[]) {
  const rows = await tx.selectFrom('inventory.item').select(['id', 'name', 'status', 'is_batch_tracked', 'is_expiry_tracked', 'is_serial_tracked', 'base_uom']).where('id', 'in', ids).execute();
  const missing = ids.filter((id) => !rows.some((r) => r.id === id && r.status === 'active'));
  if (missing.length) throw new DomainError('not_found', 'item not found or inactive', { itemIds: missing });
  return new Map(rows.map((r) => [r.id, r]));
}

export async function lockStore(tx: Transaction<DB>, storeId: string) {
  const s = await tx.selectFrom('inventory.store').select(['id', 'facility_id', 'status', 'store_type', 'name']).where('id', '=', storeId).executeTakeFirst();
  if (!s) throw new DomainError('not_found', 'store not found', { storeId });
  if (s.status !== 'active') throw preconditionFailed(`${s.name} is inactive`, { reason: 'store_inactive' });
  return s;
}
