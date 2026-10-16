// The rest of the clinical record (ERD m05): triage, medico-legal cases, immunizations, care plans,
// referrals, births and deaths. Each is recorded on an encounter by someone with access to it (the
// encounter team, staff joining an active encounter, or a care relationship for closed ones).
import type { DB, Kysely, Transaction } from '@hms/db';
import { sql } from '@hms/db';
import { conflict, DomainError, invalid, notFound, pgCode, preconditionFailed, runCommand, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { assertChartAccess, ensureEncounterAccess, lockEncounter } from './access.ts';

const OPEN = ['arrived', 'in_progress'];
const actor = (ctx: { actor: { staffId?: string | undefined } }) => ctx.actor.staffId!;

async function openEncounter(ctx: Parameters<typeof ensureEncounterAccess>[0], encounterId: string, now: Date, allowClosed = false) {
  const enc = await lockEncounter(ctx.tx, encounterId);
  if (!allowClosed && !OPEN.includes(enc.status)) throw preconditionFailed(`a ${enc.status} encounter can't take new records`, { reason: 'encounter_closed' });
  await ensureEncounterAccess(ctx, enc, now);
  return enc;
}

// ---- triage --------------------------------------------------------------------------------------------

export interface TriageInput {
  encounterId: string;
  triageScale: 'india_colour' | 'esi' | 'mts';
  category: string;
  arrivalMode?: 'walk_in' | 'ambulance_108' | 'private_ambulance' | 'police' | 'referred' | undefined;
  chiefComplaint?: string | undefined;
  reassessInMinutes?: number | undefined;
}

export async function recordTriage(db: Kysely<DB>, caller: Caller, input: TriageInput) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.record_triage' }, async (ctx) => {
    const enc = await openEncounter(ctx, input.encounterId, now);
    try {
      const { id } = await ctx.tx
        .insertInto('clinical.triage_assessment')
        .values({
          tenant_id: ctx.tenantId,
          encounter_id: enc.id,
          patient_id: enc.patient_id,
          triage_scale: input.triageScale,
          category: input.category,
          arrival_mode: input.arrivalMode ?? null,
          chief_complaint: input.chiefComplaint ?? null,
          assessed_by: actor(ctx),
          assessed_at: now,
          reassess_due_at: input.reassessInMinutes ? new Date(now.getTime() + input.reassessInMinutes * 60_000) : null,
          created_by: actor(ctx),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'clinical.triage_assessment', subjectId: id, patientId: enc.patient_id, diff: { scale: input.triageScale, category: input.category } });
      ctx.emit({ eventType: 'triage.recorded', aggregateType: 'clinical.encounter', aggregateId: enc.id, payload: { encounterId: enc.id, category: input.category } });
      return { triageId: id };
    } catch (err) {
      if (pgCode(err) === '23514') throw invalid('that category does not belong to the chosen triage scale');
      throw err;
    }
  });
}

// ---- medico-legal case ---------------------------------------------------------------------------------

export interface MlcInput {
  mlcType: 'road_traffic' | 'assault' | 'burns' | 'poisoning' | 'fall' | 'sexual_assault' | 'animal_bite' | 'industrial' | 'suspected_suicide' | 'brought_dead' | 'other';
  incidentAt?: string | null | undefined;
  incidentPlace?: string | null | undefined;
  broughtByName?: string | null | undefined;
  broughtByRelation?: string | null | undefined;
  broughtByPhone?: string | null | undefined;
  policeStation?: string | null | undefined;
  policeIntimatedAt?: string | null | undefined;
  intimationMode?: 'phone' | 'in_person' | 'written' | 'email' | null | undefined;
  intimationRef?: string | null | undefined;
  officerName?: string | null | undefined;
  officerBadgeNo?: string | null | undefined;
  injuryDetails?: unknown[] | undefined;
  evidenceHandover?: unknown[] | undefined;
  isPocso?: boolean | undefined;
}

