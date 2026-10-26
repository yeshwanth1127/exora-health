// Invoices: drafted from open charges, issued with the next number for the facility's financial year (a
// bill of supply when every line is GST-exempt, a tax invoice when none is, otherwise an invoice-cum-bill
// of supply), settled by payment allocations, taken back by credit notes. A draft is recomputed from its
// charges when issued, so a discount approved after drafting is billed correctly.
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand, type CommandContext } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { financialYear, localDay } from './tax.ts';

type ChargeRow = {
  id: string; facility_id: string; patient_id: string | null; billing_account_id: string | null; source_type: string; status: string;
  gross_minor: number; discount_minor: number; taxable_minor: number; cgst_minor: number; sgst_minor: number; igst_minor: number;
  net_minor: number; is_tax_exempt: boolean;
};

export interface Totals {
  grossMinor: number; discountMinor: number; taxableMinor: number; cgstMinor: number; sgstMinor: number; igstMinor: number;
  roundOffMinor: number; netMinor: number;
}

/** Sums lines and rounds the bill to the nearest rupee (round-off within ±99 paise). */
export function invoiceTotals(lines: Pick<ChargeRow, 'gross_minor' | 'discount_minor' | 'taxable_minor' | 'cgst_minor' | 'sgst_minor' | 'igst_minor'>[]): Totals {
  const sum = (k: keyof (typeof lines)[number]) => lines.reduce((s, l) => s + Number(l[k]), 0);
  const t = { grossMinor: sum('gross_minor'), discountMinor: sum('discount_minor'), taxableMinor: sum('taxable_minor'), cgstMinor: sum('cgst_minor'), sgstMinor: sum('sgst_minor'), igstMinor: sum('igst_minor') };
  const raw = t.taxableMinor + t.cgstMinor + t.sgstMinor + t.igstMinor;
  const rounded = Math.floor((raw + 50) / 100) * 100;
  return { ...t, roundOffMinor: rounded - raw, netMinor: rounded };
}

const DOC_SERIES = { tax_invoice: ['invoice', 'INV'], invoice_cum_bill_of_supply: ['invoice', 'INV'], bill_of_supply: ['bill_of_supply', 'BOS'] } as const;
type DocumentType = keyof typeof DOC_SERIES;

export function documentTypeOf(lines: { is_tax_exempt: boolean }[]): DocumentType {
  const exempt = lines.filter((l) => l.is_tax_exempt).length;
  return exempt === lines.length ? 'bill_of_supply' : exempt === 0 ? 'tax_invoice' : 'invoice_cum_bill_of_supply';
}

/** The next consecutive document number for a facility and financial year, e.g. INV/2026-27/000042. */
export async function nextDocumentNo(tx: Transaction<DB>, kind: string, prefix: string, facilityId: string, fy: string) {
  const { rows: [n] } = await sql<{ n: number }>`SELECT platform.next_number(${kind}, ${facilityId}::uuid, ${fy}) AS n`.execute(tx);
  return `${prefix}/${fy}/${String(n!.n).padStart(6, '0')}`;
}

/** Status after settlement totals change; void and fully credited stay final. */
export function settledStatus(i: { status: string; net_minor: number; paid_minor: number; credited_minor: number }) {
  if (i.status === 'void') return 'void';
  if (i.net_minor > 0 && i.credited_minor >= i.net_minor) return 'credited';
  if (i.paid_minor + i.credited_minor >= i.net_minor) return 'paid';
  return i.paid_minor > 0 ? 'partially_paid' : 'issued';
}

export interface DraftInput {
  facilityId: string;
  /** Required unless chargeIds are given for an over-the-counter sale. */
  patientId?: string | undefined;
  /** Default: every open charge of the patient at the facility not on another bill (outpatient only). */
  chargeIds?: string[] | undefined;
  /** A pharmacy dispense or counter sale: bill exactly its lines' charges (buyer details from the sale). */
  dispenseId?: string | undefined;
  billToName?: string | undefined;
  billToPhone?: string | undefined;
}

