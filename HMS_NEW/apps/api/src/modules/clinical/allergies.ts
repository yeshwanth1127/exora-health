// Allergies and intolerances (patient-level; checked when prescribing, once pharmacy exists).
import type { DB, Kysely } from '@hms/db';
import { invalid, notFound, runCommand } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { assertChartAccess } from './access.ts';

export interface RecordAllergyInput {
  patientId: string;
  category: 'drug' | 'food' | 'environment' | 'other';
  substance: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  criticality?: 'low' | 'high' | 'unable_to_assess';
}

export async function recordAllergy(db: Kysely<DB>, caller: Caller, input: RecordAllergyInput) {
  if (!input.substance.trim()) throw invalid('substance is required');
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.record_allergy', request: input }, async (ctx) => {
    await assertChartAccess(ctx.tx, ctx.actor.staffId, input.patientId, now);
    const { id } = await ctx.tx
      .insertInto('clinical.allergy_intolerance')
      .values({
        tenant_id: ctx.tenantId,
        patient_id: input.patientId,
        category: input.category,
        substance: input.substance.trim(),
        reaction: input.reaction ?? null,
        severity: input.severity ?? null,
        criticality: input.criticality ?? null,
        recorded_by: ctx.actor.staffId!,
        recorded_at: now,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'clinical.allergy_intolerance', subjectId: id, patientId: input.patientId });
    return { allergyId: id };
  });
}

export async function updateAllergyStatus(db: Kysely<DB>, caller: Caller, input: { allergyId: string; status: 'active' | 'inactive' | 'refuted' | 'entered_in_error' }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.update_allergy', request: input }, async (ctx) => {
    const a = await ctx.tx.selectFrom('clinical.allergy_intolerance').select(['id', 'patient_id']).where('id', '=', input.allergyId).forUpdate().executeTakeFirst();
    if (!a) throw notFound('allergy', input);
    await assertChartAccess(ctx.tx, ctx.actor.staffId, a.patient_id, now);
    await ctx.tx.updateTable('clinical.allergy_intolerance').set({ status: input.status }).where('id', '=', a.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'clinical.allergy_intolerance', subjectId: a.id, patientId: a.patient_id, diff: { status: input.status } });
    return { allergyId: a.id, status: input.status };
  });
}
