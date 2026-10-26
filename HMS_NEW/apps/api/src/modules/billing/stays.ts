// Inpatient stay billing: the stay's account (opened when the patient is admitted), deposits taken
// against it, bed-day charges (a daily job and the final bill, per the clinic's bed_charge_rule), the
// interim statement, and the final bill — which applies the deposits and, once settled, lets the
// discharge's finance clearance clear (billing.account_settled → inpatient).
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { moduleIsActive, notFound, preconditionFailed, runCommand, runQuery, setTransactionContext, writeAudit, writeOutbox, type CommandContext } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { postCharge } from './charges.ts';
import { issueLocked, invoiceTotals } from './invoices.ts';
import { allocate, takePayment, unallocated, type PaymentMethod } from './payments.ts';
import { localDay } from './tax.ts';

/** Consumer: an admitted patient gets a stay account (one per admission; account no = IP number). */
export async function openStayAccount(tx: Transaction<DB>, tenantId: string, admissionId: string, correlationId: string | null) {
  const a = await tx.selectFrom('inpatient.admission').select(['id', 'facility_id', 'patient_id', 'ip_no', 'status', 'admitted_at']).where('id', '=', admissionId).executeTakeFirst();
  if (!a || a.status === 'cancelled') return;
  const row = await tx.insertInto('billing.billing_account').values({
    tenant_id: tenantId, facility_id: a.facility_id, patient_id: a.patient_id, admission_id: a.id, account_no: a.ip_no, opened_at: a.admitted_at,
  }).onConflict((oc) => oc.columns(['tenant_id', 'admission_id']).doNothing()).returning('id').executeTakeFirst();
  if (row) await writeAudit(tx, tenantId, { kind: 'system' }, correlationId, [{ action: 'create', subjectType: 'billing.billing_account', subjectId: row.id, patientId: a.patient_id, diff: { admissionId, accountNo: a.ip_no } }]);
}

/** Consumer: a cancelled admission closes its (charge-free) account. */
export async function closeStayAccount(tx: Transaction<DB>, admissionId: string) {
  await tx.updateTable('billing.billing_account').set({ status: 'closed' }).where('admission_id', '=', admissionId).where('status', '=', 'open').execute();
}

async function lockAccount(tx: Transaction<DB>, accountId: string) {
  const acc = await tx.selectFrom('billing.billing_account').selectAll().where('id', '=', accountId).forUpdate().executeTakeFirst();
  if (!acc) throw notFound('stay account', { accountId });
  return acc;
}

/** A deposit (advance) against an open stay account: a payment held on the account, with a receipt. */
export async function takeDeposit(db: Kysely<DB>, caller: Caller, input: { accountId: string; method: PaymentMethod; amountMinor: number; referenceNo?: string | undefined }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.take_deposit', idempotencyKey, request: input }, async (ctx) => {
    const acc = await lockAccount(ctx.tx, input.accountId);
    if (acc.status !== 'open') throw preconditionFailed(`the stay account is ${acc.status}`, { reason: 'account_not_open', status: acc.status });
    const paid = await takePayment(ctx, {
      facilityId: acc.facility_id, patientId: acc.patient_id, method: input.method, amountMinor: input.amountMinor, referenceNo: input.referenceNo,
      allocations: [], billingAccountId: acc.id, isAdvance: true,
    }, now);
    return { ...paid, accountId: acc.id };
  });
}

// ---- bed days ------------------------------------------------------------------------------------------

type Method = 'midnight_census' | 'per_24h_from_admit' | 'calendar_day_any_part';
const DAY = 86_400_000;

/** Adds n days to a YYYY-MM-DD date. */
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** The local start of a calendar date in a timezone, as an instant. */
function localMidnight(day: string, timezone: string): Date {
  // Asia/Kolkata has no DST; for others this finds the offset at noon and applies it.
  const noon = new Date(`${day}T12:00:00Z`);
  const local = new Date(noon.toLocaleString('en-US', { timeZone: timezone }));
  const offset = local.getTime() - noon.getTime();
  return new Date(Date.parse(`${day}T00:00:00Z`) - offset);
}

