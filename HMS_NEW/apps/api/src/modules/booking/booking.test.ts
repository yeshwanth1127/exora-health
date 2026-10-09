// End-to-end booking flow against real PostgreSQL, running as the application role:
// doctor calendar → slots → hold → book → reschedule/cancel → check-in → queue → completed.
// The clock is pinned to a Monday two weeks ahead (Asia/Kolkata) so results never depend on today.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, sql } from '@hms/db';
import { DomainError, type Actor } from '@hms/platform';
import { config } from '../../../../../db/scripts/config.mjs';
import { adminPool, createTenant, type TenantFixture } from '../../../../../db/tests/db.ts';
import type { Caller } from '../../caller.ts';
import { registerPatient } from '../patient/register.ts';
import {
  addFacilityHoliday,
  addScheduleException,
  addWeeklySession,
  bookAppointment,
  bookWalkIn,
  callNext,
  cancelAppointment,
  checkIn,
  completeService,
  createPractitionerCalendar,
  holdSlot,
  listQueue,
  listSessions,
  listSlots,
  markNoShow,
  releaseHold,
  rescheduleAppointment,
  saveDayPlan,
  startService,
} from './index.ts';

const admin = adminPool();
const db = createDb({ connectionString: config.testAppDatabaseUrl, maxConnections: 25 });

let t: TenantFixture;
let facility2: string;
let doctor: string;
let doctor2: string;
let frontDesk: string;
let monday: string; // 'YYYY-MM-DD', two weeks ahead
let tuesday: string;

/** An instant at a local Asia/Kolkata wall-clock time. */
const ist = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`);
const caller = (now: Date, staffId = frontDesk): Caller => ({ tenantId: t.tenantId, actor: { kind: 'staff', staffId } satisfies Actor, now });

async function expectDomainError(promise: Promise<unknown>, code: DomainError['code'], reason?: string) {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
  if (reason) expect((err as DomainError).details?.['reason']).toBe(reason);
}

async function newPatient(name: string) {
  return (await registerPatient(db, caller(new Date()), { givenName: name, sex: 'female', registeredFacilityId: t.facilityId, source: 'front_desk' })).patientId;
}

beforeAll(async () => {
  t = await createTenant(admin, 'booking');
  const q = (text: string, values: unknown[] = []) => admin.query(text, values);
  const one = async (text: string, values: unknown[] = []) => (await q(text, values)).rows[0] as { id: string };

  facility2 = (await one(
    `INSERT INTO platform.facility (tenant_id, organization_id, code, name, facility_type, state_code)
     VALUES ($1, $2, 'F2', 'Branch 2', 'clinic', '29') RETURNING id`,
    [t.tenantId, t.organizationId],
  )).id;
  const dept1 = (await one(`INSERT INTO platform.department (tenant_id, facility_id, code, name, kind) VALUES ($1, $2, 'GM', 'General Medicine', 'clinical') RETURNING id`, [t.tenantId, t.facilityId])).id;
  const dept2 = (await one(`INSERT INTO platform.department (tenant_id, facility_id, code, name, kind) VALUES ($1, $2, 'GM', 'General Medicine', 'clinical') RETURNING id`, [t.tenantId, facility2])).id;
  const staff = async (no: string, name: string, type: string) =>
    (await one(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, $2, $3, $3, $4) RETURNING id`, [t.tenantId, no, name, type])).id;
  doctor = await staff('D1', 'Dr One', 'doctor');
  doctor2 = await staff('D2', 'Dr Two', 'doctor');
  frontDesk = await staff('F1', 'Front Desk', 'admin');
  for (const [d, f, dep] of [[doctor, t.facilityId, dept1], [doctor, facility2, dept2], [doctor2, t.facilityId, dept1]] as const) {
    await q(`INSERT INTO catalog.practitioner_affiliation (tenant_id, staff_id, facility_id, department_id, valid_from) VALUES ($1, $2, $3, $4, '2024-01-01')`, [t.tenantId, d, f, dep]);
  }
  const consult = (await one(`INSERT INTO catalog.service_item (tenant_id, code, name, category) VALUES ($1, 'CONS', 'Consultation', 'consultation') RETURNING id`, [t.tenantId])).id;
  await q(`INSERT INTO catalog.healthcare_service (tenant_id, department_id, code, name, consultation_service_item_id) VALUES ($1, $2, 'GM-OPD', 'GM OPD', $3)`, [t.tenantId, dept1, consult]);
  const list = (await one(`INSERT INTO catalog.price_list (tenant_id, code, name, kind, valid_from) VALUES ($1, 'CASH', 'Cash', 'cash', '2024-01-01') RETURNING id`, [t.tenantId])).id;
  await q(
    `INSERT INTO catalog.price_list_item (tenant_id, price_list_id, service_item_id, staff_id, unit_price_minor, valid_from)
     VALUES ($1, $2, $3, NULL, 50000, '2024-01-01'), ($1, $2, $3, $4, 70000, '2024-01-01')`,
    [t.tenantId, list, consult, doctor],
  );
  await q(`UPDATE catalog.price_list SET status = 'active', activated_at = now(), is_default = true WHERE id = $1`, [list]);

  const { rows: [d] } = await admin.query<{ monday: string; tuesday: string }>(
    `SELECT (date_trunc('week', now() AT TIME ZONE 'Asia/Kolkata') + interval '14 days')::date::text AS monday,
            (date_trunc('week', now() AT TIME ZONE 'Asia/Kolkata') + interval '15 days')::date::text AS tuesday`,
  );
  monday = d!.monday;
  tuesday = d!.tuesday;
});

