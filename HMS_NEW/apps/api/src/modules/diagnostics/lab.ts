// The laboratory (ERD m06): specimens (collect → receive, or reject → recollect), results with
// reference limits snapshotted from the catalogue for the patient's sex and age, corrections that
// supersede, documented critical-value calls, and microbiology isolates with susceptibilities.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand } from '@hms/platform';
import { clock, hospitalDay, type Caller } from '../../caller.ts';
import { actor, assertDiagnosticsActive, moveItems, nextNo, pad, type ItemRow } from './state.ts';

type SpecimenType = 'whole_blood' | 'serum' | 'plasma' | 'urine' | 'stool' | 'csf' | 'sputum' | 'swab' | 'tissue' | 'fluid' | 'other';
type ContainerType = 'edta' | 'plain' | 'sst' | 'fluoride' | 'citrate' | 'heparin' | 'sterile' | 'other';

export interface CollectInput {
  orderItemIds?: string[] | undefined;
  /** A recollection replaces a rejected specimen for the same tests. */
  recollectionOfId?: string | undefined;
  specimenType?: SpecimenType | undefined;
  containerType?: ContainerType | undefined;
  collectionSite?: string | undefined;
  collectedAt?: string | undefined;
  barcode?: string | undefined;
}

interface LabItem extends ItemRow {
  patient_id: string;
  facility_id: string;
  category: string;
  name: string;
  specimen_type: string | null;
  container_type: string | null;
}

async function labItems(tx: Transaction<DB>, ids: string[]): Promise<LabItem[]> {
  if (!ids.length) return [];
  const { rows } = await sql<LabItem>`
    SELECT oi.id, oi.status, oi.panel_parent_item_id, oi.service_order_id, oi.patient_id, o.facility_id, s.category, s.name,
           l.specimen_type, l.container_type
    FROM diagnostics.order_item oi
    JOIN diagnostics.service_order o ON o.id = oi.service_order_id
    JOIN catalog.service_item s ON s.id = oi.service_item_id
    LEFT JOIN catalog.lab_test_def l ON l.service_item_id = s.id
    WHERE oi.id = ANY(${ids}::uuid[])
    FOR UPDATE OF oi`.execute(tx);
  return rows;
}

