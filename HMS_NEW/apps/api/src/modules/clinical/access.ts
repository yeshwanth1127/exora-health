// Chart access. Roles say what someone may do; the care relationship says to whose chart.
//   - Participants of an encounter may work on it.
//   - Staff with the right permission at the facility may join an *active* encounter (they become a
//     participant: the nurse taking vitals, a covering doctor) — this is how on-duty care works.
//   - Past charts need a care relationship (clinical.has_care_access) or break-glass access.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { forbidden, invalid, notFound, runCommand, type CommandContext } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';

export interface EncounterRow {
  id: string;
  patient_id: string;
  facility_id: string;
  attending_staff_id: string;
  appointment_id: string | null;
  status: string;
  version: number;
}

export async function lockEncounter(tx: Transaction<DB>, encounterId: string): Promise<EncounterRow> {
  const row = await tx
    .selectFrom('clinical.encounter')
    .select(['id', 'patient_id', 'facility_id', 'attending_staff_id', 'appointment_id', 'status', 'version'])
    .where('id', '=', encounterId)
    .forUpdate()
    .executeTakeFirst();
  if (!row) throw notFound('encounter', { encounterId });
  return row;
}

export async function hasCareAccess(tx: Transaction<DB>, staffId: string, patientId: string, at: Date): Promise<boolean> {
  const { rows: [r] } = await sql<{ ok: boolean }>`SELECT clinical.has_care_access(${staffId}, ${patientId}, ${at}) AS ok`.execute(tx);
  return !!r?.ok;
}

export async function assertChartAccess(tx: Transaction<DB>, staffId: string | undefined, patientId: string, at: Date): Promise<void> {
  if (!staffId || !(await hasCareAccess(tx, staffId, patientId, at))) {
    throw forbidden('no care relationship with this patient; break-glass access is available for emergencies', { reason: 'no_care_relationship', patientId });
  }
}

const ACTIVE = ['arrived', 'in_progress'];

/** Ensures the actor may work on this encounter, joining it as a participant when it is active. */
export async function ensureEncounterAccess(ctx: CommandContext, encounter: EncounterRow, at: Date): Promise<void> {
  const staffId = ctx.actor.staffId;
  if (!staffId) throw forbidden('only staff can work on encounters');
  const participant = await ctx.tx
    .selectFrom('clinical.encounter_participant')
    .select('id')
    .where('encounter_id', '=', encounter.id)
    .where('staff_id', '=', staffId)
    .where('period_end', 'is', null)
    .executeTakeFirst();
  if (participant) return;
  if (ACTIVE.includes(encounter.status)) {
    const staff = await ctx.tx.selectFrom('platform.staff').select('staff_type').where('id', '=', staffId).executeTakeFirstOrThrow();
    const role = staff.staff_type === 'doctor' ? 'consulting' : staff.staff_type === 'nurse' ? 'nurse' : 'other';
    await ctx.tx
      .insertInto('clinical.encounter_participant')
      .values({ tenant_id: ctx.tenantId, encounter_id: encounter.id, staff_id: staffId, role })
      .onConflict((oc) => oc.doNothing())
      .execute();
    ctx.audit({ action: 'create', subjectType: 'clinical.encounter_participant', subjectId: encounter.id, patientId: encounter.patient_id, reason: 'joined active encounter' });
    return;
  }
  await assertChartAccess(ctx.tx, staffId, encounter.patient_id, at);
}

/**
 * Break-glass: time-limited chart access without a care relationship, for emergencies. Always audited;
 * grants are listed for next-day review (platform.emergency_access_grant, reviewed_at IS NULL).
 */
export async function breakGlass(db: Kysely<DB>, caller: Caller, input: { patientId: string; reason: string; hours?: number }) {
  const hours = input.hours ?? 4;
  if (hours < 1 || hours > 24) throw invalid('hours must be between 1 and 24');
  if (input.reason.trim().length < 10) throw invalid('give a reason of at least 10 characters');
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.break_glass', request: input }, async (ctx) => {
    if (!ctx.actor.staffId) throw forbidden('only staff can use break-glass access');
    const { id, expires_at } = await ctx.tx
      .insertInto('platform.emergency_access_grant')
      .values({
        tenant_id: ctx.tenantId,
        staff_id: ctx.actor.staffId,
        patient_id: input.patientId,
        reason: input.reason.trim(),
        granted_at: now,
        expires_at: new Date(now.getTime() + hours * 3600_000),
      })
      .returning(['id', 'expires_at'])
      .executeTakeFirstOrThrow();
    ctx.audit({ action: 'break_glass', subjectType: 'patient.patient', subjectId: input.patientId, patientId: input.patientId, reason: input.reason });
    ctx.emit({ eventType: 'access.break_glass', aggregateType: 'platform.emergency_access_grant', aggregateId: id, payload: { staffId: ctx.actor.staffId, patientId: input.patientId } });
    return { grantId: id, expiresAt: expires_at };
  });
}
