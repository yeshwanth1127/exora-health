// HR reads: the staff directory with employment details, one employee (statutory and bank details only
// for payroll.read), attendance by month or by day, shifts, the roster, leave types and payroll runs.
import { sql, type DB, type Kysely } from '@hms/db';
import { notFound, runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';

export async function employeeFacility(db: Kysely<DB>, caller: Caller, staffId: string) {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('hr.employee_profile').select('facility_id').where('staff_id', '=', staffId).executeTakeFirst())?.facility_id);
}

export async function hrRecordFacility(db: Kysely<DB>, caller: Caller, table: 'hr.payroll_run' | 'hr.shift_definition', id: string) {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom(table).select('facility_id').where('id', '=', id).executeTakeFirst())?.facility_id);
}

export async function staffFacilityOf(db: Kysely<DB>, caller: Caller, kind: 'leave' | 'regularisation' | 'payslip', id: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows: [r] } = kind === 'payslip'
      ? await sql<{ facility_id: string }>`SELECT r.facility_id FROM hr.payslip p JOIN hr.payroll_run r ON r.id = p.payroll_run_id WHERE p.id = ${id}`.execute(tx)
      : await sql<{ facility_id: string }>`SELECT e.facility_id FROM ${sql.table(kind === 'leave' ? 'hr.leave_request' : 'hr.attendance_regularisation')} x
          JOIN hr.employee_profile e ON e.staff_id = x.staff_id WHERE x.id = ${id}`.execute(tx);
    return r?.facility_id;
  });
}

export async function directory(db: Kysely<DB>, caller: Caller, q: { facilityId: string; status?: string | undefined }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<Record<string, unknown>>`
      SELECT s.id AS "staffId", s.employee_no AS "employeeNo", s.display_name AS name, s.staff_type AS "staffType", s.phone, s.email,
             p.designation, p.department_id AS "departmentId", d.name AS department, p.reporting_to_staff_id AS "reportingToStaffId",
             p.date_of_joining::text AS "dateOfJoining", p.date_of_exit::text AS "dateOfExit", coalesce(p.status, 'no_profile') AS status, p.version
      FROM platform.staff s
      LEFT JOIN hr.employee_profile p ON p.staff_id = s.id
      LEFT JOIN platform.department d ON d.id = p.department_id
      WHERE NOT s.is_system_account
        AND (p.facility_id = ${q.facilityId} OR (p.id IS NULL AND EXISTS (
              SELECT 1 FROM platform.role_grant g WHERE g.staff_id = s.id AND g.revoked_at IS NULL AND (g.facility_id IS NULL OR g.facility_id = ${q.facilityId}))))
        AND (${q.status ?? null}::text IS NULL OR coalesce(p.status, 'no_profile') = ${q.status ?? null})
      ORDER BY s.display_name`.execute(tx);
    return rows;
  });
}

export async function employee(db: Kysely<DB>, caller: Caller, staffId: string, withStatutory: boolean) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const s = await tx.selectFrom('platform.staff').select(['id', 'employee_no', 'display_name', 'staff_type', 'employment_type', 'phone', 'email', 'status']).where('id', '=', staffId).executeTakeFirst();
    if (!s) throw notFound('staff member', { staffId });
    const p = await tx.selectFrom('hr.employee_profile').selectAll().where('staff_id', '=', staffId).executeTakeFirst();
    const st = withStatutory ? await tx.selectFrom('hr.employee_statutory').selectAll().where('staff_id', '=', staffId).executeTakeFirst() : undefined;
    const salary = withStatutory
      ? await tx.selectFrom('hr.salary_structure as s').innerJoin('hr.salary_structure_line as l', 'l.salary_structure_id', 's.id').innerJoin('hr.salary_component as c', 'c.id', 'l.salary_component_id')
          .select(['s.id', 's.effective_from', 'c.code', 'c.name', 'c.kind', 'l.amount_minor', 'l.percent_bp']).where('s.staff_id', '=', staffId).orderBy('s.effective_from', 'desc').orderBy('c.display_order').execute()
      : [];
    return {
      staffId: s.id, employeeNo: s.employee_no, name: s.display_name, staffType: s.staff_type, employmentType: s.employment_type, phone: s.phone, email: s.email, staffStatus: s.status,
      profile: p ? {
        facilityId: p.facility_id, designation: p.designation, departmentId: p.department_id, reportingToStaffId: p.reporting_to_staff_id, dateOfJoining: p.date_of_joining,
        dateOfExit: p.date_of_exit, exitReason: p.exit_reason, emergencyContact: { name: p.emergency_contact_name, phone: p.emergency_contact_phone, relation: p.emergency_contact_relation },
        address: p.address, status: p.status, version: p.version,
      } : null,
      statutory: st ? {
        pan: st.pan, uan: st.uan, esicNo: st.esic_no, bankAccountNo: st.bank_account_no, bankIfsc: st.bank_ifsc, bankName: st.bank_name, accountHolder: st.account_holder,
        pfApplicable: st.pf_applicable, esiApplicable: st.esi_applicable, ptStateCode: st.pt_state_code, version: st.version,
      } : null,
      salaryHistory: withStatutory ? Object.values(salary.reduce<Record<string, { salaryStructureId: string; effectiveFrom: unknown; lines: unknown[] }>>((acc, l) => {
        (acc[l.id] ??= { salaryStructureId: l.id, effectiveFrom: l.effective_from, lines: [] }).lines.push({ code: l.code, name: l.name, kind: l.kind, amountMinor: l.amount_minor, percentBp: l.percent_bp });
        return acc;
      }, {})) : null,
    };
  });
}

