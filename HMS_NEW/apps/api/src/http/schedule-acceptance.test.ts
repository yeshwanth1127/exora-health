// Remaining schedule acceptance: virtual extra hours (G06) and exact-range moves (G08).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ist, localDay, nextMonday, startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let admin: Person;
let desk: Person;
let doctor: Person;
let patientId: string;
let virtualServiceId: string;
let inPersonServiceId: string;
const day = nextMonday(3);
const ok = (res: { status: number; body: any }, status = 200) => {
  expect(res, JSON.stringify(res.body)).toMatchObject({ status });
  return res.body;
};

beforeAll(async () => {
  k = await startKit('schedule-acceptance');
  const facilityId = k.tenant.facilityId;
  admin = await k.person('Schedule Admin', 'tenant_admin', null);
  desk = await k.person('Schedule Desk', 'front_desk', facilityId);
  doctor = await k.person('Schedule Doctor', 'doctor', facilityId, 'doctor');
  const dept = ok(await k.call(admin, 'POST', `/v1/facilities/${facilityId}/departments`, { code: `SCH-${k.run}`, name: 'Schedule Medicine' }, true), 201).departmentId;
  for (const mode of ['in_person', 'virtual']) {
    const svc = ok(await k.call(admin, 'POST', `/v1/departments/${dept}/services`, { code: `${mode}-${k.run}`, name: `${mode} consultation`, serviceMode: mode, defaultDurationMin: 15, feeMinor: mode === 'virtual' ? 35000 : 40000 }, true), 201).healthcareServiceId;
    if (mode === 'virtual') virtualServiceId = svc;
    else inPersonServiceId = svc;
  }
  ok(await k.call(admin, 'POST', `/v1/practitioners/${doctor.staffId}/affiliations`, { facilityId, departmentId: dept, validFrom: localDay() }, true), 201);
  ok(await k.call(admin, 'POST', `/v1/practitioners/${doctor.staffId}/calendar`), 201);
  patientId = ok(await k.call(desk, 'POST', '/v1/patients', { givenName: 'Schedule Patient', sex: 'female', registeredFacilityId: facilityId, source: 'front_desk' }, true), 201).patientId;
});
afterAll(async () => k?.close());

