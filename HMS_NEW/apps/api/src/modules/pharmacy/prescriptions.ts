// Prescriptions: the doctor drafts lines on a visit (outpatient, teleconsultation, inpatient orders, or the
// discharge prescription), signs them (current registration required; recorded drug allergies must be
// overridden with a reason), and may cancel; inpatient lines are held, resumed or stopped as care goes on.
import type { DB, Kysely, Transaction } from '@hms/db';
import { conflict, forbidden, invalid, notFound, preconditionFailed, runCommand } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { hasCareAccess } from '../clinical/access.ts';

export interface PrescriptionLineInput {
  itemId: string;
  dose: number;
  doseUnit: string;
  route?: string | undefined;
  frequencyCode: 'OD' | 'BD' | 'TDS' | 'QID' | 'HS' | 'SOS' | 'STAT' | 'Q4H' | 'Q6H' | 'Q8H' | 'WEEKLY' | 'CUSTOM';
  frequencyText?: string | undefined;
  durationValue?: number | undefined;
  durationUnit?: 'days' | 'weeks' | 'months' | 'doses' | undefined;
  /** Base units to dispense; omitted for an ongoing inpatient order. */
  quantity?: number | undefined;
  isPrn?: boolean | undefined;
  prnMinIntervalMinutes?: number | undefined;
  foodRelation?: 'before_food' | 'after_food' | 'with_food' | 'empty_stomach' | 'any' | undefined;
  instructions?: string | undefined;
  substitutionAllowed?: boolean | undefined;
}

type Setting = 'outpatient' | 'inpatient' | 'discharge' | 'virtual';

async function insertLines(tx: Transaction<DB>, tenantId: string, prescriptionId: string, setting: Setting, lines: PrescriptionLineInput[], actor: string | null) {
  let no = 0;
  for (const l of lines) {
    const item = await tx.selectFrom('inventory.item as i').innerJoin('inventory.drug_product as d', 'd.item_id', 'i.id')
      .select(['i.id', 'i.status', 'd.generic_name', 'd.brand_name', 'd.strength', 'd.default_route']).where('i.id', '=', l.itemId).executeTakeFirst();
    if (!item) throw invalid('only drugs in the clinic’s list can be prescribed', { reason: 'not_a_drug', itemId: l.itemId });
    if (item.status !== 'active') throw preconditionFailed(`${item.generic_name} is not stocked any more`, { reason: 'item_inactive', itemId: l.itemId });
    if (setting !== 'inpatient' && !l.quantity && !l.isPrn) throw invalid(`give the quantity to dispense for ${item.generic_name}`, { reason: 'quantity_required', itemId: l.itemId });
    await tx.insertInto('pharmacy.prescription_item').values({
      tenant_id: tenantId, prescription_id: prescriptionId, line_no: ++no, item_id: item.id, generic_name: item.generic_name, brand_name: item.brand_name,
      strength: item.strength, dose: l.dose, dose_unit: l.doseUnit, route: (l.route ?? item.default_route ?? 'oral') as never, frequency_code: l.frequencyCode,
      frequency_text: l.frequencyText ?? null, duration_value: l.durationValue ?? null, duration_unit: l.durationUnit ?? null,
      quantity_prescribed: l.quantity ?? null, is_prn: l.isPrn ?? false, prn_min_interval_minutes: l.isPrn ? l.prnMinIntervalMinutes ?? 240 : null,
      food_relation: l.foodRelation ?? 'any', instructions: l.instructions ?? null, substitution_allowed: l.substitutionAllowed ?? true, created_by: actor,
    }).execute();
  }
}

/** Drafts a prescription on an encounter the doctor is caring for. */
export async function draftPrescription(
  db: Kysely<DB>, caller: Caller,
  input: { encounterId: string; discharge?: boolean | undefined; advice?: string | undefined; lines: PrescriptionLineInput[] },
  idempotencyKey: string,
) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.draft_prescription', idempotencyKey, request: input }, async (ctx) => {
    const enc = await ctx.tx.selectFrom('clinical.encounter').select(['id', 'patient_id', 'facility_id', 'encounter_class', 'status', 'admission_id']).where('id', '=', input.encounterId).executeTakeFirst();
    if (!enc) throw notFound('encounter', { encounterId: input.encounterId });
    if (!['arrived', 'in_progress'].includes(enc.status) && !input.discharge) throw preconditionFailed(`the visit is ${enc.status}`, { reason: 'encounter_closed' });
    const staff = await ctx.tx.selectFrom('platform.staff').select('staff_type').where('id', '=', ctx.actor.staffId!).executeTakeFirstOrThrow();
    if (staff.staff_type !== 'doctor') throw forbidden('only doctors prescribe', { reason: 'not_a_doctor' });
    if (!(await hasCareAccess(ctx.tx, ctx.actor.staffId!, enc.patient_id, now))) throw forbidden('no care relationship with this patient', { reason: 'no_care_relationship' });
    const inpatient = enc.encounter_class === 'inpatient' || enc.encounter_class === 'day_care';
    if (input.discharge && !inpatient) throw invalid('a discharge prescription belongs to an inpatient stay', { reason: 'not_inpatient' });
    const setting: Setting = input.discharge ? 'discharge' : inpatient ? 'inpatient' : enc.encounter_class === 'virtual' ? 'virtual' : 'outpatient';
    if (!input.lines.length) throw invalid('add at least one drug', { reason: 'no_lines' });
    const rx = await ctx.tx.insertInto('pharmacy.prescription').values({
      tenant_id: ctx.tenantId, encounter_id: enc.id, patient_id: enc.patient_id, facility_id: enc.facility_id, setting, prescriber_staff_id: ctx.actor.staffId!,
      advice: input.advice ?? null, created_by: ctx.actor.staffId ?? null,
    }).returning(['id', 'version']).executeTakeFirstOrThrow();
    await insertLines(ctx.tx, ctx.tenantId, rx.id, setting, input.lines, ctx.actor.staffId ?? null);
    ctx.audit({ action: 'create', subjectType: 'pharmacy.prescription', subjectId: rx.id, patientId: enc.patient_id, diff: { setting, lines: input.lines.length } });
    return { prescriptionId: rx.id, setting, status: 'draft' as const, version: rx.version };
  });
}

