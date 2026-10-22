import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize, can } from '../../auth/principal.ts';
import {
  advancePayroll, attendanceMonth, attendanceOnDay, cancelLeave, computeAttendance, computePayroll, createLeaveType, createPayrollRun, createSalaryComponent, createShift,
  decideLeave, decideRegularisation, directory, employee, employeeFacility, getPayrollRun, getPayslip, grantLeave, hrRecordFacility, leaveBalances, listLeaveRequests,
  listLeaveTypes, listPayrollRuns, listSalaryComponents, listShifts, myPayslips, punch, requestLeave, requestRegularisation, roster, saveProfile, savePayrollSettings,
  saveStatutory, setEmploymentStatus, setProfessionalTax, setRoster, setSalaryStructure, staffFacilityOf,
} from '../../modules/hr/index.ts';
import { moduleRoutes } from '../module-routes.ts';
import { callerOf, hhmm, idempotencyKey, isoDate, optionalIdempotencyKey, parse, principalOf, uuid } from '../support.ts';

const Version = z.number().int().min(1);
const Reason = z.string().trim().min(3).max(500);
const Code = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{1,20}$/);
const Month = isoDate.refine((d) => d.endsWith('-01'), 'the first day of a month');
const Minor = z.number().int().min(0).max(10_000_000_00);
const Days = z.number().multipleOf(0.5).min(-365).max(365);
const Limit = z.coerce.number().int().min(1).max(200).default(100);

