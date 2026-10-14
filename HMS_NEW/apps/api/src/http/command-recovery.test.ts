import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let a: Person, b: Person, reader: Person, doctor: Person;
let resource: string;
const before = '2030-01-07T08:00:00+05:30';
const after = '2030-01-07T08:30:00+05:30';
let slot = 0;
beforeAll(async () => {
  k = await startKit('receipt-recovery');
  a = await k.person('First actor', 'tenant_admin', null);
  b = await k.person('Second actor', 'tenant_admin', null);
  const wrongClinic = (await k.admin.query<{ id: string }>(`INSERT INTO platform.facility(tenant_id,organization_id,code,name,facility_type,state_code) VALUES($1,$2,'WRONG','Wrong clinic','clinic','29') RETURNING id`,[k.tenant.tenantId,k.tenant.organizationId])).rows[0]!.id;
  reader = await k.person('Wrong clinic', 'front_desk', wrongClinic);
  doctor = await k.person('Doctor', 'doctor', null, 'doctor');
  resource = (await k.admin.query<{ id: string }>(`INSERT INTO booking.schedulable_resource (tenant_id, kind, staff_id, name) VALUES ($1, 'practitioner', $2, 'Calendar') RETURNING id`, [k.tenant.tenantId, doctor.staffId])).rows[0]!.id;
  await k.admin.query(`INSERT INTO booking.schedule_rule (tenant_id,resource_id,facility_id,weekday,start_local,end_local,slot_minutes,effective_from) VALUES ($1,$2,$3,1,'09:00','13:00',15,'2030-01-01')`, [k.tenant.tenantId,resource,k.tenant.facilityId]);
});
afterAll(async () => { await k.close(); });
async function offer() {
  const one = async (query: string, values: unknown[]) => (await k.admin.query<{ id: string }>(query, values)).rows[0]!.id;
  const party = await one(`INSERT INTO booking.booking_party (tenant_id,name,phone) VALUES ($1,'Caller','+919876543210') RETURNING id`, [k.tenant.tenantId]);
  const entry = await one(`INSERT INTO booking.waitlist_entry (tenant_id,booking_party_id,practitioner_staff_id,facility_id,preferred_from,preferred_to,status) VALUES ($1,$2,$3,$4,'2030-01-07','2030-01-07','offered') RETURNING id`, [k.tenant.tenantId,party,doctor.staffId,k.tenant.facilityId]);
  const start = new Date('2030-01-07T09:00:00+05:30').getTime() + slot++ * 15 * 60000;
  const reservation = await one(`INSERT INTO booking.reservation (tenant_id,resource_id,facility_id,period,status,hold_expires_at) VALUES ($1,$2,$3,tstzrange($4::timestamptz,$5::timestamptz),'held','2030-01-07T08:15:00+05:30') RETURNING id`, [k.tenant.tenantId,resource,k.tenant.facilityId,new Date(start).toISOString(),new Date(start+15*60000).toISOString()]);
  const id = await one(`INSERT INTO booking.waitlist_offer (tenant_id,waitlist_entry_id,reservation_id,offered_at,expires_at) VALUES ($1,$2,$3,'2030-01-07T08:00:00+05:30','2030-01-07T08:15:00+05:30') RETURNING id`, [k.tenant.tenantId,entry,reservation]);
  return { id, entry, reservation };
}

