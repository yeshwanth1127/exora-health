// M06 over HTTP: orders (panels, order sets, cancellation), specimens (collect, receive, reject,
// recollect), results (reference snapshot, flags, corrections, critical calls), microbiology, reports
// (versions, four-eyes release, amendment), acknowledgement, imaging with PC-PNDT Form F, reads, and
// the module switch.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localDay, startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let f1: string;
let deptId: string;
const p = {} as Record<'admin' | 'frontDesk' | 'doctor' | 'doctor2' | 'nurse' | 'labTech' | 'pathologist' | 'pathologist2' | 'radiographer' | 'radiologist', Person>;
const ok = (res: { status: number; body: any }, status = 200) => {
  expect(res, JSON.stringify(res.body)).toMatchObject({ status });
  return res.body;
};
const reason = (res: { body: any }) => res.body?.error?.details?.reason;
const svc = {} as Record<'hb' | 'glu' | 'panel' | 'culture' | 'cxr' | 'usg' | 'consult' | 'hidden', string>;
const def = {} as Record<'hb' | 'glu' | 'growth', string>;
let patientId: string;
let encounterId: string;

const one = async <T = Record<string, unknown>>(q: string, args: unknown[] = []) => (await k.admin.query(q, args)).rows[0] as T;
const events = async (type: string) => Number((await one<{ n: string }>(`SELECT count(*) AS n FROM platform.outbox_event WHERE tenant_id = $1 AND event_type = $2`, [k.tenant.tenantId, type])).n);

