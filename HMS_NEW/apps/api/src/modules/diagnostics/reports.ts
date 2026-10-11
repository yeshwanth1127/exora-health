// Diagnostic reports (ERD m06): registered → preliminary → final → amended (repeatable), or cancelled.
// Every change writes an immutable version with a snapshot of the results (or imaging findings). Release
// is by an authorised signatory who did not enter the results (four-eyes); critical values must have
// been called out first. The ordering clinician then acknowledges the released report.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, forbidden, invalid, notFound, preconditionFailed, runCommand } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { assertChartAccess } from '../clinical/access.ts';
import { actor, assertDiagnosticsActive, moveItem, refreshOrder } from './state.ts';

export interface ReportText {
  conclusion?: string | undefined;
  findings?: string | undefined;
  impression?: string | undefined;
  comment?: string | undefined;
}

/** The report's item and the tests it covers (a panel's tests, or the test itself). */
async function reportScope(tx: Transaction<DB>, orderItemId: string) {
  const { rows: [root] } = await sql<{ id: string; status: string; patient_id: string; panel_parent_item_id: string | null; service_order_id: string; category: string; section: string | null; name: string; encounter_id: string; ordered_by: string; facility_id: string }>`
    SELECT oi.id, oi.status, oi.patient_id, oi.panel_parent_item_id, oi.service_order_id, s.category, l.section, s.name,
           o.encounter_id, o.ordered_by, o.facility_id
    FROM diagnostics.order_item oi
    JOIN diagnostics.service_order o ON o.id = oi.service_order_id
    JOIN catalog.service_item s ON s.id = oi.service_item_id
    LEFT JOIN catalog.lab_test_def l ON l.service_item_id = s.id
    WHERE oi.id = ${orderItemId}
    FOR UPDATE OF oi`.execute(tx);
  if (!root) throw notFound('order item', { orderItemId });
  const children = await tx.selectFrom('diagnostics.order_item').select(['id', 'status']).where('panel_parent_item_id', '=', root.id).forUpdate().execute();
  const leaves = root.category === 'lab_panel' ? children.filter((c) => c.status !== 'cancelled') : [{ id: root.id, status: root.status }];
  return { root, leaves };
}

const reportTypeOf = (category: string, section: string | null) => (category === 'imaging' ? 'imaging' : section === 'histopathology' || section === 'cytology' ? 'pathology' : 'lab');

/** Snapshot of everything the report says: current results, microbiology, imaging study and text. */
export async function reportBody(tx: Transaction<DB>, rootId: string, leafIds: string[], text: ReportText) {
  const ids = leafIds.length ? leafIds : [rootId];
  const { rows: results } = await sql<Record<string, unknown>>`
    SELECT r.id AS "resultItemId", r.order_item_id AS "orderItemId", si.name AS "test", d.code, d.name, d.value_type AS "valueType",
           r.value_num AS "valueNum", r.value_text AS "valueText", ao.display AS "valueDisplay", r.unit, r.ref_low AS "refLow",
           r.ref_high AS "refHigh", r.ref_text AS "refText", r.abnormal_flag AS "abnormalFlag", r.is_critical AS "isCritical",
           r.status, r.comment, r.entered_by AS "enteredBy", r.entered_at AS "enteredAt", r.supersedes_id AS "supersedesId"
    FROM diagnostics.result_item r
    JOIN catalog.observation_definition d ON d.id = r.observation_definition_id
    JOIN diagnostics.order_item oi ON oi.id = r.order_item_id
    JOIN catalog.service_item si ON si.id = oi.service_item_id
    LEFT JOIN catalog.answer_option ao ON ao.id = r.value_option_id
    WHERE r.order_item_id = ANY(${ids}::uuid[]) AND r.superseded_at IS NULL AND r.status <> 'cancelled'
    ORDER BY si.name, d.sequence, d.code`.execute(tx);
  const { rows: isolates } = await sql<Record<string, unknown>>`
    SELECT m.id AS "isolateId", m.order_item_id AS "orderItemId", m.sequence, m.organism_name AS "organism", m.colony_count AS "colonyCount", m.comment,
           coalesce((SELECT jsonb_agg(jsonb_build_object('antibiotic', s.antibiotic_name, 'method', s.method, 'micValue', s.mic_value,
                                                         'zoneMm', s.zone_mm, 'interpretation', s.interpretation) ORDER BY s.antibiotic_name)
                     FROM diagnostics.micro_susceptibility s WHERE s.micro_isolate_id = m.id), '[]') AS susceptibilities
    FROM diagnostics.micro_isolate m
    WHERE m.order_item_id = ANY(${ids}::uuid[])
    ORDER BY m.sequence`.execute(tx);
  const study = await tx
    .selectFrom('diagnostics.imaging_study')
    .select(['id as imagingStudyId', 'modality', 'accession_no as accessionNo', 'study_instance_uid as studyInstanceUid', 'performed_at as performedAt', 'pacs_url as pacsUrl'])
    .where('order_item_id', '=', rootId)
    .executeTakeFirst();
  return {
    results,
    isolates,
    ...(study ? { study } : {}),
    ...Object.fromEntries(Object.entries({ findings: text.findings, impression: text.impression, comment: text.comment }).filter(([, v]) => v !== undefined && v !== '')),
  };
}

