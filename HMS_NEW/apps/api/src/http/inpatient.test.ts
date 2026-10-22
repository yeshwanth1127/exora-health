// Inpatient over HTTP: wards, beds and bed prices → admit into a bed (the worker opens the stay's
// encounter and billing account) → a second patient can't take the same bed → transfer → deposit →
// plan the discharge → departure waits for clearances → the final bill charges the bed days (midnight
// census), applies the deposit and settles → finance clears → departure finishes the encounter and the
// bed goes to cleaning, then back to ready.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chargeableDays } from '../modules/billing/stays.ts';
import { startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let admin: Person;
let desk: Person;
let doctor: Person;
let nurse: Person;
let bedA: string;
let bedB: string;
let icu: string;

const at = (day: string, time: string) => `2026-10-${day}T${time}:00+05:30`;
const f = () => k.tenant.facilityId;
const switchOn = async (module: string) => {
  const m = (await k.call(admin, 'GET', '/v1/modules')).body.items.find((x: { module: string }) => x.module === module);
  return k.call(admin, 'PUT', `/v1/modules/${module}`, { state: 'active', version: m.version, reason: 'Clinic starts inpatient care' });
};
const patient = async (name: string) => (await k.call(desk, 'POST', '/v1/patients', { givenName: name, sex: 'female', registeredFacilityId: f(), source: 'front_desk' })).body.patientId as string;

beforeAll(async () => {
  k = await startKit('inpatient');
  admin = await k.person('Meera Admin', 'tenant_admin', null);
  desk = await k.person('Ravi Desk', 'front_desk', f());
  doctor = await k.person('Dr Anand', 'doctor', null, 'doctor');
  nurse = await k.person('Sister Mary', 'nurse', f(), 'nurse');
});
afterAll(() => k.close());

describe('bed-day counting', () => {
  it('counts midnights, any part of a day, or 24-hour blocks', () => {
    const tz = 'Asia/Kolkata';
    const s = new Date(at('01', '10:00')), e = new Date(at('03', '09:00'));
    expect(chargeableDays(s, e, 'midnight_census', tz)).toEqual(['2026-10-01', '2026-10-02']);
    expect(chargeableDays(s, e, 'calendar_day_any_part', tz)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(chargeableDays(s, e, 'per_24h_from_admit', tz)).toEqual(['2026-10-01', '2026-10-02']);
    expect(chargeableDays(s, new Date(at('01', '18:00')), 'midnight_census', tz)).toEqual([]);
  });
});

describe('an inpatient stay from admission to an empty, clean bed', () => {
  it('refuses inpatient routes until the module is on, and inpatient needs billing', async () => {
    expect((await k.call(desk, 'GET', `/v1/inpatient/bed-board?facilityId=${f()}`)).body.error.details.reason).toBe('module_inactive');
    expect((await switchOn('inpatient')).body.error.details.reason).toBe('module_required');
    expect((await switchOn('billing')).status).toBe(200);
    expect((await switchOn('inpatient')).status).toBe(200);
  });

  it('sets up wards, beds and their daily prices', async () => {
    const general = await k.call(admin, 'POST', '/v1/bed-categories', { code: 'GEN', name: 'General', rank: 1 });
    expect(general.status).toBe(201);
    const icuCat = await k.call(admin, 'POST', '/v1/bed-categories', { code: 'ICU', name: 'ICU', rank: 5, isIcu: true });
    expect((await k.call(admin, 'PUT', `/v1/bed-categories/${general.body.bedCategoryId}/price`, { priceMinor: 150000, effectiveFrom: '2026-01-01' })).status).toBe(200);
    expect((await k.call(admin, 'PUT', `/v1/bed-categories/${icuCat.body.bedCategoryId}/price`, { priceMinor: 500000, effectiveFrom: '2026-01-01' })).status).toBe(200);
    const ward = await k.call(admin, 'POST', `/v1/facilities/${f()}/wards`, { code: 'W1', name: 'General Ward', wardType: 'general' });
    expect(ward.status).toBe(201);
    const icuWard = await k.call(admin, 'POST', `/v1/facilities/${f()}/wards`, { code: 'ICU1', name: 'ICU', wardType: 'icu' });
    bedA = (await k.call(admin, 'POST', `/v1/wards/${ward.body.wardId}/beds`, { code: 'W1-01', name: 'Bed 1', bedCategoryId: general.body.bedCategoryId })).body.bedId;
    bedB = (await k.call(admin, 'POST', `/v1/wards/${ward.body.wardId}/beds`, { code: 'W1-02', name: 'Bed 2', bedCategoryId: general.body.bedCategoryId })).body.bedId;
    icu = (await k.call(admin, 'POST', `/v1/wards/${icuWard.body.wardId}/beds`, { code: 'ICU-01', name: 'ICU 1', bedCategoryId: icuCat.body.bedCategoryId })).body.bedId;
    expect((await k.call(admin, 'POST', `/v1/wards/${ward.body.wardId}/beds`, { code: 'W1-01', name: 'Dup', bedCategoryId: general.body.bedCategoryId })).status).toBe(409);
    const board = (await k.call(desk, 'GET', `/v1/inpatient/bed-board?facilityId=${f()}`)).body;
    expect(board.wards.map((w: { name: string; counts: Record<string, number> }) => [w.name, w.counts])).toEqual([['General Ward', { ready: 2 }], ['ICU', { ready: 1 }]]);
  });

  it('admits, transfers, bills the stay with its deposit and discharges', async () => {
    const lata = await patient('Lata');
    const admitted = await k.call(desk, 'POST', '/v1/admissions', {
      facilityId: f(), patientId: lata, admittingStaffId: doctor.staffId, admissionType: 'emergency', admissionReason: 'Dengue with low platelets', bedId: bedA,
    }, true, at('01', '10:00'));
    expect(admitted.status).toBe(201);
    expect(admitted.body.ipNo).toMatch(/^IP\/2026-27\/000001$/);
    await k.dispatch();

    // The bed is taken; the same patient can't be admitted twice
    const other = await patient('Asha');
    const clash = await k.call(desk, 'POST', '/v1/admissions', { facilityId: f(), patientId: other, admittingStaffId: doctor.staffId, admissionType: 'elective', admissionReason: 'Observation', bedId: bedA }, true, at('01', '11:00'));
    expect(clash.body.error.details.reason).toBe('bed_not_ready');
    expect((await k.call(desk, 'POST', '/v1/admissions', { facilityId: f(), patientId: lata, admittingStaffId: doctor.staffId, admissionType: 'elective', admissionReason: 'Again' }, true, at('01', '11:00'))).body.error.details.reason).toBe('already_admitted');

    let stay = (await k.call(desk, 'GET', `/v1/admissions/${admitted.body.admissionId}`)).body;
    expect(stay.encounter).toMatchObject({ status: 'arrived' });
    expect(stay.encounter.encounterNo).toMatch(/^IP-/);
    expect(stay.billingAccount).toMatchObject({ accountNo: admitted.body.ipNo, status: 'open' });
    // The stay's encounter can't be finished from the consultation screen
    const enc = await k.call(doctor, 'POST', `/v1/encounters/${stay.encounter.encounterId}/finish`, { disposition: 'discharged_home' });
    expect(enc.body.error.details.reason).toBe('discharge_admission');

    // Move to bed 2 the next morning; bed 1 goes to cleaning
    const moved = await k.call(desk, 'POST', `/v1/admissions/${stay.admissionId}/transfer`, { toBedId: bedB, reason: 'Nearer the nursing station', version: stay.version }, true, at('02', '10:00'));
    expect(moved.status).toBe(200);
    let board = (await k.call(desk, 'GET', `/v1/inpatient/bed-board?facilityId=${f()}`)).body;
    const beds = Object.fromEntries(board.wards.flatMap((w: { beds: { bedId: string; status: string }[] }) => w.beds.map((b) => [b.bedId, b.status])));
    expect(beds).toMatchObject({ [bedA]: 'dirty', [bedB]: 'occupied', [icu]: 'ready' });
    expect((await k.call(desk, 'POST', `/v1/beds/${bedA}/ready`, {})).body.status).toBe('ready');

    // A deposit by UPI against the stay
    const account = stay.billingAccount.accountId;
    const deposit = await k.call(desk, 'POST', `/v1/billing/accounts/${account}/deposits`, { method: 'upi', amountMinor: 500000, referenceNo: 'UPI-DEP-1' });
    expect(deposit.status).toBe(201);
    expect(deposit.body.receiptNo).toMatch(/^RC\//);

    // The final bill needs a planned discharge
    expect((await k.call(desk, 'POST', `/v1/billing/accounts/${account}/final-invoice`, {}, true, at('04', '09:00'))).body.error.details.reason).toBe('discharge_not_planned');
    stay = (await k.call(desk, 'GET', `/v1/admissions/${stay.admissionId}`)).body;
    const plan = await k.call(doctor, 'POST', `/v1/admissions/${stay.admissionId}/discharge`, { dischargeType: 'routine', version: stay.version }, true, at('04', '08:00'));
    expect(plan.status).toBe(201);
    const dischargeId = plan.body.dischargeId;
    expect((await k.call(desk, 'POST', `/v1/discharges/${dischargeId}/depart`, {})).body.error.details).toMatchObject({ reason: 'clearances_pending', pending: ['clinical', 'finance', 'nursing'] });
    expect((await k.call(nurse, 'POST', `/v1/discharges/${dischargeId}/clearances/clinical/clear`, {})).body.error.details.reason).toBe('wrong_clinician');
    expect((await k.call(doctor, 'POST', `/v1/discharges/${dischargeId}/clearances/clinical/clear`, {})).body.status).toBe('cleared');
    expect((await k.call(nurse, 'POST', `/v1/discharges/${dischargeId}/clearances/nursing/clear`, { note: 'Cannula removed' })).body.status).toBe('cleared');
    expect((await k.call(doctor, 'POST', `/v1/discharges/${dischargeId}/clearances/finance/clear`, {})).body.error.details.reason).toBe('finance_by_billing');

    // Final bill: bed 1 for Oct 1 (one midnight) + bed 2 for Oct 2 and 3 = 3 × ₹1,500; the ₹5,000 deposit covers it
    const statement = (await k.call(desk, 'GET', `/v1/billing/accounts/${account}/statement`)).body;
    expect(statement).toMatchObject({ depositsMinor: 500000, chargedMinor: 0, creditMinor: 500000 });
    const final = await k.call(desk, 'POST', `/v1/billing/accounts/${account}/final-invoice`, {}, true, at('04', '10:00'));
    expect(final.status).toBe(201);
    expect(final.body).toMatchObject({ netMinor: 450000, documentType: 'bill_of_supply', depositsAppliedMinor: 450000, balanceMinor: 0, refundableDepositMinor: 50000, accountStatus: 'settled' });
    const bill = (await k.call(desk, 'GET', `/v1/billing/invoices/${final.body.invoiceId}`)).body;
    expect(bill.lines.map((l: { serviceDate: string; description: string }) => [l.serviceDate, l.description])).toEqual([
      ['2026-10-01', 'Bed charges — General (Bed 1)'],
      ['2026-10-02', 'Bed charges — General (Bed 2)'],
      ['2026-10-03', 'Bed charges — General (Bed 2)'],
    ]);
    expect((await k.call(desk, 'POST', `/v1/billing/accounts/${account}/final-invoice`, {}, true, at('04', '10:05'))).body.error.details.reason).toBe('account_not_open');

    // Settlement clears finance (worker); the patient leaves; the encounter finishes; the bed goes to cleaning
    await k.dispatch();
    const departed = await k.call(desk, 'POST', `/v1/discharges/${dischargeId}/depart`, {}, true, at('04', '11:00'));
    expect(departed.body.status).toBe('departed');
    await k.dispatch();
    stay = (await k.call(desk, 'GET', `/v1/admissions/${stay.admissionId}`)).body;
    expect(stay).toMatchObject({ status: 'discharged', encounter: { status: 'finished' }, discharge: { status: 'departed' } });
    board = (await k.call(desk, 'GET', `/v1/inpatient/bed-board?facilityId=${f()}`)).body;
    const after = board.wards.flatMap((w: { beds: { bedId: string; status: string; occupant: unknown }[] }) => w.beds).find((b: { bedId: string }) => b.bedId === bedB);
    expect(after).toMatchObject({ status: 'dirty', occupant: null });

    // The excess deposit is refundable from its payment
    const refund = await k.call(desk, 'POST', '/v1/billing/refunds', { paymentId: deposit.body.paymentId, amountMinor: 50000, reason: 'Deposit balance', method: 'upi' });
    expect(refund.status).toBe(403);   // the front desk role may not refund
    expect((await k.call(admin, 'POST', '/v1/billing/refunds', { paymentId: deposit.body.paymentId, amountMinor: 50000, reason: 'Deposit balance', method: 'upi' })).status).toBe(201);
  });

  it('waits for a bed, and cancels an admission made in error', async () => {
    const asha = await patient('Asha Pending');
    const pending = await k.call(desk, 'POST', '/v1/admissions', { facilityId: f(), patientId: asha, admittingStaffId: doctor.staffId, admissionType: 'elective', admissionReason: 'Planned surgery' });
    expect(pending.body.status).toBe('bed_pending');
    expect((await k.call(desk, 'GET', `/v1/inpatient/bed-board?facilityId=${f()}`)).body.bedPending).toBe(1);
    const placed = await k.call(desk, 'POST', `/v1/admissions/${pending.body.admissionId}/assign-bed`, { bedId: icu, version: pending.body.version });
    expect(placed.body.status).toBe('admitted');
    await k.dispatch();
    const cancelled = await k.call(desk, 'POST', `/v1/admissions/${pending.body.admissionId}/cancel`, { reason: 'Admitted the wrong patient', version: placed.body.version });
    expect(cancelled.body.status).toBe('cancelled');
    await k.dispatch();
    const stay = (await k.call(desk, 'GET', `/v1/admissions/${pending.body.admissionId}`)).body;
    expect(stay).toMatchObject({ status: 'cancelled', encounter: { status: 'cancelled' }, billingAccount: { status: 'closed' } });
  });
});
