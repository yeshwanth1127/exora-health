// Imaging (ERD m06): the study moves scheduled → arrived → in_progress → completed → reported (the last
// by releasing its report), or is cancelled. An obstetric ultrasound needs PC-PNDT Form F with the
// patient's and the doctor's declarations before it can be completed; Form F is reported monthly to the
// Appropriate Authority and kept for two years.
import { sql, type DB, type Kysely } from '@hms/db';
import { conflict, invalid, notFound, preconditionFailed, runCommand } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { cancelOpenReports } from './orders.ts';
import { actor, assertDiagnosticsActive, moveItem, refreshOrder } from './state.ts';

export interface StudyStatusInput {
  imagingStudyId: string;
  version: number;
  /** The next state, or the current one to change only the other fields. */
  status: 'scheduled' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  isObstetric?: boolean | undefined;
  doseDlpMgyCm?: number | undefined;
  pacsUrl?: string | undefined;
  equipmentId?: string | undefined;
  reason?: string | undefined;
}

export async function setStudyStatus(db: Kysely<DB>, caller: Caller, input: StudyStatusInput) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  if (input.status === 'cancelled' && !input.reason?.trim()) throw invalid('give a reason for cancelling', { reason: 'reason_required' });
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.set_study_status' }, async (ctx) => {
    const me = actor(ctx);
    const s = await ctx.tx.selectFrom('diagnostics.imaging_study').selectAll().where('id', '=', input.imagingStudyId).forUpdate().executeTakeFirst();
    if (!s) throw notFound('imaging study', { imagingStudyId: input.imagingStudyId });
    if (s.version !== input.version) throw conflict('this study was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: s.version });
    const item = await ctx.tx.selectFrom('diagnostics.order_item').select(['id', 'status', 'service_order_id']).where('id', '=', s.order_item_id).forUpdate().executeTakeFirstOrThrow();
    const next: Record<string, unknown> = { status: input.status, updated_by: me };
    const isObstetric = input.isObstetric ?? s.is_obstetric;
    if (input.isObstetric !== undefined) {
      if (['completed', 'reported'].includes(s.status)) throw preconditionFailed("a completed study can't change its obstetric flag", { reason: 'invalid_transition' });
      if (input.isObstetric && s.modality !== 'US') throw invalid('only ultrasound studies are obstetric (Form F)', { reason: 'not_ultrasound' });
      next.is_obstetric = input.isObstetric;
    }
    if (input.doseDlpMgyCm !== undefined) next.dose_dlp_mgy_cm = input.doseDlpMgyCm;
    if (input.pacsUrl !== undefined) next.pacs_url = input.pacsUrl;
    if (input.equipmentId !== undefined) next.equipment_id = input.equipmentId;
    const allowed: Record<string, string[]> = { scheduled: ['arrived', 'cancelled'], arrived: ['in_progress', 'cancelled'], in_progress: ['completed', 'cancelled'] };
    const same = input.status === s.status && ['scheduled', 'arrived', 'in_progress'].includes(s.status);
    if (!same && !(allowed[s.status] ?? []).includes(input.status)) throw preconditionFailed(`a ${s.status} study can't become ${input.status}`, { reason: 'invalid_transition', allowed: allowed[s.status] ?? [] });

    if (same) {
      delete next.status;
    } else if (input.status === 'arrived') {
      next.arrived_at = now;
      await moveItem(ctx.tx, item, 'scheduled', { by: me });
    } else if (input.status === 'in_progress') {
      next.started_at = now;
      await moveItem(ctx.tx, item, 'in_progress', { by: me });
    } else if (input.status === 'completed') {
      if (isObstetric && s.modality === 'US') {
        const f = await ctx.tx.selectFrom('diagnostics.pcpndt_form_f').select(['patient_declaration_at', 'doctor_declaration_at']).where('imaging_study_id', '=', s.id).executeTakeFirst();
        if (!f?.patient_declaration_at || !f.doctor_declaration_at) throw preconditionFailed('an obstetric ultrasound needs Form F with both declarations before it is completed (PC-PNDT Act)', { reason: 'form_f_required' });
      }
      Object.assign(next, { performed_at: now, performed_by: me });
      await moveItem(ctx.tx, item, 'resulted', { by: me });
    } else if (input.status === 'cancelled') {
      next.cancel_reason = input.reason!.trim();
      await moveItem(ctx.tx, item, 'cancelled', { cancelReason: input.reason!.trim(), at: now, by: me });
      await cancelOpenReports(ctx.tx, [item.id], input.reason!.trim(), me);
      await refreshOrder(ctx.tx, item.service_order_id, me);
      ctx.emit({ eventType: 'order_item.cancelled', aggregateType: 'diagnostics.order_item', aggregateId: item.id, payload: { orderId: item.service_order_id, orderItemId: item.id, cancelledItemIds: [item.id], patientId: s.patient_id, reason: input.reason!.trim() } });
    }
    const { version } = await ctx.tx.updateTable('diagnostics.imaging_study').set(next).where('id', '=', s.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: same ? 'update' : 'status_change', subjectType: 'diagnostics.imaging_study', subjectId: s.id, patientId: s.patient_id, reason: input.reason, diff: { status: [s.status, input.status], isObstetric: input.isObstetric } });
    if (input.status === 'completed' && !same) ctx.emit({ eventType: 'imaging_study.completed', aggregateType: 'diagnostics.imaging_study', aggregateId: s.id, payload: { imagingStudyId: s.id, orderItemId: item.id, accessionNo: s.accession_no, patientId: s.patient_id } });
    return { imagingStudyId: s.id, status: input.status, version };
  });
}

