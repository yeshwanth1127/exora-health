// Patient registration (M02). MRNs are tenant-wide, gap-free, from the 'mrn' number series.
import { sql, type DB, type Kysely } from '@hms/db';
import { conflict, invalid, pgCode, runCommand } from '@hms/platform';
import type { Caller } from '../../caller.ts';

export interface RegisterPatientInput {
  givenName: string;
  familyName?: string;
  birthDate?: string;
  birthDateEstimated?: boolean;
  sex: 'male' | 'female' | 'other' | 'unknown';
  phone?: string; // E.164
  abhaNumber?: string; // 14 digits; hyphens are stripped
  registeredFacilityId: string;
  source: 'front_desk' | 'portal' | 'whatsapp' | 'voice' | 'abha_scan' | 'emergency';
}

export async function registerPatient(db: Kysely<DB>, caller: Caller, input: RegisterPatientInput, idempotencyKey?: string) {
  if (!input.givenName.trim()) throw invalid('givenName is required');
  const abha = input.abhaNumber?.replaceAll('-', '');
  return runCommand(db, { ...caller, module: 'patient', name: 'patient.register', idempotencyKey, request: input }, async (ctx) => {
    const { rows: [n] } = await sql<{ n: number }>`SELECT platform.next_number('mrn') AS n`.execute(ctx.tx);
    const mrn = String(n!.n).padStart(6, '0');
    try {
      const { id } = await ctx.tx
        .insertInto('patient.patient')
        .values({
          tenant_id: ctx.tenantId,
          mrn,
          registered_facility_id: input.registeredFacilityId,
          given_name: input.givenName.trim(),
          family_name: input.familyName?.trim() ?? null,
          birth_date: input.birthDate ?? null,
          birth_date_estimated: input.birthDateEstimated ?? false,
          sex: input.sex,
          registration_source: input.source,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (input.phone) {
        await ctx.tx
          .insertInto('patient.patient_contact')
          .values({ tenant_id: ctx.tenantId, patient_id: id, kind: 'phone', value: input.phone, is_primary: true })
          .execute();
      }
      if (abha) {
        await ctx.tx
          .insertInto('patient.patient_identifier')
          .values({ tenant_id: ctx.tenantId, patient_id: id, system: 'abha_number', value: abha, is_primary: true })
          .execute();
      }
      ctx.audit({ action: 'create', subjectType: 'patient.patient', subjectId: id, patientId: id });
      ctx.emit({ eventType: 'patient.registered', aggregateType: 'patient.patient', aggregateId: id, payload: { patientId: id, mrn } });
      return { patientId: id, mrn };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('a patient with this ABHA number is already registered', { reason: 'duplicate_identifier' });
      if (pgCode(err) === '23514') throw invalid('patient details failed validation (check phone format and ABHA number)');
      throw err;
    }
  });
}