const mlcColumns = (i: MlcInput) =>
  Object.fromEntries(
    Object.entries({
      mlc_type: i.mlcType,
      incident_at: i.incidentAt,
      incident_place: i.incidentPlace,
      brought_by_name: i.broughtByName,
      brought_by_relation: i.broughtByRelation,
      brought_by_phone: i.broughtByPhone,
      police_station: i.policeStation,
      police_intimated_at: i.policeIntimatedAt,
      intimation_mode: i.intimationMode,
      intimation_ref: i.intimationRef,
      officer_name: i.officerName,
      officer_badge_no: i.officerBadgeNo,
      injury_details: i.injuryDetails === undefined ? undefined : JSON.stringify(i.injuryDetails),
      evidence_handover: i.evidenceHandover === undefined ? undefined : JSON.stringify(i.evidenceHandover),
      is_pocso: i.isPocso,
    }).filter(([, v]) => v !== undefined),
  );

/** Opens the medico-legal record for an encounter (MLC number per clinic); police details can follow. */
export async function openMlc(db: Kysely<DB>, caller: Caller, input: MlcInput & { encounterId: string }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.open_mlc' }, async (ctx) => {
    const enc = await openEncounter(ctx, input.encounterId, now, true);
    const existing = await ctx.tx.selectFrom('clinical.mlc_record').select('id').where('encounter_id', '=', enc.id).executeTakeFirst();
    if (existing) throw conflict('this encounter already has a medico-legal record', { reason: 'already_open', mlcId: existing.id });
    const year = now.toISOString().slice(0, 4);
    const { rows: [n] } = await sql<{ n: number }>`SELECT platform.next_number('mlc', ${enc.facility_id}::uuid, ${year}) AS n`.execute(ctx.tx);
    const mlcNo = `MLC/${year}/${String(n!.n).padStart(5, '0')}`;
    try {
      const { id } = await ctx.tx
        .insertInto('clinical.mlc_record')
        .values({ tenant_id: ctx.tenantId, encounter_id: enc.id, patient_id: enc.patient_id, facility_id: enc.facility_id, mlc_no: mlcNo, ...(mlcColumns(input) as { mlc_type: string }), recorded_by: actor(ctx), created_by: actor(ctx) })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'clinical.mlc_record', subjectId: id, patientId: enc.patient_id, diff: { mlcNo, mlcType: input.mlcType } });
      ctx.emit({ eventType: 'mlc.opened', aggregateType: 'clinical.mlc_record', aggregateId: id, payload: { encounterId: enc.id, patientId: enc.patient_id, mlcNo } });
      return { mlcId: id, mlcNo };
    } catch (err) {
      if (pgCode(err) === '23514') throw invalid('check the phone number and the lists of injuries and evidence');
      throw err;
    }
  });
}

export async function updateMlc(db: Kysely<DB>, caller: Caller, input: Partial<MlcInput> & { mlcId: string; version: number }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.update_mlc' }, async (ctx) => {
    const m = await ctx.tx.selectFrom('clinical.mlc_record').selectAll().where('id', '=', input.mlcId).forUpdate().executeTakeFirst();
    if (!m) throw notFound('medico-legal record', { mlcId: input.mlcId });
    if (m.version !== input.version) throw conflict('this record was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: m.version });
    await assertChartAccess(ctx.tx, ctx.actor.staffId, m.patient_id, now);
    const set = mlcColumns(input as MlcInput);
    if (!Object.keys(set).length) return { mlcId: m.id, version: m.version };
    const { version } = await ctx.tx.updateTable('clinical.mlc_record').set({ ...set, updated_by: actor(ctx) }).where('id', '=', m.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'update', subjectType: 'clinical.mlc_record', subjectId: m.id, patientId: m.patient_id, diff: { fields: Object.keys(set) } });
    return { mlcId: m.id, version };
  });
}

// ---- immunization -------------------------------------------------------------------------------------

export interface ImmunizationInput {
  encounterId: string;
  vaccine: string;
  lotNumber?: string | null | undefined;
  doseNumber?: number | null | undefined;
  administeredAt?: string | undefined;
  route?: 'intramuscular' | 'subcutaneous' | 'intradermal' | 'oral' | 'intranasal' | null | undefined;
  site?: string | null | undefined;
  status?: 'completed' | 'not_done' | undefined;
  notDoneReason?: string | null | undefined;
}

