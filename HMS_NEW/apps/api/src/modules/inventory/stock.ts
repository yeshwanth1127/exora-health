// Stock on the ledger (ERD m10): opening balances, departmental consumption, damage, expiry disposal and
// corrections; internal supply (indent → transfer → receipt); physical counts. Every change is movement
// rows — the balance follows by trigger and can never go below zero.
import type { DB, Kysely, Transaction } from '@hms/db';
import { conflict, forbidden, invalid, notFound, preconditionFailed, runCommand } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { activeItems, actor, assertInventoryActive, fefo, istDate, lockStore, nextNo, pad, postMovement, round3, stockError, type Pick } from './state.ts';

type Opt<T> = T | undefined;

export interface BatchInput {
  itemId: string;
  batchNo?: Opt<string>;
  expiryDate?: Opt<string>;
  manufacturedOn?: Opt<string>;
  mrpMinor?: Opt<number>;
  unitCostMinor?: Opt<number>;
  supplierId?: Opt<string | null>;
}

/** The batch for (item, batch no.), created on first sight; a known batch must agree on its expiry. */
export async function ensureBatch(tx: Transaction<DB>, tenantId: string, item: { is_batch_tracked: boolean; is_expiry_tracked: boolean; name: string }, b: BatchInput, at: Date, by: string) {
  const batchNo = item.is_batch_tracked ? b.batchNo?.trim() : 'NA';
  if (!batchNo) throw invalid(`${item.name} is batch-tracked; give the batch number`, { reason: 'batch_required', itemId: b.itemId });
  if (item.is_expiry_tracked && !b.expiryDate) throw invalid(`${item.name} needs an expiry date`, { reason: 'expiry_required', itemId: b.itemId });
  if (b.expiryDate && b.expiryDate < istDate(at)) throw preconditionFailed(`batch ${batchNo} of ${item.name} has already expired`, { reason: 'expired_on_arrival', itemId: b.itemId });
  const found = await tx.selectFrom('inventory.item_batch').select(['id', 'expiry_date', 'unit_cost_minor', 'mrp_minor']).where('item_id', '=', b.itemId).where('batch_no', '=', batchNo).executeTakeFirst();
  if (found) {
    if ((found.expiry_date ?? null) !== (b.expiryDate ?? found.expiry_date ?? null)) throw conflict(`batch ${batchNo} is on file with expiry ${found.expiry_date}`, { reason: 'batch_mismatch', itemId: b.itemId });
    return { id: found.id, unitCostMinor: b.unitCostMinor ?? found.unit_cost_minor };
  }
  const { id } = await tx
    .insertInto('inventory.item_batch')
    .values({
      tenant_id: tenantId,
      item_id: b.itemId,
      batch_no: batchNo,
      expiry_date: b.expiryDate ?? null,
      manufactured_on: b.manufacturedOn ?? null,
      mrp_minor: b.mrpMinor ?? null,
      unit_cost_minor: b.unitCostMinor ?? 0,
      supplier_id: b.supplierId ?? null,
      received_at: at,
      created_by: by,
      updated_by: by,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { id, unitCostMinor: b.unitCostMinor ?? 0 };
}

/** Registers serialised units received into a store (implants and other serial-tracked items). */
export async function registerSerials(tx: Transaction<DB>, tenantId: string, itemId: string, batchId: string, storeId: string, serials: string[], quantity: number, by: string) {
  if (serials.length !== quantity) throw invalid(`give one serial number per unit (${quantity})`, { reason: 'serials_mismatch', itemId });
  for (const s of serials) {
    await tx.insertInto('inventory.serial_unit').values({ tenant_id: tenantId, item_id: itemId, item_batch_id: batchId, serial_no: s, current_store_id: storeId, created_by: by, updated_by: by }).execute();
  }
}

async function newAdjustment(tx: Transaction<DB>, tenantId: string, store: { id: string; facility_id: string }, kind: string, reason: string, departmentId: string | null, at: Date, by: string) {
  const year = String(at.getUTCFullYear());
  const adjustmentNo = `ADJ/${year}/${pad(await nextNo(tx, 'stock_adjustment', store.facility_id, year))}`;
  const { id } = await tx
    .insertInto('inventory.stock_adjustment')
    .values({ tenant_id: tenantId, facility_id: store.facility_id, adjustment_no: adjustmentNo, store_id: store.id, kind, department_id: departmentId, reason, created_at: at, created_by: by })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { id, adjustmentNo };
}

// ---- opening stock ----------------------------------------------------------------------------------------

export interface OpeningLine extends BatchInput {
  quantity: number;
  serialNos?: Opt<string[]>;
}

/** Opening balances when a store goes live (or a found surplus with its batch details). */
export async function postOpeningStock(db: Kysely<DB>, caller: Caller, input: { storeId: string; reason?: Opt<string>; lines: OpeningLine[] }, idempotencyKey: string) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.post_opening_stock', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    const store = await lockStore(ctx.tx, input.storeId);
    const items = await activeItems(ctx.tx, [...new Set(input.lines.map((l) => l.itemId))]);
    const adj = await newAdjustment(ctx.tx, ctx.tenantId, store, 'opening', input.reason?.trim() || 'opening balance', null, now, me);
    for (const l of input.lines) {
      const item = items.get(l.itemId)!;
      const batch = await ensureBatch(ctx.tx, ctx.tenantId, item, l, now, me);
      if (item.is_serial_tracked) await registerSerials(ctx.tx, ctx.tenantId, l.itemId, batch.id, store.id, l.serialNos ?? [], l.quantity, me);
      await postMovement(ctx.tx, ctx.tenantId, { storeId: store.id, itemId: l.itemId, batchId: batch.id, type: 'opening', quantity: l.quantity, unitCostMinor: batch.unitCostMinor, at: now, by: me, source: { adjustment_id: adj.id } });
    }
    ctx.audit({ action: 'create', subjectType: 'inventory.stock_adjustment', subjectId: adj.id, diff: { kind: 'opening', storeId: store.id, lines: input.lines.length } });
    return { adjustmentId: adj.id, adjustmentNo: adj.adjustmentNo };
  }).catch(stockError);
}