// ---- PC-PNDT Form F ---------------------------------------------------------------------------------------

export interface FormFInput {
  imagingStudyId: string;
  formData: Record<string, unknown>;
  patientDeclared: boolean;
  doctorDeclared: boolean;
  version?: number | undefined;
}

/** Records (or completes) Form F for an obstetric ultrasound. Declarations, once made, stand. */
export async function saveFormF(db: Kysely<DB>, caller: Caller, input: FormFInput) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.save_form_f' }, async (ctx) => {
    const me = actor(ctx);
    const s = await ctx.tx.selectFrom('diagnostics.imaging_study').select(['id', 'patient_id', 'facility_id', 'modality', 'is_obstetric', 'status']).where('id', '=', input.imagingStudyId).executeTakeFirst();
    if (!s) throw notFound('imaging study', { imagingStudyId: input.imagingStudyId });
    if (s.modality !== 'US' || !s.is_obstetric) throw preconditionFailed('Form F is for obstetric ultrasound studies', { reason: 'not_obstetric' });
    if (s.status === 'cancelled') throw preconditionFailed('this study was cancelled', { reason: 'cancelled' });
    const existing = await ctx.tx.selectFrom('diagnostics.pcpndt_form_f').selectAll().where('imaging_study_id', '=', s.id).forUpdate().executeTakeFirst();
    if (existing) {
      if (existing.submitted_to_authority_at) throw conflict('this Form F was already submitted to the Appropriate Authority', { reason: 'submitted' });
      if (input.version === undefined || existing.version !== input.version) throw conflict('this Form F was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: existing.version });
      const { version } = await ctx.tx
        .updateTable('diagnostics.pcpndt_form_f')
        .set({
          form_data: JSON.stringify(input.formData),
          patient_declaration_at: existing.patient_declaration_at ?? (input.patientDeclared ? now : null),
          ...(existing.doctor_declaration_at || !input.doctorDeclared ? {} : { doctor_declaration_at: now, doctor_declaration_by: me }),
          updated_by: me,
        })
        .where('id', '=', existing.id)
        .returning('version')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'update', subjectType: 'diagnostics.pcpndt_form_f', subjectId: existing.id, patientId: s.patient_id, diff: { patientDeclared: input.patientDeclared, doctorDeclared: input.doctorDeclared } });
      return { formFId: existing.id, version };
    }
    const { rows: [tz] } = await sql<{ month: string }>`
      SELECT date_trunc('month', (${now}::timestamptz AT TIME ZONE f.timezone))::date::text AS month FROM platform.facility f WHERE f.id = ${s.facility_id}`.execute(ctx.tx);
    const { id, version, retain_until } = await ctx.tx
      .insertInto('diagnostics.pcpndt_form_f')
      .values({
        tenant_id: ctx.tenantId,
        imaging_study_id: s.id,
        patient_id: s.patient_id,
        facility_id: s.facility_id,
        form_data: JSON.stringify(input.formData),
        patient_declaration_at: input.patientDeclared ? now : null,
        doctor_declaration_at: input.doctorDeclared ? now : null,
        doctor_declaration_by: input.doctorDeclared ? me : null,
        reporting_month: tz!.month,
        // Two years from the record (PC-PNDT Rules, rule 9(6)); the table refuses anything shorter.
        retain_until: sql<string>`((now() AT TIME ZONE 'UTC') + interval '2 years')::date`,
        created_by: me,
      })
      .returning(['id', 'version', 'retain_until'])
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'diagnostics.pcpndt_form_f', subjectId: id, patientId: s.patient_id, diff: { reportingMonth: tz!.month } });
    return { formFId: id, version, retainUntil: retain_until };
  });
}

