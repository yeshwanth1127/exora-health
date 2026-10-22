// Dispensing: against a signed prescription, against a ward indent for an admitted patient, or over the
// counter to a walk-in buyer (no Schedule H/H1/X or NDPS drugs without a prescription). Batches are
// picked first-expiry-first-out unless the pharmacist names one; a line may draw on several batches. The
// selling price is the price list's rule for the item (MRP less a discount) or the MRP, never above it.
// Stock leaves through inventory.post_patient_movement in the same transaction; billing charges each line
// from the dispense.completed event.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, preconditionFailed, runCommand, type CommandContext } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { docNo, stockError } from '../inventory/stock.ts';

const RESTRICTED = ['H', 'H1', 'X'];

export interface DispenseLineInput {
  /** Prescription dispensing: the line being filled. */
  prescriptionItemId?: string | undefined;
  /** Indent dispensing: the line being filled. */
  indentLineId?: string | undefined;
  /** Over the counter (or a substitute for a prescribed drug): the item sold. */
  itemId?: string | undefined;
  quantity: number;
  /** A specific batch; otherwise first-expiry-first-out. */
  itemBatchId?: string | undefined;
}

export interface DispenseInput {
  storeId: string;
  prescriptionId?: string | undefined;
  indentId?: string | undefined;
  otc?: { patientId?: string | undefined; buyerName?: string | undefined; buyerPhone?: string | undefined } | undefined;
  handedOverTo?: string | undefined;
  lines: DispenseLineInput[];
}

/** Price per base unit for a batch of an item on a date: price-list rule, else MRP. */
async function sellingPrice(tx: Transaction<DB>, itemId: string, mrp: number | null, unitCost: number, on: string) {
  const { rows: [rule] } = await sql<{ id: string; unit_price_minor: number | null; item_pricing_method: string | null; percent_bp: number | null }>`
    SELECT pli.id, pli.unit_price_minor, pli.item_pricing_method, pli.percent_bp FROM catalog.price_list_item pli
    JOIN catalog.price_list pl ON pl.id = pli.price_list_id AND pl.status = 'active' AND pl.is_default
    WHERE pli.item_id = ${itemId} AND pli.valid_from <= ${on}::date AND (pli.valid_to IS NULL OR pli.valid_to > ${on}::date) LIMIT 1`.execute(tx);
  let price = mrp;
  if (rule?.unit_price_minor !== null && rule?.unit_price_minor !== undefined) price = rule.unit_price_minor;
  else if (rule?.item_pricing_method === 'mrp_less_discount' && mrp !== null) price = Math.round(mrp * (1 - (rule.percent_bp ?? 0) / 10_000));
  else if (rule?.item_pricing_method === 'cost_plus_markup') price = Math.round(unitCost * (1 + (rule.percent_bp ?? 0) / 10_000));
  if (price === null) throw preconditionFailed('this batch has no MRP and the item no price; set one before selling', { reason: 'price_missing', itemId });
  return { unitPriceMinor: mrp !== null ? Math.min(price, mrp) : price, priceListItemId: rule?.id ?? null };
}

/** Batches to draw `quantity` from: the named one, or available unexpired ones earliest expiry first. */
async function pickBatches(tx: Transaction<DB>, storeId: string, itemId: string, quantity: number, batchId: string | undefined, today: string) {
  const rows = await tx.selectFrom('inventory.stock_balance as b').innerJoin('inventory.item_batch as ib', 'ib.id', 'b.item_batch_id')
    .select(['ib.id', 'ib.mrp_minor', 'ib.unit_cost_minor', 'ib.expiry_date', 'b.on_hand'])
    .where('b.store_id', '=', storeId).where('b.item_id', '=', itemId).where('b.on_hand', '>', 0 as never)
    .where('ib.status', '=', 'available').where((eb) => eb.or([eb('ib.expiry_date', 'is', null), eb('ib.expiry_date', '>=', today)]))
    .$if(!!batchId, (q) => q.where('ib.id', '=', batchId!))
    // No row lock here (pharmacy can't write balances): the movement trigger's balance update serializes
    // concurrent issues and on_hand >= 0 refuses taking units twice.
    .orderBy('ib.expiry_date').orderBy('ib.received_at').execute();
  const picks: { batchId: string; quantity: number; mrp: number | null; unitCost: number }[] = [];
  let left = quantity;
  for (const r of rows) {
    if (left <= 0) break;
    const take = Math.min(Number(r.on_hand), left);
    picks.push({ batchId: r.id, quantity: take, mrp: r.mrp_minor, unitCost: r.unit_cost_minor });
    left -= take;
  }
  if (left > 1e-9) throw preconditionFailed('not enough usable stock of this item', { reason: 'insufficient_stock', itemId, shortBy: left });
  return picks;
}