/** The service dates an occupancy [start, end) is charged for under a counting method. */
export function chargeableDays(start: Date, end: Date, method: Method, timezone: string, graceMinutes = 0): string[] {
  if (end <= start) return [];
  const first = localDay(start, timezone);
  const last = localDay(new Date(end.getTime() - 1), timezone);
  const days: string[] = [];
  if (method === 'calendar_day_any_part') {
    for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  } else if (method === 'midnight_census') {
    // A day is charged when the patient is in the bed at its closing midnight.
    for (let d = first; d <= last; d = addDays(d, 1)) {
      const midnight = localMidnight(addDays(d, 1), timezone);
      if (midnight > start && midnight < end) days.push(d);
    }
  } else {
    const n = Math.max(0, Math.ceil((end.getTime() - start.getTime() - graceMinutes * 60_000) / DAY));
    for (let i = 0; i < n; i++) days.push(addDays(first, i));
  }
  return days;
}

/**
 * Posts the bed-day charges an account is due up to `upTo` (idempotent: one charge per occupancy per
 * date). A stay too short for any counted day is charged its first day. Returns how many were posted and
 * which bed categories have no price.
 */
export async function postBedDays(tx: Transaction<DB>, tenantId: string, accountId: string, upTo: Date, actorStaffId: string | null) {
  const acc = await tx.selectFrom('billing.billing_account as a').innerJoin('platform.facility as f', 'f.id', 'a.facility_id')
    .select(['a.id', 'a.facility_id', 'a.patient_id', 'a.admission_id', 'a.status', 'f.timezone']).where('a.id', '=', accountId).executeTakeFirstOrThrow();
  const occupancies = await tx.selectFrom('inpatient.bed_occupancy as o')
    .innerJoin('catalog.bed_category as c', 'c.id', 'o.billed_bed_category_id')
    .innerJoin('platform.location as l', 'l.id', 'o.bed_location_id')
    .select(['o.id', 'o.kind', 'o.billed_bed_category_id', 'c.name as category', 'l.name as bed', sql<Date>`lower(o.period)`.as('start'), sql<Date | null>`upper(o.period)`.as('end')])
    .where('o.admission_id', '=', acc.admission_id).orderBy(sql`lower(o.period)`).execute();
  const encounter = await tx.selectFrom('clinical.encounter').select('id').where('admission_id', '=', acc.admission_id).executeTakeFirst();
  const today = localDay(upTo, acc.timezone);
  const { rows: [rule] } = await sql<{ method: Method; grace_minutes: number; retained_bed_percent_bp: number }>`
    SELECT method, grace_minutes, retained_bed_percent_bp FROM catalog.bed_charge_rule
    WHERE (facility_id = ${acc.facility_id} OR facility_id IS NULL) AND price_list_id IS NULL
      AND valid_from <= ${today}::date AND (valid_to IS NULL OR valid_to > ${today}::date)
    ORDER BY facility_id NULLS LAST LIMIT 1`.execute(tx);
  const method = rule?.method ?? 'midnight_census';
  let posted = 0;
  const unpriced = new Set<string>();
  const plan = occupancies.map((o) => ({ o, days: chargeableDays(new Date(o.start), o.end && new Date(o.end) < upTo ? new Date(o.end) : upTo, method, acc.timezone, rule?.grace_minutes ?? 0) }));
  // Minimum one day for the stay: a short day-care stay is still charged its bed.
  const firstPrimary = plan.find((p) => p.o.kind === 'primary');
  const stayEnded = acc.status !== 'open' || occupancies.every((o) => o.end && new Date(o.end) <= upTo);
  if (firstPrimary && plan.every((p) => !p.days.length) && stayEnded) firstPrimary.days.push(localDay(new Date(firstPrimary.o.start), acc.timezone));
  for (const { o, days } of plan) {
    for (const day of days) {
      const { rows: [price] } = await sql<{ id: string; unit_price_minor: number; service_item_id: string; sac_code: string | null }>`
        SELECT pli.id, pli.unit_price_minor, si.id AS service_item_id, si.sac_code FROM catalog.price_list_item pli
        JOIN catalog.price_list pl ON pl.id = pli.price_list_id AND pl.status = 'active' AND pl.is_default
        JOIN catalog.service_item si ON si.id = pli.service_item_id AND si.category = 'bed_day'
        WHERE pli.bed_category_id = ${o.billed_bed_category_id} AND pli.valid_from <= ${day}::date AND (pli.valid_to IS NULL OR pli.valid_to > ${day}::date)
        LIMIT 1`.execute(tx);
      if (!price) { unpriced.add(o.category); continue; }
      const unit = o.kind === 'retained' ? Math.floor((price.unit_price_minor * (rule?.retained_bed_percent_bp ?? 10_000)) / 10_000) : price.unit_price_minor;
      const charge = await postCharge(tx, tenantId, {
        facilityId: acc.facility_id, patientId: acc.patient_id, encounterId: encounter?.id ?? null, billingAccountId: acc.id,
        sourceType: 'bed_day', sourceId: o.id, bedOccupancyId: o.id, serviceDate: day, serviceItemId: price.service_item_id,
        priceListItemId: o.kind === 'retained' ? null : price.id, description: `${o.kind === 'retained' ? 'Retained bed' : 'Bed charges'} — ${o.category} (${o.bed})`,
        hsnSacCode: price.sac_code, serviceCategory: 'bed_day', encounterClass: 'inpatient', quantity: 1, unitPriceMinor: unit, postedBy: actorStaffId,
      });
      if (charge) posted++;
    }
  }
  return { posted, unpricedCategories: [...unpriced] };
}

