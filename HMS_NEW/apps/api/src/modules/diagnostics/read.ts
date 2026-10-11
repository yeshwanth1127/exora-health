// Read side of M06. Worklists show what is waiting (patient, test, priority) without result values.
// Anything that returns results is PHI: it checks the care relationship (clinicians) or runs under the
// lab's permission, and records a 'view' in the audit log.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { notFound, runCommand, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { assertChartAccess } from '../clinical/access.ts';
import { mergedFamily } from '../patient/registry.ts';

const PRIORITY = sql`CASE o.priority WHEN 'stat' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END`;

/** Orders with their items (panel tests nested), specimens, current results, reports and studies. */
async function ordersWhere(tx: Transaction<DB>, where: { encounterId?: string; orderIds?: string[] }) {
  const orders = (
    await sql<Record<string, unknown> & { orderId: string }>`
      SELECT o.id AS "orderId", o.requisition_no AS "requisitionNo", o.priority, o.status, o.clinical_indication AS "clinicalIndication",
             o.ordered_at AS "orderedAt", o.ordered_by AS "orderedBy", s.display_name AS "orderedByName", o.encounter_id AS "encounterId",
             o.facility_id AS "facilityId"
      FROM diagnostics.service_order o JOIN platform.staff s ON s.id = o.ordered_by
      WHERE (${where.encounterId ?? null}::uuid IS NULL OR o.encounter_id = ${where.encounterId ?? null}::uuid)
        AND (${where.orderIds ?? null}::uuid[] IS NULL OR o.id = ANY(${where.orderIds ?? null}::uuid[]))
      ORDER BY o.ordered_at DESC`.execute(tx)
  ).rows;
  if (!orders.length) return [];
  const orderIds = orders.map((o) => o.orderId);
  const { rows: items } = await sql<Record<string, unknown> & { orderItemId: string; orderId: string; parentId: string | null }>`
    SELECT oi.id AS "orderItemId", oi.service_order_id AS "orderId", oi.panel_parent_item_id AS "parentId", oi.service_item_id AS "serviceItemId",
           si.name, si.category, si.modality, oi.status, oi.quantity, oi.details, oi.scheduled_at AS "scheduledAt", oi.cancel_reason AS "cancelReason",
           oi.version
    FROM diagnostics.order_item oi JOIN catalog.service_item si ON si.id = oi.service_item_id
    WHERE oi.service_order_id = ANY(${orderIds}::uuid[])
    ORDER BY oi.created_at`.execute(tx);
  const itemIds = items.map((i) => i.orderItemId);
  const [specimens, results, reports, studies, acks] = await Promise.all([
    sql<Record<string, unknown> & { orderItemId: string }>`
      SELECT so.order_item_id AS "orderItemId", sp.id AS "specimenId", sp.accession_no AS "accessionNo", sp.barcode, sp.specimen_type AS "specimenType",
             sp.status, sp.collected_at AS "collectedAt", sp.received_at AS "receivedAt", sp.rejection_reason AS "rejectionReason",
             sp.recollection_of_id AS "recollectionOfId", sp.version
      FROM diagnostics.specimen_order_item so JOIN diagnostics.specimen sp ON sp.id = so.specimen_id
      WHERE so.order_item_id = ANY(${itemIds}::uuid[]) ORDER BY sp.created_at`.execute(tx),
    sql<Record<string, unknown> & { orderItemId: string }>`
      SELECT r.order_item_id AS "orderItemId", r.id AS "resultItemId", d.code, d.name, r.value_num AS "valueNum", r.value_text AS "valueText",
             ao.display AS "valueDisplay", r.unit, r.ref_low AS "refLow", r.ref_high AS "refHigh", r.ref_text AS "refText",
             r.abnormal_flag AS "abnormalFlag", r.is_critical AS "isCritical", r.status, r.entered_at AS "enteredAt", r.verified_at AS "verifiedAt"
      FROM diagnostics.result_item r
      JOIN catalog.observation_definition d ON d.id = r.observation_definition_id
      LEFT JOIN catalog.answer_option ao ON ao.id = r.value_option_id
      WHERE r.order_item_id = ANY(${itemIds}::uuid[]) AND r.superseded_at IS NULL AND r.status <> 'cancelled'
      ORDER BY d.sequence, d.code`.execute(tx),
    sql<Record<string, unknown> & { orderItemId: string; reportId: string }>`
      SELECT dr.order_item_id AS "orderItemId", dr.id AS "reportId", dr.report_type AS "reportType", dr.status, dr.conclusion,
             dr.released_at AS "releasedAt", st.display_name AS "releasedByName", dr.current_version AS "versionNo", dr.version,
             v.body, v.amendment_reason AS "amendmentReason"
      FROM diagnostics.diagnostic_report dr
      JOIN diagnostics.diagnostic_report_version v ON v.diagnostic_report_id = dr.id AND v.version_no = dr.current_version
      LEFT JOIN platform.staff st ON st.id = dr.released_by
      WHERE dr.order_item_id = ANY(${itemIds}::uuid[]) AND dr.status <> 'cancelled'`.execute(tx),
    sql<Record<string, unknown> & { orderItemId: string }>`
      SELECT order_item_id AS "orderItemId", id AS "imagingStudyId", modality, accession_no AS "accessionNo", status, is_obstetric AS "isObstetric",
             performed_at AS "performedAt", pacs_url AS "pacsUrl", version
      FROM diagnostics.imaging_study WHERE order_item_id = ANY(${itemIds}::uuid[])`.execute(tx),
    sql<Record<string, unknown> & { reportId: string }>`
      SELECT a.diagnostic_report_id AS "reportId", a.staff_id AS "staffId", s.display_name AS "staffName", a.acknowledged_at AS "acknowledgedAt",
             a.action_taken AS "actionTaken", a.report_version_no AS "reportVersionNo"
      FROM diagnostics.result_acknowledgement a JOIN platform.staff s ON s.id = a.staff_id
      JOIN diagnostics.diagnostic_report dr ON dr.id = a.diagnostic_report_id
      WHERE dr.order_item_id = ANY(${itemIds}::uuid[]) ORDER BY a.acknowledged_at`.execute(tx),
  ]);
  const shape = (i: (typeof items)[number]): Record<string, unknown> => {
    const report = reports.rows.find((r) => r.orderItemId === i.orderItemId);
    return {
      ...i,
      specimens: specimens.rows.filter((s) => s.orderItemId === i.orderItemId).map(({ orderItemId: _, ...s }) => s),
      results: results.rows.filter((r) => r.orderItemId === i.orderItemId).map(({ orderItemId: _, ...r }) => r),
      report: report ? { ...report, orderItemId: undefined, acknowledgements: acks.rows.filter((a) => a.reportId === report.reportId) } : null,
      imagingStudy: studies.rows.find((s) => s.orderItemId === i.orderItemId) ?? null,
      tests: items.filter((c) => c.parentId === i.orderItemId).map(shape),
    };
  };
  return orders.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.orderId && !i.parentId).map(shape) }));
}