/** Draws one specimen for one or more lab tests of the same patient; numbers it (accession, barcode). */
export async function collectSpecimen(db: Kysely<DB>, caller: Caller, input: CollectInput, idempotencyKey?: string) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  const at = input.collectedAt ? new Date(input.collectedAt) : now;
  if (at.getTime() > now.getTime() + 5 * 60_000) throw invalid("a specimen can't be collected in the future");
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.collect_specimen', idempotencyKey, request: input }, async (ctx) => {
    const me = actor(ctx);
    let ids = [...new Set(input.orderItemIds ?? [])];
    let original: { id: string; status: string; specimen_type: string; container_type: string | null; patient_id: string } | undefined;
    if (input.recollectionOfId) {
      original = await ctx.tx.selectFrom('diagnostics.specimen').select(['id', 'status', 'specimen_type', 'container_type', 'patient_id']).where('id', '=', input.recollectionOfId).forUpdate().executeTakeFirst();
      if (!original) throw notFound('specimen', { specimenId: input.recollectionOfId });
      if (original.status !== 'rejected') throw preconditionFailed('only a rejected specimen is recollected', { reason: 'not_rejected' });
      const again = await ctx.tx.selectFrom('diagnostics.specimen').select('id').where('recollection_of_id', '=', original.id).executeTakeFirst();
      if (again) throw conflict('this specimen was already recollected', { reason: 'already_recollected', specimenId: again.id });
      if (!ids.length) ids = (await ctx.tx.selectFrom('diagnostics.specimen_order_item').select('order_item_id').where('specimen_id', '=', original.id).execute()).map((r) => r.order_item_id);
    }
    if (!ids.length) throw invalid('choose the tests this specimen is for', { reason: 'no_items' });
    const items = await labItems(ctx.tx, ids);
    if (items.length !== ids.length) throw notFound('order item');
    const patients = new Set(items.map((i) => i.patient_id));
    const facilities = new Set(items.map((i) => i.facility_id));
    if (patients.size > 1 || facilities.size > 1 || (original && original.patient_id !== items[0]!.patient_id)) throw invalid('one specimen serves tests of one patient at one clinic', { reason: 'mixed_items' });
    const notReady = items.filter((i) => i.category !== 'lab_test' || !['ordered', 'scheduled'].includes(i.status));
    if (notReady.length) throw preconditionFailed('some tests are not waiting for a specimen', { reason: 'not_collectable', orderItemIds: notReady.map((i) => i.id) });
    const types = new Set(items.map((i) => i.specimen_type).filter(Boolean));
    const specimenType = input.specimenType ?? original?.specimen_type ?? (types.size === 1 ? [...types][0] : undefined);
    if (!specimenType) throw invalid('these tests need different specimen types; give the specimen type', { reason: 'specimen_type_required' });
    const containers = new Set(items.map((i) => i.container_type).filter(Boolean));
    const containerType = input.containerType ?? original?.container_type ?? (containers.size === 1 ? [...containers][0]! : null);

    const facilityId = items[0]!.facility_id;
    const patientId = items[0]!.patient_id;
    const fac = await ctx.tx.selectFrom('platform.facility').select('code').where('id', '=', facilityId).executeTakeFirstOrThrow();
    const year = now.toISOString().slice(0, 4);
    const accessionNo = `${fac.code}-${year.slice(2)}-${pad(await nextNo(ctx.tx, 'accession', facilityId, year), 7)}`;
    const barcode = input.barcode?.trim() || accessionNo.replaceAll('-', '');
    try {
      const { id } = await ctx.tx
        .insertInto('diagnostics.specimen')
        .values({
          tenant_id: ctx.tenantId,
          patient_id: patientId,
          facility_id: facilityId,
          accession_no: accessionNo,
          barcode,
          specimen_type: specimenType,
          container_type: containerType,
          collection_site: input.collectionSite?.trim() || null,
          collected_at: at,
          collected_by: me,
          status: 'collected',
          recollection_of_id: original?.id ?? null,
          created_by: me,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await ctx.tx.insertInto('diagnostics.specimen_order_item').values(items.map((i) => ({ tenant_id: ctx.tenantId, specimen_id: id, order_item_id: i.id, patient_id: patientId, created_by: me }))).execute();
      await moveItems(ctx.tx, items, 'collected', me, now);
      ctx.audit({ action: 'create', subjectType: 'diagnostics.specimen', subjectId: id, patientId, diff: { accessionNo, specimenType, items: ids, recollectionOf: original?.id ?? null } });
      ctx.emit({ eventType: 'specimen.collected', aggregateType: 'diagnostics.specimen', aggregateId: id, payload: { specimenId: id, accessionNo, orderItemIds: ids, patientId, facilityId } });
      return { specimenId: id, accessionNo, barcode, status: 'collected' };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('that barcode is already on another specimen', { reason: 'duplicate_barcode' });
      throw err;
    }
  });
}

async function lockSpecimen(tx: Transaction<DB>, specimenId: string) {
  const s = await tx.selectFrom('diagnostics.specimen').selectAll().where('id', '=', specimenId).forUpdate().executeTakeFirst();
  if (!s) throw notFound('specimen', { specimenId });
  return s;
}

async function specimenItems(tx: Transaction<DB>, specimenId: string) {
  const ids = (await tx.selectFrom('diagnostics.specimen_order_item').select('order_item_id').where('specimen_id', '=', specimenId).execute()).map((r) => r.order_item_id);
  return labItems(tx, ids);
}

/** The lab accepts the specimen; its tests are now in progress. */
export async function receiveSpecimen(db: Kysely<DB>, caller: Caller, input: { specimenId: string }) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.receive_specimen' }, async (ctx) => {
    const me = actor(ctx);
    const s = await lockSpecimen(ctx.tx, input.specimenId);
    if (s.status === 'received') return { specimenId: s.id, status: s.status };
    if (s.status !== 'collected') throw preconditionFailed(`a ${s.status} specimen can't be received`, { reason: 'invalid_transition' });
    await ctx.tx.updateTable('diagnostics.specimen').set({ status: 'received', received_at: now < new Date(s.collected_at!) ? new Date(s.collected_at!) : now, received_by: me, updated_by: me }).where('id', '=', s.id).execute();
    const items = (await specimenItems(ctx.tx, s.id)).filter((i) => i.status === 'collected');
    await moveItems(ctx.tx, items, 'in_progress', me, now);
    ctx.audit({ action: 'status_change', subjectType: 'diagnostics.specimen', subjectId: s.id, patientId: s.patient_id, diff: { status: [s.status, 'received'] } });
    return { specimenId: s.id, status: 'received' };
  });
}