/** Worker job: posts due bed days for every open stay account (tenants with billing switched on). */
export async function runBedDayCharges(db: Kysely<DB>): Promise<number> {
  const { rows } = await sql<{ tenant_id: string; id: string }>`SELECT * FROM billing.open_stay_accounts(500)`.execute(db);
  let posted = 0;
  for (const r of rows) {
    posted += await db.transaction().execute(async (tx) => {
      await setTransactionContext(tx, r.tenant_id);
      if (!(await moduleIsActive(tx, 'billing'))) return 0;
      await sql`SET LOCAL ROLE mod_billing`.execute(tx);
      return (await postBedDays(tx, r.tenant_id, r.id, new Date(), null)).posted;
    });
  }
  return posted;
}

// ---- statement and final bill --------------------------------------------------------------------------

/** Deposits held on an account: advance payments' unallocated, unrefunded amounts. */
async function heldDeposits(tx: Transaction<DB>, accountId: string) {
  const advances = await tx.selectFrom('billing.payment').select(['id', 'amount_minor', 'refunded_minor', 'status'])
    .where('billing_account_id', '=', accountId).where('is_advance', '=', true).where('status', '<>', 'bounced').orderBy('captured_at').execute();
  const held: { paymentId: string; freeMinor: number }[] = [];
  for (const a of advances) held.push({ paymentId: a.id, freeMinor: await unallocated(tx, a.id) });
  return { takenMinor: advances.reduce((s, a) => s + a.amount_minor - a.refunded_minor, 0), held };
}

