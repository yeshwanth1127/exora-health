// Dispensing (ERD m09): a verified prescription or a ward's patient indent is filled from a dispensing
// store. Batches are picked first-expiry-first-out (or named); each pick is a dispense line with the batch's
// MRP snapshotted and a price no higher than it. Stock leaves through inventory.post_patient_movement, so
// the ledger's rules (never negative, no held or expired batch) apply; Σ dispensed ≤ prescribed is a CHECK
// on the prescription line, taken under its row lock. Returns put restockable units back on the shelf.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, preconditionFailed, runCommand } from '@hms/platform';
import { clock, hospitalDay, type Caller } from '../../caller.ts';
import { assertChartAccess } from '../clinical/access.ts';
import { actor, assertPharmacyActive, nextNo, pad, pharmacyError, round3 } from './state.ts';

type Opt<T> = T | undefined;
const OPEN = ['arrived', 'in_progress'];

async function dispensingStore(tx: Transaction<DB>, storeId: string, facilityId: string) {
  const s = await tx.selectFrom('inventory.store').select(['id', 'facility_id', 'status', 'can_dispense_to_patient', 'name']).where('id', '=', storeId).executeTakeFirst();
  if (!s) throw notFound('store', { storeId });
  if (s.status !== 'active') throw preconditionFailed(`${s.name} is inactive`, { reason: 'store_inactive' });
  if (!s.can_dispense_to_patient) throw preconditionFailed(`${s.name} does not dispense to patients`, { reason: 'not_a_dispensing_store' });
  if (s.facility_id !== facilityId) throw preconditionFailed('the store belongs to another clinic', { reason: 'other_facility' });
  return s;
}

interface Batch {
  id: string;
  batch_no: string;
  expiry_date: string | null;
  mrp_minor: number | null;
  on_hand: number;
}

/**
 * Usable batches of an item in a store, earliest expiry first. Read without locks (pharmacy can't lock
 * inventory rows); the balance CHECK still refuses a pick that another dispense took first (409).
 */
async function usable(tx: Transaction<DB>, storeId: string, itemId: string, at: Date): Promise<Batch[]> {
  const rows = await tx
    .selectFrom('inventory.stock_balance as b')
    .innerJoin('inventory.item_batch as ib', 'ib.id', 'b.item_batch_id')
    .select(['ib.id', 'ib.batch_no', 'ib.expiry_date', 'ib.mrp_minor', 'b.on_hand'])
    .where('b.store_id', '=', storeId)
    .where('b.item_id', '=', itemId)
    .where('b.on_hand', '>', '0')
    .where('ib.status', '=', 'available')
    .where((eb) => eb.or([eb('ib.expiry_date', 'is', null), eb('ib.expiry_date', '>=', hospitalDay(at))]))
    .orderBy(sql`ib.expiry_date NULLS LAST`)
    .orderBy('ib.received_at')
    .execute();
  return rows.map((r) => ({ ...r, expiry_date: r.expiry_date as string | null, on_hand: Number(r.on_hand) }));
}

export interface DispenseLineInput {
  prescriptionItemId?: Opt<string>;
  patientIndentLineId?: Opt<string>;
  quantity: number;
  itemBatchId?: Opt<string>;
  substituteItemId?: Opt<string>;
  unitPriceMinor?: Opt<number>;
}

interface Target {
  prescriptionItemId: string | null;
  indentLineId: string | null;
  itemId: string;
  substitutedFrom: string | null;
}