afterAll(async () => {
  await db.destroy();
  await admin.end();
});

const hsId = async () => (await admin.query<{ id: string }>(`SELECT id FROM catalog.healthcare_service WHERE tenant_id = $1 AND code = 'GM-OPD'`, [t.tenantId])).rows[0]!.id;

describe('doctor calendar', () => {
  it('creates one calendar per doctor (idempotent)', async () => {
    const first = await createPractitionerCalendar(db, caller(new Date()), { staffId: doctor });
    const again = await createPractitionerCalendar(db, caller(new Date()), { staffId: doctor });
    expect(first.created).toBe(true);
    expect(again).toEqual({ resourceId: first.resourceId, created: false });
    await createPractitionerCalendar(db, caller(new Date()), { staffId: doctor2 });
  });

  it('adds weekly sessions and computes slots', async () => {
    const healthcareServiceId = await hsId();
    // Monday 09:00–11:00, 15-minute slots, plus a 17:00–18:00 walk-in session (5 tokens)
    await addWeeklySession(db, caller(new Date()), { staffId: doctor, facilityId: t.facilityId, weekday: 1, start: '09:00', end: '11:00', slotMinutes: 15, healthcareServiceId, effectiveFrom: '2024-01-01' });
    await addWeeklySession(db, caller(new Date()), { staffId: doctor, facilityId: t.facilityId, weekday: 1, start: '17:00', end: '18:00', maxWalkInTokens: 5, healthcareServiceId, effectiveFrom: '2024-01-01' });
    // Tuesday at the second branch
    await addWeeklySession(db, caller(new Date()), { staffId: doctor, facilityId: facility2, weekday: 2, start: '10:00', end: '12:00', slotMinutes: 30, effectiveFrom: '2024-01-01' });
    // Second doctor: Monday 09:00–10:00, 15-minute slots
    await addWeeklySession(db, caller(new Date()), { staffId: doctor2, facilityId: t.facilityId, weekday: 1, start: '09:00', end: '10:00', slotMinutes: 15, healthcareServiceId, effectiveFrom: '2024-01-01' });

    const slots = await listSlots(db, caller(ist(monday, '07:00')), { staffId: doctor, from: monday, to: tuesday });
    expect(slots.filter((s) => s.facilityId === t.facilityId)).toHaveLength(8);
    expect(slots.filter((s) => s.facilityId === facility2)).toHaveLength(4);
    expect(slots[0]!.slotStart).toEqual(ist(monday, '09:00'));
    expect(slots.at(-1)!.slotStart).toEqual(ist(tuesday, '11:30'));
  });

  it("refuses a session that overlaps the doctor's session at another branch", async () => {
    await expectDomainError(
      addWeeklySession(db, caller(new Date()), { staffId: doctor, facilityId: facility2, weekday: 1, start: '10:30', end: '12:00', slotMinutes: 15, effectiveFrom: '2024-01-01' }),
      'conflict',
    );
  });

  it('refuses sessions where the doctor is not affiliated', async () => {
    await expectDomainError(
      addWeeklySession(db, caller(new Date()), { staffId: doctor2, facilityId: facility2, weekday: 3, start: '09:00', end: '10:00', slotMinutes: 15, effectiveFrom: '2024-01-01' }),
      'precondition_failed',
    );
  });

  it('hides past slots', async () => {
    const slots = await listSlots(db, caller(ist(monday, '10:05')), { staffId: doctor, from: monday, to: monday });
    expect(slots.map((s) => s.slotStart)).toEqual([ist(monday, '10:15'), ist(monday, '10:30'), ist(monday, '10:45')]);
  });
});