/** The interim statement: charges so far (not an invoice, no number), deposits, and what is due. */
export async function stayStatement(db: Kysely<DB>, caller: Caller, accountId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const acc = await tx.selectFrom('billing.billing_account as a').innerJoin('inpatient.admission as ad', 'ad.id', 'a.admission_id')
      .select(['a.id', 'a.account_no', 'a.status', 'a.facility_id', 'a.patient_id', 'a.admission_id', 'a.final_invoice_id', 'ad.status as admissionStatus', 'ad.admitted_at', 'ad.requested_bed_category_id'])
      .where('a.id', '=', accountId).executeTakeFirst();
    if (!acc) throw notFound('stay account', { accountId });
    const charges = await tx.selectFrom('billing.charge').select([
      'id as chargeId', 'service_date as serviceDate', 'source_type as sourceType', 'description', 'quantity', 'unit_price_minor as unitPriceMinor',
      'discount_minor as discountMinor', 'cgst_minor as cgstMinor', 'sgst_minor as sgstMinor', 'net_minor as netMinor', 'status',
    ]).where('billing_account_id', '=', accountId).where('status', '<>', 'reversed').orderBy('service_date').orderBy('posted_at').execute();
    const { takenMinor, held } = await heldDeposits(tx, accountId);
    const chargedMinor = charges.reduce((s, c) => s + c.netMinor, 0);
    const { rows: [rule] } = await sql<{ min_deposit_minor: number; alert_below_minor: number }>`
      SELECT min_deposit_minor, alert_below_minor FROM billing.deposit_rule
      WHERE facility_id = ${acc.facility_id} AND status = 'active' AND (bed_category_id IS NULL OR bed_category_id = (
        SELECT o.billed_bed_category_id FROM inpatient.bed_occupancy o WHERE o.admission_id = ${acc.admission_id} AND o.kind = 'primary' ORDER BY lower(o.period) DESC LIMIT 1))
      ORDER BY bed_category_id NULLS LAST LIMIT 1`.execute(tx);
    const headroom = takenMinor - chargedMinor;
    return {
      accountId: acc.id, accountNo: acc.account_no, status: acc.status, admissionId: acc.admission_id, admissionStatus: acc.admissionStatus, finalInvoiceId: acc.final_invoice_id,
      charges, chargedMinor, depositsMinor: takenMinor, depositsHeldMinor: held.reduce((s, h) => s + h.freeMinor, 0),
      dueMinor: Math.max(0, -headroom), creditMinor: Math.max(0, headroom),
      depositRule: rule ? { minDepositMinor: Number(rule.min_deposit_minor), alertBelowMinor: Number(rule.alert_below_minor) } : null,
      depositLow: rule ? headroom < Number(rule.alert_below_minor) : false,
    };
  });
}

/** Open stays whose deposit headroom (deposits − charges) is below the clinic's alert threshold. */
export async function depositAlerts(db: Kysely<DB>, caller: Caller, facilityId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<{ account_id: string; account_no: string; patient_id: string; charged: number; deposits: number; alert_below: number }>`
      SELECT a.id AS account_id, a.account_no, a.patient_id,
             coalesce((SELECT sum(c.net_minor) FROM billing.charge c WHERE c.billing_account_id = a.id AND c.status <> 'reversed'), 0)::bigint AS charged,
             coalesce((SELECT sum(p.amount_minor - p.refunded_minor) FROM billing.payment p WHERE p.billing_account_id = a.id AND p.is_advance AND p.status <> 'bounced'), 0)::bigint AS deposits,
             r.alert_below_minor AS alert_below
      FROM billing.billing_account a
      JOIN LATERAL (SELECT dr.alert_below_minor FROM billing.deposit_rule dr WHERE dr.facility_id = a.facility_id AND dr.status = 'active'
                    ORDER BY dr.bed_category_id NULLS LAST LIMIT 1) r ON true
      WHERE a.facility_id = ${facilityId} AND a.status = 'open'`.execute(tx);
    return rows
      .map((r) => ({ accountId: r.account_id, accountNo: r.account_no, patientId: r.patient_id, chargedMinor: Number(r.charged), depositsMinor: Number(r.deposits), alertBelowMinor: Number(r.alert_below) }))
      .filter((r) => r.depositsMinor - r.chargedMinor < r.alertBelowMinor);
  });
}

/**
 * The stay's final bill: posts bed days up to now, invoices every open charge of the account (issued at
 * once, numbered), applies held deposits, and settles the account when nothing is left to pay. The
 * discharge must be planned first.
 */