/** Drafts a bill from open charges. Drafts take no number; issuing does. */
export async function draftInvoice(db: Kysely<DB>, caller: Caller, input: DraftInput, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.draft_invoice', idempotencyKey, request: input }, async (ctx) => {
    if (!input.patientId && !input.chargeIds?.length && !input.dispenseId) throw invalid('choose a patient, a sale or the charges to bill', { reason: 'nothing_to_bill' });
    if (input.dispenseId) {
      const sale = await ctx.tx.selectFrom('pharmacy.dispense').select(['id', 'facility_id', 'buyer_name', 'buyer_phone']).where('id', '=', input.dispenseId).executeTakeFirst();
      if (!sale || sale.facility_id !== input.facilityId) throw notFound('dispense', { dispenseId: input.dispenseId });
      const lines = await ctx.tx.selectFrom('billing.charge as c').innerJoin('pharmacy.dispense_line as l', 'l.id', 'c.dispense_line_id')
        .select('c.id').where('l.dispense_id', '=', sale.id).where('c.status', '=', 'posted').execute();
      if (!lines.length) throw preconditionFailed('the sale’s charges are not posted yet; try again in a moment', { reason: 'charges_pending' });
      input = { ...input, chargeIds: lines.map((l) => l.id), billToName: input.billToName ?? sale.buyer_name ?? undefined, billToPhone: input.billToPhone ?? sale.buyer_phone ?? undefined };
    }
    let q = ctx.tx.selectFrom('billing.charge as c')
      .selectAll('c')
      .where('c.facility_id', '=', input.facilityId)
      .where('c.status', '=', 'posted')
      .where(({ not, exists, selectFrom }) => not(exists(selectFrom('billing.invoice_line as l').select('l.id').whereRef('l.charge_id', '=', 'c.id').where('l.released_at', 'is', null))));
    if (input.chargeIds?.length) q = q.where('c.id', 'in', input.chargeIds);
    else q = q.where('c.patient_id', '=', input.patientId!).where('c.billing_account_id', 'is', null);
    const charges = (await q.orderBy('c.service_date').orderBy('c.posted_at').forUpdate().execute()) as unknown as ChargeRow[];
    if (input.chargeIds?.length && charges.length !== new Set(input.chargeIds).size) {
      throw preconditionFailed('some charges are not open at this clinic or are already on a bill', { reason: 'charges_unavailable' });
    }
    if (!charges.length) throw preconditionFailed('there is nothing left to bill', { reason: 'nothing_to_bill' });
    const patients = new Set(charges.map((c) => c.patient_id));
    if (patients.size > 1) throw invalid('a bill is for one patient', { reason: 'mixed_patients' });
    const patientId = charges[0]!.patient_id;
    if (input.patientId && patientId !== input.patientId) throw invalid('the charges are not this patient’s', { reason: 'patient_mismatch' });
    const accounts = new Set(charges.map((c) => c.billing_account_id));
    if (accounts.size > 1 || charges[0]!.billing_account_id) throw invalid('inpatient charges are billed on the final bill of their admission', { reason: 'inpatient_charges' });
    let billToName = input.billToName;
    if (patientId && !billToName) {
      const p = await ctx.tx.selectFrom('patient.patient').select(['given_name', 'family_name']).where('id', '=', patientId).executeTakeFirstOrThrow();
      billToName = [p.given_name, p.family_name].filter(Boolean).join(' ');
    }
    if (!billToName) throw invalid('give the buyer’s name for an over-the-counter bill', { reason: 'bill_to_required' });
    const t = invoiceTotals(charges);
    const invoice = await ctx.tx.insertInto('billing.invoice').values({
      tenant_id: ctx.tenantId, facility_id: input.facilityId, patient_id: patientId,
      bill_kind: charges.every((c) => c.source_type === 'dispense_line') ? 'pharmacy' : 'opd',
      bill_to_name: billToName, bill_to_phone: input.billToPhone ?? null,
      gross_minor: t.grossMinor, discount_minor: t.discountMinor, taxable_minor: t.taxableMinor, cgst_minor: t.cgstMinor,
      sgst_minor: t.sgstMinor, igst_minor: t.igstMinor, round_off_minor: t.roundOffMinor, net_minor: t.netMinor,
      created_by: ctx.actor.staffId ?? null,
    }).returning(['id', 'version']).executeTakeFirstOrThrow();
    try {
      await ctx.tx.insertInto('billing.invoice_line').values(charges.map((c, i) => ({
        tenant_id: ctx.tenantId, invoice_id: invoice.id, charge_id: c.id, line_no: i + 1, amount_minor: c.net_minor, created_by: ctx.actor.staffId ?? null,
      }))).execute();
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('a charge was put on another bill at the same time; reload and try again', { reason: 'charge_on_other_invoice' });
      throw err;
    }
    ctx.audit({ action: 'create', subjectType: 'billing.invoice', subjectId: invoice.id, patientId, diff: { lines: charges.length, netMinor: t.netMinor } });
    return { invoiceId: invoice.id, status: 'draft' as const, version: invoice.version, lines: charges.length, ...t };
  });
}

