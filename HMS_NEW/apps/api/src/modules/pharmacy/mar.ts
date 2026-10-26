// Medication administration record (MAR) for admitted patients: the day's scheduled doses of every active
// inpatient order (clinic dose times per frequency), and charting each dose as given, held, refused or
// not given. A scheduled dose is charted given once (unique index); PRN doses keep their minimum interval;
// Schedule H1/X, NDPS and high-alert drugs need a second staff member as witness.
import type { DB, Kysely } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';

/** Clinic-local dose times for each frequency (STAT is once at the order's start; SOS/PRN has none). */
export const DOSE_TIMES: Record<string, string[]> = {
  OD: ['09:00'], BD: ['09:00', '21:00'], TDS: ['08:00', '14:00', '20:00'], QID: ['06:00', '12:00', '18:00', '22:00'], HS: ['22:00'],
  Q4H: ['02:00', '06:00', '10:00', '14:00', '18:00', '22:00'], Q6H: ['00:00', '06:00', '12:00', '18:00'], Q8H: ['06:00', '14:00', '22:00'],
};

/** An instant for a clinic-local date and time (fixed-offset zones; Asia/Kolkata is +05:30). */
function localInstant(day: string, time: string, timezone: string) {
  const noon = new Date(`${day}T12:00:00Z`);
  const offset = new Date(noon.toLocaleString('en-US', { timeZone: timezone })).getTime() - noon.getTime();
  return new Date(Date.parse(`${day}T${time}:00Z`) - offset);
}

export async function marForDay(db: Kysely<DB>, caller: Caller, q: { admissionId: string; date: string }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const a = await tx.selectFrom('inpatient.admission as a').innerJoin('platform.facility as f', 'f.id', 'a.facility_id')
      .select(['a.id', 'a.patient_id', 'f.timezone']).where('a.id', '=', q.admissionId).executeTakeFirst();
    if (!a) throw notFound('admission', { admissionId: q.admissionId });
    const lines = await tx.selectFrom('pharmacy.prescription_item as l').innerJoin('pharmacy.prescription as p', 'p.id', 'l.prescription_id')
      .innerJoin('clinical.encounter as e', 'e.id', 'p.encounter_id')
      .leftJoin('inventory.drug_product as d', 'd.item_id', 'l.item_id')
      .select(['l.id', 'l.generic_name', 'l.brand_name', 'l.strength', 'l.dose', 'l.dose_unit', 'l.route', 'l.frequency_code', 'l.is_prn', 'l.status', 'l.instructions', 'l.version',
        'p.signed_at', 'l.stop_at', 'd.regulatory_schedule', 'd.is_ndps', 'd.is_high_alert'])
      .where('e.admission_id', '=', a.id).where('p.setting', '=', 'inpatient').where('p.status', 'in', ['signed', 'partially_dispensed', 'completed'])
      .where('l.status', 'in', ['active', 'held', 'stopped']).orderBy('p.signed_at').orderBy('l.line_no').execute();
    const dayStart = localInstant(q.date, '00:00', a.timezone);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const doses = await tx.selectFrom('pharmacy.medication_administration').selectAll()
      .where('prescription_item_id', 'in', lines.length ? lines.map((l) => l.id) : ['00000000-0000-0000-0000-000000000000'])
      .where((eb) => eb.or([eb.and([eb('scheduled_at', '>=', dayStart), eb('scheduled_at', '<', dayEnd)]), eb.and([eb('scheduled_at', 'is', null), eb('recorded_at', '>=', dayStart), eb('recorded_at', '<', dayEnd)])]))
      .orderBy('recorded_at').execute();
    return {
      admissionId: a.id, date: q.date,
      orders: lines.map((l) => {
        const times = l.frequency_code === 'STAT' ? [] : DOSE_TIMES[l.frequency_code] ?? [];
        const signed = l.signed_at ? new Date(l.signed_at) : dayStart;
        const stop = l.stop_at ? new Date(l.stop_at) : null;
        const scheduled = l.is_prn ? [] : times.map((t) => localInstant(q.date, t, a.timezone)).filter((at) => at >= signed && (!stop || at < stop));
        if (l.frequency_code === 'STAT' && signed >= dayStart && signed < dayEnd) scheduled.push(signed);
        const mine = doses.filter((d) => d.prescription_item_id === l.id);
        return {
          prescriptionItemId: l.id, drug: [l.generic_name, l.strength].filter(Boolean).join(' '), brandName: l.brand_name, dose: Number(l.dose), doseUnit: l.dose_unit, route: l.route,
          frequency: l.frequency_code, isPrn: l.is_prn, status: l.status, instructions: l.instructions, version: l.version,
          requiresWitness: ['H1', 'X'].includes(l.regulatory_schedule ?? '') || !!l.is_ndps || !!l.is_high_alert,
          slots: scheduled.map((at) => ({ scheduledAt: at.toISOString(), charted: mine.filter((d) => d.scheduled_at && new Date(d.scheduled_at).getTime() === at.getTime()).map((d) => ({ status: d.status, administeredAt: d.administered_at, administeredBy: d.administered_by, reason: d.reason })) })),
          prnDoses: mine.filter((d) => d.is_prn).map((d) => ({ status: d.status, administeredAt: d.administered_at, administeredBy: d.administered_by, prnReason: d.prn_reason })),
        };
      }),
    };
  });
}

