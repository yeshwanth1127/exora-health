// Reads for M09. Clinician views of a patient's prescriptions and MAR need a care relationship; the
// pharmacist's views (queue, a prescription to verify or dispense, dispenses, registers) don't, but every
// view of one patient's medicines is audited.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { notFound, runCommand, runQuery } from '@hms/platform';
import { clock, hospitalDay, type Caller } from '../../caller.ts';
import { assertChartAccess } from '../clinical/access.ts';
import { witnessesAt } from './state.ts';

type Opt<T> = T | undefined;
const name = sql<string>`concat_ws(' ', pt.given_name, pt.middle_name, pt.family_name)`;

async function prescriptionsWhere(tx: Transaction<DB>, where: { encounterId?: string; prescriptionId?: string }) {
  let q = tx
    .selectFrom('pharmacy.prescription as p')
    .innerJoin('platform.staff as s', 's.id', 'p.prescriber_staff_id')
    .select([
      'p.id as prescriptionId', 'p.encounter_id as encounterId', 'p.patient_id as patientId', 'p.facility_id as facilityId', 'p.setting', 'p.status',
      'p.prescriber_staff_id as prescriberStaffId', 's.display_name as prescriberName', 'p.signed_at as signedAt', 'p.valid_until as validUntil',
      'p.advice', 'p.cancel_reason as cancelReason', 'p.created_at as createdAt',
    ])
    .orderBy('p.created_at', 'desc');
  if (where.encounterId) q = q.where('p.encounter_id', '=', where.encounterId);
  if (where.prescriptionId) q = q.where('p.id', '=', where.prescriptionId);
  const rx = await q.execute();
  if (!rx.length) return [];
  const ids = rx.map((r) => r.prescriptionId);
  const items = await tx
    .selectFrom('pharmacy.prescription_item as i')
    .innerJoin('inventory.item as it', 'it.id', 'i.item_id')
    .innerJoin('inventory.drug_product as d', 'd.item_id', 'i.item_id')
    .select([
      'i.id as prescriptionItemId', 'i.prescription_id as prescriptionId', 'i.line_no as lineNo', 'i.item_id as itemId', 'it.name as itemName', 'it.base_uom as baseUom',
      'i.generic_name as genericName', 'i.brand_name as brandName', 'i.strength', 'i.dose', 'i.dose_unit as doseUnit', 'i.route', 'i.frequency_code as frequencyCode',
      'i.frequency_text as frequencyText', 'i.duration_value as durationValue', 'i.duration_unit as durationUnit', 'i.quantity_prescribed as quantityPrescribed',
      'i.quantity_dispensed as quantityDispensed', 'i.is_prn as isPrn', 'i.prn_min_interval_minutes as prnMinIntervalMinutes', 'i.food_relation as foodRelation',
      'i.instructions', 'i.substitution_allowed as substitutionAllowed', 'i.status', 'i.stop_reason as stopReason', 'i.warnings', 'i.override_reason as overrideReason',
      'd.regulatory_schedule as schedule', 'd.is_ndps as isNdps', 'd.is_high_alert as isHighAlert',
    ])
    .where('i.prescription_id', 'in', ids)
    .orderBy('i.line_no')
    .execute();
  const checks = await tx
    .selectFrom('pharmacy.pharmacy_verification as v')
    .innerJoin('platform.staff as s', 's.id', 'v.verified_by')
    .select(['v.prescription_id as prescriptionId', 'v.outcome', 'v.notes', 'v.verified_at as verifiedAt', 's.display_name as verifiedBy'])
    .where('v.prescription_id', 'in', ids)
    .orderBy('v.verified_at')
    .execute();
  return rx.map((r) => ({
    ...r,
    items: items.filter((i) => i.prescriptionId === r.prescriptionId).map((i) => ({ ...i, requiresWitness: i.isHighAlert || i.isNdps || i.schedule === 'X' })),
    verifications: checks.filter((c) => c.prescriptionId === r.prescriptionId),
  }));
}