async function lockInvoice(ctx: CommandContext, invoiceId: string, version?: number) {
  const inv = await ctx.tx.selectFrom('billing.invoice').selectAll().where('id', '=', invoiceId).forUpdate().executeTakeFirst();
  if (!inv) throw notFound('invoice', { invoiceId });
  if (version !== undefined && inv.version !== version) throw conflict('this bill was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: inv.version });
  return inv;
}

/** Issues a draft: recomputes it from its charges, numbers it, and marks its charges invoiced. */
export async function issueInvoice(db: Kysely<DB>, caller: Caller, input: { invoiceId: string; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.issue_invoice', idempotencyKey, request: input }, async (ctx) => {
    const inv = await lockInvoice(ctx, input.invoiceId, input.version);
    return issueLocked(ctx, inv, now);
  });
}

/** Issues a locked draft invoice in the caller's billing command. */
export async function issueLocked(
  ctx: CommandContext, inv: { id: string; status: string; facility_id: string; patient_id: string | null; billing_account_id: string | null; bill_kind: string }, now: Date,
) {
  if (inv.status !== 'draft') throw preconditionFailed(`bill is ${inv.status}`, { reason: 'not_draft', status: inv.status });
  const lines = await ctx.tx.selectFrom('billing.invoice_line').select(['id', 'charge_id']).where('invoice_id', '=', inv.id).where('released_at', 'is', null).orderBy('line_no').execute();
  if (!lines.length) throw preconditionFailed('the bill has no lines', { reason: 'nothing_to_bill' });
  const charges = (await ctx.tx.selectFrom('billing.charge').selectAll().where('id', 'in', lines.map((l) => l.charge_id)).forUpdate().execute()) as unknown as ChargeRow[];
  if (charges.some((c) => c.status !== 'posted')) throw preconditionFailed('a charge on this bill was reversed; rebuild the bill', { reason: 'charge_not_open' });
  const facility = await ctx.tx.selectFrom('platform.facility').select(['timezone', 'gstin', 'state_code']).where('id', '=', inv.facility_id).executeTakeFirstOrThrow();
  const t = invoiceTotals(charges);
  const docType = documentTypeOf(charges);
  const fy = financialYear(localDay(now, facility.timezone));
  const [kind, prefix] = DOC_SERIES[docType];
  const invoiceNo = await nextDocumentNo(ctx.tx, kind, prefix, inv.facility_id, fy);
  const byId = new Map(charges.map((c) => [c.id, c]));
  for (const l of lines) await ctx.tx.updateTable('billing.invoice_line').set({ amount_minor: byId.get(l.charge_id)!.net_minor }).where('id', '=', l.id).execute();
  const status = t.netMinor === 0 ? 'paid' : 'issued';
  const { version } = await ctx.tx.updateTable('billing.invoice').set({
    gross_minor: t.grossMinor, discount_minor: t.discountMinor, taxable_minor: t.taxableMinor, cgst_minor: t.cgstMinor, sgst_minor: t.sgstMinor,
    igst_minor: t.igstMinor, round_off_minor: t.roundOffMinor, net_minor: t.netMinor,
    invoice_no: invoiceNo, document_type: docType, financial_year: fy, facility_gstin: facility.gstin, place_of_supply: facility.state_code,
    status, issued_at: now, issued_by: ctx.actor.staffId ?? null, updated_by: ctx.actor.staffId ?? null,
  }).where('id', '=', inv.id).returning('version').executeTakeFirstOrThrow();
  await ctx.tx.updateTable('billing.charge').set({ status: 'invoiced', updated_by: ctx.actor.staffId ?? null }).where('id', 'in', charges.map((c) => c.id)).execute();
  ctx.audit({ action: 'status_change', subjectType: 'billing.invoice', subjectId: inv.id, patientId: inv.patient_id, diff: { status: ['draft', status], invoiceNo, netMinor: t.netMinor } });
  ctx.emit({ eventType: 'invoice.issued', aggregateType: 'billing.invoice', aggregateId: inv.id, aggregateVersion: version, payload: { invoiceId: inv.id, billingAccountId: inv.billing_account_id, billKind: inv.bill_kind, netMinor: t.netMinor } });
  if (status === 'paid') ctx.emit({ eventType: 'invoice.paid', aggregateType: 'billing.invoice', aggregateId: inv.id, payload: { invoiceId: inv.id, billingAccountId: inv.billing_account_id } });
  return { invoiceId: inv.id, invoiceNo, documentType: docType, status, version, ...t };
}