export async function attendanceMonth(db: Kysely<DB>, caller: Caller, q: { staffId: string; month: string }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<Record<string, unknown>>`
      SELECT d.on_date::text AS date, d.status, d.first_in AS "firstIn", d.last_out AS "lastOut", d.worked_minutes AS "workedMinutes", d.late_minutes AS "lateMinutes",
             d.source, d.is_locked AS locked
      FROM hr.attendance_day d WHERE d.staff_id = ${q.staffId} AND d.on_date >= ${q.month}::date AND d.on_date < (${q.month}::date + interval '1 month')
      ORDER BY d.on_date`.execute(tx);
    const totals = rows.reduce<Record<string, number>>((acc, r) => { acc[String(r['status'])] = (acc[String(r['status'])] ?? 0) + 1; return acc; }, {});
    return { staffId: q.staffId, month: q.month, days: rows, totals };
  });
}

export async function attendanceOnDay(db: Kysely<DB>, caller: Caller, q: { facilityId: string; date: string }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<Record<string, unknown>>`
      SELECT p.staff_id AS "staffId", s.display_name AS name, p.designation, coalesce(d.status, 'not_recorded') AS status, d.first_in AS "firstIn", d.last_out AS "lastOut",
             d.late_minutes AS "lateMinutes", sh.name AS shift
      FROM hr.employee_profile p JOIN platform.staff s ON s.id = p.staff_id
      LEFT JOIN hr.attendance_day d ON d.staff_id = p.staff_id AND d.on_date = ${q.date}::date
      LEFT JOIN hr.roster_assignment r ON r.staff_id = p.staff_id AND r.on_date = ${q.date}::date
      LEFT JOIN hr.shift_definition sh ON sh.id = r.shift_definition_id
      WHERE p.facility_id = ${q.facilityId} AND p.status <> 'exited' ORDER BY s.display_name`.execute(tx);
    return rows;
  });
}

export async function listShifts(db: Kysely<DB>, caller: Caller, facilityId: string) {
  return runQuery(db, caller.tenantId, (tx) => tx.selectFrom('hr.shift_definition').select(['id as shiftId', 'code', 'name', 'start_local as start', 'end_local as end', 'break_minutes as breakMinutes', 'grace_minutes as graceMinutes', 'status', 'version'])
    .where('facility_id', '=', facilityId).orderBy('start_local').execute());
}

export async function roster(db: Kysely<DB>, caller: Caller, q: { facilityId: string; from: string; to: string }) {
  return runQuery(db, caller.tenantId, (tx) => tx.selectFrom('hr.roster_assignment as r').leftJoin('hr.shift_definition as s', 's.id', 'r.shift_definition_id')
    .select(['r.staff_id as staffId', 'r.on_date as date', 'r.kind', 'r.shift_definition_id as shiftId', 's.code as shiftCode'])
    .where('r.facility_id', '=', q.facilityId).where('r.on_date', '>=', q.from).where('r.on_date', '<=', q.to).orderBy('r.on_date').execute());
}

export async function listLeaveTypes(db: Kysely<DB>, caller: Caller) {
  return runQuery(db, caller.tenantId, (tx) => tx.selectFrom('hr.leave_type').select(['id as leaveTypeId', 'code', 'name', 'is_paid as isPaid', 'annual_quota_days as annualQuotaDays', 'carry_forward_max as carryForwardMax', 'allow_negative as allowNegative', 'status', 'version'])
    .orderBy('name').execute());
}

export async function listPayrollRuns(db: Kysely<DB>, caller: Caller, facilityId: string) {
  return runQuery(db, caller.tenantId, (tx) => tx.selectFrom('hr.payroll_run').select(['id as payrollRunId', 'period_month as periodMonth', 'status', 'gross_minor as grossMinor', 'deductions_minor as deductionsMinor', 'net_minor as netMinor', 'version'])
    .where('facility_id', '=', facilityId).orderBy('period_month', 'desc').execute());
}

export async function listSalaryComponents(db: Kysely<DB>, caller: Caller) {
  return runQuery(db, caller.tenantId, (tx) => tx.selectFrom('hr.salary_component').select(['id as salaryComponentId', 'code', 'name', 'kind', 'calc', 'is_basic as isBasic', 'prorate', 'display_order as displayOrder', 'status'])
    .orderBy('display_order').execute());
}
