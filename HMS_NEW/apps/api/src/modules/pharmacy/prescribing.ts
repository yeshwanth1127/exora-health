// Prescribing (ERD m09): a prescription is written as a draft on an open encounter, then signed by its
// prescriber, who must hold a current registration. Signing checks the patient's active allergies and
// duplicate therapy; each warning needs the prescriber's override reason, kept on the line. Teleconsult
// prescriptions may not carry drugs the telemedicine guidelines prohibit. A pharmacist then verifies it.
import type { DB, Kysely, Transaction } from '@hms/db';
import { forbidden, invalid, notFound, preconditionFailed, runCommand, runQuery } from '@hms/platform';
import { clock, hospitalDay, type Caller } from '../../caller.ts';
import { assertChartAccess } from '../clinical/access.ts';
import { actor, assertPharmacyActive, pharmacyError } from './state.ts';

type Opt<T> = T | undefined;
const OPEN = ['arrived', 'in_progress'];
const SIGNED = ['signed', 'verified', 'partially_dispensed', 'on_hold'];

export interface PrescriptionLineInput {
  itemId: string;
  dose: number;
  doseUnit: string;
  route?: Opt<string>;
  frequencyCode: string;
  frequencyText?: Opt<string>;
  durationValue?: Opt<number>;
  durationUnit?: Opt<string>;
  quantity?: Opt<number>;
  isPrn?: Opt<boolean>;
  prnMinIntervalMinutes?: Opt<number>;
  foodRelation?: Opt<string>;
  instructions?: Opt<string>;
  substitutionAllowed?: Opt<boolean>;
  startAt?: Opt<string>;
}

