// Inpatient stays: admit (into a ready bed, or bed-pending), assign a bed later, transfer, cancel, plan
// the discharge with its clearances, and depart. Every bed move locks the beds' status rows, so a bed is
// never given to two patients; the exclusion constraints on bed_occupancy are the backstop. The worker
// opens the stay's encounter (admission.admitted) and bills its days (billing).
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, moduleIsActive, notFound, pgCode, preconditionFailed, runCommand, type CommandContext } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';

type AdmissionStatus = 'bed_pending' | 'admitted' | 'discharge_planned' | 'discharged' | 'cancelled';
type BedState = 'ready' | 'occupied' | 'dirty' | 'blocked' | 'maintenance';
export type ClearanceKind = 'clinical' | 'pharmacy' | 'nursing' | 'finance';
const OPEN: AdmissionStatus[] = ['bed_pending', 'admitted', 'discharge_planned'];

/** Indian financial year of an instant in a timezone, e.g. '2026-27'. */
function fyOf(at: Date, timezone: string) {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(at).split('-').map(Number) as [number, number];
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

async function history(ctx: CommandContext, admissionId: string, from: AdmissionStatus | null, to: AdmissionStatus, at: Date, reason?: string) {
  await ctx.tx.insertInto('inpatient.admission_status_history').values({
    tenant_id: ctx.tenantId, admission_id: admissionId, from_status: from, to_status: to, actor_staff_id: ctx.actor.staffId ?? null, reason: reason ?? null, occurred_at: at,
  }).execute();
}

export async function lockAdmission(tx: Transaction<DB>, admissionId: string, version?: number) {
  const a = await tx.selectFrom('inpatient.admission').selectAll().where('id', '=', admissionId).forUpdate().executeTakeFirst();
  if (!a) throw notFound('admission', { admissionId });
  if (version !== undefined && a.version !== version) throw conflict('this admission was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: a.version });
  return a;
}

/**
 * Locks a bed's status row (creating it as 'ready' the first time) and checks it is an active bed of
 * the facility. Returns the bed's status and billing category.
 */
export async function lockBed(tx: Transaction<DB>, tenantId: string, facilityId: string, bedId: string) {
  const bed = await tx.selectFrom('platform.location').select(['id', 'facility_id', 'kind', 'status', 'bed_category_id', 'name']).where('id', '=', bedId).executeTakeFirst();
  if (!bed || bed.kind !== 'bed') throw notFound('bed', { bedId });
  if (bed.facility_id !== facilityId) throw invalid('the bed is at another clinic', { reason: 'bed_facility_mismatch' });
  if (bed.status !== 'active') throw preconditionFailed('this bed is switched off', { reason: 'bed_inactive' });
  await tx.insertInto('inpatient.bed_status').values({ tenant_id: tenantId, facility_id: facilityId, bed_location_id: bedId })
    .onConflict((oc) => oc.columns(['tenant_id', 'bed_location_id']).doNothing()).execute();
  const status = await tx.selectFrom('inpatient.bed_status').selectAll().where('bed_location_id', '=', bedId).forUpdate().executeTakeFirstOrThrow();
  return { bed, status };
}

async function setBed(ctx: CommandContext, bedId: string, from: string, to: BedState, at: Date, reason?: string | null) {
  await ctx.tx.updateTable('inpatient.bed_status').set({ status: to, since: at, reason: reason ?? null, set_by: ctx.actor.staffId ?? null, updated_by: ctx.actor.staffId ?? null })
    .where('bed_location_id', '=', bedId).execute();
  await ctx.tx.insertInto('inpatient.bed_status_history').values({
    tenant_id: ctx.tenantId, bed_location_id: bedId, from_status: from, to_status: to, actor_staff_id: ctx.actor.staffId ?? null, reason: reason ?? null, occurred_at: at,
  }).execute();
}

/** Puts the admission into a ready bed from `at`; the bed becomes occupied. */
async function occupy(ctx: CommandContext, admission: { id: string; facility_id: string }, bedId: string, at: Date, reason: 'admit' | 'transfer' | 'retain', kind: 'primary' | 'retained' = 'primary') {
  const { bed, status } = await lockBed(ctx.tx, ctx.tenantId, admission.facility_id, bedId);
  if (status.status !== 'ready' && !(kind === 'retained' && status.status === 'occupied')) {
    throw preconditionFailed(`bed ${bed.name} is ${status.status}`, { reason: 'bed_not_ready', bedId, status: status.status });
  }
  try {
    const occ = await ctx.tx.insertInto('inpatient.bed_occupancy').values({
      tenant_id: ctx.tenantId, facility_id: admission.facility_id, admission_id: admission.id, bed_location_id: bedId,
      billed_bed_category_id: bed.bed_category_id!, period: sql`tstzrange(${at}::timestamptz, NULL)`, kind, reason, created_by: ctx.actor.staffId ?? null,
    }).returning('id').executeTakeFirstOrThrow();
    if (status.status !== 'occupied') await setBed(ctx, bedId, status.status, 'occupied', at);
    ctx.emit({ eventType: 'bed.occupied', aggregateType: 'inpatient.bed_occupancy', aggregateId: occ.id, payload: { occupancyId: occ.id, admissionId: admission.id, bedId, kind } });
    return occ.id;
  } catch (err) {
    if (pgCode(err) === '23P01') throw conflict('the bed or the patient is already placed for that time', { reason: 'occupancy_overlap', bedId });
    throw err;
  }
}

/** Ends the admission's open occupancies at `at` (except `keep`) and sends their beds to cleaning. */
async function vacate(ctx: CommandContext, admissionId: string, at: Date, opts: { kind?: 'primary' | 'retained'; keepBedOccupied?: string } = {}) {
  let q = ctx.tx.selectFrom('inpatient.bed_occupancy').select(['id', 'bed_location_id', 'kind', 'facility_id']).where('admission_id', '=', admissionId).where(sql<boolean>`upper_inf(period)`);
  if (opts.kind) q = q.where('kind', '=', opts.kind);
  const open = await q.forUpdate().execute();
  for (const o of open) {
    await ctx.tx.updateTable('inpatient.bed_occupancy').set({ period: sql`tstzrange(lower(period), ${at}::timestamptz)`, updated_by: ctx.actor.staffId ?? null }).where('id', '=', o.id).execute();
    if (o.bed_location_id !== opts.keepBedOccupied) {
      const { status } = await lockBed(ctx.tx, ctx.tenantId, o.facility_id, o.bed_location_id);
      if (status.status === 'occupied') await setBed(ctx, o.bed_location_id, 'occupied', 'dirty', at);
    }
    ctx.emit({ eventType: 'bed.vacated', aggregateType: 'inpatient.bed_occupancy', aggregateId: o.id, payload: { occupancyId: o.id, admissionId, bedId: o.bed_location_id, at: at.toISOString() } });
  }
  return open;
}

export interface AdmitInput {
  facilityId: string;
  patientId: string;
  admittingStaffId: string;
  admissionType: 'elective' | 'emergency' | 'day_care' | 'maternity' | 'transfer_in';
  admissionReason: string;
  departmentId?: string | undefined;
  sourceEncounterId?: string | undefined;
  /** A ready bed; without one the admission waits for a bed. */
  bedId?: string | undefined;
  requestedBedCategoryId?: string | undefined;
  expectedDischargeOn?: string | undefined;
}

export async function admit(db: Kysely<DB>, caller: Caller, input: AdmitInput, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inpatient', name: 'inpatient.admit', idempotencyKey, request: input }, async (ctx) => {
    const facility = await ctx.tx.selectFrom('platform.facility').select(['timezone', 'status']).where('id', '=', input.facilityId).executeTakeFirst();
    if (!facility) throw notFound('facility', { facilityId: input.facilityId });
    const patient = await ctx.tx.selectFrom('patient.patient').select(['status']).where('id', '=', input.patientId).executeTakeFirst();
    if (!patient) throw notFound('patient', { patientId: input.patientId });
    if (patient.status !== 'active') throw preconditionFailed(`patient record is ${patient.status}`, { reason: 'patient_inactive' });
    const doctor = await ctx.tx.selectFrom('platform.staff').select(['staff_type', 'status']).where('id', '=', input.admittingStaffId).executeTakeFirst();
    if (!doctor || doctor.status !== 'active' || doctor.staff_type !== 'doctor') throw invalid('the admitting clinician must be an active doctor', { reason: 'not_a_doctor' });
    if (input.sourceEncounterId) {
      const src = await ctx.tx.selectFrom('clinical.encounter').select(['patient_id']).where('id', '=', input.sourceEncounterId).executeTakeFirst();
      if (!src || src.patient_id !== input.patientId) throw invalid('the referring visit is not this patient’s', { reason: 'encounter_mismatch' });
    }
    const fy = fyOf(now, facility.timezone);
    const { rows: [n] } = await sql<{ n: number }>`SELECT platform.next_number('ip_no', ${input.facilityId}::uuid, ${fy}) AS n`.execute(ctx.tx);
    const ipNo = `IP/${fy}/${String(n!.n).padStart(6, '0')}`;
    const status: AdmissionStatus = input.bedId ? 'admitted' : 'bed_pending';
    let admission: { id: string; version: number };
    try {
      admission = await ctx.tx.insertInto('inpatient.admission').values({
        tenant_id: ctx.tenantId, facility_id: input.facilityId, ip_no: ipNo, patient_id: input.patientId, admission_type: input.admissionType,
        admitting_staff_id: input.admittingStaffId, department_id: input.departmentId ?? null, source_encounter_id: input.sourceEncounterId ?? null,
        requested_bed_category_id: input.requestedBedCategoryId ?? null, admission_reason: input.admissionReason, admitted_at: now,
        expected_discharge_on: input.expectedDischargeOn ?? null, status, created_by: ctx.actor.staffId ?? null,
      }).returning(['id', 'version']).executeTakeFirstOrThrow();
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('this patient is already admitted at this clinic', { reason: 'already_admitted' });
      if (pgCode(err) === '23503') throw invalid('the department or bed category is not this clinic’s', { reason: 'reference_mismatch' });
      throw err;
    }
    await history(ctx, admission.id, null, status, now);
    const occupancyId = input.bedId ? await occupy(ctx, { id: admission.id, facility_id: input.facilityId }, input.bedId, now, 'admit') : null;
    ctx.audit({ action: 'create', subjectType: 'inpatient.admission', subjectId: admission.id, patientId: input.patientId, diff: { ipNo, status, bedId: input.bedId ?? null } });
    ctx.emit({
      eventType: 'admission.admitted', aggregateType: 'inpatient.admission', aggregateId: admission.id, aggregateVersion: admission.version,
      payload: { admissionId: admission.id, patientId: input.patientId, facilityId: input.facilityId, admittingStaffId: input.admittingStaffId, ipNo },
    });
    return { admissionId: admission.id, ipNo, status, occupancyId, version: admission.version };
  });
}

