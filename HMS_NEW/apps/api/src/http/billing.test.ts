// Billing over HTTP: a checked-in consultation is charged at its booked fee (worker consumer) → the
// front desk adds a manual charge → bills, issues (bill of supply, numbered) → takes cash in a shift →
// receipt → partial credit and refund → day close. Also: module switch, discounts within/over the role
// limit, the s.269ST cash limit, cancellation reversing an unbilled consultation, and taxable lines.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let admin: Person;
let desk: Person;
let cashier: Person;
let doctor: Person;
let monday: string;
let dressing: string;

const ist = (time: string) => `${monday}T${time}:00+05:30`;
const one = async (text: string, values: unknown[]) => (await k.admin.query<{ id: string }>(text, values)).rows[0]!.id;
const f = () => k.tenant.facilityId;

/** Books a new patient with the doctor at `slot` and checks them in; the worker then charges the visit. */
async function checkedIn(slot: string, name: string) {
  const hold = await k.call(desk, 'POST', '/v1/holds', { staffId: doctor.staffId, slotStart: ist(slot) }, true, ist('07:00'));
  expect(hold.status).toBe(201);
  const patient = await k.call(desk, 'POST', '/v1/patients', { givenName: name, sex: 'female', registeredFacilityId: f(), source: 'front_desk' });
  const appt = await k.call(desk, 'POST', '/v1/appointments', { reservationId: hold.body.reservationId, patientId: patient.body.patientId, originChannel: 'front_desk' }, true, ist('07:00'));
  expect(appt.status).toBe(201);
  expect((await k.call(desk, 'POST', `/v1/appointments/${appt.body.appointmentId}/check-in`, {}, true, ist('08:30'))).status).toBe(200);
  await k.dispatch();
  return { appointmentId: appt.body.appointmentId as string, patientId: patient.body.patientId as string };
}

const charges = async (patientId: string) => (await k.call(desk, 'GET', `/v1/billing/charges?facilityId=${f()}&patientId=${patientId}`)).body.items;

beforeAll(async () => {
  k = await startKit('billing');
  admin = await k.person('Meera Admin', 'tenant_admin', null);
  desk = await k.person('Ravi Desk', 'front_desk', f());
  cashier = await k.person('Kavya Cashier', 'cashier', f());
  doctor = await k.person('Dr Anand', 'doctor', null, 'doctor');
  const t = k.tenant.tenantId;
  const dept = await one(`INSERT INTO platform.department (tenant_id, facility_id, code, name, kind) VALUES ($1, $2, 'GM', 'General Medicine', 'clinical') RETURNING id`, [t, f()]);
  await k.admin.query(`INSERT INTO catalog.practitioner_affiliation (tenant_id, staff_id, facility_id, department_id, valid_from) VALUES ($1, $2, $3, $4, '2024-01-01')`, [t, doctor.staffId, f(), dept]);
  const consult = await one(`INSERT INTO catalog.service_item (tenant_id, code, name, category, sac_code) VALUES ($1, 'CONS', 'Consultation', 'consultation', '999312') RETURNING id`, [t]);
  dressing = await one(`INSERT INTO catalog.service_item (tenant_id, code, name, category) VALUES ($1, 'DRESS', 'Wound dressing', 'procedure') RETURNING id`, [t]);
  const hs = await one(`INSERT INTO catalog.healthcare_service (tenant_id, department_id, code, name, consultation_service_item_id) VALUES ($1, $2, 'GM-OPD', 'GM OPD', $3) RETURNING id`, [t, dept, consult]);
  const list = await one(`INSERT INTO catalog.price_list (tenant_id, code, name, kind, valid_from, is_default) VALUES ($1, 'CASH-STD', 'Standard', 'cash', '2024-01-01', true) RETURNING id`, [t]);
  await k.admin.query(`INSERT INTO catalog.price_list_item (tenant_id, price_list_id, service_item_id, unit_price_minor, valid_from) VALUES ($1, $2, $3, 50000, '2024-01-01'), ($1, $2, $4, 20000, '2024-01-01')`, [t, list, consult, dressing]);
  await k.admin.query(`UPDATE catalog.price_list SET status = 'active', activated_at = now() WHERE id = $1`, [list]);
  monday = (await k.admin.query<{ d: string }>(`SELECT (date_trunc('week', now() AT TIME ZONE 'Asia/Kolkata') + interval '14 days')::date::text AS d`)).rows[0]!.d;
  await k.call(admin, 'POST', `/v1/practitioners/${doctor.staffId}/calendar`);
  const session = await k.call(admin, 'POST', `/v1/practitioners/${doctor.staffId}/weekly-sessions`, {
    facilityId: f(), weekday: 1, start: '09:00', end: '12:00', slotMinutes: 15, healthcareServiceId: hs, effectiveFrom: '2024-01-01',
  });
  expect(session.status).toBe(201);
});
afterAll(() => k.close());