export async function recordImmunization(db: Kysely<DB>, caller: Caller, input: ImmunizationInput) {
  const now = clock(caller);
  const at = input.administeredAt ? new Date(input.administeredAt) : now;
  if (at.getTime() > now.getTime() + 5 * 60_000) throw invalid("a vaccination can't be in the future");
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.record_immunization' }, async (ctx) => {
    const enc = await openEncounter(ctx, input.encounterId, now);
    try {
      const { id } = await ctx.tx
        .insertInto('clinical.immunization')
        .values({
          tenant_id: ctx.tenantId,
          patient_id: enc.patient_id,
          encounter_id: enc.id,
          vaccine: input.vaccine,
          lot_number: input.lotNumber ?? null,
          dose_number: input.doseNumber ?? null,
          administered_at: at,
          route: input.route ?? null,
          site: input.site ?? null,
          administered_by: actor(ctx),
          status: input.status ?? 'completed',
          not_done_reason: input.notDoneReason ?? null,
          created_by: actor(ctx),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'clinical.immunization', subjectId: id, patientId: enc.patient_id, diff: { vaccine: input.vaccine, status: input.status ?? 'completed' } });
      ctx.emit({ eventType: 'immunization.recorded', aggregateType: 'clinical.immunization', aggregateId: id, payload: { patientId: enc.patient_id, encounterId: enc.id } });
      return { immunizationId: id };
    } catch (err) {
      if (pgCode(err) === '23514') throw invalid('a vaccination not given needs a reason (and only then)');
      throw err;
    }
  });
}

export async function markImmunizationInError(db: Kysely<DB>, caller: Caller, input: { immunizationId: string; reason: string }) {
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.immunization_error' }, async (ctx) => {
    const i = await ctx.tx.selectFrom('clinical.immunization').selectAll().where('id', '=', input.immunizationId).forUpdate().executeTakeFirst();
    if (!i) throw notFound('immunization', { immunizationId: input.immunizationId });
    if (i.administered_by !== ctx.actor.staffId) throw new DomainError('forbidden', 'only the person who recorded it can mark it entered in error');
    if (i.status === 'entered_in_error') return { immunizationId: i.id, status: i.status };
    await ctx.tx.updateTable('clinical.immunization').set({ status: 'entered_in_error', updated_by: actor(ctx) }).where('id', '=', i.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'clinical.immunization', subjectId: i.id, patientId: i.patient_id, reason: input.reason, diff: { status: [i.status, 'entered_in_error'] } });
    return { immunizationId: i.id, status: 'entered_in_error' };
  });
}

// ---- care plans ---------------------------------------------------------------------------------------

export type ActivityKind = 'medication' | 'observation' | 'procedure' | 'education' | 'diet' | 'follow_up' | 'other';

export async function createCarePlan(
  db: Kysely<DB>,
  caller: Caller,
  input: { encounterId: string; title: string; periodEnd?: string | null | undefined; activities: { kind: ActivityKind; description: string; frequency?: string | null | undefined }[] },
) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.create_care_plan' }, async (ctx) => {
    const enc = await openEncounter(ctx, input.encounterId, now);
    const { id } = await ctx.tx
      .insertInto('clinical.care_plan')
      .values({ tenant_id: ctx.tenantId, patient_id: enc.patient_id, encounter_id: enc.id, title: input.title, period_end: input.periodEnd ?? null, authored_by: actor(ctx), created_by: actor(ctx) })
      .returning('id')
      .executeTakeFirstOrThrow();
    if (input.activities.length) {
      await ctx.tx
        .insertInto('clinical.care_plan_activity')
        .values(input.activities.map((a) => ({ tenant_id: ctx.tenantId, care_plan_id: id, kind: a.kind, description: a.description, frequency: a.frequency ?? null, created_by: actor(ctx) })))
        .execute();
    }
    ctx.audit({ action: 'create', subjectType: 'clinical.care_plan', subjectId: id, patientId: enc.patient_id, diff: { title: input.title, activities: input.activities.length } });
    ctx.emit({ eventType: 'care_plan.created', aggregateType: 'clinical.care_plan', aggregateId: id, payload: { patientId: enc.patient_id, encounterId: enc.id } });
    return { carePlanId: id };
  });
}