/** The month's Form F register for one clinic (statutory, sensitive: every read is audited). */
export async function listFormF(db: Kysely<DB>, caller: Caller, f: { facilityId: string; month: string }) {
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.view_form_f' }, async (ctx) => {
    const { rows } = await sql<Record<string, unknown>>`
      SELECT f.id AS "formFId", f.imaging_study_id AS "imagingStudyId", f.patient_id AS "patientId",
             p.given_name || coalesce(' ' || p.family_name, '') AS "patientName", p.mrn, s.accession_no AS "accessionNo", s.status AS "studyStatus",
             f.form_data AS "formData", f.patient_declaration_at AS "patientDeclarationAt", f.doctor_declaration_at AS "doctorDeclarationAt",
             d.display_name AS "doctorName", f.reporting_month::text AS "reportingMonth", f.submitted_to_authority_at AS "submittedAt",
             f.submission_ref AS "submissionRef", f.retain_until::text AS "retainUntil", f.version
      FROM diagnostics.pcpndt_form_f f
      JOIN diagnostics.imaging_study s ON s.id = f.imaging_study_id
      JOIN patient.patient p ON p.id = f.patient_id
      LEFT JOIN platform.staff d ON d.id = f.doctor_declaration_by
      WHERE f.facility_id = ${f.facilityId} AND f.reporting_month = ${`${f.month}-01`}::date
      ORDER BY f.created_at`.execute(ctx.tx);
    ctx.audit({ action: 'view', subjectType: 'diagnostics.pcpndt_register', subjectId: f.facilityId, reason: `Form F ${f.month}`, diff: { rows: rows.length } });
    return rows;
  });
}

/** Marks the month's complete Form F records as submitted; incomplete ones stay open and are counted. */
export async function submitFormF(db: Kysely<DB>, caller: Caller, input: { facilityId: string; month: string; submissionRef?: string | undefined }) {
  await assertDiagnosticsActive(db, caller);
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'diagnostics', name: 'diagnostics.submit_form_f' }, async (ctx) => {
    const me = actor(ctx);
    const month = `${input.month}-01`;
    const submitted = await ctx.tx
      .updateTable('diagnostics.pcpndt_form_f')
      .set({ submitted_to_authority_at: now, submitted_by: me, submission_ref: input.submissionRef?.trim() || null, updated_by: me })
      .where('facility_id', '=', input.facilityId)
      .where('reporting_month', '=', month)
      .where('submitted_to_authority_at', 'is', null)
      .where('patient_declaration_at', 'is not', null)
      .where('doctor_declaration_at', 'is not', null)
      .returning('id')
      .execute();
    const { rows: [left] } = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM diagnostics.pcpndt_form_f
      WHERE facility_id = ${input.facilityId} AND reporting_month = ${month}::date AND submitted_to_authority_at IS NULL`.execute(ctx.tx);
    if (!submitted.length && !left!.n) throw preconditionFailed('no Form F records are waiting for this month', { reason: 'nothing_to_submit' });
    ctx.audit({ action: 'export', subjectType: 'diagnostics.pcpndt_register', subjectId: input.facilityId, reason: `Form F ${input.month} submitted`, diff: { submitted: submitted.length, incomplete: left!.n, ref: input.submissionRef ?? null } });
    ctx.emit({ eventType: 'form_f.submitted', aggregateType: 'platform.facility', aggregateId: input.facilityId, payload: { facilityId: input.facilityId, month: input.month, count: submitted.length } });
    return { submitted: submitted.length, incomplete: left!.n };
  });
}
