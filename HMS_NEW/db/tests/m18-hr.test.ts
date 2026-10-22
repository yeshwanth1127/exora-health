// M18 HR: the leave ledger is append-only and a request is consumed once; one person's live leave never
// overlaps; locked attendance and approved payslips never change; only mod_hr writes HR; tenants are isolated.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PG, adminPool, appPool, asTenant, createTenant, type TenantFixture } from './db.ts';

const admin = adminPool();
const app = appPool();
let a: TenantFixture;
let b: TenantFixture;
let staff: string;
let leaveType: string;

const one = async (text: string, values: unknown[]) => (await admin.query<{ id: string }>(text, values)).rows[0]!.id;
const hr = <T>(fn: (c: import('pg').PoolClient) => Promise<T>) => asTenant(app, a.tenantId, 'mod_hr', fn, { commit: true });

beforeAll(async () => {
  a = await createTenant(admin, 'hr-db-a');
  b = await createTenant(admin, 'hr-db-b');
  staff = await one(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, 'N1', 'Nurse', 'Nurse', 'nurse') RETURNING id`, [a.tenantId]);
  await admin.query(`INSERT INTO hr.employee_profile (tenant_id, staff_id, facility_id, designation, date_of_joining) VALUES ($1, $2, $3, 'Nurse', '2026-01-01')`, [a.tenantId, staff, a.facilityId]);
  leaveType = await one(`INSERT INTO hr.leave_type (tenant_id, code, name) VALUES ($1, 'CL', 'Casual') RETURNING id`, [a.tenantId]);
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

const request = (from: string, to: string, days: number) => hr((c) => c.query<{ id: string }>(
  `INSERT INTO hr.leave_request (tenant_id, staff_id, leave_type_id, starts_on, ends_on, days, reason) VALUES ($1, $2, $3, $4, $5, $6, 'test') RETURNING id`,
  [a.tenantId, staff, leaveType, from, to, days]));

describe('leave', () => {
  it('never overlaps for one person while live', async () => {
    const { rows: [r] } = await request('2026-09-01', '2026-09-02', 2);
    await expect(request('2026-09-02', '2026-09-03', 2)).rejects.toMatchObject({ code: PG.exclusionViolation });
    await hr((c) => c.query(`UPDATE hr.leave_request SET status = 'cancelled', cancelled_at = now() WHERE id = $1`, [r!.id]));
    await expect(request('2026-09-02', '2026-09-03', 2)).resolves.toBeTruthy();
  });

  it('keeps an append-only ledger that consumes a request once', async () => {
    const { rows: [r] } = await request('2026-10-05', '2026-10-05', 1);
    const consume = () => hr((c) => c.query(`INSERT INTO hr.leave_ledger (tenant_id, staff_id, leave_type_id, entry, days, effective_on, leave_request_id) VALUES ($1, $2, $3, 'consume', -1, '2026-10-05', $4)`,
      [a.tenantId, staff, leaveType, r!.id]));
    await consume();
    await expect(consume()).rejects.toMatchObject({ code: PG.uniqueViolation });
    await expect(hr((c) => c.query(`UPDATE hr.leave_ledger SET days = -2 WHERE leave_request_id = $1`, [r!.id]))).rejects.toThrow();
    await expect(hr((c) => c.query(`INSERT INTO hr.leave_ledger (tenant_id, staff_id, leave_type_id, entry, days, effective_on) VALUES ($1, $2, $3, 'grant', -1, '2026-10-01')`,
      [a.tenantId, staff, leaveType]))).rejects.toMatchObject({ code: PG.checkViolation });
  });
});

describe('payroll freezes', () => {
  it('locks attendance and approved payslips', async () => {
    await hr((c) => c.query(`INSERT INTO hr.attendance_day (tenant_id, staff_id, facility_id, on_date, status, is_locked) VALUES ($1, $2, $3, '2026-08-03', 'present', true)`, [a.tenantId, staff, a.facilityId]));
    await expect(hr((c) => c.query(`UPDATE hr.attendance_day SET status = 'absent' WHERE staff_id = $1 AND on_date = '2026-08-03'`, [staff]))).rejects.toMatchObject({ code: PG.objectNotInPrerequisiteState });
    const run = await one(`INSERT INTO hr.payroll_run (tenant_id, facility_id, period_month, status, computed_at) VALUES ($1, $2, '2026-08-01', 'computed', now()) RETURNING id`, [a.tenantId, a.facilityId]);
    const slip = await one(`INSERT INTO hr.payslip (tenant_id, payroll_run_id, staff_id, days_in_month, paid_days, gross_minor, deductions_minor, net_minor) VALUES ($1, $2, $3, 31, 31, 1000, 100, 900) RETURNING id`, [a.tenantId, run, staff]);
    await expect(hr((c) => c.query(`UPDATE hr.payslip SET gross_minor = 2000, net_minor = 1900 WHERE id = $1`, [slip]))).resolves.toBeTruthy();   // still computed: editable
    await hr((c) => c.query(`UPDATE hr.payroll_run SET status = 'approved', approved_at = now(), approved_by = $2 WHERE id = $1`, [run, staff]));
    await expect(hr((c) => c.query(`UPDATE hr.payslip SET gross_minor = 3000, net_minor = 2900 WHERE id = $1`, [slip]))).rejects.toMatchObject({ code: PG.objectNotInPrerequisiteState });
    await expect(hr((c) => c.query(`DELETE FROM hr.payslip WHERE id = $1`, [slip]))).rejects.toMatchObject({ code: PG.objectNotInPrerequisiteState });
    await expect(hr((c) => c.query(`UPDATE hr.payroll_run SET status = 'computed' WHERE id = $1`, [run]))).rejects.toMatchObject({ code: PG.objectNotInPrerequisiteState });
  });
});

describe('ownership and isolation', () => {
  it('only mod_hr writes HR; other tenants see nothing', async () => {
    await expect(asTenant(app, a.tenantId, 'mod_billing', (c) => c.query(`INSERT INTO hr.leave_type (tenant_id, code, name) VALUES ($1, 'X', 'X')`, [a.tenantId])))
      .rejects.toMatchObject({ code: PG.insufficientPrivilege });
    const seen = await asTenant(app, b.tenantId, null, async (c) => (await c.query('SELECT 1 FROM hr.employee_profile')).rowCount);
    expect(seen).toBe(0);
  });
});
