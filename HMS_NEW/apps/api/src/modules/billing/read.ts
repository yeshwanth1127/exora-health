// Billing reads: open charges, bills (with a print-ready payload), payments, refunds, shifts and the
// day's counter summary. Each by-id read also tells the route which facility the record belongs to, so
// permissions are checked against the right clinic.
import { sql, type DB, type Kysely } from '@hms/db';
import { notFound, runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';

type Billable = 'billing.charge' | 'billing.invoice' | 'billing.payment' | 'billing.refund' | 'billing.cashier_shift' | 'billing.credit_note';

/** The facility a billing record belongs to, or undefined when it doesn't exist (for this tenant). */
export async function billingFacility(db: Kysely<DB>, caller: Caller, table: Billable, id: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom(table).select('facility_id').where('id', '=', id).executeTakeFirst())?.facility_id);
}

export async function adjustmentFacility(db: Kysely<DB>, caller: Caller, adjustmentId: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) =>
    (await tx.selectFrom('billing.charge_adjustment as a').innerJoin('billing.charge as c', 'c.id', 'a.charge_id').select('c.facility_id').where('a.id', '=', adjustmentId).executeTakeFirst())?.facility_id);
}

export async function listCharges(
  db: Kysely<DB>, caller: Caller, q: { facilityId: string; patientId?: string | undefined; status?: 'posted' | 'invoiced' | 'reversed' | undefined; unbilledOnly?: boolean | undefined; limit: number },
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let s = tx.selectFrom('billing.charge as c')
      .leftJoin('patient.patient as p', 'p.id', 'c.patient_id')
      .select([
        'c.id as chargeId', 'c.patient_id as patientId', 'p.mrn', 'p.given_name as givenName', 'p.family_name as familyName', 'c.encounter_id as encounterId',
        'c.source_type as sourceType', 'c.source_id as sourceId', 'c.service_date as serviceDate', 'c.description', 'c.quantity', 'c.unit_price_minor as unitPriceMinor',
        'c.gross_minor as grossMinor', 'c.discount_minor as discountMinor', 'c.taxable_minor as taxableMinor', 'c.gst_rate_bp as gstRateBp', 'c.is_tax_exempt as isTaxExempt',
        'c.cgst_minor as cgstMinor', 'c.sgst_minor as sgstMinor', 'c.net_minor as netMinor', 'c.status', 'c.billing_account_id as billingAccountId', 'c.posted_at as postedAt', 'c.version',
      ])
      .select((eb) => eb.selectFrom('billing.invoice_line as l').select('l.invoice_id').whereRef('l.charge_id', '=', 'c.id').where('l.released_at', 'is', null).limit(1).as('invoiceId'))
      .where('c.facility_id', '=', q.facilityId);
    if (q.patientId) s = s.where('c.patient_id', '=', q.patientId);
    if (q.status) s = s.where('c.status', '=', q.status);
    if (q.unbilledOnly) {
      s = s.where('c.status', '=', 'posted')
        .where(({ not, exists, selectFrom }) => not(exists(selectFrom('billing.invoice_line as l').select('l.id').whereRef('l.charge_id', '=', 'c.id').where('l.released_at', 'is', null))));
    }
    return s.orderBy('c.posted_at', 'desc').limit(q.limit).execute();
  });
}

export async function listInvoices(
  db: Kysely<DB>, caller: Caller, q: { facilityId: string; patientId?: string | undefined; status?: string | undefined; from?: string | undefined; to?: string | undefined; limit: number },
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let s = tx.selectFrom('billing.invoice as i').select([
      'i.id as invoiceId', 'i.invoice_no as invoiceNo', 'i.document_type as documentType', 'i.bill_kind as billKind', 'i.patient_id as patientId',
      'i.bill_to_name as billToName', 'i.net_minor as netMinor', 'i.paid_minor as paidMinor', 'i.credited_minor as creditedMinor', 'i.status',
      'i.issued_at as issuedAt', 'i.created_at as createdAt', 'i.version',
    ]).where('i.facility_id', '=', q.facilityId);
    if (q.patientId) s = s.where('i.patient_id', '=', q.patientId);
    if (q.status) s = s.where('i.status', '=', q.status as never);
    if (q.from) s = s.where(sql<boolean>`coalesce(i.issued_at, i.created_at) >= ${q.from}::date`);
    if (q.to) s = s.where(sql<boolean>`coalesce(i.issued_at, i.created_at) < ${q.to}::date + 1`);
    const rows = await s.orderBy(sql`coalesce(i.issued_at, i.created_at)`, 'desc').limit(q.limit).execute();
    return rows.map((r) => ({ ...r, balanceMinor: r.netMinor - r.paidMinor - r.creditedMinor }));
  });
}