/** Replaces a draft's lines. */
export async function updateDraftPrescription(
  db: Kysely<DB>, caller: Caller, input: { prescriptionId: string; version: number; advice?: string | undefined; lines: PrescriptionLineInput[] }, idempotencyKey?: string,
) {
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.update_prescription', idempotencyKey, request: input }, async (ctx) => {
    const rx = await lock(ctx.tx, input.prescriptionId, input.version);
    if (rx.status !== 'draft') throw preconditionFailed('a signed prescription cannot be changed', { reason: 'prescription_signed' });
    if (rx.prescriber_staff_id !== ctx.actor.staffId) throw forbidden('only the prescriber edits a draft', { reason: 'not_prescriber' });
    await ctx.tx.deleteFrom('pharmacy.prescription_item').where('prescription_id', '=', rx.id).execute();
    await insertLines(ctx.tx, ctx.tenantId, rx.id, rx.setting as Setting, input.lines, ctx.actor.staffId ?? null);
    const { version } = await ctx.tx.updateTable('pharmacy.prescription').set({ advice: input.advice ?? rx.advice, updated_by: ctx.actor.staffId ?? null }).where('id', '=', rx.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'update', subjectType: 'pharmacy.prescription', subjectId: rx.id, patientId: rx.patient_id, diff: { lines: input.lines.length } });
    return { prescriptionId: rx.id, version };
  });
}