describe('leave, blocks, holidays and day plans', () => {
  const nextMonday = () => {
    const d = new Date(`${monday}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  };

  it('a blocked window shows as blocked and cannot be held', async () => {
    const day = nextMonday();
    await addScheduleException(db, caller(new Date()), { staffId: doctor2, onDate: day, kind: 'block', start: '09:15', end: '09:45', reason: 'Ward round' });
    const all = await listSlots(db, caller(ist(day, '07:00')), { staffId: doctor2, from: day, to: day, includeUnavailable: true });
    expect(all.map((s) => s.status)).toEqual(['free', 'blocked', 'blocked', 'free']);
    await expectDomainError(holdSlot(db, caller(ist(day, '07:00')), { staffId: doctor2, slotStart: ist(day, '09:15') }), 'conflict', 'slot_blocked');
  });

  it('whole-day leave and facility holidays remove the day; extra hours and day plans add or replace sessions', async () => {
    const day = nextMonday();
    await addFacilityHoliday(db, caller(new Date()), { facilityId: t.facilityId, date: day, name: 'Test holiday' });
    expect(await listSlots(db, caller(ist(day, '07:00')), { staffId: doctor, from: day, to: day })).toEqual([]);

    // Extra Wednesday hours at branch 2
    const wed = new Date(`${day}T00:00:00Z`);
    wed.setUTCDate(wed.getUTCDate() + 2);
    const wedDay = wed.toISOString().slice(0, 10);
    await addScheduleException(db, caller(new Date()), { staffId: doctor, onDate: wedDay, kind: 'extra_hours', facilityId: facility2, start: '14:00', end: '15:00', slotMinutes: 20 });
    expect(await listSlots(db, caller(ist(wedDay, '07:00')), { staffId: doctor, from: wedDay, to: wedDay })).toHaveLength(3);

    // Leave on Wednesday wipes it again
    await addScheduleException(db, caller(new Date()), { staffId: doctor, onDate: wedDay, kind: 'closed', reason: 'Conference' });
    expect(await listSlots(db, caller(ist(wedDay, '07:00')), { staffId: doctor, from: wedDay, to: wedDay })).toEqual([]);

    // A day plan replaces the weekly rule for the following Tuesday; the latest revision wins
    const tue = new Date(`${day}T00:00:00Z`);
    tue.setUTCDate(tue.getUTCDate() + 1);
    const tueDay = tue.toISOString().slice(0, 10);
    await saveDayPlan(db, caller(new Date()), { staffId: doctor, planOn: tueDay, replacesWeekly: true, blocks: [{ facilityId: t.facilityId, start: '08:00', end: '09:00', slotMinutes: 30 }] });
    const rev2 = await saveDayPlan(db, caller(new Date()), { staffId: doctor, planOn: tueDay, replacesWeekly: true, blocks: [{ facilityId: t.facilityId, start: '15:00', end: '16:00', slotMinutes: 20 }] });
    expect(rev2.revision).toBe(2);
    const tueSlots = await listSlots(db, caller(ist(tueDay, '07:00')), { staffId: doctor, from: tueDay, to: tueDay });
    expect(tueSlots.map((s) => s.slotStart)).toEqual([ist(tueDay, '15:00'), ist(tueDay, '15:20'), ist(tueDay, '15:40')]);
    const sessions = await listSessions(db, caller(new Date()), { staffId: doctor, from: tueDay, to: tueDay });
    expect(sessions.map((s) => s.source)).toEqual(['day_plan']);
  });

  it('reports booked appointments that a new block clashes with', async () => {
    const at = ist(monday, '07:00');
    const hold = await holdSlot(db, caller(at), { staffId: doctor2, slotStart: ist(monday, '09:45') });
    const appt = await bookAppointment(db, caller(at), { reservationId: hold.reservationId, bookingParty: { name: 'Caller', phone: '+919811100001' }, originChannel: 'voice' });
    const result = await addScheduleException(db, caller(new Date()), { staffId: doctor2, onDate: monday, kind: 'block', start: '09:30', end: '10:00', reason: 'Meeting' });
    expect(result.affectedAppointmentIds).toEqual([appt.appointmentId]);
  });
});

describe('holding and booking', () => {
  it('only one of 20 simultaneous holds on the same slot succeeds', async () => {
    const at = ist(monday, '07:00');
    // Force a real race: lock the reservation table so all 20 holds pass the "is it free?" check and
    // then queue up to write. When the lock is released they insert together, and only the database's
    // exclusion constraint can stop the extra 19. (Without the lock each hold finishes before the next
    // starts and the application's own check turns them away — the constraint would go untested.)
    const gate = await admin.connect();
    await gate.query('BEGIN');
    await gate.query('LOCK TABLE booking.reservation IN EXCLUSIVE MODE');
    const pending = Promise.allSettled(
      Array.from({ length: 20 }, () => holdSlot(db, caller(at), { staffId: doctor, slotStart: ist(monday, '09:00') })),
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    const { rows: [waiting] } = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND usename = 'hms_app'`,
    );
    await gate.query('COMMIT');
    gate.release();
    expect(waiting!.n).toBe(20); // every hold got past the availability check and is waiting to write
    const results = await pending;
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(19);
    for (const f of failed) expect((f.reason as DomainError).details?.['reason']).toBe('slot_unavailable');
    await releaseHold(db, caller(at), { reservationId: (ok[0] as PromiseFulfilledResult<{ reservationId: string }>).value.reservationId });
  });

  it('an expired hold no longer blocks the slot', async () => {
    const hold = await holdSlot(db, caller(ist(monday, '07:00')), { staffId: doctor, slotStart: ist(monday, '09:15'), holdMinutes: 2 });
    const later = ist(monday, '07:05');
    const free = await listSlots(db, caller(later), { staffId: doctor, from: monday, to: monday });
    expect(free.map((s) => s.slotStart)).toContainEqual(ist(monday, '09:15'));
    const second = await holdSlot(db, caller(later), { staffId: doctor, slotStart: ist(monday, '09:15') });
    expect(second.reservationId).not.toBe(hold.reservationId);
    await expectDomainError(
      bookAppointment(db, caller(later), { reservationId: hold.reservationId, bookingParty: { name: 'Late', phone: '+919800000009' }, originChannel: 'web' }),
      'precondition_failed',
      'hold_expired',
    );
    await releaseHold(db, caller(later), { reservationId: second.reservationId });
  });

  it('books an unverified WhatsApp caller, snapshots the doctor-specific fee, and records history, audit and an event', async () => {
    const at = ist(monday, '07:00');
    const hold = await holdSlot(db, caller(at), { staffId: doctor, slotStart: ist(monday, '09:30') });
    const appt = await bookAppointment(
      db,
      caller(at),
      { reservationId: hold.reservationId, bookingParty: { name: 'Ravi (son)', phone: '+919876500001', verifiedChannel: 'whatsapp' }, originChannel: 'whatsapp', reason: 'Fever' },
      'book-1',
    );
    expect(appt).toMatchObject({ status: 'confirmed', feeMinor: 70000, sessionOn: monday, facilityId: t.facilityId });
    expect(appt.confirmationCode).toMatch(/^[A-Z2-9]{8}$/);

    const taken = await listSlots(db, caller(at), { staffId: doctor, from: monday, to: monday, includeUnavailable: true });
    expect(taken.find((s) => s.slotStart.getTime() === ist(monday, '09:30').getTime())?.status).toBe('taken');

    const { rows: history } = await admin.query(`SELECT from_status, to_status, actor_staff_id FROM booking.appointment_status_history WHERE appointment_id = $1`, [appt.appointmentId]);
    expect(history).toEqual([{ from_status: null, to_status: 'confirmed', actor_staff_id: frontDesk }]);
    const { rows: events } = await admin.query(`SELECT event_type FROM platform.outbox_event WHERE aggregate_id = $1`, [appt.appointmentId]);
    expect(events.map((e) => e.event_type)).toEqual(['appointment.confirmed']);
    const { rows: audits } = await admin.query(`SELECT action FROM platform.audit_event WHERE subject_id = $1`, [appt.appointmentId]);
    expect(audits.map((a) => a.action)).toEqual(['create']);
  });

  it('a retried booking with the same idempotency key returns the same appointment; a different request with that key is refused', async () => {
    const at = ist(monday, '07:00');
    const hold = await holdSlot(db, caller(at), { staffId: doctor, slotStart: ist(monday, '09:45') });
    const request = { reservationId: hold.reservationId, bookingParty: { name: 'Retry', phone: '+919876500002' }, originChannel: 'web' as const };
    const first = await bookAppointment(db, caller(at), request, 'book-retry');
    const retry = await bookAppointment(db, caller(at), request, 'book-retry');
    expect(retry.appointmentId).toBe(first.appointmentId);
    await expectDomainError(bookAppointment(db, caller(at), { ...request, reason: 'changed' }, 'book-retry'), 'idempotency_conflict');
    const { rows } = await admin.query(`SELECT count(*)::int AS n FROM booking.appointment WHERE reservation_id = $1`, [hold.reservationId]);
    expect(rows[0].n).toBe(1);
  });

  it('cancelling frees the slot and records the reason', async () => {
    const at = ist(monday, '07:00');
    const hold = await holdSlot(db, caller(at), { staffId: doctor, slotStart: ist(monday, '10:00') });
    const appt = await bookAppointment(db, caller(at), { reservationId: hold.reservationId, bookingParty: { name: 'Cancel', phone: '+919876500003' }, originChannel: 'portal' });
    await cancelAppointment(db, caller(at), { appointmentId: appt.appointmentId, reason: 'Feeling better' });
    const free = await listSlots(db, caller(at), { staffId: doctor, from: monday, to: monday });
    expect(free.map((s) => s.slotStart)).toContainEqual(ist(monday, '10:00'));
    await expectDomainError(cancelAppointment(db, caller(at), { appointmentId: appt.appointmentId, reason: 'again' }), 'precondition_failed');
  });

  it('rescheduling links the new appointment to the old one and frees the old slot', async () => {
    const at = ist(monday, '07:00');
    const hold = await holdSlot(db, caller(at), { staffId: doctor, slotStart: ist(monday, '10:15') });
    const original = await bookAppointment(db, caller(at), { reservationId: hold.reservationId, bookingParty: { name: 'Move', phone: '+919876500004' }, originChannel: 'web' });
    const newHold = await holdSlot(db, caller(at), { staffId: doctor, slotStart: ist(tuesday, '10:00') });
    const moved = await rescheduleAppointment(db, caller(at), { appointmentId: original.appointmentId, newReservationId: newHold.reservationId, reason: 'Clash' });
    expect(moved.facilityId).toBe(facility2);
    const { rows } = await admin.query(`SELECT status, cancel_reason, (SELECT rescheduled_from_id FROM booking.appointment WHERE id = $2) AS from_id FROM booking.appointment WHERE id = $1`, [original.appointmentId, moved.appointmentId]);
    expect(rows[0]).toEqual({ status: 'cancelled', cancel_reason: 'Rescheduled: Clash', from_id: original.appointmentId });
    const free = await listSlots(db, caller(at), { staffId: doctor, from: monday, to: monday });
    expect(free.map((s) => s.slotStart)).toContainEqual(ist(monday, '10:15'));
  });

  it('marks a no-show only after the slot has ended', async () => {
    const hold = await holdSlot(db, caller(ist(monday, '07:00')), { staffId: doctor, slotStart: ist(monday, '10:30') });
    const appt = await bookAppointment(db, caller(ist(monday, '07:00')), { reservationId: hold.reservationId, bookingParty: { name: 'Absent', phone: '+919876500005' }, originChannel: 'web' });
    await expectDomainError(markNoShow(db, caller(ist(monday, '10:35')), { appointmentId: appt.appointmentId }), 'precondition_failed');
    await expect(markNoShow(db, caller(ist(monday, '10:50')), { appointmentId: appt.appointmentId })).resolves.toMatchObject({ status: 'no_show' });
  });
});