async function writeVersion(tx: Transaction<DB>, r: { id: string; tenant_id: string }, versionNo: number, status: string, body: unknown, by: string, amendmentReason?: string) {
  await tx
    .insertInto('diagnostics.diagnostic_report_version')
    .values({ tenant_id: r.tenant_id, diagnostic_report_id: r.id, version_no: versionNo, status, body: JSON.stringify(body), amendment_reason: amendmentReason ?? null, created_by: by })
    .execute();
}

async function lastText(tx: Transaction<DB>, reportId: string, versionNo: number): Promise<ReportText> {
  const v = await tx.selectFrom('diagnostics.diagnostic_report_version').select('body').where('diagnostic_report_id', '=', reportId).where('version_no', '=', versionNo).executeTakeFirst();
  const b = (v?.body ?? {}) as Record<string, string | undefined>;
  return { findings: b.findings, impression: b.impression, comment: b.comment };
}

/** Facility and type of the report an order item would get (for the route's permission check). */
export const reportTypeForCategory = reportTypeOf;

/** Creates the item's report, or saves a new draft version of it, before release. */
export async function saveReportDraft(db: Kysely<DB>, caller: Caller, input: ReportText & { orderItemId: string; version?: number | undefined }) {
  await assertDiagnosticsActive(db, caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.save_report' }, async (ctx) => {
    const me = actor(ctx);
    const { root, leaves } = await reportScope(ctx.tx, input.orderItemId);
    if (root.panel_parent_item_id) throw invalid('a panel is reported as a whole; report the panel', { reason: 'report_the_panel', panelOrderItemId: root.panel_parent_item_id });
    if (!['lab_test', 'lab_panel', 'imaging'].includes(root.category)) throw invalid('only lab and imaging orders take reports', { reason: 'not_reportable' });
    if (root.status === 'cancelled') throw preconditionFailed('this order item was cancelled', { reason: 'cancelled' });
    const existing = await ctx.tx.selectFrom('diagnostics.diagnostic_report').selectAll().where('order_item_id', '=', root.id).where('status', '<>', 'cancelled').forUpdate().executeTakeFirst();
    if (existing && input.version !== undefined && existing.version !== input.version) throw conflict('this report was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: existing.version });
    if (existing && ['final', 'amended'].includes(existing.status)) throw conflict('this report was released; amend it instead', { reason: 'already_released' });
    const body = await reportBody(ctx.tx, root.id, leaves.map((l) => l.id), input);
    const hasContent = body.results.length > 0 || body.isolates.length > 0 || !!input.findings || !!input.impression;
    const status = hasContent ? 'preliminary' : existing?.status ?? 'registered';
    if (!existing) {
      const r = await ctx.tx
        .insertInto('diagnostics.diagnostic_report')
        .values({ tenant_id: ctx.tenantId, order_item_id: root.id, patient_id: root.patient_id, report_type: reportTypeOf(root.category, root.section), status, conclusion: input.conclusion?.trim() || null, created_by: me })
        .returning(['id', 'tenant_id', 'version'])
        .executeTakeFirstOrThrow();
      await writeVersion(ctx.tx, r, 1, status, body, me);
      ctx.audit({ action: 'create', subjectType: 'diagnostics.diagnostic_report', subjectId: r.id, patientId: root.patient_id, diff: { status } });
      return { reportId: r.id, status, versionNo: 1, version: r.version };
    }
    const versionNo = existing.current_version + 1;
    await writeVersion(ctx.tx, existing, versionNo, status, body, me);
    const { version } = await ctx.tx
      .updateTable('diagnostics.diagnostic_report')
      .set({ status, current_version: versionNo, ...(input.conclusion !== undefined ? { conclusion: input.conclusion.trim() || null } : {}), updated_by: me })
      .where('id', '=', existing.id)
      .returning('version')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'update', subjectType: 'diagnostics.diagnostic_report', subjectId: existing.id, patientId: root.patient_id, diff: { status: [existing.status, status], versionNo } });
    return { reportId: existing.id, status, versionNo, version };
  });
}