/** One bill with everything needed to print it: clinic, lines (HSN/SAC, tax), payments and credit notes. */
export async function getInvoice(db: Kysely<DB>, caller: Caller, invoiceId: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const i = await tx.selectFrom('billing.invoice').selectAll().where('id', '=', invoiceId).executeTakeFirst();
    if (!i) throw notFound('invoice', { invoiceId });
    const facility = await tx.selectFrom('platform.facility').select(['name', 'address_line1', 'address_line2', 'city', 'pincode', 'phone', 'gstin', 'state_code'])
      .where('id', '=', i.facility_id).executeTakeFirstOrThrow();
    const patient = i.patient_id ? await tx.selectFrom('patient.patient').select(['mrn', 'given_name', 'family_name']).where('id', '=', i.patient_id).executeTakeFirst() : undefined;
    const lines = await tx.selectFrom('billing.invoice_line as l').innerJoin('billing.charge as c', 'c.id', 'l.charge_id').select([
      'l.line_no as lineNo', 'c.id as chargeId', 'c.description', 'c.hsn_sac_code as hsnSacCode', 'c.service_date as serviceDate', 'c.quantity',
      'c.unit_price_minor as unitPriceMinor', 'c.gross_minor as grossMinor', 'c.discount_minor as discountMinor', 'c.taxable_minor as taxableMinor',
      'c.is_tax_exempt as isTaxExempt', 'c.gst_rate_bp as gstRateBp', 'c.cgst_minor as cgstMinor', 'c.sgst_minor as sgstMinor', 'c.igst_minor as igstMinor',
      'c.net_minor as netMinor', 'c.status as chargeStatus',
    ]).where('l.invoice_id', '=', i.id).where('l.released_at', 'is', null).orderBy('l.line_no').execute();
    const payments = await tx.selectFrom('billing.payment_allocation as a').innerJoin('billing.payment as p', 'p.id', 'a.payment_id')
      .leftJoin('billing.receipt as r', 'r.payment_id', 'p.id')
      .select(['p.id as paymentId', 'r.receipt_no as receiptNo', 'p.method', 'p.reference_no as referenceNo', 'a.amount_minor as amountMinor', 'a.allocated_at as allocatedAt'])
      .where('a.invoice_id', '=', i.id).where('a.reversed_at', 'is', null).orderBy('a.allocated_at').execute();
    const creditNotes = await tx.selectFrom('billing.credit_note').select(['id as creditNoteId', 'note_no as noteNo', 'reason', 'amount_minor as amountMinor', 'issued_at as issuedAt'])
      .where('invoice_id', '=', i.id).orderBy('issued_at').execute();
    return {
      invoiceId: i.id, invoiceNo: i.invoice_no, documentType: i.document_type, billKind: i.bill_kind, financialYear: i.financial_year, status: i.status, version: i.version,
      issuedAt: i.issued_at, voidedAt: i.voided_at, voidReason: i.void_reason,
      clinic: { name: facility.name, address: [facility.address_line1, facility.address_line2, facility.city, facility.pincode].filter(Boolean).join(', '), phone: facility.phone, gstin: i.facility_gstin ?? facility.gstin, placeOfSupply: i.place_of_supply ?? facility.state_code },
      billTo: { name: i.bill_to_name, phone: i.bill_to_phone, patientId: i.patient_id, mrn: patient?.mrn ?? null },
      lines,
      totals: { grossMinor: i.gross_minor, discountMinor: i.discount_minor, taxableMinor: i.taxable_minor, cgstMinor: i.cgst_minor, sgstMinor: i.sgst_minor, igstMinor: i.igst_minor, roundOffMinor: i.round_off_minor, netMinor: i.net_minor, paidMinor: i.paid_minor, creditedMinor: i.credited_minor, balanceMinor: i.net_minor - i.paid_minor - i.credited_minor },
      payments, creditNotes,
    };
  });
}

export async function listPayments(db: Kysely<DB>, caller: Caller, q: { facilityId: string; patientId?: string | undefined; date?: string | undefined; limit: number }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let s = tx.selectFrom('billing.payment as p').leftJoin('billing.receipt as r', 'r.payment_id', 'p.id').innerJoin('platform.facility as f', 'f.id', 'p.facility_id').select([
      'p.id as paymentId', 'r.receipt_no as receiptNo', 'p.patient_id as patientId', 'p.payer_name as payerName', 'p.method', 'p.amount_minor as amountMinor',
      'p.refunded_minor as refundedMinor', 'p.reference_no as referenceNo', 'p.is_advance as isAdvance', 'p.status', 'p.captured_at as capturedAt', 'p.cashier_shift_id as cashierShiftId',
    ]).select(sql<number>`(p.amount_minor - p.refunded_minor - coalesce((SELECT sum(a.amount_minor) FROM billing.payment_allocation a WHERE a.payment_id = p.id AND a.reversed_at IS NULL), 0))::bigint`.as('unallocatedMinor'))
      .where('p.facility_id', '=', q.facilityId);
    if (q.patientId) s = s.where('p.patient_id', '=', q.patientId);
    if (q.date) s = s.where(sql<boolean>`(p.captured_at AT TIME ZONE f.timezone)::date = ${q.date}::date`);
    return s.orderBy('p.captured_at', 'desc').limit(q.limit).execute();
  });
}