async function lock(tx: Transaction<DB>, prescriptionId: string, version?: number) {
  const rx = await tx.selectFrom('pharmacy.prescription').selectAll().where('id', '=', prescriptionId).forUpdate().executeTakeFirst();
  if (!rx) throw notFound('prescription', { prescriptionId });
  if (version !== undefined && rx.version !== version) throw conflict('this prescription was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: rx.version });
  return rx;
}

/**
 * Signs a draft. Recorded active drug allergies matching a line's generic name are warnings; the doctor
 * must give an override reason to sign over them (kept on the line).
 */
export async function signPrescription(db: Kysely<DB>, caller: Caller, input: { prescriptionId: string; version: number; overrideReason?: string | undefined; validDays?: number | undefined }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.sign_prescription', idempotencyKey, request: input }, async (ctx) => {
    const rx = await lock(ctx.tx, input.prescriptionId, input.version);
    if (rx.status !== 'draft') throw preconditionFailed(`prescription is ${rx.status}`, { reason: 'not_draft' });
    if (rx.prescriber_staff_id !== ctx.actor.staffId) throw forbidden('only the prescriber signs', { reason: 'not_prescriber' });
    const today = now.toISOString().slice(0, 10);
    const registration = await ctx.tx.selectFrom('platform.staff_registration').select('id').where('staff_id', '=', ctx.actor.staffId!)
      .where((eb) => eb.or([eb('valid_until', 'is', null), eb('valid_until', '>=', today)])).executeTakeFirst();
    if (!registration) throw preconditionFailed('signing needs a current professional registration on your staff record', { reason: 'registration_required' });
    const lines = await ctx.tx.selectFrom('pharmacy.prescription_item').select(['id', 'generic_name', 'brand_name']).where('prescription_id', '=', rx.id).orderBy('line_no').execute();
    const allergies = await ctx.tx.selectFrom('clinical.allergy_intolerance').select(['substance', 'severity', 'reaction'])
      .where('patient_id', '=', rx.patient_id).where('category', '=', 'drug').where('status', '=', 'active').execute();
    const warnings = lines.map((l) => ({
      line: l,
      found: allergies.filter((a) => {
        const s = a.substance.toLowerCase();
        return [l.generic_name, l.brand_name].some((n) => n && (n.toLowerCase().includes(s) || s.includes(n.toLowerCase())));
      }).map((a) => ({ kind: 'allergy', substance: a.substance, severity: a.severity, reaction: a.reaction })),
    })).filter((w) => w.found.length);
    if (warnings.length && !input.overrideReason) {
      throw preconditionFailed('the patient has a recorded allergy to a prescribed drug', { reason: 'allergy_warning', warnings: warnings.map((w) => ({ prescriptionItemId: w.line.id, drug: w.line.generic_name, allergies: w.found })) });
    }
    for (const w of warnings) {
      await ctx.tx.updateTable('pharmacy.prescription_item').set({ warnings: JSON.stringify(w.found), override_reason: input.overrideReason! }).where('id', '=', w.line.id).execute();
    }
    const validUntil = new Date(now.getTime() + (input.validDays ?? 30) * 86_400_000).toISOString().slice(0, 10);
    const { version } = await ctx.tx.updateTable('pharmacy.prescription').set({ status: 'signed', signed_at: now, valid_until: validUntil, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', rx.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'pharmacy.prescription', subjectId: rx.id, patientId: rx.patient_id, reason: input.overrideReason, diff: { status: ['draft', 'signed'], warnings: warnings.length } });
    ctx.emit({ eventType: 'prescription.signed', aggregateType: 'pharmacy.prescription', aggregateId: rx.id, aggregateVersion: version, payload: { prescriptionId: rx.id, patientId: rx.patient_id, setting: rx.setting } });
    return { prescriptionId: rx.id, status: 'signed' as const, validUntil, version, overriddenWarnings: warnings.length };
  });
}

export async function cancelPrescription(db: Kysely<DB>, caller: Caller, input: { prescriptionId: string; reason: string; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.cancel_prescription', idempotencyKey, request: input }, async (ctx) => {
    const rx = await lock(ctx.tx, input.prescriptionId, input.version);
    if (!['draft', 'signed', 'partially_dispensed'].includes(rx.status)) throw preconditionFailed(`prescription is ${rx.status}`, { reason: 'not_cancellable' });
    if (rx.prescriber_staff_id !== ctx.actor.staffId) throw forbidden('only the prescriber cancels a prescription', { reason: 'not_prescriber' });
    const { version } = await ctx.tx.updateTable('pharmacy.prescription').set({ status: 'cancelled', cancel_reason: input.reason, cancelled_at: now, cancelled_by: ctx.actor.staffId ?? null, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', rx.id).returning('version').executeTakeFirstOrThrow();
    await ctx.tx.updateTable('pharmacy.prescription_item').set({ status: 'cancelled' }).where('prescription_id', '=', rx.id).where('status', 'in', ['active', 'held']).execute();
    ctx.audit({ action: 'status_change', subjectType: 'pharmacy.prescription', subjectId: rx.id, patientId: rx.patient_id, reason: input.reason, diff: { status: [rx.status, 'cancelled'] } });
    return { prescriptionId: rx.id, status: 'cancelled' as const, version };
  });
}

/** Holds, resumes or stops one line of an inpatient order (the prescriber or another doctor caring for the patient). */
export async function changeOrderLine(db: Kysely<DB>, caller: Caller, input: { prescriptionItemId: string; action: 'hold' | 'resume' | 'stop'; reason?: string | undefined; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.change_order_line', idempotencyKey, request: input }, async (ctx) => {
    const line = await ctx.tx.selectFrom('pharmacy.prescription_item as l').innerJoin('pharmacy.prescription as p', 'p.id', 'l.prescription_id')
      .select(['l.id', 'l.status', 'l.version', 'p.patient_id', 'p.setting', 'p.status as rxStatus']).where('l.id', '=', input.prescriptionItemId).forUpdate('l').executeTakeFirst();
    if (!line) throw notFound('prescription line', { prescriptionItemId: input.prescriptionItemId });
    if (line.version !== input.version) throw conflict('this line was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: line.version });
    if (line.setting !== 'inpatient' || !['signed', 'partially_dispensed'].includes(line.rxStatus)) throw preconditionFailed('only signed inpatient orders are held or stopped', { reason: 'not_inpatient_order' });
    if (!(await hasCareAccess(ctx.tx, ctx.actor.staffId!, line.patient_id, now))) throw forbidden('no care relationship with this patient', { reason: 'no_care_relationship' });
    const moves = { hold: { from: ['active'], to: 'held' }, resume: { from: ['held'], to: 'active' }, stop: { from: ['active', 'held'], to: 'stopped' } } as const;
    const m = moves[input.action];
    if (!(m.from as readonly string[]).includes(line.status)) throw preconditionFailed(`the line is ${line.status}`, { reason: 'invalid_transition' });
    if (input.action === 'stop' && !input.reason) throw invalid('give the reason for stopping', { reason: 'reason_required' });
    const { version } = await ctx.tx.updateTable('pharmacy.prescription_item').set({
      status: m.to, ...(input.action === 'stop' ? { stop_at: now, stopped_by: ctx.actor.staffId!, stop_reason: input.reason! } : {}), updated_by: ctx.actor.staffId ?? null,
    }).where('id', '=', line.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'pharmacy.prescription_item', subjectId: line.id, patientId: line.patient_id, reason: input.reason, diff: { status: [line.status, m.to] } });
    return { prescriptionItemId: line.id, status: m.to, version };
  });
}


