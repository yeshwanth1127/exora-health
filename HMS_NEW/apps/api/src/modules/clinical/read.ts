// Read side. Worklists show who is waiting without chart contents. Opening an encounter or a chart
// checks the care relationship and is recorded in the audit log (who viewed which patient, when).
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { notFound, runCommand, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { assertChartAccess } from './access.ts';

export interface WorklistFilter {
  facilityId: string;
  date: string; // facility-local date of arrival
  staffId?: string;
  status?: string;
}

export async function listEncounters(db: Kysely<DB>, caller: Caller, f: WorklistFilter) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<{
      encounterId: string;
      encounterNo: string;
      status: string;
      encounterClass: string;
      patientId: string;
      patientName: string;
      mrn: string;
      attendingStaffId: string;
      attendingName: string;
      appointmentId: string | null;
      tokenNo: number | null;
      arrivedAt: Date;
      startedAt: Date | null;
      endedAt: Date | null;
    }>`
      SELECT e.id AS "encounterId", e.encounter_no AS "encounterNo", e.status, e.encounter_class AS "encounterClass",
             e.patient_id AS "patientId", p.given_name || coalesce(' ' || p.family_name, '') AS "patientName", p.mrn,
             e.attending_staff_id AS "attendingStaffId", s.display_name AS "attendingName",
             e.appointment_id AS "appointmentId", q.token_no AS "tokenNo",
             e.arrived_at AS "arrivedAt", e.started_at AS "startedAt", e.ended_at AS "endedAt"
      FROM clinical.encounter e
      JOIN platform.facility f ON f.id = e.facility_id
      JOIN patient.patient p ON p.id = e.patient_id
      JOIN platform.staff s ON s.id = e.attending_staff_id
      LEFT JOIN booking.queue_token q ON q.appointment_id = e.appointment_id
      WHERE e.facility_id = ${f.facilityId}
        AND (e.arrived_at AT TIME ZONE f.timezone)::date = ${f.date}::date
        AND (${f.staffId ?? null}::uuid IS NULL OR e.attending_staff_id = ${f.staffId ?? null}::uuid)
        AND (${f.status ?? null}::text IS NULL OR e.status = ${f.status ?? null})
      ORDER BY e.arrived_at`.execute(tx);
    return rows;
  });
}

export async function encounterForAppointment(db: Kysely<DB>, caller: Caller, appointmentId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const e = await tx
      .selectFrom('clinical.encounter')
      .select(['id as encounterId', 'encounter_no as encounterNo', 'status', 'facility_id as facilityId'])
      .where('appointment_id', '=', appointmentId)
      .executeTakeFirst();
    if (!e) throw notFound('encounter for this appointment (it is opened shortly after check-in)', { appointmentId });
    return e;
  });
}

export async function encounterFacility(db: Kysely<DB>, caller: Caller, encounterId: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('clinical.encounter').select('facility_id').where('id', '=', encounterId).executeTakeFirst())?.facility_id);
}

/** Facility of the encounter a note/observation belongs to (for authorization). */
export async function recordFacility(db: Kysely<DB>, caller: Caller, kind: 'note' | 'observation', id: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const table = kind === 'note' ? 'clinical.clinical_note' : 'clinical.observation';
    const row = await tx
      .selectFrom(`${table} as r` as 'clinical.clinical_note as r')
      .innerJoin('clinical.encounter as e', 'e.id', 'r.encounter_id')
      .select('e.facility_id')
      .where('r.id', '=', id)
      .executeTakeFirst();
    return row?.facility_id;
  });
}

async function encounterContent(tx: Transaction<DB>, encounterId: string) {
  const [vitals, notes, diagnoses] = await Promise.all([
    tx
      .selectFrom('clinical.observation')
      .select(['id as observationId', 'code', 'display', 'value_num as valueNum', 'value_text as valueText', 'unit', 'group_id as groupId', 'effective_at as effectiveAt', 'recorded_by as recordedBy', 'status', 'supersedes_id as supersedesId'])
      .where('encounter_id', '=', encounterId)
      .orderBy('effective_at')
      .execute(),
    tx
      .selectFrom('clinical.clinical_note as n')
      .innerJoin('clinical.clinical_note_version as v', (j) => j.onRef('v.note_id', '=', 'n.id').onRef('v.version_no', '=', 'n.current_version'))
      .innerJoin('platform.staff as s', 's.id', 'n.author_staff_id')
      .leftJoin('clinical.form_template as t', 't.id', 'v.form_template_id')
      .select([
        'n.id as noteId',
        'n.note_type as noteType',
        'n.status',
        'n.current_version as currentVersion',
        'n.author_staff_id as authorStaffId',
        's.display_name as authorName',
        'n.signed_at as signedAt',
        't.code as templateCode',
        'v.data',
        'v.narrative',
        'v.amendment_reason as lastAmendmentReason',
        'v.created_at as savedAt',
      ])
      .where('n.encounter_id', '=', encounterId)
      .orderBy('n.created_at')
      .execute(),
    tx
      .selectFrom('clinical.encounter_diagnosis as d')
      .innerJoin('clinical.condition as c', 'c.id', 'd.condition_id')
      .select(['d.id as encounterDiagnosisId', 'd.role', 'd.rank', 'c.id as conditionId', 'c.display', 'c.code_system as codeSystem', 'c.code', 'c.verification_status as verificationStatus'])
      .where('d.encounter_id', '=', encounterId)
      .orderBy('d.role')
      .orderBy('d.rank')
      .execute(),
  ]);
  return { vitals, notes, diagnoses };
}