/** The encounter's orders with everything that came back (care access required; audited). */
export async function getEncounterOrders(db: Kysely<DB>, caller: Caller, encounterId: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.view_orders' }, async (ctx) => {
    const e = await ctx.tx.selectFrom('clinical.encounter').select(['id', 'patient_id']).where('id', '=', encounterId).executeTakeFirst();
    if (!e) throw notFound('encounter', { encounterId });
    await assertChartAccess(ctx.tx, ctx.actor.staffId, e.patient_id, now);
    ctx.audit({ action: 'view', subjectType: 'diagnostics.service_order', subjectId: e.id, patientId: e.patient_id, reason: 'encounter orders' });
    return { encounterId: e.id, patientId: e.patient_id, orders: await ordersWhere(ctx.tx, { encounterId: e.id }) };
  });
}

/** The patient's released reports and result trends across visits (and merged records). */
export async function getPatientResults(db: Kysely<DB>, caller: Caller, patientId: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.view_results' }, async (ctx) => {
    const exists = await ctx.tx.selectFrom('patient.patient').select('id').where('id', '=', patientId).executeTakeFirst();
    if (!exists) throw notFound('patient', { patientId });
    await assertChartAccess(ctx.tx, ctx.actor.staffId, patientId, now);
    ctx.audit({ action: 'view', subjectType: 'diagnostics.results', subjectId: patientId, patientId });
    const family = await mergedFamily(ctx.tx, patientId);
    const { rows: reports } = await sql<Record<string, unknown>>`
      SELECT dr.id AS "reportId", dr.report_type AS "reportType", dr.status, dr.conclusion, dr.released_at AS "releasedAt",
             st.display_name AS "releasedByName", dr.current_version AS "versionNo", si.name, si.category, o.requisition_no AS "requisitionNo",
             o.encounter_id AS "encounterId", oi.id AS "orderItemId", v.body, v.amendment_reason AS "amendmentReason",
             EXISTS (SELECT 1 FROM diagnostics.result_acknowledgement a WHERE a.diagnostic_report_id = dr.id AND a.staff_id = ${caller.actor.staffId ?? null}::uuid) AS "acknowledgedByMe"
      FROM diagnostics.diagnostic_report dr
      JOIN diagnostics.diagnostic_report_version v ON v.diagnostic_report_id = dr.id AND v.version_no = dr.current_version
      JOIN diagnostics.order_item oi ON oi.id = dr.order_item_id
      JOIN diagnostics.service_order o ON o.id = oi.service_order_id
      JOIN catalog.service_item si ON si.id = oi.service_item_id
      LEFT JOIN platform.staff st ON st.id = dr.released_by
      WHERE dr.patient_id = ANY(${family}::uuid[]) AND dr.status IN ('final', 'amended')
      ORDER BY dr.released_at DESC
      LIMIT 200`.execute(ctx.tx);
    // Verified values only (released or amended), oldest first per parameter, for trend charts.
    const { rows: trends } = await sql<Record<string, unknown>>`
      SELECT d.code, d.name, r.value_num AS "valueNum", r.value_text AS "valueText", ao.display AS "valueDisplay", r.unit,
             r.ref_low AS "refLow", r.ref_high AS "refHigh", r.abnormal_flag AS "abnormalFlag", r.entered_at AS "enteredAt"
      FROM diagnostics.result_item r
      JOIN catalog.observation_definition d ON d.id = r.observation_definition_id
      LEFT JOIN catalog.answer_option ao ON ao.id = r.value_option_id
      WHERE r.patient_id = ANY(${family}::uuid[]) AND r.superseded_at IS NULL AND r.verified_at IS NOT NULL AND r.status <> 'cancelled'
      ORDER BY d.code, r.entered_at
      LIMIT 1000`.execute(ctx.tx);
    return { patientId, reports, trends };
  });
}