async function lockReport(tx: Transaction<DB>, reportId: string, version: number) {
  const r = await tx.selectFrom('diagnostics.diagnostic_report').selectAll().where('id', '=', reportId).forUpdate().executeTakeFirst();
  if (!r) throw notFound('report', { reportId });
  if (r.version !== version) throw conflict('this report was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: r.version });
  return r;
}

/**
 * Four-eyes and critical-value checks over the results being signed out: the signatory may not have
 * entered any of them, and every critical value needs a documented call.
 */
async function verifyResults(tx: Transaction<DB>, leafIds: string[], signatory: string, now: Date, onlyUnverified: boolean) {
  if (!leafIds.length) return;
  let q = tx.selectFrom('diagnostics.result_item').select(['id', 'entered_by', 'is_critical', 'status', 'verified_at']).where('order_item_id', 'in', leafIds).where('superseded_at', 'is', null).where('status', '<>', 'cancelled');
  if (onlyUnverified) q = q.where('verified_at', 'is', null);
  const rows = await q.execute();
  if (rows.some((r) => r.entered_by === signatory)) throw forbidden('results must be verified by someone other than the person who entered them', { reason: 'four_eyes' });
  const critical = rows.filter((r) => r.is_critical).map((r) => r.id);
  if (critical.length) {
    const called = await tx.selectFrom('diagnostics.critical_alert').select('result_item_id').where('result_item_id', 'in', critical).execute();
    const missing = critical.filter((id) => !called.some((c) => c.result_item_id === id));
    if (missing.length) throw preconditionFailed('critical values must be called out (and logged) before release', { reason: 'critical_not_notified', resultItemIds: missing });
  }
  for (const r of rows) {
    await tx
      .updateTable('diagnostics.result_item')
      .set({ ...(r.status === 'preliminary' ? { status: 'final' } : {}), verified_by: signatory, verified_at: now, updated_by: signatory })
      .where('id', '=', r.id)
      .execute();
  }
}

/** Releases (signs out) the report: results final, the order item released, `result.released` emitted. */
export async function releaseReport(db: Kysely<DB>, caller: Caller, input: ReportText & { reportId: string; version: number }) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.release_report' }, async (ctx) => {
    const me = actor(ctx);
    const r = await lockReport(ctx.tx, input.reportId, input.version);
    if (['final', 'amended'].includes(r.status)) throw conflict('this report was already released; amend it instead', { reason: 'already_released' });
    if (r.status === 'cancelled') throw preconditionFailed('this report was cancelled', { reason: 'cancelled' });
    const { root, leaves } = await reportScope(ctx.tx, r.order_item_id);
    if (r.report_type === 'imaging') {
      const study = await ctx.tx.selectFrom('diagnostics.imaging_study').select(['id', 'status']).where('order_item_id', '=', root.id).forUpdate().executeTakeFirst();
      if (!study || study.status !== 'completed') throw preconditionFailed('the study must be completed before it is reported', { reason: 'results_incomplete' });
      const text = { ...(await lastText(ctx.tx, r.id, r.current_version)), ...input };
      if (!text.findings && !text.impression) throw invalid('an imaging report needs findings or an impression', { reason: 'empty_report' });
      await ctx.tx.updateTable('diagnostics.imaging_study').set({ status: 'reported', updated_by: me }).where('id', '=', study.id).execute();
    } else {
      const pending = leaves.filter((l) => l.status !== 'resulted');
      if (!leaves.length || pending.length) throw preconditionFailed('every test needs its results before release', { reason: 'results_incomplete', orderItemIds: pending.map((p) => p.id) });
      await verifyResults(ctx.tx, leaves.map((l) => l.id), me, now, false);
    }
    const text = { ...(await lastText(ctx.tx, r.id, r.current_version)), ...input };
    const body = await reportBody(ctx.tx, root.id, r.report_type === 'imaging' ? [] : leaves.map((l) => l.id), text);
    const versionNo = r.current_version + 1;
    await writeVersion(ctx.tx, r, versionNo, 'final', body, me);
    const { version } = await ctx.tx
      .updateTable('diagnostics.diagnostic_report')
      .set({ status: 'final', released_at: now, released_by: me, current_version: versionNo, ...(input.conclusion !== undefined ? { conclusion: input.conclusion.trim() || null } : {}), updated_by: me })
      .where('id', '=', r.id)
      .returning('version')
      .executeTakeFirstOrThrow();
    for (const l of leaves) if (l.id !== root.id) await moveItem(ctx.tx, l, 'released', { by: me });
    await moveItem(ctx.tx, root, 'released', { by: me });
    const orderStatus = await refreshOrder(ctx.tx, root.service_order_id, me);
    const isCritical = (body.results as { isCritical?: boolean }[]).some((x) => x.isCritical);
    ctx.audit({ action: 'status_change', subjectType: 'diagnostics.diagnostic_report', subjectId: r.id, patientId: r.patient_id, diff: { status: [r.status, 'final'], versionNo } });
    ctx.emit({
      eventType: 'result.released',
      aggregateType: 'diagnostics.diagnostic_report',
      aggregateId: r.id,
      aggregateVersion: versionNo,
      payload: { reportId: r.id, orderItemId: root.id, orderId: root.service_order_id, encounterId: root.encounter_id, patientId: r.patient_id, orderedBy: root.ordered_by, facilityId: root.facility_id, reportType: r.report_type, isCritical },
    });
    return { reportId: r.id, status: 'final', versionNo, version, orderStatus };
  });
}