describe('identity-bound committed command recovery', () => {
  it('discarded decline response replays after expiry and withdrawal without duplicating effects', async () => {
    const o = await offer(), key = randomUUID();
    const first = await k.call(a,'POST',`/v1/waitlist-offers/${o.id}/decline`,undefined,key,before);
    expect(first.status).toBe(200); // simulate committed response lost to the caller
    const withdrawal = await k.call(a,'POST',`/v1/waitlist/${o.entry}/withdraw`,{ reason: 'No longer needed' },randomUUID(),after);
    expect(withdrawal.status).toBe(200);
    const recovered = await k.call(a,'POST',`/v1/waitlist-offers/${o.id}/decline`,undefined,key,after);
    expect(recovered).toEqual(first);
    const actual = await k.call(a,'GET',`/v1/waitlist-offers/${o.id}`,undefined,undefined,after);
    expect(actual.body).toMatchObject({ outcome:'declined',closedByStaffId:a.staffId,version:2 });
    const effects = await k.admin.query<{ count: string }>(`SELECT count(*) FROM platform.audit_event WHERE tenant_id=$1 AND subject_id=$2 AND diff->>'declinedOfferId'=$3`, [k.tenant.tenantId,o.entry,o.id]);
    expect(Number(effects.rows[0]!.count)).toBe(1);
    const events = await k.admin.query<{ count: string }>(`SELECT count(*) FROM platform.outbox_event WHERE tenant_id=$1 AND aggregate_id=$2 AND event_type='waitlist.offer_closed'`,[k.tenant.tenantId,o.id]);
    expect(Number(events.rows[0]!.count)).toBe(1);
    const impersonation = await k.call(b,'POST',`/v1/waitlist-offers/${o.id}/decline`,undefined,key,after);
    expect(impersonation.status).toBe(409);
    expect(impersonation.body.error.code).toBe('idempotency_conflict');
  });

  it('expired offer history never reports a successful decline and tenant isolation hides it', async () => {
    const o = await offer();
    const read = await k.call(a,'GET',`/v1/waitlist-offers/${o.id}`,undefined,undefined,after);
    expect(read.body).toMatchObject({ outcome:'expired',closedByStaffId:null,version:1 });
    expect((await k.call(reader,'GET',`/v1/waitlist-offers/${o.id}`,undefined,undefined,after)).status).toBe(403);
    const declined = await k.call(a,'POST',`/v1/waitlist-offers/${o.id}/decline`,undefined,randomUUID(),after);
    expect(declined.status).toBe(422);
    const stranger = await startKit('other-receipt-tenant');
    try {
      const who = await stranger.person('Other admin','tenant_admin',null);
      expect((await stranger.call(who,'GET',`/v1/waitlist-offers/${o.id}`)).status).toBe(404);
    } finally { await stranger.close(); }
  });

  it('concurrent accepted and declined outcomes have one winner and accepted receipt survives expiry', async () => {
    const o = await offer(), acceptKey = randomUUID(), declineKey = randomUUID();
    const [accepted,declined] = await Promise.all([
      k.call(a,'POST',`/v1/waitlist-offers/${o.id}/accept`,undefined,acceptKey,before),
      k.call(b,'POST',`/v1/waitlist-offers/${o.id}/decline`,undefined,declineKey,before),
    ]);
    expect([accepted.status,declined.status].sort()).toEqual(accepted.status === 201 ? [201,422] : [200,422]);
    const current = await k.call(a,'GET',`/v1/waitlist-offers/${o.id}`,undefined,undefined,after);
    if (accepted.status === 201) {
      expect(current.body).toMatchObject({ outcome:'accepted',closedByStaffId:a.staffId,appointmentId:accepted.body.appointmentId });
      expect(await k.call(a,'POST',`/v1/waitlist-offers/${o.id}/accept`,undefined,acceptKey,after)).toEqual(accepted);
    } else {
      expect(current.body).toMatchObject({ outcome:'declined',closedByStaffId:b.staffId,appointmentId:null });
    }
  });

  it('new recovery commands reject a missing key before causing effects', async () => {
    const o = await offer();
    expect((await k.call(a,'POST',`/v1/waitlist-offers/${o.id}/decline`,undefined,false,before)).status).toBe(400);
    expect((await k.call(a,'POST',`/v1/waitlist/${o.entry}/withdraw`,{ reason:'Missing key' },false,before)).status).toBe(400);
    expect((await k.call(a,'GET',`/v1/waitlist-offers/${o.id}`,undefined,undefined,before)).body.outcome).toBe('pending');
  });

  it('lost cancellation response replays after status changed without another event or audit', async () => {
    const o = await offer();
    const accepted = await k.call(a,'POST',`/v1/waitlist-offers/${o.id}/accept`,undefined,randomUUID(),before);
    expect(accepted.status).toBe(201);
    const appointmentId = accepted.body.appointmentId, key = randomUUID(), body = {reason:'Caller cancelled'};
    expect((await k.call(a,'POST',`/v1/appointments/${appointmentId}/cancel`,body,false,before)).status).toBe(400);
    const first = await k.call(a,'POST',`/v1/appointments/${appointmentId}/cancel`,body,key,before);
    expect(first.status).toBe(200);
    expect(await k.call(a,'POST',`/v1/appointments/${appointmentId}/cancel`,body,key,after)).toEqual(first);
    const audits = await k.admin.query<{ count:string }>(`SELECT count(*) FROM platform.audit_event WHERE tenant_id=$1 AND subject_id=$2 AND reason=$3`,[k.tenant.tenantId,appointmentId,body.reason]);
    const events = await k.admin.query<{ count:string }>(`SELECT count(*) FROM platform.outbox_event WHERE tenant_id=$1 AND aggregate_id=$2 AND event_type='appointment.cancelled'`,[k.tenant.tenantId,appointmentId]);
    expect(Number(audits.rows[0]!.count)).toBe(1); expect(Number(events.rows[0]!.count)).toBe(1);
  });

  it('lost exception and holiday revocations preserve the first actor and timestamp by key', async () => {
    const exception = (await k.admin.query<{ id:string }>(`INSERT INTO booking.schedule_exception(tenant_id,resource_id,on_date,kind,reason) VALUES($1,$2,'2030-01-08','closed','Unavailable') RETURNING id`,[k.tenant.tenantId,resource])).rows[0]!.id;
    const holiday = (await k.admin.query<{ id:string }>(`INSERT INTO booking.facility_holiday(tenant_id,facility_id,holiday_on,name) VALUES($1,$2,'2030-01-08','Holiday') RETURNING id`,[k.tenant.tenantId,k.tenant.facilityId])).rows[0]!.id;
    for (const url of [`/v1/schedule-exceptions/${exception}/revoke`,`/v1/facility-holidays/${holiday}/revoke`]) {
      const key = randomUUID(), body = {reason:'Corrected availability'};
      expect((await k.call(a,'POST',url,body,false,before)).status).toBe(400);
      const first = await k.call(a,'POST',url,body,key,before);
      expect(first.status).toBe(200); expect(first.body.revokedByStaffId).toBe(a.staffId);
      expect(await k.call(a,'POST',url,body,key,after)).toEqual(first);
      expect((await k.call(b,'POST',url,body,key,after)).status).toBe(409);
    }
  });

  it('withdraw receipts reject another actor, changed request, and revoked current permissions', async () => {
    const o = await offer(), key = randomUUID(), body = {reason:'Caller withdrew'};
    const first = await k.call(a,'POST',`/v1/waitlist/${o.entry}/withdraw`,body,key,before);
    expect(first.status).toBe(200);
    expect(await k.call(a,'POST',`/v1/waitlist/${o.entry}/withdraw`,body,key,after)).toEqual(first);
    expect((await k.call(a,'POST',`/v1/waitlist/${o.entry}/withdraw`,{reason:'Different reason'},key,after)).status).toBe(409);
    expect((await k.call(b,'POST',`/v1/waitlist/${o.entry}/withdraw`,body,key,after)).status).toBe(409);
    await k.admin.query(`DELETE FROM platform.role_grant WHERE tenant_id=$1 AND staff_id=$2`,[k.tenant.tenantId,a.staffId]);
    try { expect((await k.call(a,'POST',`/v1/waitlist/${o.entry}/withdraw`,body,key,after)).status).toBe(403); }
    finally { await k.admin.query(`INSERT INTO platform.role_grant(tenant_id,staff_id,role_id) SELECT $1,$2,id FROM platform.role WHERE tenant_id IS NULL AND code='tenant_admin'`,[k.tenant.tenantId,a.staffId]); }
  });
});