async function patientSummary(tx: Transaction<DB>, patientId: string) {
  const [patient, allergies, problems] = await Promise.all([
    tx.selectFrom('patient.patient').select(['id as patientId', 'mrn', 'given_name as givenName', 'family_name as familyName', 'sex', 'birth_date as birthDate', 'blood_group as bloodGroup']).where('id', '=', patientId).executeTakeFirstOrThrow(),
    tx
      .selectFrom('clinical.allergy_intolerance')
      .select(['id as allergyId', 'category', 'substance', 'reaction', 'severity', 'criticality', 'status'])
      .where('patient_id', '=', patientId)
      .where('status', '=', 'active')
      .execute(),
    tx
      .selectFrom('clinical.condition')
      .select(['id as conditionId', 'display', 'code_system as codeSystem', 'code', 'clinical_status as clinicalStatus', 'verification_status as verificationStatus', 'is_chronic as isChronic', 'onset_on as onsetOn'])
      .where('patient_id', '=', patientId)
      .where('clinical_status', 'in', ['active', 'recurrence'])
      .where('verification_status', 'not in', ['refuted', 'entered_in_error'])
      .execute(),
  ]);
  return { patient, allergies, problems };
}

/** One encounter with its vitals, notes (current versions) and diagnoses, plus allergies and problems. */
export async function getEncounterDetail(db: Kysely<DB>, caller: Caller, encounterId: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.view_encounter' }, async (ctx) => {
    const e = await ctx.tx.selectFrom('clinical.encounter').selectAll().where('id', '=', encounterId).executeTakeFirst();
    if (!e) throw notFound('encounter', { encounterId });
    await assertChartAccess(ctx.tx, ctx.actor.staffId, e.patient_id, now);
    ctx.audit({ action: 'view', subjectType: 'clinical.encounter', subjectId: e.id, patientId: e.patient_id });
    return {
      encounter: {
        encounterId: e.id,
        encounterNo: e.encounter_no,
        status: e.status,
        encounterClass: e.encounter_class,
        facilityId: e.facility_id,
        attendingStaffId: e.attending_staff_id,
        appointmentId: e.appointment_id,
        chiefComplaint: e.chief_complaint,
        arrivedAt: e.arrived_at,
        startedAt: e.started_at,
        endedAt: e.ended_at,
        disposition: e.disposition,
        followUpAdvisedOn: e.follow_up_advised_on,
      },
      ...(await patientSummary(ctx.tx, e.patient_id)),
      ...(await encounterContent(ctx.tx, e.id)),
    };
  });
}

/** The patient's chart: demographics, allergies, problem list, recent encounters and latest vitals. */
export async function getPatientChart(db: Kysely<DB>, caller: Caller, patientId: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.view_chart' }, async (ctx) => {
    const exists = await ctx.tx.selectFrom('patient.patient').select('id').where('id', '=', patientId).executeTakeFirst();
    if (!exists) throw notFound('patient', { patientId });
    await assertChartAccess(ctx.tx, ctx.actor.staffId, patientId, now);
    ctx.audit({ action: 'view', subjectType: 'patient.chart', subjectId: patientId, patientId });
    const [summary, encounters, latestVitals] = await Promise.all([
      patientSummary(ctx.tx, patientId),
      ctx.tx
        .selectFrom('clinical.encounter as e')
        .innerJoin('platform.staff as s', 's.id', 'e.attending_staff_id')
        .select(['e.id as encounterId', 'e.encounter_no as encounterNo', 'e.status', 'e.encounter_class as encounterClass', 'e.arrived_at as arrivedAt', 'e.disposition', 's.display_name as attendingName'])
        .where('e.patient_id', '=', patientId)
        .where('e.status', 'not in', ['entered_in_error'])
        .orderBy('e.arrived_at', 'desc')
        .limit(20)
        .execute(),
      sql<{ code: string; display: string; valueNum: string | null; valueText: string | null; unit: string | null; effectiveAt: Date }>`
        SELECT DISTINCT ON (code) code, display, value_num AS "valueNum", value_text AS "valueText", unit, effective_at AS "effectiveAt"
        FROM clinical.observation
        WHERE patient_id = ${patientId} AND status = 'final'
        ORDER BY code, effective_at DESC`.execute(ctx.tx),
    ]);
    return { ...summary, encounters, latestVitals: latestVitals.rows };
  });
}

export async function listNoteTemplates(db: Kysely<DB>, caller: Caller) {
  return runQuery(db, caller.tenantId, (tx) =>
    tx
      .selectFrom('clinical.form_template')
      .select(['id as templateId', 'code', 'template_version as templateVersion', 'name', 'note_type as noteType', 'schema'])
      .where('status', '=', 'published')
      .orderBy('code')
      .orderBy('template_version', 'desc')
      .execute(),
  );
}