/** Drugs a prescriber can pick: active items with a drug profile. */
export async function searchDrugs(db: Kysely<DB>, caller: Caller, input: { q?: Opt<string>; limit?: Opt<number> }) {
  return runQuery(db, caller.tenantId, (tx) => {
    let q = tx
      .selectFrom('inventory.item as i')
      .innerJoin('inventory.drug_product as d', 'd.item_id', 'i.id')
      .select([
        'i.id as itemId', 'i.code', 'i.name', 'i.base_uom as baseUom', 'd.generic_name as genericName', 'd.brand_name as brandName', 'd.strength',
        'd.dosage_form as dosageForm', 'd.default_route as defaultRoute', 'd.regulatory_schedule as schedule', 'd.is_ndps as isNdps',
        'd.is_high_alert as isHighAlert', 'd.tele_list as teleList',
      ])
      .where('i.status', '=', 'active');
    if (input.q) {
      const like = `%${input.q.toLowerCase().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      q = q.where((eb) => eb.or([eb(eb.fn('lower', ['i.name']), 'like', like), eb(eb.fn('lower', ['d.generic_name']), 'like', like), eb('i.code', 'like', like.toUpperCase())]));
    }
    return q.orderBy('i.name').limit(input.limit ?? 20).execute();
  });
}

async function drugsOf(tx: Transaction<DB>, ids: string[]) {
  const rows = await tx
    .selectFrom('inventory.item as i')
    .innerJoin('inventory.drug_product as d', 'd.item_id', 'i.id')
    .select(['i.id', 'i.name', 'i.status', 'd.generic_name', 'd.brand_name', 'd.strength', 'd.default_route', 'd.regulatory_schedule', 'd.is_ndps', 'd.is_high_alert', 'd.tele_list'])
    .where('i.id', 'in', ids)
    .execute();
  return new Map(rows.map((r) => [r.id, r]));
}

export async function createPrescription(
  db: Kysely<DB>,
  caller: Caller,
  input: { encounterId: string; setting?: Opt<'outpatient' | 'inpatient' | 'discharge' | 'virtual'>; advice?: Opt<string>; validUntil?: Opt<string>; items: PrescriptionLineInput[] },
  idempotencyKey: string,
) {
  await assertPharmacyActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.create_prescription', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    const enc = await ctx.tx.selectFrom('clinical.encounter').select(['id', 'patient_id', 'facility_id', 'status', 'encounter_class']).where('id', '=', input.encounterId).executeTakeFirst();
    if (!enc) throw notFound('encounter', { encounterId: input.encounterId });
    if (!OPEN.includes(enc.status)) throw preconditionFailed(`a ${enc.status} encounter can't take a new prescription`, { reason: 'encounter_closed' });
    await assertChartAccess(ctx.tx, me, enc.patient_id, now);
    const setting = input.setting ?? (enc.encounter_class === 'virtual' ? 'virtual' : enc.encounter_class === 'inpatient' || enc.encounter_class === 'day_care' ? 'inpatient' : 'outpatient');
    if (input.validUntil && input.validUntil < hospitalDay(now)) throw invalid('validUntil is in the past', { reason: 'valid_until_past' });

    const drugs = await drugsOf(ctx.tx, [...new Set(input.items.map((l) => l.itemId))]);
    const bad = input.items.filter((l) => drugs.get(l.itemId)?.status !== 'active').map((l) => l.itemId);
    if (bad.length) throw invalid('only active drugs can be prescribed', { reason: 'not_a_drug', itemIds: bad });
    if (setting !== 'inpatient') {
      const noQty = input.items.filter((l) => !l.quantity).map((l) => l.itemId);
      if (noQty.length) throw invalid('a take-home prescription needs the quantity to dispense', { reason: 'quantity_required', itemIds: noQty });
    }

    const rx = await ctx.tx
      .insertInto('pharmacy.prescription')
      .values({ tenant_id: ctx.tenantId, encounter_id: enc.id, patient_id: enc.patient_id, facility_id: enc.facility_id, setting, prescriber_staff_id: me, advice: input.advice?.trim() || null, valid_until: input.validUntil ?? null, created_by: me })
      .returning('id')
      .executeTakeFirstOrThrow();
    const items = [];
    for (const [i, l] of input.items.entries()) {
      const d = drugs.get(l.itemId)!;
      const route = l.route ?? d.default_route;
      if (!route) throw invalid(`${d.name} needs a route`, { reason: 'route_required', itemId: l.itemId });
      const { id } = await ctx.tx
        .insertInto('pharmacy.prescription_item')
        .values({
          tenant_id: ctx.tenantId,
          prescription_id: rx.id,
          line_no: i + 1,
          item_id: l.itemId,
          generic_name: d.generic_name,
          brand_name: d.brand_name,
          strength: d.strength,
          dose: String(l.dose),
          dose_unit: l.doseUnit,
          route,
          frequency_code: l.frequencyCode,
          frequency_text: l.frequencyText ?? null,
          duration_value: l.durationValue ?? null,
          duration_unit: l.durationUnit ?? null,
          quantity_prescribed: l.quantity ? String(l.quantity) : null,
          is_prn: l.isPrn ?? l.frequencyCode === 'SOS',
          prn_min_interval_minutes: l.prnMinIntervalMinutes ?? null,
          food_relation: l.foodRelation ?? 'any',
          instructions: l.instructions?.trim() || null,
          substitution_allowed: l.substitutionAllowed ?? true,
          start_at: l.startAt ?? null,
          created_by: me,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
        .catch(pharmacyError);
      items.push({ prescriptionItemId: id, lineNo: i + 1, itemId: l.itemId });
    }
    ctx.audit({ action: 'create', subjectType: 'pharmacy.prescription', subjectId: rx.id, patientId: enc.patient_id, diff: { setting, lines: items.length } });
    return { prescriptionId: rx.id, status: 'draft', setting, items };
  });
}

export interface Warning {
  kind: 'allergy' | 'duplicate_therapy';
  detail: string;
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Allergy and duplicate-therapy warnings per line number. */
async function warningsFor(tx: Transaction<DB>, rx: { id: string; patient_id: string }, lines: { line_no: number; item_id: string; generic_name: string; brand_name: string | null }[], names: Map<string, string>) {
  const allergies = await tx.selectFrom('clinical.allergy_intolerance').select(['substance', 'reaction', 'severity']).where('patient_id', '=', rx.patient_id).where('status', '=', 'active').execute();
  const current = await tx
    .selectFrom('pharmacy.prescription_item as i')
    .innerJoin('pharmacy.prescription as p', 'p.id', 'i.prescription_id')
    .select(['i.generic_name', 'p.id'])
    .where('p.patient_id', '=', rx.patient_id)
    .where('p.id', '<>', rx.id)
    .where('p.status', 'in', SIGNED)
    .where('i.status', 'in', ['active', 'held'])
    .execute();
  const out = new Map<number, Warning[]>();
  for (const l of lines) {
    const w: Warning[] = [];
    const words = [norm(l.generic_name), norm(l.brand_name), norm(names.get(l.item_id))].filter(Boolean);
    for (const a of allergies) {
      const s = norm(a.substance);
      if (s && words.some((x) => x.includes(s) || s.includes(x))) w.push({ kind: 'allergy', detail: `allergic to ${a.substance}${a.reaction ? ` (${a.reaction})` : ''}${a.severity ? `, ${a.severity}` : ''}` });
    }
    if (current.some((c) => norm(c.generic_name) === norm(l.generic_name))) w.push({ kind: 'duplicate_therapy', detail: `already on ${l.generic_name} from another prescription` });
    if (lines.some((o) => o.line_no !== l.line_no && norm(o.generic_name) === norm(l.generic_name))) w.push({ kind: 'duplicate_therapy', detail: `${l.generic_name} appears twice on this prescription` });
    if (w.length) out.set(l.line_no, w);
  }
  return out;
}

export async function signPrescription(db: Kysely<DB>, caller: Caller, input: { prescriptionId: string; overrides?: Opt<Record<string, string>> }) {
  await assertPharmacyActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.sign_prescription', request: input }, async (ctx) => {
    const me = actor(ctx);
    const rx = await ctx.tx.selectFrom('pharmacy.prescription').selectAll().where('id', '=', input.prescriptionId).forUpdate().executeTakeFirst();
    if (!rx) throw notFound('prescription', { prescriptionId: input.prescriptionId });
    if (rx.status !== 'draft') throw preconditionFailed(`a ${rx.status} prescription cannot be signed`, { reason: 'invalid_state' });
    if (rx.prescriber_staff_id !== me) throw forbidden('only the prescriber can sign this prescription', { reason: 'not_prescriber' });
    const registration = await ctx.tx
      .selectFrom('platform.staff_registration')
      .select('id')
      .where('staff_id', '=', me)
      .where((eb) => eb.or([eb('valid_until', 'is', null), eb('valid_until', '>=', hospitalDay(now))]))
      .executeTakeFirst();
    if (!registration) throw preconditionFailed('signing needs a current professional registration on your staff record', { reason: 'registration_required' });

    const lines = await ctx.tx.selectFrom('pharmacy.prescription_item').select(['id', 'line_no', 'item_id', 'generic_name', 'brand_name']).where('prescription_id', '=', rx.id).where('status', '=', 'active').orderBy('line_no').execute();
    if (!lines.length) throw preconditionFailed('the prescription has no lines', { reason: 'no_items' });
    const drugs = await drugsOf(ctx.tx, lines.map((l) => l.item_id));
    if (rx.setting === 'virtual') {
      const barred = lines.filter((l) => {
        const d = drugs.get(l.item_id)!;
        return d.tele_list === 'prohibited' || d.regulatory_schedule === 'X' || d.is_ndps;
      });
      if (barred.length) throw preconditionFailed('these drugs cannot be prescribed in a teleconsultation', { reason: 'not_for_teleconsult', lineNos: barred.map((l) => l.line_no) });
    }

    const warnings = await warningsFor(ctx.tx, rx, lines, new Map([...drugs].map(([id, d]) => [id, d.name])));
    const overrides = input.overrides ?? {};
    const missing = [...warnings].filter(([n]) => (overrides[String(n)] ?? '').trim().length < 3).map(([lineNo, w]) => ({ lineNo, warnings: w }));
    if (missing.length) throw preconditionFailed('some lines have warnings; give a reason to override each', { reason: 'override_required', lines: missing });
    for (const l of lines) {
      const w = warnings.get(l.line_no);
      if (w) await ctx.tx.updateTable('pharmacy.prescription_item').set({ warnings: JSON.stringify(w), override_reason: overrides[String(l.line_no)]!.trim(), updated_by: me }).where('id', '=', l.id).execute();
    }
    await ctx.tx.updateTable('pharmacy.prescription').set({ status: 'signed', signed_at: now, updated_by: me }).where('id', '=', rx.id).execute();
    const overridden = [...warnings].map(([lineNo, w]) => ({ lineNo, warnings: w, reason: overrides[String(lineNo)]!.trim() }));
    ctx.audit({ action: 'status_change', subjectType: 'pharmacy.prescription', subjectId: rx.id, patientId: rx.patient_id, reason: 'signed', diff: { overridden } });
    ctx.emit({ eventType: 'prescription.signed', aggregateType: 'pharmacy.prescription', aggregateId: rx.id, payload: { prescriptionId: rx.id, encounterId: rx.encounter_id, patientId: rx.patient_id, facilityId: rx.facility_id, setting: rx.setting } });
    return { prescriptionId: rx.id, status: 'signed', signedAt: now, overridden };
  });
}

export async function cancelPrescription(db: Kysely<DB>, caller: Caller, input: { prescriptionId: string; reason: string }) {
  await assertPharmacyActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.cancel_prescription', request: input }, async (ctx) => {
    const me = actor(ctx);
    const rx = await ctx.tx.selectFrom('pharmacy.prescription').selectAll().where('id', '=', input.prescriptionId).forUpdate().executeTakeFirst();
    if (!rx) throw notFound('prescription', { prescriptionId: input.prescriptionId });
    if (rx.prescriber_staff_id !== me) throw forbidden('only the prescriber can cancel this prescription', { reason: 'not_prescriber' });
    if (['cancelled', 'completed', 'partially_dispensed'].includes(rx.status)) throw preconditionFailed(`a ${rx.status.replace('_', ' ')} prescription cannot be cancelled; stop its lines instead`, { reason: 'invalid_state' });
    await ctx.tx.updateTable('pharmacy.prescription_item').set({ status: 'cancelled', updated_by: me }).where('prescription_id', '=', rx.id).where('status', 'in', ['active', 'held']).execute();
    await ctx.tx.updateTable('pharmacy.prescription').set({ status: 'cancelled', cancel_reason: input.reason, cancelled_at: now, cancelled_by: me, updated_by: me }).where('id', '=', rx.id).execute().catch(pharmacyError);
    ctx.audit({ action: 'status_change', subjectType: 'pharmacy.prescription', subjectId: rx.id, patientId: rx.patient_id, reason: input.reason });
    ctx.emit({ eventType: 'prescription.cancelled', aggregateType: 'pharmacy.prescription', aggregateId: rx.id, payload: { prescriptionId: rx.id, encounterId: rx.encounter_id } });
    return { prescriptionId: rx.id, status: 'cancelled' };
  });
}

