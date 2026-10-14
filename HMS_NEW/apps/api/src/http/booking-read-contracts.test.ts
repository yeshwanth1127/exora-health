// SQL pagination and exact booking evidence, using real RLS/HTTP authorization and no provider calls.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BookingReadinessSchema } from '@hms/contracts';
import { ist, startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let other: Kit;
let admin: Person;
let desk: Person;
let outsider: Person;
let doctor: Person;
let facility2: string;
let resource: string;
let service: string;
let otherService: string;
let item: string;
let priceList: string;
const day = '2050-01-03'; // Monday; server clock always pinned before the slots.
const nextWeek = '2050-01-10';
const now = ist(day, '08:00');
const ok = (r: { status: number; body: any }, status = 200) => { expect(r, JSON.stringify(r.body)).toMatchObject({ status }); return r.body; };
const list = (extra = '') => `/v1/appointments?facilityId=${k.tenant.facilityId}&from=${day}&to=${day}&limit=100${extra}`;
const readiness = (extra: Record<string, string> = {}) => `/v1/booking/readiness?${new URLSearchParams({ facilityId: k.tenant.facilityId, staffId: doctor.staffId, slotStart: ist(day, '09:00'), visitMode: 'in_person', healthcareServiceId: service, ...extra })}`;

beforeAll(async () => {
  k = await startKit('booking-read-contracts');
  other = await startKit('booking-read-other');
  admin = await k.person('Admin', 'tenant_admin', null);
  desk = await k.person('Reception', 'front_desk', k.tenant.facilityId);
  doctor = await k.person('Dr Quote', 'doctor', k.tenant.facilityId, 'doctor');
  const one = async (s: string, v: unknown[]) => (await k.admin.query(s, v)).rows[0].id as string;
  facility2 = await one(`INSERT INTO platform.facility (tenant_id,organization_id,code,name,facility_type,state_code)
    VALUES ($1,$2,'OTHER','Other clinic','clinic','29') RETURNING id`, [k.tenant.tenantId, k.tenant.organizationId]);
  outsider = await k.person('Other desk', 'front_desk', facility2);
  const dept = await one(`INSERT INTO platform.department (tenant_id,facility_id,code,name,kind) VALUES ($1,$2,'GM','General','clinical') RETURNING id`, [k.tenant.tenantId, k.tenant.facilityId]);
  const dept2 = await one(`INSERT INTO platform.department (tenant_id,facility_id,code,name,kind) VALUES ($1,$2,'GM2','Other','clinical') RETURNING id`, [k.tenant.tenantId, facility2]);
  item = await one(`INSERT INTO catalog.service_item (tenant_id,code,name,category) VALUES ($1,'CONS','Consultation','consultation') RETURNING id`, [k.tenant.tenantId]);
  service = await one(`INSERT INTO catalog.healthcare_service (tenant_id,department_id,code,name,service_mode,consultation_service_item_id) VALUES ($1,$2,'CONS','Consultation','both',$3) RETURNING id`, [k.tenant.tenantId, dept, item]);
  otherService = await one(`INSERT INTO catalog.healthcare_service (tenant_id,department_id,code,name,service_mode,consultation_service_item_id) VALUES ($1,$2,'OTHER','Other consultation','both',$3) RETURNING id`, [k.tenant.tenantId, dept2, item]);
  await k.admin.query(`INSERT INTO catalog.practitioner_affiliation (tenant_id,staff_id,facility_id,department_id,valid_from) VALUES ($1,$2,$3,$4,'2049-01-01')`, [k.tenant.tenantId, doctor.staffId, k.tenant.facilityId, dept]);
  await k.admin.query(`INSERT INTO catalog.practitioner_profile (tenant_id,staff_id,accepts_virtual) VALUES ($1,$2,true)`, [k.tenant.tenantId, doctor.staffId]);
  resource = ok(await k.call(admin, 'POST', `/v1/practitioners/${doctor.staffId}/calendar`, {}, true), 201).resourceId;
  for (const [mode, start, end] of [['in_person', '09:00', '11:00'], ['virtual', '12:00', '14:00']]) {
    ok(await k.call(admin, 'POST', `/v1/practitioners/${doctor.staffId}/weekly-sessions`, {
      facilityId: k.tenant.facilityId, weekday: 1, start, end, slotMinutes: 15, healthcareServiceId: service, visitMode: mode, effectiveFrom: '2049-01-01',
    }, true), 201);
  }
  priceList = await one(`INSERT INTO catalog.price_list (tenant_id,code,name,kind,valid_from) VALUES ($1,'CASH','Cash','cash','2049-01-01') RETURNING id`, [k.tenant.tenantId]);
  await k.admin.query(`INSERT INTO catalog.price_list_item (tenant_id,price_list_id,service_item_id,staff_id,encounter_class,unit_price_minor,valid_from,valid_to) VALUES
    ($1,$2,$3,NULL,NULL,50000,'2049-01-01',NULL),
    ($1,$2,$3,$4,'outpatient',70000,'2049-01-01',$5),
    ($1,$2,$3,$4,'outpatient',80000,$5,NULL),
    ($1,$2,$3,$4,'virtual',0,'2049-01-01',NULL)`, [k.tenant.tenantId, priceList, item, doctor.staffId, nextWeek]);
  await k.admin.query(`UPDATE catalog.price_list SET status='active',is_default=true,activated_at=now() WHERE id=$1`, [priceList]);
  const party = await one(`INSERT INTO booking.booking_party (tenant_id,name,phone) VALUES ($1,'Caller','+919988776655') RETURNING id`, [k.tenant.tenantId]);
  // 110 in-person rows first, then 110 virtual rows; the old loaded-page filter loses all virtual matches.
  await k.admin.query(`INSERT INTO booking.appointment (id,tenant_id,confirmation_code,booking_party_id,practitioner_staff_id,resource_id,facility_id,session_on,booking_kind,visit_mode,origin_channel)
    SELECT (left($7,24)||lpad(n::text,12,'0'))::uuid,$1,'READ'||lpad(n::text,4,'0'),$2,$3,$4,$5,$6::date,'walk_in',CASE WHEN n<=110 THEN 'in_person' ELSE 'virtual' END,'front_desk'
    FROM generate_series(1,220) n ORDER BY n`, [k.tenant.tenantId, party, doctor.staffId, resource, k.tenant.facilityId, day, doctor.staffId]);
});

afterAll(async () => { await k?.close(); await other?.close(); });

describe('appointment visit-mode pagination', () => {
  it('filters before pagination, retains >100 matching rows, and returns all-mode later-page hits', async () => {
    const all = ok(await k.call(desk, 'GET', list()));
    expect(all.items).toHaveLength(100);
    expect(all.items.every((a: any) => a.visitMode === 'in_person')).toBe(true);
    const later = ok(await k.call(desk, 'GET', list(`&cursor=${encodeURIComponent(all.nextCursor)}`)));
    expect(later.items.some((a: any) => a.visitMode === 'virtual')).toBe(true);
    for (const mode of ['virtual', 'in_person']) {
      const first = ok(await k.call(desk, 'GET', list(`&visitMode=${mode}`)));
      expect(first.items).toHaveLength(100);
      expect(first.items.every((a: any) => a.visitMode === mode)).toBe(true);
      const second = ok(await k.call(desk, 'GET', list(`&visitMode=${mode}&cursor=${encodeURIComponent(first.nextCursor)}`)));
      expect(second.items).toHaveLength(10);
      expect(second.nextCursor).toBeNull();
      expect(new Set([...first.items, ...second.items].map((a: any) => a.appointmentId)).size).toBe(110);
    }
  });
  it('rejects stale/malformed/legacy cursors across every filter, actor and tenant', async () => {
    const first = ok(await k.call(desk, 'GET', list()));
    const cursor = `&cursor=${encodeURIComponent(first.nextCursor)}`;
    for (const extra of [`&visitMode=virtual`, `&status=confirmed`, `&staffId=${doctor.staffId}`, '&q=Caller', '&limit=50', '&to=2050-01-04']) {
      expect((await k.call(desk, 'GET', list(extra + cursor))).status).toBe(400);
    }
    expect((await k.call(admin, 'GET', list(cursor))).status).toBe(400);
    const otherAdmin = await other.person('Other admin', 'tenant_admin', null);
    expect((await other.call(otherAdmin, 'GET', list(cursor))).status).toBe(400);
    const badDate = JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString());
    badDate.position[0] = '2050-02-31';
    for (const invalid of ['garbage', Buffer.from(JSON.stringify([day, null, doctor.staffId])).toString('base64url'), Buffer.from(JSON.stringify(badDate)).toString('base64url')]) {
      expect((await k.call(desk, 'GET', list(`&cursor=${invalid}`))).status).toBe(400);
    }
    expect((await k.call(desk, 'GET', list('&visitMode=video'))).status).toBe(400);
  });
  it('enforces clinic scope independently of filters and cursors', async () => {
    expect((await k.call(outsider, 'GET', list('&visitMode=virtual'))).status).toBe(403);
    expect((await k.call(desk, 'GET', `/v1/appointments?from=${day}&to=${day}&visitMode=virtual`)).status).toBe(400);
  });
});