export async function dispense(
  db: Kysely<DB>,
  caller: Caller,
  input: { prescriptionId?: Opt<string>; patientIndentId?: Opt<string>; storeId: string; handedOverTo?: Opt<string>; lines: DispenseLineInput[] },
  idempotencyKey: string,
) {
  await assertPharmacyActive(db, caller);
  const now = clock(caller);
  if (!!input.prescriptionId === !!input.patientIndentId) throw invalid('dispense either a prescription or a patient indent', { reason: 'one_source' });
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.dispense', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    try {
      // The source, locked: a prescription (verified) or a patient indent (open).
      let head: { patientId: string; encounterId: string; facilityId: string; type: string };
      let rx: { id: string; status: string } | undefined;
      let indent: { id: string; status: string } | undefined;
      if (input.prescriptionId) {
        const r = await ctx.tx.selectFrom('pharmacy.prescription').selectAll().where('id', '=', input.prescriptionId).forUpdate().executeTakeFirst();
        if (!r) throw notFound('prescription', { prescriptionId: input.prescriptionId });
        if (r.status === 'signed' || r.status === 'on_hold' || r.status === 'draft') throw preconditionFailed('the prescription must be verified by a pharmacist first', { reason: 'not_verified' });
        if (r.status !== 'verified' && r.status !== 'partially_dispensed') throw preconditionFailed(`a ${r.status} prescription can't be dispensed`, { reason: 'invalid_state' });
        if (r.valid_until && String(r.valid_until) < hospitalDay(now)) throw preconditionFailed('the prescription has expired', { reason: 'prescription_expired' });
        rx = r;
        head = { patientId: r.patient_id, encounterId: r.encounter_id, facilityId: r.facility_id, type: r.setting === 'discharge' ? 'discharge' : 'opd_prescription' };
      } else {
        const r = await ctx.tx.selectFrom('pharmacy.patient_indent').selectAll().where('id', '=', input.patientIndentId!).forUpdate().executeTakeFirst();
        if (!r) throw notFound('patient indent', { patientIndentId: input.patientIndentId });
        if (r.status !== 'submitted' && r.status !== 'partially_dispensed') throw preconditionFailed(`a ${r.status} indent can't be dispensed`, { reason: 'invalid_state' });
        if (r.pharmacy_store_id !== input.storeId) throw preconditionFailed('the indent was sent to another store', { reason: 'store_mismatch' });
        indent = r;
        head = { patientId: r.patient_id, encounterId: r.encounter_id, facilityId: r.facility_id, type: 'ipd_indent' };
      }
      const store = await dispensingStore(ctx.tx, input.storeId, head.facilityId);

      // What each line fills, and which item leaves the shelf (the prescribed one or an approved substitute).
      const targets: { line: DispenseLineInput; t: Target }[] = [];
      for (const line of input.lines) {
        let t: Target;
        if (rx) {
          if (!line.prescriptionItemId) throw invalid('each line names its prescription line', { reason: 'prescription_item_required' });
          const pi = await ctx.tx.selectFrom('pharmacy.prescription_item').selectAll().where('id', '=', line.prescriptionItemId).where('prescription_id', '=', rx.id).forUpdate().executeTakeFirst();
          if (!pi) throw notFound('prescription line', { prescriptionItemId: line.prescriptionItemId });
          if (pi.status !== 'active') throw preconditionFailed(`line ${pi.line_no} is ${pi.status}`, { reason: 'line_not_active', prescriptionItemId: pi.id });
          t = { prescriptionItemId: pi.id, indentLineId: null, itemId: pi.item_id, substitutedFrom: null };
        } else {
          if (!line.patientIndentLineId) throw invalid('each line names its indent line', { reason: 'indent_line_required' });
          const il = await ctx.tx.selectFrom('pharmacy.patient_indent_line').selectAll().where('id', '=', line.patientIndentLineId).where('patient_indent_id', '=', indent!.id).forUpdate().executeTakeFirst();
          if (!il) throw notFound('indent line', { patientIndentLineId: line.patientIndentLineId });
          t = { prescriptionItemId: il.prescription_item_id, indentLineId: il.id, itemId: il.item_id, substitutedFrom: null };
          if (il.prescription_item_id) {
            const pi = await ctx.tx.selectFrom('pharmacy.prescription_item').select(['status', 'line_no']).where('id', '=', il.prescription_item_id).forUpdate().executeTakeFirstOrThrow();
            if (pi.status !== 'active') throw preconditionFailed(`the prescription line was ${pi.status}`, { reason: 'line_not_active', prescriptionItemId: il.prescription_item_id });
          }
        }
        if (line.substituteItemId && line.substituteItemId !== t.itemId) {
          const allowed = t.prescriptionItemId
            ? (await ctx.tx.selectFrom('pharmacy.prescription_item').select('substitution_allowed').where('id', '=', t.prescriptionItemId).executeTakeFirstOrThrow()).substitution_allowed
            : true;
          if (!allowed) throw preconditionFailed('the prescriber did not allow substitution on this line', { reason: 'substitution_not_allowed' });
          const pair = await ctx.tx
            .selectFrom('inventory.drug_product')
            .select(['item_id', 'generic_name', 'strength', 'dosage_form'])
            .where('item_id', 'in', [t.itemId, line.substituteItemId])
            .execute();
          const [a, b] = [pair.find((p) => p.item_id === t.itemId), pair.find((p) => p.item_id === line.substituteItemId)];
          const same = (x?: string | null, y?: string | null) => (x ?? '').trim().toLowerCase() === (y ?? '').trim().toLowerCase();
          if (!a || !b || !same(a.generic_name, b.generic_name) || !same(a.strength, b.strength) || a.dosage_form !== b.dosage_form) {
            throw preconditionFailed('a substitute must be the same generic, strength and form', { reason: 'not_equivalent' });
          }
          t = { ...t, itemId: line.substituteItemId, substitutedFrom: t.itemId };
        }
        targets.push({ line, t });
      }

      // Picks: a named batch, or FEFO across usable batches (a line may split across batches).
      const taken = new Map<string, number>();
      const picks: { t: Target; batch: Batch; quantity: number; price: number }[] = [];
      for (const { line, t } of targets) {
        const batches = await usable(ctx.tx, store.id, t.itemId, now);
        const left = (b: Batch) => round3(b.on_hand - (taken.get(b.id) ?? 0));
        let pool = batches;
        if (line.itemBatchId) {
          pool = batches.filter((b) => b.id === line.itemBatchId);
          if (!pool.length) throw preconditionFailed('that batch is not usable stock of this item in the store', { reason: 'batch_unavailable', itemBatchId: line.itemBatchId });
        }
        let need = line.quantity;
        for (const b of pool) {
          if (need <= 0) break;
          const q = Math.min(need, left(b));
          if (q <= 0) continue;
          const price = line.unitPriceMinor ?? b.mrp_minor;
          if (price == null) throw invalid('this batch has no MRP; give the unit price', { reason: 'price_required', itemBatchId: b.id });
          if (b.mrp_minor != null && price > b.mrp_minor) throw invalid('the price is above the MRP', { reason: 'above_mrp', mrpMinor: b.mrp_minor });
          picks.push({ t, batch: b, quantity: q, price });
          taken.set(b.id, round3((taken.get(b.id) ?? 0) + q));
          need = round3(need - q);
        }
        if (need > 0) throw conflict('not enough usable stock in this store', { reason: 'insufficient_stock', itemId: t.itemId, requested: line.quantity, available: round3(line.quantity - need) });
      }

      const year = now.toISOString().slice(0, 4);
      const dispenseNo = `DSP/${year}/${pad(await nextNo(ctx.tx, 'dispense', head.facilityId, year))}`;
      const handed = input.handedOverTo?.trim();
      const { id: dispenseId } = await ctx.tx
        .insertInto('pharmacy.dispense')
        .values({
          tenant_id: ctx.tenantId,
          dispense_no: dispenseNo,
          dispense_type: head.type,
          prescription_id: rx?.id ?? null,
          patient_indent_id: indent?.id ?? null,
          patient_id: head.patientId,
          encounter_id: head.encounterId,
          facility_id: head.facilityId,
          store_id: store.id,
          dispensed_at: now,
          dispensed_by: me,
          handed_over_to: handed || null,
          handed_over_at: handed ? now : null,
          status: handed ? 'handed_over' : 'prepared',
          created_by: me,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const lines = [];
      const perRxItem = new Map<string, number>();
      const perIndentLine = new Map<string, number>();
      for (const p of picks) {
        const { id } = await ctx.tx
          .insertInto('pharmacy.dispense_line')
          .values({
            tenant_id: ctx.tenantId,
            dispense_id: dispenseId,
            prescription_item_id: p.t.prescriptionItemId,
            patient_indent_line_id: p.t.indentLineId,
            item_id: p.t.itemId,
            item_batch_id: p.batch.id,
            quantity: String(p.quantity),
            mrp_snapshot_minor: p.batch.mrp_minor,
            unit_price_minor: p.price,
            substitution_approved_by: p.t.substitutedFrom ? me : null,
            substituted_from_item_id: p.t.substitutedFrom,
            created_by: me,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await sql`SELECT inventory.post_patient_movement(${store.id}::uuid, ${p.batch.id}::uuid, ${String(p.quantity)}::numeric, ${head.patientId}::uuid, ${me}::uuid, ${id}::uuid, NULL::uuid, ${now}::timestamptz)`.execute(ctx.tx);
        if (p.t.prescriptionItemId) perRxItem.set(p.t.prescriptionItemId, round3((perRxItem.get(p.t.prescriptionItemId) ?? 0) + p.quantity));
        if (p.t.indentLineId) perIndentLine.set(p.t.indentLineId, round3((perIndentLine.get(p.t.indentLineId) ?? 0) + p.quantity));
        lines.push({ dispenseLineId: id, prescriptionItemId: p.t.prescriptionItemId, itemId: p.t.itemId, itemBatchId: p.batch.id, batchNo: p.batch.batch_no, expiryDate: p.batch.expiry_date, quantity: p.quantity, mrpMinor: p.batch.mrp_minor, unitPriceMinor: p.price, substitutedFromItemId: p.t.substitutedFrom });
      }

      // Running totals; the CHECKs refuse more than prescribed / requested.
      for (const [piId, q] of perRxItem) {
        const pi = await ctx.tx
          .updateTable('pharmacy.prescription_item')
          .set((eb) => ({ quantity_dispensed: eb('quantity_dispensed', '+', String(q)), updated_by: me }))
          .where('id', '=', piId)
          .returning(['quantity_dispensed', 'quantity_prescribed', 'prescription_id'])
          .executeTakeFirstOrThrow();
        if (rx && pi.quantity_prescribed != null && Number(pi.quantity_dispensed) >= Number(pi.quantity_prescribed)) {
          await ctx.tx.updateTable('pharmacy.prescription_item').set({ status: 'completed', updated_by: me }).where('id', '=', piId).execute();
        }
      }
      for (const [lineId, q] of perIndentLine) {
        await ctx.tx.updateTable('pharmacy.patient_indent_line').set((eb) => ({ qty_dispensed: eb('qty_dispensed', '+', String(q)), updated_by: me })).where('id', '=', lineId).execute();
      }
      let sourceStatus: string;
      if (rx) {
        const open = await ctx.tx.selectFrom('pharmacy.prescription_item').select('id').where('prescription_id', '=', rx.id).where('status', 'in', ['active', 'held']).executeTakeFirst();
        sourceStatus = open ? 'partially_dispensed' : 'completed';
        if (sourceStatus !== rx.status) await ctx.tx.updateTable('pharmacy.prescription').set({ status: sourceStatus, updated_by: me }).where('id', '=', rx.id).execute();
      } else {
        const short = await ctx.tx.selectFrom('pharmacy.patient_indent_line').select('id').where('patient_indent_id', '=', indent!.id).whereRef('qty_dispensed', '<', 'qty_requested').executeTakeFirst();
        sourceStatus = short ? 'partially_dispensed' : 'dispensed';
        if (sourceStatus !== indent!.status) await ctx.tx.updateTable('pharmacy.patient_indent').set({ status: sourceStatus, updated_by: me }).where('id', '=', indent!.id).execute();
      }

      ctx.audit({ action: 'create', subjectType: 'pharmacy.dispense', subjectId: dispenseId, patientId: head.patientId, diff: { dispenseNo, lines: lines.length } });
      ctx.emit({
        eventType: 'pharmacy.dispensed',
        aggregateType: 'pharmacy.dispense',
        aggregateId: dispenseId,
        payload: { dispenseId, dispenseNo, patientId: head.patientId, encounterId: head.encounterId, facilityId: head.facilityId, lines: lines.map((l) => ({ dispenseLineId: l.dispenseLineId, itemId: l.itemId, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor })) },
      });
      return { dispenseId, dispenseNo, status: handed ? 'handed_over' : 'prepared', sourceStatus, lines };
    } catch (err) {
      return pharmacyError(err);
    }
  });
}

export async function handOverDispense(db: Kysely<DB>, caller: Caller, input: { dispenseId: string; handedOverTo: string }) {
  await assertPharmacyActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.hand_over', request: input }, async (ctx) => {
    const me = actor(ctx);
    const d = await ctx.tx.selectFrom('pharmacy.dispense').select(['id', 'status', 'patient_id']).where('id', '=', input.dispenseId).forUpdate().executeTakeFirst();
    if (!d) throw notFound('dispense', { dispenseId: input.dispenseId });
    if (d.status !== 'prepared') throw preconditionFailed(`a ${d.status} dispense can't be handed over`, { reason: 'invalid_state' });
    await ctx.tx.updateTable('pharmacy.dispense').set({ status: 'handed_over', handed_over_to: input.handedOverTo, handed_over_at: now, updated_by: me }).where('id', '=', d.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'pharmacy.dispense', subjectId: d.id, patientId: d.patient_id, reason: 'handed over' });
    return { dispenseId: d.id, status: 'handed_over' };
  });
}

