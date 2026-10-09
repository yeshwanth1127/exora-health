// Diagnoses: each one is a condition on the patient's problem list, linked to the encounter that
// addressed it. Re-using an existing condition (e.g. known diabetes) links it without duplicating.
import type { DB, Kysely } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { assertChartAccess, ensureEncounterAccess, lockEncounter } from './access.ts';

export interface AddDiagnosisInput {
  encounterId: string;
  role: 'admitting' | 'provisional' | 'primary' | 'secondary' | 'discharge';
  rank?: number;
  /** Link an existing condition of this patient… */
  conditionId?: string;
  /** …or describe a new one. */
  display?: string;
  codeSystem?: 'icd10_who' | 'snomed_ct' | 'local';
  code?: string;
  verificationStatus?: 'provisional' | 'differential' | 'confirmed';
  isChronic?: boolean;
  onsetOn?: string;
}

export async function addDiagnosis(db: Kysely<DB>, caller: Caller, input: AddDiagnosisInput) {
  if (!input.conditionId && !input.display?.trim()) throw invalid('give conditionId or display');
  if ((input.code === undefined) !== (input.codeSystem === undefined)) throw invalid('give code and codeSystem together');
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.add_diagnosis', request: input }, async (ctx) => {
    const enc = await lockEncounter(ctx.tx, input.encounterId);
    if (enc.status === 'cancelled' || enc.status === 'entered_in_error') throw preconditionFailed(`a ${enc.status} encounter takes no diagnoses`);
    await ensureEncounterAccess(ctx, enc, now);
    let conditionId = input.conditionId;
    if (!conditionId) {
      let conceptId: string | null = null;
      if (input.code && (input.codeSystem === 'icd10_who' || input.codeSystem === 'snomed_ct')) {
        conceptId =
          (await ctx.tx.selectFrom('catalog.terminology_concept').select('id').where('system', '=', input.codeSystem).where('code', '=', input.code).executeTakeFirst())?.id ?? null;
      }
      const row = await ctx.tx
        .insertInto('clinical.condition')
        .values({
          tenant_id: ctx.tenantId,
          patient_id: enc.patient_id,
          code_system: input.codeSystem ?? null,
          code: input.code ?? null,
          display: input.display!.trim(),
          concept_id: conceptId,
          verification_status: input.verificationStatus ?? (input.role === 'provisional' ? 'provisional' : 'confirmed'),
          is_chronic: input.isChronic ?? false,
          onset_on: input.onsetOn ?? null,
          recorded_by: ctx.actor.staffId!,
          source_encounter_id: enc.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      conditionId = row.id;
    }
    try {
      const { id } = await ctx.tx
        .insertInto('clinical.encounter_diagnosis')
        .values({ tenant_id: ctx.tenantId, encounter_id: enc.id, patient_id: enc.patient_id, condition_id: conditionId, role: input.role, rank: input.rank ?? 1 })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'clinical.encounter_diagnosis', subjectId: id, patientId: enc.patient_id });
      return { encounterDiagnosisId: id, conditionId };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict(input.role === 'primary' ? 'this encounter already has a primary diagnosis' : 'diagnosis already recorded in that role');
      if (pgCode(err) === '23503') throw notFound('condition for this patient', { conditionId });
      throw err;
    }
  });
}

/** Updates a condition on the problem list (e.g. resolved, confirmed). */
export async function updateCondition(
  db: Kysely<DB>,
  caller: Caller,
  input: { conditionId: string; clinicalStatus?: 'active' | 'recurrence' | 'remission' | 'resolved'; verificationStatus?: 'provisional' | 'differential' | 'confirmed' | 'refuted' | 'entered_in_error'; abatementOn?: string },
) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.update_condition', request: input }, async (ctx) => {
    const c = await ctx.tx.selectFrom('clinical.condition').select(['id', 'patient_id']).where('id', '=', input.conditionId).forUpdate().executeTakeFirst();
    if (!c) throw notFound('condition', input);
    await assertChartAccess(ctx.tx, ctx.actor.staffId, c.patient_id, now);
    await ctx.tx
      .updateTable('clinical.condition')
      .set({
        ...(input.clinicalStatus ? { clinical_status: input.clinicalStatus } : {}),
        ...(input.verificationStatus ? { verification_status: input.verificationStatus } : {}),
        ...(input.abatementOn ? { abatement_on: input.abatementOn } : {}),
      })
      .where('id', '=', c.id)
      .execute();
    ctx.audit({ action: 'update', subjectType: 'clinical.condition', subjectId: c.id, patientId: c.patient_id, diff: input });
    return { conditionId: c.id };
  });
}