/** Voids a draft, or an issued bill nothing has been paid or credited on; its charges can be billed again. */
export async function voidInvoice(db: Kysely<DB>, caller: Caller, input: { invoiceId: string; reason: string; version: number }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.void_invoice', idempotencyKey, request: input }, async (ctx) => {
    const inv = await lockInvoice(ctx, input.invoiceId, input.version);
    if (!['draft', 'issued'].includes(inv.status) || inv.paid_minor > 0 || inv.credited_minor > 0) {
      throw preconditionFailed('only an unpaid, uncredited bill can be voided; use a credit note', { reason: 'not_voidable', status: inv.status });
    }
    const lines = await ctx.tx.updateTable('billing.invoice_line').set({ released_at: now }).where('invoice_id', '=', inv.id).where('released_at', 'is', null).returning('charge_id').execute();
    if (inv.status === 'issued' && lines.length) {
      await ctx.tx.updateTable('billing.charge').set({ status: 'posted', updated_by: ctx.actor.staffId ?? null }).where('id', 'in', lines.map((l) => l.charge_id)).where('status', '=', 'invoiced').execute();
    }
    const { version } = await ctx.tx.updateTable('billing.invoice').set({ status: 'void', voided_at: now, void_reason: input.reason, updated_by: ctx.actor.staffId ?? null })
      .where('id', '=', inv.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'status_change', subjectType: 'billing.invoice', subjectId: inv.id, patientId: inv.patient_id, reason: input.reason, diff: { status: [inv.status, 'void'], invoiceNo: inv.invoice_no } });
    return { invoiceId: inv.id, status: 'void' as const, version };
  });
}

/**
 * Credits whole charges off an issued bill (tax reversed with them). If that leaves more paid than is
 * now owed, the newest allocations shrink so the overpayment can be refunded from its payment.
 */