export type LabStage = 'collect' | 'receive' | 'result' | 'verify';

/** What the lab has to do next at one clinic: tests to collect, specimens to receive, to result, to verify. */
export async function labWorklist(db: Kysely<DB>, caller: Caller, f: { facilityId: string; stage: LabStage }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const patient = sql`p.given_name || coalesce(' ' || p.family_name, '')`;
    if (f.stage === 'receive') {
      const { rows } = await sql`
        SELECT sp.id AS "specimenId", sp.accession_no AS "accessionNo", sp.barcode, sp.specimen_type AS "specimenType", sp.container_type AS "containerType",
               sp.collected_at AS "collectedAt", sp.version, sp.patient_id AS "patientId", ${patient} AS "patientName", p.mrn,
               (SELECT string_agg(si.name, ', ' ORDER BY si.name) FROM diagnostics.specimen_order_item so
                  JOIN diagnostics.order_item oi ON oi.id = so.order_item_id JOIN catalog.service_item si ON si.id = oi.service_item_id
                 WHERE so.specimen_id = sp.id) AS tests,
               (SELECT min(${PRIORITY}) FROM diagnostics.specimen_order_item so JOIN diagnostics.order_item oi ON oi.id = so.order_item_id
                  JOIN diagnostics.service_order o ON o.id = oi.service_order_id WHERE so.specimen_id = sp.id) AS "priorityRank"
        FROM diagnostics.specimen sp JOIN patient.patient p ON p.id = sp.patient_id
        WHERE sp.facility_id = ${f.facilityId} AND sp.status = 'collected'
        ORDER BY "priorityRank", sp.collected_at
        LIMIT 300`.execute(tx);
      return rows;
    }
    const base = sql`
      SELECT oi.id AS "orderItemId", oi.status, oi.version, si.name, si.category, l.specimen_type AS "specimenType", l.section, o.priority,
             o.requisition_no AS "requisitionNo", o.ordered_at AS "orderedAt", o.clinical_indication AS "clinicalIndication",
             oi.patient_id AS "patientId", ${patient} AS "patientName", p.mrn, p.sex, p.birth_date AS "birthDate",
             parent.id AS "panelOrderItemId", parent_si.name AS "panelName",
             (SELECT sp.accession_no FROM diagnostics.specimen_order_item so JOIN diagnostics.specimen sp ON sp.id = so.specimen_id
               WHERE so.order_item_id = oi.id AND sp.status <> 'rejected' ORDER BY sp.created_at DESC LIMIT 1) AS "accessionNo",
             EXISTS (SELECT 1 FROM diagnostics.specimen_order_item so JOIN diagnostics.specimen sp ON sp.id = so.specimen_id
                      WHERE so.order_item_id = oi.id AND sp.status = 'rejected'
                        AND NOT EXISTS (SELECT 1 FROM diagnostics.specimen r WHERE r.recollection_of_id = sp.id)) AS "needsRecollection",
             (SELECT sp.id FROM diagnostics.specimen_order_item so JOIN diagnostics.specimen sp ON sp.id = so.specimen_id
               WHERE so.order_item_id = oi.id AND sp.status = 'rejected'
                 AND NOT EXISTS (SELECT 1 FROM diagnostics.specimen r WHERE r.recollection_of_id = sp.id) LIMIT 1) AS "rejectedSpecimenId"
      FROM diagnostics.order_item oi
      JOIN diagnostics.service_order o ON o.id = oi.service_order_id
      JOIN catalog.service_item si ON si.id = oi.service_item_id
      LEFT JOIN catalog.lab_test_def l ON l.service_item_id = si.id
      JOIN patient.patient p ON p.id = oi.patient_id
      LEFT JOIN diagnostics.order_item parent ON parent.id = oi.panel_parent_item_id
      LEFT JOIN catalog.service_item parent_si ON parent_si.id = parent.service_item_id
      WHERE o.facility_id = ${f.facilityId}`;
    if (f.stage === 'collect' || f.stage === 'result') {
      const statuses = f.stage === 'collect' ? ['ordered', 'scheduled'] : ['in_progress'];
      const { rows } = await sql`${base} AND si.category = 'lab_test' AND oi.status = ANY(${statuses}::text[])
        ORDER BY ${PRIORITY}, o.ordered_at LIMIT 300`.execute(tx);
      return rows;
    }
    // verify: reportable roots (single tests and panels) whose tests all have results, not yet released.
    const { rows } = await sql`
      SELECT oi.id AS "orderItemId", oi.status, si.name, si.category, o.priority, o.requisition_no AS "requisitionNo", o.ordered_at AS "orderedAt",
             oi.patient_id AS "patientId", ${patient} AS "patientName", p.mrn,
             dr.id AS "reportId", dr.status AS "reportStatus", dr.version AS "reportVersion",
             EXISTS (SELECT 1 FROM diagnostics.result_item r WHERE r.superseded_at IS NULL AND r.is_critical AND r.status <> 'cancelled'
                       AND (r.order_item_id = oi.id OR r.order_item_id IN (SELECT c.id FROM diagnostics.order_item c WHERE c.panel_parent_item_id = oi.id))) AS "hasCritical"
      FROM diagnostics.order_item oi
      JOIN diagnostics.service_order o ON o.id = oi.service_order_id
      JOIN catalog.service_item si ON si.id = oi.service_item_id
      JOIN patient.patient p ON p.id = oi.patient_id
      LEFT JOIN diagnostics.diagnostic_report dr ON dr.order_item_id = oi.id AND dr.status <> 'cancelled'
      WHERE o.facility_id = ${f.facilityId} AND oi.panel_parent_item_id IS NULL AND si.category IN ('lab_test', 'lab_panel')
        AND oi.status = 'resulted'
      ORDER BY ${PRIORITY}, o.ordered_at
      LIMIT 300`.execute(tx);
    return rows;
  });
}