/** Puts a bed-pending admission into a ready bed. */
export async function assignBed(db: Kysely<DB>, caller: Caller, input: { admissionId: string; bedId: string; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inpatient', name: 'inpatient.assign_bed', idempotencyKey, request: input }, async (ctx) => {
    const a = await lockAdmission(ctx.tx, input.admissionId, input.version);
    if (a.status !== 'bed_pending') throw preconditionFailed(`admission is ${a.status}; use a transfer to change beds`, { reason: 'not_bed_pending', status: a.status });
    const occupancyId = await occupy(ctx, a, input.bedId, now, 'admit');
    const { version } = await ctx.tx.updateTable('inpatient.admission').set({ status: 'admitted', updated_by: ctx.actor.staffId ?? null }).where('id', '=', a.id).returning('version').executeTakeFirstOrThrow();
    await history(ctx, a.id, 'bed_pending', 'admitted', now);
    ctx.audit({ action: 'status_change', subjectType: 'inpatient.admission', subjectId: a.id, patientId: a.patient_id, diff: { status: ['bed_pending', 'admitted'], bedId: input.bedId } });
    return { admissionId: a.id, status: 'admitted' as const, occupancyId, version };
  });
}

/**
 * Moves the patient to another ready bed. retainCurrent keeps the current bed for them (billed as a
 * retained bed) — e.g. while they are in ICU.
 */