/** An encounter's prescriptions and patient indents (care access; audited). */
export async function encounterPrescriptions(db: Kysely<DB>, caller: Caller, encounterId: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.view_prescriptions' }, async (ctx) => {
    const e = await ctx.tx.selectFrom('clinical.encounter').select(['id', 'patient_id']).where('id', '=', encounterId).executeTakeFirst();
    if (!e) throw notFound('encounter', { encounterId });
    await assertChartAccess(ctx.tx, ctx.actor.staffId, e.patient_id, now);
    ctx.audit({ action: 'view', subjectType: 'pharmacy.prescription', subjectId: e.id, patientId: e.patient_id, reason: 'encounter prescriptions' });
    const indents = await ctx.tx
      .selectFrom('pharmacy.patient_indent as pi')
      .innerJoin('inventory.store as s', 's.id', 'pi.pharmacy_store_id')
      .select(['pi.id as patientIndentId', 'pi.status', 'pi.requested_at as requestedAt', 's.name as pharmacyStore', 'pi.cancel_reason as cancelReason'])
      .where('pi.encounter_id', '=', e.id)
      .orderBy('pi.requested_at', 'desc')
      .execute();
    return { encounterId: e.id, patientId: e.patient_id, prescriptions: await prescriptionsWhere(ctx.tx, { encounterId: e.id }), indents };
  });
}

/** The MAR for an encounter: chartable lines with their doses so far (care access; audited). */
export async function medicationChart(db: Kysely<DB>, caller: Caller, encounterId: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.view_mar' }, async (ctx) => {
    const e = await ctx.tx.selectFrom('clinical.encounter').select(['id', 'patient_id']).where('id', '=', encounterId).executeTakeFirst();
    if (!e) throw notFound('encounter', { encounterId });
    await assertChartAccess(ctx.tx, ctx.actor.staffId, e.patient_id, now);
    ctx.audit({ action: 'view', subjectType: 'pharmacy.medication_administration', subjectId: e.id, patientId: e.patient_id, reason: 'MAR' });
    const rx = (await prescriptionsWhere(ctx.tx, { encounterId: e.id })).filter((r) => ['signed', 'verified', 'partially_dispensed', 'completed'].includes(r.status));
    const doses = await ctx.tx
      .selectFrom('pharmacy.medication_administration as m')
      .innerJoin('platform.staff as s', 's.id', 'm.administered_by')
      .leftJoin('platform.staff as w', 'w.id', 'm.witness_staff_id')
      .select([
        'm.id as administrationId', 'm.prescription_item_id as prescriptionItemId', 'm.scheduled_at as scheduledAt', 'm.administered_at as administeredAt',
        'm.recorded_at as recordedAt', 'm.status', 'm.dose_given as doseGiven', 'm.dose_unit as doseUnit', 'm.route', 'm.site', 'm.reason', 'm.prn_reason as prnReason',
        's.display_name as administeredBy', 'w.display_name as witness',
      ])
      .where('m.encounter_id', '=', e.id)
      .orderBy('m.recorded_at', 'desc')
      .execute();
    const lines = rx.flatMap((r) => r.items.map((i) => ({ ...i, prescriberName: r.prescriberName, doses: doses.filter((d) => d.prescriptionItemId === i.prescriptionItemId) })));
    return { encounterId: e.id, patientId: e.patient_id, lines };
  });
}