export interface AdministrationInput {
  admissionId: string;
  prescriptionItemId: string;
  status: 'given' | 'not_given' | 'held' | 'refused' | 'self_administered';
  scheduledAt?: string | undefined;
  administeredAt?: string | undefined;
  doseGiven?: number | undefined;
  doseUnit?: string | undefined;
  route?: string | undefined;
  site?: string | undefined;
  reason?: string | undefined;
  prnReason?: string | undefined;
  witnessStaffId?: string | undefined;
  dispenseLineId?: string | undefined;
}

export async function recordAdministration(db: Kysely<DB>, caller: Caller, input: AdministrationInput, idempotencyKey: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.record_administration', idempotencyKey, request: input }, async (ctx) => {
    const line = await ctx.tx.selectFrom('pharmacy.prescription_item as l').innerJoin('pharmacy.prescription as p', 'p.id', 'l.prescription_id')
      .innerJoin('clinical.encounter as e', 'e.id', 'p.encounter_id').leftJoin('inventory.drug_product as d', 'd.item_id', 'l.item_id')
      .select(['l.id', 'l.status', 'l.is_prn', 'l.prn_min_interval_minutes', 'l.dose', 'l.dose_unit', 'l.route', 'p.setting', 'p.status as rxStatus', 'p.patient_id', 'e.id as encounterId',
        'e.admission_id', 'd.regulatory_schedule', 'd.is_ndps', 'd.is_high_alert'])
      .where('l.id', '=', input.prescriptionItemId).forUpdate('l').executeTakeFirst();
    if (!line || line.admission_id !== input.admissionId) throw notFound('order for this stay', { prescriptionItemId: input.prescriptionItemId });
    if (line.setting !== 'inpatient' || !['signed', 'partially_dispensed', 'completed'].includes(line.rxStatus)) throw preconditionFailed('only signed inpatient orders are charted', { reason: 'not_inpatient_order' });
    const admission = await ctx.tx.selectFrom('inpatient.admission').select('status').where('id', '=', input.admissionId).executeTakeFirstOrThrow();
    if (admission.status !== 'admitted' && admission.status !== 'discharge_planned') throw preconditionFailed(`the patient is ${admission.status.replaceAll('_', ' ')}`, { reason: 'not_admitted' });
    const given = input.status === 'given' || input.status === 'self_administered';
    if (given && line.status !== 'active') throw preconditionFailed(`the order is ${line.status}`, { reason: 'order_not_active' });
    if (!line.is_prn && !input.scheduledAt) throw invalid('which scheduled dose is this?', { reason: 'scheduled_at_required' });
    const administeredAt = given ? new Date(input.administeredAt ?? now.toISOString()) : null;
    if (line.is_prn && given) {
      const last = await ctx.tx.selectFrom('pharmacy.medication_administration').select('administered_at').where('prescription_item_id', '=', line.id)
        .where('status', '=', 'given').orderBy('administered_at', 'desc').executeTakeFirst();
      const gap = (line.prn_min_interval_minutes ?? 0) * 60_000;
      if (last?.administered_at && administeredAt!.getTime() - new Date(last.administered_at).getTime() < gap) {
        throw preconditionFailed(`the last dose was less than ${line.prn_min_interval_minutes} minutes ago`, { reason: 'prn_too_soon', lastGivenAt: last.administered_at });
      }
    }
    const requiresWitness = ['H1', 'X'].includes(line.regulatory_schedule ?? '') || !!line.is_ndps || !!line.is_high_alert;
    if (input.witnessStaffId) {
      const w = await ctx.tx.selectFrom('platform.staff').select(['status', 'staff_type']).where('id', '=', input.witnessStaffId).executeTakeFirst();
      if (!w || w.status !== 'active' || !['nurse', 'doctor', 'pharmacist'].includes(w.staff_type)) throw invalid('the witness must be an active nurse, doctor or pharmacist', { reason: 'invalid_witness' });
      if (input.witnessStaffId === ctx.actor.staffId) throw invalid('a witness is someone else', { reason: 'self_witness' });
    }
    if (requiresWitness && input.status === 'given' && !input.witnessStaffId) throw preconditionFailed('this drug needs a witness', { reason: 'witness_required' });
    try {
      const r = await ctx.tx.insertInto('pharmacy.medication_administration').values({
        tenant_id: ctx.tenantId, prescription_item_id: line.id, patient_id: line.patient_id, encounter_id: line.encounterId, dispense_line_id: input.dispenseLineId ?? null,
        scheduled_at: input.scheduledAt ? new Date(input.scheduledAt) : null, administered_at: administeredAt, recorded_at: now,
        dose_given: given ? input.doseGiven ?? Number(line.dose) : null, dose_unit: given ? input.doseUnit ?? line.dose_unit : null,
        route: (input.route ?? line.route) as never, site: input.site ?? null, status: input.status, reason: input.reason ?? null,
        is_prn: line.is_prn, prn_reason: input.prnReason ?? null, administered_by: ctx.actor.staffId!, requires_witness: requiresWitness,
        witness_staff_id: input.witnessStaffId ?? null,
      }).returning('id').executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'pharmacy.medication_administration', subjectId: r.id, patientId: line.patient_id, reason: input.reason, diff: { status: input.status, scheduledAt: input.scheduledAt ?? null } });
      ctx.emit({ eventType: 'administration.recorded', aggregateType: 'pharmacy.medication_administration', aggregateId: r.id, payload: { administrationId: r.id, prescriptionItemId: line.id, status: input.status } });
      return { administrationId: r.id, status: input.status };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('this dose is already charted as given', { reason: 'dose_already_given' });
      if (pgCode(err) === '23514') throw invalid('the dose record is incomplete (a reason is needed when not given; a PRN dose needs its reason)', { reason: 'incomplete_record' });
      throw err;
    }
  });
}