describe('exact read-only booking readiness', () => {
  it('quotes the exact doctor/session/service/effective date without writes and never claims provider readiness', async () => {
    const counts = async () => (await k.admin.query(`SELECT
      (SELECT count(*) FROM booking.reservation WHERE tenant_id=$1)::int AS reservations,
      (SELECT count(*) FROM platform.audit_event WHERE tenant_id=$1)::int AS audits,
      (SELECT count(*) FROM platform.outbox_event WHERE tenant_id=$1)::int AS events`, [k.tenant.tenantId])).rows[0];
    const before = await counts();
    const result = BookingReadinessSchema.parse(ok(await k.call(desk, 'GET', readiness(), undefined, undefined, now)));
    expect(result).toMatchObject({ configuration: { complete: true, issues: [] }, fee: { feeMinor: 70000, pricedOn: day }, occupancy: 'free', slotCanBeHeld: true, guarantee: 'revalidated_on_write' });
    expect(result.separateChecks).toEqual({ videoProvider: 'not_checked', videoConsent: 'not_checked', signingEligibility: 'not_checked', walkInCapacity: 'not_applicable' });
    const future = ok(await k.call(desk, 'GET', readiness({ slotStart: ist(nextWeek, '09:00') }), undefined, undefined, now));
    expect(future.fee).toMatchObject({ feeMinor: 80000, pricedOn: nextWeek });
    const video = ok(await k.call(desk, 'GET', readiness({ slotStart: ist(day, '12:00'), visitMode: 'virtual' }), undefined, undefined, now));
    expect(video.fee.feeMinor).toBe(0); // explicit zero is free; null below is not.
    expect(await counts()).toEqual(before);
  });
  it('does not turn occupancy into a configuration failure or hold capacity while quoting', async () => {
    ok(await k.call(desk, 'POST', '/v1/holds', { staffId: doctor.staffId, slotStart: ist(day, '09:00') }, true, now), 201);
    const result = ok(await k.call(desk, 'GET', readiness(), undefined, undefined, now));
    expect(result).toMatchObject({ configuration: { complete: true }, occupancy: 'taken', slotCanBeHeld: false, fee: { feeMinor: 70000 } });
  });
  it('rejects wrong clinic access and tenant-hidden doctor, and never substitutes a requested service/mode/session', async () => {
    expect((await k.call(outsider, 'GET', readiness(), undefined, undefined, now)).status).toBe(403);
    const otherAdmin = await other.person('Other quote admin', 'tenant_admin', null);
    expect((await other.call(otherAdmin, 'GET', readiness({ facilityId: other.tenant.facilityId }), undefined, undefined, now)).status).toBe(404);
    expect((await k.call(admin, 'GET', readiness({ facilityId: facility2 }), undefined, undefined, now)).status).toBe(404);
    const wrongService = ok(await k.call(desk, 'GET', readiness({ healthcareServiceId: otherService }), undefined, undefined, now));
    expect(wrongService).toMatchObject({ fee: null, slotCanBeHeld: false, configuration: { complete: false } });
    expect(wrongService.configuration.issues).toContain('service_not_in_session');
    for (const selection of [{ visitMode: 'virtual' }, { slotStart: ist(day, '18:00') }, { slotStart: ist(day, '09:07') }] as Record<string, string>[]) {
      expect(ok(await k.call(desk, 'GET', readiness(selection), undefined, undefined, now)).slotCanBeHeld).toBe(false);
    }
  });
  it('reports a missing or inactive fee/service separately from explicit free consultations', async () => {
    await k.admin.query(`UPDATE catalog.service_item SET status='inactive' WHERE id=$1`, [item]);
    const inactive = ok(await k.call(desk, 'GET', readiness({ slotStart: ist(day, '09:15') }), undefined, undefined, now));
    expect(inactive.fee).toBeNull();
    expect(inactive.configuration.issues).toContain('service_inactive_or_incompatible');
    await k.admin.query(`UPDATE catalog.service_item SET status='active' WHERE id=$1`, [item]);
    await k.admin.query(`UPDATE catalog.price_list SET status='retired' WHERE id=$1`, [priceList]);
    const missing = ok(await k.call(desk, 'GET', readiness({ slotStart: ist(day, '09:15') }), undefined, undefined, now));
    expect(missing.fee).toBeNull();
    expect(missing.configuration.issues).toContain('fee_not_recorded');
    expect(missing.slotCanBeHeld).toBe(true); // Existing policy permits a booking without a recorded fee.
  });
});

