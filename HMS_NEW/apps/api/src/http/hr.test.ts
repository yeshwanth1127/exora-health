// HR over HTTP: employment profiles and statutory details → shifts and punches → leave (balance, request,
// approval by someone else, overlap refused) → a doctor's approved leave closes their calendar and
// cancelling reopens it → September payroll: attendance → paid days → prorated salary, PF, PT → approve by
// someone other than who computed → paid → locked (attendance frozen) → the employee sees their payslip.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let admin: Person;
let hr: Person;
let nurse: Person;
let doctor: Person;
let casual: string;
let runId: string;

const f = () => k.tenant.facilityId;
const at = (day: string, time: string) => `2026-09-${day}T${time}:00+05:30`;

beforeAll(async () => {
  k = await startKit('hr');
  admin = await k.person('Meera Admin', 'tenant_admin', null);
  hr = await k.person('Hari HR', 'hr_manager', f());
  nurse = await k.person('Sister Mary', 'nurse', f(), 'nurse');
  doctor = await k.person('Dr Anand', 'doctor', null, 'doctor');
});
afterAll(() => k.close());

describe('HR', () => {
  it('is off until switched on', async () => {
    expect((await k.call(nurse, 'GET', '/v1/me/leave')).body.error.details.reason).toBe('module_inactive');
    const m = (await k.call(admin, 'GET', '/v1/modules')).body.items.find((x: { module: string }) => x.module === 'hr');
    expect((await k.call(admin, 'PUT', '/v1/modules/hr', { state: 'active', version: m.version, reason: 'Clinic starts HR' })).status).toBe(200);
  });

  it('keeps employment profiles and hides statutory details from those without payroll access', async () => {
    for (const [who, designation] of [[nurse, 'Staff nurse'], [doctor, 'Consultant physician']] as const) {
      expect((await k.call(hr, 'PUT', `/v1/hr/employees/${who.staffId}`, { facilityId: f(), designation, dateOfJoining: '2026-09-01' })).status).toBe(200);
    }
    expect((await k.call(hr, 'PUT', `/v1/hr/employees/${nurse.staffId}/statutory`, {
      pan: 'ABCDE1234F', uan: '100200300400', bankAccountNo: '123456789012', bankIfsc: 'HDFC0001234', pfApplicable: true, esiApplicable: true, ptStateCode: '29',
    })).status).toBe(200);
    expect((await k.call(hr, 'GET', `/v1/hr/employees/${nurse.staffId}`)).body.statutory).toMatchObject({ uan: '100200300400', pfApplicable: true });
    const dir = (await k.call(hr, 'GET', `/v1/hr/employees?facilityId=${f()}`)).body.items;
    expect(dir.find((d: { staffId: string }) => d.staffId === nurse.staffId)).toMatchObject({ designation: 'Staff nurse', status: 'active' });
    // A doctor reading HR has no HR permission at all
    expect((await k.call(doctor, 'GET', `/v1/hr/employees/${nurse.staffId}`)).status).toBe(403);
  });

  it('records punches in order and refuses the same direction twice', async () => {
    const shift = await k.call(hr, 'POST', '/v1/hr/shifts', { facilityId: f(), code: 'DAY', name: 'Day', start: '09:00', end: '17:00', breakMinutes: 30 });
    expect(shift.status).toBe(201);
    // Manager-recorded September days (with a reason); 2 Sept full, 3 Sept half
    for (const [day, inT, outT] of [['02', '09:05', '17:10'], ['03', '09:00', '12:30']]) {
      expect((await k.call(hr, 'POST', `/v1/hr/employees/${nurse.staffId}/punches`, { direction: 'in', at: at(day!, inT!), note: 'Biometric device was down' })).status).toBe(201);
      expect((await k.call(hr, 'POST', `/v1/hr/employees/${nurse.staffId}/punches`, { direction: 'out', at: at(day!, outT!), note: 'Biometric device was down' })).status).toBe(201);
    }
    expect((await k.call(hr, 'POST', `/v1/hr/employees/${nurse.staffId}/punches`, { direction: 'out', at: at('03', '13:00'), note: 'again' })).body.error.details.reason).toBe('punch_sequence');
    expect((await k.call(nurse, 'POST', '/v1/me/attendance/punch', { direction: 'in' })).status).toBe(201);
    expect((await k.call(nurse, 'POST', '/v1/me/attendance/punch', { direction: 'in' })).body.error.details.reason).toBe('punch_sequence');
  });

  it('grants, requests and approves leave against the balance', async () => {
    casual = (await k.call(hr, 'POST', '/v1/hr/leave-types', { code: 'CL', name: 'Casual leave', isPaid: true, annualQuotaDays: 12 })).body.leaveTypeId;
    expect((await k.call(nurse, 'POST', '/v1/me/leave-requests', { leaveTypeId: casual, startsOn: '2026-09-10', endsOn: '2026-09-10', reason: 'Family function' })).body.error.details.reason).toBe('insufficient_balance');
    expect((await k.call(hr, 'POST', `/v1/hr/employees/${nurse.staffId}/leave-grants`, { leaveTypeId: casual, days: 2, effectiveOn: '2026-09-01', note: 'Pro-rata quota 2026' })).body.balance).toBe(2);
    const req = await k.call(nurse, 'POST', '/v1/me/leave-requests', { leaveTypeId: casual, startsOn: '2026-09-10', endsOn: '2026-09-10', reason: 'Family function' });
    expect(req.status).toBe(201);
    expect((await k.call(nurse, 'POST', '/v1/me/leave-requests', { leaveTypeId: casual, startsOn: '2026-09-10', endsOn: '2026-09-10', reason: 'Overlap' })).body.error.details.reason).toBe('leave_overlap');
    expect((await k.call(nurse, 'GET', '/v1/me/leave')).body.balances).toEqual([expect.objectContaining({ code: 'CL', balance: 2, pending: 1, available: 1 })]);
    const ok = await k.call(hr, 'POST', `/v1/hr/leave-requests/${req.body.leaveRequestId}/decision`, { decision: 'approved', version: req.body.version });
    expect(ok.body.status).toBe('approved');
    expect((await k.call(nurse, 'GET', '/v1/me/leave')).body.balances[0]).toMatchObject({ balance: 1, pending: 0 });
  });

  it("closes an approved doctor's calendar and reopens it when the leave is cancelled", async () => {
    expect((await k.call(admin, 'POST', `/v1/practitioners/${doctor.staffId}/calendar`)).status).toBeLessThan(300);
    await k.call(hr, 'POST', `/v1/hr/employees/${doctor.staffId}/leave-grants`, { leaveTypeId: casual, days: 5, effectiveOn: '2026-09-01', note: 'Quota' });
    const req = await k.call(doctor, 'POST', '/v1/me/leave-requests', { leaveTypeId: casual, startsOn: '2026-11-05', endsOn: '2026-11-06', reason: 'Conference' });
    expect((await k.call(doctor, 'POST', `/v1/hr/leave-requests/${req.body.leaveRequestId}/decision`, { decision: 'approved', version: req.body.version })).status).toBe(403);
    const ok = await k.call(hr, 'POST', `/v1/hr/leave-requests/${req.body.leaveRequestId}/decision`, { decision: 'approved', version: req.body.version });
    expect(ok.body).toMatchObject({ status: 'approved', affectedAppointments: 0 });
    await k.dispatch();
    const closures = async () => (await k.admin.query(`SELECT on_date::text AS d, revoked_at IS NOT NULL AS revoked FROM booking.schedule_exception WHERE leave_request_id = $1 ORDER BY on_date`, [req.body.leaveRequestId])).rows;
    expect(await closures()).toEqual([{ d: '2026-11-05', revoked: false }, { d: '2026-11-06', revoked: false }]);
    const cancelled = await k.call(doctor, 'POST', `/v1/me/leave-requests/${req.body.leaveRequestId}/cancel`, { version: ok.body.version });
    expect(cancelled.body.status).toBe('cancelled');
    await k.dispatch();
    expect((await closures()).every((c: { revoked: boolean }) => c.revoked)).toBe(true);
    expect((await k.call(doctor, 'GET', '/v1/me/leave')).body.balances[0]).toMatchObject({ balance: 5 });
  });

  it('computes, approves, pays and locks September payroll', async () => {
    const basic = (await k.call(hr, 'POST', '/v1/hr/salary-components', { code: 'BASIC', name: 'Basic', kind: 'earning', calc: 'fixed', isBasic: true, displayOrder: 1 })).body.salaryComponentId;
    const hra = (await k.call(hr, 'POST', '/v1/hr/salary-components', { code: 'HRA', name: 'House rent allowance', kind: 'earning', calc: 'percent_of_basic', displayOrder: 2 })).body.salaryComponentId;
    expect((await k.call(hr, 'POST', `/v1/hr/employees/${nurse.staffId}/salary`, { effectiveFrom: '2026-09-01', lines: [{ salaryComponentId: basic, amountMinor: 2_000_000 }, { salaryComponentId: hra, percentBp: 4000 }] })).status).toBe(201);
    expect((await k.call(hr, 'PUT', '/v1/hr/professional-tax/29', { slabs: [{ minGrossMinor: 0, maxGrossMinor: 500_000, amountMinor: 0 }, { minGrossMinor: 500_000, maxGrossMinor: null, amountMinor: 20_000 }] })).status).toBe(200);
    const run = await k.call(hr, 'POST', '/v1/hr/payroll-runs', { facilityId: f(), periodMonth: '2026-09-01' });
    runId = run.body.payrollRunId;
    const computed = await k.call(hr, 'POST', `/v1/hr/payroll-runs/${runId}/compute`, { version: run.body.version, tds: { [nurse.staffId]: 10_000 } });
    expect(computed.status).toBe(200);
    // The doctor has no salary yet: skipped, not paid zero
    expect(computed.body.skipped).toEqual([{ staffId: doctor.staffId, reason: 'no_salary' }]);
    const detail = (await k.call(hr, 'GET', `/v1/hr/payroll-runs/${runId}`)).body;
    const slip = (await k.call(hr, 'GET', `/v1/hr/payslips/${detail.payslips[0].payslipId}`)).body;
    // Paid days: 2 Sept present + 3 Sept half + 10 Sept leave + 4 Sundays = 6.5 of 30
    expect(slip).toMatchObject({ daysInMonth: 30, paidDays: 6.5, lopDays: 23.5 });
    const line = (code: string) => [...slip.earnings, ...slip.deductions].find((l: { code: string }) => l.code === code)?.amountMinor;
    expect(line('BASIC')).toBe(Math.floor((2_000_000 * 6.5) / 30 + 0.5));
    expect(line('HRA')).toBe(Math.floor((800_000 * 6.5) / 30 + 0.5));
    expect(line('PF')).toBe(Math.floor((line('BASIC') * 1200) / 10_000 + 0.5));
    expect(line('ESI')).toBeUndefined();        // full-month gross ₹28,000 is above the ESI ceiling
    expect(line('PT')).toBe(20_000);
    expect(line('TDS')).toBe(10_000);
    expect(slip.netMinor).toBe(slip.grossMinor - slip.deductionsMinor);
    expect(slip.bank).toEqual({ accountLast4: '9012', ifsc: 'HDFC0001234' });

    // The employee can't see it before approval; the computer can't approve their own computation
    expect((await k.call(nurse, 'GET', `/v1/me/payslips/${slip.payslipId}`)).status).toBe(404);
    expect((await k.call(hr, 'POST', `/v1/hr/payroll-runs/${runId}/approve`, { version: computed.body.version })).status).toBe(403);
    const approved = await k.call(admin, 'POST', `/v1/hr/payroll-runs/${runId}/approve`, { version: computed.body.version });
    expect(approved.body.status).toBe('approved');
    expect((await k.call(hr, 'POST', `/v1/hr/payroll-runs/${runId}/compute`, { version: approved.body.version })).body.error.details.reason).toBe('not_editable');
    const paid = await k.call(admin, 'POST', `/v1/hr/payroll-runs/${runId}/mark-paid`, { version: approved.body.version, paymentRefs: { [nurse.staffId]: 'NEFT-0001' } });
    const locked = await k.call(admin, 'POST', `/v1/hr/payroll-runs/${runId}/lock`, { version: paid.body.version });
    expect(locked.body.status).toBe('locked');

    // A locked month's attendance can't be regularised; the payslip is now the employee's to see
    expect((await k.call(nurse, 'POST', '/v1/me/regularisations', { onDate: '2026-09-04', requestedStatus: 'present', reason: 'Forgot to punch' })).body.error.details.reason).toBe('payroll_locked');
    expect((await k.call(nurse, 'GET', '/v1/me/payslips')).body.items).toEqual([expect.objectContaining({ payslipId: slip.payslipId, status: 'locked' })]);
    expect((await k.call(nurse, 'GET', `/v1/me/payslips/${slip.payslipId}`)).body).toMatchObject({ paymentRef: 'NEFT-0001', netMinor: slip.netMinor });
  });
});