export async function transfer(db: Kysely<DB>, caller: Caller, input: { admissionId: string; toBedId: string; reason: string; retainCurrent?: boolean | undefined; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inpatient', name: 'inpatient.transfer', idempotencyKey, request: input }, async (ctx) => {
    const a = await lockAdmission(ctx.tx, input.admissionId, input.version);
    if (a.status !== 'admitted' && a.status !== 'discharge_planned') throw preconditionFailed(`admission is ${a.status}`, { reason: 'not_in_bed', status: a.status });
    const current = await ctx.tx.selectFrom('inpatient.bed_occupancy').select(['id', 'bed_location_id']).where('admission_id', '=', a.id).where('kind', '=', 'primary')
      .where(sql<boolean>`upper_inf(period)`).forUpdate().executeTakeFirst();
    if (!current) throw preconditionFailed('the patient has no current bed', { reason: 'no_current_bed' });
    if (current.bed_location_id === input.toBedId) throw invalid('the patient is already in that bed', { reason: 'same_bed' });
    // A previously retained bed the patient now returns to is released first.
    const retained = await ctx.tx.selectFrom('inpatient.bed_occupancy').select(['id', 'bed_location_id']).where('admission_id', '=', a.id).where('kind', '=', 'retained')
      .where(sql<boolean>`upper_inf(period)`).where('bed_location_id', '=', input.toBedId).executeTakeFirst();
    if (retained) {
      await ctx.tx.updateTable('inpatient.bed_occupancy').set({ period: sql`tstzrange(lower(period), ${now}::timestamptz)` }).where('id', '=', retained.id).execute();
      await setBed(ctx, input.toBedId, 'occupied', 'ready', now, 'returning from transfer');
    }
    await vacate(ctx, a.id, now, { kind: 'primary', ...(input.retainCurrent ? { keepBedOccupied: current.bed_location_id } : {}) });
    const toOccupancy = await occupy(ctx, a, input.toBedId, now, 'transfer');
    const retainedOccupancy = input.retainCurrent ? await occupy(ctx, a, current.bed_location_id, now, 'retain', 'retained') : null;
    await ctx.tx.insertInto('inpatient.transfer').values({
      tenant_id: ctx.tenantId, admission_id: a.id, from_occupancy_id: current.id, to_occupancy_id: toOccupancy, retained_occupancy_id: retainedOccupancy,
      reason: input.reason, moved_at: now, moved_by: ctx.actor.staffId ?? null, created_by: ctx.actor.staffId ?? null,
    }).execute();
    const { version } = await ctx.tx.updateTable('inpatient.admission').set({ updated_by: ctx.actor.staffId ?? null }).where('id', '=', a.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'update', subjectType: 'inpatient.admission', subjectId: a.id, patientId: a.patient_id, reason: input.reason, diff: { fromBedId: current.bed_location_id, toBedId: input.toBedId, retained: !!input.retainCurrent } });
    return { admissionId: a.id, occupancyId: toOccupancy, retainedOccupancyId: retainedOccupancy, version };
  });
}