export async function listRefunds(db: Kysely<DB>, caller: Caller, q: { facilityId: string; status?: string | undefined; limit: number }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let s = tx.selectFrom('billing.refund').select([
      'id as refundId', 'payment_id as paymentId', 'credit_note_id as creditNoteId', 'amount_minor as amountMinor', 'reason', 'method', 'status',
      'requested_at as requestedAt', 'decided_at as decidedAt', 'paid_at as paidAt', 'version',
    ]).where('facility_id', '=', q.facilityId);
    if (q.status) s = s.where('status', '=', q.status as never);
    return s.orderBy('requested_at', 'desc').limit(q.limit).execute();
  });
}

export async function listShifts(db: Kysely<DB>, caller: Caller, q: { facilityId: string; status?: string | undefined; limit: number }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let s = tx.selectFrom('billing.cashier_shift as s').innerJoin('platform.staff as st', 'st.id', 's.staff_id').select([
      's.id as shiftId', 's.staff_id as staffId', 'st.display_name as cashierName', 's.opened_at as openedAt', 's.closed_at as closedAt',
      's.opening_float_minor as openingFloatMinor', 's.expected_cash_minor as expectedCashMinor', 's.counted_cash_minor as countedCashMinor',
      's.variance_minor as varianceMinor', 's.status', 's.verified_at as verifiedAt', 's.version',
    ]).where('s.facility_id', '=', q.facilityId);
    if (q.status) s = s.where('s.status', '=', q.status as never);
    return s.orderBy('s.opened_at', 'desc').limit(q.limit).execute();
  });
}

/** The counter's day at a clinic: charges posted, bills issued, money by method, refunds paid, open shifts. */
export async function billingSummary(db: Kysely<DB>, caller: Caller, q: { facilityId: string; date: string }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows: [r] } = await sql<{
      charges_posted: number; charged_minor: number; unbilled_minor: number; invoices_issued: number; invoiced_minor: number;
      outstanding_minor: number; refunds_paid_minor: number; open_shifts: number;
    }>`
      WITH f AS (SELECT id, timezone FROM platform.facility WHERE id = ${q.facilityId})
      SELECT
        (SELECT count(*) FROM billing.charge c WHERE c.facility_id = f.id AND c.service_date = ${q.date}::date AND c.status <> 'reversed')::int AS charges_posted,
        (SELECT coalesce(sum(c.net_minor), 0) FROM billing.charge c WHERE c.facility_id = f.id AND c.service_date = ${q.date}::date AND c.status <> 'reversed')::bigint AS charged_minor,
        (SELECT coalesce(sum(c.net_minor), 0) FROM billing.charge c WHERE c.facility_id = f.id AND c.status = 'posted' AND c.billing_account_id IS NULL)::bigint AS unbilled_minor,
        (SELECT count(*) FROM billing.invoice i WHERE i.facility_id = f.id AND (i.issued_at AT TIME ZONE f.timezone)::date = ${q.date}::date)::int AS invoices_issued,
        (SELECT coalesce(sum(i.net_minor), 0) FROM billing.invoice i WHERE i.facility_id = f.id AND i.status <> 'void' AND (i.issued_at AT TIME ZONE f.timezone)::date = ${q.date}::date)::bigint AS invoiced_minor,
        (SELECT coalesce(sum(i.net_minor - i.paid_minor - i.credited_minor), 0) FROM billing.invoice i WHERE i.facility_id = f.id AND i.status IN ('issued', 'partially_paid'))::bigint AS outstanding_minor,
        (SELECT coalesce(sum(rf.amount_minor), 0) FROM billing.refund rf WHERE rf.facility_id = f.id AND rf.status = 'paid' AND (rf.paid_at AT TIME ZONE f.timezone)::date = ${q.date}::date)::bigint AS refunds_paid_minor,
        (SELECT count(*) FROM billing.cashier_shift s WHERE s.facility_id = f.id AND s.status = 'open')::int AS open_shifts
      FROM f`.execute(tx);
    if (!r) throw notFound('facility', { facilityId: q.facilityId });
    const { rows: byMethod } = await sql<{ method: string; count: number; amount_minor: number }>`
      SELECT p.method, count(*)::int AS count, sum(p.amount_minor)::bigint AS amount_minor
      FROM billing.payment p JOIN platform.facility f ON f.id = p.facility_id
      WHERE p.facility_id = ${q.facilityId} AND p.status <> 'bounced' AND (p.captured_at AT TIME ZONE f.timezone)::date = ${q.date}::date
      GROUP BY p.method ORDER BY p.method`.execute(tx);
    return {
      date: q.date,
      chargesPosted: r.charges_posted, chargedMinor: Number(r.charged_minor), unbilledMinor: Number(r.unbilled_minor),
      invoicesIssued: r.invoices_issued, invoicedMinor: Number(r.invoiced_minor), outstandingMinor: Number(r.outstanding_minor),
      collected: byMethod.map((m) => ({ method: m.method, count: m.count, amountMinor: Number(m.amount_minor) })),
      collectedMinor: byMethod.reduce((s, m) => s + Number(m.amount_minor), 0),
      refundsPaidMinor: Number(r.refunds_paid_minor), openShifts: r.open_shifts,
    };
  });
}
