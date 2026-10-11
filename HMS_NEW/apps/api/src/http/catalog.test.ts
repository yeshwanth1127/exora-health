// Directory administration over HTTP: clinics, departments, rooms, services, fees, doctors, patients and
// roles can be changed from the workspace, by the right people, at the right clinic, without stale edits.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localDay, startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let f1: string;
let f2: string;
const p = {} as Record<'admin' | 'branchAdmin' | 'frontDesk' | 'nurse' | 'doctor', Person>;

beforeAll(async () => {
  k = await startKit('catalog');
  f1 = k.tenant.facilityId;
  f2 = (
    await k.admin.query<{ id: string }>(
      `INSERT INTO platform.facility (tenant_id, organization_id, code, name, facility_type, state_code) VALUES ($1, $2, 'F2', 'Branch 2', 'clinic', '29') RETURNING id`,
      [k.tenant.tenantId, k.tenant.organizationId],
    )
  ).rows[0]!.id;
  p.admin = await k.person('Priya Admin', 'tenant_admin', null);
  p.branchAdmin = await k.person('Branch One Lead', 'tenant_admin', f1);
  p.frontDesk = await k.person('Ravi Desk', 'front_desk', f1);
  p.nurse = await k.person('Meena Nurse', 'nurse', f1, 'nurse');
  p.doctor = await k.person('Dr Kavya Menon', 'doctor', f1, 'doctor');
});

afterAll(async () => k?.close());

const audits = async (subjectId: string) =>
  (await k.admin.query<{ action: string; diff: Record<string, unknown> | null }>(`SELECT action, diff FROM platform.audit_event WHERE subject_id = $1 ORDER BY occurred_at`, [subjectId])).rows;

describe('clinic details', () => {
  it('a clinic administrator edits their clinic\'s patient-facing details; others cannot', async () => {
    const before = await k.call(p.branchAdmin, 'GET', `/v1/facilities/${f1}`);
    expect(before.status).toBe(200);
    const edit = {
      version: before.body.version,
      name: 'Facility One',
      addressLine1: '12 MG Road',
      city: 'Bengaluru',
      pincode: '560001',
      phone: '+918012345678',
      directionsUrl: 'https://maps.example.com/f1',
      arrivalInstructions: 'Use the east entrance; registration desk is on the left.',
    };
    const saved = await k.call(p.branchAdmin, 'PATCH', `/v1/facilities/${f1}`, edit);
    expect(saved).toMatchObject({ status: 200, body: { version: before.body.version + 1 } });
    expect((await k.call(p.frontDesk, 'GET', `/v1/facilities/${f1}`)).body).toMatchObject({ name: 'Facility One', city: 'Bengaluru', arrivalInstructions: edit.arrivalInstructions });
    expect((await audits(f1)).at(-1)).toMatchObject({ action: 'update', diff: { name: ['Facility 1', 'Facility One'] } });

    // The same form again is stale; another clinic, front desk and bad links are refused.
    expect((await k.call(p.branchAdmin, 'PATCH', `/v1/facilities/${f1}`, edit)).body.error.details).toMatchObject({ reason: 'stale_version' });
    expect((await k.call(p.branchAdmin, 'PATCH', `/v1/facilities/${f2}`, { version: 1, name: 'Mine now' })).status).toBe(403);
    expect((await k.call(p.frontDesk, 'PATCH', `/v1/facilities/${f1}`, { version: saved.body.version, name: 'Desk' })).status).toBe(403);
    expect((await k.call(p.branchAdmin, 'PATCH', `/v1/facilities/${f1}`, { version: saved.body.version, directionsUrl: 'http://insecure.example' })).status).toBe(400);
    expect((await k.call(p.branchAdmin, 'PATCH', `/v1/facilities/${f1}`, { version: saved.body.version, timezone: 'Mars/Olympus' })).status).toBe(400);
  });

  it('opening a clinic needs the grant at every clinic; switched-off clinics drop out of the list', async () => {
    const body = { code: `F3`, name: 'Branch 3', facilityType: 'clinic', stateCode: '29', city: 'Mysuru' };
    expect((await k.call(p.branchAdmin, 'POST', '/v1/facilities', body, true)).status).toBe(403);
    const made = await k.call(p.admin, 'POST', '/v1/facilities', body, true);
    expect(made.status).toBe(201);
    expect((await k.call(p.admin, 'POST', '/v1/facilities', body, true)).body.error.details).toMatchObject({ reason: 'duplicate_code' });
    const f3 = made.body.facilityId;
    const off = await k.call(p.admin, 'PATCH', `/v1/facilities/${f3}`, { version: 1, status: 'inactive' });
    expect(off.status).toBe(200);
    const ids = async (who: Person, q = '') => (await k.call(who, 'GET', `/v1/facilities${q}`)).body.items.map((f: { facilityId: string }) => f.facilityId);
    expect(await ids(p.admin)).not.toContain(f3);
    expect(await ids(p.admin, '?includeInactive=true')).toContain(f3);
    expect(await ids(p.frontDesk, '?includeInactive=true')).not.toContain(f3); // only people who could switch it back on
    expect((await k.call(p.admin, 'PATCH', `/v1/facilities/${f3}`, { version: off.body.version, status: 'active' })).status).toBe(200);
  });
});