export async function finalInvoice(db: Kysely<DB>, caller: Caller, input: { accountId: string }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.final_invoice', idempotencyKey, request: input }, async (ctx) => {
    const acc = await lockAccount(ctx.tx, input.accountId);
    if (acc.status !== 'open') throw preconditionFailed(`the stay account is ${acc.status}`, { reason: 'account_not_open', status: acc.status });
    const admission = await ctx.tx.selectFrom('inpatient.admission').select(['status']).where('id', '=', acc.admission_id).executeTakeFirstOrThrow();
    if (admission.status !== 'discharge_planned') throw preconditionFailed('plan the discharge before the final bill', { reason: 'discharge_not_planned', admissionStatus: admission.status });
    const bedDays = await postBedDays(ctx.tx, ctx.tenantId, acc.id, now, ctx.actor.staffId ?? null);
    if (bedDays.unpricedCategories.length) {
      throw preconditionFailed(`no bed price for ${bedDays.unpricedCategories.join(', ')}; set it before the final bill`, { reason: 'bed_price_missing', categories: bedDays.unpricedCategories });
    }
    const charges = await ctx.tx.selectFrom('billing.charge as c').selectAll('c').where('c.billing_account_id', '=', acc.id).where('c.status', '=', 'posted')
      .where(({ not, exists, selectFrom }) => not(exists(selectFrom('billing.invoice_line as l').select('l.id').whereRef('l.charge_id', '=', 'c.id').where('l.released_at', 'is', null))))
      .orderBy('c.service_date').orderBy('c.posted_at').forUpdate().execute();
    if (!charges.length) throw preconditionFailed('nothing has been charged to this stay', { reason: 'nothing_to_bill' });
    const p = await ctx.tx.selectFrom('patient.patient').select(['given_name', 'family_name']).where('id', '=', acc.patient_id).executeTakeFirstOrThrow();
    const t = invoiceTotals(charges);
    const draft = await ctx.tx.insertInto('billing.invoice').values({
      tenant_id: ctx.tenantId, facility_id: acc.facility_id, patient_id: acc.patient_id, billing_account_id: acc.id, bill_kind: 'ipd_final',
      bill_to_name: [p.given_name, p.family_name].filter(Boolean).join(' '),
      gross_minor: t.grossMinor, discount_minor: t.discountMinor, taxable_minor: t.taxableMinor, cgst_minor: t.cgstMinor, sgst_minor: t.sgstMinor,
      igst_minor: t.igstMinor, round_off_minor: t.roundOffMinor, net_minor: t.netMinor, created_by: ctx.actor.staffId ?? null,
    }).returning(['id', 'status', 'facility_id', 'patient_id', 'billing_account_id', 'bill_kind']).executeTakeFirstOrThrow();
    await ctx.tx.insertInto('billing.invoice_line').values(charges.map((c, i) => ({
      tenant_id: ctx.tenantId, invoice_id: draft.id, charge_id: c.id, line_no: i + 1, amount_minor: c.net_minor, created_by: ctx.actor.staffId ?? null,
    }))).execute();
    const issued = await issueLocked(ctx, draft, now);
    let balance = issued.netMinor;
    const { held } = await heldDeposits(ctx.tx, acc.id);
    for (const h of held) {
      if (balance <= 0) break;
      const take = Math.min(h.freeMinor, balance);
      if (take <= 0) continue;
      await allocate(ctx, { id: h.paymentId, patient_id: acc.patient_id, facility_id: acc.facility_id }, [{ invoiceId: draft.id, amountMinor: take }], now);
      balance -= take;
    }
    const refundableMinor = (await heldDeposits(ctx.tx, acc.id)).held.reduce((s, h) => s + h.freeMinor, 0);
    const settled = balance <= 0;
    await ctx.tx.updateTable('billing.billing_account').set({
      status: settled ? 'settled' : 'final_billed', final_invoice_id: draft.id, settled_at: settled ? now : null, updated_by: ctx.actor.staffId ?? null,
    }).where('id', '=', acc.id).execute();
    if (settled) emitSettled(ctx, acc);
    ctx.audit({ action: 'create', subjectType: 'billing.invoice', subjectId: draft.id, patientId: acc.patient_id, diff: { billKind: 'ipd_final', invoiceNo: issued.invoiceNo, netMinor: issued.netMinor, depositsAppliedMinor: issued.netMinor - balance } });
    return { ...issued, accountId: acc.id, depositsAppliedMinor: issued.netMinor - balance, balanceMinor: balance, refundableDepositMinor: refundableMinor, accountStatus: settled ? 'settled' : 'final_billed' };
  });
}