/** Cancels an admission made in error (beds go to cleaning, the encounter is cancelled). */
export async function cancelAdmission(db: Kysely<DB>, caller: Caller, input: { admissionId: string; reason: string; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inpatient', name: 'inpatient.cancel_admission', idempotencyKey, request: input }, async (ctx) => {
    const a = await lockAdmission(ctx.tx, input.admissionId, input.version);
    if (a.status !== 'admitted' && a.status !== 'bed_pending') throw preconditionFailed(`admission is ${a.status}`, { reason: 'not_cancellable', status: a.status });
    const { rows: [billed] } = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM billing.charge c JOIN billing.billing_account ba ON ba.id = c.billing_account_id
      WHERE ba.admission_id = ${a.id} AND c.status <> 'reversed'`.execute(ctx.tx);
    if (billed!.n > 0) throw preconditionFailed('charges are already posted for this stay; discharge it instead', { reason: 'has_charges', charges: billed!.n });
    await vacate(ctx, a.id, now);
    const { version } = await ctx.tx.updateTable('inpatient.admission').set({ status: 'cancelled', cancelled_at: now, cancel_reason: input.reason, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', a.id).returning('version').executeTakeFirstOrThrow();
    await history(ctx, a.id, a.status as AdmissionStatus, 'cancelled', now, input.reason);
    ctx.audit({ action: 'status_change', subjectType: 'inpatient.admission', subjectId: a.id, patientId: a.patient_id, reason: input.reason, diff: { status: [a.status, 'cancelled'] } });
    ctx.emit({ eventType: 'admission.cancelled', aggregateType: 'inpatient.admission', aggregateId: a.id, aggregateVersion: version, payload: { admissionId: a.id, reason: input.reason } });
    return { admissionId: a.id, status: 'cancelled' as const, version };
  });
}

// ---- discharge -------------------------------------------------------------------------------------------

export interface PlanDischargeInput {
  admissionId: string;
  dischargeType: 'routine' | 'lama' | 'dama' | 'absconded' | 'transfer_out' | 'referred' | 'death';
  expectedDepartureAt?: string | undefined;
  summaryNoteId?: string | undefined;
  notes?: string | undefined;
  version: number;
}

/** Records the discharge decision and opens its clearances (pharmacy is waived when pharmacy is off). */
export async function planDischarge(db: Kysely<DB>, caller: Caller, input: PlanDischargeInput, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inpatient', name: 'inpatient.plan_discharge', idempotencyKey, request: input }, async (ctx) => {
    const a = await lockAdmission(ctx.tx, input.admissionId, input.version);
    if (a.status !== 'admitted') throw preconditionFailed(`admission is ${a.status}`, { reason: 'not_admitted', status: a.status });
    if (input.summaryNoteId) {
      const note = await ctx.tx.selectFrom('clinical.clinical_note as n').innerJoin('clinical.encounter as e', 'e.id', 'n.encounter_id')
        .select('e.admission_id').where('n.id', '=', input.summaryNoteId).executeTakeFirst();
      if (note?.admission_id !== a.id) throw invalid('the summary note is not from this stay', { reason: 'note_mismatch' });
    }
    const discharge = await ctx.tx.insertInto('inpatient.discharge').values({
      tenant_id: ctx.tenantId, admission_id: a.id, discharge_type: input.dischargeType, decided_at: now, decided_by: ctx.actor.staffId!,
      expected_departure_at: input.expectedDepartureAt ? new Date(input.expectedDepartureAt) : null, summary_note_id: input.summaryNoteId ?? null,
      notes: input.notes ?? null, created_by: ctx.actor.staffId ?? null,
    }).returning(['id', 'version']).executeTakeFirstOrThrow();
    const pharmacyOn = await moduleIsActive(ctx.tx, 'pharmacy');
    // Leaving against advice, absconding or death don't wait on clearances the patient can't give.
    const unattended = ['lama', 'dama', 'absconded', 'death'].includes(input.dischargeType);
    const kinds: ClearanceKind[] = ['clinical', 'nursing', 'pharmacy', 'finance'];
    await ctx.tx.insertInto('inpatient.discharge_clearance').values(kinds.map((kind) => {
      const waive = kind === 'pharmacy' && !pharmacyOn ? 'pharmacy module not in use' : unattended && kind === 'nursing' ? `discharge type ${input.dischargeType}` : null;
      return {
        tenant_id: ctx.tenantId, discharge_id: discharge.id, kind, status: waive ? 'waived' as const : 'pending' as const,
        cleared_at: waive ? now : null, cleared_by: waive ? ctx.actor.staffId ?? null : null, waiver_reason: waive, created_by: ctx.actor.staffId ?? null,
      };
    })).execute();
    const { version } = await ctx.tx.updateTable('inpatient.admission').set({ status: 'discharge_planned', updated_by: ctx.actor.staffId ?? null }).where('id', '=', a.id).returning('version').executeTakeFirstOrThrow();
    await history(ctx, a.id, 'admitted', 'discharge_planned', now);
    ctx.audit({ action: 'create', subjectType: 'inpatient.discharge', subjectId: discharge.id, patientId: a.patient_id, diff: { dischargeType: input.dischargeType } });
    ctx.emit({ eventType: 'discharge.planned', aggregateType: 'inpatient.discharge', aggregateId: discharge.id, payload: { dischargeId: discharge.id, admissionId: a.id, dischargeType: input.dischargeType } });
    return { dischargeId: discharge.id, admissionId: a.id, status: 'planned' as const, admissionVersion: version };
  });
}

async function lockDischarge(tx: Transaction<DB>, dischargeId: string) {
  const d = await tx.selectFrom('inpatient.discharge').selectAll().where('id', '=', dischargeId).forUpdate().executeTakeFirst();
  if (!d) throw notFound('discharge', { dischargeId });
  return d;
}

/** Marks the discharge cleared once no clearance is pending. */
async function settleDischarge(ctx: CommandContext, dischargeId: string) {
  const pending = await ctx.tx.selectFrom('inpatient.discharge_clearance').select('id').where('discharge_id', '=', dischargeId).where('status', '=', 'pending').executeTakeFirst();
  if (pending) return 'planned' as const;
  await ctx.tx.updateTable('inpatient.discharge').set({ status: 'cleared', updated_by: ctx.actor.staffId ?? null }).where('id', '=', dischargeId).where('status', '=', 'planned').execute();
  return 'cleared' as const;
}

/** Clears (or, with a reason, waives) one clearance. Who may clear which kind is checked by the route. */
export async function decideClearance(
  db: Kysely<DB>, caller: Caller, input: { dischargeId: string; kind: ClearanceKind; waive?: string | undefined; note?: string | undefined }, idempotencyKey?: string,
) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inpatient', name: 'inpatient.decide_clearance', idempotencyKey, request: input }, async (ctx) => {
    const d = await lockDischarge(ctx.tx, input.dischargeId);
    if (d.status !== 'planned') throw preconditionFailed(`discharge is ${d.status}`, { reason: 'not_planned', status: d.status });
    const c = await ctx.tx.selectFrom('inpatient.discharge_clearance').selectAll().where('discharge_id', '=', d.id).where('kind', '=', input.kind).forUpdate().executeTakeFirstOrThrow();
    if (c.status !== 'pending') return { dischargeId: d.id, kind: input.kind, status: c.status, dischargeStatus: d.status };
    if (input.kind === 'finance' && !input.waive) throw preconditionFailed('finance clears when the final bill is settled', { reason: 'finance_by_billing' });
    if (!input.waive && input.kind === 'pharmacy') {
      const { rows: [open] } = await sql<{ n: number }>`
        SELECT count(*)::int AS n FROM pharmacy.patient_indent WHERE admission_id = ${d.admission_id} AND status IN ('submitted', 'partially_dispensed')`.execute(ctx.tx);
      if (open!.n) throw preconditionFailed('ward indents are still open; dispense or cancel them first', { reason: 'open_indents', indents: open!.n });
    }
    if (!input.waive && (input.kind === 'clinical' || input.kind === 'nursing')) {
      const staff = await ctx.tx.selectFrom('platform.staff').select('staff_type').where('id', '=', ctx.actor.staffId!).executeTakeFirstOrThrow();
      const needed = input.kind === 'clinical' ? 'doctor' : 'nurse';
      if (staff.staff_type !== needed) throw preconditionFailed(`the ${input.kind} clearance is given by a ${needed}`, { reason: 'wrong_clinician', needed });
    }
    const status = input.waive ? 'waived' as const : 'cleared' as const;
    await ctx.tx.updateTable('inpatient.discharge_clearance').set({ status, cleared_at: now, cleared_by: ctx.actor.staffId ?? null, waiver_reason: input.waive ?? null, note: input.note ?? null, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', c.id).execute();
    const dischargeStatus = await settleDischarge(ctx, d.id);
    const a = await ctx.tx.selectFrom('inpatient.admission').select('patient_id').where('id', '=', d.admission_id).executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'inpatient.discharge_clearance', subjectId: c.id, patientId: a.patient_id, reason: input.waive ?? input.note, diff: { kind: input.kind, status: ['pending', status] } });
    return { dischargeId: d.id, kind: input.kind, status, dischargeStatus };
  });
}

/** Consumer step: the stay's final bill is settled, so finance is cleared. */
export async function clearFinance(tx: Transaction<DB>, admissionId: string) {
  const d = await tx.selectFrom('inpatient.discharge').select(['id', 'status']).where('admission_id', '=', admissionId).where('status', '=', 'planned').forUpdate().executeTakeFirst();
  if (!d) return false;
  const updated = await tx.updateTable('inpatient.discharge_clearance').set({ status: 'cleared', cleared_at: sql`now()`, note: 'final bill settled' })
    .where('discharge_id', '=', d.id).where('kind', '=', 'finance').where('status', '=', 'pending').executeTakeFirst();
  const pending = await tx.selectFrom('inpatient.discharge_clearance').select('id').where('discharge_id', '=', d.id).where('status', '=', 'pending').executeTakeFirst();
  if (!pending) await tx.updateTable('inpatient.discharge').set({ status: 'cleared' }).where('id', '=', d.id).execute();
  return Number(updated.numUpdatedRows) > 0;
}

/** The patient leaves: every clearance must be cleared or waived. Beds go to cleaning. */
export async function depart(db: Kysely<DB>, caller: Caller, input: { dischargeId: string }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'inpatient', name: 'inpatient.depart', idempotencyKey, request: input }, async (ctx) => {
    const d = await lockDischarge(ctx.tx, input.dischargeId);
    if (d.status === 'departed') return { dischargeId: d.id, admissionId: d.admission_id, status: 'departed' as const };
    if (d.status !== 'cleared') {
      const pending = await ctx.tx.selectFrom('inpatient.discharge_clearance').select('kind').where('discharge_id', '=', d.id).where('status', '=', 'pending').orderBy('kind').execute();
      throw preconditionFailed('clearances are still pending', { reason: 'clearances_pending', pending: pending.map((p) => p.kind) });
    }
    const a = await lockAdmission(ctx.tx, d.admission_id);
    await vacate(ctx, a.id, now);
    await ctx.tx.updateTable('inpatient.discharge').set({ status: 'departed', departed_at: now, updated_by: ctx.actor.staffId ?? null }).where('id', '=', d.id).execute();
    const { version } = await ctx.tx.updateTable('inpatient.admission').set({ status: 'discharged', discharged_at: now, updated_by: ctx.actor.staffId ?? null }).where('id', '=', a.id).returning('version').executeTakeFirstOrThrow();
    await history(ctx, a.id, 'discharge_planned', 'discharged', now);
    ctx.audit({ action: 'status_change', subjectType: 'inpatient.admission', subjectId: a.id, patientId: a.patient_id, diff: { status: ['discharge_planned', 'discharged'], dischargeType: d.discharge_type } });
    ctx.emit({
      eventType: 'admission.discharged', aggregateType: 'inpatient.admission', aggregateId: a.id, aggregateVersion: version,
      payload: { admissionId: a.id, dischargeId: d.id, dischargeType: d.discharge_type, departedAt: now.toISOString() },
    });
    return { dischargeId: d.id, admissionId: a.id, status: 'departed' as const };
  });
}

// ---- bed status ----------------------------------------------------------------------------------------

const BED_MOVES: Record<'ready' | 'block' | 'unblock' | 'maintenance', { from: BedState[]; to: BedState; needsReason: boolean }> = {
  ready: { from: ['dirty'], to: 'ready', needsReason: false },
  block: { from: ['ready', 'dirty'], to: 'blocked', needsReason: true },
  maintenance: { from: ['ready', 'dirty', 'blocked'], to: 'maintenance', needsReason: true },
  unblock: { from: ['blocked', 'maintenance'], to: 'ready', needsReason: false },
};

export async function setBedStatus(db: Kysely<DB>, caller: Caller, input: { bedId: string; action: keyof typeof BED_MOVES; reason?: string | undefined }, idempotencyKey?: string) {
  const now = clock(caller);
  const move = BED_MOVES[input.action];
  if (move.needsReason && !input.reason) throw invalid('give a reason', { reason: 'reason_required' });
  return runCommand(db, { ...caller, module: 'inpatient', name: 'inpatient.set_bed_status', idempotencyKey, request: input }, async (ctx) => {
    const loc = await ctx.tx.selectFrom('platform.location').select(['facility_id', 'kind']).where('id', '=', input.bedId).executeTakeFirst();
    if (!loc || loc.kind !== 'bed') throw notFound('bed', { bedId: input.bedId });
    const { status } = await lockBed(ctx.tx, ctx.tenantId, loc.facility_id, input.bedId);
    if (!move.from.includes(status.status as BedState)) throw preconditionFailed(`bed is ${status.status}`, { reason: 'invalid_bed_transition', status: status.status });
    await setBed(ctx, input.bedId, status.status, move.to, now, input.reason ?? null);
    ctx.audit({ action: 'status_change', subjectType: 'inpatient.bed_status', subjectId: status.id, reason: input.reason, diff: { bedId: input.bedId, status: [status.status, move.to] } });
    return { bedId: input.bedId, status: move.to };
  });
}

export const isOpenAdmission = (status: string) => OPEN.includes(status as AdmissionStatus);