export async function setCarePlanStatus(db: Kysely<DB>, caller: Caller, input: { carePlanId: string; status: 'completed' | 'revoked'; reason: string }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.care_plan_status' }, async (ctx) => {
    const c = await ctx.tx.selectFrom('clinical.care_plan').selectAll().where('id', '=', input.carePlanId).forUpdate().executeTakeFirst();
    if (!c) throw notFound('care plan', { carePlanId: input.carePlanId });
    await assertChartAccess(ctx.tx, ctx.actor.staffId, c.patient_id, now);
    if (c.status !== 'active' && c.status !== 'draft') throw preconditionFailed(`a ${c.status} care plan can't change`);
    await ctx.tx.updateTable('clinical.care_plan').set({ status: input.status, period_end: c.period_end ?? sql<string>`greatest(period_start, current_date)`, updated_by: actor(ctx) }).where('id', '=', c.id).execute();
    await ctx.tx.updateTable('clinical.care_plan_activity').set({ status: input.status === 'completed' ? 'completed' : 'cancelled', updated_by: actor(ctx) }).where('care_plan_id', '=', c.id).where('status', 'in', ['planned', 'in_progress']).execute();
    ctx.audit({ action: 'status_change', subjectType: 'clinical.care_plan', subjectId: c.id, patientId: c.patient_id, reason: input.reason, diff: { status: [c.status, input.status] } });
    return { carePlanId: c.id, status: input.status };
  });
}

export async function setActivityStatus(db: Kysely<DB>, caller: Caller, input: { activityId: string; status: 'in_progress' | 'completed' | 'cancelled' }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.care_activity_status' }, async (ctx) => {
    const a = await ctx.tx
      .selectFrom('clinical.care_plan_activity as a')
      .innerJoin('clinical.care_plan as c', 'c.id', 'a.care_plan_id')
      .select(['a.id', 'a.status', 'c.patient_id', 'c.status as planStatus'])
      .where('a.id', '=', input.activityId)
      .executeTakeFirst();
    if (!a) throw notFound('care plan activity', { activityId: input.activityId });
    await assertChartAccess(ctx.tx, ctx.actor.staffId, a.patient_id, now);
    if (a.planStatus !== 'active') throw preconditionFailed('the care plan is not active');
    if (a.status === 'completed' || a.status === 'cancelled') throw preconditionFailed(`a ${a.status} activity can't change`);
    await ctx.tx.updateTable('clinical.care_plan_activity').set({ status: input.status, updated_by: actor(ctx) }).where('id', '=', a.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'clinical.care_plan_activity', subjectId: a.id, patientId: a.patient_id, diff: { status: [a.status, input.status] } });
    return { activityId: a.id, status: input.status };
  });
}

// ---- referrals ----------------------------------------------------------------------------------------

export interface ReferralInput {
  encounterId: string;
  direction: 'internal' | 'outbound' | 'inbound';
  reason: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  toFacilityId?: string | null | undefined;
  toDepartmentId?: string | null | undefined;
  toStaffId?: string | null | undefined;
  externalOrg?: string | null | undefined;
  externalDoctor?: string | null | undefined;
}