/** A ward asks the pharmacy for a patient's medicines: lines of the patient's signed prescriptions, or consumables. */
export async function createPatientIndent(
  db: Kysely<DB>,
  caller: Caller,
  input: { encounterId: string; pharmacyStoreId: string; wardStoreId?: Opt<string>; notes?: Opt<string>; lines: { prescriptionItemId?: Opt<string>; itemId?: Opt<string>; quantity: number }[] },
  idempotencyKey: string,
) {
  await assertPharmacyActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.create_patient_indent', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    const enc = await ctx.tx.selectFrom('clinical.encounter').select(['id', 'patient_id', 'facility_id', 'status']).where('id', '=', input.encounterId).executeTakeFirst();
    if (!enc) throw notFound('encounter', { encounterId: input.encounterId });
    if (!OPEN.includes(enc.status)) throw preconditionFailed(`a ${enc.status} encounter can't raise an indent`, { reason: 'encounter_closed' });
    await assertChartAccess(ctx.tx, me, enc.patient_id, now);
    await dispensingStore(ctx.tx, input.pharmacyStoreId, enc.facility_id);
    if (input.wardStoreId) {
      const w = await ctx.tx.selectFrom('inventory.store').select(['facility_id']).where('id', '=', input.wardStoreId).executeTakeFirst();
      if (!w) throw notFound('store', { storeId: input.wardStoreId });
      if (w.facility_id !== enc.facility_id) throw preconditionFailed('the ward store belongs to another clinic', { reason: 'other_facility' });
    }
    const resolved: { prescriptionItemId: string | null; itemId: string; quantity: number }[] = [];
    for (const l of input.lines) {
      if (l.prescriptionItemId) {
        const pi = await ctx.tx
          .selectFrom('pharmacy.prescription_item as i')
          .innerJoin('pharmacy.prescription as p', 'p.id', 'i.prescription_id')
          .select(['i.id', 'i.item_id', 'i.status', 'p.status as rx_status', 'p.patient_id'])
          .where('i.id', '=', l.prescriptionItemId)
          .executeTakeFirst();
        if (!pi) throw notFound('prescription line', { prescriptionItemId: l.prescriptionItemId });
        if (pi.patient_id !== enc.patient_id) throw preconditionFailed('that prescription is for another patient', { reason: 'other_patient' });
        if (pi.status !== 'active' || !['signed', 'verified', 'partially_dispensed'].includes(pi.rx_status)) throw preconditionFailed('only active lines of signed prescriptions can be indented', { reason: 'line_not_active' });
        resolved.push({ prescriptionItemId: pi.id, itemId: pi.item_id, quantity: l.quantity });
      } else if (l.itemId) {
        const it = await ctx.tx.selectFrom('inventory.item').select(['id', 'status', 'item_type']).where('id', '=', l.itemId).executeTakeFirst();
        if (!it || it.status !== 'active') throw notFound('item', { itemId: l.itemId });
        if (it.item_type === 'drug') throw preconditionFailed('drugs are indented against a prescription line', { reason: 'prescription_required' });
        resolved.push({ prescriptionItemId: null, itemId: it.id, quantity: l.quantity });
      } else throw invalid('each line names a prescription line or a consumable item', { reason: 'line_target_required' });
    }
    const { id } = await ctx.tx
      .insertInto('pharmacy.patient_indent')
      .values({ tenant_id: ctx.tenantId, encounter_id: enc.id, patient_id: enc.patient_id, facility_id: enc.facility_id, ward_store_id: input.wardStoreId ?? null, pharmacy_store_id: input.pharmacyStoreId, requested_at: now, requested_by: me, notes: input.notes?.trim() || null, created_by: me })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const r of resolved) {
      await ctx.tx.insertInto('pharmacy.patient_indent_line').values({ tenant_id: ctx.tenantId, patient_indent_id: id, prescription_item_id: r.prescriptionItemId, item_id: r.itemId, qty_requested: String(r.quantity), created_by: me }).execute();
    }
    ctx.audit({ action: 'create', subjectType: 'pharmacy.patient_indent', subjectId: id, patientId: enc.patient_id, diff: { lines: resolved.length } });
    ctx.emit({ eventType: 'pharmacy.patient_indent_raised', aggregateType: 'pharmacy.patient_indent', aggregateId: id, payload: { patientIndentId: id, facilityId: enc.facility_id, pharmacyStoreId: input.pharmacyStoreId } });
    return { patientIndentId: id, status: 'submitted' };
  });
}