beforeAll(async () => {
  k = await startKit('diagnostics');
  f1 = k.tenant.facilityId;
  const t = k.tenant.tenantId;
  deptId = (await one<{ id: string }>(`INSERT INTO platform.department (tenant_id, facility_id, code, name, kind) VALUES ($1, $2, 'LAB', 'Laboratory', 'diagnostic') RETURNING id`, [t, f1])).id;
  p.admin = await k.person('Priya Admin', 'tenant_admin', null);
  p.frontDesk = await k.person('Ravi Desk', 'front_desk', f1);
  p.doctor = await k.person('Dr Kavya', 'doctor', f1, 'doctor');
  p.doctor2 = await k.person('Dr Arjun', 'doctor', f1, 'doctor');
  p.nurse = await k.person('Meena Nurse', 'nurse', f1, 'nurse');
  p.labTech = await k.person('Lab Tech', 'lab_technician', f1, 'technician');
  p.pathologist = await k.person('Dr Path', 'pathologist', f1, 'doctor');
  p.pathologist2 = await k.person('Dr Second Path', 'pathologist', f1, 'doctor');
  p.radiographer = await k.person('Rad Tech', 'radiographer', f1, 'technician');
  p.radiologist = await k.person('Dr Rad', 'radiologist', f1, 'doctor');

  const item = async (code: string, name: string, category: string, extra: { modality?: string; orderable?: boolean } = {}) =>
    (await one<{ id: string }>(`INSERT INTO catalog.service_item (tenant_id, code, name, category, modality, is_orderable, performing_department_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [
      t, code, name, category, extra.modality ?? null, extra.orderable ?? true, category.startsWith('lab') ? deptId : null,
    ])).id;
  svc.hb = await item('HB', 'Haemoglobin', 'lab_test');
  svc.glu = await item('GLU', 'Glucose (fasting)', 'lab_test');
  svc.panel = await item('BASIC', 'Basic screen', 'lab_panel');
  svc.culture = await item('UCS', 'Urine culture', 'lab_test');
  svc.cxr = await item('CXR', 'X-ray chest PA', 'imaging', { modality: 'DX' });
  svc.usg = await item('USG-OB', 'USG obstetric', 'imaging', { modality: 'US' });
  svc.consult = await item('CONS', 'Consultation', 'consultation');
  svc.hidden = await item('OLD', 'Retired test', 'lab_test', { orderable: false });
  for (const [child, seq] of [[svc.hb, 1], [svc.glu, 2]] as const) await k.admin.query(`INSERT INTO catalog.service_component (tenant_id, parent_item_id, child_item_id, sequence) VALUES ($1, $2, $3, $4)`, [t, svc.panel, child, seq]);
  await k.admin.query(
    `INSERT INTO catalog.lab_test_def (tenant_id, service_item_id, section, specimen_type, container_type) VALUES
       ($1, $2, 'haematology', 'whole_blood', 'edta'), ($1, $3, 'biochemistry', 'plasma', 'fluoride'), ($1, $4, 'microbiology', 'urine', 'sterile')`,
    [t, svc.hb, svc.glu, svc.culture],
  );
  const d = async (testId: string, code: string, name: string, type: string, unit: string | null) =>
    (await one<{ id: string }>(`INSERT INTO catalog.observation_definition (tenant_id, lab_test_item_id, code, name, category, value_type, unit) VALUES ($1, $2, $3, $4, 'lab', $5, $6) RETURNING id`, [t, testId, code, name, type, unit])).id;
  def.hb = await d(svc.hb, 'HB', 'Haemoglobin', 'numeric', 'g/dL');
  def.glu = await d(svc.glu, 'GLU', 'Glucose', 'numeric', 'mg/dL');
  def.growth = await d(svc.culture, 'UCS_GROWTH', 'Culture growth', 'culture', null);
  await k.admin.query(
    `INSERT INTO catalog.reference_range (tenant_id, observation_definition_id, sex, age_min_days, low, high, critical_low, critical_high, valid_from) VALUES
       ($1, $2, 'female', 6570, 12.0, 15.0, 7.0, 20.0, '2020-01-01'), ($1, $2, 'male', 6570, 13.0, 17.0, 7.0, 20.0, '2020-01-01'),
       ($1, $3, 'any', 0, 70, 100, 40, 450, '2020-01-01')`,
    [t, def.hb, def.glu],
  );
  patientId = ok(await k.call(p.frontDesk, 'POST', '/v1/patients', { givenName: 'Lakshmi', sex: 'female', birthDate: '1994-03-02', registeredFacilityId: f1, source: 'front_desk' }, true), 201).patientId;
  encounterId = ok(await k.call(p.doctor, 'POST', '/v1/encounters', { patientId, facilityId: f1, attendingStaffId: p.doctor.staffId, encounterClass: 'outpatient' }, true), 201).encounterId;
});
afterAll(async () => k?.close());

// Shared across the flow below.
let order: any;
const item = (serviceItemId: string) => order.items.find((i: { serviceItemId: string }) => i.serviceItemId === serviceItemId);
const child = (serviceItemId: string) => item(svc.panel).children.find((c: { serviceItemId: string }) => c.serviceItemId === serviceItemId);
let bloodSpecimen: string;
let urineSpecimen: string;
let urineRecollection: string;
let panelReport: { reportId: string; version: number };

describe('orders', () => {
  it('searches orderable services (not consultations or retired tests)', async () => {
    expect((await k.call(p.nurse, 'GET', `/v1/orderables?facilityId=${f1}`)).status).toBe(403);
    const items = ok(await k.call(p.doctor, 'GET', `/v1/orderables?facilityId=${f1}`)).items.map((i: { serviceItemId: string }) => i.serviceItemId);
    expect(items).toEqual(expect.arrayContaining([svc.hb, svc.panel, svc.cxr]));
    expect(items).not.toContain(svc.consult);
    expect(items).not.toContain(svc.hidden);
    expect(ok(await k.call(p.doctor, 'GET', `/v1/orderables?facilityId=${f1}&q=glu`)).items).toEqual([expect.objectContaining({ serviceItemId: svc.glu, specimenType: 'plasma' })]);
  });

  it('places an order: a panel expands into its tests, imaging gets a study, every item logs its status', async () => {
    const body = {
      priority: 'urgent',
      clinicalIndication: 'Fatigue, 8 weeks pregnant',
      items: [{ serviceItemId: svc.panel }, { serviceItemId: svc.culture }, { serviceItemId: svc.cxr }, { serviceItemId: svc.usg, details: { obstetric: true } }],
    };
    expect((await k.call(p.nurse, 'POST', `/v1/encounters/${encounterId}/orders`, body, true)).status).toBe(403);
    expect((await k.call(p.doctor, 'POST', `/v1/encounters/${encounterId}/orders`, body)).status).toBe(400); // Idempotency-Key required
    expect(reason(await k.call(p.doctor, 'POST', `/v1/encounters/${encounterId}/orders`, { items: [{ serviceItemId: svc.hidden }] }, true))).toBe('not_orderable');
    expect(reason(await k.call(p.doctor, 'POST', `/v1/encounters/${encounterId}/orders`, { items: [] }, true))).toBe('no_items');
    // doctor2 is not on this encounter and has no care relationship.
    expect(reason(await k.call(p.doctor2, 'POST', `/v1/encounters/${encounterId}/orders`, body, true))).toBe('no_care_relationship');

    const key = `order-${k.run}`;
    order = ok(await k.call(p.doctor, 'POST', `/v1/encounters/${encounterId}/orders`, body, key), 201);
    expect(ok(await k.call(p.doctor, 'POST', `/v1/encounters/${encounterId}/orders`, body, key), 201).orderId).toBe(order.orderId);
    expect(order.requisitionNo).toMatch(/^RQ\/\d{4}\/\d{6}$/);
    expect(item(svc.panel).children.map((c: { serviceItemId: string }) => c.serviceItemId)).toEqual([svc.hb, svc.glu]);
    expect(item(svc.cxr).accessionNo).toMatch(/^DX\d{2}\d{7}$/);
    const usg = await one<{ is_obstetric: boolean; study_instance_uid: string }>(`SELECT is_obstetric, study_instance_uid FROM diagnostics.imaging_study WHERE id = $1`, [item(svc.usg).imagingStudyId]);
    expect(usg).toMatchObject({ is_obstetric: true });
    expect(usg.study_instance_uid).toMatch(/^2\.25\.\d+$/);
    expect(await events('order_item.placed')).toBe(4);
    const hist = await one<{ n: string }>(`SELECT count(*) AS n FROM diagnostics.order_item_status_history h JOIN diagnostics.order_item i ON i.id = h.order_item_id WHERE i.service_order_id = $1 AND h.to_status = 'ordered'`, [order.orderId]);
    expect(Number(hist.n)).toBe(6);
  });

  it('cancels an item before any result; cancelling the last item cancels the order', async () => {
    const o = ok(await k.call(p.doctor, 'POST', `/v1/encounters/${encounterId}/orders`, { items: [{ serviceItemId: svc.glu }] }, true), 201);
    const itemId = o.items[0].orderItemId;
    expect((await k.call(p.frontDesk, 'POST', `/v1/order-items/${itemId}/cancel`, { reason: 'Duplicate order' })).status).toBe(403);
    expect(ok(await k.call(p.doctor, 'POST', `/v1/order-items/${itemId}/cancel`, { reason: 'Duplicate order' }))).toMatchObject({ status: 'cancelled', orderStatus: 'cancelled' });
    expect(await events('order_item.cancelled')).toBe(1);
    const h = (await k.admin.query(`SELECT from_status, to_status, actor_staff_id FROM diagnostics.order_item_status_history WHERE order_item_id = $1 ORDER BY occurred_at, to_status`, [itemId])).rows;
    expect(h.at(-1)).toMatchObject({ from_status: 'ordered', to_status: 'cancelled', actor_staff_id: p.doctor.staffId });
    // The database guard refuses impossible moves too.
    await expect(k.admin.query(`UPDATE diagnostics.order_item SET status = 'released' WHERE id = $1`, [itemId])).rejects.toThrow(/cannot move from cancelled to released/);
  });

  it('order sets: personal and department sets, stale edits refused, ordering from a set, retiring', async () => {
    const mine = ok(await k.call(p.doctor, 'POST', '/v1/order-sets', { name: 'Anaemia work-up', items: [{ serviceItemId: svc.hb }, { serviceItemId: svc.cxr, priority: 'urgent' }] }, true), 201);
    expect((await k.call(p.frontDesk, 'POST', '/v1/order-sets', { name: 'Lab basics', departmentId: deptId, items: [{ serviceItemId: svc.glu }] }, true)).status).toBe(403);
    const dept = ok(await k.call(p.doctor, 'POST', '/v1/order-sets', { name: 'Lab basics', departmentId: deptId, items: [{ serviceItemId: svc.glu }] }, true), 201);
    const list = (who: Person) => k.call(who, 'GET', `/v1/order-sets?facilityId=${f1}`).then((r) => ok(r).items as { orderSetId: string; scope: string; version: number; items: unknown[] }[]);
    const sets = await list(p.doctor);
    expect(sets.map((s) => [s.orderSetId, s.scope])).toEqual(expect.arrayContaining([[mine.orderSetId, 'personal'], [dept.orderSetId, 'department']]));
    expect((await list(p.doctor2)).map((s) => s.orderSetId)).toEqual([dept.orderSetId]);
    // Someone else's personal set is invisible to them.
    expect((await k.call(p.doctor2, 'PATCH', `/v1/order-sets/${mine.orderSetId}`, { version: 1, name: 'Mine now' })).status).toBe(404);

    const v1 = sets.find((s) => s.orderSetId === mine.orderSetId)!.version;
    const edited = ok(await k.call(p.doctor, 'PATCH', `/v1/order-sets/${mine.orderSetId}`, { version: v1, items: [{ serviceItemId: svc.hb }] }));
    expect(reason(await k.call(p.doctor, 'PATCH', `/v1/order-sets/${mine.orderSetId}`, { version: v1, name: 'Old view' }))).toBe('stale_version');
    expect((await list(p.doctor)).find((s) => s.orderSetId === mine.orderSetId)!.items).toHaveLength(1);

    const fromSet = ok(await k.call(p.doctor, 'POST', `/v1/encounters/${encounterId}/orders`, { orderSetId: mine.orderSetId }, true), 201);
    expect(fromSet.items.map((i: { serviceItemId: string }) => i.serviceItemId)).toEqual([svc.hb]);
    ok(await k.call(p.doctor, 'POST', `/v1/order-items/${fromSet.items[0].orderItemId}/cancel`, { reason: 'Ordered by mistake' }));

    ok(await k.call(p.doctor, 'POST', `/v1/order-sets/${mine.orderSetId}/retire`, { version: edited.version }));
    expect((await list(p.doctor)).map((s) => s.orderSetId)).not.toContain(mine.orderSetId);
    expect(reason(await k.call(p.doctor, 'POST', `/v1/encounters/${encounterId}/orders`, { orderSetId: mine.orderSetId }, true))).toBe('retired');
    // The set's rows are retired, never deleted.
    expect(await one(`SELECT status FROM diagnostics.order_set WHERE id = $1`, [mine.orderSetId])).toMatchObject({ status: 'retired' });
  });
});

describe('specimens', () => {
  it('collects one specimen for several tests; the panel follows; barcodes are unique', async () => {
    const ids = [child(svc.hb).orderItemId, child(svc.glu).orderItemId];
    expect((await k.call(p.frontDesk, 'POST', '/v1/specimens', { orderItemIds: ids })).status).toBe(403);
    expect(reason(await k.call(p.nurse, 'POST', '/v1/specimens', { orderItemIds: ids }))).toBe('specimen_type_required');
    expect(reason(await k.call(p.nurse, 'POST', '/v1/specimens', { orderItemIds: [item(svc.panel).orderItemId], specimenType: 'whole_blood' }))).toBe('not_collectable');
    const s = ok(await k.call(p.nurse, 'POST', '/v1/specimens', { orderItemIds: ids, specimenType: 'whole_blood', containerType: 'edta', barcode: `BC${k.run}` }), 201);
    bloodSpecimen = s.specimenId;
    expect(s.accessionNo).toMatch(/^F1-\d{2}-\d{7}$/);
    expect(reason(await k.call(p.nurse, 'POST', '/v1/specimens', { orderItemIds: [item(svc.culture).orderItemId], barcode: `BC${k.run}` }))).toBe('duplicate_barcode');
    const statuses = (await k.admin.query(`SELECT id, status FROM diagnostics.order_item WHERE id = ANY($1)`, [[...ids, item(svc.panel).orderItemId]])).rows;
    expect(statuses.every((r: { status: string }) => r.status === 'collected')).toBe(true);
  });

  it('lab receives it; a rejected specimen sends its test back for a recollection that points at it', async () => {
    const receiveList = ok(await k.call(p.labTech, 'GET', `/v1/lab/worklist?facilityId=${f1}&stage=receive`)).items;
    expect(receiveList.map((r: { specimenId: string }) => r.specimenId)).toContain(bloodSpecimen);
    expect((await k.call(p.nurse, 'POST', `/v1/specimens/${bloodSpecimen}/receive`)).status).toBe(403);
    ok(await k.call(p.labTech, 'POST', `/v1/specimens/${bloodSpecimen}/receive`));
    expect(await one(`SELECT status FROM diagnostics.order_item WHERE id = $1`, [item(svc.panel).orderItemId])).toMatchObject({ status: 'in_progress' });

    urineSpecimen = ok(await k.call(p.nurse, 'POST', '/v1/specimens', { orderItemIds: [item(svc.culture).orderItemId] }), 201).specimenId;
    expect(reason(await k.call(p.labTech, 'POST', `/v1/specimens/${urineSpecimen}/reject`, { reason: 'other' }))).toBe('note_required');
    ok(await k.call(p.labTech, 'POST', `/v1/specimens/${urineSpecimen}/reject`, { reason: 'insufficient', note: '2 mL received' }));
    expect(await one(`SELECT status FROM diagnostics.order_item WHERE id = $1`, [item(svc.culture).orderItemId])).toMatchObject({ status: 'ordered' });
    const collect = ok(await k.call(p.nurse, 'GET', `/v1/lab/worklist?facilityId=${f1}&stage=collect`)).items;
    expect(collect.find((r: { orderItemId: string }) => r.orderItemId === item(svc.culture).orderItemId)).toMatchObject({ needsRecollection: true, rejectedSpecimenId: urineSpecimen, priority: 'urgent' });

    urineRecollection = ok(await k.call(p.nurse, 'POST', `/v1/specimens/${urineSpecimen}/recollect`, {}), 201).specimenId;
    expect(await one(`SELECT recollection_of_id, status FROM diagnostics.specimen WHERE id = $1`, [urineRecollection])).toMatchObject({ recollection_of_id: urineSpecimen, status: 'collected' });
    expect(reason(await k.call(p.nurse, 'POST', `/v1/specimens/${urineSpecimen}/recollect`, {}))).toBe('already_recollected');
    ok(await k.call(p.labTech, 'POST', `/v1/specimens/${urineRecollection}/receive`));
  });
});

describe('results and reports', () => {
  it('enters results with a reference-range snapshot and flags; duplicates and early entry are refused', async () => {
    const xr = await k.call(p.labTech, 'POST', `/v1/order-items/${item(svc.cxr).orderItemId}/results`, { values: [{ observationDefinitionId: def.hb, valueNum: 1 }] });
    expect(reason(xr)).toBe('not_a_test');
    const entry = ok(await k.call(p.labTech, 'GET', `/v1/order-items/${item(svc.panel).orderItemId}/lab`));
    expect(entry.tests.map((t: { name: string }) => t.name)).toEqual(['Haemoglobin', 'Glucose (fasting)']);
    expect(entry.tests[0].definitions[0]).toMatchObject({ code: 'HB', low: '12.0', high: '15.0', criticalLow: '7.0' });

    expect((await k.call(p.nurse, 'POST', `/v1/order-items/${child(svc.hb).orderItemId}/results`, { values: [{ observationDefinitionId: def.hb, valueNum: 6.5 }] })).status).toBe(403);
    expect(reason(await k.call(p.labTech, 'POST', `/v1/order-items/${child(svc.hb).orderItemId}/results`, { values: [{ observationDefinitionId: def.glu, valueNum: 6.5 }] }))).toBe('unknown_parameter');
    expect(reason(await k.call(p.labTech, 'POST', `/v1/order-items/${child(svc.hb).orderItemId}/results`, { values: [{ observationDefinitionId: def.hb, valueText: 'low' }] }))).toBe('bad_value');
    const hb = ok(await k.call(p.labTech, 'POST', `/v1/order-items/${child(svc.hb).orderItemId}/results`, { values: [{ observationDefinitionId: def.hb, valueNum: 6.5 }] }), 201);
    expect(hb).toMatchObject({ orderItemStatus: 'resulted', complete: true, results: [{ abnormalFlag: 'critical_low', isCritical: true }] });
    expect(await one(`SELECT unit, ref_low, ref_high, specimen_id FROM diagnostics.result_item WHERE id = $1`, [hb.results[0].resultItemId])).toMatchObject({ unit: 'g/dL', ref_low: '12.0', ref_high: '15.0', specimen_id: bloodSpecimen });
    expect(await events('critical_result.flagged')).toBe(1);
    expect(reason(await k.call(p.labTech, 'POST', `/v1/order-items/${child(svc.hb).orderItemId}/results`, { values: [{ observationDefinitionId: def.hb, valueNum: 7.5 }] }))).toBe('already_resulted');
    const glu = ok(await k.call(p.labTech, 'POST', `/v1/order-items/${child(svc.glu).orderItemId}/results`, { values: [{ observationDefinitionId: def.glu, valueNum: 95 }] }), 201);
    expect(glu.results[0]).toMatchObject({ abnormalFlag: 'normal', isCritical: false });
    expect(await one(`SELECT status FROM diagnostics.order_item WHERE id = $1`, [item(svc.panel).orderItemId])).toMatchObject({ status: 'resulted' });

    // A culture whose specimen hasn't been received isn't ready — the recollection was, so it is.
    ok(await k.call(p.pathologist, 'POST', `/v1/order-items/${item(svc.culture).orderItemId}/results`, { values: [{ observationDefinitionId: def.growth, valueText: 'Growth of Escherichia coli >10^5 CFU/mL' }] }), 201);
  });

  it("can't cancel what has results; a correction supersedes and keeps one current value", async () => {
    expect(reason(await k.call(p.doctor, 'POST', `/v1/order-items/${item(svc.panel).orderItemId}/cancel`, { reason: 'Not needed' }))).toBe('already_resulted');
    expect(reason(await k.call(p.doctor, 'POST', `/v1/order-items/${child(svc.glu).orderItemId}/cancel`, { reason: 'Not needed' }))).toBe('already_resulted');
    const old = await one<{ id: string }>(`SELECT id FROM diagnostics.result_item WHERE order_item_id = $1`, [child(svc.glu).orderItemId]);
    const fixed = ok(await k.call(p.labTech, 'POST', `/v1/result-items/${old.id}/correct`, { valueNum: 110, reason: 'Transcription error' }), 201);
    expect(fixed).toMatchObject({ supersedesId: old.id, abnormalFlag: 'high', needsAmendment: false });
    expect(reason(await k.call(p.labTech, 'POST', `/v1/result-items/${old.id}/correct`, { valueNum: 111, reason: 'Again' }))).toBe('not_current');
    const rows = (await k.admin.query(`SELECT status, superseded_at IS NULL AS current FROM diagnostics.result_item WHERE order_item_id = $1 ORDER BY entered_at, created_at`, [child(svc.glu).orderItemId])).rows;
    expect(rows).toEqual([{ status: 'preliminary', current: false }, { status: 'corrected', current: true }]);
    await expect(k.admin.query(`UPDATE diagnostics.result_item SET value_num = 1 WHERE id = $1`, [fixed.resultItemId])).rejects.toThrow(/cannot be edited/);
  });

  it('release needs the critical call logged, a verifier other than the enterer, and the current version', async () => {
    expect((await k.call(p.radiologist, 'POST', `/v1/order-items/${item(svc.panel).orderItemId}/report`, {})).status).toBe(403);
    expect(reason(await k.call(p.labTech, 'POST', `/v1/order-items/${child(svc.hb).orderItemId}/report`, {}))).toBe('report_the_panel');
    const draft = ok(await k.call(p.labTech, 'POST', `/v1/order-items/${item(svc.panel).orderItemId}/report`, { comment: 'Peripheral smear advised' }));
    expect(draft).toMatchObject({ status: 'preliminary', versionNo: 1 });
    expect((await k.call(p.labTech, 'POST', `/v1/diagnostic-reports/${draft.reportId}/release`, { version: draft.version })).status).toBe(403);

    const verify = ok(await k.call(p.pathologist, 'GET', `/v1/lab/worklist?facilityId=${f1}&stage=verify`)).items;
    expect(verify.find((v: { orderItemId: string }) => v.orderItemId === item(svc.panel).orderItemId)).toMatchObject({ reportId: draft.reportId, hasCritical: true });
    expect(reason(await k.call(p.pathologist, 'POST', `/v1/diagnostic-reports/${draft.reportId}/release`, { version: draft.version }))).toBe('critical_not_notified');

    const hbResult = await one<{ id: string }>(`SELECT id FROM diagnostics.result_item WHERE order_item_id = $1`, [child(svc.hb).orderItemId]);
    const glu = await one<{ id: string }>(`SELECT id FROM diagnostics.result_item WHERE order_item_id = $1 AND superseded_at IS NULL`, [child(svc.glu).orderItemId]);
    expect(reason(await k.call(p.labTech, 'POST', `/v1/result-items/${glu.id}/critical-alerts`, { notifiedToStaffId: p.doctor.staffId, channel: 'phone', readBackConfirmed: true }))).toBe('not_critical');
    expect((await k.call(p.nurse, 'POST', `/v1/result-items/${hbResult.id}/critical-alerts`, { notifiedToStaffId: p.doctor.staffId, channel: 'phone', readBackConfirmed: true })).status).toBe(403);
    expect(reason(await k.call(p.labTech, 'POST', `/v1/result-items/${hbResult.id}/critical-alerts`, { channel: 'phone', readBackConfirmed: true }))).toBe('recipient_required');
    ok(await k.call(p.labTech, 'POST', `/v1/result-items/${hbResult.id}/critical-alerts`, { notifiedToStaffId: p.doctor.staffId, channel: 'phone', readBackConfirmed: true, note: 'Dr Kavya informed' }), 201);

    expect(reason(await k.call(p.pathologist, 'POST', `/v1/diagnostic-reports/${draft.reportId}/release`, { version: draft.version + 5 }))).toBe('stale_version');
    const released = ok(await k.call(p.pathologist, 'POST', `/v1/diagnostic-reports/${draft.reportId}/release`, { version: draft.version, conclusion: 'Severe anaemia' }));
    expect(released).toMatchObject({ status: 'final', versionNo: 2 });
    panelReport = { reportId: released.reportId, version: released.version };
    expect(reason(await k.call(p.pathologist, 'POST', `/v1/diagnostic-reports/${draft.reportId}/release`, { version: released.version }))).toBe('already_released');
    const items = (await k.admin.query(`SELECT status FROM diagnostics.order_item WHERE id = ANY($1)`, [[item(svc.panel).orderItemId, child(svc.hb).orderItemId, child(svc.glu).orderItemId]])).rows;
    expect(items.every((i: { status: string }) => i.status === 'released')).toBe(true);
    expect(await one(`SELECT status, verified_by FROM diagnostics.result_item WHERE id = $1`, [hbResult.id])).toMatchObject({ status: 'final', verified_by: p.pathologist.staffId });
    expect(await events('result.released')).toBe(1);
    const hist = (await k.admin.query(`SELECT to_status FROM diagnostics.order_item_status_history WHERE order_item_id = $1 ORDER BY occurred_at, id`, [child(svc.hb).orderItemId])).rows.map((r: { to_status: string }) => r.to_status);
    expect(hist).toEqual(['ordered', 'collected', 'in_progress', 'resulted', 'released']);
  });

  it('versions are immutable; an amendment needs a reason and makes a new version', async () => {
    const v = await one<{ id: string }>(`SELECT id FROM diagnostics.diagnostic_report_version WHERE diagnostic_report_id = $1 AND version_no = 2`, [panelReport.reportId]);
    await expect(k.admin.query(`UPDATE diagnostics.diagnostic_report_version SET body = '{}' WHERE id = $1`, [v.id])).rejects.toThrow(/immutable/);
    expect(await one(`SELECT has_table_privilege('mod_diagnostics', 'diagnostics.diagnostic_report_version', 'UPDATE') AS u`)).toMatchObject({ u: false });

    const hb = await one<{ id: string }>(`SELECT id FROM diagnostics.result_item WHERE order_item_id = $1 AND superseded_at IS NULL`, [child(svc.hb).orderItemId]);
    expect(reason(await k.call(p.labTech, 'POST', `/v1/order-items/${child(svc.hb).orderItemId}/results`, { values: [{ observationDefinitionId: def.hb, valueNum: 6.8 }] }))).toBe('not_ready');
    const corrected = ok(await k.call(p.labTech, 'POST', `/v1/result-items/${hb.id}/correct`, { valueNum: 6.8, reason: 'Analyser recalibrated' }), 201);
    expect(corrected).toMatchObject({ needsAmendment: true, reportId: panelReport.reportId, isCritical: true });
    // The new critical value needs its own call before the amendment is signed.
    expect((await k.call(p.pathologist, 'POST', `/v1/diagnostic-reports/${panelReport.reportId}/amend`, { version: panelReport.version })).status).toBe(400);
    expect(reason(await k.call(p.pathologist, 'POST', `/v1/diagnostic-reports/${panelReport.reportId}/amend`, { version: panelReport.version, reason: 'Hb corrected' }))).toBe('critical_not_notified');
    ok(await k.call(p.labTech, 'POST', `/v1/result-items/${corrected.resultItemId}/critical-alerts`, { notifiedToName: 'Dr Kavya (ward phone)', channel: 'phone', readBackConfirmed: true }), 201);
    const amended = ok(await k.call(p.pathologist, 'POST', `/v1/diagnostic-reports/${panelReport.reportId}/amend`, { version: panelReport.version, reason: 'Hb corrected after recalibration' }));
    expect(amended).toMatchObject({ status: 'amended', versionNo: 3 });
    panelReport.version = amended.version;
    const v3 = await one<{ status: string; amendment_reason: string; body: { results: { code: string; valueNum: string }[]; comment: string } }>(
      `SELECT status, amendment_reason, body FROM diagnostics.diagnostic_report_version WHERE diagnostic_report_id = $1 AND version_no = 3`,
      [panelReport.reportId],
    );
    expect(v3).toMatchObject({ status: 'amended', amendment_reason: 'Hb corrected after recalibration', body: { comment: 'Peripheral smear advised' } });
    expect(v3.body.results.find((r) => r.code === 'HB')!.valueNum).toBe('6.8');
    expect(await events('result.amended')).toBe(1);
  });

  it('microbiology: isolates and susceptibilities on a culture; four-eyes release', async () => {
    const cultureId = item(svc.culture).orderItemId;
    expect(reason(await k.call(p.labTech, 'POST', `/v1/order-items/${child(svc.hb).orderItemId}/isolates`, { organismName: 'E. coli' }))).toBe('not_culture');
    const iso = ok(await k.call(p.labTech, 'POST', `/v1/order-items/${cultureId}/isolates`, { organismName: 'Escherichia coli', colonyCount: '>10^5 CFU/mL' }), 201);
    expect(iso.sequence).toBe(1);
    ok(await k.call(p.labTech, 'POST', `/v1/micro-isolates/${iso.isolateId}/susceptibilities`, { antibioticName: 'Nitrofurantoin', method: 'disc', zoneMm: 21, interpretation: 'S' }), 201);
    ok(await k.call(p.labTech, 'POST', `/v1/micro-isolates/${iso.isolateId}/susceptibilities`, { antibioticName: 'Ciprofloxacin', method: 'mic', micValue: 4, interpretation: 'R' }), 201);
    expect(reason(await k.call(p.labTech, 'POST', `/v1/micro-isolates/${iso.isolateId}/susceptibilities`, { antibioticName: 'Ciprofloxacin', method: 'mic', micValue: 2, interpretation: 'R' }))).toBe('duplicate_antibiotic');
    expect(reason(await k.call(p.labTech, 'POST', `/v1/micro-isolates/${iso.isolateId}/susceptibilities`, { antibioticName: 'Amikacin', method: 'mic', interpretation: 'S' }))).toBe('mic_required');

    const draft = ok(await k.call(p.labTech, 'POST', `/v1/order-items/${cultureId}/report`, {}));
    // Dr Path entered the culture result, so a second signatory releases it.
    expect(reason(await k.call(p.pathologist, 'POST', `/v1/diagnostic-reports/${draft.reportId}/release`, { version: draft.version }))).toBe('four_eyes');
    const rel = ok(await k.call(p.pathologist2, 'POST', `/v1/diagnostic-reports/${draft.reportId}/release`, { version: draft.version, conclusion: 'E. coli UTI' }));
    const body = (await one<{ body: { isolates: { organism: string; susceptibilities: { antibiotic: string; interpretation: string }[] }[] } }>(`SELECT body FROM diagnostics.diagnostic_report_version WHERE diagnostic_report_id = $1 AND version_no = $2`, [draft.reportId, rel.versionNo])).body;
    expect(body.isolates[0]).toMatchObject({ organism: 'Escherichia coli' });
    expect(body.isolates[0]!.susceptibilities.map((s) => `${s.antibiotic}:${s.interpretation}`)).toEqual(['Ciprofloxacin:R', 'Nitrofurantoin:S']);
  });
});

describe('acknowledgement', () => {
  it("lists the doctor's unacknowledged results (critical first); acknowledged once, with care access", async () => {
    const pending = ok(await k.call(p.doctor, 'GET', `/v1/results/unacknowledged?facilityId=${f1}`)).items;
    expect(pending.map((r: { reportId: string; isCritical: boolean }) => [r.reportId, r.isCritical])[0]).toEqual([panelReport.reportId, true]);
    expect(pending).toHaveLength(2);
    expect((await k.call(p.nurse, 'POST', `/v1/diagnostic-reports/${panelReport.reportId}/acknowledge`, {})).status).toBe(403);
    expect(reason(await k.call(p.doctor2, 'POST', `/v1/diagnostic-reports/${panelReport.reportId}/acknowledge`, {}))).toBe('no_care_relationship');
    const ack = ok(await k.call(p.doctor, 'POST', `/v1/diagnostic-reports/${panelReport.reportId}/acknowledge`, { actionTaken: 'Started iron sucrose; patient called back' }), 201);
    expect(ack.reportVersionNo).toBe(3);
    expect(reason(await k.call(p.doctor, 'POST', `/v1/diagnostic-reports/${panelReport.reportId}/acknowledge`, {}))).toBe('already_acknowledged');
    expect(ok(await k.call(p.doctor, 'GET', `/v1/results/unacknowledged`)).items.map((r: { reportId: string }) => r.reportId)).not.toContain(panelReport.reportId);
  });
});

describe('imaging and PC-PNDT', () => {
  const study = async (serviceItemId: string) =>
    ok(await k.call(p.radiographer, 'GET', `/v1/imaging/worklist?facilityId=${f1}`)).items.find((s: { orderItemId: string }) => s.orderItemId === item(serviceItemId).orderItemId);
  const move = async (who: Person, id: string, version: number, status: string, extra: Record<string, unknown> = {}) => k.call(who, 'POST', `/v1/imaging-studies/${id}/status`, { version, status, ...extra });

  it('runs a study through its states and reports it', async () => {
    let s = await study(svc.cxr);
    expect(s).toMatchObject({ status: 'scheduled', modality: 'DX' });
    expect(reason(await move(p.radiographer, s.imagingStudyId, s.version, 'scheduled', { isObstetric: true }))).toBe('not_ultrasound');
    expect((await move(p.nurse, s.imagingStudyId, s.version, 'arrived')).status).toBe(403);
    expect(reason(await move(p.radiographer, s.imagingStudyId, s.version, 'completed'))).toBe('invalid_transition');
    let v = ok(await move(p.radiographer, s.imagingStudyId, s.version, 'arrived')).version;
    expect(reason(await move(p.radiographer, s.imagingStudyId, v - 1, 'in_progress'))).toBe('stale_version');
    v = ok(await move(p.radiographer, s.imagingStudyId, v, 'in_progress')).version;
    ok(await move(p.radiographer, s.imagingStudyId, v, 'completed', { doseDlpMgyCm: 0.02, pacsUrl: 'https://pacs.example/viewer?study=1' }));
    expect(await one(`SELECT status FROM diagnostics.order_item WHERE id = $1`, [item(svc.cxr).orderItemId])).toMatchObject({ status: 'resulted' });

    expect((await k.call(p.radiographer, 'POST', `/v1/order-items/${item(svc.cxr).orderItemId}/report`, { findings: 'x' })).status).toBe(403);
    const draft = ok(await k.call(p.radiologist, 'POST', `/v1/order-items/${item(svc.cxr).orderItemId}/report`, { findings: 'Lungs clear. Heart size normal.' }));
    ok(await k.call(p.radiologist, 'POST', `/v1/diagnostic-reports/${draft.reportId}/release`, { version: draft.version, impression: 'Normal chest radiograph' }));
    s = (ok(await k.call(p.radiographer, 'GET', `/v1/imaging/worklist?facilityId=${f1}&status=reported`)).items as { orderItemId: string }[]).find((x) => x.orderItemId === item(svc.cxr).orderItemId);
    expect(s).toMatchObject({ status: 'reported', reportStatus: 'final' });
    expect(await one(`SELECT status FROM diagnostics.order_item WHERE id = $1`, [item(svc.cxr).orderItemId])).toMatchObject({ status: 'released' });
  });

  it("an obstetric ultrasound can't complete without a declared Form F; Form F is kept and submitted monthly", async () => {
    const s = await study(svc.usg);
    // The obstetric flag can be corrected without moving the study (only on ultrasound).
    let v = ok(await move(p.radiographer, s.imagingStudyId, s.version, 'scheduled', { isObstetric: false })).version;
    v = ok(await move(p.radiographer, s.imagingStudyId, v, 'scheduled', { isObstetric: true })).version;
    v = ok(await move(p.radiographer, s.imagingStudyId, v, 'arrived')).version;
    v = ok(await move(p.radiographer, s.imagingStudyId, v, 'in_progress')).version;
    expect(reason(await move(p.radiographer, s.imagingStudyId, v, 'completed'))).toBe('form_f_required');
    // The database refuses it too.
    await expect(k.admin.query(`UPDATE diagnostics.imaging_study SET status = 'completed', performed_at = now(), performed_by = $2 WHERE id = $1`, [s.imagingStudyId, p.radiographer.staffId])).rejects.toThrow(/Form F/);

    const form = { indication: 'Dating scan', lmp: '2026-08-15', referringDoctor: 'Dr Kavya' };
    expect((await k.call(p.nurse, 'PUT', `/v1/imaging-studies/${s.imagingStudyId}/form-f`, { formData: form, patientDeclared: true, doctorDeclared: false })).status).toBe(403);
    const f = ok(await k.call(p.radiologist, 'PUT', `/v1/imaging-studies/${s.imagingStudyId}/form-f`, { formData: form, patientDeclared: true, doctorDeclared: false }));
    expect(f.retainUntil >= localDay(729)).toBe(true);
    expect(reason(await move(p.radiographer, s.imagingStudyId, v, 'completed'))).toBe('form_f_required');
    expect(reason(await k.call(p.radiologist, 'PUT', `/v1/imaging-studies/${s.imagingStudyId}/form-f`, { formData: form, patientDeclared: true, doctorDeclared: true }))).toBe('stale_version');
    const f2 = ok(await k.call(p.radiologist, 'PUT', `/v1/imaging-studies/${s.imagingStudyId}/form-f`, { formData: form, patientDeclared: true, doctorDeclared: true, version: f.version }));
    ok(await move(p.radiographer, s.imagingStudyId, v, 'completed'));

    await expect(k.admin.query(`DELETE FROM diagnostics.pcpndt_form_f WHERE id = $1`, [f.formFId])).rejects.toThrow(/never deleted/);
    const month = (await one<{ m: string }>(`SELECT to_char(reporting_month, 'YYYY-MM') AS m FROM diagnostics.pcpndt_form_f WHERE id = $1`, [f.formFId])).m;
    expect((await k.call(p.doctor, 'GET', `/v1/form-f?facilityId=${f1}&month=${month}`)).status).toBe(403);
    const register = ok(await k.call(p.radiologist, 'GET', `/v1/form-f?facilityId=${f1}&month=${month}`)).items;
    expect(register).toEqual([expect.objectContaining({ formFId: f.formFId, patientName: 'Lakshmi', submittedAt: null, doctorName: 'Dr Rad' })]);
    expect(ok(await k.call(p.radiologist, 'POST', '/v1/form-f/submit', { facilityId: f1, month, submissionRef: 'AA/2026/OCT' }))).toEqual({ submitted: 1, incomplete: 0 });
    expect(reason(await k.call(p.radiologist, 'PUT', `/v1/imaging-studies/${s.imagingStudyId}/form-f`, { formData: form, patientDeclared: true, doctorDeclared: true, version: f2.version }))).toBe('submitted');
    await expect(k.admin.query(`UPDATE diagnostics.pcpndt_form_f SET form_data = '{}' WHERE id = $1`, [f.formFId])).rejects.toThrow(/submitted/);
    expect(reason(await k.call(p.radiologist, 'POST', '/v1/form-f/submit', { facilityId: f1, month }))).toBe('nothing_to_submit');
  });
});

describe('reads', () => {
  it("the encounter's orders with specimens, results and reports — care access required, audited", async () => {
    expect((await k.call(p.frontDesk, 'GET', `/v1/encounters/${encounterId}/orders`)).status).toBe(403);
    expect(reason(await k.call(p.doctor2, 'GET', `/v1/encounters/${encounterId}/orders`))).toBe('no_care_relationship');
    const res = ok(await k.call(p.doctor, 'GET', `/v1/encounters/${encounterId}/orders`));
    const main = res.orders.find((o: { orderId: string }) => o.orderId === order.orderId);
    expect(main).toMatchObject({ requisitionNo: order.requisitionNo, status: 'active', orderedByName: 'Dr Kavya' });
    const panel = main.items.find((i: { serviceItemId: string }) => i.serviceItemId === svc.panel);
    expect(panel.report).toMatchObject({ status: 'amended', versionNo: 3, acknowledgements: [expect.objectContaining({ staffName: 'Dr Kavya' })] });
    expect(panel.tests.map((t: { results: { code: string; abnormalFlag: string }[] }) => t.results[0])).toEqual([expect.objectContaining({ code: 'HB', abnormalFlag: 'critical_low' }), expect.objectContaining({ code: 'GLU', abnormalFlag: 'high' })]);
    expect(panel.tests[0].specimens[0]).toMatchObject({ specimenId: bloodSpecimen, status: 'received' });
    const culture = main.items.find((i: { serviceItemId: string }) => i.serviceItemId === svc.culture);
    expect(culture.specimens.map((s: { status: string }) => s.status)).toEqual(['rejected', 'received']);
    expect(main.items.find((i: { serviceItemId: string }) => i.serviceItemId === svc.usg).imagingStudy).toMatchObject({ status: 'completed', isObstetric: true });
    const audit = await one<{ n: string }>(`SELECT count(*) AS n FROM platform.audit_event WHERE tenant_id = $1 AND action = 'view' AND subject_type = 'diagnostics.service_order' AND actor_staff_id = $2`, [k.tenant.tenantId, p.doctor.staffId]);
    expect(Number(audit.n)).toBeGreaterThanOrEqual(1);
  });

  it("the patient's results history (released reports and trends), audited like the chart", async () => {
    expect((await k.call(p.frontDesk, 'GET', `/v1/patients/${patientId}/results`)).status).toBe(403);
    expect(reason(await k.call(p.doctor2, 'GET', `/v1/patients/${patientId}/results`))).toBe('no_care_relationship');
    const h = ok(await k.call(p.doctor, 'GET', `/v1/patients/${patientId}/results`));
    expect(h.reports.map((r: { name: string }) => r.name).sort()).toEqual(['Basic screen', 'Urine culture', 'X-ray chest PA']);
    expect(h.reports.find((r: { reportId: string }) => r.reportId === panelReport.reportId)).toMatchObject({ acknowledgedByMe: true, status: 'amended' });
    expect(h.trends.filter((t: { code: string }) => t.code === 'HB').map((t: { valueNum: string }) => t.valueNum)).toEqual(['6.8']);
    expect(await one(`SELECT count(*)::int AS n FROM platform.audit_event WHERE tenant_id = $1 AND action = 'view' AND subject_type = 'diagnostics.results'`, [k.tenant.tenantId])).toMatchObject({ n: 1 });
  });

  it('lab worklists need the stage permission', async () => {
    expect((await k.call(p.nurse, 'GET', `/v1/lab/worklist?facilityId=${f1}&stage=result`)).status).toBe(403);
    expect((await k.call(p.labTech, 'GET', `/v1/lab/worklist?facilityId=${f1}&stage=verify`)).status).toBe(403);
    expect(ok(await k.call(p.labTech, 'GET', `/v1/lab/worklist?facilityId=${f1}&stage=result`)).items).toEqual([]);
    expect((await k.call(p.doctor, 'GET', `/v1/imaging/worklist?facilityId=${f1}`)).status).toBe(403);
  });
});

describe('module switch and closed encounters', () => {
  it('a suspended diagnostics module refuses new work but keeps results readable', async () => {
    const mods = ok(await k.call(p.admin, 'GET', '/v1/modules')).items;
    const m = mods.find((x: { module: string }) => x.module === 'diagnostics');
    const s = ok(await k.call(p.admin, 'PUT', '/v1/modules/diagnostics', { state: 'suspended', version: m.version, reason: 'Lab contract paused' }));
    const refused = await k.call(p.doctor, 'POST', `/v1/encounters/${encounterId}/orders`, { items: [{ serviceItemId: svc.glu }] }, true);
    expect(refused.status).toBe(422);
    expect(refused.body.error.details).toMatchObject({ reason: 'module_inactive', module: 'diagnostics', state: 'suspended' });
    expect(reason(await k.call(p.labTech, 'POST', `/v1/specimens/${bloodSpecimen}/receive`))).toBe('module_inactive');
    ok(await k.call(p.doctor, 'GET', `/v1/encounters/${encounterId}/orders`));
    ok(await k.call(p.admin, 'PUT', '/v1/modules/diagnostics', { state: 'active', version: s.version, reason: 'Resumed' }));
    ok(await k.call(p.doctor, 'POST', `/v1/encounters/${encounterId}/orders`, { items: [{ serviceItemId: svc.glu }] }, true), 201);
  });

  it("a finished encounter can't take new orders", async () => {
    ok(await k.call(p.doctor, 'POST', `/v1/encounters/${encounterId}/start`));
    ok(await k.call(p.doctor, 'POST', `/v1/encounters/${encounterId}/finish`, { disposition: 'discharged_home' }));
    expect(reason(await k.call(p.doctor, 'POST', `/v1/encounters/${encounterId}/orders`, { items: [{ serviceItemId: svc.hb }] }, true))).toBe('encounter_closed');
  });
});