/** Amends a released report: a reason, a new version, the corrected values verified by a second person. */
export async function amendReport(db: Kysely<DB>, caller: Caller, input: ReportText & { reportId: string; version: number; reason: string }) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.amend_report' }, async (ctx) => {
    const me = actor(ctx);
    const r = await lockReport(ctx.tx, input.reportId, input.version);
    if (!['final', 'amended'].includes(r.status)) throw preconditionFailed('only a released report is amended', { reason: 'not_released' });
    const { root, leaves } = await reportScope(ctx.tx, r.order_item_id);
    if (r.report_type !== 'imaging') await verifyResults(ctx.tx, leaves.map((l) => l.id), me, now, true);
    const text = { ...(await lastText(ctx.tx, r.id, r.current_version)), ...input };
    const body = await reportBody(ctx.tx, root.id, r.report_type === 'imaging' ? [] : leaves.map((l) => l.id), text);
    const versionNo = r.current_version + 1;
    await writeVersion(ctx.tx, r, versionNo, 'amended', body, me, input.reason.trim());
    const { version } = await ctx.tx
      .updateTable('diagnostics.diagnostic_report')
      .set({ status: 'amended', released_at: now, released_by: me, current_version: versionNo, ...(input.conclusion !== undefined ? { conclusion: input.conclusion.trim() || null } : {}), updated_by: me })
      .where('id', '=', r.id)
      .returning('version')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'update', subjectType: 'diagnostics.diagnostic_report', subjectId: r.id, patientId: r.patient_id, reason: input.reason, diff: { status: [r.status, 'amended'], versionNo } });
    ctx.emit({
      eventType: 'result.amended',
      aggregateType: 'diagnostics.diagnostic_report',
      aggregateId: r.id,
      aggregateVersion: versionNo,
      payload: { reportId: r.id, orderItemId: root.id, encounterId: root.encounter_id, patientId: r.patient_id, orderedBy: root.ordered_by, facilityId: root.facility_id, reason: input.reason.trim() },
    });
    return { reportId: r.id, status: 'amended', versionNo, version };
  });
}

