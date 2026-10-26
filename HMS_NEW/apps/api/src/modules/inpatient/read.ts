// Inpatient reads: the bed board (wards → beds, status and occupant, no clinical detail), admissions,
// and one admission with its beds, transfers and discharge clearances.
import { sql, type DB, type Kysely } from '@hms/db';
import { notFound, runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';

export async function admissionFacility(db: Kysely<DB>, caller: Caller, admissionId: string) {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('inpatient.admission').select('facility_id').where('id', '=', admissionId).executeTakeFirst())?.facility_id);
}

export async function dischargeFacility(db: Kysely<DB>, caller: Caller, dischargeId: string) {
  return runQuery(db, caller.tenantId, async (tx) =>
    (await tx.selectFrom('inpatient.discharge as d').innerJoin('inpatient.admission as a', 'a.id', 'd.admission_id').select('a.facility_id').where('d.id', '=', dischargeId).executeTakeFirst())?.facility_id);
}

export async function bedFacility(db: Kysely<DB>, caller: Caller, bedId: string) {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('platform.location').select('facility_id').where('id', '=', bedId).where('kind', '=', 'bed').executeTakeFirst())?.facility_id);
}

export async function bedBoard(db: Kysely<DB>, caller: Caller, facilityId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<{
      ward_id: string; ward_name: string; ward_type: string; bed_id: string; bed_code: string; bed_name: string; bed_category: string;
      bed_active: boolean; status: string | null; since: Date | null; reason: string | null; admission_id: string | null; ip_no: string | null;
      patient_id: string | null; patient_name: string | null; admitted_at: Date | null; expected_discharge_on: string | null; occupancy_kind: string | null;
    }>`
      WITH RECURSIVE beds AS (
        SELECT b.id, b.code, b.name, b.parent_location_id AS up, b.bed_category_id, b.status FROM platform.location b
        WHERE b.facility_id = ${facilityId} AND b.kind = 'bed'
      ), climb AS (
        SELECT beds.id AS bed_id, beds.up AS cur FROM beds
        UNION ALL
        SELECT c.bed_id, l.parent_location_id FROM climb c JOIN platform.location l ON l.id = c.cur WHERE l.kind <> 'ward'
      )
      SELECT w.id AS ward_id, w.name AS ward_name, w.ward_type, b.id AS bed_id, b.code AS bed_code, b.name AS bed_name, bc.name AS bed_category,
             b.status = 'active' AS bed_active, bs.status, bs.since, bs.reason,
             a.id AS admission_id, a.ip_no, a.patient_id, concat_ws(' ', p.given_name, p.family_name) AS patient_name, a.admitted_at,
             a.expected_discharge_on::text, o.kind AS occupancy_kind
      FROM beds b
      JOIN climb c ON c.bed_id = b.id
      JOIN platform.location w ON w.id = c.cur AND w.kind = 'ward'
      JOIN catalog.bed_category bc ON bc.id = b.bed_category_id
      LEFT JOIN inpatient.bed_status bs ON bs.bed_location_id = b.id
      LEFT JOIN inpatient.bed_occupancy o ON o.bed_location_id = b.id AND upper_inf(o.period)
      LEFT JOIN inpatient.admission a ON a.id = o.admission_id
      LEFT JOIN patient.patient p ON p.id = a.patient_id
      ORDER BY w.name, b.code`.execute(tx);
    const wards = new Map<string, { wardId: string; name: string; wardType: string; beds: unknown[]; counts: Record<string, number> }>();
    for (const r of rows) {
      const ward = wards.get(r.ward_id) ?? { wardId: r.ward_id, name: r.ward_name, wardType: r.ward_type, beds: [], counts: {} };
      const status = r.bed_active ? (r.status ?? 'ready') : 'inactive';
      ward.counts[status] = (ward.counts[status] ?? 0) + 1;
      ward.beds.push({
        bedId: r.bed_id, code: r.bed_code, name: r.bed_name, category: r.bed_category, status, since: r.since, reason: r.reason,
        occupant: r.admission_id ? { admissionId: r.admission_id, ipNo: r.ip_no, patientId: r.patient_id, patientName: r.patient_name, admittedAt: r.admitted_at, expectedDischargeOn: r.expected_discharge_on, retained: r.occupancy_kind === 'retained' } : null,
      });
      wards.set(r.ward_id, ward);
    }
    const { rows: [pending] } = await sql<{ n: number }>`SELECT count(*)::int AS n FROM inpatient.admission WHERE facility_id = ${facilityId} AND status = 'bed_pending'`.execute(tx);
    return { wards: [...wards.values()], bedPending: pending!.n };
  });
}