function emitSettled(ctx: CommandContext, acc: { id: string; admission_id: string }) {
  ctx.emit({ eventType: 'billing.account_settled', aggregateType: 'billing.billing_account', aggregateId: acc.id, payload: { accountId: acc.id, admissionId: acc.admission_id } });
}

/** Consumer: the final bill was paid off later (at the counter), so the stay account is settled. */
export async function settleStayOnPaid(tx: Transaction<DB>, tenantId: string, invoiceId: string, correlationId: string | null) {
  const acc = await tx.selectFrom('billing.billing_account').select(['id', 'admission_id', 'status']).where('final_invoice_id', '=', invoiceId).forUpdate().executeTakeFirst();
  if (!acc || acc.status !== 'final_billed') return;
  await tx.updateTable('billing.billing_account').set({ status: 'settled', settled_at: sql`now()` }).where('id', '=', acc.id).execute();
  await writeOutbox(tx, tenantId, correlationId, [{ eventType: 'billing.account_settled', aggregateType: 'billing.billing_account', aggregateId: acc.id, payload: { accountId: acc.id, admissionId: acc.admission_id } }]);
}

export async function listStayAccounts(db: Kysely<DB>, caller: Caller, q: { facilityId: string; status?: string | undefined; admissionId?: string | undefined; limit: number }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let s = tx.selectFrom('billing.billing_account as a').innerJoin('patient.patient as p', 'p.id', 'a.patient_id').select([
      'a.id as accountId', 'a.account_no as accountNo', 'a.admission_id as admissionId', 'a.patient_id as patientId', 'p.given_name as givenName',
      'p.family_name as familyName', 'a.status', 'a.opened_at as openedAt', 'a.final_invoice_id as finalInvoiceId', 'a.settled_at as settledAt',
    ]).where('a.facility_id', '=', q.facilityId);
    if (q.status) s = s.where('a.status', '=', q.status as never);
    if (q.admissionId) s = s.where('a.admission_id', '=', q.admissionId);
    return s.orderBy('a.opened_at', 'desc').limit(q.limit).execute();
  });
}

/** Replaces the clinic's active deposit rule for a bed category (or all categories). */
export async function setDepositRule(
  db: Kysely<DB>, caller: Caller, input: { facilityId: string; bedCategoryId?: string | undefined; minDepositMinor: number; alertBelowMinor: number }, idempotencyKey?: string,
) {
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.set_deposit_rule', idempotencyKey, request: input }, async (ctx) => {
    let q = ctx.tx.updateTable('billing.deposit_rule').set({ status: 'inactive', updated_by: ctx.actor.staffId ?? null }).where('facility_id', '=', input.facilityId).where('status', '=', 'active');
    q = input.bedCategoryId ? q.where('bed_category_id', '=', input.bedCategoryId) : q.where('bed_category_id', 'is', null);
    await q.execute();
    const r = await ctx.tx.insertInto('billing.deposit_rule').values({
      tenant_id: ctx.tenantId, facility_id: input.facilityId, bed_category_id: input.bedCategoryId ?? null, min_deposit_minor: input.minDepositMinor,
      alert_below_minor: input.alertBelowMinor, created_by: ctx.actor.staffId ?? null,
    }).returning('id').executeTakeFirstOrThrow();
    ctx.audit({ action: 'create', subjectType: 'billing.deposit_rule', subjectId: r.id, diff: input });
    return { depositRuleId: r.id };
  });
}

export async function accountFacility(db: Kysely<DB>, caller: Caller, accountId: string) {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('billing.billing_account').select('facility_id').where('id', '=', accountId).executeTakeFirst())?.facility_id);
}
