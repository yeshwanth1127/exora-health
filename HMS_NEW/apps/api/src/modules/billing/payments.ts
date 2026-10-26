// Money in and out at the counter: payments (with their allocations to bills and a numbered receipt),
// refunds, and cashier shifts. Payments are recorded, not processed — there is no gateway. Cash is only
// taken inside the cashier's open shift, and the Income Tax Act s.269ST limit (₹2,00,000 in cash from
// one person in a day) is refused here.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand, type CommandContext } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { nextDocumentNo, settledStatus } from './invoices.ts';
import { financialYear, localDay } from './tax.ts';

/** s.269ST: cash of ₹2,00,000 or more from one person in a day (or for one episode) is not allowed. */
export const CASH_LIMIT_MINOR = 2_00_000_00;

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'net_banking' | 'cheque' | 'wallet';

async function openShift(tx: Transaction<DB>, staffId: string, facilityId: string) {
  return tx.selectFrom('billing.cashier_shift').select('id').where('staff_id', '=', staffId).where('facility_id', '=', facilityId).where('status', '=', 'open').executeTakeFirst();
}

/** Cash already taken today at the facility from this patient (or, without a patient, this payer name). */
async function cashToday(tx: Transaction<DB>, facilityId: string, timezone: string, day: string, patientId: string | null, payerName: string) {
  const { rows: [r] } = await sql<{ total: number }>`
    SELECT coalesce(sum(amount_minor), 0)::bigint AS total FROM billing.payment
    WHERE facility_id = ${facilityId} AND method = 'cash' AND status <> 'bounced'
      AND (captured_at AT TIME ZONE ${timezone})::date = ${day}::date
      AND ${patientId ? sql`patient_id = ${patientId}` : sql`patient_id IS NULL AND lower(payer_name) = lower(${payerName})`}`.execute(tx);
  return Number(r!.total);
}

/** What a payment can still be allocated or refunded from: amount − refunds − live allocations. */
export async function unallocated(tx: Transaction<DB>, paymentId: string) {
  const { rows: [r] } = await sql<{ free: number }>`
    SELECT (p.amount_minor - p.refunded_minor - coalesce((SELECT sum(a.amount_minor) FROM billing.payment_allocation a
             WHERE a.payment_id = p.id AND a.reversed_at IS NULL), 0))::bigint AS free
    FROM billing.payment p WHERE p.id = ${paymentId}`.execute(tx);
  return Number(r?.free ?? 0);
}

/** Allocates part of a payment to issued bills of the same patient, keeping every balance non-negative. */
export async function allocate(ctx: CommandContext, payment: { id: string; patient_id: string | null; facility_id: string }, allocations: { invoiceId: string; amountMinor: number }[], now: Date) {
  let free = await unallocated(ctx.tx, payment.id);
  for (const a of allocations) {
    const inv = await ctx.tx.selectFrom('billing.invoice').selectAll().where('id', '=', a.invoiceId).forUpdate().executeTakeFirst();
    if (!inv) throw notFound('invoice', { invoiceId: a.invoiceId });
    if (inv.facility_id !== payment.facility_id || inv.patient_id !== payment.patient_id) throw invalid('the bill is not this payer’s at this clinic', { reason: 'invoice_mismatch', invoiceId: inv.id });
    if (!['issued', 'partially_paid'].includes(inv.status)) throw preconditionFailed(`bill ${inv.invoice_no ?? inv.id} is ${inv.status}`, { reason: 'invoice_not_payable', invoiceId: inv.id, status: inv.status });
    const balance = inv.net_minor - inv.paid_minor - inv.credited_minor;
    if (a.amountMinor > balance) throw invalid(`more than the ₹${(balance / 100).toFixed(2)} due on ${inv.invoice_no}`, { reason: 'exceeds_balance', invoiceId: inv.id, balanceMinor: balance });
    if (a.amountMinor > free) throw invalid('more than is left on this payment', { reason: 'exceeds_payment', unallocatedMinor: free });
    await ctx.tx.insertInto('billing.payment_allocation').values({ tenant_id: ctx.tenantId, payment_id: payment.id, invoice_id: inv.id, amount_minor: a.amountMinor, allocated_at: now, created_by: ctx.actor.staffId ?? null }).execute();
    const paid = inv.paid_minor + a.amountMinor;
    const status = settledStatus({ ...inv, paid_minor: paid });
    await ctx.tx.updateTable('billing.invoice').set({ paid_minor: paid, status, updated_by: ctx.actor.staffId ?? null }).where('id', '=', inv.id).execute();
    free -= a.amountMinor;
    if (status === 'paid') ctx.emit({ eventType: 'invoice.paid', aggregateType: 'billing.invoice', aggregateId: inv.id, payload: { invoiceId: inv.id, billingAccountId: inv.billing_account_id } });
  }
}

