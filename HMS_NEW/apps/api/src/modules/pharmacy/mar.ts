// Medication administration record (ERD m09). Each charted dose is a new row, never edited. A scheduled dose
// is charted as given once (unique index); PRN doses respect the line's minimum interval, checked under the
// prescription line's lock. Controlled (NDPS, Schedule X) and high-alert drugs need a witness.
// ponytail: the witness is named, not signed in; a witness co-sign step (their own login) is the upgrade.
import type { DB, Kysely } from '@hms/db';
import { invalid, notFound, preconditionFailed, runCommand } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { assertChartAccess } from '../clinical/access.ts';
import { actor, assertPharmacyActive, pharmacyError, witnessesAt } from './state.ts';

type Opt<T> = T | undefined;
const CHARTABLE = ['signed', 'verified', 'partially_dispensed', 'completed'];

export interface AdministrationInput {
  prescriptionItemId: string;
  status: 'given' | 'not_given' | 'held' | 'refused' | 'self_administered';
  scheduledAt?: Opt<string>;
  administeredAt?: Opt<string>;
  doseGiven?: Opt<number>;
  doseUnit?: Opt<string>;
  route?: Opt<string>;
  site?: Opt<string>;
  reason?: Opt<string>;
  prnReason?: Opt<string>;
  witnessStaffId?: Opt<string>;
  dispenseLineId?: Opt<string>;
}

export async function recordAdministration(db: Kysely<DB>, caller: Caller, input: AdministrationInput, idempotencyKey: string) {
  await assertPharmacyActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'pharmacy', name: 'pharmacy.record_administration', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    try {
      const line = await ctx.tx
        .selectFrom('pharmacy.prescription_item as i')
        .innerJoin('pharmacy.prescription as p', 'p.id', 'i.prescription_id')
        .innerJoin('inventory.drug_product as d', 'd.item_id', 'i.item_id')
        .select(['i.id', 'i.status', 'i.is_prn', 'i.prn_min_interval_minutes', 'i.dose', 'i.dose_unit', 'i.route', 'i.generic_name', 'p.status as rx_status', 'p.patient_id', 'p.encounter_id', 'd.is_high_alert', 'd.is_ndps', 'd.regulatory_schedule'])
        .where('i.id', '=', input.prescriptionItemId)
        .forUpdate('i')
        .executeTakeFirst();
      if (!line) throw notFound('prescription line', { prescriptionItemId: input.prescriptionItemId });
      await assertChartAccess(ctx.tx, me, line.patient_id, now);
      if (!CHARTABLE.includes(line.rx_status)) throw preconditionFailed(`a ${line.rx_status} prescription can't be charted`, { reason: 'not_signed' });
      const giving = input.status === 'given' || input.status === 'self_administered';
      if (giving && line.status !== 'active') throw preconditionFailed(`this line is ${line.status}`, { reason: 'line_not_active' });
      if (!giving && !input.reason?.trim()) throw invalid('say why the dose was not given', { reason: 'reason_required' });
      if (line.is_prn && input.status === 'given' && !input.prnReason?.trim()) throw invalid('a PRN dose needs its indication', { reason: 'prn_reason_required' });
      if (!line.is_prn && !input.scheduledAt)throw invalid('a scheduled dose needs scheduledAt', { reason: 'scheduled_at_required' });
      const administeredAt = giving ? new Date(input.administeredAt ?? now) : null;
      if (administeredAt && administeredAt.getTime() > now.getTime() + 5 * 60_000) throw invalid('administeredAt is in the future', { reason: 'future_time' });

      const requiresWitness = line.is_high_alert || line.is_ndps || line.regulatory_schedule === 'X';
      if (input.witnessStaffId) {
        if (input.witnessStaffId === me) throw invalid('the witness must be someone else', { reason: 'self_witness' });
        const enc = await ctx.tx.selectFrom('clinical.encounter').select('facility_id').where('id', '=', line.encounter_id).executeTakeFirstOrThrow();
        if (!(await witnessesAt(ctx.tx, enc.facility_id, now)).some((w) => w.staffId === input.witnessStaffId)) {
          throw preconditionFailed('the witness must be a nurse or doctor at this clinic', { reason: 'witness_not_eligible' });
        }
      }
      if (requiresWitness && input.status === 'given' && !input.witnessStaffId) throw preconditionFailed(`${line.generic_name} needs a witness`, { reason: 'witness_required' });

      if (line.is_prn && input.status === 'given' && line.prn_min_interval_minutes) {
        const last = await ctx.tx
          .selectFrom('pharmacy.medication_administration')
          .select('administered_at')
          .where('prescription_item_id', '=', line.id)
          .where('status', '=', 'given')
          .orderBy('administered_at', 'desc')
          .executeTakeFirst();
        const next = last?.administered_at ? new Date(new Date(last.administered_at).getTime() + line.prn_min_interval_minutes * 60_000) : null;
        if (next && administeredAt! < next) throw preconditionFailed('too soon after the last PRN dose', { reason: 'too_soon', nextAllowedAt: next.toISOString() });
      }
      if (input.dispenseLineId) {
        const dl = await ctx.tx.selectFrom('pharmacy.dispense_line').select('prescription_item_id').where('id', '=', input.dispenseLineId).executeTakeFirst();
        if (!dl || dl.prescription_item_id !== line.id) throw invalid('that dispense line is not for this prescription line', { reason: 'dispense_line_mismatch' });
      }

      const { id } = await ctx.tx
        .insertInto('pharmacy.medication_administration')
        .values({
          tenant_id: ctx.tenantId,
          prescription_item_id: line.id,
          patient_id: line.patient_id,
          encounter_id: line.encounter_id,
          dispense_line_id: input.dispenseLineId ?? null,
          scheduled_at: input.scheduledAt ?? null,
          administered_at: administeredAt,
          recorded_at: now,
          dose_given: giving ? String(input.doseGiven ?? line.dose) : input.doseGiven != null ? String(input.doseGiven) : null,
          dose_unit: giving ? (input.doseUnit ?? line.dose_unit) : (input.doseUnit ?? null),
          route: giving ? (input.route ?? line.route) : (input.route ?? null),
          site: input.site?.trim() || null,
          status: input.status,
          reason: input.reason?.trim() || null,
          is_prn: line.is_prn,
          prn_reason: input.prnReason?.trim() || null,
          administered_by: me,
          requires_witness: requiresWitness,
          witness_staff_id: input.witnessStaffId ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'pharmacy.medication_administration', subjectId: id, patientId: line.patient_id, diff: { status: input.status, scheduledAt: input.scheduledAt ?? null } });
      ctx.emit({ eventType: 'medication.administered', aggregateType: 'pharmacy.medication_administration', aggregateId: id, payload: { administrationId: id, prescriptionItemId: line.id, encounterId: line.encounter_id, status: input.status } });
      return { administrationId: id, status: input.status, requiresWitness };
    } catch (err) {
      return pharmacyError(err);
    }
  });
}