// ---- consumption, damage, disposal, corrections -------------------------------------------------------------

export interface AdjustLine {
  itemId: string;
  batchId?: Opt<string>;
  quantity: number;
}

const OUTWARD: Record<string, string> = { consumption: 'consumption', damage: 'damage', expiry_disposal: 'expiry_disposal' };

/**
 * Stock leaving a store other than to a patient or another store. Consumption picks FEFO unless a batch is
 * named; damage and expiry disposal name the batch; a correction ('adjustment') is signed and names the batch.
 */
export async function adjustStock(
  db: Kysely<DB>,
  caller: Caller,
  input: { storeId: string; kind: 'consumption' | 'damage' | 'expiry_disposal' | 'adjustment'; reason: string; departmentId?: Opt<string>; lines: AdjustLine[] },
  idempotencyKey: string,
) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.adjust_stock', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    const store = await lockStore(ctx.tx, input.storeId);
    await activeItems(ctx.tx, [...new Set(input.lines.map((l) => l.itemId))]);
    const adj = await newAdjustment(ctx.tx, ctx.tenantId, store, input.kind, input.reason.trim(), input.departmentId ?? null, now, me);
    const moved: { itemId: string; batchId: string; quantity: number }[] = [];
    for (const l of input.lines) {
      if (input.kind !== 'adjustment' && l.quantity <= 0) throw invalid('give the quantity that left the store as a positive number', { reason: 'quantity' });
      let picks: Pick[];
      if (l.batchId) {
        const b = await ctx.tx.selectFrom('inventory.item_batch').select(['id', 'item_id', 'unit_cost_minor', 'batch_no', 'expiry_date', 'mrp_minor']).where('id', '=', l.batchId).executeTakeFirst();
        if (!b || b.item_id !== l.itemId) throw notFound('batch of this item', { batchId: l.batchId });
        picks = [{ batchId: b.id, batchNo: b.batch_no, expiryDate: b.expiry_date as string | null, quantity: l.quantity, unitCostMinor: b.unit_cost_minor, mrpMinor: b.mrp_minor }];
      } else if (input.kind === 'consumption') picks = await fefo(ctx.tx, store.id, l.itemId, l.quantity, now);
      else throw invalid('name the batch', { reason: 'batch_required', itemId: l.itemId });
      for (const p of picks) {
        const quantity = OUTWARD[input.kind] ? -p.quantity : p.quantity;
        await postMovement(ctx.tx, ctx.tenantId, { storeId: store.id, itemId: l.itemId, batchId: p.batchId, type: input.kind, quantity, unitCostMinor: p.unitCostMinor, at: now, by: me, source: { adjustment_id: adj.id } });
        moved.push({ itemId: l.itemId, batchId: p.batchId, quantity });
      }
    }
    ctx.audit({ action: 'create', subjectType: 'inventory.stock_adjustment', subjectId: adj.id, reason: input.reason, diff: { kind: input.kind, storeId: store.id, moved } });
    ctx.emit({ eventType: 'inventory.stock_adjusted', aggregateType: 'inventory.stock_adjustment', aggregateId: adj.id, payload: { adjustmentId: adj.id, kind: input.kind, storeId: store.id, departmentId: input.departmentId ?? null, moved } });
    return { adjustmentId: adj.id, adjustmentNo: adj.adjustmentNo, moved };
  }).catch(stockError);
}