export async function listAdmissions(
  db: Kysely<DB>, caller: Caller, q: { facilityId: string; status?: string | undefined; patientId?: string | undefined; open?: boolean | undefined; limit: number },
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let s = tx.selectFrom('inpatient.admission as a').innerJoin('patient.patient as p', 'p.id', 'a.patient_id').innerJoin('platform.staff as s', 's.id', 'a.admitting_staff_id')
      .select([
        'a.id as admissionId', 'a.ip_no as ipNo', 'a.patient_id as patientId', 'p.mrn', 'p.given_name as givenName', 'p.family_name as familyName',
        'a.admission_type as admissionType', 'a.admitting_staff_id as admittingStaffId', 's.display_name as admittingDoctor', 'a.admitted_at as admittedAt',
        'a.expected_discharge_on as expectedDischargeOn', 'a.status', 'a.discharged_at as dischargedAt', 'a.version',
      ])
      .select(sql<string | null>`(SELECT l.name FROM inpatient.bed_occupancy o JOIN platform.location l ON l.id = o.bed_location_id
                                  WHERE o.admission_id = a.id AND o.kind = 'primary' AND upper_inf(o.period) LIMIT 1)`.as('currentBed'))
      .where('a.facility_id', '=', q.facilityId);
    if (q.status) s = s.where('a.status', '=', q.status as never);
    if (q.open) s = s.where('a.status', 'in', ['bed_pending', 'admitted', 'discharge_planned']);
    if (q.patientId) s = s.where('a.patient_id', '=', q.patientId);
    return s.orderBy('a.admitted_at', 'desc').limit(q.limit).execute();
  });
}

export async function getAdmission(db: Kysely<DB>, caller: Caller, admissionId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const a = await tx.selectFrom('inpatient.admission').selectAll().where('id', '=', admissionId).executeTakeFirst();
    if (!a) throw notFound('admission', { admissionId });
    const occupancies = await tx.selectFrom('inpatient.bed_occupancy as o').innerJoin('platform.location as l', 'l.id', 'o.bed_location_id')
      .innerJoin('catalog.bed_category as c', 'c.id', 'o.billed_bed_category_id')
      .select(['o.id as occupancyId', 'o.bed_location_id as bedId', 'l.name as bed', 'c.name as category', 'o.kind', 'o.reason',
        sql<Date>`lower(o.period)`.as('from'), sql<Date | null>`upper(o.period)`.as('to')])
      .where('o.admission_id', '=', a.id).orderBy(sql`lower(o.period)`).execute();
    const encounter = await tx.selectFrom('clinical.encounter').select(['id', 'encounter_no', 'status']).where('admission_id', '=', a.id).executeTakeFirst();
    const discharge = await tx.selectFrom('inpatient.discharge').selectAll().where('admission_id', '=', a.id).where('status', '<>', 'cancelled').executeTakeFirst();
    const clearances = discharge
      ? await tx.selectFrom('inpatient.discharge_clearance').select(['kind', 'status', 'cleared_at as clearedAt', 'waiver_reason as waiverReason', 'note']).where('discharge_id', '=', discharge.id).orderBy('kind').execute()
      : [];
    const account = await tx.selectFrom('billing.billing_account').select(['id', 'account_no', 'status', 'final_invoice_id']).where('admission_id', '=', a.id).executeTakeFirst();
    return {
      admissionId: a.id, ipNo: a.ip_no, facilityId: a.facility_id, patientId: a.patient_id, admissionType: a.admission_type, admittingStaffId: a.admitting_staff_id,
      departmentId: a.department_id, admissionReason: a.admission_reason, admittedAt: a.admitted_at, expectedDischargeOn: a.expected_discharge_on, status: a.status,
      dischargedAt: a.discharged_at, version: a.version,
      encounter: encounter ? { encounterId: encounter.id, encounterNo: encounter.encounter_no, status: encounter.status } : null,
      occupancies,
      discharge: discharge ? { dischargeId: discharge.id, dischargeType: discharge.discharge_type, status: discharge.status, decidedAt: discharge.decided_at, expectedDepartureAt: discharge.expected_departure_at, departedAt: discharge.departed_at, clearances } : null,
      billingAccount: account ? { accountId: account.id, accountNo: account.account_no, status: account.status, finalInvoiceId: account.final_invoice_id } : null,
    };
  });
}