export interface PaymentInput {
  facilityId: string;
  patientId?: string | undefined;
  payerName?: string | undefined;
  method: PaymentMethod;
  amountMinor: number;
  referenceNo?: string | undefined;
  allocations: { invoiceId: string; amountMinor: number }[];
  /** Inpatient advance: an account id (deposits module). */
  billingAccountId?: string | undefined;
  isAdvance?: boolean | undefined;
}

/** Records a payment, allocates it, and issues its receipt — one command. */
export async function recordPayment(db: Kysely<DB>, caller: Caller, input: PaymentInput, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.record_payment', idempotencyKey, request: input }, async (ctx) => {
    return takePayment(ctx, input, now);
  });
}

/** The payment itself, in the caller's billing command (deposits reuse it). */
export async function takePayment(ctx: CommandContext, input: PaymentInput, now: Date) {
  const staffId = ctx.actor.staffId!;
  const facility = await ctx.tx.selectFrom('platform.facility').select(['timezone']).where('id', '=', input.facilityId).executeTakeFirst();
  if (!facility) throw notFound('facility', { facilityId: input.facilityId });
  let payerName = input.payerName;
  if (input.patientId) {
    const p = await ctx.tx.selectFrom('patient.patient').select(['given_name', 'family_name']).where('id', '=', input.patientId).executeTakeFirst();
    if (!p) throw notFound('patient', { patientId: input.patientId });
    payerName ??= [p.given_name, p.family_name].filter(Boolean).join(' ');
  }
  if (!payerName) throw invalid('give the payer’s name', { reason: 'payer_required' });
  if (input.method !== 'cash' && !input.referenceNo) throw invalid('give the UPI / card / cheque reference', { reason: 'reference_required' });
  let shiftId: string | null = null;
  if (input.method === 'cash') {
    shiftId = (await openShift(ctx.tx, staffId, input.facilityId))?.id ?? null;
    if (!shiftId) throw preconditionFailed('open your cashier shift before taking cash', { reason: 'no_open_shift' });
    // Serialize cash for one payer so two counters can't both pass the s.269ST check.
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`cash:${input.facilityId}:${input.patientId ?? payerName.toLowerCase()}`}, 0))`.execute(ctx.tx);
    const day = localDay(now, facility.timezone);
    const before = await cashToday(ctx.tx, input.facilityId, facility.timezone, day, input.patientId ?? null, payerName);
    if (before + input.amountMinor >= CASH_LIMIT_MINOR) {
      throw preconditionFailed('cash of ₹2,00,000 or more from one person in a day is not allowed (Income Tax Act s.269ST); take the rest by UPI, card or bank', { reason: 'cash_limit', cashTodayMinor: before });
    }
    if (input.billingAccountId) {
      // …nor for one inpatient stay.
      const { rows: [stay] } = await sql<{ total: number }>`
        SELECT coalesce(sum(amount_minor), 0)::bigint AS total FROM billing.payment
        WHERE billing_account_id = ${input.billingAccountId} AND method = 'cash' AND status <> 'bounced'`.execute(ctx.tx);
      if (Number(stay!.total) + input.amountMinor >= CASH_LIMIT_MINOR) {
        throw preconditionFailed('cash of ₹2,00,000 or more for one stay is not allowed (Income Tax Act s.269ST); take the rest by UPI, card or bank', { reason: 'cash_limit_episode', cashThisStayMinor: Number(stay!.total) });
      }
    }
  }
  const allocated = input.allocations.reduce((s, a) => s + a.amountMinor, 0);
  if (allocated > input.amountMinor) throw invalid('allocations are more than the payment', { reason: 'over_allocated' });
  const payment = await ctx.tx.insertInto('billing.payment').values({
    tenant_id: ctx.tenantId, facility_id: input.facilityId, patient_id: input.patientId ?? null, payer_name: payerName,
    billing_account_id: input.billingAccountId ?? null, is_advance: input.isAdvance ?? false,
    method: input.method, amount_minor: input.amountMinor, reference_no: input.referenceNo ?? null,
    cashier_shift_id: shiftId, received_by: staffId, captured_at: now, created_by: staffId,
  }).returning(['id', 'patient_id', 'facility_id']).executeTakeFirstOrThrow();
  await allocate(ctx, payment, input.allocations, now);
  const fy = financialYear(localDay(now, facility.timezone));
  const receiptNo = await nextDocumentNo(ctx.tx, 'receipt', 'RC', input.facilityId, fy);
  await ctx.tx.insertInto('billing.receipt').values({ tenant_id: ctx.tenantId, facility_id: input.facilityId, payment_id: payment.id, receipt_no: receiptNo, financial_year: fy, issued_at: now, created_by: staffId }).execute();
  ctx.audit({ action: 'create', subjectType: 'billing.payment', subjectId: payment.id, patientId: input.patientId ?? null, diff: { method: input.method, amountMinor: input.amountMinor, receiptNo, allocatedMinor: allocated } });
  ctx.emit({ eventType: 'payment.captured', aggregateType: 'billing.payment', aggregateId: payment.id, payload: { paymentId: payment.id, method: input.method, amountMinor: input.amountMinor, billingAccountId: input.billingAccountId ?? null } });
  return { paymentId: payment.id, receiptNo, amountMinor: input.amountMinor, unallocatedMinor: input.amountMinor - allocated };
}

/** Allocates what is left of an earlier payment (an advance, an overpayment) to issued bills. */
export async function allocatePayment(db: Kysely<DB>, caller: Caller, input: { paymentId: string; allocations: { invoiceId: string; amountMinor: number }[] }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.allocate_payment', idempotencyKey, request: input }, async (ctx) => {
    const p = await ctx.tx.selectFrom('billing.payment').select(['id', 'patient_id', 'facility_id', 'status']).where('id', '=', input.paymentId).forUpdate().executeTakeFirst();
    if (!p) throw notFound('payment', { paymentId: input.paymentId });
    if (p.status === 'bounced' || p.status === 'refunded') throw preconditionFailed(`payment is ${p.status}`, { reason: 'payment_closed' });
    await allocate(ctx, p, input.allocations, now);
    ctx.audit({ action: 'update', subjectType: 'billing.payment', subjectId: p.id, patientId: p.patient_id, diff: { allocations: input.allocations } });
    return { paymentId: p.id, unallocatedMinor: await unallocated(ctx.tx, p.id) };
  });
}

// ---- refunds -------------------------------------------------------------------------------------------

export async function requestRefund(
  db: Kysely<DB>, caller: Caller,
  input: { paymentId: string; amountMinor: number; reason: string; method: PaymentMethod; creditNoteId?: string | undefined }, idempotencyKey?: string,
) {
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.request_refund', idempotencyKey, request: input }, async (ctx) => {
    const p = await ctx.tx.selectFrom('billing.payment').selectAll().where('id', '=', input.paymentId).forUpdate().executeTakeFirst();
    if (!p) throw notFound('payment', { paymentId: input.paymentId });
    const { rows: [pending] } = await sql<{ total: number }>`
      SELECT coalesce(sum(amount_minor), 0)::bigint AS total FROM billing.refund WHERE payment_id = ${p.id} AND status IN ('requested', 'approved')`.execute(ctx.tx);
    const free = (await unallocated(ctx.tx, p.id)) - Number(pending!.total);
    if (input.amountMinor > free) throw invalid('more than can be refunded from this payment (paid bills must be credited first)', { reason: 'exceeds_refundable', refundableMinor: Math.max(free, 0) });
    const r = await ctx.tx.insertInto('billing.refund').values({
      tenant_id: ctx.tenantId, facility_id: p.facility_id, payment_id: p.id, credit_note_id: input.creditNoteId ?? null, amount_minor: input.amountMinor,
      reason: input.reason, method: input.method, requested_by: ctx.actor.staffId ?? null, created_by: ctx.actor.staffId ?? null,
    }).returning(['id', 'version']).executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'billing.refund', subjectId: r.id, patientId: p.patient_id, reason: input.reason, diff: { paymentId: p.id, amountMinor: input.amountMinor } });
    return { refundId: r.id, status: 'requested' as const, version: r.version };
  });
}

export async function decideRefund(db: Kysely<DB>, caller: Caller, input: { refundId: string; decision: 'approved' | 'rejected'; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.decide_refund', idempotencyKey, request: input }, async (ctx) => {
    const r = await ctx.tx.selectFrom('billing.refund').selectAll().where('id', '=', input.refundId).forUpdate().executeTakeFirst();
    if (!r) throw notFound('refund', { refundId: input.refundId });
    if (r.version !== input.version) throw conflict('this refund was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: r.version });
    if (r.status !== 'requested') throw preconditionFailed(`refund is ${r.status}`, { reason: 'not_requested' });
    const { version } = await ctx.tx.updateTable('billing.refund').set({ status: input.decision, decided_by: ctx.actor.staffId ?? null, decided_at: now, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', r.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'billing.refund', subjectId: r.id, diff: { status: ['requested', input.decision] } });
    return { refundId: r.id, status: input.decision, version };
  });
}

/** Pays out an approved refund (cash from the payer's open shift; other methods need a reference). */
export async function payRefund(db: Kysely<DB>, caller: Caller, input: { refundId: string; referenceNo?: string | undefined; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.pay_refund', idempotencyKey, request: input }, async (ctx) => {
    const r = await ctx.tx.selectFrom('billing.refund').selectAll().where('id', '=', input.refundId).forUpdate().executeTakeFirst();
    if (!r) throw notFound('refund', { refundId: input.refundId });
    if (r.version !== input.version) throw conflict('this refund was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: r.version });
    if (r.status !== 'approved') throw preconditionFailed(`refund is ${r.status}; it must be approved first`, { reason: 'not_approved' });
    const p = await ctx.tx.selectFrom('billing.payment').selectAll().where('id', '=', r.payment_id).forUpdate().executeTakeFirstOrThrow();
    const free = await unallocated(ctx.tx, p.id);
    if (r.amount_minor > free) throw preconditionFailed('the payment no longer has this much unallocated', { reason: 'exceeds_refundable', refundableMinor: free });
    let shiftId: string | null = null;
    if (r.method === 'cash') {
      shiftId = (await openShift(ctx.tx, ctx.actor.staffId!, r.facility_id))?.id ?? null;
      if (!shiftId) throw preconditionFailed('open your cashier shift before paying cash out', { reason: 'no_open_shift' });
    } else if (!input.referenceNo) throw invalid('give the transfer reference', { reason: 'reference_required' });
    const refunded = p.refunded_minor + r.amount_minor;
    await ctx.tx.updateTable('billing.payment').set({ refunded_minor: refunded, status: refunded === p.amount_minor ? 'refunded' : 'partially_refunded', updated_by: ctx.actor.staffId ?? null }).where('id', '=', p.id).execute();
    const { version } = await ctx.tx.updateTable('billing.refund').set({ status: 'paid', paid_at: now, paid_by: ctx.actor.staffId ?? null, cashier_shift_id: shiftId, reference_no: input.referenceNo ?? null, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', r.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'billing.refund', subjectId: r.id, patientId: p.patient_id, diff: { status: ['approved', 'paid'], amountMinor: r.amount_minor } });
    ctx.emit({ eventType: 'refund.paid', aggregateType: 'billing.refund', aggregateId: r.id, payload: { refundId: r.id, paymentId: p.id, amountMinor: r.amount_minor } });
    return { refundId: r.id, status: 'paid' as const, version };
  });
}

// ---- cashier shifts ------------------------------------------------------------------------------------

export async function openCashierShift(db: Kysely<DB>, caller: Caller, input: { facilityId: string; openingFloatMinor: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.open_shift', idempotencyKey, request: input }, async (ctx) => {
    try {
      const s = await ctx.tx.insertInto('billing.cashier_shift').values({
        tenant_id: ctx.tenantId, facility_id: input.facilityId, staff_id: ctx.actor.staffId!, opened_at: now, opening_float_minor: input.openingFloatMinor, created_by: ctx.actor.staffId ?? null,
      }).returning(['id', 'version']).executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'billing.cashier_shift', subjectId: s.id, diff: { openingFloatMinor: input.openingFloatMinor } });
      return { shiftId: s.id, status: 'open' as const, version: s.version };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('you already have an open shift at this clinic', { reason: 'shift_open' });
      throw err;
    }
  });
}

/** Cash the drawer should hold: float + cash taken − cash refunded in the shift. */
export async function expectedCash(tx: Transaction<DB>, shiftId: string) {
  const { rows: [r] } = await sql<{ expected: number }>`
    SELECT (s.opening_float_minor
            + coalesce((SELECT sum(amount_minor) FROM billing.payment WHERE cashier_shift_id = s.id AND method = 'cash' AND status <> 'bounced'), 0)
            - coalesce((SELECT sum(amount_minor) FROM billing.refund WHERE cashier_shift_id = s.id AND method = 'cash' AND status = 'paid'), 0))::bigint AS expected
    FROM billing.cashier_shift s WHERE s.id = ${shiftId}`.execute(tx);
  return Number(r!.expected);
}

export async function closeCashierShift(db: Kysely<DB>, caller: Caller, input: { shiftId: string; countedCashMinor: number; note?: string | undefined; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.close_shift', idempotencyKey, request: input }, async (ctx) => {
    const s = await ctx.tx.selectFrom('billing.cashier_shift').selectAll().where('id', '=', input.shiftId).forUpdate().executeTakeFirst();
    if (!s) throw notFound('cashier shift', { shiftId: input.shiftId });
    if (s.staff_id !== ctx.actor.staffId) throw preconditionFailed('only the cashier who opened a shift closes it', { reason: 'not_own_shift' });
    if (s.version !== input.version) throw conflict('this shift was changed; reload and try again', { reason: 'stale_version', currentVersion: s.version });
    if (s.status !== 'open') throw preconditionFailed(`shift is ${s.status}`, { reason: 'not_open' });
    const expected = await expectedCash(ctx.tx, s.id);
    const { version } = await ctx.tx.updateTable('billing.cashier_shift').set({
      status: 'closed', closed_at: now, expected_cash_minor: expected, counted_cash_minor: input.countedCashMinor, close_note: input.note ?? null, updated_by: ctx.actor.staffId ?? null,
    }).where('id', '=', s.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'billing.cashier_shift', subjectId: s.id, reason: input.note, diff: { status: ['open', 'closed'], expectedCashMinor: expected, countedCashMinor: input.countedCashMinor } });
    return { shiftId: s.id, status: 'closed' as const, expectedCashMinor: expected, countedCashMinor: input.countedCashMinor, varianceMinor: input.countedCashMinor - expected, version };
  });
}

export async function verifyCashierShift(db: Kysely<DB>, caller: Caller, input: { shiftId: string; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.verify_shift', idempotencyKey, request: input }, async (ctx) => {
    const s = await ctx.tx.selectFrom('billing.cashier_shift').selectAll().where('id', '=', input.shiftId).forUpdate().executeTakeFirst();
    if (!s) throw notFound('cashier shift', { shiftId: input.shiftId });
    if (s.version !== input.version) throw conflict('this shift was changed; reload and try again', { reason: 'stale_version', currentVersion: s.version });
    if (s.status !== 'closed') throw preconditionFailed(`shift is ${s.status}`, { reason: 'not_closed' });
    if (s.staff_id === ctx.actor.staffId) throw preconditionFailed('someone other than the cashier verifies a shift', { reason: 'own_shift' });
    const { version } = await ctx.tx.updateTable('billing.cashier_shift').set({ status: 'verified', verified_by: ctx.actor.staffId ?? null, verified_at: now, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', s.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'billing.cashier_shift', subjectId: s.id, diff: { status: ['closed', 'verified'] } });
    return { shiftId: s.id, status: 'verified' as const, version };
  });
}
