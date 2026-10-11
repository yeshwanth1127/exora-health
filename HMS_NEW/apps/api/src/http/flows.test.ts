// The staff user flows in docs/plan/STAFF_USER_FLOWS.md, end to end over HTTP, starting from an empty
// hospital: nothing here is seeded except the tenant, one clinic and the people. Each `it` is one flow
// and builds on the ones before it, the way a hospital is actually set up and run.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signDevToken } from '../auth/dev-token.ts';
import { ist, localDay, nextMonday, startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
const p = {} as Record<'admin' | 'frontDesk' | 'nurse', Person>;
let doctor: Person;
let clinic: string;
let dept: string;
let room: string;
let service: string;
let patientId: string;
let callerVisit: string;
const visitDay = nextMonday(3); // a Monday after the weekly hours start
const laterDay = (() => {
  const d = new Date(`${visitDay}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
})();
const doctorEmail = () => `kavya.${k.run}@clinic.example`;

beforeAll(async () => {
  k = await startKit('flows');
  p.admin = await k.person('Priya Admin', 'tenant_admin', null);
});

afterAll(async () => k?.close());

const ok = (res: { status: number; body: any }, status = 200) => {
  expect(res, JSON.stringify(res.body)).toMatchObject({ status });
  return res.body;
};

describe('staff user flows', () => {
  it('F1 · an administrator opens a clinic and fills in its catalogue', async () => {
    clinic = ok(await k.call(p.admin, 'POST', '/v1/facilities', { code: 'IND', name: 'Indiranagar Clinic', facilityType: 'clinic', stateCode: '29', city: 'Bengaluru' }, true), 201).facilityId;
    const f = ok(await k.call(p.admin, 'GET', `/v1/facilities/${clinic}`));
    ok(await k.call(p.admin, 'PATCH', `/v1/facilities/${clinic}`, { version: f.version, addressLine1: '100 Ft Road', pincode: '560038', phone: '+918040000000', arrivalInstructions: 'Lift to the 2nd floor.' }));
    dept = ok(await k.call(p.admin, 'POST', `/v1/facilities/${clinic}/departments`, { code: 'GM', name: 'General Medicine' }, true), 201).departmentId;
    room = ok(await k.call(p.admin, 'POST', `/v1/facilities/${clinic}/consult-rooms`, { code: 'C1', name: 'Consult 1', departmentId: dept }, true), 201).locationId;
    service = ok(
      await k.call(p.admin, 'POST', `/v1/departments/${dept}/services`, { code: `GM-OPD-${k.run}`, name: 'General Medicine OPD', serviceMode: 'in_person', defaultDurationMin: 15, feeMinor: 50000 }, true),
      201,
    ).healthcareServiceId;
    const dir = ok(await k.call(p.admin, 'GET', `/v1/facilities/${clinic}/directory`));
    expect(dir.departments.map((d: { name: string }) => d.name)).toEqual(['General Medicine']);
    expect(dir.services.map((s: { healthcareServiceId: string }) => s.healthcareServiceId)).toEqual([service]);
    expect(dir.consultRooms.map((r: { locationId: string }) => r.locationId)).toEqual([room]);
    // Staff for the new clinic
    p.frontDesk = await k.person('Ravi Desk', 'front_desk', clinic);
    p.nurse = await k.person('Meena Nurse', 'nurse', clinic, 'nurse');
  });

  it('F2 · the administrator brings a doctor on: invite, clinic, profile, calendar, weekly hours', async () => {
    const roles = ok(await k.call(p.admin, 'GET', '/v1/roles')).roles;
    const doctorRole = roles.find((r: { code: string }) => r.code === 'doctor').roleId;
    const invited = ok(
      await k.call(p.admin, 'POST', '/v1/staff-accounts', { displayName: 'Dr Kavya Menon', employeeNo: `DR-${k.run}`, staffType: 'doctor', email: doctorEmail(), roleId: doctorRole, facilityId: clinic }, true),
      201,
    );
    // The doctor's first sign-in with the invited, verified email links the account.
    doctor = { staffId: invited.staffId, token: await signDevToken(`kavya-${k.run}`, { email: doctorEmail() }) };
    expect(ok(await k.call(doctor, 'GET', '/v1/me'))).toMatchObject({ staffId: invited.staffId, displayName: 'Dr Kavya Menon' });

    // Not bookable until they work at the clinic and have a calendar.
    expect(ok(await k.call(p.frontDesk, 'GET', `/v1/practitioners?facilityId=${clinic}`)).items).toEqual([]);
    ok(await k.call(p.admin, 'POST', `/v1/practitioners/${doctor.staffId}/affiliations`, { facilityId: clinic, departmentId: dept, roleTitle: 'Consultant', validFrom: localDay() }, true), 201);
    ok(await k.call(p.admin, 'PUT', `/v1/practitioners/${doctor.staffId}/profile`, { specialty: null, qualifications: ['MBBS'], bio: null, experienceYears: 6, languages: ['en'], acceptsVirtual: false, publicSlug: null, published: false }));
    const calendar = ok(await k.call(p.admin, 'POST', `/v1/practitioners/${doctor.staffId}/calendar`), 201);
    // Weekly hours from tomorrow, Monday–Saturday 09:00–12:00. The plan names no service: the clinic's one
    // in-person service for the doctor's department is used, so bookings are priced (R2).
    ok(
      await k.call(p.admin, 'PUT', `/v1/practitioners/${doctor.staffId}/weekly-plan`, {
        facilityId: clinic,
        visitMode: 'in_person',
        effectiveFrom: localDay(1),
        slotMinutes: 15,
        sessions: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: '09:00', end: '12:00' })),
      }, true),
    );
    const listed = ok(await k.call(p.frontDesk, 'GET', `/v1/practitioners?facilityId=${clinic}`)).items;
    expect(listed).toEqual([expect.objectContaining({ staffId: doctor.staffId, calendarId: calendar.resourceId, department: 'General Medicine' })]);
    const quote = ok(await k.call(p.frontDesk, 'GET', `/v1/practitioners/${doctor.staffId}/fees?facilityId=${clinic}&on=${localDay(1)}`)).items;
    expect(quote).toEqual([expect.objectContaining({ healthcareServiceId: service, visitMode: 'in_person', feeMinor: 50000 })]);
  });

  it('F3 · the front desk registers a patient and books them; a phone caller is booked without registering', async () => {
    patientId = ok(await k.call(p.frontDesk, 'POST', '/v1/patients', { givenName: 'Anil', familyName: 'Kumar', sex: 'male', phone: '+919845000001', registeredFacilityId: clinic, source: 'front_desk' }, true), 201).patientId;
    const slots = ok(await k.call(p.frontDesk, 'GET', `/v1/practitioners/${doctor.staffId}/slots?facilityId=${clinic}&from=${visitDay}&to=${visitDay}`)).items;
    expect(slots).toHaveLength(12);
    expect(slots[0]).toMatchObject({ slotStart: new Date(ist(visitDay, '09:00')).toISOString(), status: 'free', healthcareServiceId: service });
    const book = async (slotStart: string, who: Record<string, unknown>) => {
      const hold = ok(await k.call(p.frontDesk, 'POST', '/v1/holds', { staffId: doctor.staffId, slotStart }, true), 201);
      return ok(await k.call(p.frontDesk, 'POST', '/v1/appointments', { reservationId: hold.reservationId, originChannel: 'front_desk', ...who }, true), 201);
    };
    const booked = await book(slots[0].slotStart, { patientId, reason: 'Fever' });
    expect(booked).toMatchObject({ status: 'confirmed', feeMinor: 50000 });
    // A taken slot can't be held again.
    expect((await k.call(p.frontDesk, 'POST', '/v1/holds', { staffId: doctor.staffId, slotStart: slots[0].slotStart }, true)).status).toBe(409);
    const caller = await book(slots[1].slotStart, { bookingParty: { name: 'Sita (daughter)', phone: '+919845000002' } });
    callerVisit = caller.appointmentId;
    const day = ok(await k.call(p.frontDesk, 'GET', `/v1/appointments?facilityId=${clinic}&from=${visitDay}&to=${visitDay}`)).items;
    expect(day.map((a: { patientName: string | null; bookingPartyName: string | null }) => [a.patientName, a.bookingPartyName])).toEqual([
      ['Anil Kumar', null],
      [null, 'Sita (daughter)'],
    ]);
  });

  it('F4 · a doctor-specific fee from a later date leaves earlier bookings as booked', async () => {
    ok(await k.call(p.admin, 'PUT', `/v1/practitioners/${doctor.staffId}/fees`, { healthcareServiceId: service, mode: 'in_person', feeMinor: 70000, effectiveFrom: laterDay }));
    const quoteBefore = ok(await k.call(p.frontDesk, 'GET', `/v1/practitioners/${doctor.staffId}/fees?facilityId=${clinic}&on=${visitDay}`)).items[0];
    expect(quoteBefore.feeMinor).toBe(50000);
    const slots = ok(await k.call(p.frontDesk, 'GET', `/v1/practitioners/${doctor.staffId}/slots?facilityId=${clinic}&from=${laterDay}&to=${laterDay}`)).items;
    const hold = ok(await k.call(p.frontDesk, 'POST', '/v1/holds', { staffId: doctor.staffId, slotStart: slots[0].slotStart }, true), 201);
    const later = ok(await k.call(p.frontDesk, 'POST', '/v1/appointments', { reservationId: hold.reservationId, patientId, originChannel: 'front_desk' }, true), 201);
    expect(later.feeMinor).toBe(70000);
    // The earlier booking still carries the fee it was booked at, and points at a retired price list version.
    const { rows } = await k.admin.query(
      `SELECT a.fee_snapshot_minor, pl.status, pl.list_version FROM booking.appointment a JOIN catalog.price_list_item pli ON pli.id = a.price_list_item_id
       JOIN catalog.price_list pl ON pl.id = pli.price_list_id WHERE a.tenant_id = $1 ORDER BY a.created_at`,
      [k.tenant.tenantId],
    );
    expect(rows.map((r) => [Number(r.fee_snapshot_minor), r.status])).toEqual([
      [50000, 'retired'],
      [50000, 'retired'],
      [70000, 'active'],
    ]);
    // Back to the service fee: removing the doctor's own price from that date.
    ok(await k.call(p.admin, 'PUT', `/v1/practitioners/${doctor.staffId}/fees`, { healthcareServiceId: service, mode: 'in_person', feeMinor: null, effectiveFrom: laterDay }));
    expect(ok(await k.call(p.frontDesk, 'GET', `/v1/practitioners/${doctor.staffId}/fees?facilityId=${clinic}&on=${laterDay}`)).items[0].feeMinor).toBe(50000);
    ok(await k.call(p.frontDesk, 'POST', `/v1/appointments/${later.appointmentId}/cancel`, { reason: 'Booked by mistake' }));
  });

  it('F5 · the front desk corrects a patient\'s phone; the appointment shows the new contact', async () => {
    const before = ok(await k.call(p.frontDesk, 'GET', `/v1/patients/${patientId}`));
    ok(await k.call(p.frontDesk, 'PATCH', `/v1/patients/${patientId}`, { version: before.version, phone: '+919845000009', occupation: 'Engineer' }));
    const after = ok(await k.call(p.frontDesk, 'GET', `/v1/patients/${patientId}`));
    expect(after.contacts).toEqual([expect.objectContaining({ kind: 'phone', value: '+919845000009' })]);
    expect(after.occupation).toBe('Engineer');
  });

  it('F6 · the front desk moves a visit to another slot and cancels another with a reason', async () => {
    const slots = ok(await k.call(p.frontDesk, 'GET', `/v1/practitioners/${doctor.staffId}/slots?facilityId=${clinic}&from=${visitDay}&to=${visitDay}`)).items;
    const free = slots.filter((s: { status: string }) => s.status === 'free');
    // Book, then move it to the next free slot: the replacement links back to the original.
    let hold = ok(await k.call(p.frontDesk, 'POST', '/v1/holds', { staffId: doctor.staffId, slotStart: free[0].slotStart }, true), 201);
    const visit = ok(await k.call(p.frontDesk, 'POST', '/v1/appointments', { reservationId: hold.reservationId, bookingParty: { name: 'Mohan', phone: '+919845000003' }, originChannel: 'front_desk' }, true), 201);
    hold = ok(await k.call(p.frontDesk, 'POST', '/v1/holds', { staffId: doctor.staffId, slotStart: free[1].slotStart }, true), 201);
    const moved = ok(await k.call(p.frontDesk, 'POST', `/v1/appointments/${visit.appointmentId}/reschedule`, { newReservationId: hold.reservationId, reason: 'Patient asked' }, true));
    expect(ok(await k.call(p.frontDesk, 'GET', `/v1/appointments/${moved.appointmentId}`))).toMatchObject({ rescheduledFromId: visit.appointmentId, status: 'confirmed' });
    expect(ok(await k.call(p.frontDesk, 'GET', `/v1/appointments/${visit.appointmentId}`)).status).toBe('cancelled');
    expect((await k.call(p.frontDesk, 'POST', `/v1/appointments/${moved.appointmentId}/cancel`, {})).status).toBe(400);
    ok(await k.call(p.frontDesk, 'POST', `/v1/appointments/${moved.appointmentId}/cancel`, { reason: 'Recovered' }));
    // A nurse can see the day but not change bookings.
    expect((await k.call(p.nurse, 'POST', '/v1/holds', { staffId: doctor.staffId, slotStart: free[2].slotStart }, true)).status).toBe(403);
  });

  it('F7 · on the day: check-in links the caller to a record, the doctor sees and finishes the visit', async () => {
    const morning = ist(visitDay, '08:45');
    // The caller arrives; the desk registers the actual patient and links them at check-in.
    const sita = ok(await k.call(p.frontDesk, 'POST', '/v1/patients', { givenName: 'Kamala', sex: 'female', registeredFacilityId: clinic, source: 'front_desk' }, true), 201).patientId;
    ok(await k.call(p.frontDesk, 'POST', `/v1/appointments/${callerVisit}/check-in`, { patientId: sita }, true, morning));
    await k.dispatch(); // the worker opens the consultation
    const worklist = ok(await k.call(doctor, 'GET', `/v1/encounters?facilityId=${clinic}&date=${visitDay}`, undefined, undefined, morning)).items;
    const encounter = worklist.find((e: { appointmentId: string }) => e.appointmentId === callerVisit);
    expect(encounter).toMatchObject({ status: 'arrived' });
    ok(await k.call(doctor, 'POST', `/v1/encounters/${encounter.encounterId}/start`, undefined, undefined, ist(visitDay, '09:15')));
    ok(await k.call(doctor, 'POST', `/v1/encounters/${encounter.encounterId}/finish`, { disposition: 'discharged_home' }, undefined, ist(visitDay, '09:30')));
    await k.dispatch(); // finishing completes the appointment
    expect(ok(await k.call(p.frontDesk, 'GET', `/v1/appointments/${callerVisit}`))).toMatchObject({ status: 'completed', patientName: 'Kamala', bookingPartyName: 'Sita (daughter)' });
  });

  it('F8 · a doctor leaves the clinic only after their visits and hours are dealt with', async () => {
    const aff = ok(await k.call(p.admin, 'GET', `/v1/practitioners/${doctor.staffId}/profile?facilityId=${clinic}`)).affiliations[0];
    const end = (validTo: string) => k.call(p.admin, 'POST', `/v1/practitioner-affiliations/${aff.affiliationId}/end`, { validTo, reason: 'Moved city' });
    expect((await end(localDay(1))).body.error.details).toMatchObject({ reason: 'future_appointments' });
    // Cancel the remaining booked visit, end the weekly hours (an empty plan from tomorrow), then leave.
    const open = ok(await k.call(p.frontDesk, 'GET', `/v1/appointments?facilityId=${clinic}&from=${localDay()}&to=${laterDay}&status=confirmed`)).items;
    for (const a of open) ok(await k.call(p.frontDesk, 'POST', `/v1/appointments/${a.appointmentId}/cancel`, { reason: 'Doctor leaving' }));
    expect((await end(localDay(1))).body.error.details).toMatchObject({ reason: 'published_hours' });
    ok(await k.call(p.admin, 'PUT', `/v1/practitioners/${doctor.staffId}/weekly-plan`, { facilityId: clinic, visitMode: 'in_person', effectiveFrom: localDay(1), slotMinutes: 15, sessions: [] }, true));
    ok(await end(localDay(1)));
    const read = ok(await k.call(p.admin, 'GET', `/v1/practitioners/${doctor.staffId}/profile?facilityId=${clinic}`));
    expect(read.affiliations[0].validTo).toBe(localDay(1));
  });

  it('F9 · a clinic is switched off only once nothing is booked or published there, and never the last one', async () => {
    const f = ok(await k.call(p.admin, 'GET', `/v1/facilities/${clinic}`));
    // The fixture's first clinic is still active, so this isn't the last one; nothing is booked here any more.
    ok(await k.call(p.admin, 'PATCH', `/v1/facilities/${clinic}`, { version: f.version, status: 'inactive' }));
    const first = ok(await k.call(p.admin, 'GET', `/v1/facilities/${k.tenant.facilityId}`));
    expect((await k.call(p.admin, 'PATCH', `/v1/facilities/${k.tenant.facilityId}`, { version: first.version, status: 'inactive' })).body.error.details).toMatchObject({ reason: 'last_facility' });
  });
});