export async function createReferral(db: Kysely<DB>, caller: Caller, input: ReferralInput) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.create_referral' }, async (ctx) => {
    const enc = await openEncounter(ctx, input.encounterId, now, true);
    try {
      const { id } = await ctx.tx
        .insertInto('clinical.referral')
        .values({
          tenant_id: ctx.tenantId,
          encounter_id: enc.id,
          patient_id: enc.patient_id,
          direction: input.direction,
          reason: input.reason,
          urgency: input.urgency,
          to_facility_id: input.toFacilityId ?? (input.direction === 'internal' ? enc.facility_id : null),
          to_department_id: input.toDepartmentId ?? null,
          to_staff_id: input.toStaffId ?? null,
          external_org: input.externalOrg ?? null,
          external_doctor: input.externalDoctor ?? null,
          referred_by: actor(ctx),
          created_by: actor(ctx),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'clinical.referral', subjectId: id, patientId: enc.patient_id, diff: { direction: input.direction, urgency: input.urgency } });
      ctx.emit({ eventType: 'referral.sent', aggregateType: 'clinical.referral', aggregateId: id, payload: { patientId: enc.patient_id, toStaffId: input.toStaffId ?? null, toDepartmentId: input.toDepartmentId ?? null, urgency: input.urgency } });
      return { referralId: id };
    } catch (err) {
      if (pgCode(err) === '23514') throw invalid('an internal referral names a department or doctor; an external one names the organisation');
      if (pgCode(err) === '23503') throw invalid('the department must belong to the clinic referred to');
      throw err;
    }
  });
}

/** The doctor or department referred to accepts or declines; the referrer can complete or cancel. */
export async function respondToReferral(db: Kysely<DB>, caller: Caller, input: { referralId: string; status: 'accepted' | 'rejected' | 'completed' | 'cancelled'; note?: string | undefined }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.respond_referral' }, async (ctx) => {
    const r = await ctx.tx.selectFrom('clinical.referral').selectAll().where('id', '=', input.referralId).forUpdate().executeTakeFirst();
    if (!r) throw notFound('referral', { referralId: input.referralId });
    const from = r.status;
    const allowed: Record<string, string[]> = { sent: ['accepted', 'rejected', 'cancelled'], accepted: ['completed', 'cancelled'] };
    if (!(allowed[from] ?? []).includes(input.status)) throw preconditionFailed(`a ${from} referral can't become ${input.status}`, { reason: 'invalid_transition' });
    if (input.status === 'cancelled' && r.referred_by !== ctx.actor.staffId) throw new DomainError('forbidden', 'only the referring clinician can cancel a referral');
    if (r.to_staff_id && ['accepted', 'rejected'].includes(input.status) && r.to_staff_id !== ctx.actor.staffId) {
      throw new DomainError('forbidden', 'only the doctor referred to can accept or decline', { reason: 'not_recipient' });
    }
    const response = ['accepted', 'rejected'].includes(input.status) ? { responded_by: actor(ctx), responded_at: now, response_note: input.note ?? null } : {};
    await ctx.tx.updateTable('clinical.referral').set({ status: input.status, ...response, updated_by: actor(ctx) }).where('id', '=', r.id).execute();
    // The doctor who accepts gets a care relationship to read the chart.
    if (input.status === 'accepted') {
      await sql`SELECT clinical.grant_referral_care(${ctx.tenantId}::uuid, ${actor(ctx)}::uuid, ${r.patient_id}::uuid)`.execute(ctx.tx);
    }
    ctx.audit({ action: 'status_change', subjectType: 'clinical.referral', subjectId: r.id, patientId: r.patient_id, reason: input.note, diff: { status: [from, input.status] } });
    ctx.emit({ eventType: `referral.${input.status}`, aggregateType: 'clinical.referral', aggregateId: r.id, payload: { patientId: r.patient_id, referredBy: r.referred_by } });
    return { referralId: r.id, status: input.status };
  });
}

// ---- births and deaths --------------------------------------------------------------------------------

export interface BirthInput {
  encounterId: string;
  bornAt: string;
  sex: 'male' | 'female' | 'other' | 'unknown';
  birthWeightG?: number | null | undefined;
  gestationWeeks?: number | null | undefined;
  deliveryMethod: 'normal_vaginal' | 'assisted_vaginal' | 'lscs' | 'other';
  birthOrder?: number | undefined;
  apgar1?: number | null | undefined;
  apgar5?: number | null | undefined;
  isLiveBirth: boolean;
  babyPatientId?: string | null | undefined;
}