describe('request receipt authorization', () => {
  it('returns only the original actor’s authorized receipt and refuses cross-tenant/cross-actor/legacy lookup', async () => {
    const owner = await k.person('Receipt owner', 'front_desk', k.tenant.facilityId);
    const key = `receipt-${k.run}`;
    const held = ok(await k.call(owner, 'POST', '/v1/holds', { staffId: doctor.staffId, slotStart: ist(day, '10:00') }, key, now), 201);
    expect(ok(await k.call(owner, 'GET', `/v1/request-outcomes/${key}`))).toMatchObject({ status: 'completed', scope: 'booking.hold_slot', result: { reservationId: held.reservationId } });
    expect((await k.call(admin, 'GET', `/v1/request-outcomes/${key}`)).status).toBe(403);
    const otherAdmin = await other.person('Foreign receipt reader', 'tenant_admin', null);
    expect((await other.call(otherAdmin, 'GET', `/v1/request-outcomes/${key}`)).status).toBe(404);
    expect((await k.call(owner, 'GET', `/v1/request-outcomes/missing-${k.run}`)).status).toBe(404);
    await k.admin.query(`UPDATE platform.role_grant SET revoked_at=now() WHERE staff_id=$1`, [owner.staffId]);
    expect((await k.call(owner, 'GET', `/v1/request-outcomes/${key}`)).status).toBe(403);
    await k.admin.query(`UPDATE platform.idempotency_record SET actor_hash=NULL WHERE tenant_id=$1 AND key=$2`, [k.tenant.tenantId, key]);
    expect((await k.call(owner, 'GET', `/v1/request-outcomes/${key}`)).status).toBe(403);
  });
});