export async function dispense(db: Kysely<DB>, caller: Caller, input: DispenseInput, idempotencyKey: string) {
  const now = clock(caller);
  const kinds = [input.prescriptionId, input.indentId, input.otc].filter(Boolean).length;
  if (kinds !== 1) throw invalid('dispense against a prescription, an indent, or as an over-the-counter sale', { reason: 'dispense_kind' });
  if (!input.lines.length) throw invalid('add at least one line', { reason: 'no_lines' });
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.dispense', idempotencyKey, request: input }, async (ctx) => {
    const store = await ctx.tx.selectFrom('inventory.store').selectAll().where('id', '=', input.storeId).executeTakeFirst();
    if (!store || store.status !== 'active' || !store.can_dispense_to_patient) throw preconditionFailed('this store does not dispense to patients', { reason: 'store_cannot_dispense' });
    const facility = await ctx.tx.selectFrom('platform.facility').select('timezone').where('id', '=', store.facility_id).executeTakeFirstOrThrow();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: facility.timezone }).format(now);

    let head: { type: 'prescription' | 'ipd_indent' | 'otc'; patientId: string | null; encounterId: string | null; prescriptionId: string | null; indentId: string | null };
    if (input.prescriptionId) {
      const rx = await ctx.tx.selectFrom('pharmacy.prescription').selectAll().where('id', '=', input.prescriptionId).forUpdate().executeTakeFirst();
      if (!rx) throw notFound('prescription', { prescriptionId: input.prescriptionId });
      if (!['signed', 'partially_dispensed'].includes(rx.status)) throw preconditionFailed(`prescription is ${rx.status}`, { reason: 'not_dispensable', status: rx.status });
      if (rx.valid_until && String(rx.valid_until) < today) throw preconditionFailed('the prescription has expired', { reason: 'prescription_expired' });
      if (rx.facility_id !== store.facility_id) throw invalid('the prescription is from another clinic', { reason: 'facility_mismatch' });
      head = { type: 'prescription', patientId: rx.patient_id, encounterId: rx.encounter_id, prescriptionId: rx.id, indentId: null };
    } else if (input.indentId) {
      const ind = await ctx.tx.selectFrom('pharmacy.patient_indent').selectAll().where('id', '=', input.indentId).forUpdate().executeTakeFirst();
      if (!ind) throw notFound('indent', { indentId: input.indentId });
      if (!['submitted', 'partially_dispensed'].includes(ind.status)) throw preconditionFailed(`indent is ${ind.status}`, { reason: 'not_dispensable', status: ind.status });
      head = { type: 'ipd_indent', patientId: ind.patient_id, encounterId: ind.encounter_id, prescriptionId: null, indentId: ind.id };
    } else {
      const o = input.otc!;
      if (!o.patientId && !o.buyerName) throw invalid('give the buyer’s name or choose the patient', { reason: 'buyer_required' });
      head = { type: 'otc', patientId: o.patientId ?? null, encounterId: null, prescriptionId: null, indentId: null };
    }

    const dispenseNo = await docNo(ctx.tx, 'dispense', 'DSP', store.facility_id, now);
    const d = await ctx.tx.insertInto('pharmacy.dispense').values({
      tenant_id: ctx.tenantId, dispense_no: dispenseNo, dispense_type: head.type, prescription_id: head.prescriptionId, patient_indent_id: head.indentId,
      patient_id: head.patientId, encounter_id: head.encounterId, buyer_name: input.otc?.buyerName ?? null, buyer_phone: input.otc?.buyerPhone ?? null,
      facility_id: store.facility_id, store_id: store.id, dispensed_at: now, dispensed_by: ctx.actor.staffId!, handed_over_to: input.handedOverTo ?? null,
      created_by: ctx.actor.staffId ?? null,
    }).returning('id').executeTakeFirstOrThrow();

    const posted: { dispenseLineId: string; itemId: string; itemBatchId: string; quantity: number; unitPriceMinor: number }[] = [];
    for (const l of input.lines) {
      let itemId: string;
      let rxLine: { id: string; item_id: string; quantity_prescribed: string | number | null; quantity_dispensed: string | number; status: string; substitution_allowed: boolean } | undefined;
      let indentLine: { id: string; item_id: string; qty_requested: string | number; qty_dispensed: string | number; prescription_item_id: string | null } | undefined;
      if (head.type === 'prescription') {
        if (!l.prescriptionItemId) throw invalid('each line names the prescription line it fills', { reason: 'line_required' });
        rxLine = await ctx.tx.selectFrom('pharmacy.prescription_item').select(['id', 'item_id', 'quantity_prescribed', 'quantity_dispensed', 'status', 'substitution_allowed'])
          .where('id', '=', l.prescriptionItemId).where('prescription_id', '=', head.prescriptionId!).forUpdate().executeTakeFirst();
        if (!rxLine) throw notFound('prescription line', { prescriptionItemId: l.prescriptionItemId });
        if (rxLine.status !== 'active') throw preconditionFailed(`the prescription line is ${rxLine.status}`, { reason: 'line_not_active' });
        if (rxLine.quantity_prescribed !== null && Number(rxLine.quantity_dispensed) + l.quantity > Number(rxLine.quantity_prescribed) + 1e-9) {
          throw preconditionFailed('more than was prescribed', { reason: 'exceeds_prescribed', remaining: Number(rxLine.quantity_prescribed) - Number(rxLine.quantity_dispensed) });
        }
        if (l.itemId && l.itemId !== rxLine.item_id && !rxLine.substitution_allowed) throw preconditionFailed('the prescriber did not allow a substitute', { reason: 'substitution_not_allowed' });
        itemId = l.itemId ?? rxLine.item_id;
      } else if (head.type === 'ipd_indent') {
        if (!l.indentLineId) throw invalid('each line names the indent line it fills', { reason: 'line_required' });
        indentLine = await ctx.tx.selectFrom('pharmacy.patient_indent_line').select(['id', 'item_id', 'qty_requested', 'qty_dispensed', 'prescription_item_id'])
          .where('id', '=', l.indentLineId).where('patient_indent_id', '=', head.indentId!).forUpdate().executeTakeFirst();
        if (!indentLine) throw notFound('indent line', { indentLineId: l.indentLineId });
        if (Number(indentLine.qty_dispensed) + l.quantity > Number(indentLine.qty_requested) + 1e-9) throw preconditionFailed('more than was requested', { reason: 'exceeds_requested' });
        itemId = indentLine.item_id;
      } else {
        if (!l.itemId) throw invalid('choose the item sold', { reason: 'item_required' });
        itemId = l.itemId;
        const drug = await ctx.tx.selectFrom('inventory.drug_product').select(['regulatory_schedule', 'is_ndps', 'generic_name']).where('item_id', '=', itemId).executeTakeFirst();
        if (drug && (RESTRICTED.includes(drug.regulatory_schedule) || drug.is_ndps)) {
          throw preconditionFailed(`${drug.generic_name} (Schedule ${drug.is_ndps ? 'NDPS' : drug.regulatory_schedule}) needs a prescription`, { reason: 'prescription_required', itemId });
        }
      }
      const item = await ctx.tx.selectFrom('inventory.item').select(['status', 'is_billable']).where('id', '=', itemId).executeTakeFirst();
      if (!item || item.status !== 'active') throw preconditionFailed('the item is not stocked any more', { reason: 'item_inactive', itemId });
      for (const pick of await pickBatches(ctx.tx, store.id, itemId, l.quantity, l.itemBatchId, today)) {
        const price = await sellingPrice(ctx.tx, itemId, pick.mrp, pick.unitCost, today);
        const substituted = rxLine && itemId !== rxLine.item_id ? rxLine.item_id : null;
        const line = await ctx.tx.insertInto('pharmacy.dispense_line').values({
          tenant_id: ctx.tenantId, dispense_id: d.id, prescription_item_id: rxLine?.id ?? indentLine?.prescription_item_id ?? null, patient_indent_line_id: indentLine?.id ?? null,
          item_id: itemId, item_batch_id: pick.batchId, quantity: pick.quantity, mrp_snapshot_minor: pick.mrp, unit_price_minor: price.unitPriceMinor,
          price_list_item_id: price.priceListItemId, substituted_from_item_id: substituted, substitution_approved_by: substituted ? ctx.actor.staffId! : null,
          created_by: ctx.actor.staffId ?? null,
        }).returning('id').executeTakeFirstOrThrow();
        try {
          await sql`SELECT inventory.post_patient_movement(${store.id}::uuid, ${pick.batchId}::uuid, ${pick.quantity}::numeric, ${head.patientId}::uuid,
                    ${ctx.actor.staffId ?? null}::uuid, ${line.id}::uuid, NULL::uuid, ${now}::timestamptz)`.execute(ctx.tx);
        } catch (err) {
          throw stockError(err) ?? err;
        }
        posted.push({ dispenseLineId: line.id, itemId, itemBatchId: pick.batchId, quantity: pick.quantity, unitPriceMinor: price.unitPriceMinor });
      }
      if (rxLine) {
        const total = Number(rxLine.quantity_dispensed) + l.quantity;
        const done = rxLine.quantity_prescribed !== null && total >= Number(rxLine.quantity_prescribed) - 1e-9;
        await ctx.tx.updateTable('pharmacy.prescription_item').set({ quantity_dispensed: total, ...(done ? { status: 'completed' as const } : {}), updated_by: ctx.actor.staffId ?? null }).where('id', '=', rxLine.id).execute();
      }
      if (indentLine) {
        await ctx.tx.updateTable('pharmacy.patient_indent_line').set({ qty_dispensed: Number(indentLine.qty_dispensed) + l.quantity, updated_by: ctx.actor.staffId ?? null }).where('id', '=', indentLine.id).execute();
        if (indentLine.prescription_item_id) {
          await sql`UPDATE pharmacy.prescription_item SET quantity_dispensed = quantity_dispensed + ${l.quantity} WHERE id = ${indentLine.prescription_item_id}`.execute(ctx.tx);
        }
      }
    }
    if (head.prescriptionId) await settlePrescription(ctx, head.prescriptionId);
    if (head.indentId) await settleIndent(ctx, head.indentId);
    ctx.audit({ action: 'create', subjectType: 'pharmacy.dispense', subjectId: d.id, patientId: head.patientId, diff: { dispenseNo, type: head.type, lines: posted.length } });
    ctx.emit({ eventType: 'dispense.completed', aggregateType: 'pharmacy.dispense', aggregateId: d.id, payload: { dispenseId: d.id, type: head.type } });
    return { dispenseId: d.id, dispenseNo, type: head.type, lines: posted, totalMinor: posted.reduce((s, p) => s + Math.round(p.quantity * p.unitPriceMinor), 0) };
  });
}