// ---- indents (requisitions) ---------------------------------------------------------------------------------

export async function createRequisition(
  db: Kysely<DB>,
  caller: Caller,
  input: { requestingStoreId: string; supplyingStoreId: string; note?: Opt<string>; lines: { itemId: string; quantity: number }[] },
  idempotencyKey: string,
) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.create_requisition', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    if (input.requestingStoreId === input.supplyingStoreId) throw invalid('a store cannot indent from itself', { reason: 'same_store' });
    const from = await lockStore(ctx.tx, input.requestingStoreId);
    const to = await lockStore(ctx.tx, input.supplyingStoreId);
    if (from.facility_id !== to.facility_id) throw invalid('indents stay within one clinic', { reason: 'other_facility' });
    const ids = input.lines.map((l) => l.itemId);
    if (new Set(ids).size !== ids.length) throw invalid('list each item once', { reason: 'duplicate_item' });
    await activeItems(ctx.tx, ids);
    const year = String(now.getUTCFullYear());
    const indentNo = `IND/${year}/${pad(await nextNo(ctx.tx, 'indent', from.facility_id, year))}`;
    const { id } = await ctx.tx
      .insertInto('inventory.requisition')
      .values({ tenant_id: ctx.tenantId, facility_id: from.facility_id, indent_no: indentNo, requesting_store_id: from.id, supplying_store_id: to.id, note: input.note?.trim() || null, requested_by: me, requested_at: now, created_by: me, updated_by: me })
      .returning('id')
      .executeTakeFirstOrThrow();
    await ctx.tx.insertInto('inventory.requisition_line').values(input.lines.map((l) => ({ tenant_id: ctx.tenantId, requisition_id: id, item_id: l.itemId, qty_requested: l.quantity, created_by: me, updated_by: me }))).execute();
    ctx.audit({ action: 'create', subjectType: 'inventory.requisition', subjectId: id, diff: { indentNo, lines: input.lines } });
    ctx.emit({ eventType: 'inventory.indent_raised', aggregateType: 'inventory.requisition', aggregateId: id, payload: { requisitionId: id, indentNo, requestingStoreId: from.id, supplyingStoreId: to.id } });
    return { requisitionId: id, indentNo, status: 'submitted' };
  }).catch(stockError);
}