/** Rejects an unsuitable specimen; its tests go back to waiting for a (re)collection. */
export async function rejectSpecimen(db: Kysely<DB>, caller: Caller, input: { specimenId: string; reason: 'haemolysed' | 'clotted' | 'insufficient' | 'mislabelled' | 'wrong_container' | 'delayed' | 'other'; note?: string | undefined }) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  if (input.reason === 'other' && !input.note?.trim()) throw invalid('describe the problem', { reason: 'note_required' });
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.reject_specimen' }, async (ctx) => {
    const me = actor(ctx);
    const s = await lockSpecimen(ctx.tx, input.specimenId);
    if (s.status === 'rejected') return { specimenId: s.id, status: s.status };
    if (!['collected', 'received'].includes(s.status)) throw preconditionFailed(`a ${s.status} specimen can't be rejected`, { reason: 'invalid_transition' });
    const measured = await ctx.tx.selectFrom('diagnostics.result_item').select('id').where('specimen_id', '=', s.id).where('status', '<>', 'cancelled').executeTakeFirst();
    if (measured) throw preconditionFailed('results were already measured on this specimen', { reason: 'has_results' });
    await ctx.tx
      .updateTable('diagnostics.specimen')
      .set({ status: 'rejected', rejection_reason: input.reason, rejection_note: input.note?.trim() || null, rejected_at: now, rejected_by: me, updated_by: me })
      .where('id', '=', s.id)
      .execute();
    const items = (await specimenItems(ctx.tx, s.id)).filter((i) => ['collected', 'in_progress'].includes(i.status));
    await moveItems(ctx.tx, items, 'ordered', me, now);
    ctx.audit({ action: 'status_change', subjectType: 'diagnostics.specimen', subjectId: s.id, patientId: s.patient_id, reason: input.note, diff: { status: [s.status, 'rejected'], rejectionReason: input.reason } });
    ctx.emit({ eventType: 'specimen.rejected', aggregateType: 'diagnostics.specimen', aggregateId: s.id, payload: { specimenId: s.id, reason: input.reason, orderItemIds: items.map((i) => i.id), patientId: s.patient_id, facilityId: s.facility_id } });
    return { specimenId: s.id, status: 'rejected', orderItemIds: items.map((i) => i.id) };
  });
}

// ---- results ---------------------------------------------------------------------------------------------

export interface ResultValue {
  valueNum?: number | undefined;
  valueText?: string | undefined;
  valueOptionId?: string | undefined;
}

interface Definition {
  id: string;
  code: string;
  name: string;
  value_type: string;
  unit: string | null;
  is_reportable: boolean;
}

interface Interpretation {
  unit: string | null;
  ref_low: string | null;
  ref_high: string | null;
  ref_text: string | null;
  abnormal_flag: string | null;
  is_critical: boolean;
}

