// Patient demographics and contact details (G24). Contacts and addresses are never overwritten: the
// current one is ended (valid_to) and a new one starts, so earlier details stay on record. The audit
// event names the fields that changed, never their values (they are personal data).
import { sql, type DB, type Kysely } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand, type CommandContext } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';

export interface AddressInput {
  line1: string | null;
  line2: string | null;
  city: string | null;
  district: string | null;
  stateCode: string | null;
  pincode: string | null;
}

export interface UpdatePatientInput {
  patientId: string;
  version: number;
  givenName?: string | undefined;
  familyName?: string | null | undefined;
  birthDate?: string | null | undefined;
  birthDateEstimated?: boolean | undefined;
  sex?: 'male' | 'female' | 'other' | 'unknown' | undefined;
  preferredLanguage?: string | null | undefined;
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | null | undefined;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed' | 'separated' | 'unknown' | null | undefined;
  occupation?: string | null | undefined;
  /** Primary phone (E.164); null removes it. */
  phone?: string | null | undefined;
  /** Primary email; null removes it. */
  email?: string | null | undefined;
  /** Home address; null removes it. */
  address?: AddressInput | null | undefined;
}

const COLUMNS = {
  givenName: 'given_name',
  familyName: 'family_name',
  birthDate: 'birth_date',
  birthDateEstimated: 'birth_date_estimated',
  sex: 'sex',
  preferredLanguage: 'preferred_language',
  bloodGroup: 'blood_group',
  maritalStatus: 'marital_status',
  occupation: 'occupation',
} as const;

/** Ends the current primary contact of this kind and starts the new one; true when something changed. */
async function replaceContact(ctx: CommandContext, patientId: string, kind: 'phone' | 'email', value: string | null, today: string): Promise<boolean> {
  const current = await ctx.tx
    .selectFrom('patient.patient_contact')
    .select(['id', 'value'])
    .where('patient_id', '=', patientId)
    .where('kind', '=', kind)
    .where('is_primary', '=', true)
    .where('valid_to', 'is', null)
    .forUpdate()
    .executeTakeFirst();
  if ((current?.value ?? null) === value) return false;
  if (current) await ctx.tx.updateTable('patient.patient_contact').set({ valid_to: today, is_primary: false, updated_by: ctx.actor.staffId ?? null }).where('id', '=', current.id).execute();
  if (value !== null) {
    await ctx.tx.insertInto('patient.patient_contact').values({ tenant_id: ctx.tenantId, patient_id: patientId, kind, value, is_primary: true, created_by: ctx.actor.staffId ?? null }).execute();
  }
  return true;
}

async function replaceAddress(ctx: CommandContext, patientId: string, address: AddressInput | null, today: string): Promise<boolean> {
  const current = await ctx.tx
    .selectFrom('patient.patient_address')
    .select(['id', 'line1', 'line2', 'city', 'district', 'state_code', 'pincode'])
    .where('patient_id', '=', patientId)
    .where('is_primary', '=', true)
    .where('valid_to', 'is', null)
    .forUpdate()
    .executeTakeFirst();
  const next = address && Object.values(address).some((v) => v) ? address : null;
  const same =
    (!current && !next) ||
    (!!current && !!next && current.line1 === next.line1 && current.line2 === next.line2 && current.city === next.city &&
      current.district === next.district && current.state_code === next.stateCode && current.pincode === next.pincode);
  if (same) return false;
  if (current) await ctx.tx.updateTable('patient.patient_address').set({ valid_to: today, is_primary: false, updated_by: ctx.actor.staffId ?? null }).where('id', '=', current.id).execute();
  if (next) {
    await ctx.tx
      .insertInto('patient.patient_address')
      .values({ tenant_id: ctx.tenantId, patient_id: patientId, kind: 'home', line1: next.line1, line2: next.line2, city: next.city, district: next.district, state_code: next.stateCode, pincode: next.pincode, is_primary: true, created_by: ctx.actor.staffId ?? null })
      .execute();
  }
  return true;
}

export async function updatePatient(db: Kysely<DB>, caller: Caller, input: UpdatePatientInput) {
  if (input.givenName !== undefined && !input.givenName.trim()) throw invalid('givenName is required');
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.update' }, async (ctx) => {
    const before = await ctx.tx.selectFrom('patient.patient').selectAll().where('id', '=', input.patientId).forUpdate().executeTakeFirst();
    if (!before) throw notFound('patient', { patientId: input.patientId });
    if (before.status === 'merged') throw preconditionFailed('this record was merged; edit the surviving record', { reason: 'merged', mergedIntoPatientId: before.merged_into_patient_id });
    if (before.version !== input.version) throw conflict('this patient was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: before.version });
    const { rows: [t] } = await sql<{ today: string }>`
      SELECT (${clock(caller)}::timestamptz AT TIME ZONE default_timezone)::date::text AS today FROM platform.tenant`.execute(ctx.tx);
    const today = t!.today;
    if (input.birthDate && input.birthDate > today) throw invalid("date of birth can't be in the future");

    const set: Record<string, unknown> = {};
    const changed: string[] = [];
    for (const [field, column] of Object.entries(COLUMNS) as [keyof typeof COLUMNS, string][]) {
      const value = input[field];
      if (value === undefined) continue;
      const next = typeof value === 'string' ? value.trim() || null : value;
      if (JSON.stringify((before as Record<string, unknown>)[column] ?? null) !== JSON.stringify(next ?? null)) {
        set[column] = next;
        changed.push(field);
      }
    }
    try {
      if (input.phone !== undefined && (await replaceContact(ctx, before.id, 'phone', input.phone, today))) changed.push('phone');
      if (input.email !== undefined && (await replaceContact(ctx, before.id, 'email', input.email?.toLowerCase() ?? null, today))) changed.push('email');
      if (input.address !== undefined && (await replaceAddress(ctx, before.id, input.address, today))) changed.push('address');
      if (!changed.length) return { patientId: before.id, version: before.version, changed };
      // The patient row's version moves on every edit, contacts included, so a stale form is always caught.
      const { version } = await ctx.tx
        .updateTable('patient.patient')
        .set({ ...set, updated_by: ctx.actor.staffId ?? null })
        .where('id', '=', before.id)
        .returning('version')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'update', subjectType: 'patient.patient', subjectId: before.id, patientId: before.id, diff: { fields: changed } });
      ctx.emit({ eventType: 'patient.updated', aggregateType: 'patient.patient', aggregateId: before.id, aggregateVersion: version, payload: { patientId: before.id, fields: changed } });
      return { patientId: before.id, version, changed };
    } catch (err) {
      if (pgCode(err) === '23514') throw invalid('patient details failed validation (check phone, email and pincode formats)');
      throw err;
    }
  });
}

/** Details for the edit form: demographics, current primary phone/email and home address, with the row version. */
export async function patientEditView(tx: import('@hms/db').Transaction<DB>, patientId: string) {
  const { rows: [address] } = await sql<AddressInput>`
    SELECT line1, line2, city, district, state_code AS "stateCode", pincode FROM patient.patient_address
    WHERE patient_id = ${patientId} AND is_primary AND valid_to IS NULL LIMIT 1`.execute(tx);
  return address ?? null;
}
