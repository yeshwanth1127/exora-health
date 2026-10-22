// Payroll: salary components (earnings and deductions, fixed or a percent of basic), each person's salary
// structure versioned from a month, and a monthly run per clinic: compute (attendance → paid days →
// prorated earnings, PF/ESI/professional tax per the clinic's settings, TDS as entered) → approve → mark
// paid → lock (which freezes the month's attendance). Computing again before approval rebuilds payslips
// and keeps the TDS entered.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, forbidden, invalid, notFound, pgCode, preconditionFailed, runCommand, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { recomputeRange } from './attendance.ts';

const roundHalfUp = (v: number) => Math.floor(v + 0.5);
const monthEnd = (month: string) => {
  const d = new Date(`${month}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
};

export async function savePayrollSettings(
  db: Kysely<DB>, caller: Caller, input: { pfEmployeeRateBp: number; pfWageCeilingMinor: number; esiEmployeeRateBp: number; esiGrossCeilingMinor: number }, idempotencyKey?: string,
) {
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.save_payroll_settings', idempotencyKey, request: input }, async (ctx) => {
    const values = { pf_employee_rate_bp: input.pfEmployeeRateBp, pf_wage_ceiling_minor: input.pfWageCeilingMinor, esi_employee_rate_bp: input.esiEmployeeRateBp, esi_gross_ceiling_minor: input.esiGrossCeilingMinor };
    const r = await ctx.tx.insertInto('hr.payroll_setting').values({ tenant_id: ctx.tenantId, ...values, created_by: ctx.actor.staffId ?? null })
      .onConflict((oc) => oc.column('tenant_id').doUpdateSet({ ...values, updated_by: ctx.actor.staffId ?? null })).returning(['id', 'version']).executeTakeFirstOrThrow();
    ctx.audit({ action: 'update', subjectType: 'hr.payroll_setting', subjectId: r.id, diff: input });
    return { version: r.version };
  });
}

/** Replaces a state's professional tax slabs (monthly gross → monthly tax). */
export async function setProfessionalTax(db: Kysely<DB>, caller: Caller, input: { stateCode: string; slabs: { minGrossMinor: number; maxGrossMinor: number | null; amountMinor: number }[] }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.set_professional_tax', idempotencyKey, request: input }, async (ctx) => {
    await ctx.tx.deleteFrom('hr.professional_tax_slab').where('state_code', '=', input.stateCode).execute();
    try {
      if (input.slabs.length) {
        await ctx.tx.insertInto('hr.professional_tax_slab').values(input.slabs.map((s) => ({
          tenant_id: ctx.tenantId, state_code: input.stateCode, min_gross_minor: s.minGrossMinor, max_gross_minor: s.maxGrossMinor, amount_minor: s.amountMinor, created_by: ctx.actor.staffId ?? null,
        }))).execute();
      }
    } catch (err) {
      if (pgCode(err) === '23P01') throw invalid('the slabs overlap', { reason: 'slab_overlap' });
      throw err;
    }
    ctx.audit({ action: 'update', subjectType: 'hr.professional_tax_slab', diff: input });
    return { stateCode: input.stateCode, slabs: input.slabs.length };
  });
}

export async function createSalaryComponent(
  db: Kysely<DB>, caller: Caller, input: { code: string; name: string; kind: 'earning' | 'deduction'; calc: 'fixed' | 'percent_of_basic'; isBasic: boolean; prorate: boolean; displayOrder: number }, idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.create_salary_component', idempotencyKey, request: input }, async (ctx) => {
    try {
      const c = await ctx.tx.insertInto('hr.salary_component').values({
        tenant_id: ctx.tenantId, code: input.code, name: input.name, kind: input.kind, calc: input.calc, is_basic: input.isBasic, prorate: input.prorate,
        display_order: input.displayOrder, created_by: ctx.actor.staffId ?? null,
      }).returning(['id', 'version']).executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'hr.salary_component', subjectId: c.id, diff: input });
      return { salaryComponentId: c.id, version: c.version };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('that code (or a basic component) already exists', { reason: 'duplicate_component' });
      throw err;
    }
  });
}

/** A person's salary from a month on (a new version; earlier months keep theirs). */
export async function setSalaryStructure(
  db: Kysely<DB>, caller: Caller, input: { staffId: string; effectiveFrom: string; note?: string | undefined; lines: { salaryComponentId: string; amountMinor?: number | undefined; percentBp?: number | undefined }[] },
  idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.set_salary_structure', idempotencyKey, request: input }, async (ctx) => {
    if (!input.effectiveFrom.endsWith('-01')) throw invalid('a salary starts on the first of a month', { reason: 'not_month_start' });
    const profile = await ctx.tx.selectFrom('hr.employee_profile').select('id').where('staff_id', '=', input.staffId).executeTakeFirst();
    if (!profile) throw preconditionFailed('create the employment profile first', { reason: 'profile_required' });
    const comps = await ctx.tx.selectFrom('hr.salary_component').selectAll().where('id', 'in', input.lines.map((l) => l.salaryComponentId)).execute();
    if (comps.length !== new Set(input.lines.map((l) => l.salaryComponentId)).size) throw invalid('unknown salary component', { reason: 'component_unknown' });
    if (!comps.some((c) => c.is_basic)) throw invalid('a salary needs its basic component', { reason: 'basic_required' });
    for (const l of input.lines) {
      const c = comps.find((x) => x.id === l.salaryComponentId)!;
      if ((c.calc === 'fixed') !== (l.amountMinor !== undefined) || (c.calc === 'percent_of_basic') !== (l.percentBp !== undefined)) {
        throw invalid(`${c.name} takes ${c.calc === 'fixed' ? 'a monthly amount' : 'a percent of basic'}`, { reason: 'component_value', componentId: c.id });
      }
    }
    const locked = await ctx.tx.selectFrom('hr.payroll_run as r').innerJoin('hr.payslip as p', 'p.payroll_run_id', 'r.id').select('r.id')
      .where('p.staff_id', '=', input.staffId).where('r.period_month', '>=', input.effectiveFrom).where('r.status', 'not in', ['draft', 'computed']).executeTakeFirst();
    if (locked) throw preconditionFailed('a payroll from that month on is already approved', { reason: 'payroll_approved' });
    try {
      const s = await ctx.tx.insertInto('hr.salary_structure').values({ tenant_id: ctx.tenantId, staff_id: input.staffId, effective_from: input.effectiveFrom, note: input.note ?? null, created_by: ctx.actor.staffId ?? null })
        .returning('id').executeTakeFirstOrThrow();
      await ctx.tx.insertInto('hr.salary_structure_line').values(input.lines.map((l) => ({
        tenant_id: ctx.tenantId, salary_structure_id: s.id, salary_component_id: l.salaryComponentId, amount_minor: l.amountMinor ?? null, percent_bp: l.percentBp ?? null,
      }))).execute();
      ctx.audit({ action: 'create', subjectType: 'hr.salary_structure', subjectId: s.id, diff: { staffId: input.staffId, effectiveFrom: input.effectiveFrom, lines: input.lines.length } });
      return { salaryStructureId: s.id };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('a salary already starts that month', { reason: 'structure_exists' });
      throw err;
    }
  });
}

export async function createPayrollRun(db: Kysely<DB>, caller: Caller, input: { facilityId: string; periodMonth: string }, idempotencyKey: string) {
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.create_payroll_run', idempotencyKey, request: input }, async (ctx) => {
    if (!input.periodMonth.endsWith('-01')) throw invalid('give the first day of the month', { reason: 'not_month_start' });
    try {
      const r = await ctx.tx.insertInto('hr.payroll_run').values({ tenant_id: ctx.tenantId, facility_id: input.facilityId, period_month: input.periodMonth, created_by: ctx.actor.staffId ?? null })
        .returning(['id', 'version']).executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'hr.payroll_run', subjectId: r.id, diff: input });
      return { payrollRunId: r.id, status: 'draft' as const, version: r.version };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('that month already has a payroll at this clinic', { reason: 'run_exists' });
      throw err;
    }
  });
}

async function lockRun(tx: Transaction<DB>, id: string, version: number) {
  const r = await tx.selectFrom('hr.payroll_run').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
  if (!r) throw notFound('payroll run', { payrollRunId: id });
  if (r.version !== version) throw conflict('this payroll was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: r.version });
  return r;
}

/** Computes (or recomputes) every payslip of a draft/computed run. `tds` sets a person's TDS for the month. */
export async function computePayroll(db: Kysely<DB>, caller: Caller, input: { payrollRunId: string; version: number; tds?: Record<string, number> | undefined }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.compute_payroll', idempotencyKey, request: input }, async (ctx) => {
    const run = await lockRun(ctx.tx, input.payrollRunId, input.version);
    if (run.status !== 'draft' && run.status !== 'computed') throw preconditionFailed(`payroll is ${run.status}`, { reason: 'not_editable' });
    const from = String(run.period_month), to = monthEnd(from);
    const previousTds = new Map((await ctx.tx.selectFrom('hr.payslip').select(['staff_id', 'tds_minor']).where('payroll_run_id', '=', run.id).execute()).map((p) => [p.staff_id, p.tds_minor]));
    await ctx.tx.deleteFrom('hr.payslip').where('payroll_run_id', '=', run.id).execute();
    await recomputeRange(ctx, run.facility_id, from, to, now);
    const settings = (await ctx.tx.selectFrom('hr.payroll_setting').selectAll().executeTakeFirst()) ?? { pf_employee_rate_bp: 1200, pf_wage_ceiling_minor: 1_500_000, esi_employee_rate_bp: 75, esi_gross_ceiling_minor: 2_100_000 };
    const people = await ctx.tx.selectFrom('hr.employee_profile as p').leftJoin('hr.employee_statutory as s', 's.staff_id', 'p.staff_id')
      .select(['p.staff_id', 'p.date_of_joining', 'p.date_of_exit', 's.pf_applicable', 's.esi_applicable', 's.pt_state_code', 's.bank_account_no', 's.bank_ifsc'])
      .where('p.facility_id', '=', run.facility_id).where('p.date_of_joining', '<=', to).where((eb) => eb.or([eb('p.date_of_exit', 'is', null), eb('p.date_of_exit', '>=', from)])).execute();
    const daysInMonth = Number(to.slice(8, 10));
    let gross = 0, deductions = 0, net = 0, slips = 0;
    const skipped: { staffId: string; reason: string }[] = [];
    for (const p of people) {
      const structure = await ctx.tx.selectFrom('hr.salary_structure').select('id').where('staff_id', '=', p.staff_id).where('effective_from', '<=', from).orderBy('effective_from', 'desc').executeTakeFirst();
      if (!structure) { skipped.push({ staffId: p.staff_id, reason: 'no_salary' }); continue; }
      const lines = await ctx.tx.selectFrom('hr.salary_structure_line as l').innerJoin('hr.salary_component as c', 'c.id', 'l.salary_component_id')
        .select(['c.id', 'c.code', 'c.name', 'c.kind', 'c.calc', 'c.is_basic', 'c.prorate', 'c.display_order', 'l.amount_minor', 'l.percent_bp'])
        .where('l.salary_structure_id', '=', structure.id).orderBy('c.display_order').execute();
      // Paid days: days employed this month, less loss of pay from attendance.
      const { rows: [att] } = await sql<{ paid: string; recorded: number }>`
        SELECT coalesce(sum(CASE status WHEN 'present' THEN 1 WHEN 'half_day' THEN 0.5 WHEN 'paid_leave' THEN 1 WHEN 'holiday' THEN 1 WHEN 'week_off' THEN 1 ELSE 0 END), 0) AS paid,
               count(*)::int AS recorded
        FROM hr.attendance_day WHERE staff_id = ${p.staff_id} AND on_date BETWEEN ${from}::date AND ${to}::date`.execute(ctx.tx);
      const employedFrom = String(p.date_of_joining) > from ? String(p.date_of_joining) : from;
      const employedTo = p.date_of_exit && String(p.date_of_exit) < to ? String(p.date_of_exit) : to;
      const employed = (Date.parse(employedTo) - Date.parse(employedFrom)) / 86_400_000 + 1;
      // Days not yet recorded (a future part of the month) count as paid; recorded ones as attendance says.
      const paidDays = Math.min(employed, Number(att!.paid) + Math.max(0, employed - att!.recorded));
      const factor = paidDays / daysInMonth;
      const basicFull = lines.find((l) => l.is_basic)?.amount_minor ?? 0;
      const basic = roundHalfUp(Number(basicFull) * factor);
      const out: { componentId: string | null; code: string; name: string; kind: 'earning' | 'deduction'; amount: number; order: number }[] = [];
      for (const l of lines) {
        const full = l.calc === 'fixed' ? Number(l.amount_minor) : roundHalfUp((Number(basicFull) * Number(l.percent_bp)) / 10_000);
        const amount = l.is_basic ? basic : l.prorate ? roundHalfUp(full * factor) : full;
        out.push({ componentId: l.id, code: l.code, name: l.name, kind: l.kind as 'earning' | 'deduction', amount, order: l.display_order });
      }
      const grossMinor = out.filter((o) => o.kind === 'earning').reduce((s, o) => s + o.amount, 0);
      const fullGross = lines.filter((l) => l.kind === 'earning').reduce((s, l) => s + (l.calc === 'fixed' ? Number(l.amount_minor) : roundHalfUp((Number(basicFull) * Number(l.percent_bp)) / 10_000)), 0);
      if (p.pf_applicable) out.push({ componentId: null, code: 'PF', name: 'Provident fund (employee)', kind: 'deduction', amount: roundHalfUp((Math.min(basic, Number(settings.pf_wage_ceiling_minor)) * settings.pf_employee_rate_bp) / 10_000), order: 900 });
      if (p.esi_applicable && fullGross <= Number(settings.esi_gross_ceiling_minor)) out.push({ componentId: null, code: 'ESI', name: 'ESI (employee)', kind: 'deduction', amount: roundHalfUp((grossMinor * settings.esi_employee_rate_bp) / 10_000), order: 910 });
      if (p.pt_state_code) {
        const { rows: [pt] } = await sql<{ amount_minor: number }>`
          SELECT amount_minor FROM hr.professional_tax_slab WHERE state_code = ${p.pt_state_code} AND min_gross_minor <= ${grossMinor}
            AND (max_gross_minor IS NULL OR max_gross_minor > ${grossMinor}) LIMIT 1`.execute(ctx.tx);
        if (pt && Number(pt.amount_minor) > 0) out.push({ componentId: null, code: 'PT', name: 'Professional tax', kind: 'deduction', amount: Number(pt.amount_minor), order: 920 });
      }
      const tds = input.tds?.[p.staff_id] ?? previousTds.get(p.staff_id) ?? 0;
      if (tds > 0) out.push({ componentId: null, code: 'TDS', name: 'Income tax (TDS)', kind: 'deduction', amount: tds, order: 930 });
      const deductionMinor = Math.min(grossMinor, out.filter((o) => o.kind === 'deduction').reduce((s, o) => s + o.amount, 0));
      const slip = await ctx.tx.insertInto('hr.payslip').values({
        tenant_id: ctx.tenantId, payroll_run_id: run.id, staff_id: p.staff_id, days_in_month: daysInMonth, paid_days: paidDays, lop_days: daysInMonth - paidDays,  // days not paid, including those before joining or after leaving
        gross_minor: grossMinor, deductions_minor: deductionMinor, tds_minor: tds, net_minor: grossMinor - deductionMinor,
        bank_account_last4: p.bank_account_no ? p.bank_account_no.slice(-4) : null, bank_ifsc: p.bank_ifsc, created_by: ctx.actor.staffId ?? null,
      }).returning('id').executeTakeFirstOrThrow();
      await ctx.tx.insertInto('hr.payslip_line').values(out.map((o) => ({
        tenant_id: ctx.tenantId, payslip_id: slip.id, salary_component_id: o.componentId, code: o.code, name: o.name, kind: o.kind, amount_minor: o.amount, display_order: o.order,
      }))).execute();
      gross += grossMinor; deductions += deductionMinor; net += grossMinor - deductionMinor; slips++;
    }
    const { version } = await ctx.tx.updateTable('hr.payroll_run').set({ status: 'computed', computed_at: now, gross_minor: gross, deductions_minor: deductions, net_minor: net, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', run.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'update', subjectType: 'hr.payroll_run', subjectId: run.id, diff: { computed: slips, skipped: skipped.length, netMinor: net } });
    return { payrollRunId: run.id, status: 'computed' as const, version, payslips: slips, skipped, grossMinor: gross, deductionsMinor: deductions, netMinor: net };
  });
}

/** approve → paid (with bank references) → locked (attendance frozen). Approval is by someone else than the person who computed. */
export async function advancePayroll(
  db: Kysely<DB>, caller: Caller, input: { payrollRunId: string; to: 'approved' | 'paid' | 'locked'; version: number; paymentRefs?: Record<string, string> | undefined }, idempotencyKey?: string,
) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'hr', name: 'hr.advance_payroll', idempotencyKey, request: input }, async (ctx) => {
    const run = await lockRun(ctx.tx, input.payrollRunId, input.version);
    const from: Record<typeof input.to, string> = { approved: 'computed', paid: 'approved', locked: 'paid' };
    if (run.status !== from[input.to]) throw preconditionFailed(`payroll is ${run.status}`, { reason: 'invalid_transition', status: run.status });
    if (input.to === 'approved' && run.updated_by === ctx.actor.staffId) throw forbidden('someone other than who computed it approves the payroll', { reason: 'own_computation' });
    if (input.to === 'paid' && input.paymentRefs) {
      for (const [staffId, ref] of Object.entries(input.paymentRefs)) {
        await ctx.tx.updateTable('hr.payslip').set({ payment_ref: ref, updated_by: ctx.actor.staffId ?? null }).where('payroll_run_id', '=', run.id).where('staff_id', '=', staffId).execute();
      }
    }
    const set = input.to === 'approved' ? { approved_by: ctx.actor.staffId!, approved_at: now } : input.to === 'paid' ? { paid_at: now } : { locked_at: now };
    const { version } = await ctx.tx.updateTable('hr.payroll_run').set({ status: input.to, ...set, updated_by: ctx.actor.staffId ?? null }).where('id', '=', run.id).returning('version').executeTakeFirstOrThrow();
    if (input.to === 'locked') {
      const from2 = String(run.period_month), to2 = monthEnd(from2);
      await sql`UPDATE hr.attendance_day SET is_locked = true WHERE facility_id = ${run.facility_id} AND on_date BETWEEN ${from2}::date AND ${to2}::date
                AND staff_id IN (SELECT staff_id FROM hr.payslip WHERE payroll_run_id = ${run.id})`.execute(ctx.tx);
    }
    ctx.audit({ action: 'status_change', subjectType: 'hr.payroll_run', subjectId: run.id, diff: { status: [run.status, input.to] } });
    if (input.to === 'approved') ctx.emit({ eventType: 'payroll.approved', aggregateType: 'hr.payroll_run', aggregateId: run.id, payload: { payrollRunId: run.id, periodMonth: String(run.period_month) } });
    return { payrollRunId: run.id, status: input.to, version };
  });
}

export async function getPayrollRun(db: Kysely<DB>, caller: Caller, payrollRunId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const run = await tx.selectFrom('hr.payroll_run').selectAll().where('id', '=', payrollRunId).executeTakeFirst();
    if (!run) throw notFound('payroll run', { payrollRunId });
    const { rows: slips } = await sql<Record<string, unknown>>`
      SELECT p.id AS "payslipId", p.staff_id AS "staffId", s.display_name AS "staffName", p.paid_days::float AS "paidDays", p.lop_days::float AS "lopDays",
             p.gross_minor AS "grossMinor", p.deductions_minor AS "deductionsMinor", p.net_minor AS "netMinor", p.tds_minor AS "tdsMinor", p.bank_account_last4 AS "bankAccountLast4", p.payment_ref AS "paymentRef"
      FROM hr.payslip p JOIN platform.staff s ON s.id = p.staff_id WHERE p.payroll_run_id = ${run.id} ORDER BY s.display_name`.execute(tx);
    return {
      payrollRunId: run.id, facilityId: run.facility_id, periodMonth: String(run.period_month), status: run.status, version: run.version, computedAt: run.computed_at,
      approvedAt: run.approved_at, paidAt: run.paid_at, lockedAt: run.locked_at, grossMinor: run.gross_minor, deductionsMinor: run.deductions_minor, netMinor: run.net_minor, payslips: slips,
    };
  });
}

/** One payslip with its lines. `ownStaffId` restricts to the caller's own, approved-or-later payslips. */
export async function getPayslip(db: Kysely<DB>, caller: Caller, payslipId: string, ownStaffId?: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const p = await tx.selectFrom('hr.payslip as p').innerJoin('hr.payroll_run as r', 'r.id', 'p.payroll_run_id').innerJoin('platform.staff as s', 's.id', 'p.staff_id')
      .leftJoin('hr.employee_profile as e', 'e.staff_id', 'p.staff_id')
      .select(['p.id', 'p.staff_id', 's.display_name', 's.employee_no', 'e.designation', 'r.period_month', 'r.status as runStatus', 'r.facility_id', 'p.days_in_month', 'p.paid_days', 'p.lop_days',
        'p.gross_minor', 'p.deductions_minor', 'p.net_minor', 'p.bank_account_last4', 'p.bank_ifsc', 'p.payment_ref'])
      .where('p.id', '=', payslipId).executeTakeFirst();
    if (!p || (ownStaffId && (p.staff_id !== ownStaffId || ['draft', 'computed'].includes(p.runStatus)))) throw notFound('payslip', { payslipId });
    const lines = await tx.selectFrom('hr.payslip_line').select(['code', 'name', 'kind', 'amount_minor as amountMinor']).where('payslip_id', '=', p.id).orderBy('kind', 'desc').orderBy('display_order').execute();
    return {
      payslipId: p.id, staffId: p.staff_id, name: p.display_name, employeeNo: p.employee_no, designation: p.designation, periodMonth: String(p.period_month), runStatus: p.runStatus,
      facilityId: p.facility_id, daysInMonth: p.days_in_month, paidDays: Number(p.paid_days), lopDays: Number(p.lop_days), grossMinor: p.gross_minor, deductionsMinor: p.deductions_minor,
      netMinor: p.net_minor, bank: p.bank_account_last4 ? { accountLast4: p.bank_account_last4, ifsc: p.bank_ifsc } : null, paymentRef: p.payment_ref,
      earnings: lines.filter((l) => l.kind === 'earning'), deductions: lines.filter((l) => l.kind === 'deduction'),
    };
  });
}

export async function myPayslips(db: Kysely<DB>, caller: Caller, staffId: string) {
  return runQuery(db, caller.tenantId, async (tx) => tx.selectFrom('hr.payslip as p').innerJoin('hr.payroll_run as r', 'r.id', 'p.payroll_run_id')
    .select(['p.id as payslipId', 'r.period_month as periodMonth', 'p.net_minor as netMinor', 'r.status']).where('p.staff_id', '=', staffId).where('r.status', 'in', ['approved', 'paid', 'locked'])
    .orderBy('r.period_month', 'desc').execute());
}