/** Approves an indent, optionally cutting quantities (0 drops a line). The requester can't approve their own. */
export async function approveRequisition(db: Kysely<DB>, caller: Caller, input: { requisitionId: string; lines?: Opt<{ lineId: string; quantity: number }[]> }) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.approve_requisition' }, async (ctx) => {
    const me = actor(ctx);
    const r = await ctx.tx.selectFrom('inventory.requisition').select(['id', 'status', 'requested_by']).where('id', '=', input.requisitionId).forUpdate().executeTakeFirst();
    if (!r) throw notFound('indent', { requisitionId: input.requisitionId });
    if (r.status !== 'submitted') throw preconditionFailed(`this indent is ${r.status}`, { reason: 'not_submitted' });
    if (r.requested_by === me) throw forbidden('someone other than the requester approves an indent', { reason: 'own_request' });
    const lines = await ctx.tx.selectFrom('inventory.requisition_line').select(['id', 'qty_requested']).where('requisition_id', '=', r.id).execute();
    const cut = new Map((input.lines ?? []).map((l) => [l.lineId, l.quantity]));
    for (const id of cut.keys()) if (!lines.some((l) => l.id === id)) throw notFound('indent line', { lineId: id });
    for (const l of lines) {
      const q = cut.get(l.id) ?? Number(l.qty_requested);
      if (q > Number(l.qty_requested)) throw invalid('approve no more than was requested', { reason: 'over_approval', lineId: l.id });
      await ctx.tx.updateTable('inventory.requisition_line').set({ qty_approved: q, updated_by: me }).where('id', '=', l.id).execute();
    }
    await ctx.tx.updateTable('inventory.requisition').set({ status: 'approved', approved_by: me, approved_at: now, updated_by: me }).where('id', '=', r.id).execute();
    ctx.audit({ action: 'update', subjectType: 'inventory.requisition', subjectId: r.id, diff: { status: 'approved', cuts: input.lines ?? [] } });
    return { requisitionId: r.id, status: 'approved' };
  }).catch(stockError);
}

export async function cancelRequisition(db: Kysely<DB>, caller: Caller, input: { requisitionId: string; reason: string }) {
  await assertInventoryActive(db, caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.cancel_requisition' }, async (ctx) => {
    const me = actor(ctx);
    const r = await ctx.tx.selectFrom('inventory.requisition').select(['id', 'status']).where('id', '=', input.requisitionId).forUpdate().executeTakeFirst();
    if (!r) throw notFound('indent', { requisitionId: input.requisitionId });
    if (!['draft', 'submitted', 'approved'].includes(r.status)) throw preconditionFailed(`a ${r.status.replace('_', ' ')} indent can't be cancelled`, { reason: 'already_issued' });
    await ctx.tx.updateTable('inventory.requisition').set({ status: 'cancelled', cancel_reason: input.reason.trim(), updated_by: me }).where('id', '=', r.id).execute();
    ctx.audit({ action: 'update', subjectType: 'inventory.requisition', subjectId: r.id, reason: input.reason, diff: { status: 'cancelled' } });
    return { requisitionId: r.id, status: 'cancelled' };
  }).catch(stockError);
}

// ---- transfers ----------------------------------------------------------------------------------------------

/**
 * Dispatches stock to another store of the clinic, FEFO from the sending store. Against an indent, the
 * stores come from the indent and each line is capped at what is approved and not yet issued.
 */