/** Pharmacist's queue for a clinic: prescriptions to verify, to dispense, or open patient indents. */
export async function pharmacyQueue(db: Kysely<DB>, caller: Caller, input: { facilityId: string; stage: 'verify' | 'dispense' | 'indents' }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    if (input.stage === 'indents') {
      return tx
        .selectFrom('pharmacy.patient_indent as pi')
        .innerJoin('patient.patient as pt', 'pt.id', 'pi.patient_id')
        .innerJoin('platform.staff as s', 's.id', 'pi.requested_by')
        .innerJoin('inventory.store as st', 'st.id', 'pi.pharmacy_store_id')
        .select(['pi.id as patientIndentId', 'pi.status', 'pi.requested_at as requestedAt', 'pi.patient_id as patientId', 'pt.mrn', name.as('patientName'), 's.display_name as requestedBy', 'st.name as pharmacyStore', 'pi.notes'])
        .where('pi.facility_id', '=', input.facilityId)
        .where('pi.status', 'in', ['submitted', 'partially_dispensed'])
        .orderBy('pi.requested_at')
        .limit(200)
        .execute();
    }
    const statuses = input.stage === 'verify' ? ['signed', 'on_hold'] : ['verified', 'partially_dispensed'];
    return tx
      .selectFrom('pharmacy.prescription as p')
      .innerJoin('patient.patient as pt', 'pt.id', 'p.patient_id')
      .innerJoin('platform.staff as s', 's.id', 'p.prescriber_staff_id')
      .select((eb) => [
        'p.id as prescriptionId', 'p.status', 'p.setting', 'p.signed_at as signedAt', 'p.patient_id as patientId', 'pt.mrn', name.as('patientName'), 's.display_name as prescriberName',
        eb.selectFrom('pharmacy.prescription_item as i').select((x) => x.fn.countAll<number>().as('n')).whereRef('i.prescription_id', '=', 'p.id').where('i.status', 'in', ['active', 'held']).as('openLines'),
      ])
      .where('p.facility_id', '=', input.facilityId)
      .where('p.status', 'in', statuses)
      .orderBy('p.signed_at')
      .limit(200)
      .execute();
  });
}