/** Stop (discontinue) or hold / resume one line of a signed prescription; any clinician caring for the patient. */
export async function changePrescriptionItem(db: Kysely<DB>, caller: Caller, input: { prescriptionItemId: string; action: 'stop' | 'hold' | 'resume'; reason?: Opt<string> }) {
  await assertPharmacyActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.change_prescription_item', request: input }, async (ctx) => {
    const me = actor(ctx);
    const item = await ctx.tx
      .selectFrom('pharmacy.prescription_item as i')
      .innerJoin('pharmacy.prescription as p', 'p.id', 'i.prescription_id')
      .select(['i.id', 'i.status', 'p.status as rx_status', 'p.patient_id', 'p.id as prescription_id'])
      .where('i.id', '=', input.prescriptionItemId)
      .forUpdate('i')
      .executeTakeFirst();
    if (!item) throw notFound('prescription line', { prescriptionItemId: input.prescriptionItemId });
    await assertChartAccess(ctx.tx, me, item.patient_id, now);
    if (!SIGNED.includes(item.rx_status)) throw preconditionFailed(`lines of a ${item.rx_status} prescription can't be changed this way`, { reason: 'invalid_state' });
    const from = { stop: ['active', 'held'], hold: ['active'], resume: ['held'] }[input.action];
    if (!from.includes(item.status)) throw preconditionFailed(`a ${item.status} line can't ${input.action}`, { reason: 'invalid_state' });
    if (input.action !== 'resume' && !input.reason?.trim()) throw invalid('a reason is required', { reason: 'reason_required' });
    const to = { stop: 'stopped', hold: 'held', resume: 'active' }[input.action];
    await ctx.tx
      .updateTable('pharmacy.prescription_item')
      .set(input.action === 'stop' ? { status: to, stop_at: now, stopped_by: me, stop_reason: input.reason!.trim(), updated_by: me } : { status: to, updated_by: me })
      .where('id', '=', item.id)
      .execute()
      .catch(pharmacyError);
    ctx.audit({ action: 'status_change', subjectType: 'pharmacy.prescription_item', subjectId: item.id, patientId: item.patient_id, reason: input.reason ?? input.action });
    ctx.emit({ eventType: `prescription_item.${to}`, aggregateType: 'pharmacy.prescription_item', aggregateId: item.id, payload: { prescriptionItemId: item.id, prescriptionId: item.prescription_id } });
    return { prescriptionItemId: item.id, status: to };
  });
}