async function settlePrescription(ctx: CommandContext, prescriptionId: string) {
  const { rows: [r] } = await sql<{ open: number; any_dispensed: boolean }>`
    SELECT count(*) FILTER (WHERE status = 'active' AND (quantity_prescribed IS NULL OR quantity_dispensed < quantity_prescribed))::int AS open,
           bool_or(quantity_dispensed > 0) AS any_dispensed
    FROM pharmacy.prescription_item WHERE prescription_id = ${prescriptionId}`.execute(ctx.tx);
  const rx = await ctx.tx.selectFrom('pharmacy.prescription').select(['status', 'setting']).where('id', '=', prescriptionId).executeTakeFirstOrThrow();
  // Ongoing inpatient orders stay open until stopped; others complete once every line is filled.
  const next = r!.open === 0 && rx.setting !== 'inpatient' ? 'completed' : r!.any_dispensed ? 'partially_dispensed' : rx.status;
  if (next !== rx.status) await ctx.tx.updateTable('pharmacy.prescription').set({ status: next as never, updated_by: ctx.actor.staffId ?? null }).where('id', '=', prescriptionId).execute();
}

async function settleIndent(ctx: CommandContext, indentId: string) {
  const { rows: [r] } = await sql<{ open: number }>`
    SELECT count(*) FILTER (WHERE qty_dispensed < qty_requested)::int AS open FROM pharmacy.patient_indent_line WHERE patient_indent_id = ${indentId}`.execute(ctx.tx);
  await ctx.tx.updateTable('pharmacy.patient_indent').set({ status: r!.open === 0 ? 'dispensed' : 'partially_dispensed', updated_by: ctx.actor.staffId ?? null }).where('id', '=', indentId).execute();
}