describe('departments, rooms and services', () => {
  let dept: string;
  let svc: string;

  it('adds and edits departments and consult rooms at the manager\'s clinic only', async () => {
    const made = await k.call(p.branchAdmin, 'POST', `/v1/facilities/${f1}/departments`, { code: 'ENT', name: 'ENT', specialty: 'ent' }, true);
    if (made.status !== 201) {
      // The specialty list is reference data; fall back to no specialty if this one isn't seeded.
      expect(made.status).toBe(400);
    }
    const dep = made.status === 201 ? made : await k.call(p.branchAdmin, 'POST', `/v1/facilities/${f1}/departments`, { code: 'ENT', name: 'ENT' }, true);
    expect(dep.status).toBe(201);
    dept = dep.body.departmentId;
    expect((await k.call(p.branchAdmin, 'POST', `/v1/facilities/${f1}/departments`, { code: 'ENT', name: 'Dup' }, true)).body.error.details).toMatchObject({ reason: 'duplicate_code' });
    expect((await k.call(p.branchAdmin, 'POST', `/v1/facilities/${f2}/departments`, { code: 'X', name: 'Elsewhere' }, true)).status).toBe(403);
    expect((await k.call(p.frontDesk, 'POST', `/v1/facilities/${f1}/departments`, { code: 'Y', name: 'Desk dept' }, true)).status).toBe(403);
    const renamed = await k.call(p.branchAdmin, 'PATCH', `/v1/departments/${dept}`, { version: 1, name: 'Ear, Nose & Throat' });
    expect(renamed.status).toBe(200);

    const room = await k.call(p.branchAdmin, 'POST', `/v1/facilities/${f1}/consult-rooms`, { code: 'C-7', name: 'Consult 7', departmentId: dept }, true);
    expect(room.status).toBe(201);
    expect((await k.call(p.branchAdmin, 'PATCH', `/v1/consult-rooms/${room.body.locationId}`, { version: 1, name: 'Consult room 7' })).status).toBe(200);
    const dir = (await k.call(p.frontDesk, 'GET', `/v1/facilities/${f1}/directory`)).body;
    expect(dir.departments.find((d: { departmentId: string }) => d.departmentId === dept)).toMatchObject({ name: 'Ear, Nose & Throat', status: 'active', version: 2 });
    expect(dir.consultRooms.find((r: { locationId: string }) => r.locationId === room.body.locationId)).toMatchObject({ name: 'Consult room 7' });
  });

  it('creates a bookable service with its opening fee; fees need pricing permission', async () => {
    const body = { code: `ENT-OPD-${k.run}`, name: 'ENT OPD', serviceMode: 'both', defaultDurationMin: 15, feeMinor: 45000 };
    expect((await k.call(p.frontDesk, 'POST', `/v1/departments/${dept}/services`, body, true)).status).toBe(403);
    const made = await k.call(p.branchAdmin, 'POST', `/v1/departments/${dept}/services`, body, true);
    expect(made.status).toBe(201);
    svc = made.body.healthcareServiceId;
    const book = (await k.call(p.frontDesk, 'GET', `/v1/facilities/${f1}/price-book?on=${localDay()}`)).body.items;
    expect(book).toContainEqual(expect.objectContaining({ healthcareServiceId: svc, staffId: null, mode: 'any', feeMinor: 45000 }));
    // The service fee changes from tomorrow; today's price stays.
    const changed = await k.call(p.branchAdmin, 'PUT', `/v1/healthcare-services/${svc}/fee`, { mode: 'any', feeMinor: 50000, effectiveFrom: localDay(1) });
    expect(changed.status).toBe(200);
    const after = (await k.call(p.frontDesk, 'GET', `/v1/facilities/${f1}/price-book?on=${localDay()}`)).body.items.filter((i: { healthcareServiceId: string }) => i.healthcareServiceId === svc);
    expect(after.map((i: { feeMinor: number; validTo: string | null }) => [i.feeMinor, i.validTo])).toEqual([
      [45000, localDay(1)],
      [50000, null],
    ]);
    expect((await k.call(p.branchAdmin, 'PUT', `/v1/healthcare-services/${svc}/fee`, { mode: 'any', feeMinor: 1, effectiveFrom: localDay(-1) })).body.error.details).toMatchObject({ reason: 'past_date' });
    expect((await k.call(p.frontDesk, 'PUT', `/v1/healthcare-services/${svc}/fee`, { mode: 'any', feeMinor: 1, effectiveFrom: localDay(1) })).status).toBe(403);
  });

  it('nothing in use is switched off: a department with services, a service or room in weekly hours', async () => {
    const dep = await k.call(p.branchAdmin, 'GET', `/v1/facilities/${f1}/directory`);
    const d = dep.body.departments.find((x: { departmentId: string }) => x.departmentId === dept);
    expect((await k.call(p.branchAdmin, 'PATCH', `/v1/departments/${dept}`, { version: d.version, status: 'inactive' })).body.error.details).toMatchObject({ reason: 'in_use', services: 1 });
    const s = dep.body.services.find((x: { healthcareServiceId: string }) => x.healthcareServiceId === svc);
    const offed = await k.call(p.branchAdmin, 'PATCH', `/v1/healthcare-services/${svc}`, { version: s.version, status: 'inactive', name: 'ENT clinic' });
    expect(offed.status).toBe(200);
    // Switched-off rows stay visible to managers who ask, never to others.
    const managers = (await k.call(p.branchAdmin, 'GET', `/v1/facilities/${f1}/directory?includeInactive=true`)).body.services;
    expect(managers.find((x: { healthcareServiceId: string }) => x.healthcareServiceId === svc)).toMatchObject({ status: 'inactive', name: 'ENT clinic' });
    expect((await k.call(p.frontDesk, 'GET', `/v1/facilities/${f1}/directory?includeInactive=true`)).body.services.map((x: { healthcareServiceId: string }) => x.healthcareServiceId)).not.toContain(svc);
    expect((await k.call(p.branchAdmin, 'PATCH', `/v1/healthcare-services/${svc}`, { version: offed.body.version, status: 'active' })).status).toBe(200);
  });
});