export async function cancelPatientIndent(db: Kysely<DB>, caller: Caller, input: { patientIndentId: string; reason: string }) {
  await assertPharmacyActive(db, caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.cancel_patient_indent', request: input }, async (ctx) => {
    const me = actor(ctx);
    const r = await ctx.tx.selectFrom('pharmacy.patient_indent').select(['id', 'status', 'patient_id']).where('id', '=', input.patientIndentId).forUpdate().executeTakeFirst();
    if (!r) throw notFound('patient indent', { patientIndentId: input.patientIndentId });
    if (r.status !== 'submitted' && r.status !== 'partially_dispensed') throw preconditionFailed(`a ${r.status} indent can't be cancelled`, { reason: 'invalid_state' });
    await ctx.tx.updateTable('pharmacy.patient_indent').set({ status: 'cancelled', cancel_reason: input.reason, updated_by: me }).where('id', '=', r.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'pharmacy.patient_indent', subjectId: r.id, patientId: r.patient_id, reason: input.reason });
    return { patientIndentId: r.id, status: 'cancelled' };
  });
}

/** Medicines brought back: restockable units go back to the store's shelf; billing reverses the charge (event). */
export async function returnMedication(db: Kysely<DB>, caller: Caller, input: { dispenseLineId: string; quantity: number; reason: string; isRestockable: boolean }, idempotencyKey: string) {
  await assertPharmacyActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.return_medication', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    try {
      const l = await ctx.tx
        .selectFrom('pharmacy.dispense_line as l')
        .innerJoin('pharmacy.dispense as d', 'd.id', 'l.dispense_id')
        .select(['l.id', 'l.item_batch_id', 'l.item_id', 'l.quantity', 'l.returned_qty', 'l.unit_price_minor', 'd.id as dispense_id', 'd.status', 'd.store_id', 'd.patient_id', 'd.encounter_id'])
        .where('l.id', '=', input.dispenseLineId)
        .forUpdate('l')
        .executeTakeFirst();
      if (!l) throw notFound('dispense line', { dispenseLineId: input.dispenseLineId });
      if (l.status === 'cancelled') throw preconditionFailed('the dispense was cancelled', { reason: 'invalid_state' });
      if (round3(Number(l.returned_qty) + input.quantity) > Number(l.quantity)) throw conflict('more than was dispensed on that line', { reason: 'over_return', returnable: round3(Number(l.quantity) - Number(l.returned_qty)) });
      await ctx.tx.updateTable('pharmacy.dispense_line').set((eb) => ({ returned_qty: eb('returned_qty', '+', String(input.quantity)), updated_by: me })).where('id', '=', l.id).execute();
      const { id } = await ctx.tx
        .insertInto('pharmacy.medication_return')
        .values({ tenant_id: ctx.tenantId, dispense_line_id: l.id, patient_id: l.patient_id, store_id: l.store_id, quantity: String(input.quantity), reason: input.reason, is_restockable: input.isRestockable, received_by: me, received_at: now })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (input.isRestockable) {
        await sql`SELECT inventory.post_patient_movement(${l.store_id}::uuid, ${l.item_batch_id}::uuid, ${String(input.quantity)}::numeric, ${l.patient_id}::uuid, ${me}::uuid, NULL::uuid, ${id}::uuid, ${now}::timestamptz)`.execute(ctx.tx);
      }
      if (l.status !== 'partially_returned') await ctx.tx.updateTable('pharmacy.dispense').set({ status: 'partially_returned', updated_by: me }).where('id', '=', l.dispense_id).execute();
      ctx.audit({ action: 'create', subjectType: 'pharmacy.medication_return', subjectId: id, patientId: l.patient_id, reason: input.reason, diff: { quantity: input.quantity, isRestockable: input.isRestockable } });
      ctx.emit({
        eventType: 'pharmacy.medication_returned',
        aggregateType: 'pharmacy.medication_return',
        aggregateId: id,
        payload: { medicationReturnId: id, dispenseLineId: l.id, patientId: l.patient_id, encounterId: l.encounter_id, itemId: l.item_id, quantity: input.quantity, unitPriceMinor: l.unit_price_minor, isRestockable: input.isRestockable },
      });
      return { medicationReturnId: id, restocked: input.isRestockable };
    } catch (err) {
      return pharmacyError(err);
    }
  });
}