export async function recordBirth(db: Kysely<DB>, caller: Caller, input: BirthInput) {
  const now = clock(caller);
  if (new Date(input.bornAt).getTime() > now.getTime() + 5 * 60_000) throw invalid("a birth can't be in the future");
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.record_birth' }, async (ctx) => {
    const enc = await openEncounter(ctx, input.encounterId, now, true);
    if (input.babyPatientId === enc.patient_id) throw invalid('the baby is registered as their own patient');
    try {
      const { id } = await ctx.tx
        .insertInto('clinical.birth_record')
        .values({
          tenant_id: ctx.tenantId,
          encounter_id: enc.id,
          mother_patient_id: enc.patient_id,
          baby_patient_id: input.babyPatientId ?? null,
          born_at: input.bornAt,
          sex: input.sex,
          birth_weight_g: input.birthWeightG ?? null,
          gestation_weeks: input.gestationWeeks ?? null,
          delivery_method: input.deliveryMethod,
          birth_order: input.birthOrder ?? 1,
          apgar_1: input.apgar1 ?? null,
          apgar_5: input.apgar5 ?? null,
          is_live_birth: input.isLiveBirth,
          attended_by: actor(ctx),
          created_by: actor(ctx),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'clinical.birth_record', subjectId: id, patientId: enc.patient_id, diff: { birthOrder: input.birthOrder ?? 1, live: input.isLiveBirth } });
      ctx.emit({ eventType: 'birth.recorded', aggregateType: 'clinical.birth_record', aggregateId: id, payload: { motherPatientId: enc.patient_id, babyPatientId: input.babyPatientId ?? null } });
      return { birthId: id };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('this birth order is already recorded on the encounter', { reason: 'duplicate_birth' });
      if (pgCode(err) === '23514') throw invalid('check the weight, gestation and APGAR values');
      throw err;
    }
  });
}

/** Civil registration reference (RBD Act) once the birth is reported to the registrar. */
export async function reportBirth(db: Kysely<DB>, caller: Caller, input: { birthId: string; civilRegistrationRef: string }) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.report_birth' }, async (ctx) => {
    const b = await ctx.tx.selectFrom('clinical.birth_record').selectAll().where('id', '=', input.birthId).forUpdate().executeTakeFirst();
    if (!b) throw notFound('birth record', { birthId: input.birthId });
    await ctx.tx.updateTable('clinical.birth_record').set({ civil_registration_ref: input.civilRegistrationRef, reported_at: now, updated_by: actor(ctx) }).where('id', '=', b.id).execute();
    ctx.audit({ action: 'update', subjectType: 'clinical.birth_record', subjectId: b.id, patientId: b.mother_patient_id, diff: { reported: true } });
    return { birthId: b.id, reportedAt: now };
  });
}

export interface DeathInput {
  encounterId: string;
  diedAt: string;
  causeChain: string[];
  contributingConditions?: string[] | undefined;
  manner: 'natural' | 'accident' | 'suicide' | 'homicide' | 'pending_investigation' | 'undetermined';
  isMlc?: boolean | undefined;
  postMortemRequired?: boolean | undefined;
}

export async function recordDeath(db: Kysely<DB>, caller: Caller, input: DeathInput) {
  const now = clock(caller);
  if (new Date(input.diedAt).getTime() > now.getTime() + 5 * 60_000) throw invalid("a death can't be in the future");
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.record_death' }, async (ctx) => {
    const enc = await openEncounter(ctx, input.encounterId, now, true);
    const already = await ctx.tx.selectFrom('clinical.death_record').select('id').where('patient_id', '=', enc.patient_id).executeTakeFirst();
    if (already) throw conflict("this patient's death is already recorded", { reason: 'already_recorded', deathId: already.id });
    const mlc = await ctx.tx.selectFrom('clinical.mlc_record').select('id').where('encounter_id', '=', enc.id).executeTakeFirst();
    const isMlc = input.isMlc ?? !!mlc;
    const { id } = await ctx.tx
      .insertInto('clinical.death_record')
      .values({
        tenant_id: ctx.tenantId,
        encounter_id: enc.id,
        patient_id: enc.patient_id,
        died_at: input.diedAt,
        pronounced_by: actor(ctx),
        cause_chain: JSON.stringify(input.causeChain),
        contributing_conditions: JSON.stringify(input.contributingConditions ?? []),
        manner: input.manner,
        is_mlc: isMlc,
        post_mortem_required: input.postMortemRequired ?? isMlc,
        created_by: actor(ctx),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'clinical.death_record', subjectId: id, patientId: enc.patient_id, diff: { manner: input.manner, isMlc } });
    ctx.emit({ eventType: 'death.recorded', aggregateType: 'clinical.death_record', aggregateId: id, payload: { patientId: enc.patient_id, encounterId: enc.id, isMlc } });
    return { deathId: id, isMlc };
  });
}

