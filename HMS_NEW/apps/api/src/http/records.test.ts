// Phase 7 over HTTP: the rest of M01 (registrations, care assignments, break-glass review, module
// switches, session context, invite expiry), M02 (identifiers, relatives, consents, flags, merges),
// M04 (calendar board, exact-time holds, outcome lookup, queue/encounter sync) and M05 (triage, MLC,
// immunizations, care plans, referrals, births, deaths, nursing signatures, consent documents).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signDevToken } from '../auth/dev-token.ts';
import { DEV_ISSUER } from '../config.ts';
import { ist, localDay, nextMonday, startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let f1: string;
let f2: string;
const p = {} as Record<'admin' | 'branchAdmin' | 'frontDesk' | 'nurse' | 'doctor' | 'doctor2' | 'admin2', Person>;
const ok = (res: { status: number; body: any }, status = 200) => {
  expect(res, JSON.stringify(res.body)).toMatchObject({ status });
  return res.body;
};
const reason = (res: { body: any }) => res.body?.error?.details?.reason;
let patientId: string;

beforeAll(async () => {
  k = await startKit('records');
  f1 = k.tenant.facilityId;
  f2 = (await k.admin.query<{ id: string }>(`INSERT INTO platform.facility (tenant_id, organization_id, code, name, facility_type, state_code) VALUES ($1, $2, 'F2', 'Branch 2', 'clinic', '29') RETURNING id`, [k.tenant.tenantId, k.tenant.organizationId])).rows[0]!.id;
  p.admin = await k.person('Priya Admin', 'tenant_admin', null);
  p.admin2 = await k.person('Second Admin', 'tenant_admin', null);
  p.branchAdmin = await k.person('Branch Lead', 'tenant_admin', f1);
  p.frontDesk = await k.person('Ravi Desk', 'front_desk', f1);
  p.nurse = await k.person('Meena Nurse', 'nurse', f1, 'nurse');
  p.doctor = await k.person('Dr Kavya', 'doctor', f1, 'doctor');
  p.doctor2 = await k.person('Dr Arjun', 'doctor', f1, 'doctor');
  patientId = ok(await k.call(p.frontDesk, 'POST', '/v1/patients', { givenName: 'Lakshmi', sex: 'female', registeredFacilityId: f1, source: 'front_desk' }, true), 201).patientId;
});
afterAll(async () => k?.close());

const encounter = async (who: Person = p.doctor, patient = patientId, cls = 'outpatient') =>
  ok(await k.call(who, 'POST', '/v1/encounters', { patientId: patient, facilityId: f1, attendingStaffId: p.doctor.staffId, encounterClass: cls }, true), 201).encounterId as string;

describe('M01 administration', () => {
  it('registrations: added by staff managers, renewed (clearing verification), verified by someone else', async () => {
    const add = (who: Person, body: Record<string, unknown> = {}) =>
      k.call(who, 'POST', `/v1/staff/${p.nurse.staffId}/registrations`, { council: 'Karnataka Nursing Council', registrationNo: `KNC-${k.run}`, validUntil: localDay(365), ...body }, true);
    expect((await add(p.frontDesk)).status).toBe(403);
    const reg = ok(await add(p.branchAdmin), 201);
    expect(reason(await add(p.branchAdmin))).toBe('duplicate_registration');
    const list = () => k.call(p.frontDesk, 'GET', `/v1/staff/${p.nurse.staffId}/registrations`);
    const r1 = ok(await list()).items[0];
    const verified = ok(await k.call(p.branchAdmin, 'PATCH', `/v1/staff-registrations/${reg.registrationId}`, { version: r1.version, verify: true }));
    expect(ok(await list()).items[0]).toMatchObject({ verifiedBy: p.branchAdmin.staffId });
    ok(await k.call(p.branchAdmin, 'PATCH', `/v1/staff-registrations/${reg.registrationId}`, { version: verified.version, validUntil: localDay(730) }));
    expect(ok(await list()).items[0]).toMatchObject({ validUntil: localDay(730), verifiedAt: null });
    // Doctors need one to sign; add theirs here.
    for (const d of [p.doctor, p.doctor2]) {
      await k.admin.query(`INSERT INTO platform.staff_registration (tenant_id, staff_id, council, registration_no, valid_until) VALUES ($1, $2, 'NMC', $3, $4)`, [k.tenant.tenantId, d.staffId, `NMC-${d.staffId}`, localDay(365)]);
    }
  });

  it('care assignments give and end chart access', async () => {
    const chart = () => k.call(p.nurse, 'GET', `/v1/patients/${patientId}/chart`);
    expect(reason(await chart())).toBe('no_care_relationship');
    expect((await k.call(p.frontDesk, 'POST', '/v1/care-assignments', { staffId: p.nurse.staffId, patientId, reason: 'nursing', validTo: null }, true)).status).toBe(403);
    const a = ok(await k.call(p.doctor, 'POST', '/v1/care-assignments', { staffId: p.nurse.staffId, patientId, reason: 'nursing', validTo: null }, true), 201);
    ok(await chart());
    expect(ok(await k.call(p.doctor, 'GET', `/v1/care-assignments?patientId=${patientId}`)).items).toEqual([expect.objectContaining({ careAssignmentId: a.careAssignmentId, staffName: 'Meena Nurse', validTo: null })]);
    ok(await k.call(p.doctor, 'POST', `/v1/care-assignments/${a.careAssignmentId}/end`, { reason: 'Shift over' }));
    expect(reason(await chart())).toBe('no_care_relationship');
  });

  it('break-glass access is reviewed by someone else, once, by an every-clinic reviewer', async () => {
    const other = ok(await k.call(p.frontDesk, 'POST', '/v1/patients', { givenName: 'Unrelated', sex: 'male', registeredFacilityId: f1, source: 'front_desk' }, true), 201).patientId;
    const grant = ok(await k.call(p.doctor2, 'POST', `/v1/patients/${other}/break-glass`, { reason: 'Collapsed in the waiting area', hours: 1 }, true), 201);
    ok(await k.call(p.doctor2, 'GET', `/v1/patients/${other}/chart`));
    expect((await k.call(p.branchAdmin, 'GET', '/v1/break-glass')).status).toBe(403);
    const pending = ok(await k.call(p.admin, 'GET', '/v1/break-glass')).items;
    const row = pending.find((g: { patientId: string }) => g.patientId === other);
    expect(row).toMatchObject({ staffName: 'Dr Arjun', reviewedAt: null });
    expect(row.chartViews).toBeGreaterThanOrEqual(1);
    ok(await k.call(p.admin, 'POST', `/v1/break-glass/${row.grantId}/review`, { outcome: 'appropriate', note: 'Emergency confirmed by ER log' }));
    expect(reason(await k.call(p.admin2, 'POST', `/v1/break-glass/${row.grantId}/review`, { outcome: 'inappropriate', note: 'second look' }))).toBe('already_reviewed');
    expect(ok(await k.call(p.admin, 'GET', '/v1/break-glass?status=reviewed')).items.map((g: { grantId: string }) => g.grantId)).toContain(row.grantId);
    expect(grant).toBeTruthy();
  });

  it('module switches: optional modules suspend and resume, the core never does, stale edits are refused', async () => {
    const mods = ok(await k.call(p.frontDesk, 'GET', '/v1/modules')).items;
    expect(mods.find((m: { module: string }) => m.module === 'insurance')).toMatchObject({ state: 'active', core: false, version: 0 });
    expect((await k.call(p.branchAdmin, 'PUT', '/v1/modules/insurance', { state: 'suspended', version: 0, reason: 'Pilot paused' })).status).toBe(403);
    expect(reason(await k.call(p.admin, 'PUT', '/v1/modules/booking', { state: 'suspended', version: 0, reason: 'nope' }))).toBe('core_module');
    const s = ok(await k.call(p.admin, 'PUT', '/v1/modules/insurance', { state: 'suspended', version: 0, reason: 'Pilot paused' }));
    expect(reason(await k.call(p.admin, 'PUT', '/v1/modules/insurance', { state: 'active', version: 0, reason: 'again' }))).toBe('stale_version');
    expect(reason(await k.call(p.admin, 'PUT', '/v1/modules/insurance', { state: 'validated', version: s.version, reason: 'skip' }))).toBe('invalid_transition');
    ok(await k.call(p.admin, 'PUT', '/v1/modules/insurance', { state: 'active', version: s.version, reason: 'Pilot resumed' }));
    const ctx = ok(await k.call(p.frontDesk, 'GET', '/v1/session-context'));
    expect(ctx).toMatchObject({ tenant: { tenantId: k.tenant.tenantId }, staff: { displayName: 'Ravi Desk' } });
    expect(ctx.facilities.map((f: { facilityId: string }) => f.facilityId)).toEqual([f1]);
  });

  it('names the hospitals an identity can choose between, and invites expire until renewed', async () => {
    // A second tenant for the same identity.
    const subject = `multi-${k.run}`;
    const other = await k.admin.query<{ id: string }>(`INSERT INTO platform.tenant (name, slug, status) VALUES ('Second Hospital', $1, 'active') RETURNING id`, [`second-${k.run}`]);
    for (const tenantId of [k.tenant.tenantId, other.rows[0]!.id]) {
      const s = await k.admin.query<{ id: string }>(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, $2, 'Multi', 'Multi', 'admin') RETURNING id`, [tenantId, subject]);
      await k.admin.query(`INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, status) VALUES ($1, $2, $3, $4, 'active')`, [tenantId, s.rows[0]!.id, DEV_ISSUER, subject]);
    }
    const multi = await k.call({ staffId: '', token: await signDevToken(subject) }, 'GET', '/v1/me');
    expect(multi.status).toBe(400);
    expect(multi.body.error.details.tenantNames.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining(['Second Hospital']));

    const roles = ok(await k.call(p.admin, 'GET', '/v1/roles')).roles;
    const email = `late.${k.run}@clinic.example`;
    const invited = ok(await k.call(p.admin, 'POST', '/v1/staff-accounts', { displayName: 'Late Joiner', employeeNo: `LJ-${k.run}`, staffType: 'admin', email, roleId: roles.find((r: { code: string }) => r.code === 'front_desk').roleId, facilityId: f1 }, true), 201);
    await k.admin.query(`UPDATE platform.user_account SET invite_expires_at = now() - interval '1 day' WHERE staff_id = $1`, [invited.staffId]);
    const late = { staffId: invited.staffId, token: await signDevToken(`late-${k.run}`, { email }) };
    expect((await k.call(late, 'GET', '/v1/me')).status).toBe(403);
    ok(await k.call(p.admin, 'POST', `/v1/staff/${invited.staffId}/invite/renew`));
    expect(ok(await k.call(late, 'GET', '/v1/me'))).toMatchObject({ staffId: invited.staffId });
    expect(reason(await k.call(p.admin, 'POST', `/v1/staff/${invited.staffId}/invite/renew`))).toBe('already_linked');
  });
});

describe('M02 patient registry', () => {
  it('identifiers: format and uniqueness are enforced; removal retires the value so it can be recorded again', async () => {
    const add = (body: Record<string, unknown>) => k.call(p.frontDesk, 'POST', `/v1/patients/${patientId}/identifiers`, body, true);
    expect(reason(await add({ system: 'abha_number', value: '12-3456' }))).toBe('bad_format');
    const abha = ok(await add({ system: 'abha_number', value: `91-${k.run.replace(/\D/g, '').padEnd(4, '1').slice(0, 4)}-5678-9012`, isPrimary: true, verifiedVia: 'document' }), 201);
    expect(reason(await add({ system: 'abha_number', value: `91-${k.run.replace(/\D/g, '').padEnd(4, '1').slice(0, 4)}-5678-9012` }))).toBe('duplicate_identifier');
    ok(await add({ system: 'pan', value: 'abcde1234f' }), 201);
    const reg = ok(await k.call(p.frontDesk, 'GET', `/v1/patients/${patientId}/registry`));
    expect(reg.identifiers.map((i: { system: string; value: string }) => [i.system, i.value]).sort()).toEqual(expect.arrayContaining([['pan', 'ABCDE1234F']]));
    expect((await k.call(p.nurse, 'POST', `/v1/patient-identifiers/${abha.identifierId}/remove`, { reason: 'typo' })).status).toBe(403);
    ok(await k.call(p.frontDesk, 'POST', `/v1/patient-identifiers/${abha.identifierId}/remove`, { reason: 'Wrong card scanned' }));
    expect(ok(await k.call(p.frontDesk, 'GET', `/v1/patients/${patientId}/registry`)).identifiers.map((i: { system: string }) => i.system)).toEqual(['pan']);
    expect((await k.call(p.frontDesk, 'POST', `/v1/patient-identifiers/${abha.identifierId}/remove`, { reason: 'Again' })).status).toBe(404);
    ok(await add({ system: 'abha_number', value: `91-${k.run.replace(/\D/g, '').padEnd(4, '1').slice(0, 4)}-5678-9012` }), 201);
  });

  it('relatives and consents: a guardian signs for the patient; consents can be withdrawn', async () => {
    const rel = { name: 'Suresh', relationship: 'spouse', phone: '+919811100000', isGuardian: false, isEmergencyContact: true, isLegalRepresentative: false, representativeScope: null, relatedPatientId: null };
    const spouse = ok(await k.call(p.frontDesk, 'POST', `/v1/patients/${patientId}/related-persons`, rel, true), 201);
    const consent = (body: Record<string, unknown>) => k.call(p.frontDesk, 'POST', `/v1/patients/${patientId}/consents`, { consentType: 'treatment', status: 'signed', ...body }, true);
    expect(reason(await consent({ signedBy: 'guardian' }))).toBe('signer_required');
    expect(reason(await consent({ signedBy: 'guardian', relatedPersonId: spouse.relatedPersonId }))).toBe('not_guardian');
    const v = ok(await k.call(p.frontDesk, 'GET', `/v1/patients/${patientId}/registry`)).relatedPersons[0].version;
    ok(await k.call(p.frontDesk, 'PATCH', `/v1/related-persons/${spouse.relatedPersonId}`, { version: v, isGuardian: true }));
    const signed = ok(await consent({ signedBy: 'guardian', relatedPersonId: spouse.relatedPersonId }), 201);
    ok(await k.call(p.frontDesk, 'POST', `/v1/patient-consents/${signed.consentId}/withdraw`, { reason: 'Changed mind' }));
    const reg = ok(await k.call(p.frontDesk, 'GET', `/v1/patients/${patientId}/registry`));
    expect(reg.consents[0]).toMatchObject({ consentType: 'treatment', status: 'withdrawn', signerName: 'Suresh', witnessName: 'Ravi Desk' });
    expect(reason(await k.call(p.frontDesk, 'POST', `/v1/patient-consents/${signed.consentId}/withdraw`, { reason: 'again' }))).toBeUndefined();
  });

  it('flags: one active flag per type; sensitive reasons need the flag permission', async () => {
    expect((await k.call(p.frontDesk, 'POST', `/v1/patients/${patientId}/flags`, { flagType: 'fall_risk', reason: 'Unsteady gait' }, true)).status).toBe(403);
    const fall = ok(await k.call(p.nurse, 'POST', `/v1/patients/${patientId}/flags`, { flagType: 'fall_risk', reason: 'Unsteady gait' }, true), 201);
    expect(reason(await k.call(p.nurse, 'POST', `/v1/patients/${patientId}/flags`, { flagType: 'fall_risk', reason: 'Again' }, true))).toBe('already_set');
    ok(await k.call(p.nurse, 'POST', `/v1/patients/${patientId}/flags`, { flagType: 'safeguarding', reason: 'Suspected neglect, social worker informed' }, true), 201);
    const desk = ok(await k.call(p.frontDesk, 'GET', `/v1/patients/${patientId}/registry`)).flags;
    expect(desk.find((f: { flagType: string }) => f.flagType === 'safeguarding')).toMatchObject({ active: true, reason: null });
    expect(desk.find((f: { flagType: string }) => f.flagType === 'fall_risk')).toMatchObject({ reason: 'Unsteady gait' });
    ok(await k.call(p.nurse, 'POST', `/v1/patient-flags/${fall.flagId}/clear`, { reason: 'Mobilising well' }));
    expect(ok(await k.call(p.nurse, 'GET', `/v1/patients/${patientId}/registry`)).flags.find((f: { flagId: string }) => f.flagId === fall.flagId)).toMatchObject({ active: false });
  });

  it('duplicates: proposed by one person, merged by another, shown on the survivor, unmerged by a third', async () => {
    const dup = ok(await k.call(p.frontDesk, 'POST', '/v1/patients', { givenName: 'Lakshmi', familyName: 'Dup', sex: 'female', registeredFacilityId: f1, source: 'front_desk' }, true), 201).patientId;
    const dupVisit = await encounter(p.doctor, dup);
    const link = ok(await k.call(p.frontDesk, 'POST', '/v1/patient-links', { survivorPatientId: patientId, otherPatientId: dup, reason: 'Same phone and birth date' }, true), 201);
    expect(reason(await k.call(p.frontDesk, 'POST', '/v1/patient-links', { survivorPatientId: dup, otherPatientId: patientId, reason: 'again' }, true))).toBe('already_proposed');
    expect((await k.call(p.frontDesk, 'POST', `/v1/patient-links/${link.linkId}/decide`, { decision: 'merge', reason: 'Looks the same' })).status).toBe(403);
    ok(await k.call(p.admin, 'POST', `/v1/patient-links/${link.linkId}/decide`, { decision: 'merge', reason: 'Confirmed with the patient' }));
    expect(ok(await k.call(p.frontDesk, 'GET', `/v1/patients/${dup}`))).toMatchObject({ status: 'merged', mergedIntoPatientId: patientId });
    expect(ok(await k.call(p.frontDesk, 'GET', '/v1/patients?q=Dup')).items.map((x: { patientId: string }) => x.patientId)).not.toContain(dup);
    expect(reason(await k.call(p.frontDesk, 'PATCH', `/v1/patients/${dup}`, { version: 2, occupation: 'x' }))).toBe('merged');
    const chart = ok(await k.call(p.doctor, 'GET', `/v1/patients/${patientId}/chart`));
    expect(chart.encounters.map((e: { encounterId: string }) => e.encounterId)).toContain(dupVisit);
    expect(chart.mergedPatientIds).toEqual([dup]);
    // The merger and the proposer can't reverse it; someone else can.
    const merged = ok(await k.call(p.admin, 'GET', `/v1/patient-links?patientId=${dup}`)).items.find((l: { linkType: string }) => l.linkType === 'merged');
    expect(reason(await k.call(p.admin, 'POST', `/v1/patient-links/${merged.linkId}/unmerge`, { reason: 'mistake' }))).toBe('same_person');
    ok(await k.call(p.admin2, 'POST', `/v1/patient-links/${merged.linkId}/unmerge`, { reason: 'Twins, not the same person' }));
    expect(ok(await k.call(p.frontDesk, 'GET', `/v1/patients/${dup}`)).status).toBe('active');
  });
});

describe('M05 clinical records', () => {
  let enc: string;
  beforeAll(async () => {
    enc = await encounter();
  });

  it('triage, immunization and care plans on an open encounter', async () => {
    expect((await k.call(p.frontDesk, 'POST', `/v1/encounters/${enc}/triage`, { triageScale: 'india_colour', category: 'red' })).status).toBe(403);
    expect((await k.call(p.nurse, 'POST', `/v1/encounters/${enc}/triage`, { triageScale: 'esi', category: 'red' })).status).toBe(400);
    ok(await k.call(p.nurse, 'POST', `/v1/encounters/${enc}/triage`, { triageScale: 'india_colour', category: 'yellow', arrivalMode: 'walk_in', reassessInMinutes: 30 }), 201);
    const imm = ok(await k.call(p.nurse, 'POST', `/v1/encounters/${enc}/immunizations`, { vaccine: 'Tetanus toxoid', doseNumber: 1, route: 'intramuscular', site: 'left deltoid', lotNumber: 'TT-2026-01' }), 201);
    expect((await k.call(p.nurse, 'POST', `/v1/encounters/${enc}/immunizations`, { vaccine: 'Influenza', status: 'not_done' })).status).toBe(400);
    const plan = ok(await k.call(p.doctor, 'POST', `/v1/encounters/${enc}/care-plans`, { title: 'Diabetes control', activities: [{ kind: 'diet', description: 'Low sugar diet' }, { kind: 'follow_up', description: 'HbA1c in 3 months', frequency: 'quarterly' }] }), 201);
    const detail = ok(await k.call(p.doctor, 'GET', `/v1/encounters/${enc}`));
    expect(detail.records.triage[0]).toMatchObject({ category: 'yellow', assessedBy: 'Meena Nurse' });
    expect(detail.records.immunizations[0]).toMatchObject({ vaccine: 'Tetanus toxoid' });
    const act = detail.records.carePlans[0].activities[0];
    ok(await k.call(p.doctor, 'POST', `/v1/care-plan-activities/${act.activityId}/status`, { status: 'completed' }));
    ok(await k.call(p.doctor, 'POST', `/v1/care-plans/${plan.carePlanId}/status`, { status: 'completed', reason: 'Targets met' }));
    expect((await k.call(p.doctor, 'POST', `/v1/immunizations/${imm.immunizationId}/entered-in-error`, { reason: 'wrong patient' })).status).toBe(403);
    ok(await k.call(p.nurse, 'POST', `/v1/immunizations/${imm.immunizationId}/entered-in-error`, { reason: 'Wrong patient' }));
    const chart = ok(await k.call(p.doctor, 'GET', `/v1/patients/${patientId}/chart`));
    expect(chart.immunizations).toEqual([]);
    expect(chart.carePlans[0]).toMatchObject({ title: 'Diabetes control', status: 'completed' });
  });

  it('referrals: the doctor referred to accepts and can then read the chart', async () => {
    const ref = ok(await k.call(p.doctor, 'POST', `/v1/encounters/${enc}/referrals`, { direction: 'internal', reason: 'Cardiology opinion', urgency: 'urgent', toStaffId: p.doctor2.staffId }), 201);
    expect((await k.call(p.doctor, 'POST', `/v1/encounters/${enc}/referrals`, { direction: 'internal', reason: 'Nowhere' })).status).toBe(400);
    expect(ok(await k.call(p.doctor2, 'GET', `/v1/referrals?facilityId=${f1}&staffId=${p.doctor2.staffId}`)).items[0]).toMatchObject({ referralId: ref.referralId, urgency: 'urgent', referredByName: 'Dr Kavya' });
    expect(reason(await k.call(p.doctor, 'POST', `/v1/referrals/${ref.referralId}/respond`, { status: 'accepted' }))).toBe('not_recipient');
    ok(await k.call(p.doctor2, 'POST', `/v1/referrals/${ref.referralId}/respond`, { status: 'accepted', note: 'Will see tomorrow' }));
    ok(await k.call(p.doctor2, 'GET', `/v1/patients/${patientId}/chart`)); // care relationship from accepting
    expect(reason(await k.call(p.doctor2, 'POST', `/v1/referrals/${ref.referralId}/respond`, { status: 'rejected' }))).toBe('invalid_transition');
  });

  it('medico-legal records: opened by a doctor with a clinic number, hidden from those without mlc.read', async () => {
    expect((await k.call(p.frontDesk, 'POST', `/v1/encounters/${enc}/mlc`, { mlcType: 'road_traffic' })).status).toBe(403);
    const mlc = ok(await k.call(p.doctor, 'POST', `/v1/encounters/${enc}/mlc`, { mlcType: 'road_traffic', broughtByName: 'Passer-by', injuryDetails: [{ site: 'forehead', kind: 'laceration', size: '3 cm' }] }), 201);
    expect(mlc.mlcNo).toMatch(/^MLC\/\d{4}\/00001$/);
    expect(reason(await k.call(p.doctor, 'POST', `/v1/encounters/${enc}/mlc`, { mlcType: 'assault' }))).toBe('already_open');
    const det = ok(await k.call(p.doctor, 'GET', `/v1/encounters/${enc}`));
    ok(await k.call(p.doctor, 'PATCH', `/v1/mlc-records/${mlc.mlcId}`, { version: det.records.mlc.version, policeStation: 'Indiranagar PS', policeIntimatedAt: new Date().toISOString(), intimationMode: 'phone' }));
    // A role without mlc.read sees that there is one, not what is in it.
    await k.admin.query(`DELETE FROM platform.role_grant WHERE staff_id = $1`, [p.doctor2.staffId]);
    const role = await k.admin.query<{ id: string }>(`INSERT INTO platform.role (tenant_id, code, name) VALUES ($1, $2, 'Doctor without MLC') RETURNING id`, [k.tenant.tenantId, `nomlc_${k.run}`]);
    await k.admin.query(`INSERT INTO platform.role_permission (role_id, permission_id) SELECT $1, rp.permission_id FROM platform.role_permission rp JOIN platform.role r ON r.id = rp.role_id JOIN platform.permission pm ON pm.id = rp.permission_id WHERE r.tenant_id IS NULL AND r.code = 'doctor' AND pm.code NOT IN ('mlc.read', 'mlc.record')`, [role.rows[0]!.id]);
    await k.admin.query(`INSERT INTO platform.role_grant (tenant_id, staff_id, role_id, facility_id) VALUES ($1, $2, $3, $4)`, [k.tenant.tenantId, p.doctor2.staffId, role.rows[0]!.id, f1]);
    const hidden = ok(await k.call(p.doctor2, 'GET', `/v1/encounters/${enc}`));
    expect(hidden.records).toMatchObject({ mlc: null, hasMlc: true });
  });

  it('births and deaths: the newborn is their own patient; a death marks the patient deceased, once', async () => {
    const mother = ok(await k.call(p.frontDesk, 'POST', '/v1/patients', { givenName: 'Asha', sex: 'female', registeredFacilityId: f1, source: 'front_desk' }, true), 201).patientId;
    const baby = ok(await k.call(p.frontDesk, 'POST', '/v1/patients', { givenName: 'Baby of Asha', sex: 'male', registeredFacilityId: f1, source: 'front_desk' }, true), 201).patientId;
    const labour = await encounter(p.doctor, mother, 'emergency');
    expect((await k.call(p.nurse, 'POST', `/v1/encounters/${labour}/births`, { bornAt: new Date().toISOString(), sex: 'male', deliveryMethod: 'normal_vaginal', isLiveBirth: true })).status).toBe(403);
    const birth = ok(await k.call(p.doctor, 'POST', `/v1/encounters/${labour}/births`, { bornAt: new Date(Date.now() - 600_000).toISOString(), sex: 'male', birthWeightG: 3100, gestationWeeks: 39, deliveryMethod: 'normal_vaginal', apgar1: 8, apgar5: 9, isLiveBirth: true, babyPatientId: baby }), 201);
    expect(reason(await k.call(p.doctor, 'POST', `/v1/encounters/${labour}/births`, { bornAt: new Date().toISOString(), sex: 'male', deliveryMethod: 'normal_vaginal', isLiveBirth: true }))).toBe('duplicate_birth');
    ok(await k.call(p.doctor, 'POST', `/v1/birth-records/${birth.birthId}/report`, { civilRegistrationRef: 'BLR-2026-0001' }));

    const er = await encounter(p.doctor, patientId, 'emergency');
    const death = ok(await k.call(p.doctor, 'POST', `/v1/encounters/${er}/death`, { diedAt: new Date(Date.now() - 60_000).toISOString(), causeChain: ['Cardiac arrest', 'Acute myocardial infarction'], manner: 'natural' }), 201);
    expect((await k.admin.query(`SELECT deceased_at FROM patient.patient WHERE id = $1`, [patientId])).rows[0].deceased_at).not.toBeNull();
    expect(reason(await k.call(p.doctor, 'POST', `/v1/encounters/${er}/death`, { diedAt: new Date().toISOString(), causeChain: ['Recorded twice'], manner: 'natural' }))).toBe('already_recorded');
    ok(await k.call(p.doctor, 'POST', `/v1/death-records/${death.deathId}/certify`, { mccdForm: 'form_4', bodyReleasedTo: 'Suresh (spouse)' }));
    expect(reason(await k.call(p.doctor, 'POST', `/v1/death-records/${death.deathId}/certify`, { mccdForm: 'form_4' }))).toBe('already_issued');
  });

  it('nurses sign their own nursing notes, not other note types (G27)', async () => {
    const visit = await encounter();
    const note = (type: string) => k.call(p.nurse, 'POST', `/v1/encounters/${visit}/notes`, { noteType: type, narrative: 'Patient comfortable' }, true);
    const nursing = ok(await note('nursing'), 201);
    const progress = ok(await note('progress'), 201);
    ok(await k.call(p.nurse, 'POST', `/v1/notes/${nursing.noteId}/sign`));
    expect((await k.call(p.nurse, 'POST', `/v1/notes/${progress.noteId}/sign`)).status).toBe(403);
  });

  it('consent documents: drafts edit, publishing supersedes the previous version, retiring switches it off', async () => {
    const draft = (v: string) => k.call(p.admin, 'POST', '/v1/consent-documents', { docVersion: v, language: 'en', title: 'Video consultation consent', body: 'I agree to a video consultation with the doctor of the hospital.' }, true);
    expect((await k.call(p.branchAdmin, 'POST', '/v1/consent-documents', { docVersion: 'x', language: 'en', title: 'Nope', body: 'b'.repeat(30) }, true)).status).toBe(403);
    const v1 = ok(await draft(`1-${k.run}`), 201);
    const docs = ok(await k.call(p.frontDesk, 'GET', '/v1/consent-documents')).items;
    ok(await k.call(p.admin, 'PATCH', `/v1/consent-documents/${v1.documentId}`, { version: docs[0].version, body: 'I agree to a video consultation; I can stop at any time.' }));
    ok(await k.call(p.admin, 'POST', `/v1/consent-documents/${v1.documentId}/publish`));
    expect(reason(await k.call(p.admin, 'PATCH', `/v1/consent-documents/${v1.documentId}`, { version: 3, title: 'Changed' }))).toBe('published');
    const v2 = ok(await draft(`2-${k.run}`), 201);
    expect(ok(await k.call(p.admin, 'POST', `/v1/consent-documents/${v2.documentId}/publish`)).retired).toEqual([v1.documentId]);
    const now = ok(await k.call(p.frontDesk, 'GET', '/v1/consent-documents')).items;
    expect(now.filter((d: { current: boolean }) => d.current).map((d: { documentId: string }) => d.documentId)).toEqual([v2.documentId]);
    ok(await k.call(p.admin, 'POST', `/v1/consent-documents/${v2.documentId}/retire`, { reason: 'Legal review' }));
    expect(ok(await k.call(p.frontDesk, 'GET', '/v1/consent-documents')).items.some((d: { current: boolean }) => d.current)).toBe(false);
  });
});

describe('M04 board, exact-time holds, outcome lookup and queue sync', () => {
  const day = nextMonday(3);
  let svc: string;
  beforeAll(async () => {
    const dept = ok(await k.call(p.admin, 'POST', `/v1/facilities/${f1}/departments`, { code: `GM-${k.run}`, name: 'General Medicine' }, true), 201).departmentId;
    svc = ok(await k.call(p.admin, 'POST', `/v1/departments/${dept}/services`, { code: `GM-${k.run}`, name: 'GM OPD', serviceMode: 'in_person', defaultDurationMin: 15, feeMinor: 40000 }, true), 201).healthcareServiceId;
    ok(await k.call(p.admin, 'POST', `/v1/practitioners/${p.doctor.staffId}/affiliations`, { facilityId: f1, departmentId: dept, validFrom: localDay() }, true), 201);
    ok(await k.call(p.admin, 'POST', `/v1/practitioners/${p.doctor.staffId}/calendar`), 201);
    ok(await k.call(p.admin, 'PUT', `/v1/practitioners/${p.doctor.staffId}/weekly-plan`, { facilityId: f1, visitMode: 'in_person', effectiveFrom: localDay(1), slotMinutes: 15, sessions: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: '09:00', end: '11:00' })) }, true));
  });

  it('exact-time holds sit inside published hours, never overlap, and book like a slot', async () => {
    const range = (start: string, end: string, idem: string | true = true) => k.call(p.frontDesk, 'POST', '/v1/holds/range', { staffId: p.doctor.staffId, startsAt: ist(day, start), endsAt: ist(day, end) }, idem);
    expect(reason(await range('08:30', '08:45'))).toBe('outside_hours');
    expect((await range('09:05', '09:07')).status).toBe(400); // shorter than 5 minutes
    const key = `range-${k.run}`;
    const hold = ok(await range('09:05', '09:20', key), 201);
    expect(reason(await range('09:10', '09:25'))).toBe('slot_unavailable');
    expect(ok(await k.call(p.frontDesk, 'GET', `/v1/request-outcomes/${key}`))).toMatchObject({ status: 'completed', result: { reservationId: hold.reservationId } });
    expect((await k.call(p.frontDesk, 'GET', `/v1/request-outcomes/never-sent-${k.run}`)).status).toBe(404);
    const booked = ok(await k.call(p.frontDesk, 'POST', '/v1/appointments', { reservationId: hold.reservationId, patientId: (await k.call(p.frontDesk, 'POST', '/v1/patients', { givenName: 'Exact', sex: 'male', registeredFacilityId: f1, source: 'front_desk' }, true)).body.patientId, originChannel: 'front_desk' }, true), 201);
    expect(booked).toMatchObject({ startsAt: new Date(ist(day, '09:05')).toISOString(), endsAt: new Date(ist(day, '09:20')).toISOString(), feeMinor: 40000 });
    // A bot can't hold free-form time.
    const bot = await k.person('Booking bot', 'booking_agent', null);
    await k.admin.query(`UPDATE platform.staff SET is_system_account = true, staff_type = 'other' WHERE id = $1`, [bot.staffId]);
    expect(reason(await k.call(bot, 'POST', '/v1/holds/range', { staffId: p.doctor.staffId, startsAt: ist(day, '10:00'), endsAt: ist(day, '10:15') }, true))).toBe('staff_only');
  });

  it('the board shows the day for every doctor at the clinic in one read, scoped to the clinic', async () => {
    const board = ok(await k.call(p.frontDesk, 'GET', `/v1/calendar-board?facilityId=${f1}&date=${day}`));
    const row = board.rows.find((r: { staffId: string }) => r.staffId === p.doctor.staffId);
    expect(row).toMatchObject({ calendar: true, name: 'Dr Kavya' });
    expect(row.sessions).toHaveLength(1);
    expect(row.appointments).toEqual([expect.objectContaining({ patientName: 'Exact', status: 'confirmed' })]);
    expect(row.slots.find((s: { slotStart: string }) => s.slotStart === new Date(ist(day, '09:00')).toISOString())).toMatchObject({ status: 'taken' }); // 09:05 overlaps the 09:00 slot
    expect(board.counts.booked).toBe(1);
    expect((await k.call(p.frontDesk, 'GET', `/v1/calendar-board?facilityId=${f2}&date=${day}`)).status).toBe(403);
    expect(svc).toBeTruthy();
  });

  it('starting the consultation starts the queue token (G15)', async () => {
    const visit = ok(await k.call(p.frontDesk, 'GET', `/v1/appointments?facilityId=${f1}&from=${day}&to=${day}`)).items[0];
    ok(await k.call(p.frontDesk, 'POST', `/v1/appointments/${visit.appointmentId}/check-in`, {}, true, ist(day, '08:50')));
    await k.dispatch();
    const e = ok(await k.call(p.doctor, 'GET', `/v1/encounters?facilityId=${f1}&date=${day}`, undefined, undefined, ist(day, '09:00'))).items.find((x: { appointmentId: string }) => x.appointmentId === visit.appointmentId);
    ok(await k.call(p.doctor, 'POST', `/v1/encounters/${e.encounterId}/start`, undefined, undefined, ist(day, '09:06')));
    await k.dispatch();
    const queue = ok(await k.call(p.doctor, 'GET', `/v1/queue?staffId=${p.doctor.staffId}&facilityId=${f1}&date=${day}`));
    expect(queue.items[0]).toMatchObject({ status: 'in_service' });
  });
});