/**
 * One lab order item for entry or verification: its tests, their parameters (with the patient's reference
 * range and coded answers), current results with critical-call logs, isolates, and the report.
 */
export async function getLabItem(db: Kysely<DB>, caller: Caller, orderItemId: string) {
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.view_lab_item' }, async (ctx) => {
    const { rows: [root] } = await sql<Record<string, unknown> & { orderItemId: string; patientId: string; category: string; sex: string; birthDate: string | null }>`
      SELECT oi.id AS "orderItemId", oi.status, oi.version, si.name, si.category, oi.panel_parent_item_id AS "panelOrderItemId", o.priority,
             o.requisition_no AS "requisitionNo", o.clinical_indication AS "clinicalIndication", o.ordered_by AS "orderedBy",
             os.display_name AS "orderedByName", oi.patient_id AS "patientId", p.given_name || coalesce(' ' || p.family_name, '') AS "patientName",
             p.mrn, p.sex, p.birth_date::text AS "birthDate"
      FROM diagnostics.order_item oi
      JOIN diagnostics.service_order o ON o.id = oi.service_order_id
      JOIN platform.staff os ON os.id = o.ordered_by
      JOIN catalog.service_item si ON si.id = oi.service_item_id
      JOIN patient.patient p ON p.id = oi.patient_id
      WHERE oi.id = ${orderItemId}`.execute(ctx.tx);
    if (!root) throw notFound('order item', { orderItemId });
    ctx.audit({ action: 'view', subjectType: 'diagnostics.order_item', subjectId: root.orderItemId, patientId: root.patientId, reason: 'lab work' });
    const { rows: tests } = await sql<{ orderItemId: string; serviceItemId: string; name: string; status: string; section: string | null; version: number }>`
      SELECT oi.id AS "orderItemId", oi.service_item_id AS "serviceItemId", si.name, oi.status, l.section, oi.version
      FROM diagnostics.order_item oi JOIN catalog.service_item si ON si.id = oi.service_item_id
      LEFT JOIN catalog.lab_test_def l ON l.service_item_id = si.id
      WHERE (oi.id = ${orderItemId} AND si.category = 'lab_test') OR oi.panel_parent_item_id = ${orderItemId}
      ORDER BY oi.created_at`.execute(ctx.tx);
    const age = root.birthDate ? Math.floor((clock(caller).getTime() - Date.parse(`${root.birthDate}T00:00:00Z`)) / 86_400_000) : null;
    const out = [];
    for (const t of tests) {
      const { rows: definitions } = await sql<Record<string, unknown>>`
        SELECT d.id AS "observationDefinitionId", d.code, d.name, d.value_type AS "valueType", d.unit, d.decimal_places AS "decimalPlaces", d.is_reportable AS "isReportable",
               rr.low, rr.high, rr.critical_low AS "criticalLow", rr.critical_high AS "criticalHigh", rr.text_range AS "textRange",
               coalesce((SELECT jsonb_agg(jsonb_build_object('answerOptionId', a.id, 'code', a.code, 'display', a.display, 'isAbnormal', a.is_abnormal) ORDER BY a.sequence)
                         FROM catalog.answer_option a WHERE a.observation_definition_id = d.id), '[]') AS options
        FROM catalog.observation_definition d
        LEFT JOIN LATERAL (
          SELECT * FROM catalog.reference_range r
          WHERE r.observation_definition_id = d.id AND r.sex IN (${root.sex}, 'any')
            AND ((${age}::int IS NULL AND r.age_min_days = 0 AND r.age_max_days IS NULL)
                 OR (${age}::int >= r.age_min_days AND (r.age_max_days IS NULL OR ${age}::int < r.age_max_days)))
            AND r.valid_from <= current_date AND (r.valid_to IS NULL OR r.valid_to > current_date)
          ORDER BY (r.sex = 'any'), r.age_min_days DESC LIMIT 1) rr ON true
        WHERE d.lab_test_item_id = ${t.serviceItemId} AND d.status = 'active'
        ORDER BY d.sequence, d.code`.execute(ctx.tx);
      const { rows: results } = await sql<Record<string, unknown>>`
        SELECT r.id AS "resultItemId", r.observation_definition_id AS "observationDefinitionId", r.value_num AS "valueNum", r.value_text AS "valueText",
               r.value_option_id AS "valueOptionId", ao.display AS "valueDisplay", r.unit, r.ref_low AS "refLow", r.ref_high AS "refHigh",
               r.abnormal_flag AS "abnormalFlag", r.is_critical AS "isCritical", r.status, r.entered_by AS "enteredBy", es.display_name AS "enteredByName",
               r.entered_at AS "enteredAt", r.verified_at AS "verifiedAt", r.supersedes_id AS "supersedesId", r.correction_reason AS "correctionReason",
               coalesce((SELECT jsonb_agg(jsonb_build_object('criticalAlertId', c.id, 'notifiedAt', c.notified_at, 'channel', c.channel,
                                                             'notifiedTo', coalesce(ns.display_name, c.notified_to_name), 'readBackConfirmed', c.read_back_confirmed))
                         FROM diagnostics.critical_alert c LEFT JOIN platform.staff ns ON ns.id = c.notified_to_staff_id
                         WHERE c.result_item_id = r.id), '[]') AS "criticalAlerts"
        FROM diagnostics.result_item r
        JOIN platform.staff es ON es.id = r.entered_by
        LEFT JOIN catalog.answer_option ao ON ao.id = r.value_option_id
        WHERE r.order_item_id = ${t.orderItemId} AND r.superseded_at IS NULL AND r.status <> 'cancelled'`.execute(ctx.tx);
      const { rows: isolates } = await sql<Record<string, unknown>>`
        SELECT m.id AS "isolateId", m.sequence, m.organism_name AS "organism", m.colony_count AS "colonyCount",
               coalesce((SELECT jsonb_agg(jsonb_build_object('antibiotic', s.antibiotic_name, 'method', s.method, 'micValue', s.mic_value, 'zoneMm', s.zone_mm,
                                                             'interpretation', s.interpretation) ORDER BY s.antibiotic_name)
                         FROM diagnostics.micro_susceptibility s WHERE s.micro_isolate_id = m.id), '[]') AS susceptibilities
        FROM diagnostics.micro_isolate m WHERE m.order_item_id = ${t.orderItemId} ORDER BY m.sequence`.execute(ctx.tx);
      out.push({ ...t, definitions, results, isolates });
    }
    const report = await ctx.tx
      .selectFrom('diagnostics.diagnostic_report')
      .select(['id as reportId', 'status', 'version', 'current_version as versionNo', 'conclusion', 'released_at as releasedAt'])
      .where('order_item_id', '=', root.panelOrderItemId ? (root.panelOrderItemId as string) : orderItemId)
      .where('status', '<>', 'cancelled')
      .executeTakeFirst();
    return { ...root, tests: out, report: report ?? null };
  });
}