/** Issues the MCCD (Form 4 hospital / 4A non-institutional) and records body release. */
export async function certifyDeath(
  db: Kysely<DB>,
  caller: Caller,
  input: { deathId: string; mccdForm?: 'form_4' | 'form_4a' | undefined; bodyReleasedTo?: string | undefined },
) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'clinical', name: 'clinical.certify_death' }, async (ctx) => {
    const d = await ctx.tx.selectFrom('clinical.death_record').selectAll().where('id', '=', input.deathId).forUpdate().executeTakeFirst();
    if (!d) throw notFound('death record', { deathId: input.deathId });
    const set: Record<string, unknown> = {};
    if (input.mccdForm) {
      if (d.mccd_issued_at) throw conflict('the MCCD was already issued', { reason: 'already_issued' });
      if (d.is_mlc && d.manner === 'pending_investigation') throw preconditionFailed('a medico-legal death pending investigation is certified after the post-mortem', { reason: 'pending_investigation' });
      Object.assign(set, { mccd_form: input.mccdForm, mccd_issued_at: now, certified_by: actor(ctx) });
    }
    if (input.bodyReleasedTo) {
      if (d.body_released_at) throw conflict('the body was already released', { reason: 'already_released' });
      Object.assign(set, { body_released_to: input.bodyReleasedTo, body_released_at: now });
    }
    if (!Object.keys(set).length) throw invalid('give the MCCD form or who the body is released to');
    await ctx.tx.updateTable('clinical.death_record').set({ ...set, updated_by: actor(ctx) }).where('id', '=', d.id).execute();
    ctx.audit({ action: 'update', subjectType: 'clinical.death_record', subjectId: d.id, patientId: d.patient_id, diff: { fields: Object.keys(set) } });
    return { ...input, deathId: d.id };
  });
}

// ---- reads ---------------------------------------------------------------------------------------------

export async function recordsFacility(db: Kysely<DB>, caller: Caller, table: 'mlc_record' | 'care_plan' | 'referral' | 'birth_record' | 'death_record' | 'immunization', id: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows: [r] } = await sql<{ facility_id: string }>`
      SELECT e.facility_id FROM ${sql.table(`clinical.${table}`)} x
      JOIN clinical.encounter e ON e.id = x.encounter_id
      WHERE x.id = ${id}`.execute(tx);
    return r?.facility_id;
  });
}

export async function referralFacility(db: Kysely<DB>, caller: Caller, id: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const r = await tx.selectFrom('clinical.referral as r').innerJoin('clinical.encounter as e', 'e.id', 'r.encounter_id').select(['e.facility_id', 'r.to_facility_id']).where('r.id', '=', id).executeTakeFirst();
    return r ? [r.facility_id, r.to_facility_id ?? r.facility_id] : undefined;
  });
}