/** Takes medicine back: a restockable return goes back on the shelf; billing takes the charge back. */
export async function returnMedication(
  db: Kysely<DB>, caller: Caller, input: { dispenseLineId: string; quantity: number; reason: string; restockable: boolean }, idempotencyKey: string,
) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.return_medication', idempotencyKey, request: input }, async (ctx) => {
    const line = await ctx.tx.selectFrom('pharmacy.dispense_line as l').innerJoin('pharmacy.dispense as d', 'd.id', 'l.dispense_id')
      .select(['l.id', 'l.quantity', 'l.returned_qty', 'l.item_batch_id', 'l.dispense_id', 'd.store_id', 'd.patient_id', 'l.prescription_item_id'])
      .where('l.id', '=', input.dispenseLineId).forUpdate('l').executeTakeFirst();
    if (!line) throw notFound('dispense line', { dispenseLineId: input.dispenseLineId });
    const returned = Number(line.returned_qty) + input.quantity;
    if (returned > Number(line.quantity) + 1e-9) throw invalid('more than was dispensed on this line', { reason: 'exceeds_dispensed', returnableQty: Number(line.quantity) - Number(line.returned_qty) });
    const r = await ctx.tx.insertInto('pharmacy.medication_return').values({
      tenant_id: ctx.tenantId, dispense_line_id: line.id, patient_id: line.patient_id, store_id: line.store_id, quantity: input.quantity, reason: input.reason,
      is_restockable: input.restockable, received_by: ctx.actor.staffId!, received_at: now,
    }).returning('id').executeTakeFirstOrThrow();
    if (input.restockable) {
      await sql`SELECT inventory.post_patient_movement(${line.store_id}::uuid, ${line.item_batch_id}::uuid, ${input.quantity}::numeric, ${line.patient_id}::uuid,
                ${ctx.actor.staffId ?? null}::uuid, NULL::uuid, ${r.id}::uuid, ${now}::timestamptz)`.execute(ctx.tx);
    }
    await ctx.tx.updateTable('pharmacy.dispense_line').set({ returned_qty: returned, updated_by: ctx.actor.staffId ?? null }).where('id', '=', line.id).execute();
    const { rows: [left] } = await sql<{ open: boolean }>`SELECT bool_or(returned_qty < quantity) AS open FROM pharmacy.dispense_line WHERE dispense_id = ${line.dispense_id}`.execute(ctx.tx);
    await ctx.tx.updateTable('pharmacy.dispense').set({ status: left!.open ? 'partially_returned' : 'returned', updated_by: ctx.actor.staffId ?? null }).where('id', '=', line.dispense_id).execute();
    ctx.audit({ action: 'create', subjectType: 'pharmacy.medication_return', subjectId: r.id, patientId: line.patient_id, reason: input.reason, diff: { dispenseLineId: line.id, quantity: input.quantity, restockable: input.restockable } });
    ctx.emit({ eventType: 'dispense.returned', aggregateType: 'pharmacy.medication_return', aggregateId: r.id, payload: { returnId: r.id, dispenseLineId: line.id, quantity: input.quantity } });
    return { returnId: r.id, dispenseLineId: line.id, returnedQty: returned };
  });
}