/** Pharmacist verification: approve (ready to dispense), or reject / query (on hold, with notes). Not by the prescriber. */
export async function verifyPrescription(db: Kysely<DB>, caller: Caller, input: { prescriptionId: string; outcome: 'approved' | 'rejected' | 'query'; notes?: Opt<string> }) {
  await assertPharmacyActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.verify_prescription', request: input }, async (ctx) => {
    const me = actor(ctx);
    const rx = await ctx.tx.selectFrom('pharmacy.prescription').selectAll().where('id', '=', input.prescriptionId).forUpdate().executeTakeFirst();
    if (!rx) throw notFound('prescription', { prescriptionId: input.prescriptionId });
    if (rx.prescriber_staff_id === me) throw forbidden('a prescriber cannot verify their own prescription', { reason: 'own_prescription' });
    const allowed = input.outcome === 'approved' ? ['signed', 'on_hold'] : ['signed', 'on_hold', 'verified'];
    if (!allowed.includes(rx.status)) throw preconditionFailed(`a ${rx.status} prescription can't be ${input.outcome}`, { reason: 'invalid_state' });
    if (input.outcome !== 'approved' && !input.notes?.trim()) throw invalid('say why in the notes', { reason: 'notes_required' });
    await ctx.tx.insertInto('pharmacy.pharmacy_verification').values({ tenant_id: ctx.tenantId, prescription_id: rx.id, outcome: input.outcome, notes: input.notes?.trim() || null, verified_by: me, verified_at: now }).execute();
    const status = input.outcome === 'approved' ? 'verified' : 'on_hold';
    if (status !== rx.status) await ctx.tx.updateTable('pharmacy.prescription').set({ status, updated_by: me }).where('id', '=', rx.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'pharmacy.prescription', subjectId: rx.id, patientId: rx.patient_id, reason: input.outcome, diff: { notes: input.notes ?? null } });
    ctx.emit({ eventType: `prescription.${input.outcome === 'approved' ? 'verified' : 'held'}`, aggregateType: 'pharmacy.prescription', aggregateId: rx.id, payload: { prescriptionId: rx.id, prescriberStaffId: rx.prescriber_staff_id, outcome: input.outcome } });
    return { prescriptionId: rx.id, status };
  });
}