/** The clinical records of one encounter (chart access is checked by the caller). */
export async function encounterRecords(tx: Transaction<DB>, encounterId: string, opts: { mlc: boolean }) {
  const [triage, immunizations, carePlans, referrals, births, death, mlc] = await Promise.all([
    tx.selectFrom('clinical.triage_assessment as t').innerJoin('platform.staff as s', 's.id', 't.assessed_by').select(['t.id as triageId', 't.triage_scale as triageScale', 't.category', 't.arrival_mode as arrivalMode', 't.chief_complaint as chiefComplaint', 't.assessed_at as assessedAt', 't.reassess_due_at as reassessDueAt', 's.display_name as assessedBy']).where('t.encounter_id', '=', encounterId).orderBy('t.assessed_at', 'desc').execute(),
    tx.selectFrom('clinical.immunization').select(['id as immunizationId', 'vaccine', 'dose_number as doseNumber', 'lot_number as lotNumber', 'administered_at as administeredAt', 'route', 'site', 'status', 'not_done_reason as notDoneReason', 'administered_by as administeredBy']).where('encounter_id', '=', encounterId).execute(),
    carePlansWhere(tx, 'encounter_id', encounterId),
    tx.selectFrom('clinical.referral as r').leftJoin('platform.staff as s', 's.id', 'r.to_staff_id').leftJoin('platform.department as d', 'd.id', 'r.to_department_id').select(['r.id as referralId', 'r.direction', 'r.reason', 'r.urgency', 'r.status', 'r.to_staff_id as toStaffId', 's.display_name as toStaffName', 'd.name as toDepartmentName', 'r.external_org as externalOrg', 'r.external_doctor as externalDoctor', 'r.referred_by as referredBy', 'r.response_note as responseNote', 'r.created_at as createdAt']).where('r.encounter_id', '=', encounterId).execute(),
    tx.selectFrom('clinical.birth_record').selectAll().where('encounter_id', '=', encounterId).orderBy('birth_order').execute(),
    tx.selectFrom('clinical.death_record').selectAll().where('encounter_id', '=', encounterId).executeTakeFirst(),
    opts.mlc ? tx.selectFrom('clinical.mlc_record').selectAll().where('encounter_id', '=', encounterId).executeTakeFirst() : Promise.resolve(undefined),
  ]);
  const hasMlc = opts.mlc ? !!mlc : !!(await tx.selectFrom('clinical.mlc_record').select('id').where('encounter_id', '=', encounterId).executeTakeFirst());
  return { triage, immunizations, carePlans, referrals, births, death: death ?? null, mlc: mlc ?? null, hasMlc };
}

export async function carePlansWhere(tx: Transaction<DB>, column: 'encounter_id' | 'patient_id', value: string) {
  const plans = await tx.selectFrom('clinical.care_plan').select(['id as carePlanId', 'title', 'status', 'period_start as periodStart', 'period_end as periodEnd', 'encounter_id as encounterId']).where(column, '=', value).orderBy('created_at', 'desc').execute();
  if (!plans.length) return [];
  const acts = await tx.selectFrom('clinical.care_plan_activity').select(['id as activityId', 'care_plan_id as carePlanId', 'kind', 'description', 'frequency', 'status']).where('care_plan_id', 'in', plans.map((p) => p.carePlanId)).execute();
  return plans.map((p) => ({ ...p, activities: acts.filter((a) => a.carePlanId === p.carePlanId) }));
}

/** Referrals waiting on a doctor or department at a clinic (the recipient's worklist). */
export async function referralInbox(db: Kysely<DB>, caller: Caller, f: { facilityId: string; staffId?: string | undefined; status?: string | undefined }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let q = tx
      .selectFrom('clinical.referral as r')
      .innerJoin('patient.patient as p', 'p.id', 'r.patient_id')
      .innerJoin('platform.staff as s', 's.id', 'r.referred_by')
      .leftJoin('platform.department as d', 'd.id', 'r.to_department_id')
      .select([
        'r.id as referralId', 'r.patient_id as patientId', 'p.mrn', sql<string>`p.given_name || coalesce(' ' || p.family_name, '')`.as('patientName'),
        'r.reason', 'r.urgency', 'r.status', 's.display_name as referredByName', 'd.name as toDepartmentName', 'r.to_staff_id as toStaffId', 'r.created_at as createdAt',
      ])
      .where('r.direction', '=', 'internal')
      .where('r.to_facility_id', '=', f.facilityId);
    if (f.staffId) q = q.where('r.to_staff_id', '=', f.staffId);
    q = q.where('r.status', '=', f.status ?? 'sent');
    return q.orderBy(sql`CASE r.urgency WHEN 'emergency' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END`).orderBy('r.created_at').limit(200).execute();
  });
}