describe('billing module switch', () => {
  it('billing routes answer module_inactive and consultations are not charged until billing is switched on', async () => {
    const off = await k.call(desk, 'GET', `/v1/billing/summary?facilityId=${f()}&date=${monday}`);
    expect(off.status).toBe(422);
    expect(off.body.error.details).toMatchObject({ reason: 'module_inactive', module: 'billing' });
    const visit = await checkedIn('09:00', 'Before Billing');
    const mod = (await k.call(admin, 'GET', '/v1/modules')).body.items.find((m: { module: string }) => m.module === 'billing');
    expect((await k.call(admin, 'PUT', '/v1/modules/billing', { state: 'active', version: mod.version, reason: 'Clinic starts billing' })).status).toBe(200);
    // The check-in happened while billing was off: the worker skipped it for good.
    expect(await charges(visit.patientId)).toEqual([]);
  });
});

describe('an outpatient bill from check-in to day close', () => {
  it('charges, bills, collects, credits and closes the counter', async () => {
    const { patientId } = await checkedIn('09:15', 'Lata');
    const [consultation] = await charges(patientId);
    expect(consultation).toMatchObject({ sourceType: 'consultation', description: 'Consultation — Dr Anand', netMinor: 50000, isTaxExempt: true, status: 'posted' });

    // A manual charge priced from the list; front desk may not discount beyond its limit (0%) without approval
    const manual = await k.call(desk, 'POST', '/v1/billing/charges', { facilityId: f(), patientId, serviceItemId: dressing, quantity: 1 });
    expect(manual.status).toBe(201);
    expect(manual.body.netMinor).toBe(20000);
    const ask = await k.call(desk, 'POST', `/v1/billing/charges/${manual.body.chargeId}/discounts`, { amountMinor: 5000, reason: 'Senior citizen' });
    expect(ask.body.status).toBe('pending');
    const pending = (await k.admin.query<{ version: number }>('SELECT version FROM billing.charge_adjustment WHERE id = $1', [ask.body.adjustmentId])).rows[0]!;
    expect((await k.call(desk, 'POST', `/v1/billing/discounts/${ask.body.adjustmentId}/decision`, { decision: 'approved', version: pending.version })).status).toBe(403);
    const approved = await k.call(admin, 'POST', `/v1/billing/discounts/${ask.body.adjustmentId}/decision`, { decision: 'approved', version: pending.version });
    expect(approved.body).toMatchObject({ status: 'approved', chargeNetMinor: 15000 });

    // Draft → issue: all exempt lines make a numbered bill of supply
    const draft = await k.call(desk, 'POST', '/v1/billing/invoices', { facilityId: f(), patientId });
    expect(draft.status).toBe(201);
    expect(draft.body).toMatchObject({ lines: 2, netMinor: 65000, discountMinor: 5000 });
    expect((await k.call(desk, 'POST', '/v1/billing/invoices', { facilityId: f(), patientId })).body.error.details.reason).toBe('nothing_to_bill');
    const issued = await k.call(desk, 'POST', `/v1/billing/invoices/${draft.body.invoiceId}/issue`, { version: draft.body.version });
    expect(issued.status).toBe(200);
    expect(issued.body).toMatchObject({ documentType: 'bill_of_supply', status: 'issued' });
    expect(issued.body.invoiceNo).toMatch(/^BOS\/\d{4}-\d{2}\/000001$/);

    // Cash needs an open shift
    const noShift = await k.call(cashier, 'POST', '/v1/billing/payments', { facilityId: f(), patientId, method: 'cash', amountMinor: 65000, allocations: [{ invoiceId: draft.body.invoiceId, amountMinor: 65000 }] });
    expect(noShift.body.error.details.reason).toBe('no_open_shift');
    const shift = await k.call(cashier, 'POST', '/v1/billing/cashier-shifts', { facilityId: f(), openingFloatMinor: 100000 });
    expect(shift.status).toBe(201);
    // Allocating more than is due is refused
    const over = await k.call(cashier, 'POST', '/v1/billing/payments', { facilityId: f(), patientId, method: 'cash', amountMinor: 70000, allocations: [{ invoiceId: draft.body.invoiceId, amountMinor: 70000 }] });
    expect(over.body.error.details.reason).toBe('exceeds_balance');
    const paid = await k.call(cashier, 'POST', '/v1/billing/payments', { facilityId: f(), patientId, method: 'cash', amountMinor: 65000, allocations: [{ invoiceId: draft.body.invoiceId, amountMinor: 65000 }] });
    expect(paid.status).toBe(201);
    expect(paid.body.receiptNo).toMatch(/^RC\/\d{4}-\d{2}\/000001$/);

    const bill = (await k.call(desk, 'GET', `/v1/billing/invoices/${draft.body.invoiceId}`)).body;
    expect(bill).toMatchObject({ status: 'paid', totals: { netMinor: 65000, paidMinor: 65000, balanceMinor: 0 }, billTo: { name: 'Lata' } });
    expect(bill.lines).toHaveLength(2);
    expect(bill.payments).toEqual([expect.objectContaining({ receiptNo: paid.body.receiptNo, method: 'cash', amountMinor: 65000 })]);

    // An issued bill can't be voided once paid; the dressing is credited instead and refunded in cash
    expect((await k.call(desk, 'POST', `/v1/billing/invoices/${draft.body.invoiceId}/void`, { reason: 'mistake', version: bill.version })).body.error.details.reason).toBe('not_voidable');
    const dressingCharge = bill.lines.find((l: { description: string }) => l.description === 'Wound dressing');
    expect((await k.call(cashier, 'POST', `/v1/billing/invoices/${draft.body.invoiceId}/credit-notes`, { chargeIds: [dressingCharge.chargeId], reason: 'Not done' })).status).toBe(403);
    const credit = await k.call(admin, 'POST', `/v1/billing/invoices/${draft.body.invoiceId}/credit-notes`, { chargeIds: [dressingCharge.chargeId], reason: 'Dressing not done' });
    expect(credit.status).toBe(201);
    expect(credit.body).toMatchObject({ amountMinor: 15000, refundableMinor: 15000, invoiceStatus: 'paid' });
    expect(credit.body.noteNo).toMatch(/^CN\/\d{4}-\d{2}\/000001$/);
    const refund = await k.call(cashier, 'POST', '/v1/billing/refunds', { paymentId: paid.body.paymentId, amountMinor: 15000, reason: 'Dressing not done', method: 'cash', creditNoteId: credit.body.creditNoteId });
    expect(refund.status).toBe(201);
    expect((await k.call(cashier, 'POST', '/v1/billing/refunds', { paymentId: paid.body.paymentId, amountMinor: 1, reason: 'again', method: 'cash' })).body.error.details.reason).toBe('exceeds_refundable');
    const decided = await k.call(admin, 'POST', `/v1/billing/refunds/${refund.body.refundId}/decision`, { decision: 'approved', version: refund.body.version });
    expect((await k.call(cashier, 'POST', `/v1/billing/refunds/${refund.body.refundId}/pay`, { version: decided.body.version })).body.status).toBe('paid');

    // Day close: float 1000 + 650 cash − 150 refunded = 1500 expected
    const close = await k.call(cashier, 'POST', `/v1/billing/cashier-shifts/${shift.body.shiftId}/close`, { countedCashMinor: 149000, version: shift.body.version });
    expect(close.body).toMatchObject({ expectedCashMinor: 150000, varianceMinor: -1000 });
    expect((await k.call(cashier, 'POST', `/v1/billing/cashier-shifts/${shift.body.shiftId}/verify`, { version: close.body.version })).status).toBe(403);
    expect((await k.call(admin, 'POST', `/v1/billing/cashier-shifts/${shift.body.shiftId}/verify`, { version: close.body.version })).body.status).toBe('verified');

    // Bills and payments are stamped with today's clinic date (the visit itself is in two weeks).
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const summary = (await k.call(desk, 'GET', `/v1/billing/summary?facilityId=${f()}&date=${today}`)).body;
    expect(summary).toMatchObject({ invoicesIssued: 1, invoicedMinor: 65000, refundsPaidMinor: 15000, openShifts: 0 });
  });

  it('reverses an unbilled consultation when its appointment is cancelled', async () => {
    const { appointmentId, patientId } = await checkedIn('09:30', 'Cancelled Visit');
    expect((await charges(patientId))[0]).toMatchObject({ status: 'posted' });
    const cancel = await k.call(desk, 'POST', `/v1/appointments/${appointmentId}/cancel`, { reason: 'Patient left' }, true, ist('08:45'));
    expect(cancel.status).toBe(200);
    await k.dispatch();
    expect((await charges(patientId))[0]).toMatchObject({ status: 'reversed' });
  });

  it('taxes lines that match a GST rule and refuses cash at the s.269ST limit', async () => {
    await k.admin.query(`INSERT INTO catalog.tax_rule (tenant_id, tax_code, description, service_category, gst_rate_bp, valid_from) VALUES ($1, 'GST18-CERT', 'Certificates', 'misc', 1800, '2024-01-01')`, [k.tenant.tenantId]);
    const cert = await one(`INSERT INTO catalog.service_item (tenant_id, code, name, category) VALUES ($1, 'CERT', 'Fitness certificate', 'misc') RETURNING id`, [k.tenant.tenantId]);
    const patient = await k.call(desk, 'POST', '/v1/patients', { givenName: 'Big Payer', sex: 'male', registeredFacilityId: f(), source: 'front_desk' });
    const c = await k.call(desk, 'POST', '/v1/billing/charges', { facilityId: f(), patientId: patient.body.patientId, serviceItemId: cert, quantity: 1, unitPriceMinor: 30_000_000 });
    expect(c.body.netMinor).toBe(35_400_000);
    const draft = await k.call(desk, 'POST', '/v1/billing/invoices', { facilityId: f(), patientId: patient.body.patientId });
    const issued = await k.call(desk, 'POST', `/v1/billing/invoices/${draft.body.invoiceId}/issue`, { version: draft.body.version });
    expect(issued.body).toMatchObject({ documentType: 'tax_invoice', cgstMinor: 2_700_000, sgstMinor: 2_700_000 });
    expect(issued.body.invoiceNo).toMatch(/^INV\//);
    const shift = await k.call(cashier, 'POST', '/v1/billing/cashier-shifts', { facilityId: f() });
    expect(shift.status).toBe(201);
    const cash = await k.call(cashier, 'POST', '/v1/billing/payments', { facilityId: f(), patientId: patient.body.patientId, method: 'cash', amountMinor: 20_000_000, allocations: [] });
    expect(cash.body.error.details.reason).toBe('cash_limit');
    const upi = await k.call(cashier, 'POST', '/v1/billing/payments', {
      facilityId: f(), patientId: patient.body.patientId, method: 'upi', referenceNo: 'UPI-778899', amountMinor: 35_400_000,
      allocations: [{ invoiceId: draft.body.invoiceId, amountMinor: 35_400_000 }],
    });
    expect(upi.status).toBe(201);
  });
});
