import { randomUUID } from 'node:crypto';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startKit,nextMonday,ist,type Kit,type Person } from './test-kit.ts';
import { buildServer } from '../server.ts';
import { createVerifier } from '../auth/verify.ts';
import { DEV_SECRET_DEFAULT,DEV_ISSUER } from '../config.ts';
import { readSlot,signSlot,type PublicBookingSite } from '../modules/booking/public-config.ts';

let k:Kit,app:FastifyInstance,admin:Person,doctor:Person,site:PublicBookingSite,service:string,department:string,resource:string;
const secret='public-booking-test-signing-secret-12345',origin='http://127.0.0.1:5210',day=nextMonday();
const prefix='/public/v1/booking/sri-lakshmi';
const payload=(token:string)=>({slotToken:token,name:'Example Person',phone:'+919988776655'});
async function request(method:'GET'|'POST',path:string,body?:object,key=randomUUID(),requestOrigin:string|null=origin) {
  const r=await app.inject({method,url:prefix+path,headers:{...(requestOrigin?{origin:requestOrigin}:{}),...(method==='POST'?{'idempotency-key':key}:{})},...(body?{payload:body}:{})});
  return {status:r.statusCode,body:r.json(),headers:r.headers};
}
async function slots() {const r=await request('GET',`/slots?doctor=dr-real&mode=in_person&from=${day}&to=${day}`);expect(r.status,JSON.stringify(r.body)).toBe(200);return r.body.slots as {slotToken:string;startsAt:string}[];}
beforeAll(async()=>{
  k=await startKit('public-booking');admin=await k.person('Admin','tenant_admin',null);
  doctor=await k.person('Dr Real','doctor',k.tenant.facilityId,'doctor');
  const integration=await k.person('Website booking','front_desk',k.tenant.facilityId);
  await k.admin.query("UPDATE platform.staff SET is_system_account=true,staff_type='other' WHERE id=$1",[integration.staffId]);
  const identity=(await k.admin.query('SELECT identity_issuer,identity_subject FROM platform.user_account WHERE staff_id=$1',[integration.staffId])).rows[0];
  site={siteSlug:'sri-lakshmi',tenantId:k.tenant.tenantId,facilityId:k.tenant.facilityId,identityIssuer:identity.identity_issuer,identitySubject:identity.identity_subject,origins:[origin],doctorAliases:{'dr-real':['doc-1']},websiteBranchId:'kr-puram'};
  const one=async(s:string,v:unknown[])=>String((await k.admin.query(s,v)).rows[0].id);
  department=await one("INSERT INTO platform.department(tenant_id,facility_id,code,name,kind)VALUES($1,$2,'MED','Medicine','clinical')RETURNING id",[site.tenantId,site.facilityId]);
  const item=await one("INSERT INTO catalog.service_item(tenant_id,code,name,category)VALUES($1,'CONS','Consultation','consultation')RETURNING id",[site.tenantId]);
  service=await one("INSERT INTO catalog.healthcare_service(tenant_id,department_id,code,name,service_mode,consultation_service_item_id)VALUES($1,$2,'CONS','Consultation','both',$3)RETURNING id",[site.tenantId,department,item]);
  const list=await one("INSERT INTO catalog.price_list(tenant_id,code,name,kind,is_default,valid_from)VALUES($1,'WEB','Clinic fee','cash',true,'2020-01-01')RETURNING id",[site.tenantId]);
  await k.admin.query("INSERT INTO catalog.price_list_item(tenant_id,price_list_id,service_item_id,unit_price_minor,valid_from)VALUES($1,$2,$3,80000,'2020-01-01')",[site.tenantId,list,item]);
  await k.admin.query("UPDATE catalog.price_list SET status='active',activated_at=now() WHERE id=$1",[list]);
  await k.admin.query("INSERT INTO catalog.practitioner_profile(tenant_id,staff_id,published,public_slug,accepts_virtual)VALUES($1,$2,true,'dr-real',true)",[site.tenantId,doctor.staffId]);
  await k.admin.query("INSERT INTO catalog.practitioner_affiliation(tenant_id,staff_id,facility_id,department_id,valid_from)VALUES($1,$2,$3,$4,'2020-01-01')",[site.tenantId,doctor.staffId,site.facilityId,department]);
  resource=await one("INSERT INTO booking.schedulable_resource(tenant_id,staff_id,kind,name)VALUES($1,$2,'practitioner','Doctor')RETURNING id",[site.tenantId,doctor.staffId]);
  await k.admin.query("INSERT INTO booking.schedule_rule(tenant_id,resource_id,facility_id,weekday,start_local,end_local,slot_minutes,healthcare_service_id,visit_mode,effective_from)VALUES($1,$2,$3,1,'09:00','13:00',15,$4,'in_person','2020-01-01')",[site.tenantId,resource,site.facilityId,service]);
  await k.admin.query("INSERT INTO platform.module_state(tenant_id,module_code,state)VALUES($1,'booking','active')ON CONFLICT(tenant_id,module_code)DO UPDATE SET state='active'",[site.tenantId]);
  app=buildServer({db:k.db,verifier:createVerifier({mode:'dev',secret:DEV_SECRET_DEFAULT,issuer:DEV_ISSUER}),publicBooking:{sites:[site],signingSecret:secret}});
});
afterAll(async()=>{await app?.close();await k?.close();});

