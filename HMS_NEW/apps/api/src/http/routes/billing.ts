import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { DomainError } from '@hms/platform';
import { authorize, can } from '../../auth/principal.ts';
import {
  adjustmentFacility, allocatePayment, billingFacility, billingSummary, closeCashierShift, decideDiscount, decideRefund, draftInvoice, getInvoice,
  issueCreditNote, issueInvoice, listCharges, listInvoices, listPayments, listRefunds, listShifts, openCashierShift, payRefund, postManualCharge,
  recordPayment, requestDiscount, requestRefund, reverseCharge, verifyCashierShift, voidInvoice,
} from '../../modules/billing/index.ts';
import { accountFacility, depositAlerts, finalInvoice, listStayAccounts, setDepositRule, stayStatement, takeDeposit } from '../../modules/billing/stays.ts';
import { moduleRoutes } from '../module-routes.ts';
import { callerOf, idempotencyKey, isoDate, optionalIdempotencyKey, parse, principalOf, uuid } from '../support.ts';

const Minor = z.number().int().min(0).max(10_000_000_00);
const Positive = z.number().int().min(1).max(10_000_000_00);
const Reason = z.string().trim().min(3).max(500);
const Version = z.number().int().min(1);
const Method = z.enum(['cash', 'upi', 'card', 'net_banking', 'cheque', 'wallet']);
const Limit = z.coerce.number().int().min(1).max(200).default(50);
const Allocations = z.array(z.object({ invoiceId: uuid, amountMinor: Positive })).max(50);
const Id = (name: string) => z.object({ [name]: uuid });

type Table = Parameters<typeof billingFacility>[2];