// ---- ward indents ---------------------------------------------------------------------------------------

export async function raiseIndent(
  db: Kysely<DB>, caller: Caller,
  input: { admissionId: string; storeId?: string | undefined; notes?: string | undefined; lines: { prescriptionItemId?: string | undefined; itemId?: string | undefined; quantity: number }[] },
  idempotencyKey: string,
) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.raise_indent', idempotencyKey, request: input }, async (ctx) => {
    const a = await ctx.tx.selectFrom('inpatient.admission').select(['id', 'status', 'patient_id', 'facility_id']).where('id', '=', input.admissionId).executeTakeFirst();
    if (!a) throw notFound('admission', { admissionId: input.admissionId });
    if (a.status !== 'admitted' && a.status !== 'discharge_planned') throw preconditionFailed(`the patient is ${a.status.replaceAll('_', ' ')}`, { reason: 'not_admitted' });
    const enc = await ctx.tx.selectFrom('clinical.encounter').select('id').where('admission_id', '=', a.id).executeTakeFirst();
    if (!enc) throw preconditionFailed('the stay has no encounter yet; try again in a moment', { reason: 'encounter_pending' });
    const store = input.storeId
      ? await ctx.tx.selectFrom('inventory.store').select(['id', 'facility_id']).where('id', '=', input.storeId).executeTakeFirst()
      : await ctx.tx.selectFrom('inventory.store').select(['id', 'facility_id']).where('facility_id', '=', a.facility_id).where('status', '=', 'active').where('can_dispense_to_patient', '=', true).orderBy('created_at').executeTakeFirst();
    if (!store || store.facility_id !== a.facility_id) throw preconditionFailed('the clinic has no pharmacy store', { reason: 'no_store' });
    if (!input.lines.length) throw invalid('add at least one line', { reason: 'no_lines' });
    const indentNo = await docNo(ctx.tx, 'indent', 'IND', a.facility_id, now);
    const ind = await ctx.tx.insertInto('pharmacy.patient_indent').values({
      tenant_id: ctx.tenantId, indent_no: indentNo, admission_id: a.id, encounter_id: enc.id, patient_id: a.patient_id, facility_id: a.facility_id, pharmacy_store_id: store.id,
      requested_at: now, requested_by: ctx.actor.staffId!, notes: input.notes ?? null, created_by: ctx.actor.staffId ?? null,
    }).returning(['id', 'version']).executeTakeFirstOrThrow();
    for (const l of input.lines) {
      let itemId = l.itemId;
      if (l.prescriptionItemId) {
        const pi = await ctx.tx.selectFrom('pharmacy.prescription_item as pi').innerJoin('pharmacy.prescription as p', 'p.id', 'pi.prescription_id')
          .select(['pi.item_id', 'pi.status', 'p.encounter_id', 'p.status as rxStatus']).where('pi.id', '=', l.prescriptionItemId).executeTakeFirst();
        if (!pi || pi.encounter_id !== enc.id) throw invalid('the order is not from this stay', { reason: 'order_mismatch' });
        if (pi.status !== 'active' || !['signed', 'partially_dispensed'].includes(pi.rxStatus)) throw preconditionFailed('the order is not active', { reason: 'order_not_active' });
        itemId = pi.item_id;
      }
      if (!itemId) throw invalid('choose the order or the item', { reason: 'item_required' });
      await ctx.tx.insertInto('pharmacy.patient_indent_line').values({
        tenant_id: ctx.tenantId, patient_indent_id: ind.id, prescription_item_id: l.prescriptionItemId ?? null, item_id: itemId, qty_requested: l.quantity, created_by: ctx.actor.staffId ?? null,
      }).execute();
    }
    ctx.audit({ action: 'create', subjectType: 'pharmacy.patient_indent', subjectId: ind.id, patientId: a.patient_id, diff: { indentNo, lines: input.lines.length } });
    ctx.emit({ eventType: 'indent.raised', aggregateType: 'pharmacy.patient_indent', aggregateId: ind.id, payload: { indentId: ind.id, admissionId: a.id } });
    return { indentId: ind.id, indentNo, status: 'submitted' as const, version: ind.version };
  });
}

export async function cancelIndent(db: Kysely<DB>, caller: Caller, input: { indentId: string; reason: string; version: number }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.cancel_indent', idempotencyKey, request: input }, async (ctx) => {
    const ind = await ctx.tx.selectFrom('pharmacy.patient_indent').selectAll().where('id', '=', input.indentId).forUpdate().executeTakeFirst();
    if (!ind) throw notFound('indent', { indentId: input.indentId });
    if (ind.version !== input.version) throw conflict('this indent was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: ind.version });
    if (ind.status !== 'submitted' && ind.status !== 'partially_dispensed') throw preconditionFailed(`indent is ${ind.status}`, { reason: 'not_cancellable' });
    const { version } = await ctx.tx.updateTable('pharmacy.patient_indent').set({ status: 'cancelled', cancel_reason: input.reason, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', ind.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'pharmacy.patient_indent', subjectId: ind.id, patientId: ind.patient_id, reason: input.reason, diff: { status: [ind.status, 'cancelled'] } });
    return { indentId: ind.id, status: 'cancelled' as const, version };
  });
}