describe('doctor profile and clinics', () => {
  let dept: string;
  beforeAll(async () => {
    dept = (await k.call(p.admin, 'POST', `/v1/facilities/${f1}/departments`, { code: 'GM', name: 'General Medicine' }, true)).body.departmentId;
  });

  it('adds the doctor to a clinic, saves the booking profile once, and refuses a stale save', async () => {
    expect((await k.call(p.branchAdmin, 'POST', `/v1/practitioners/${p.doctor.staffId}/affiliations`, { facilityId: f2, departmentId: dept, validFrom: localDay() }, true)).status).toBe(403);
    expect((await k.call(p.branchAdmin, 'POST', `/v1/practitioners/${p.doctor.staffId}/affiliations`, { facilityId: f1, departmentId: dept, validFrom: localDay() }, true)).status).toBe(201);
    expect((await k.call(p.branchAdmin, 'POST', `/v1/practitioners/${p.doctor.staffId}/affiliations`, { facilityId: f1, departmentId: dept, validFrom: localDay() }, true)).body.error.details).toMatchObject({ reason: 'already_affiliated' });
    const profile = { specialty: null, qualifications: ['MBBS', 'MD'], bio: 'Physician.', experienceYears: 9, languages: ['en', 'ml'], acceptsVirtual: true, publicSlug: null, published: false };
    const first = await k.call(p.branchAdmin, 'PUT', `/v1/practitioners/${p.doctor.staffId}/profile`, profile);
    expect(first.status).toBe(200);
    expect((await k.call(p.branchAdmin, 'PUT', `/v1/practitioners/${p.doctor.staffId}/profile`, profile)).body.error.details).toMatchObject({ reason: 'stale_version' });
    expect((await k.call(p.branchAdmin, 'PUT', `/v1/practitioners/${p.doctor.staffId}/profile`, { ...profile, version: first.body.version, published: true })).body.error.details).toMatchObject({ reason: 'slug_required' });
    expect((await k.call(p.frontDesk, 'PUT', `/v1/practitioners/${p.doctor.staffId}/profile`, { ...profile, version: first.body.version })).status).toBe(403);
    const read = (await k.call(p.frontDesk, 'GET', `/v1/practitioners/${p.doctor.staffId}/profile?facilityId=${f1}`)).body;
    expect(read).toMatchObject({ displayName: 'Dr Kavya Menon', calendarId: null, profile: { qualifications: ['MBBS', 'MD'], acceptsVirtual: true } });
    expect(read.affiliations).toHaveLength(1);
    const listed = (await k.call(p.frontDesk, 'GET', `/v1/practitioners?facilityId=${f1}`)).body.items;
    expect(listed).toContainEqual(expect.objectContaining({ staffId: p.doctor.staffId, acceptsVirtual: true, department: 'General Medicine' }));
  });

  it('renames staff where the editor manages them everywhere they work', async () => {
    const read = (await k.call(p.admin, 'GET', `/v1/practitioners/${p.doctor.staffId}/profile?facilityId=${f1}`)).body;
    const saved = await k.call(p.branchAdmin, 'PATCH', `/v1/staff/${p.doctor.staffId}`, { version: read.staffVersion, displayName: 'Dr Kavya R Menon', phone: '+919900112233' });
    expect(saved.status).toBe(200);
    expect((await k.call(p.frontDesk, 'PATCH', `/v1/staff/${p.doctor.staffId}`, { version: saved.body.version, phone: null })).status).toBe(403);
    expect((await k.call(p.admin, 'GET', `/v1/practitioners/${p.doctor.staffId}/profile?facilityId=${f1}`)).body).toMatchObject({ displayName: 'Dr Kavya R Menon', phone: '+919900112233' });
  });
});