export async function dispatchTransfer(
  db: Kysely<DB>,
  caller: Caller,
  input: { fromStoreId?: Opt<string>; toStoreId?: Opt<string>; requisitionId?: Opt<string>; lines: { itemId: string; quantity: number }[] },
  idempotencyKey: string,
) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.dispatch_transfer', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    let fromId = input.fromStoreId;
    let toId = input.toStoreId;
    let reqLines = new Map<string, { id: string; open: number }>();
    if (input.requisitionId) {
      const r = await ctx.tx.selectFrom('inventory.requisition').select(['id', 'status', 'requesting_store_id', 'supplying_store_id']).where('id', '=', input.requisitionId).forUpdate().executeTakeFirst();
      if (!r) throw notFound('indent', { requisitionId: input.requisitionId });
      if (!['approved', 'partially_issued'].includes(r.status)) throw preconditionFailed(`this indent is ${r.status.replace('_', ' ')}`, { reason: 'not_approved' });
      if ((fromId && fromId !== r.supplying_store_id) || (toId && toId !== r.requesting_store_id)) throw invalid('the stores must match the indent', { reason: 'store_mismatch' });
      fromId = r.supplying_store_id;
      toId = r.requesting_store_id;
      const rl = await ctx.tx.selectFrom('inventory.requisition_line').select(['id', 'item_id', 'qty_approved', 'qty_issued']).where('requisition_id', '=', r.id).forUpdate().execute();
      reqLines = new Map(rl.map((l) => [l.item_id, { id: l.id, open: round3(Number(l.qty_approved ?? 0) - Number(l.qty_issued)) }]));
    }
    if (!fromId || !toId) throw invalid('name the sending and receiving stores, or the indent', { reason: 'stores_required' });
    if (fromId === toId) throw invalid('a store cannot transfer to itself', { reason: 'same_store' });
    const from = await lockStore(ctx.tx, fromId);
    const to = await lockStore(ctx.tx, toId);
    if (from.facility_id !== to.facility_id) throw invalid('transfers stay within one clinic', { reason: 'other_facility' });
    await activeItems(ctx.tx, [...new Set(input.lines.map((l) => l.itemId))]);

    const year = String(now.getUTCFullYear());
    const transferNo = `TRF/${year}/${pad(await nextNo(ctx.tx, 'transfer', from.facility_id, year))}`;
    const { id } = await ctx.tx
      .insertInto('inventory.stock_transfer')
      .values({ tenant_id: ctx.tenantId, facility_id: from.facility_id, transfer_no: transferNo, requisition_id: input.requisitionId ?? null, from_store_id: from.id, to_store_id: to.id, dispatched_at: now, dispatched_by: me, created_by: me, updated_by: me })
      .returning('id')
      .executeTakeFirstOrThrow();
    const sent: { itemId: string; batchId: string; batchNo: string; quantity: number }[] = [];
    for (const l of input.lines) {
      const req = reqLines.get(l.itemId);
      if (input.requisitionId) {
        if (!req) throw invalid('that item is not on the indent', { reason: 'not_on_indent', itemId: l.itemId });
        if (l.quantity > req.open) throw invalid(`only ${req.open} is approved and not yet issued`, { reason: 'over_issue', itemId: l.itemId });
      }
      for (const p of await fefo(ctx.tx, from.id, l.itemId, l.quantity, now)) {
        const { id: lineId } = await ctx.tx
          .insertInto('inventory.stock_transfer_line')
          .values({ tenant_id: ctx.tenantId, stock_transfer_id: id, requisition_line_id: req?.id ?? null, item_id: l.itemId, item_batch_id: p.batchId, qty_sent: p.quantity, created_by: me, updated_by: me })
          .returning('id')
          .executeTakeFirstOrThrow();
        await postMovement(ctx.tx, ctx.tenantId, { storeId: from.id, itemId: l.itemId, batchId: p.batchId, type: 'transfer_out', quantity: -p.quantity, unitCostMinor: p.unitCostMinor, at: now, by: me, source: { transfer_line_id: lineId } });
        sent.push({ itemId: l.itemId, batchId: p.batchId, batchNo: p.batchNo, quantity: p.quantity });
      }
      if (req) await ctx.tx.updateTable('inventory.requisition_line').set((eb) => ({ qty_issued: eb('qty_issued', '+', String(l.quantity)), updated_by: me })).where('id', '=', req.id).execute();
    }
    if (input.requisitionId) {
      const open = await ctx.tx.selectFrom('inventory.requisition_line').select('id').where('requisition_id', '=', input.requisitionId).whereRef('qty_issued', '<', 'qty_approved').executeTakeFirst();
      await ctx.tx.updateTable('inventory.requisition').set({ status: open ? 'partially_issued' : 'issued', updated_by: me }).where('id', '=', input.requisitionId).where('status', '<>', open ? 'partially_issued' : 'issued').execute();
    }
    ctx.audit({ action: 'create', subjectType: 'inventory.stock_transfer', subjectId: id, diff: { transferNo, from: from.id, to: to.id, sent } });
    ctx.emit({ eventType: 'inventory.transfer_dispatched', aggregateType: 'inventory.stock_transfer', aggregateId: id, payload: { transferId: id, transferNo, fromStoreId: from.id, toStoreId: to.id } });
    return { transferId: id, transferNo, status: 'in_transit', lines: sent };
  }).catch(stockError);
}