export async function cancelReport(db: Kysely<DB>, caller: Caller, input: { reportId: string; version: number; reason: string }) {
  await assertDiagnosticsActive(db, caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.cancel_report' }, async (ctx) => {
    const me = actor(ctx);
    const r = await lockReport(ctx.tx, input.reportId, input.version);
    if (!['registered', 'preliminary'].includes(r.status)) throw preconditionFailed(`a ${r.status} report can't be cancelled`, { reason: 'invalid_transition' });
    const versionNo = r.current_version + 1;
    await writeVersion(ctx.tx, r, versionNo, 'cancelled', { reason: input.reason.trim() }, me);
    const { version } = await ctx.tx
      .updateTable('diagnostics.diagnostic_report')
      .set({ status: 'cancelled', cancel_reason: input.reason.trim(), current_version: versionNo, updated_by: me })
      .where('id', '=', r.id)
      .returning('version')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'diagnostics.diagnostic_report', subjectId: r.id, patientId: r.patient_id, reason: input.reason, diff: { status: [r.status, 'cancelled'] } });
    return { reportId: r.id, status: 'cancelled', versionNo, version };
  });
}

/** A clinician with care access acknowledges a released report, once, saying what they did about it. */
export async function acknowledgeReport(db: Kysely<DB>, caller: Caller, input: { reportId: string; actionTaken?: string | undefined }) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.acknowledge_report' }, async (ctx) => {
    const me = actor(ctx);
    const r = await ctx.tx.selectFrom('diagnostics.diagnostic_report').select(['id', 'status', 'patient_id', 'current_version']).where('id', '=', input.reportId).executeTakeFirst();
    if (!r) throw notFound('report', { reportId: input.reportId });
    if (!['final', 'amended'].includes(r.status)) throw preconditionFailed('only a released report can be acknowledged', { reason: 'not_released' });
    await assertChartAccess(ctx.tx, me, r.patient_id, now);
    const { id } = (await ctx.tx
      .insertInto('diagnostics.result_acknowledgement')
      .values({ tenant_id: ctx.tenantId, diagnostic_report_id: r.id, staff_id: me, report_version_no: r.current_version, acknowledged_at: now, action_taken: input.actionTaken?.trim() || null, created_by: me })
      .onConflict((oc) => oc.columns(['tenant_id', 'diagnostic_report_id', 'staff_id']).doNothing())
      .returning('id')
      .executeTakeFirst()) ?? { id: undefined };
    if (!id) throw conflict('you already acknowledged this report', { reason: 'already_acknowledged' });
    ctx.audit({ action: 'create', subjectType: 'diagnostics.result_acknowledgement', subjectId: id, patientId: r.patient_id, diff: { reportId: r.id, versionNo: r.current_version } });
    ctx.emit({ eventType: 'result.acknowledged', aggregateType: 'diagnostics.diagnostic_report', aggregateId: r.id, payload: { reportId: r.id, staffId: me, patientId: r.patient_id } });
    return { acknowledgementId: id, reportVersionNo: r.current_version };
  });
}