describe('public website booking into HMS',()=>{
  it('returns published backend profiles only and accepts no staff credentials or patient chart request',async()=>{
    const c=await request('GET','/catalog');expect(c.status).toBe(200);
    expect(c.body).toMatchObject({websiteBranchId:'kr-puram',doctors:[{slug:'dr-real',name:'Dr Real',websiteIds:['doc-1'],qualifications:[],bio:null,photoUrl:null}]});
    expect(c.body.doctors[0]).not.toHaveProperty('staffId');
    expect((await app.inject({method:'GET',url:'/v1/patients'})).statusCode).toBe(401);
    expect((await request('GET','/catalog',undefined,undefined,'https://other.example')).status).toBe(403);
    expect((await request('POST','/appointments',payload('invalid'),undefined,null)).status).toBe(403);
    const r=await app.inject({method:'OPTIONS',url:prefix+'/appointments',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'content-type,idempotency-key'}});
    expect(r.statusCode).toBe(204);expect(r.headers['access-control-allow-origin']).toBe(origin);
  });
  it('atomically persists one web appointment, unverified contact, audit/outbox; concurrent retry returns same receipt',async()=>{
    const [slot]=await slots(),key=randomUUID(),body=payload(slot!.slotToken);
    const results=await Promise.all([request('POST','/appointments',body,key),request('POST','/appointments',body,key)]);
    expect(results.map(r=>r.status),JSON.stringify(results)).toEqual([201,201]);expect(results[0]!.body).toEqual(results[1]!.body);
    const id=results[0]!.body.appointmentId;
    const rows=(await k.admin.query('SELECT a.origin_channel,a.patient_id,a.visit_mode,b.verified_channel,b.verified_at FROM booking.appointment a JOIN booking.booking_party b ON b.id=a.booking_party_id WHERE a.id=$1',[id])).rows;
    expect(rows).toEqual([{origin_channel:'web',patient_id:null,visit_mode:'in_person',verified_channel:null,verified_at:null}]);
    expect((await k.call(admin,'GET',`/v1/appointments?facilityId=${site.facilityId}&from=${day}&to=${day}`)).body.items.some((a:any)=>a.appointmentId===id && a.originChannel==='web')).toBe(true);
    expect((await k.admin.query("SELECT count(*)::int n FROM platform.outbox_event WHERE aggregate_id=$1 AND event_type='appointment.confirmed'",[id])).rows[0].n).toBe(1);
    expect((await request('POST','/appointments',{...body,name:'Changed Name'},key)).status).toBe(409);
    expect((await request('POST','/appointments',body,randomUUID())).status).toBe(409);
  });
  it('rejects forged tokens, patient IDs, claimed verification and wrong-site tokens without partial writes',async()=>{
    const [slot]=await slots();
    const claim=readSlot(slot!.slotToken,secret);
    expect((await request('POST','/appointments',payload(slot!.slotToken+'x'))).status).toBe(400);
    expect((await request('POST','/appointments',{...payload(slot!.slotToken),patientId:randomUUID()})).status).toBe(400);
    expect((await request('POST','/appointments',{...payload(slot!.slotToken),verifiedChannel:'whatsapp'})).status).toBe(400);
    expect((await request('POST','/appointments',payload(signSlot({...claim,facilityId:randomUUID()},secret)))).status).toBe(403);
  });
  it('expired quotes fail before holding, but a committed key replays after quote expiry',async()=>{
    const [slot]=await slots(),claim=readSlot(slot!.slotToken,secret);
    expect((await request('POST','/appointments',payload(signSlot({...claim,expiresAt:Date.now()-1},secret)))).status).toBe(422);
    const token=signSlot({...claim,expiresAt:Date.now()+1200},secret),key=randomUUID(),body=payload(token);
    const made=await request('POST','/appointments',body,key);expect(made.status,JSON.stringify(made.body)).toBe(201);
    await new Promise(resolve=>setTimeout(resolve,1300));
    expect((await request('POST','/appointments',body,key)).body).toEqual(made.body);
  });
  it('revalidates eligibility after waiting for a concurrent directory change and rolls back all booking data',async()=>{
    const [slot]=await slots(),client=await k.admin.connect();
    await client.query('BEGIN');await client.query('UPDATE platform.department SET status=\'inactive\' WHERE id=$1',[department]);
    const pending=request('POST','/appointments',payload(slot!.slotToken));
    await new Promise(resolve=>setTimeout(resolve,80));await client.query('COMMIT');client.release();
    const result=await pending;expect(result.status,JSON.stringify(result.body)).toBe(409);
    expect((await k.admin.query('SELECT count(*)::int n FROM booking.reservation WHERE resource_id=$1 AND period @> $2::timestamptz',[resource,slot!.startsAt])).rows[0].n).toBe(0);
    await k.admin.query('UPDATE platform.department SET status=\'active\' WHERE id=$1',[department]);
  });
  it('new blocked time wins before a waiting confirmation; fee changes invalidate the quote',async()=>{
    const [slot]=await slots(),client=await k.admin.connect();
    await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtextextended('booking-calendar:' || $1,0))",[site.tenantId]);
    const pending=request('POST','/appointments',payload(slot!.slotToken));
    await new Promise(resolve=>setTimeout(resolve,80));
    const localTime=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(slot!.startsAt));
    await client.query("INSERT INTO booking.schedule_exception(tenant_id,resource_id,facility_id,on_date,kind,start_local,end_local,reason)VALUES($1,$2,$3,$4,'block',$5,'13:00','Closed')",[site.tenantId,resource,site.facilityId,day,localTime]);
    await client.query('COMMIT');client.release();
    expect((await pending).status).toBe(409);
    await k.admin.query('DELETE FROM booking.schedule_exception WHERE resource_id=$1',[resource]);
    const [again]=await slots();
    expect((await k.call(admin,'PUT',`/v1/healthcare-services/${service}/fee`,{mode:'any',feeMinor:90000,effectiveFrom:day},true)).status).toBe(200);
    expect((await request('POST','/appointments',payload(again!.slotToken))).status).toBe(409);
    expect((await k.call(admin,'PUT',`/v1/healthcare-services/${service}/fee`,{mode:'any',feeMinor:80000,effectiveFrom:day},true)).status).toBe(200);
  });
  it('distinct concurrent customers cannot both book the same time',async()=>{
    const [slot]=await slots();
    const results=await Promise.all([request('POST','/appointments',{...payload(slot!.slotToken),phone:'+919988770001'}),request('POST','/appointments',{...payload(slot!.slotToken),phone:'+919988770002'})]);
    expect(results.map(r=>r.status).sort()).toEqual([201,409]);
    expect((await k.admin.query('SELECT count(*)::int n FROM booking.appointment WHERE practitioner_staff_id=$1 AND starts_at=$2',[doctor.staffId,slot!.startsAt])).rows[0].n).toBe(1);
  });
  it('honors the published consultation service even when its department differs from the doctor primary affiliation',async()=>{
    const other=(await k.admin.query("INSERT INTO platform.department(tenant_id,facility_id,code,name,kind)VALUES($1,$2,'DIAB','Diabetology','clinical')RETURNING id",[site.tenantId,site.facilityId])).rows[0].id;
    await k.admin.query('UPDATE catalog.healthcare_service SET department_id=$1 WHERE id=$2',[other,service]);
    try {
      const [slot]=await slots();expect(slot).toBeDefined();
      const made=await request('POST','/appointments',{...payload(slot!.slotToken),phone:'+919988770003'});
      expect(made.status,JSON.stringify(made.body)).toBe(201);
      expect((await k.admin.query('SELECT healthcare_service_id FROM booking.appointment WHERE id=$1',[made.body.appointmentId])).rows[0].healthcare_service_id).toBe(service);
    } finally {await k.admin.query('UPDATE catalog.healthcare_service SET department_id=$1 WHERE id=$2',[department,service]);}
  });
  it('exposes scheduled but unpriced times separately without a booking token or invented fee',async()=>{
    const old=(await k.admin.query('SELECT consultation_service_item_id FROM catalog.healthcare_service WHERE id=$1',[service])).rows[0].consultation_service_item_id;
    const unpriced=(await k.admin.query("INSERT INTO catalog.service_item(tenant_id,code,name,category)VALUES($1,'UNPRICED','Unpriced consultation','consultation')RETURNING id",[site.tenantId])).rows[0].id;
    await k.admin.query('UPDATE catalog.healthcare_service SET consultation_service_item_id=$1 WHERE id=$2',[unpriced,service]);
    try {
      const r=await request('GET',`/slots?doctor=dr-real&mode=in_person&from=${day}&to=${day}`);
      expect(r.status).toBe(200);expect(r.body.slots).toEqual([]);expect(r.body.unpricedSlots.length).toBeGreaterThan(0);
      expect(r.body.unpricedSlots[0]).toHaveProperty('serviceName','Consultation');
      expect(r.body.unpricedSlots[0]).not.toHaveProperty('slotToken');expect(r.body.unpricedSlots[0]).not.toHaveProperty('feeMinor');
    }finally{await k.admin.query('UPDATE catalog.healthcare_service SET consultation_service_item_id=$1 WHERE id=$2',[old,service]);}
  });
  it('a suspended hospital stops public reads and new confirmations',async()=>{
    const [slot]=await slots();
    await k.admin.query("UPDATE platform.tenant SET status='suspended' WHERE id=$1",[site.tenantId]);
    try {
      expect((await request('GET','/catalog')).status).toBe(403);
      expect((await request('POST','/appointments',payload(slot!.slotToken))).status).toBe(403);
    } finally {
      await k.admin.query("UPDATE platform.tenant SET status='active' WHERE id=$1",[site.tenantId]);
    }
  });
  it('revoked integration or unpublished profiles cannot create new bookings',async()=>{
    const [slot]=await slots();
    await k.admin.query('UPDATE catalog.practitioner_profile SET published=false WHERE staff_id=$1',[doctor.staffId]);
    expect((await request('GET','/catalog')).body.doctors).toEqual([]);
    expect((await request('POST','/appointments',payload(slot!.slotToken))).status).toBe(409);
    await k.admin.query('UPDATE catalog.practitioner_profile SET published=true WHERE staff_id=$1',[doctor.staffId]);
    await k.admin.query('DELETE FROM platform.role_grant WHERE staff_id=(SELECT staff_id FROM platform.user_account WHERE identity_subject=$1)',[site.identitySubject]);
    expect((await request('GET','/catalog')).status).toBe(403);
  });
  it('shared HTTP budget counts invalid requests and ignores client-forwarded IPs',async()=>{
    let status=0;
    for(let i=0;i<31;i++) {
      const result=await app.inject({method:'POST',url:prefix+'/appointments',headers:{origin,'idempotency-key':randomUUID(),'x-forwarded-for':`192.0.2.${i}`},payload:{}});
      status=result.statusCode;
      if(status===429)break;
    }
    expect(status).toBe(429);
    const budget=(await k.admin.query('SELECT subject_hash FROM booking.public_request_budget WHERE tenant_id=$1',[site.tenantId])).rows;
    expect(budget.every(r=>/^[0-9a-f]{64}$/.test(r.subject_hash))).toBe(true);
  });
});