describe('patient details (G24)', () => {
  let patientId: string;
  beforeAll(async () => {
    patientId = (await k.call(p.frontDesk, 'POST', '/v1/patients', { givenName: 'Lakshmi', sex: 'female', phone: '+919811111111', registeredFacilityId: f1, source: 'front_desk' }, true)).body.patientId;
  });

  it('updates demographics and replaces the phone, keeping the old one on record', async () => {
    const v1 = (await k.call(p.frontDesk, 'GET', `/v1/patients/${patientId}`)).body;
    const saved = await k.call(p.frontDesk, 'PATCH', `/v1/patients/${patientId}`, {
      version: v1.version,
      familyName: 'Narayan',
      birthDate: '1980-04-02',
      phone: '+919822222222',
      email: 'Lakshmi@Example.com',
      address: { line1: '4 Temple St', line2: null, city: 'Bengaluru', district: null, stateCode: '29', pincode: '560004' },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.changed).toEqual(['familyName', 'birthDate', 'phone', 'email', 'address']);
    const v2 = (await k.call(p.frontDesk, 'GET', `/v1/patients/${patientId}`)).body;
    expect(v2).toMatchObject({ familyName: 'Narayan', birthDate: '1980-04-02', version: saved.body.version, address: { line1: '4 Temple St', pincode: '560004' } });
    expect(v2.contacts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'phone', value: '+919822222222' }), expect.objectContaining({ kind: 'email', value: 'lakshmi@example.com' })]));
    expect(v2.contacts).toHaveLength(2);
    const { rows } = await k.admin.query(`SELECT value, valid_to FROM patient.patient_contact WHERE patient_id = $1 AND kind = 'phone' ORDER BY created_at`, [patientId]);
    expect(rows.map((r) => [r.value, r.valid_to !== null])).toEqual([
      ['+919811111111', true],
      ['+919822222222', false],
    ]);
    // Found by the new number; the audit names the fields, not the values.
    expect((await k.call(p.frontDesk, 'GET', '/v1/patients?phone=%2B919822222222')).body.items.map((x: { patientId: string }) => x.patientId)).toContain(patientId);
    const audit = (await audits(patientId)).at(-1)!;
    expect(audit).toMatchObject({ action: 'update', diff: { fields: ['familyName', 'birthDate', 'phone', 'email', 'address'] } });
    expect(JSON.stringify(audit.diff)).not.toContain('9822222222');
  });

  it('refuses a stale form, a future birth date, and people without patients.update', async () => {
    const v = (await k.call(p.frontDesk, 'GET', `/v1/patients/${patientId}`)).body.version;
    expect((await k.call(p.frontDesk, 'PATCH', `/v1/patients/${patientId}`, { version: v - 1, occupation: 'Teacher' })).body.error.details).toMatchObject({ reason: 'stale_version' });
    expect((await k.call(p.frontDesk, 'PATCH', `/v1/patients/${patientId}`, { version: v, birthDate: localDay(2) })).status).toBe(400);
    expect((await k.call(p.nurse, 'PATCH', `/v1/patients/${patientId}`, { version: v, occupation: 'Teacher' })).status).toBe(403);
    expect((await k.call(p.frontDesk, 'PATCH', `/v1/patients/${patientId}`, { version: v, phone: '98222' })).status).toBe(400);
    const same = await k.call(p.frontDesk, 'PATCH', `/v1/patients/${patientId}`, { version: v, phone: '+919822222222' });
    expect(same.body).toMatchObject({ version: v, changed: [] }); // nothing to change, nothing written
  });
});