export function registerHrRoutes(app: FastifyInstance, db: Kysely<DB>) {
  /** Permission at the clinic an employee works at (404 for someone without a profile). */
  const atEmployee = async (request: FastifyRequest, staffId: string, permission: string) => {
    const facilityId = await employeeFacility(db, callerOf(request), staffId);
    if (!facilityId) throw new DomainError('not_found', 'employment profile not found');
    authorize(principalOf(request), permission, facilityId);
    return facilityId;
  };
  const at = async (request: FastifyRequest, lookup: Promise<string | undefined>, what: string, permission: string) => {
    const facilityId = await lookup;
    if (!facilityId) throw new DomainError('not_found', `${what} not found`);
    authorize(principalOf(request), permission, facilityId);
    return facilityId;
  };

  moduleRoutes(app, db, 'hr', (r) => {
    // ---- directory and employment ---------------------------------------------------------------------
    r.get('/v1/hr/employees', async (request) => {
      const q = parse(z.object({ facilityId: uuid, status: z.enum(['active', 'on_notice', 'exited', 'no_profile']).optional() }), request.query);
      authorize(principalOf(request), 'hr.read', q.facilityId);
      return { items: await directory(db, callerOf(request), q) };
    });
    r.get('/v1/hr/employees/:staffId', async (request) => {
      const { staffId } = parse(z.object({ staffId: uuid }), request.params);
      const facilityId = await employeeFacility(db, callerOf(request), staffId);
      authorize(principalOf(request), 'hr.read', facilityId ?? null);
      return employee(db, callerOf(request), staffId, can(principalOf(request), 'payroll.read', facilityId ?? null));
    });
    r.put('/v1/hr/employees/:staffId', async (request) => {
      const { staffId } = parse(z.object({ staffId: uuid }), request.params);
      const body = parse(z.object({
        facilityId: uuid, designation: z.string().trim().min(1).max(100), departmentId: uuid.nullable().optional(), reportingToStaffId: uuid.nullable().optional(),
        dateOfJoining: isoDate, emergencyContactName: z.string().trim().max(200).nullable().optional(), emergencyContactPhone: z.string().regex(/^\+[1-9][0-9]{6,14}$/).nullable().optional(),
        emergencyContactRelation: z.string().trim().max(50).nullable().optional(), address: z.string().trim().max(500).nullable().optional(), version: z.number().int().min(1).optional(),
      }), request.body);
      authorize(principalOf(request), 'hr.manage', body.facilityId);
      return saveProfile(db, callerOf(request), { staffId, ...body }, optionalIdempotencyKey(request));
    });
    r.post('/v1/hr/employees/:staffId/status', async (request) => {
      const { staffId } = parse(z.object({ staffId: uuid }), request.params);
      const body = parse(z.object({ status: z.enum(['active', 'on_notice', 'exited']), dateOfExit: isoDate.optional(), exitReason: Reason.optional(), version: Version }), request.body);
      await atEmployee(request, staffId, 'hr.manage');
      return setEmploymentStatus(db, callerOf(request), { staffId, ...body }, optionalIdempotencyKey(request));
    });
    r.put('/v1/hr/employees/:staffId/statutory', async (request) => {
      const { staffId } = parse(z.object({ staffId: uuid }), request.params);
      const body = parse(z.object({
        pan: z.string().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).nullable().optional(), uan: z.string().regex(/^[0-9]{12}$/).nullable().optional(),
        esicNo: z.string().regex(/^[0-9]{10,17}$/).nullable().optional(), bankAccountNo: z.string().regex(/^[0-9]{6,18}$/).nullable().optional(),
        bankIfsc: z.string().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).nullable().optional(), bankName: z.string().trim().max(100).nullable().optional(),
        accountHolder: z.string().trim().max(200).nullable().optional(), pfApplicable: z.boolean(), esiApplicable: z.boolean(), ptStateCode: z.string().regex(/^[0-9]{2}$/).nullable().optional(),
      }), request.body);
      await atEmployee(request, staffId, 'payroll.manage');
      return saveStatutory(db, callerOf(request), { staffId, ...body }, optionalIdempotencyKey(request));
    });

    // ---- shifts, roster, attendance --------------------------------------------------------------------
    r.get('/v1/hr/shifts', async (request) => {
      const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
      authorize(principalOf(request), 'hr.read', facilityId);
      return { items: await listShifts(db, callerOf(request), facilityId) };
    });
    r.post('/v1/hr/shifts', async (request, reply) => {
      const body = parse(z.object({ facilityId: uuid, code: Code, name: z.string().trim().min(1).max(100), start: hhmm, end: hhmm, breakMinutes: z.number().int().min(0).max(240).default(0), graceMinutes: z.number().int().min(0).max(120).default(10) }), request.body);
      authorize(principalOf(request), 'hr.manage', body.facilityId);
      return reply.status(201).send(await createShift(db, callerOf(request), body, idempotencyKey(request)));
    });
    r.get('/v1/hr/roster', async (request) => {
      const q = parse(z.object({ facilityId: uuid, from: isoDate, to: isoDate }), request.query);
      authorize(principalOf(request), 'hr.read', q.facilityId);
      return { items: await roster(db, callerOf(request), q) };
    });
    r.put('/v1/hr/roster', async (request) => {
      const body = parse(z.object({ facilityId: uuid, entries: z.array(z.object({ staffId: uuid, onDate: isoDate, shiftId: uuid.nullable(), weekOff: z.boolean().optional() })).min(1).max(500) }), request.body);
      authorize(principalOf(request), 'hr.manage', body.facilityId);
      return setRoster(db, callerOf(request), body, optionalIdempotencyKey(request));
    });
    r.get('/v1/hr/attendance', async (request) => {
      const q = parse(z.object({ facilityId: uuid, date: isoDate }), request.query);
      authorize(principalOf(request), 'hr.read', q.facilityId);
      return { items: await attendanceOnDay(db, callerOf(request), q) };
    });
    r.get('/v1/hr/employees/:staffId/attendance', async (request) => {
      const { staffId } = parse(z.object({ staffId: uuid }), request.params);
      const { month } = parse(z.object({ month: Month }), request.query);
      await atEmployee(request, staffId, 'hr.read');
      return attendanceMonth(db, callerOf(request), { staffId, month });
    });
    r.post('/v1/hr/employees/:staffId/punches', async (request, reply) => {
      const { staffId } = parse(z.object({ staffId: uuid }), request.params);
      const body = parse(z.object({ direction: z.enum(['in', 'out']), at: z.iso.datetime({ offset: true }), note: Reason }), request.body);
      await atEmployee(request, staffId, 'attendance.manage');
      return reply.status(201).send(await punch(db, callerOf(request), { staffId, ...body, source: 'manager' }, optionalIdempotencyKey(request)));
    });
    r.post('/v1/hr/attendance/compute', async (request) => {
      const body = parse(z.object({ facilityId: uuid, from: isoDate, to: isoDate }), request.body);
      authorize(principalOf(request), 'attendance.manage', body.facilityId);
      return computeAttendance(db, callerOf(request), body, optionalIdempotencyKey(request));
    });
    r.post('/v1/hr/regularisations/:regularisationId/decision', async (request) => {
      const { regularisationId } = parse(z.object({ regularisationId: uuid }), request.params);
      const body = parse(z.object({ decision: z.enum(['approved', 'rejected']), note: z.string().trim().max(500).optional(), version: Version }), request.body);
      await at(request, staffFacilityOf(db, callerOf(request), 'regularisation', regularisationId), 'regularisation request', 'attendance.manage');
      return decideRegularisation(db, callerOf(request), { regularisationId, ...body }, optionalIdempotencyKey(request));
    });

    // ---- leave -----------------------------------------------------------------------------------------
    r.get('/v1/hr/leave-types', async (request) => {
      authorize(principalOf(request), 'leave.request');
      return { items: await listLeaveTypes(db, callerOf(request)) };
    });
    r.post('/v1/hr/leave-types', async (request, reply) => {
      const body = parse(z.object({ code: Code, name: z.string().trim().min(1).max(100), isPaid: z.boolean(), annualQuotaDays: z.number().min(0).max(365).default(0), carryForwardMax: z.number().min(0).max(365).default(0), allowNegative: z.boolean().default(false) }), request.body);
      authorize(principalOf(request), 'hr.manage', null);
      return reply.status(201).send(await createLeaveType(db, callerOf(request), body, idempotencyKey(request)));
    });
    r.post('/v1/hr/employees/:staffId/leave-grants', async (request, reply) => {
      const { staffId } = parse(z.object({ staffId: uuid }), request.params);
      const body = parse(z.object({ leaveTypeId: uuid, days: Days.refine((d) => d !== 0), effectiveOn: isoDate, note: Reason }), request.body);
      await atEmployee(request, staffId, 'hr.manage');
      return reply.status(201).send(await grantLeave(db, callerOf(request), { staffId, ...body }, idempotencyKey(request)));
    });
    r.get('/v1/hr/employees/:staffId/leave', async (request) => {
      const { staffId } = parse(z.object({ staffId: uuid }), request.params);
      await atEmployee(request, staffId, 'hr.read');
      return { balances: await leaveBalances(db, callerOf(request), staffId), requests: await listLeaveRequests(db, callerOf(request), { staffId, limit: 50 }) };
    });
    r.get('/v1/hr/leave-requests', async (request) => {
      const q = parse(z.object({ facilityId: uuid, status: z.enum(['requested', 'approved', 'rejected', 'cancelled']).optional(), limit: Limit }), request.query);
      authorize(principalOf(request), 'leave.approve', q.facilityId);
      return { items: await listLeaveRequests(db, callerOf(request), q) };
    });
    r.post('/v1/hr/leave-requests/:leaveRequestId/decision', async (request) => {
      const { leaveRequestId } = parse(z.object({ leaveRequestId: uuid }), request.params);
      const body = parse(z.object({ decision: z.enum(['approved', 'rejected']), note: z.string().trim().max(500).optional(), version: Version }), request.body);
      await at(request, staffFacilityOf(db, callerOf(request), 'leave', leaveRequestId), 'leave request', 'leave.approve');
      return decideLeave(db, callerOf(request), { leaveRequestId, ...body }, optionalIdempotencyKey(request));
    });
    r.post('/v1/hr/leave-requests/:leaveRequestId/cancel', async (request) => {
      const { leaveRequestId } = parse(z.object({ leaveRequestId: uuid }), request.params);
      const { version } = parse(z.object({ version: Version }), request.body);
      const facilityId = await at(request, staffFacilityOf(db, callerOf(request), 'leave', leaveRequestId), 'leave request', 'leave.approve');
      return cancelLeave(db, callerOf(request), { leaveRequestId, version, canApprove: can(principalOf(request), 'leave.approve', facilityId) }, optionalIdempotencyKey(request));
    });

    // ---- payroll ---------------------------------------------------------------------------------------
    r.put('/v1/hr/payroll-settings', async (request) => {
      const body = parse(z.object({ pfEmployeeRateBp: z.number().int().min(0).max(10000), pfWageCeilingMinor: Minor, esiEmployeeRateBp: z.number().int().min(0).max(10000), esiGrossCeilingMinor: Minor }), request.body);
      authorize(principalOf(request), 'payroll.manage', null);
      return savePayrollSettings(db, callerOf(request), body, optionalIdempotencyKey(request));
    });
    r.put('/v1/hr/professional-tax/:stateCode', async (request) => {
      const { stateCode } = parse(z.object({ stateCode: z.string().regex(/^[0-9]{2}$/) }), request.params);
      const body = parse(z.object({ slabs: z.array(z.object({ minGrossMinor: Minor, maxGrossMinor: Minor.nullable(), amountMinor: Minor })).max(20) }), request.body);
      authorize(principalOf(request), 'payroll.manage', null);
      return setProfessionalTax(db, callerOf(request), { stateCode, ...body }, optionalIdempotencyKey(request));
    });
    r.get('/v1/hr/salary-components', async (request) => {
      authorize(principalOf(request), 'payroll.read');
      return { items: await listSalaryComponents(db, callerOf(request)) };
    });
    r.post('/v1/hr/salary-components', async (request, reply) => {
      const body = parse(z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{1,20}$/), name: z.string().trim().min(1).max(100), kind: z.enum(['earning', 'deduction']), calc: z.enum(['fixed', 'percent_of_basic']), isBasic: z.boolean().default(false), prorate: z.boolean().default(true), displayOrder: z.number().int().min(0).max(999).default(100) }), request.body);
      authorize(principalOf(request), 'payroll.manage', null);
      return reply.status(201).send(await createSalaryComponent(db, callerOf(request), body, idempotencyKey(request)));
    });
    r.post('/v1/hr/employees/:staffId/salary', async (request, reply) => {
      const { staffId } = parse(z.object({ staffId: uuid }), request.params);
      const body = parse(z.object({ effectiveFrom: Month, note: z.string().trim().max(300).optional(), lines: z.array(z.object({ salaryComponentId: uuid, amountMinor: Minor.optional(), percentBp: z.number().int().min(0).max(100000).optional() })).min(1).max(30) }), request.body);
      await atEmployee(request, staffId, 'payroll.manage');
      return reply.status(201).send(await setSalaryStructure(db, callerOf(request), { staffId, ...body }, idempotencyKey(request)));
    });
    r.get('/v1/hr/payroll-runs', async (request) => {
      const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
      authorize(principalOf(request), 'payroll.read', facilityId);
      return { items: await listPayrollRuns(db, callerOf(request), facilityId) };
    });
    r.post('/v1/hr/payroll-runs', async (request, reply) => {
      const body = parse(z.object({ facilityId: uuid, periodMonth: Month }), request.body);
      authorize(principalOf(request), 'payroll.manage', body.facilityId);
      return reply.status(201).send(await createPayrollRun(db, callerOf(request), body, idempotencyKey(request)));
    });
    r.get('/v1/hr/payroll-runs/:payrollRunId', async (request) => {
      const { payrollRunId } = parse(z.object({ payrollRunId: uuid }), request.params);
      await at(request, hrRecordFacility(db, callerOf(request), 'hr.payroll_run', payrollRunId), 'payroll run', 'payroll.read');
      return getPayrollRun(db, callerOf(request), payrollRunId);
    });
    r.post('/v1/hr/payroll-runs/:payrollRunId/compute', async (request) => {
      const { payrollRunId } = parse(z.object({ payrollRunId: uuid }), request.params);
      const body = parse(z.object({ version: Version, tds: z.record(uuid, Minor).optional() }), request.body);
      await at(request, hrRecordFacility(db, callerOf(request), 'hr.payroll_run', payrollRunId), 'payroll run', 'payroll.manage');
      return computePayroll(db, callerOf(request), { payrollRunId, ...body }, optionalIdempotencyKey(request));
    });
    r.post('/v1/hr/payroll-runs/:payrollRunId/:step', async (request) => {
      const { payrollRunId, step } = parse(z.object({ payrollRunId: uuid, step: z.enum(['approve', 'mark-paid', 'lock']) }), request.params);
      const body = parse(z.object({ version: Version, paymentRefs: z.record(uuid, z.string().trim().min(1).max(100)).optional() }), request.body);
      await at(request, hrRecordFacility(db, callerOf(request), 'hr.payroll_run', payrollRunId), 'payroll run', 'payroll.approve');
      const to = ({ approve: 'approved', 'mark-paid': 'paid', lock: 'locked' } as const)[step];
      return advancePayroll(db, callerOf(request), { payrollRunId, to, ...body }, optionalIdempotencyKey(request));
    });
    r.get('/v1/hr/payslips/:payslipId', async (request) => {
      const { payslipId } = parse(z.object({ payslipId: uuid }), request.params);
      await at(request, staffFacilityOf(db, callerOf(request), 'payslip', payslipId), 'payslip', 'payroll.read');
      return getPayslip(db, callerOf(request), payslipId);
    });

    // ---- self-service (always the signed-in person) --------------------------------------------------
    const me = (request: FastifyRequest) => principalOf(request).staffId;
    r.post('/v1/me/attendance/punch', async (request, reply) => {
      const body = parse(z.object({ direction: z.enum(['in', 'out']) }), request.body);
      authorize(principalOf(request), 'attendance.self');
      return reply.status(201).send(await punch(db, callerOf(request), { staffId: me(request), direction: body.direction, source: 'self' }, optionalIdempotencyKey(request)));
    });
    r.get('/v1/me/attendance', async (request) => {
      const { month } = parse(z.object({ month: Month }), request.query);
      authorize(principalOf(request), 'attendance.self');
      return attendanceMonth(db, callerOf(request), { staffId: me(request), month });
    });
    r.post('/v1/me/regularisations', async (request, reply) => {
      const body = parse(z.object({ onDate: isoDate, requestedStatus: z.enum(['present', 'half_day']), reason: Reason }), request.body);
      authorize(principalOf(request), 'attendance.self');
      return reply.status(201).send(await requestRegularisation(db, callerOf(request), body, idempotencyKey(request)));
    });
    r.get('/v1/me/leave', async (request) => {
      authorize(principalOf(request), 'leave.request');
      return { balances: await leaveBalances(db, callerOf(request), me(request)), requests: await listLeaveRequests(db, callerOf(request), { staffId: me(request), limit: 50 }) };
    });
    r.post('/v1/me/leave-requests', async (request, reply) => {
      const body = parse(z.object({ leaveTypeId: uuid, startsOn: isoDate, endsOn: isoDate, halfDay: z.enum(['none', 'first_half', 'second_half']).optional(), reason: Reason }), request.body);
      authorize(principalOf(request), 'leave.request');
      return reply.status(201).send(await requestLeave(db, callerOf(request), body, idempotencyKey(request)));
    });
    r.post('/v1/me/leave-requests/:leaveRequestId/cancel', async (request) => {
      const { leaveRequestId } = parse(z.object({ leaveRequestId: uuid }), request.params);
      const { version } = parse(z.object({ version: Version }), request.body);
      authorize(principalOf(request), 'leave.request');
      return cancelLeave(db, callerOf(request), { leaveRequestId, version, canApprove: false }, optionalIdempotencyKey(request));
    });
    r.get('/v1/me/payslips', async (request) => {
      authorize(principalOf(request), 'leave.request');
      return { items: await myPayslips(db, callerOf(request), me(request)) };
    });
    r.get('/v1/me/payslips/:payslipId', async (request) => {
      const { payslipId } = parse(z.object({ payslipId: uuid }), request.params);
      authorize(principalOf(request), 'leave.request');
      return getPayslip(db, callerOf(request), payslipId, me(request));
    });
  });
}