/** A prescription or patient indent as the pharmacist sees it: patient, allergies, lines, and stock at a store (audited). */
export async function pharmacyView(db: Kysely<DB>, caller: Caller, input: { prescriptionId?: Opt<string>; patientIndentId?: Opt<string>; storeId?: Opt<string> }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.view_for_dispensing' }, async (ctx) => {
    let patientId: string;
    let prescription: Awaited<ReturnType<typeof prescriptionsWhere>>[number] | null = null;
    let indent = null;
    if (input.prescriptionId) {
      [prescription = null] = await prescriptionsWhere(ctx.tx, { prescriptionId: input.prescriptionId });
      if (!prescription) throw notFound('prescription', { prescriptionId: input.prescriptionId });
      patientId = prescription.patientId;
    } else {
      const pi = await ctx.tx.selectFrom('pharmacy.patient_indent').selectAll().where('id', '=', input.patientIndentId!).executeTakeFirst();
      if (!pi) throw notFound('patient indent', { patientIndentId: input.patientIndentId });
      const lines = await ctx.tx
        .selectFrom('pharmacy.patient_indent_line as l')
        .innerJoin('inventory.item as it', 'it.id', 'l.item_id')
        .leftJoin('pharmacy.prescription_item as i', 'i.id', 'l.prescription_item_id')
        .select(['l.id as patientIndentLineId', 'l.item_id as itemId', 'it.name as itemName', 'it.base_uom as baseUom', 'l.qty_requested as qtyRequested', 'l.qty_dispensed as qtyDispensed', 'l.prescription_item_id as prescriptionItemId', 'i.dose', 'i.dose_unit as doseUnit', 'i.frequency_code as frequencyCode', 'i.status as lineStatus'])
        .where('l.patient_indent_id', '=', pi.id)
        .execute();
      indent = { patientIndentId: pi.id, status: pi.status, requestedAt: pi.requested_at, pharmacyStoreId: pi.pharmacy_store_id, notes: pi.notes, lines };
      patientId = pi.patient_id;
    }
    ctx.audit({ action: 'view', subjectType: input.prescriptionId ? 'pharmacy.prescription' : 'pharmacy.patient_indent', subjectId: (input.prescriptionId ?? input.patientIndentId)!, patientId, reason: 'dispensing' });
    const patient = await ctx.tx.selectFrom('patient.patient').select(['id', 'mrn', 'given_name', 'middle_name', 'family_name', 'sex', 'birth_date']).where('id', '=', patientId).executeTakeFirstOrThrow();
    const allergies = await ctx.tx.selectFrom('clinical.allergy_intolerance').select(['substance', 'reaction', 'severity', 'category']).where('patient_id', '=', patientId).where('status', '=', 'active').execute();

    const itemIds = [...new Set([...(prescription?.items.map((i) => i.itemId) ?? []), ...(indent?.lines.map((l) => l.itemId) ?? [])])];
    let stock: Record<string, { batches: unknown[]; alternatives: unknown[] }> = {};
    if (input.storeId && itemIds.length) {
      const batches = await ctx.tx
        .selectFrom('inventory.stock_balance as b')
        .innerJoin('inventory.item_batch as ib', 'ib.id', 'b.item_batch_id')
        .select(['b.item_id as itemId', 'ib.id as itemBatchId', 'ib.batch_no as batchNo', 'ib.expiry_date as expiryDate', 'ib.mrp_minor as mrpMinor', 'b.on_hand as onHand'])
        .where('b.store_id', '=', input.storeId)
        .where('b.on_hand', '>', '0')
        .where('ib.status', '=', 'available')
        .where((eb) => eb.or([eb('ib.expiry_date', 'is', null), eb('ib.expiry_date', '>=', hospitalDay(now))]))
        .orderBy(sql`ib.expiry_date NULLS LAST`)
        .execute();
      // Same generic, strength and form, with stock here: candidates for an approved substitution.
      const alternatives = await sql<{ for_item_id: string; itemId: string; name: string; onHand: string }>`
        SELECT o.item_id AS for_item_id, a.item_id AS "itemId", i.name, sum(b.on_hand) AS "onHand"
        FROM inventory.drug_product o
        JOIN inventory.drug_product a ON lower(a.generic_name) = lower(o.generic_name) AND coalesce(lower(a.strength), '') = coalesce(lower(o.strength), '')
                                      AND a.dosage_form = o.dosage_form AND a.item_id <> o.item_id
        JOIN inventory.item i ON i.id = a.item_id AND i.status = 'active'
        JOIN inventory.stock_balance b ON b.item_id = a.item_id AND b.store_id = ${input.storeId} AND b.on_hand > 0
        WHERE o.item_id = ANY(${itemIds}::uuid[])
        GROUP BY 1, 2, 3`.execute(ctx.tx);
      stock = Object.fromEntries(itemIds.map((id) => [id, { batches: batches.filter((b) => b.itemId === id), alternatives: alternatives.rows.filter((a) => a.for_item_id === id).map(({ for_item_id: _, ...a }) => a) }]));
    }
    const dispenses = await dispensesWhere(ctx.tx, input.prescriptionId ? { prescriptionId: input.prescriptionId } : { patientIndentId: input.patientIndentId! });
    return {
      patient: { patientId: patient.id, mrn: patient.mrn, name: [patient.given_name, patient.middle_name, patient.family_name].filter(Boolean).join(' '), sex: patient.sex, birthDate: patient.birth_date },
      allergies,
      prescription,
      indent,
      stock,
      dispenses,
    };
  });
}