/** The receiving store confirms what arrived; anything short needs a reason (it stays written off in transit). */
export async function receiveTransfer(db: Kysely<DB>, caller: Caller, input: { transferId: string; lines?: Opt<{ lineId: string; quantity: number; reason?: Opt<string> }[]> }) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.receive_transfer' }, async (ctx) => {
    const me = actor(ctx);
    const t = await ctx.tx.selectFrom('inventory.stock_transfer').select(['id', 'status', 'to_store_id']).where('id', '=', input.transferId).forUpdate().executeTakeFirst();
    if (!t) throw notFound('transfer', { transferId: input.transferId });
    if (t.status !== 'in_transit') throw preconditionFailed('this transfer was already received', { reason: 'already_received' });
    const lines = await ctx.tx
      .selectFrom('inventory.stock_transfer_line as l')
      .innerJoin('inventory.item_batch as b', 'b.id', 'l.item_batch_id')
      .select(['l.id', 'l.item_id', 'l.item_batch_id', 'l.qty_sent', 'b.unit_cost_minor'])
      .where('l.stock_transfer_id', '=', t.id)
      .execute();
    const given = new Map((input.lines ?? []).map((l) => [l.lineId, l]));
    for (const id of given.keys()) if (!lines.some((l) => l.id === id)) throw notFound('transfer line', { lineId: id });
    let short = false;
    for (const l of lines) {
      const g = given.get(l.id);
      const q = g?.quantity ?? Number(l.qty_sent);
      if (q > Number(l.qty_sent)) throw invalid('more received than was sent', { reason: 'over_receipt', lineId: l.id });
      if (q < Number(l.qty_sent)) {
        if (!g?.reason?.trim()) throw invalid('say why less arrived than was sent', { reason: 'discrepancy_reason_required', lineId: l.id });
        short = true;
      }
      await ctx.tx.updateTable('inventory.stock_transfer_line').set({ qty_received: q, discrepancy_reason: g?.reason?.trim() || null, updated_by: me }).where('id', '=', l.id).execute();
      if (q > 0) await postMovement(ctx.tx, ctx.tenantId, { storeId: t.to_store_id, itemId: l.item_id, batchId: l.item_batch_id, type: 'transfer_in', quantity: q, unitCostMinor: l.unit_cost_minor, at: now, by: me, source: { transfer_line_id: l.id } });
    }
    const status = short ? 'partially_received' : 'received';
    await ctx.tx.updateTable('inventory.stock_transfer').set({ status, received_at: now, received_by: me, updated_by: me }).where('id', '=', t.id).execute();
    ctx.audit({ action: 'update', subjectType: 'inventory.stock_transfer', subjectId: t.id, diff: { status, lines: input.lines ?? 'all' } });
    return { transferId: t.id, status };
  }).catch(stockError);
}

// ---- stock counts -------------------------------------------------------------------------------------------

/** Opens a count for a store: one line per batch in stock, with the system quantity at this moment. */
export async function openStockCount(db: Kysely<DB>, caller: Caller, input: { storeId: string }, idempotencyKey: string) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.open_stock_count', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    const store = await lockStore(ctx.tx, input.storeId);
    const year = String(now.getUTCFullYear());
    const countNo = `CNT/${year}/${pad(await nextNo(ctx.tx, 'stock_count', store.facility_id, year))}`;
    const { id } = await ctx.tx
      .insertInto('inventory.stock_count')
      .values({ tenant_id: ctx.tenantId, facility_id: store.facility_id, count_no: countNo, store_id: store.id, opened_by: me, created_by: me, updated_by: me })
      .returning('id')
      .executeTakeFirstOrThrow();
    const balances = await ctx.tx.selectFrom('inventory.stock_balance').select(['item_id', 'item_batch_id', 'on_hand']).where('store_id', '=', store.id).where('on_hand', '>', '0').execute();
    if (balances.length) {
      await ctx.tx
        .insertInto('inventory.stock_count_line')
        .values(balances.map((b) => ({ tenant_id: ctx.tenantId, stock_count_id: id, item_id: b.item_id, item_batch_id: b.item_batch_id, system_qty: b.on_hand, created_by: me, updated_by: me })))
        .execute();
    }
    ctx.audit({ action: 'create', subjectType: 'inventory.stock_count', subjectId: id, diff: { countNo, storeId: store.id, lines: balances.length } });
    return { stockCountId: id, countNo, lines: balances.length };
  }).catch(stockError);
}