/** The imaging worklist at a clinic, with each study's Form F and report state. */
export async function imagingWorklist(db: Kysely<DB>, caller: Caller, f: { facilityId: string; status?: string | undefined }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const statuses = f.status ? [f.status] : ['scheduled', 'arrived', 'in_progress', 'completed'];
    const { rows } = await sql`
      SELECT s.id AS "imagingStudyId", s.order_item_id AS "orderItemId", s.modality, s.accession_no AS "accessionNo", s.status, s.is_obstetric AS "isObstetric",
             s.scheduled_at AS "scheduledAt", s.arrived_at AS "arrivedAt", s.performed_at AS "performedAt", s.version, si.name, o.priority,
             o.requisition_no AS "requisitionNo", o.clinical_indication AS "clinicalIndication", s.patient_id AS "patientId",
             p.given_name || coalesce(' ' || p.family_name, '') AS "patientName", p.mrn, p.sex,
             ff.id AS "formFId", ff.version AS "formFVersion",
             (ff.patient_declaration_at IS NOT NULL AND ff.doctor_declaration_at IS NOT NULL) AS "formFComplete",
             dr.id AS "reportId", dr.status AS "reportStatus", dr.version AS "reportVersion"
      FROM diagnostics.imaging_study s
      JOIN diagnostics.order_item oi ON oi.id = s.order_item_id
      JOIN diagnostics.service_order o ON o.id = oi.service_order_id
      JOIN catalog.service_item si ON si.id = oi.service_item_id
      JOIN patient.patient p ON p.id = s.patient_id
      LEFT JOIN diagnostics.pcpndt_form_f ff ON ff.imaging_study_id = s.id
      LEFT JOIN diagnostics.diagnostic_report dr ON dr.order_item_id = s.order_item_id AND dr.status <> 'cancelled'
      WHERE s.facility_id = ${f.facilityId} AND s.status = ANY(${statuses}::text[])
      ORDER BY ${PRIORITY}, coalesce(s.scheduled_at, o.ordered_at)
      LIMIT 300`.execute(tx);
    return rows;
  });
}