export async function issueCreditNote(db: Kysely<DB>, caller: Caller, input: { invoiceId: string; chargeIds: string[]; reason: string }, idempotencyKey?: string) {
  const now = clock(caller);
  return runCommand(db, { ...caller, module: 'billing', name: 'billing.issue_credit_note', idempotencyKey, request: input }, async (ctx) => {
    const inv = await lockInvoice(ctx, input.invoiceId);
    if (!['issued', 'partially_paid', 'paid'].includes(inv.status)) throw preconditionFailed(`bill is ${inv.status}`, { reason: 'not_creditable', status: inv.status });
    const wanted = [...new Set(input.chargeIds)];
    const charges = await ctx.tx.selectFrom('billing.charge as c')
      .innerJoin('billing.invoice_line as l', (j) => j.onRef('l.charge_id', '=', 'c.id').on('l.invoice_id', '=', inv.id).on('l.released_at', 'is', null))
      .select(['c.id', 'c.status', 'c.taxable_minor', 'c.cgst_minor', 'c.sgst_minor', 'c.igst_minor', 'c.net_minor'])
      .where('c.id', 'in', wanted).forUpdate('c').execute();
    if (charges.length !== wanted.length || charges.some((c) => c.status !== 'invoiced')) {
      throw preconditionFailed('every charge must be on this bill and not credited already', { reason: 'charges_unavailable' });
    }
    const sum = (k: 'taxable_minor' | 'cgst_minor' | 'sgst_minor' | 'igst_minor') => charges.reduce((s, c) => s + c[k], 0);
    const amount = charges.reduce((s, c) => s + c.net_minor, 0);
    // Crediting the last billed charges credits whatever is left, round-off included.
    const remaining = inv.net_minor - inv.credited_minor;
    const othersLeft = await ctx.tx.selectFrom('billing.invoice_line as l').innerJoin('billing.charge as c', 'c.id', 'l.charge_id')
      .select('c.id').where('l.invoice_id', '=', inv.id).where('l.released_at', 'is', null).where('c.status', '=', 'invoiced').where('c.id', 'not in', wanted)
      .executeTakeFirst();
    const credit = othersLeft ? Math.min(amount, remaining) : remaining;
    if (credit <= 0) throw preconditionFailed('nothing is left to credit on this bill', { reason: 'nothing_to_credit' });
    const facility = await ctx.tx.selectFrom('platform.facility').select('timezone').where('id', '=', inv.facility_id).executeTakeFirstOrThrow();
    const fy = financialYear(localDay(now, facility.timezone));
    const noteNo = await nextDocumentNo(ctx.tx, 'credit_note', 'CN', inv.facility_id, fy);
    const taxable = credit - sum('cgst_minor') - sum('sgst_minor') - sum('igst_minor');
    const note = await ctx.tx.insertInto('billing.credit_note').values({
      tenant_id: ctx.tenantId, facility_id: inv.facility_id, invoice_id: inv.id, note_no: noteNo, financial_year: fy, reason: input.reason,
      taxable_minor: taxable, cgst_minor: sum('cgst_minor'), sgst_minor: sum('sgst_minor'), igst_minor: sum('igst_minor'), amount_minor: credit,
      issued_at: now, approved_by: ctx.actor.staffId!, created_by: ctx.actor.staffId ?? null,
    }).returning('id').executeTakeFirstOrThrow();
    await ctx.tx.insertInto('billing.credit_note_line').values(charges.map((c) => ({
      tenant_id: ctx.tenantId, credit_note_id: note.id, charge_id: c.id, taxable_minor: c.taxable_minor, cgst_minor: c.cgst_minor,
      sgst_minor: c.sgst_minor, igst_minor: c.igst_minor, amount_minor: c.net_minor, created_by: ctx.actor.staffId ?? null,
    }))).execute();
    await ctx.tx.updateTable('billing.charge').set({ status: 'reversed', reversed_at: now, reversed_by: ctx.actor.staffId ?? null, reverse_reason: `credit note ${noteNo}: ${input.reason}`.slice(0, 500) })
      .where('id', 'in', wanted).execute();
    const credited = inv.credited_minor + credit;
    const overpaid = Math.max(0, inv.paid_minor + credited - inv.net_minor);
    const paid = inv.paid_minor - (overpaid ? await releaseAllocations(ctx, inv.id, overpaid, now) : 0);
    const status = settledStatus({ status: inv.status, net_minor: inv.net_minor, paid_minor: paid, credited_minor: credited });
    await ctx.tx.updateTable('billing.invoice').set({ credited_minor: credited, paid_minor: paid, status, updated_by: ctx.actor.staffId ?? null }).where('id', '=', inv.id).execute();
    ctx.audit({ action: 'create', subjectType: 'billing.credit_note', subjectId: note.id, patientId: inv.patient_id, reason: input.reason, diff: { invoiceId: inv.id, noteNo, amountMinor: credit, refundableMinor: overpaid } });
    ctx.emit({ eventType: 'credit_note.issued', aggregateType: 'billing.credit_note', aggregateId: note.id, payload: { creditNoteId: note.id, invoiceId: inv.id, amountMinor: credit } });
    return { creditNoteId: note.id, noteNo, amountMinor: credit, invoiceStatus: status, refundableMinor: overpaid };
  });
}

/** Shrinks an invoice's newest live allocations by `amount`; returns what was released. */
async function releaseAllocations(ctx: CommandContext, invoiceId: string, amount: number, now: Date): Promise<number> {
  const allocs = await ctx.tx.selectFrom('billing.payment_allocation').selectAll().where('invoice_id', '=', invoiceId).where('reversed_at', 'is', null)
    .orderBy('allocated_at', 'desc').forUpdate().execute();
  let left = amount;
  for (const a of allocs) {
    if (left <= 0) break;
    const take = Math.min(a.amount_minor, left);
    await ctx.tx.updateTable('billing.payment_allocation').set({ reversed_at: now }).where('id', '=', a.id).execute();
    if (a.amount_minor > take) {
      await ctx.tx.insertInto('billing.payment_allocation').values({ tenant_id: ctx.tenantId, payment_id: a.payment_id, invoice_id: invoiceId, amount_minor: a.amount_minor - take, allocated_at: a.allocated_at, created_by: ctx.actor.staffId ?? null }).execute();
    }
    left -= take;
  }
  return amount - left;
}