describe('documented schedule acceptance', () => {
  const extra = (body: object, who = admin) => k.call(who, 'POST', `/v1/practitioners/${doctor.staffId}/exceptions`, { onDate: day, kind: 'extra_hours', facilityId: k.tenant.facilityId, start: '16:00', end: '17:00', slotMinutes: 15, ...body }, true);

  it('rejects wrong modes, missing windows, unrelated services and unauthorized staff before writing', async () => {
    expect((await extra({ visitMode: 'telephone' })).status).toBe(400);
    expect((await extra({ kind: 'block', visitMode: 'virtual' })).status).toBe(400);
    expect((await extra({ start: undefined, end: undefined })).status).toBe(400);
    expect((await extra({ visitMode: 'virtual', healthcareServiceId: inPersonServiceId })).status).toBe(400);
    expect((await extra({ visitMode: 'virtual' }, desk)).status).toBe(403);
    expect(ok(await k.call(desk, 'GET', `/v1/practitioners/${doctor.staffId}/exceptions?from=${day}&to=${day}`)).items).toEqual([]);
  });

  it('publishes virtual-only extra slots and a normal booking creates the teleconsult session once', async () => {
    const saved = ok(await extra({ visitMode: 'virtual' }), 201);
    const exceptions = ok(await k.call(desk, 'GET', `/v1/practitioners/${doctor.staffId}/exceptions?from=${day}&to=${day}`)).items;
    expect(exceptions).toEqual([expect.objectContaining({ scheduleExceptionId: saved.scheduleExceptionId, visitMode: 'virtual', healthcareServiceId: virtualServiceId })]);
    const sessions = ok(await k.call(desk, 'GET', `/v1/practitioners/${doctor.staffId}/sessions?from=${day}&to=${day}`)).items;
    expect(sessions).toEqual([expect.objectContaining({ source: 'extra_hours', visitMode: 'virtual' })]);
    const slots = ok(await k.call(desk, 'GET', `/v1/practitioners/${doctor.staffId}/slots?from=${day}&to=${day}`)).items;
    expect(slots).toHaveLength(4);
    expect(slots.every((s: { visitMode: string }) => s.visitMode === 'virtual')).toBe(true);
    const held = ok(await k.call(desk, 'POST', '/v1/holds', { staffId: doctor.staffId, slotStart: slots[0].slotStart }, true), 201);
    const booked = ok(await k.call(desk, 'POST', '/v1/appointments', { reservationId: held.reservationId, patientId, originChannel: 'front_desk' }, true), 201);
    expect(booked.feeMinor).toBe(35000);
    expect(ok(await k.call(desk, 'GET', `/v1/appointments/${booked.appointmentId}`))).toMatchObject({ visitMode: 'virtual' });
    const persisted = await k.admin.query('SELECT healthcare_service_id, visit_mode FROM booking.appointment WHERE id = $1', [booked.appointmentId]);
    expect(persisted.rows).toEqual([{ healthcare_service_id: virtualServiceId, visit_mode: 'virtual' }]);
    await k.dispatch();
    await k.dispatch();
    const tele = await k.admin.query('SELECT appointment_id, status FROM clinical.tele_session WHERE appointment_id = $1', [booked.appointmentId]);
    expect(tele.rows).toEqual([{ appointment_id: booked.appointmentId, status: 'scheduled' }]);
    const board = ok(await k.call(desk, 'GET', `/v1/calendar-board?facilityId=${k.tenant.facilityId}&date=${day}`));
    expect(board.rows[0].exceptions[0]).toMatchObject({ visitMode: 'virtual' });
    expect(board.rows[0].slots.every((s: { visitMode: string }) => s.visitMode === 'virtual')).toBe(true);
  });

  it('omitted mode preserves in-person callers; exact-range moves persist linkage and refuse overlaps', async () => {
    ok(await extra({ start: '09:00', end: '11:00' }), 201);
    const hold = async (start: string, end: string) => k.call(desk, 'POST', '/v1/holds/range', { staffId: doctor.staffId, startsAt: ist(day, start), endsAt: ist(day, end), visitMode: 'in_person' }, true);
    const originalHold = ok(await hold('09:05', '09:20'), 201);
    const old = ok(await k.call(desk, 'POST', '/v1/appointments', { reservationId: originalHold.reservationId, patientId, originChannel: 'front_desk' }, true), 201);
    const targetHold = ok(await hold('10:07', '10:29'), 201);
    const body = { newReservationId: targetHold.reservationId, reason: 'Patient requested exact minutes' };
    const key = `exact-move-${k.run}`;
    const next = ok(await k.call(desk, 'POST', `/v1/appointments/${old.appointmentId}/reschedule`, body, key));
    expect(next).toMatchObject({ startsAt: new Date(ist(day, '10:07')).toISOString(), endsAt: new Date(ist(day, '10:29')).toISOString(), feeMinor: 40000 });
    expect(ok(await k.call(desk, 'POST', `/v1/appointments/${old.appointmentId}/reschedule`, body, key)).appointmentId).toBe(next.appointmentId);
    const persisted = await k.admin.query('SELECT id, status, rescheduled_from_id, visit_mode, reservation_id FROM booking.appointment WHERE id = ANY($1::uuid[]) ORDER BY starts_at', [[old.appointmentId, next.appointmentId]]);
    expect(persisted.rows).toEqual([
      { id: old.appointmentId, status: 'cancelled', rescheduled_from_id: null, visit_mode: 'in_person', reservation_id: originalHold.reservationId },
      { id: next.appointmentId, status: 'confirmed', rescheduled_from_id: old.appointmentId, visit_mode: 'in_person', reservation_id: targetHold.reservationId },
    ]);
    const reservations = await k.admin.query('SELECT id, status FROM booking.reservation WHERE id = ANY($1::uuid[]) ORDER BY lower(period)', [[originalHold.reservationId, targetHold.reservationId]]);
    expect(reservations.rows).toEqual([{ id: originalHold.reservationId, status: 'released' }, { id: targetHold.reservationId, status: 'booked' }]);
    const overlap = await hold('10:10', '10:25');
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.details.reason).toBe('slot_unavailable');
    // Old time was released; the new range is the only protected booking.
    ok(await hold('09:05', '09:20'), 201);
  });
});