/** Released reports on the caller's orders that they have not acknowledged yet — critical ones first. */
export async function unacknowledgedResults(db: Kysely<DB>, caller: Caller, f: { facilityId?: string | undefined }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql`
      SELECT dr.id AS "reportId", dr.report_type AS "reportType", dr.status, dr.released_at AS "releasedAt", si.name,
             o.requisition_no AS "requisitionNo", o.encounter_id AS "encounterId", o.facility_id AS "facilityId", dr.patient_id AS "patientId",
             p.given_name || coalesce(' ' || p.family_name, '') AS "patientName", p.mrn,
             EXISTS (SELECT 1 FROM diagnostics.result_item r WHERE r.superseded_at IS NULL AND r.is_critical AND r.status <> 'cancelled'
                       AND (r.order_item_id = oi.id OR r.order_item_id IN (SELECT c.id FROM diagnostics.order_item c WHERE c.panel_parent_item_id = oi.id))) AS "isCritical"
      FROM diagnostics.diagnostic_report dr
      JOIN diagnostics.order_item oi ON oi.id = dr.order_item_id
      JOIN diagnostics.service_order o ON o.id = oi.service_order_id
      JOIN catalog.service_item si ON si.id = oi.service_item_id
      JOIN patient.patient p ON p.id = dr.patient_id
      WHERE dr.status IN ('final', 'amended') AND o.ordered_by = ${caller.actor.staffId ?? null}::uuid
        AND (${f.facilityId ?? null}::uuid IS NULL OR o.facility_id = ${f.facilityId ?? null}::uuid)
        AND NOT EXISTS (SELECT 1 FROM diagnostics.result_acknowledgement a WHERE a.diagnostic_report_id = dr.id AND a.staff_id = ${caller.actor.staffId ?? null}::uuid)
      ORDER BY "isCritical" DESC, dr.released_at DESC
      LIMIT 200`.execute(tx);
    return rows;
  });
}

/** Facilities of order items (for the specimen-collection permission check). */
export async function orderItemFacilities(db: Kysely<DB>, caller: Caller, orderItemIds: string[]) {
  if (!orderItemIds.length) return [];
  return runQuery(db, caller.tenantId, async (tx) =>
    (
      await tx
        .selectFrom('diagnostics.order_item as oi')
        .innerJoin('diagnostics.service_order as o', 'o.id', 'oi.service_order_id')
        .select('o.facility_id')
        .distinct()
        .where('oi.id', 'in', orderItemIds)
        .execute()
    ).map((r) => r.facility_id),
  );
}

export async function encounterFacilityOf(db: Kysely<DB>, caller: Caller, encounterId: string) {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('clinical.encounter').select('facility_id').where('id', '=', encounterId).executeTakeFirst())?.facility_id);
}