/** The reference range for this patient (sex, age in days) on the result date, and the value's flag. */
async function interpret(tx: Transaction<DB>, def: Definition, patient: { sex: string; birth_date: string | null }, v: ResultValue, at: Date): Promise<Interpretation> {
  const day = hospitalDay(at);
  const age = patient.birth_date ? Math.floor((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${patient.birth_date}T00:00:00Z`)) / 86_400_000) : null;
  const { rows: [range] } = await sql<{ low: string | null; high: string | null; critical_low: string | null; critical_high: string | null; text_range: string | null }>`
    SELECT low, high, critical_low, critical_high, text_range
    FROM catalog.reference_range
    WHERE observation_definition_id = ${def.id} AND sex IN (${patient.sex}, 'any')
      AND ((${age}::int IS NULL AND age_min_days = 0 AND age_max_days IS NULL)
           OR (${age}::int >= age_min_days AND (age_max_days IS NULL OR ${age}::int < age_max_days)))
      AND valid_from <= ${day}::date AND (valid_to IS NULL OR valid_to > ${day}::date)
    ORDER BY (sex = 'any'), age_min_days DESC
    LIMIT 1`.execute(tx);
  let flag: string | null = null;
  if (v.valueOptionId) {
    const opt = await tx.selectFrom('catalog.answer_option').select('is_abnormal').where('id', '=', v.valueOptionId).executeTakeFirstOrThrow();
    flag = opt.is_abnormal ? 'abnormal' : 'normal';
  } else if (v.valueNum !== undefined && range) {
    const n = v.valueNum;
    const num = (x: string | null) => (x === null ? null : Number(x));
    const [lo, hi, clo, chi] = [num(range.low), num(range.high), num(range.critical_low), num(range.critical_high)];
    if (clo !== null && n < clo) flag = 'critical_low';
    else if (chi !== null && n > chi) flag = 'critical_high';
    else if (lo !== null && n < lo) flag = 'low';
    else if (hi !== null && n > hi) flag = 'high';
    else if (lo !== null || hi !== null) flag = 'normal';
  }
  return {
    unit: def.unit,
    ref_low: range?.low ?? null,
    ref_high: range?.high ?? null,
    ref_text: range?.text_range ?? null,
    abnormal_flag: flag,
    is_critical: flag === 'critical_low' || flag === 'critical_high',
  };
}

async function checkValue(tx: Transaction<DB>, def: Definition, v: ResultValue) {
  const given = [v.valueNum !== undefined, v.valueText !== undefined && v.valueText.trim() !== '', v.valueOptionId !== undefined].filter(Boolean).length;
  if (given !== 1) throw invalid(`${def.name}: give exactly one value`, { reason: 'bad_value', code: def.code });
  if (def.value_type === 'numeric' && v.valueNum === undefined) throw invalid(`${def.name} is numeric`, { reason: 'bad_value', code: def.code });
  if (def.value_type === 'coded') {
    if (!v.valueOptionId) throw invalid(`${def.name}: choose one of its answers`, { reason: 'bad_value', code: def.code });
    const opt = await tx.selectFrom('catalog.answer_option').select('id').where('id', '=', v.valueOptionId).where('observation_definition_id', '=', def.id).executeTakeFirst();
    if (!opt) throw invalid(`${def.name}: that answer belongs to another parameter`, { reason: 'bad_value', code: def.code });
  }
  if (['text', 'titre', 'culture'].includes(def.value_type) && v.valueText === undefined) throw invalid(`${def.name} takes a text value`, { reason: 'bad_value', code: def.code });
}

const resultValues = (v: ResultValue) => ({ value_num: v.valueNum ?? null, value_text: v.valueText?.trim() || null, value_option_id: v.valueOptionId ?? null });

/** A lab test item, locked, with its patient, for entering results on. */
async function resultableItem(tx: Transaction<DB>, orderItemId: string) {
  const { rows: [item] } = await sql<ItemRow & { patient_id: string; service_item_id: string; category: string; sex: string; birth_date: string | null; section: string | null; facility_id: string; ordered_by: string }>`
    SELECT oi.id, oi.status, oi.panel_parent_item_id, oi.service_order_id, oi.patient_id, oi.service_item_id, s.category, p.sex,
           p.birth_date::text AS birth_date, l.section, o.facility_id, o.ordered_by
    FROM diagnostics.order_item oi
    JOIN diagnostics.service_order o ON o.id = oi.service_order_id
    JOIN catalog.service_item s ON s.id = oi.service_item_id
    LEFT JOIN catalog.lab_test_def l ON l.service_item_id = s.id
    JOIN patient.patient p ON p.id = oi.patient_id
    WHERE oi.id = ${orderItemId}
    FOR UPDATE OF oi`.execute(tx);
  if (!item) throw notFound('order item', { orderItemId });
  if (item.category !== 'lab_test') throw invalid('results are entered on lab tests (for a panel, on each of its tests)', { reason: 'not_a_test' });
  return item;
}

const definitionsOf = (tx: Transaction<DB>, serviceItemId: string) =>
  tx
    .selectFrom('catalog.observation_definition')
    .select(['id', 'code', 'name', 'value_type', 'unit', 'is_reportable'])
    .where('lab_test_item_id', '=', serviceItemId)
    .where('status', '=', 'active')
    .orderBy('sequence')
    .execute();

export interface EnterResultsInput {
  orderItemId: string;
  values: (ResultValue & { observationDefinitionId: string; specimenId?: string | undefined; comment?: string | undefined })[];
  source?: 'manual' | 'instrument' | undefined;
}

/** Enters preliminary results; once every reportable parameter has a value the test is resulted. */
export async function enterResults(db: Kysely<DB>, caller: Caller, input: EnterResultsInput) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.enter_results' }, async (ctx) => {
    const me = actor(ctx);
    const item = await resultableItem(ctx.tx, input.orderItemId);
    if (!['in_progress', 'resulted'].includes(item.status)) throw preconditionFailed(item.status === 'released' ? 'the report was released; correct a result and amend it' : 'the specimen has not been received yet', { reason: 'not_ready', status: item.status });
    const defs = await definitionsOf(ctx.tx, item.service_item_id);
    const byId = new Map(defs.map((d) => [d.id, d]));
    const seen = new Set<string>();
    const received = await ctx.tx
      .selectFrom('diagnostics.specimen_order_item as so')
      .innerJoin('diagnostics.specimen as s', 's.id', 'so.specimen_id')
      .select('s.id')
      .where('so.order_item_id', '=', item.id)
      .where('s.status', 'in', ['received', 'stored', 'consumed'])
      .orderBy('s.received_at', 'desc')
      .executeTakeFirst();
    const out: { resultItemId: string; observationDefinitionId: string; abnormalFlag: string | null; isCritical: boolean }[] = [];
    for (const v of input.values) {
      const def = byId.get(v.observationDefinitionId);
      if (!def) throw invalid('that parameter is not part of this test', { reason: 'unknown_parameter', observationDefinitionId: v.observationDefinitionId });
      if (seen.has(def.id)) throw invalid(`${def.name} appears twice`, { reason: 'duplicate_parameter' });
      seen.add(def.id);
      await checkValue(ctx.tx, def, v);
      const specimenId = v.specimenId ?? received?.id ?? null;
      const interp = await interpret(ctx.tx, def, item, v, now);
      try {
        const { id } = await ctx.tx
          .insertInto('diagnostics.result_item')
          .values({
            tenant_id: ctx.tenantId,
            order_item_id: item.id,
            patient_id: item.patient_id,
            observation_definition_id: def.id,
            specimen_id: specimenId,
            ...resultValues(v),
            ...interp,
            status: 'preliminary',
            source: input.source ?? 'manual',
            comment: v.comment?.trim() || null,
            entered_by: me,
            entered_at: now,
            created_by: me,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        out.push({ resultItemId: id, observationDefinitionId: def.id, abnormalFlag: interp.abnormal_flag, isCritical: interp.is_critical });
        if (interp.is_critical) {
          ctx.emit({ eventType: 'critical_result.flagged', aggregateType: 'diagnostics.result_item', aggregateId: id, payload: { resultItemId: id, orderItemId: item.id, patientId: item.patient_id, code: def.code, flag: interp.abnormal_flag, orderedBy: item.ordered_by, facilityId: item.facility_id } });
        }
      } catch (err) {
        if (pgCode(err) === '23505') throw conflict(`${def.name} already has a result; record a correction instead`, { reason: 'already_resulted', code: def.code });
        throw err;
      }
    }
    const current = await ctx.tx.selectFrom('diagnostics.result_item').select('observation_definition_id').where('order_item_id', '=', item.id).where('superseded_at', 'is', null).where('status', '<>', 'cancelled').execute();
    const done = new Set(current.map((c) => c.observation_definition_id));
    const complete = defs.filter((d) => d.is_reportable).every((d) => done.has(d.id));
    if (complete && item.status === 'in_progress') await moveItems(ctx.tx, [item], 'resulted', me, now);
    ctx.audit({ action: 'create', subjectType: 'diagnostics.result_item', subjectId: item.id, patientId: item.patient_id, diff: { results: out.map((o) => o.resultItemId), critical: out.filter((o) => o.isCritical).length } });
    return { orderItemId: item.id, orderItemStatus: item.status, results: out, complete };
  });
}

/** A correction is a new value that supersedes the current one; a released report then needs amending. */
export async function correctResult(db: Kysely<DB>, caller: Caller, input: ResultValue & { resultItemId: string; reason: string; comment?: string | undefined }) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.correct_result' }, async (ctx) => {
    const me = actor(ctx);
    const old = await ctx.tx.selectFrom('diagnostics.result_item').selectAll().where('id', '=', input.resultItemId).forUpdate().executeTakeFirst();
    if (!old) throw notFound('result', { resultItemId: input.resultItemId });
    if (old.superseded_at || old.status === 'cancelled') throw conflict('this result was already superseded; correct the current one', { reason: 'not_current' });
    const item = await resultableItem(ctx.tx, old.order_item_id);
    const def = (await definitionsOf(ctx.tx, item.service_item_id)).find((d) => d.id === old.observation_definition_id);
    if (!def) throw preconditionFailed('this parameter is no longer active in the catalogue', { reason: 'inactive_parameter' });
    await checkValue(ctx.tx, def, input);
    const interp = await interpret(ctx.tx, def, item, input, now);
    await ctx.tx.updateTable('diagnostics.result_item').set({ superseded_at: now, updated_by: me }).where('id', '=', old.id).execute();
    const { id } = await ctx.tx
      .insertInto('diagnostics.result_item')
      .values({
        tenant_id: ctx.tenantId,
        order_item_id: old.order_item_id,
        patient_id: old.patient_id,
        observation_definition_id: old.observation_definition_id,
        specimen_id: old.specimen_id,
        ...resultValues(input),
        ...interp,
        status: 'corrected',
        source: 'manual',
        comment: input.comment?.trim() || null,
        correction_reason: input.reason.trim(),
        supersedes_id: old.id,
        entered_by: me,
        entered_at: now,
        created_by: me,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const released = await ctx.tx
      .selectFrom('diagnostics.diagnostic_report')
      .select('id')
      .where('order_item_id', 'in', [item.id, ...(item.panel_parent_item_id ? [item.panel_parent_item_id] : [])])
      .where('status', 'in', ['final', 'amended'])
      .executeTakeFirst();
    if (interp.is_critical) {
      ctx.emit({ eventType: 'critical_result.flagged', aggregateType: 'diagnostics.result_item', aggregateId: id, payload: { resultItemId: id, orderItemId: item.id, patientId: item.patient_id, code: def.code, flag: interp.abnormal_flag, orderedBy: item.ordered_by, facilityId: item.facility_id } });
    }
    ctx.audit({ action: 'update', subjectType: 'diagnostics.result_item', subjectId: id, patientId: old.patient_id, reason: input.reason, diff: { supersedes: old.id, from: [old.value_num, old.value_text, old.value_option_id], to: resultValues(input) } });
    return { resultItemId: id, supersedesId: old.id, abnormalFlag: interp.abnormal_flag, isCritical: interp.is_critical, needsAmendment: !!released, reportId: released?.id ?? null };
  });
}

/** Documents the call-out of a critical value: who told whom, how, and whether it was read back. */
export async function recordCriticalAlert(
  db: Kysely<DB>,
  caller: Caller,
  input: { resultItemId: string; notifiedToStaffId?: string | undefined; notifiedToName?: string | undefined; channel: 'phone' | 'in_person' | 'app'; readBackConfirmed: boolean; notifiedAt?: string | undefined; note?: string | undefined },
) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  const at = input.notifiedAt ? new Date(input.notifiedAt) : now;
  if (at.getTime() > now.getTime() + 5 * 60_000) throw invalid("the call can't be in the future");
  if (!input.notifiedToStaffId && !input.notifiedToName?.trim()) throw invalid('say who was told', { reason: 'recipient_required' });
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.record_critical_alert' }, async (ctx) => {
    const me = actor(ctx);
    const r = await ctx.tx.selectFrom('diagnostics.result_item').select(['id', 'is_critical', 'patient_id', 'order_item_id']).where('id', '=', input.resultItemId).executeTakeFirst();
    if (!r) throw notFound('result', { resultItemId: input.resultItemId });
    if (!r.is_critical) throw preconditionFailed('this result is not critical', { reason: 'not_critical' });
    const { id } = await ctx.tx
      .insertInto('diagnostics.critical_alert')
      .values({
        tenant_id: ctx.tenantId,
        result_item_id: r.id,
        notified_by: me,
        notified_to_staff_id: input.notifiedToStaffId ?? null,
        notified_to_name: input.notifiedToName?.trim() || null,
        notified_at: at,
        channel: input.channel,
        read_back_confirmed: input.readBackConfirmed,
        note: input.note?.trim() || null,
        created_by: me,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'diagnostics.critical_alert', subjectId: id, patientId: r.patient_id, diff: { channel: input.channel, readBack: input.readBackConfirmed, to: input.notifiedToStaffId ?? input.notifiedToName } });
    ctx.emit({ eventType: 'critical_result.notified', aggregateType: 'diagnostics.result_item', aggregateId: r.id, payload: { resultItemId: r.id, orderItemId: r.order_item_id, patientId: r.patient_id, notifiedToStaffId: input.notifiedToStaffId ?? null } });
    return { criticalAlertId: id };
  });
}

// ---- microbiology ---------------------------------------------------------------------------------------

export async function addIsolate(db: Kysely<DB>, caller: Caller, input: { orderItemId: string; organismName: string; organismConceptId?: string | undefined; colonyCount?: string | undefined; comment?: string | undefined }) {
  await assertDiagnosticsActive(db, caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.add_isolate' }, async (ctx) => {
    const me = actor(ctx);
    const item = await resultableItem(ctx.tx, input.orderItemId);
    if (item.section !== 'microbiology') throw invalid('isolates are recorded on culture (microbiology) tests', { reason: 'not_culture' });
    if (!['in_progress', 'resulted'].includes(item.status)) throw preconditionFailed('the culture is not in progress', { reason: 'not_ready', status: item.status });
    const { rows: [n] } = await sql<{ next: number }>`SELECT coalesce(max(sequence), 0) + 1 AS next FROM diagnostics.micro_isolate WHERE order_item_id = ${item.id}`.execute(ctx.tx);
    const { id } = await ctx.tx
      .insertInto('diagnostics.micro_isolate')
      .values({
        tenant_id: ctx.tenantId,
        order_item_id: item.id,
        patient_id: item.patient_id,
        sequence: Number(n!.next),
        organism_concept_id: input.organismConceptId ?? null,
        organism_name: input.organismName.trim(),
        colony_count: input.colonyCount?.trim() || null,
        comment: input.comment?.trim() || null,
        entered_by: me,
        created_by: me,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'diagnostics.micro_isolate', subjectId: id, patientId: item.patient_id, diff: { organism: input.organismName } });
    return { isolateId: id, sequence: Number(n!.next) };
  });
}

export async function addSusceptibility(
  db: Kysely<DB>,
  caller: Caller,
  input: { isolateId: string; antibioticName: string; antibioticItemId?: string | undefined; method: 'disc' | 'mic'; micValue?: number | undefined; zoneMm?: number | undefined; interpretation: 'S' | 'I' | 'R' },
) {
  await assertDiagnosticsActive(db, caller);
  if (input.method === 'mic' && input.micValue === undefined) throw invalid('an MIC result needs the MIC value', { reason: 'mic_required' });
  if (input.method === 'disc' && input.zoneMm === undefined) throw invalid('a disc result needs the zone diameter', { reason: 'zone_required' });
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.add_susceptibility' }, async (ctx) => {
    const me = actor(ctx);
    const iso = await ctx.tx.selectFrom('diagnostics.micro_isolate').select(['id', 'patient_id', 'order_item_id']).where('id', '=', input.isolateId).executeTakeFirst();
    if (!iso) throw notFound('isolate', { isolateId: input.isolateId });
    const item = await resultableItem(ctx.tx, iso.order_item_id);
    if (!['in_progress', 'resulted'].includes(item.status)) throw preconditionFailed('the culture is not in progress', { reason: 'not_ready', status: item.status });
    try {
      const { id } = await ctx.tx
        .insertInto('diagnostics.micro_susceptibility')
        .values({
          tenant_id: ctx.tenantId,
          micro_isolate_id: iso.id,
          antibiotic_item_id: input.antibioticItemId ?? null,
          antibiotic_name: input.antibioticName.trim(),
          method: input.method,
          mic_value: input.micValue ?? null,
          zone_mm: input.zoneMm ?? null,
          interpretation: input.interpretation,
          entered_by: me,
          created_by: me,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'diagnostics.micro_susceptibility', subjectId: id, patientId: iso.patient_id, diff: { antibiotic: input.antibioticName, interpretation: input.interpretation } });
      return { susceptibilityId: id };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('that antibiotic is already recorded for this isolate', { reason: 'duplicate_antibiotic' });
      throw err;
    }
  });
}