async function dispensesWhere(tx: Transaction<DB>, where: { prescriptionId?: string; patientIndentId?: string; facilityId?: string; since?: Date }) {
  let q = tx
    .selectFrom('pharmacy.dispense as d')
    .innerJoin('patient.patient as pt', 'pt.id', 'd.patient_id')
    .innerJoin('platform.staff as s', 's.id', 'd.dispensed_by')
    .select(['d.id as dispenseId', 'd.dispense_no as dispenseNo', 'd.dispense_type as dispenseType', 'd.status', 'd.dispensed_at as dispensedAt', 'd.handed_over_to as handedOverTo', 'd.patient_id as patientId', 'pt.mrn', name.as('patientName'), 's.display_name as dispensedBy', 'd.prescription_id as prescriptionId', 'd.patient_indent_id as patientIndentId'])
    .orderBy('d.dispensed_at', 'desc')
    .limit(200);
  if (where.prescriptionId) q = q.where('d.prescription_id', '=', where.prescriptionId);
  if (where.patientIndentId) q = q.where('d.patient_indent_id', '=', where.patientIndentId);
  if (where.facilityId) q = q.where('d.facility_id', '=', where.facilityId);
  if (where.since) q = q.where('d.dispensed_at', '>=', where.since);
  const ds = await q.execute();
  if (!ds.length) return [];
  const lines = await tx
    .selectFrom('pharmacy.dispense_line as l')
    .innerJoin('inventory.item as it', 'it.id', 'l.item_id')
    .innerJoin('inventory.item_batch as ib', 'ib.id', 'l.item_batch_id')
    .select(['l.id as dispenseLineId', 'l.dispense_id as dispenseId', 'l.item_id as itemId', 'it.name as itemName', 'ib.batch_no as batchNo', 'ib.expiry_date as expiryDate', 'l.quantity', 'l.returned_qty as returnedQty', 'l.mrp_snapshot_minor as mrpMinor', 'l.unit_price_minor as unitPriceMinor', 'l.substituted_from_item_id as substitutedFromItemId', 'l.prescription_item_id as prescriptionItemId'])
    .where('l.dispense_id', 'in', ds.map((d) => d.dispenseId))
    .execute();
  return ds.map((d) => ({ ...d, lines: lines.filter((l) => l.dispenseId === d.dispenseId) }));
}

/** Recent dispenses at a clinic (for hand-over and returns). */
export async function listDispenses(db: Kysely<DB>, caller: Caller, input: { facilityId: string; days?: Opt<number> }) {
  const since = new Date(clock(caller).getTime() - (input.days ?? 7) * 86_400_000);
  return runQuery(db, caller.tenantId, (tx) => dispensesWhere(tx, { facilityId: input.facilityId, since }));
}

/** Schedule H1 / X and NDPS register for a clinic and period (audited: it names patients). */
export async function controlledDrugRegister(db: Kysely<DB>, caller: Caller, input: { facilityId: string; from: string; to: string }) {
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.view_register' }, async (ctx) => {
    ctx.audit({ action: 'view', subjectType: 'pharmacy.controlled_drug_register', subjectId: input.facilityId, reason: `${input.from}..${input.to}` });
    const { rows } = await sql<Record<string, unknown>>`
      SELECT dispense_no AS "dispenseNo", dispensed_at AS "dispensedAt", mrn, patient_name AS "patientName", prescriber_name AS "prescriberName",
             item_name AS "itemName", generic_name AS "genericName", regulatory_schedule AS schedule, is_ndps AS "isNdps", batch_no AS "batchNo",
             quantity, returned_qty AS "returnedQty"
      FROM pharmacy.controlled_drug_register
      WHERE facility_id = ${input.facilityId}
        AND dispensed_at >= (${input.from}::date AT TIME ZONE 'Asia/Kolkata')
        AND dispensed_at < ((${input.to}::date + 1) AT TIME ZONE 'Asia/Kolkata')
      ORDER BY dispensed_at`.execute(ctx.tx);
    return rows;
  });
}

/** Colleagues who can witness a controlled or high-alert dose at a clinic. */
export async function listWitnesses(db: Kysely<DB>, caller: Caller, facilityId: string) {
  return runQuery(db, caller.tenantId, (tx) => witnessesAt(tx, facilityId, clock(caller)));
}