/** Records counted quantities; a batch found on the shelf but not on the sheet is added (system 0 or its balance). */
export async function recordStockCount(db: Kysely<DB>, caller: Caller, input: { stockCountId: string; lines: { lineId?: Opt<string>; batchId?: Opt<string>; countedQty: number; note?: Opt<string> }[] }) {
  await assertInventoryActive(db, caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.record_stock_count' }, async (ctx) => {
    const me = actor(ctx);
    const c = await ctx.tx.selectFrom('inventory.stock_count').select(['id', 'status', 'store_id']).where('id', '=', input.stockCountId).forUpdate().executeTakeFirst();
    if (!c) throw notFound('stock count', { stockCountId: input.stockCountId });
    if (c.status !== 'open') throw preconditionFailed('this count was submitted', { reason: 'not_open' });
    for (const l of input.lines) {
      const note = l.note?.trim() || null;
      if (l.lineId) {
        const r = await ctx.tx.updateTable('inventory.stock_count_line').set({ counted_qty: l.countedQty, note, updated_by: me }).where('id', '=', l.lineId).where('stock_count_id', '=', c.id).executeTakeFirst();
        if (!r.numUpdatedRows) throw notFound('count line', { lineId: l.lineId });
      } else if (l.batchId) {
        const b = await ctx.tx.selectFrom('inventory.item_batch').select(['id', 'item_id']).where('id', '=', l.batchId).executeTakeFirst();
        if (!b) throw notFound('batch', { batchId: l.batchId });
        const bal = await ctx.tx.selectFrom('inventory.stock_balance').select('on_hand').where('store_id', '=', c.store_id).where('item_batch_id', '=', b.id).executeTakeFirst();
        await ctx.tx
          .insertInto('inventory.stock_count_line')
          .values({ tenant_id: ctx.tenantId, stock_count_id: c.id, item_id: b.item_id, item_batch_id: b.id, system_qty: bal?.on_hand ?? 0, counted_qty: l.countedQty, note, created_by: me, updated_by: me })
          .onConflict((oc) => oc.columns(['tenant_id', 'stock_count_id', 'item_batch_id']).doUpdateSet({ counted_qty: l.countedQty, note, updated_by: me }))
          .execute();
      } else throw invalid('each line names a count line or a batch', { reason: 'line_required' });
    }
    await ctx.tx.updateTable('inventory.stock_count').set({ updated_by: me }).where('id', '=', c.id).execute();
    return { stockCountId: c.id, recorded: input.lines.length };
  }).catch(stockError);
}

export async function submitStockCount(db: Kysely<DB>, caller: Caller, input: { stockCountId: string }) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.submit_stock_count' }, async (ctx) => {
    const me = actor(ctx);
    const c = await ctx.tx.selectFrom('inventory.stock_count').select(['id', 'status']).where('id', '=', input.stockCountId).forUpdate().executeTakeFirst();
    if (!c) throw notFound('stock count', { stockCountId: input.stockCountId });
    if (c.status !== 'open') throw preconditionFailed('this count was already submitted', { reason: 'not_open' });
    const uncounted = await ctx.tx.selectFrom('inventory.stock_count_line').select((eb) => eb.fn.countAll<number>().as('n')).where('stock_count_id', '=', c.id).where('counted_qty', 'is', null).executeTakeFirstOrThrow();
    if (Number(uncounted.n)) throw preconditionFailed(`${uncounted.n} line(s) are not counted yet`, { reason: 'uncounted_lines' });
    await ctx.tx.updateTable('inventory.stock_count').set({ status: 'submitted', submitted_by: me, counted_at: now, updated_by: me }).where('id', '=', c.id).execute();
    ctx.audit({ action: 'update', subjectType: 'inventory.stock_count', subjectId: c.id, diff: { status: 'submitted' } });
    return { stockCountId: c.id, status: 'submitted' };
  }).catch(stockError);
}

