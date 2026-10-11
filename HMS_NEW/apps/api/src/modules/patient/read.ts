// Patient search and lookup for the API.
import { sql, type DB, type Kysely } from '@hms/db';
import { invalid, notFound, runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';
import { patientEditView } from './update.ts';

export interface PatientSummary {
  patientId: string;
  mrn: string;
  name: string;
  sex: string;
  birthDate: string | null;
  phone: string | null;
  status: string;
}

export interface PatientSearch {
  q?: string | undefined; // name (typo-tolerant) or MRN
  phone?: string | undefined; // E.164
  abhaNumber?: string | undefined;
  limit?: number | undefined;
}

export async function searchPatients(db: Kysely<DB>, caller: Caller, s: PatientSearch): Promise<PatientSummary[]> {
  if (!s.q && !s.phone && !s.abhaNumber) throw invalid('give q, phone or abhaNumber');
  const limit = Math.min(s.limit ?? 20, 50);
  // Substring match for search-as-you-type (short prefixes miss the similarity threshold); wildcards are literal.
  const contains = s.q ? `%${s.q.toLowerCase().replace(/[\\%_]/g, '\\$&')}%` : null;
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<PatientSummary>`
      SELECT p.id AS "patientId", p.mrn, p.given_name || coalesce(' ' || p.family_name, '') AS name, p.sex,
             p.birth_date AS "birthDate",
             (SELECT c.value FROM patient.patient_contact c
              WHERE c.patient_id = p.id AND c.kind = 'phone' AND c.is_primary AND c.valid_to IS NULL LIMIT 1) AS phone,
             p.status
      FROM patient.patient p
      WHERE p.status <> 'merged'
        AND (${s.q ?? null}::text IS NULL OR p.mrn = ${s.q ?? null} OR p.search_name % lower(${s.q ?? null}) OR p.search_name LIKE ${contains})
        AND (${s.phone ?? null}::text IS NULL OR EXISTS (
              SELECT 1 FROM patient.patient_contact c WHERE c.patient_id = p.id AND c.kind = 'phone' AND c.value = ${s.phone ?? null}))
        AND (${s.abhaNumber?.replaceAll('-', '') ?? null}::text IS NULL OR EXISTS (
              SELECT 1 FROM patient.patient_identifier i
              WHERE i.patient_id = p.id AND i.system = 'abha_number' AND i.value = ${s.abhaNumber?.replaceAll('-', '') ?? null}))
      ORDER BY CASE WHEN ${s.q ?? null}::text IS NULL THEN 0 ELSE similarity(p.search_name, lower(${s.q ?? ''})) END DESC, p.mrn
      LIMIT ${limit}`.execute(tx);
    return rows;
  });
}

// The Patients page's default view: patients registered at one clinic, newest first.
// ponytail: offset paging sorts the clinic's rows each page; add a (tenant, facility, created_at) index if clinics grow large.
export async function listClinicPatients(db: Kysely<DB>, caller: Caller, facilityId: string, limit: number, offset: number): Promise<PatientSummary[]> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<PatientSummary>`
      SELECT p.id AS "patientId", p.mrn, p.given_name || coalesce(' ' || p.family_name, '') AS name, p.sex,
             p.birth_date AS "birthDate",
             (SELECT c.value FROM patient.patient_contact c
              WHERE c.patient_id = p.id AND c.kind = 'phone' AND c.is_primary AND c.valid_to IS NULL LIMIT 1) AS phone,
             p.status
      FROM patient.patient p
      WHERE p.registered_facility_id = ${facilityId} AND p.status <> 'merged'
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${limit} OFFSET ${offset}`.execute(tx);
    return rows;
  });
}

export async function getPatient(db: Kysely<DB>, caller: Caller, patientId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const p = await tx.selectFrom('patient.patient').selectAll().where('id', '=', patientId).executeTakeFirst();
    if (!p) throw notFound('patient', { patientId });
    const [identifiers, contacts, address] = await Promise.all([
      tx.selectFrom('patient.patient_identifier').select(['system', 'value', 'verified_at', 'is_primary']).where('patient_id', '=', patientId).execute(),
      tx.selectFrom('patient.patient_contact').select(['kind', 'value', 'is_primary']).where('patient_id', '=', patientId).where('valid_to', 'is', null).execute(),
      patientEditView(tx, patientId),
    ]);
    return {
      patientId: p.id,
      mrn: p.mrn,
      givenName: p.given_name,
      familyName: p.family_name,
      sex: p.sex,
      birthDate: p.birth_date,
      birthDateEstimated: p.birth_date_estimated,
      preferredLanguage: p.preferred_language,
      bloodGroup: p.blood_group,
      maritalStatus: p.marital_status,
      occupation: p.occupation,
      status: p.status,
      version: p.version,
      mergedIntoPatientId: p.merged_into_patient_id,
      registeredFacilityId: p.registered_facility_id,
      identifiers,
      contacts,
      address,
    };
  });
}