describe('arrival, queue and consultation', () => {
  it('runs the full day: booked patient registers at the desk, checks in; a walk-in emergency jumps the queue; both are seen', async () => {
    const morning = ist(monday, '08:30');
    // Booked by a relative over the phone; the patient isn't registered yet
    const hold = await holdSlot(db, caller(ist(monday, '07:00')), { staffId: doctor, slotStart: ist(monday, '10:45') });
    const booked = await bookAppointment(db, caller(ist(monday, '07:00')), { reservationId: hold.reservationId, bookingParty: { name: 'Meera (daughter)', phone: '+919876500006' }, originChannel: 'voice' });

    // Can't check in before the day, nor without knowing who the patient is
    await expectDomainError(checkIn(db, caller(ist(monday, '07:00')), { appointmentId: booked.appointmentId }), 'precondition_failed', 'patient_required');
    const sunday = new Date(ist(monday, '08:30').getTime() - 24 * 3600_000);
    await expectDomainError(checkIn(db, caller(sunday), { appointmentId: booked.appointmentId, patientId: await newPatient('Too Early') }), 'precondition_failed');

    // At the desk: register, then check in → token 1
    const patientId = await newPatient('Kamala');
    const arrived = await checkIn(db, caller(morning), { appointmentId: booked.appointmentId, patientId });
    expect(arrived.tokenNo).toBe(1);
    const { rows: [party] } = await admin.query(`SELECT bp.patient_id FROM booking.appointment a JOIN booking.booking_party bp ON bp.id = a.booking_party_id WHERE a.id = $1`, [booked.appointmentId]);
    expect(party.patient_id).toBe(patientId);

    // A walk-in emergency in the evening session gets token 2 but is called first
    const walkInPatient = await newPatient('Emergency Walk-in');
    const walkIn = await bookWalkIn(db, caller(ist(monday, '08:40')), { staffId: doctor, facilityId: t.facilityId, patientId: walkInPatient, priority: 'emergency' });
    expect(walkIn).toMatchObject({ tokenNo: 2, status: 'checked_in', feeMinor: 70000 });

    const queue = await listQueue(db, caller(morning), { staffId: doctor, facilityId: t.facilityId, sessionOn: monday });
    expect(queue.map((q) => q.tokenNo)).toEqual([2, 1]);

    const first = await callNext(db, caller(ist(monday, '09:00')), { staffId: doctor, facilityId: t.facilityId, sessionOn: monday });
    expect(first?.tokenNo).toBe(2);
    await startService(db, caller(ist(monday, '09:01')), { tokenId: first!.tokenId });
    await completeService(db, caller(ist(monday, '09:10')), { tokenId: first!.tokenId });

    const second = await callNext(db, caller(ist(monday, '09:11')), { staffId: doctor, facilityId: t.facilityId, sessionOn: monday });
    expect(second?.tokenNo).toBe(1);
    await expectDomainError(completeService(db, caller(ist(monday, '09:12')), { tokenId: second!.tokenId }), 'precondition_failed'); // must start first
    await startService(db, caller(ist(monday, '09:12')), { tokenId: second!.tokenId });
    await completeService(db, caller(ist(monday, '09:20')), { tokenId: second!.tokenId });
    expect(await callNext(db, caller(ist(monday, '09:21')), { staffId: doctor, facilityId: t.facilityId, sessionOn: monday })).toBeNull();

    // Full status trail of the booked appointment, and it can no longer be cancelled
    const { rows: trail } = await admin.query(`SELECT to_status FROM booking.appointment_status_history WHERE appointment_id = $1 ORDER BY occurred_at, id`, [booked.appointmentId]);
    expect(trail.map((r) => r.to_status)).toEqual(['confirmed', 'checked_in', 'completed']);
    await expectDomainError(cancelAppointment(db, caller(ist(monday, '09:30')), { appointmentId: booked.appointmentId, reason: 'late' }), 'precondition_failed');
    const { rows: events } = await admin.query(`SELECT event_type FROM platform.outbox_event WHERE aggregate_id = $1 ORDER BY occurred_at, id`, [booked.appointmentId]);
    expect(events.map((e) => e.event_type)).toEqual(['appointment.confirmed', 'appointment.checked_in', 'appointment.completed']);
  });

  it('enforces walk-in capacity and refuses walk-ins on days without a walk-in session', async () => {
    const at = ist(monday, '12:00');
    // Capacity is 5; one walk-in was used above
    for (let i = 0; i < 4; i++) await bookWalkIn(db, caller(at), { staffId: doctor, facilityId: t.facilityId, patientId: await newPatient(`Walk ${i}`) });
    await expectDomainError(bookWalkIn(db, caller(at), { staffId: doctor, facilityId: t.facilityId, patientId: await newPatient('One too many') }), 'conflict', 'walk_ins_full');
    await expectDomainError(
      bookWalkIn(db, caller(ist(tuesday, '10:00')), { staffId: doctor, facilityId: facility2, patientId: await newPatient('Tuesday') }),
      'precondition_failed',
      'no_walk_ins',
    );
  });

  // Note: the two calls usually run one after the other, so this checks that consecutive calls
  // advance the queue; it does not prove the FOR UPDATE SKIP LOCKED path under true concurrency.
  it('calling "next" twice gives two different patients', async () => {
    const day = monday;
    const patients = await Promise.all([newPatient('Q1'), newPatient('Q2')]);
    // doctor2 has no walk-in session; give these patients booked appointments for today and check them in
    for (const [i, p] of patients.entries()) {
      const hold = await holdSlot(db, caller(ist(day, '07:00')), { staffId: doctor2, slotStart: ist(day, i === 0 ? '09:00' : '09:15') });
      const appt = await bookAppointment(db, caller(ist(day, '07:00')), { reservationId: hold.reservationId, patientId: p, originChannel: 'front_desk' });
      await checkIn(db, caller(ist(day, '08:00')), { appointmentId: appt.appointmentId });
    }
    const [a, b] = await Promise.all([
      callNext(db, caller(ist(day, '09:00')), { staffId: doctor2, facilityId: t.facilityId, sessionOn: day }),
      callNext(db, caller(ist(day, '09:00')), { staffId: doctor2, facilityId: t.facilityId, sessionOn: day }),
    ]);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.tokenId).not.toBe(b!.tokenId);
  });
});

describe('isolation', () => {
  it("another tenant cannot see this tenant's doctors' slots", async () => {
    const other = await createTenant(admin, 'booking-other');
    await expectDomainError(
      listSlots(db, { tenantId: other.tenantId, actor: { kind: 'staff' }, now: ist(monday, '07:00') }, { staffId: doctor, from: monday, to: monday }),
      'not_found',
    );
    const { rows } = await sql<{ n: number }>`SELECT 1 AS n`.execute(db);
    expect(rows).toHaveLength(1);
  });
});