/**
 * Approves a submitted count (not by whoever submitted it): each difference becomes an adjustment movement.
 * Refused if a counted batch moved since the count opened — recount it. `reject` sends it back to open.
 */
export async function approveStockCount(db: Kysely<DB>, caller: Caller, input: { stockCountId: string; reject?: Opt<boolean> }) {
  await assertInventoryActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inventory', name: 'inventory.approve_stock_count' }, async (ctx) => {
    const me = actor(ctx);
    const c = await ctx.tx.selectFrom('inventory.stock_count').select(['id', 'status', 'store_id', 'submitted_by', 'count_no']).where('id', '=', input.stockCountId).forUpdate().executeTakeFirst();
    if (!c) throw notFound('stock count', { stockCountId: input.stockCountId });
    if (c.status !== 'submitted') throw preconditionFailed(`this count is ${c.status}`, { reason: 'not_submitted' });
    if (c.submitted_by === me) throw forbidden('someone other than the counter approves the variance', { reason: 'own_count' });
    if (input.reject) {
      await ctx.tx.updateTable('inventory.stock_count').set({ status: 'open', submitted_by: null, counted_at: null, updated_by: me }).where('id', '=', c.id).execute();
      ctx.audit({ action: 'update', subjectType: 'inventory.stock_count', subjectId: c.id, diff: { status: 'open', rejected: true } });
      return { stockCountId: c.id, status: 'open', adjusted: [] };
    }
    const lines = await ctx.tx
      .selectFrom('inventory.stock_count_line as l')
      .innerJoin('inventory.item_batch as b', 'b.id', 'l.item_batch_id')
      .select(['l.id', 'l.item_id', 'l.item_batch_id', 'l.system_qty', 'l.counted_qty', 'b.unit_cost_minor'])
      .where('l.stock_count_id', '=', c.id)
      .execute();
    const held = lines.length
      ? await ctx.tx.selectFrom('inventory.stock_balance').select(['item_batch_id', 'on_hand']).where('store_id', '=', c.store_id).where('item_batch_id', 'in', lines.map((l) => l.item_batch_id)).forUpdate().execute()
      : [];
    const onHand = new Map(held.map((h) => [h.item_batch_id, Number(h.on_hand)]));
    const moved = lines.filter((l) => (onHand.get(l.item_batch_id) ?? 0) !== Number(l.system_qty)).map((l) => l.item_batch_id);
    if (moved.length) throw conflict('stock moved since the count opened; recount those batches', { reason: 'stock_moved', batchIds: moved });
    const adjusted: { batchId: string; quantity: number }[] = [];
    for (const l of lines) {
      const diff = round3(Number(l.counted_qty) - Number(l.system_qty));
      if (!diff) continue;
      await postMovement(ctx.tx, ctx.tenantId, { storeId: c.store_id, itemId: l.item_id, batchId: l.item_batch_id, type: 'adjustment', quantity: diff, unitCostMinor: l.unit_cost_minor, at: now, by: me, source: { count_line_id: l.id } });
      adjusted.push({ batchId: l.item_batch_id, quantity: diff });
    }
    await ctx.tx.updateTable('inventory.stock_count').set({ status: 'approved', approved_by: me, approved_at: now, updated_by: me }).where('id', '=', c.id).execute();
    ctx.audit({ action: 'update', subjectType: 'inventory.stock_count', subjectId: c.id, diff: { status: 'approved', adjusted } });
    ctx.emit({ eventType: 'inventory.count_approved', aggregateType: 'inventory.stock_count', aggregateId: c.id, payload: { stockCountId: c.id, countNo: c.count_no, storeId: c.store_id, adjusted } });
    return { stockCountId: c.id, status: 'approved', adjusted };
  }).catch(stockError);
}
