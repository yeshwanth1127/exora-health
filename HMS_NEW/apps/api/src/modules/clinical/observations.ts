// Vital signs and other measurements, recorded against an active encounter.
import { randomUUID } from 'node:crypto';
import type { DB, Kysely } from '@hms/db';
import { invalid, notFound, preconditionFailed, runCommand } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { assertChartAccess, ensureEncounterAccess, lockEncounter } from './access.ts';

export interface RecordVitalsInput {
  encounterId: string;
  effectiveAt?: string; // when measured; default now
  values: Array<{ code: string; value: number | string }>;
}

/** Records one capture of vitals (codes are the tenant's observation definitions, e.g. BP_SYS, PULSE). */
export async function recordVitals(db: Kysely<DB>, caller: Caller, input: RecordVitalsInput) {
  if (!input.values.length) throw invalid('give at least one value');
  const codes = input.values.map((v) => v.code);
  if (new Set(codes).size !== codes.length) throw invalid('each code may appear once per capture');
  const now = clock(caller);
  const effectiveAt = input.effectiveAt ? new Date(input.effectiveAt) : now;
  if (effectiveAt.getTime() > now.getTime() + 5 * 60_000) throw invalid('effectiveAt cannot be in the future');
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.record_vitals', request: input }, async (ctx) => {
    const enc = await lockEncounter(ctx.tx, input.encounterId);
    if (enc.status !== 'arrived' && enc.status !== 'in_progress') throw preconditionFailed(`vitals can't be added to a ${enc.status} encounter`);
    await ensureEncounterAccess(ctx, enc, now);
    const defs = await ctx.tx
      .selectFrom('catalog.observation_definition')
      .select(['id', 'code', 'name', 'category', 'value_type', 'unit'])
      .where('code', 'in', codes)
      .where('category', 'in', ['vital_sign', 'score', 'measurement'])
      .where('status', '=', 'active')
      .execute();
    const byCode = new Map(defs.map((d) => [d.code, d]));
    const unknown = codes.filter((c) => !byCode.has(c));
    if (unknown.length) throw invalid('unknown observation codes', { unknown });
    const groupId = randomUUID();
    const rows = input.values.map((v) => {
      const def = byCode.get(v.code)!;
      const numeric = def.value_type === 'numeric';
      const n = typeof v.value === 'number' ? v.value : Number(v.value);
      if (numeric && !Number.isFinite(n)) throw invalid(`${v.code} needs a number`);
      return {
        tenant_id: ctx.tenantId,
        patient_id: enc.patient_id,
        encounter_id: enc.id,
        observation_definition_id: def.id,
        code: def.code,
        display: def.name,
        category: def.category === 'vital_sign' ? 'vital_sign' : def.category === 'score' ? 'score' : 'measurement',
        value_num: numeric ? String(n) : null,
        value_text: numeric ? null : String(v.value),
        unit: def.unit,
        group_id: groupId,
        effective_at: effectiveAt,
        recorded_by: ctx.actor.staffId!,
      };
    });
    const inserted = await ctx.tx.insertInto('clinical.observation').values(rows).returning(['id', 'code']).execute();
    ctx.audit({ action: 'create', subjectType: 'clinical.observation', subjectId: groupId, patientId: enc.patient_id });
    ctx.emit({ eventType: 'observation.recorded', aggregateType: 'clinical.encounter', aggregateId: enc.id, payload: { encounterId: enc.id, groupId, codes } });
    return { groupId, observations: inserted.map((o) => ({ observationId: o.id, code: o.code })) };
  });
}

/** Corrects a recorded value (new row superseding the old) or marks it entered in error. */
export async function correctObservation(db: Kysely<DB>, caller: Caller, input: { observationId: string; reason: string; value?: number | string }) {
  if (input.reason.trim().length < 3) throw invalid('a reason is required');
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.correct_observation', request: input }, async (ctx) => {
    const old = await ctx.tx.selectFrom('clinical.observation').selectAll().where('id', '=', input.observationId).forUpdate().executeTakeFirst();
    if (!old) throw notFound('observation', input);
    if (old.status !== 'final') throw preconditionFailed(`observation is already ${old.status}`);
    await assertChartAccess(ctx.tx, ctx.actor.staffId, old.patient_id, now);
    const amend = input.value !== undefined;
    await ctx.tx
      .updateTable('clinical.observation')
      .set({ status: amend ? 'amended' : 'entered_in_error', status_reason: input.reason })
      .where('id', '=', old.id)
      .execute();
    let replacementId: string | null = null;
    if (amend) {
      const numeric = old.value_num !== null;
      const n = Number(input.value);
      if (numeric && !Number.isFinite(n)) throw invalid('value must be a number');
      const { id } = await ctx.tx
        .insertInto('clinical.observation')
        .values({
          tenant_id: ctx.tenantId,
          patient_id: old.patient_id,
          encounter_id: old.encounter_id,
          observation_definition_id: old.observation_definition_id,
          code: old.code,
          display: old.display,
          category: old.category,
          value_num: numeric ? String(n) : null,
          value_text: numeric ? null : String(input.value),
          unit: old.unit,
          group_id: old.group_id,
          effective_at: old.effective_at,
          recorded_by: ctx.actor.staffId!,
          supersedes_id: old.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      replacementId = id;
    }
    ctx.audit({ action: 'update', subjectType: 'clinical.observation', subjectId: old.id, patientId: old.patient_id, reason: input.reason });
    return { observationId: old.id, status: amend ? 'amended' : 'entered_in_error', replacementId };
  });
}