export function registerBillingRoutes(app: FastifyInstance, db: Kysely<DB>) {
  /** Facility of a billing record; 404 when it doesn't exist, then the permission for that facility. */
  const scoped = async (request: FastifyRequest, table: Table, id: string, permission: string) => {
    const facilityId = await billingFacility(db, callerOf(request), table, id);
    if (!facilityId) throw new DomainError('not_found', `${table.split('.')[1]!.replace('_', ' ')} not found`);
    authorize(principalOf(request), permission, facilityId);
    return facilityId;
  };

  moduleRoutes(app, db, 'billing', (r) => {
    // ---- reads -----------------------------------------------------------------------------------------
    r.get('/v1/billing/summary', async (request) => {
      const q = parse(z.object({ facilityId: uuid, date: isoDate }), request.query);
      authorize(principalOf(request), 'billing.read', q.facilityId);
      return billingSummary(db, callerOf(request), q);
    });

    r.get('/v1/billing/charges', async (request) => {
      const q = parse(z.object({
        facilityId: uuid, patientId: uuid.optional(), status: z.enum(['posted', 'invoiced', 'reversed']).optional(),
        unbilled: z.enum(['true', 'false']).optional(), limit: Limit,
      }), request.query);
      authorize(principalOf(request), 'billing.read', q.facilityId);
      return { items: await listCharges(db, callerOf(request), { ...q, unbilledOnly: q.unbilled === 'true' }) };
    });

    r.get('/v1/billing/invoices', async (request) => {
      const q = parse(z.object({
        facilityId: uuid, patientId: uuid.optional(), status: z.enum(['draft', 'issued', 'partially_paid', 'paid', 'void', 'credited']).optional(),
        from: isoDate.optional(), to: isoDate.optional(), limit: Limit,
      }), request.query);
      authorize(principalOf(request), 'billing.read', q.facilityId);
      return { items: await listInvoices(db, callerOf(request), q) };
    });

    r.get('/v1/billing/invoices/:invoiceId', async (request) => {
      const { invoiceId } = parse(Id('invoiceId'), request.params) as { invoiceId: string };
      await scoped(request, 'billing.invoice', invoiceId, 'billing.read');
      return getInvoice(db, callerOf(request), invoiceId);
    });

    r.get('/v1/billing/payments', async (request) => {
      const q = parse(z.object({ facilityId: uuid, patientId: uuid.optional(), date: isoDate.optional(), limit: Limit }), request.query);
      authorize(principalOf(request), 'billing.read', q.facilityId);
      return { items: await listPayments(db, callerOf(request), q) };
    });

    r.get('/v1/billing/refunds', async (request) => {
      const q = parse(z.object({ facilityId: uuid, status: z.enum(['requested', 'approved', 'rejected', 'paid']).optional(), limit: Limit }), request.query);
      authorize(principalOf(request), 'billing.read', q.facilityId);
      return { items: await listRefunds(db, callerOf(request), q) };
    });

    r.get('/v1/billing/cashier-shifts', async (request) => {
      const q = parse(z.object({ facilityId: uuid, status: z.enum(['open', 'closed', 'verified']).optional(), limit: Limit }), request.query);
      authorize(principalOf(request), 'billing.read', q.facilityId);
      return { items: await listShifts(db, callerOf(request), q) };
    });

    // ---- charges ---------------------------------------------------------------------------------------
    r.post('/v1/billing/charges', async (request, reply) => {
      const body = parse(z.object({
        facilityId: uuid, patientId: uuid, encounterId: uuid.optional(), serviceItemId: uuid.optional(),
        description: z.string().trim().min(1).max(300).optional(), quantity: z.number().positive().max(100_000).default(1),
        unitPriceMinor: Minor.optional(), serviceDate: isoDate.optional(),
      }), request.body);
      authorize(principalOf(request), 'billing.charge', body.facilityId);
      return reply.status(201).send(await postManualCharge(db, callerOf(request), body, idempotencyKey(request)));
    });

    r.post('/v1/billing/charges/:chargeId/reverse', async (request) => {
      const { chargeId } = parse(Id('chargeId'), request.params) as { chargeId: string };
      const body = parse(z.object({ reason: Reason, version: Version }), request.body);
      await scoped(request, 'billing.charge', chargeId, 'billing.charge');
      return reverseCharge(db, callerOf(request), { chargeId, ...body }, optionalIdempotencyKey(request));
    });

    r.post('/v1/billing/charges/:chargeId/discounts', async (request, reply) => {
      const { chargeId } = parse(Id('chargeId'), request.params) as { chargeId: string };
      const body = parse(z.object({ amountMinor: Positive, reason: Reason }), request.body);
      const facilityId = await scoped(request, 'billing.charge', chargeId, 'billing.charge');
      const canApprove = can(principalOf(request), 'billing.approve', facilityId);
      return reply.status(201).send(await requestDiscount(db, callerOf(request), { chargeId, ...body, canApprove }, idempotencyKey(request)));
    });

    r.post('/v1/billing/discounts/:adjustmentId/decision', async (request) => {
      const { adjustmentId } = parse(Id('adjustmentId'), request.params) as { adjustmentId: string };
      const body = parse(z.object({ decision: z.enum(['approved', 'rejected']), note: z.string().trim().max(500).optional(), version: Version }), request.body);
      const facilityId = await adjustmentFacility(db, callerOf(request), adjustmentId);
      if (!facilityId) throw new DomainError('not_found', 'discount request not found');
      authorize(principalOf(request), 'billing.approve', facilityId);
      return decideDiscount(db, callerOf(request), { adjustmentId, ...body }, optionalIdempotencyKey(request));
    });

    // ---- invoices --------------------------------------------------------------------------------------
    r.post('/v1/billing/invoices', async (request, reply) => {
      const body = parse(z.object({
        facilityId: uuid, patientId: uuid.optional(), chargeIds: z.array(uuid).min(1).max(200).optional(), dispenseId: uuid.optional(),
        billToName: z.string().trim().min(1).max(200).optional(), billToPhone: z.string().trim().min(6).max(20).optional(),
      }), request.body);
      authorize(principalOf(request), 'billing.invoice', body.facilityId);
      return reply.status(201).send(await draftInvoice(db, callerOf(request), body, idempotencyKey(request)));
    });

    r.post('/v1/billing/invoices/:invoiceId/issue', async (request) => {
      const { invoiceId } = parse(Id('invoiceId'), request.params) as { invoiceId: string };
      const body = parse(z.object({ version: Version }), request.body);
      await scoped(request, 'billing.invoice', invoiceId, 'billing.invoice');
      return issueInvoice(db, callerOf(request), { invoiceId, ...body }, idempotencyKey(request));
    });

    r.post('/v1/billing/invoices/:invoiceId/void', async (request) => {
      const { invoiceId } = parse(Id('invoiceId'), request.params) as { invoiceId: string };
      const body = parse(z.object({ reason: Reason, version: Version }), request.body);
      await scoped(request, 'billing.invoice', invoiceId, 'billing.invoice');
      return voidInvoice(db, callerOf(request), { invoiceId, ...body }, optionalIdempotencyKey(request));
    });

    r.post('/v1/billing/invoices/:invoiceId/credit-notes', async (request, reply) => {
      const { invoiceId } = parse(Id('invoiceId'), request.params) as { invoiceId: string };
      const body = parse(z.object({ chargeIds: z.array(uuid).min(1).max(200), reason: Reason }), request.body);
      await scoped(request, 'billing.invoice', invoiceId, 'billing.approve');
      return reply.status(201).send(await issueCreditNote(db, callerOf(request), { invoiceId, ...body }, idempotencyKey(request)));
    });

    // ---- payments and refunds --------------------------------------------------------------------------
    r.post('/v1/billing/payments', async (request, reply) => {
      const body = parse(z.object({
        facilityId: uuid, patientId: uuid.optional(), payerName: z.string().trim().min(1).max(200).optional(), method: Method,
        amountMinor: Positive, referenceNo: z.string().trim().min(1).max(100).optional(), allocations: Allocations.default([]),
      }), request.body);
      authorize(principalOf(request), 'billing.collect', body.facilityId);
      return reply.status(201).send(await recordPayment(db, callerOf(request), body, idempotencyKey(request)));
    });

    r.post('/v1/billing/payments/:paymentId/allocations', async (request) => {
      const { paymentId } = parse(Id('paymentId'), request.params) as { paymentId: string };
      const body = parse(z.object({ allocations: Allocations.min(1) }), request.body);
      await scoped(request, 'billing.payment', paymentId, 'billing.collect');
      return allocatePayment(db, callerOf(request), { paymentId, ...body }, idempotencyKey(request));
    });

    r.post('/v1/billing/refunds', async (request, reply) => {
      const body = parse(z.object({ paymentId: uuid, amountMinor: Positive, reason: Reason, method: Method, creditNoteId: uuid.optional() }), request.body);
      await scoped(request, 'billing.payment', body.paymentId, 'billing.refund');
      return reply.status(201).send(await requestRefund(db, callerOf(request), body, idempotencyKey(request)));
    });

    r.post('/v1/billing/refunds/:refundId/decision', async (request) => {
      const { refundId } = parse(Id('refundId'), request.params) as { refundId: string };
      const body = parse(z.object({ decision: z.enum(['approved', 'rejected']), version: Version }), request.body);
      await scoped(request, 'billing.refund', refundId, 'billing.approve');
      return decideRefund(db, callerOf(request), { refundId, ...body }, optionalIdempotencyKey(request));
    });

    r.post('/v1/billing/refunds/:refundId/pay', async (request) => {
      const { refundId } = parse(Id('refundId'), request.params) as { refundId: string };
      const body = parse(z.object({ referenceNo: z.string().trim().min(1).max(100).optional(), version: Version }), request.body);
      await scoped(request, 'billing.refund', refundId, 'billing.refund');
      return payRefund(db, callerOf(request), { refundId, ...body }, idempotencyKey(request));
    });

    // ---- inpatient stays: accounts, deposits, statement, final bill ------------------------------------
    const atAccount = async (request: FastifyRequest, accountId: string, permission: string) => {
      const facilityId = await accountFacility(db, callerOf(request), accountId);
      if (!facilityId) throw new DomainError('not_found', 'stay account not found');
      authorize(principalOf(request), permission, facilityId);
    };

    r.get('/v1/billing/accounts', async (request) => {
      const q = parse(z.object({ facilityId: uuid, status: z.enum(['open', 'final_billed', 'settled', 'closed']).optional(), admissionId: uuid.optional(), limit: Limit }), request.query);
      authorize(principalOf(request), 'billing.read', q.facilityId);
      return { items: await listStayAccounts(db, callerOf(request), q) };
    });

    r.get('/v1/billing/accounts/:accountId/statement', async (request) => {
      const { accountId } = parse(Id('accountId'), request.params) as { accountId: string };
      await atAccount(request, accountId, 'billing.read');
      return stayStatement(db, callerOf(request), accountId);
    });

    r.post('/v1/billing/accounts/:accountId/deposits', async (request, reply) => {
      const { accountId } = parse(Id('accountId'), request.params) as { accountId: string };
      const body = parse(z.object({ method: Method, amountMinor: Positive, referenceNo: z.string().trim().min(1).max(100).optional() }), request.body);
      await atAccount(request, accountId, 'billing.collect');
      return reply.status(201).send(await takeDeposit(db, callerOf(request), { accountId, ...body }, idempotencyKey(request)));
    });

    r.post('/v1/billing/accounts/:accountId/final-invoice', async (request, reply) => {
      const { accountId } = parse(Id('accountId'), request.params) as { accountId: string };
      await atAccount(request, accountId, 'billing.invoice');
      return reply.status(201).send(await finalInvoice(db, callerOf(request), { accountId }, idempotencyKey(request)));
    });

    r.get('/v1/billing/deposit-alerts', async (request) => {
      const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
      authorize(principalOf(request), 'billing.read', facilityId);
      return { items: await depositAlerts(db, callerOf(request), facilityId) };
    });

    r.put('/v1/billing/deposit-rules', async (request) => {
      const body = parse(z.object({ facilityId: uuid, bedCategoryId: uuid.optional(), minDepositMinor: Minor, alertBelowMinor: Minor }), request.body);
      authorize(principalOf(request), 'billing.settings', body.facilityId);
      return setDepositRule(db, callerOf(request), body, idempotencyKey(request));
    });

    // ---- cashier shifts --------------------------------------------------------------------------------
    r.post('/v1/billing/cashier-shifts', async (request, reply) => {
      const body = parse(z.object({ facilityId: uuid, openingFloatMinor: Minor.default(0) }), request.body);
      authorize(principalOf(request), 'billing.collect', body.facilityId);
      return reply.status(201).send(await openCashierShift(db, callerOf(request), body, idempotencyKey(request)));
    });

    r.post('/v1/billing/cashier-shifts/:shiftId/close', async (request) => {
      const { shiftId } = parse(Id('shiftId'), request.params) as { shiftId: string };
      const body = parse(z.object({ countedCashMinor: Minor, note: z.string().trim().max(500).optional(), version: Version }), request.body);
      await scoped(request, 'billing.cashier_shift', shiftId, 'billing.collect');
      return closeCashierShift(db, callerOf(request), { shiftId, ...body }, optionalIdempotencyKey(request));
    });

    r.post('/v1/billing/cashier-shifts/:shiftId/verify', async (request) => {
      const { shiftId } = parse(Id('shiftId'), request.params) as { shiftId: string };
      const body = parse(z.object({ version: Version }), request.body);
      await scoped(request, 'billing.cashier_shift', shiftId, 'billing.approve');
      return verifyCashierShift(db, callerOf(request), { shiftId, ...body }, optionalIdempotencyKey(request));
    });
  });
}