describe('custom roles', () => {
  it('retires a copy nobody holds; built-in and held roles stay', async () => {
    const roles = (await k.call(p.admin, 'GET', '/v1/roles')).body.roles;
    const frontDesk = roles.find((r: { code: string }) => r.code === 'front_desk').roleId;
    const copy = await k.call(p.admin, 'POST', '/v1/roles', { name: `Desk copy ${k.run}`, copyOfRoleId: frontDesk }, true);
    expect(copy.status).toBe(201);
    expect((await k.call(p.admin, 'POST', `/v1/roles/${frontDesk}/retire`, { reason: 'not needed' })).body.error.details).toMatchObject({ reason: 'built_in' });
    const grant = await k.call(p.admin, 'POST', `/v1/staff/${p.nurse.staffId}/grants`, { roleId: copy.body.roleId, facilityId: f1 }, true);
    expect(grant.status).toBe(201);
    expect((await k.call(p.admin, 'POST', `/v1/roles/${copy.body.roleId}/retire`, { reason: 'not needed' })).body.error.details).toMatchObject({ reason: 'in_use' });
    expect((await k.call(p.admin, 'POST', `/v1/role-grants/${grant.body.grantId}/revoke`, { reason: 'test over' })).status).toBe(200);
    expect((await k.call(p.branchAdmin, 'POST', `/v1/roles/${copy.body.roleId}/retire`, { reason: 'not needed' })).status).toBe(403);
    expect((await k.call(p.admin, 'POST', `/v1/roles/${copy.body.roleId}/retire`, { reason: 'not needed' })).status).toBe(200);
    expect((await k.call(p.admin, 'GET', '/v1/roles')).body.roles.map((r: { roleId: string }) => r.roleId)).not.toContain(copy.body.roleId);
  });
});

describe('weekly hours offer a service, and fee changes never race', () => {
  let doc: Person;
  let dept: string;
  let svcA: string;
  let svcB: string;
  beforeAll(async () => {
    doc = await k.person('Dr Two Services', 'doctor', f1, 'doctor');
    dept = (await k.call(p.admin, 'POST', `/v1/facilities/${f1}/departments`, { code: `D2-${k.run}`, name: 'Two services' }, true)).body.departmentId;
    const svc = (code: string, mode: string) => k.call(p.admin, 'POST', `/v1/departments/${dept}/services`, { code: `${code}-${k.run}`, name: `Service ${code}`, serviceMode: mode, defaultDurationMin: 15, feeMinor: 30000 }, true);
    svcA = (await svc('A', 'in_person')).body.healthcareServiceId;
    svcB = (await svc('B', 'both')).body.healthcareServiceId;
    await k.call(p.admin, 'POST', `/v1/practitioners/${doc.staffId}/affiliations`, { facilityId: f1, departmentId: dept, validFrom: localDay() }, true);
    await k.call(p.admin, 'POST', `/v1/practitioners/${doc.staffId}/calendar`);
  });
  const plan = (extra: Record<string, unknown>, visitMode = 'in_person') =>
    k.call(p.admin, 'PUT', `/v1/practitioners/${doc.staffId}/weekly-plan`, { facilityId: f1, visitMode, effectiveFrom: localDay(1), slotMinutes: 15, sessions: [{ weekday: 1, start: '09:00', end: '10:00' }], ...extra }, true);
  const ruleServices = async (mode: string) =>
    (
      await k.admin.query(
        `SELECT r.healthcare_service_id FROM booking.schedule_rule r JOIN booking.schedulable_resource sr ON sr.id = r.resource_id
         WHERE sr.staff_id = $1 AND r.visit_mode = $2 AND r.withdrawn_at IS NULL ORDER BY r.created_at DESC LIMIT 1`,
        [doc.staffId, mode],
      )
    ).rows.map((r) => r.healthcare_service_id);

  it('uses the named service, refuses one that is elsewhere or not offered in that mode, and guesses only when unambiguous', async () => {
    expect((await plan({})).status).toBe(200);
    expect(await ruleServices('in_person')).toEqual([null]); // two services fit: nothing is guessed
    expect((await plan({ healthcareServiceId: svcA })).status).toBe(200);
    expect(await ruleServices('in_person')).toEqual([svcA]);
    expect((await plan({})).status).toBe(200); // omitted: keeps what the replaced hours offered
    expect(await ruleServices('in_person')).toEqual([svcA]);
    // A is in person only
    const video = { sessions: [{ weekday: 1, start: '10:00', end: '11:00' }] }; // not overlapping the in-person hours
    expect((await plan({ ...video, healthcareServiceId: svcA }, 'virtual')).status).toBe(400);
    expect((await plan(video, 'virtual')).status).toBe(200); // only B is offered by video
    expect(await ruleServices('virtual')).toEqual([svcB]);
    const elsewhere = (await k.call(p.admin, 'POST', `/v1/facilities/${f2}/departments`, { code: `X-${k.run}`, name: 'Elsewhere' }, true)).body.departmentId;
    const other = (await k.call(p.admin, 'POST', `/v1/departments/${elsewhere}/services`, { code: `X-${k.run}`, name: 'Elsewhere', serviceMode: 'both', defaultDurationMin: 15 }, true)).body.healthcareServiceId;
    expect((await plan({ healthcareServiceId: other })).status).toBe(400);
  });

  it('concurrent fee changes publish one version each; exactly one list stays active', async () => {
    const results = await Promise.all(
      [31000, 32000, 33000].map((fee) => k.call(p.admin, 'PUT', `/v1/healthcare-services/${svcA}/fee`, { mode: 'any', feeMinor: fee, effectiveFrom: localDay(10) })),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(new Set(results.map((r) => r.body.listVersion)).size).toBe(3);
    const { rows } = await k.admin.query(`SELECT count(*)::int AS n FROM catalog.price_list WHERE tenant_id = $1 AND status = 'active' AND is_default`, [k.tenant.tenantId]);
    expect(rows[0].n).toBe(1);
    // They ran one after another: the price from that date is the one published last, the opening price before it.
    const last = results.reduce((a, b) => (a.body.listVersion > b.body.listVersion ? a : b));
    const fee = [31000, 32000, 33000][results.indexOf(last)];
    const book = (await k.call(p.admin, 'GET', `/v1/facilities/${f1}/price-book?on=${localDay(9)}`)).body.items.filter((i: { healthcareServiceId: string }) => i.healthcareServiceId === svcA);
    expect(book.map((i: { feeMinor: number; validFrom: string }) => [i.feeMinor, i.validFrom])).toEqual([
      [30000, localDay()],
      [fee, localDay(10)],
    ]);
  });
});

describe('doctor details are read through a clinic they work at', () => {
  it('another clinic, or someone who is not a doctor there, is 404; contact needs staff.read', async () => {
    const f2Desk = await k.person('Branch Two Desk', 'front_desk', f2);
    expect((await k.call(f2Desk, 'GET', `/v1/practitioners/${p.doctor.staffId}/profile?facilityId=${f2}`)).status).toBe(404);
    expect((await k.call(p.frontDesk, 'GET', `/v1/practitioners/${p.branchAdmin.staffId}/profile?facilityId=${f1}`)).status).toBe(404);
    expect((await k.call(f2Desk, 'GET', `/v1/practitioners/${p.doctor.staffId}/profile?facilityId=${f1}`)).status).toBe(403);
    const auditor = await k.person('Audit Person', 'auditor', null);
    await k.admin.query(`DELETE FROM platform.role_grant WHERE staff_id = $1`, [auditor.staffId]);
    const readOnly = await k.admin.query<{ id: string }>(`INSERT INTO platform.role (tenant_id, code, name) VALUES ($1, $2, 'Catalogue only') RETURNING id`, [k.tenant.tenantId, `cat_${k.run}`]);
    await k.admin.query(`INSERT INTO platform.role_permission (role_id, permission_id) SELECT $1, id FROM platform.permission WHERE code = 'catalog.read'`, [readOnly.rows[0]!.id]);
    await k.admin.query(`INSERT INTO platform.role_grant (tenant_id, staff_id, role_id, facility_id) VALUES ($1, $2, $3, $4)`, [k.tenant.tenantId, auditor.staffId, readOnly.rows[0]!.id, f1]);
    const seen = await k.call(auditor, 'GET', `/v1/practitioners/${p.doctor.staffId}/profile?facilityId=${f1}`);
    expect(seen).toMatchObject({ status: 200, body: { phone: null, email: null } });
    expect((await k.call(p.frontDesk, 'GET', `/v1/practitioners/${p.doctor.staffId}/profile?facilityId=${f1}`)).body.phone).toBe('+919900112233');
  });
});
