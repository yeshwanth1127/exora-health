import {websiteVoiceContext} from '../modules/booking/website-voice-context.ts';
import { createHmac } from 'node:crypto';
import { seal, type ManagedSettings } from '../modules/comms/managed-config.ts';
import { dispatchBookingChats } from '../modules/comms/managed-booking-chat.ts';
import { dispatchManagedWhatsApp } from '../modules/comms/managed-whatsapp.ts';
import { dispatchAnalyticsMirror } from '../modules/comms/managed-analytics.ts';
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
const sent:any[]=[],mirrored:any[]=[];
let mirrorFails=false;
const managed:ManagedSettings={encryptionKey:Buffer.alloc(32,8),publicOrigin:'https://dashboard.example.com',whatsappSending:true,meta:{appId:'123456',appSecret:'test-managed-secret',configId:'123456',graphVersion:'v23.0'},umami:{origin:'https://analytics.example.com',key:'private-test-key'},posthog:{origin:'https://us.i.posthog.com',key:'private-mirror-key'},fetcher:async(url,init={})=>{
  if(String(url).includes('posthog.com')){mirrored.push(JSON.parse(String(init.body)));return new Response('{}',{status:mirrorFails?503:200});}
  if(String(url).endsWith('/messages')){sent.push(JSON.parse(String(init.body)));return new Response(JSON.stringify({messages:[{id:'wamid.test-'+sent.length}]}));}
  return new Response('{}');
}};
const priorSecret=process.env.WA_APP_SECRET;
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
  managed.booking={sites:[site],signingSecret:secret};
  process.env.WA_APP_SECRET=managed.meta!.appSecret;
  app=buildServer({db:k.db,managed,verifier:createVerifier({mode:'dev',secret:DEV_SECRET_DEFAULT,issuer:DEV_ISSUER}),publicBooking:{sites:[site],signingSecret:secret}});
});
afterAll(async()=>{if(priorSecret===undefined)delete process.env.WA_APP_SECRET;else process.env.WA_APP_SECRET=priorSecret;await app?.close();await k?.close();});

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
  it('saves and idempotently recovers enquiries in the scoped staff inbox',async()=>{
    const body={name:'Website Visitor',email:'visitor@example.test',topic:'Visiting information',message:'Which entrance should I use?'},key=randomUUID();
    const [a,b]=await Promise.all([request('POST','/enquiries',body,key),request('POST','/enquiries',body,key)]);
    expect(a.status,JSON.stringify(a.body)).toBe(201);expect(b.body).toEqual(a.body);
    expect((await request('POST','/enquiries',{...body,message:'Changed'},key)).status).toBe(409);
    expect((await request('POST','/enquiries',body,randomUUID(),null)).status).toBe(403);
    expect((await request('POST','/enquiries',{...body,patientId:randomUUID()})).status).toBe(400);
    const path=`/v1/facilities/${site.facilityId}/website/enquiries`;
    const inbox=await k.call(admin,'GET',path);expect(inbox.status,JSON.stringify(inbox.body)).toBe(200);
    const row=inbox.body.items.find((i:any)=>i.id===a.body.id);expect(row).toMatchObject({name:body.name,status:'new',version:1});
    expect((await k.call(doctor,'GET',path)).status).toBe(403);
    const reviewed=await k.call(admin,'POST',path+'/'+row.id+'/review',{version:row.version},true);
    expect(reviewed.status,JSON.stringify(reviewed.body)).toBe(200);expect(reviewed.body).toMatchObject({status:'reviewed',version:2});
    expect((await k.call(admin,'POST',path+'/'+row.id+'/review',{version:row.version},true)).status).toBe(409);
  });
  it('validates a website slot preference without holding or booking it',async()=>{
    const [slot]=await slots(),config={sites:[site],signingSecret:secret};
    const before=(await k.admin.query('SELECT count(*)::int n FROM booking.reservation WHERE tenant_id=$1',[site.tenantId])).rows[0].n;
    const ctx=await websiteVoiceContext(k.db,config,{site:site.siteSlug,slotToken:slot!.slotToken},origin,'voice-test');
    expect(ctx).toMatchObject({doctor_slug:'dr-real',preferred_start:slot!.startsAt,selection_status:'preference_only'});
    expect((await k.admin.query('SELECT count(*)::int n FROM booking.reservation WHERE tenant_id=$1',[site.tenantId])).rows[0].n).toBe(before);
    const claim=readSlot(slot!.slotToken,secret);
    for(const token of [slot!.slotToken+'x',signSlot({...claim,expiresAt:Date.now()-1},secret),signSlot({...claim,facilityId:randomUUID()},secret)])await expect(websiteVoiceContext(k.db,config,{site:site.siteSlug,slotToken:token},origin,'voice-test')).rejects.toThrow();
    await expect(websiteVoiceContext(k.db,config,{site:site.siteSlug,slotToken:slot!.slotToken},'https://wrong.example','voice-test')).rejects.toThrow();
    await k.admin.query("UPDATE catalog.practitioner_profile SET published=false WHERE staff_id=$1",[doctor.staffId]);
    try{await expect(websiteVoiceContext(k.db,config,{site:site.siteSlug,slotToken:slot!.slotToken},origin,'voice-test')).rejects.toThrow()}finally{await k.admin.query("UPDATE catalog.practitioner_profile SET published=true WHERE staff_id=$1",[doctor.staffId])}
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

describe('managed booking operations',()=>{
  beforeAll(async()=>{
    await k.admin.query("INSERT INTO platform.role_grant(tenant_id,staff_id,role_id,facility_id) SELECT $1,u.staff_id,r.id,$2 FROM platform.user_account u CROSS JOIN platform.role r WHERE u.identity_subject=$3 AND r.tenant_id IS NULL AND r.code='front_desk'",[site.tenantId,site.facilityId,site.identitySubject]);
    await k.admin.query('DELETE FROM booking.public_request_budget WHERE tenant_id=$1',[site.tenantId]);
    await k.admin.query("INSERT INTO platform.module_state(tenant_id,module_code,state)VALUES($1,'comms','active')ON CONFLICT(tenant_id,module_code)DO UPDATE SET state='active'",[site.tenantId]);
  });
  let chatId:string;
  const phone='777777777777777',waba='888888888888888';
  async function inbound(text:string,id=randomUUID()) {
    const value={metadata:{phone_number_id:phone},messages:[{id,from:'919999887766',timestamp:String(Math.floor(Date.now()/1000)),type:'text',text:{body:text}}]};
    const raw=JSON.stringify({object:'whatsapp_business_account',entry:[{id:waba,changes:[{field:'messages',value}]}]});
    const response=await app.inject({method:'POST',url:'/v1/integrations/whatsapp/webhook',headers:{'content-type':'application/json','x-hub-signature-256':'sha256='+createHmac('sha256',managed.meta!.appSecret).update(raw).digest('hex')},payload:raw});
    expect(response.statusCode,response.body).toBe(200);await k.dispatch();
    await Promise.all([dispatchBookingChats(k.db,managed),dispatchBookingChats(k.db,managed)]);
    const latest=(await k.admin.query("SELECT m.text_content,m.conversation_id FROM comms.outbound_message m JOIN comms.inbound_message i ON i.id=m.managed_inbound_id WHERE i.provider_message_id=$1",[id])).rows[0];
    if(latest)chatId=latest.conversation_id;
    return latest?.text_content as string|undefined;
  }
  it('persists the real consent -> doctor -> time -> name -> confirmation conversation exactly once',async()=>{
    const credential=seal(managed,{token:'test-never-return-token'},`${site.tenantId}:${site.facilityId}:whatsapp`);
    await k.admin.query("INSERT INTO comms.channel_account(tenant_id,facility_id,phone_number_id) VALUES($1,$2,$3)",[site.tenantId,site.facilityId,phone]);
    await k.admin.query("INSERT INTO comms.managed_connection(tenant_id,facility_id,provider,external_id,credential,metadata,created_by)VALUES($1,$2,'whatsapp',$3,$4,$5,$6)",[site.tenantId,site.facilityId,phone,credential,JSON.stringify({subscribed:true,businessAccountId:waba}),admin.staffId]);
    await k.admin.query("INSERT INTO comms.whatsapp_workspace(tenant_id,facility_id,draft,preferences,created_by,booking_enabled_at)VALUES($1,$2,$3,$4,$5,now()-interval '1 minute')",[site.tenantId,site.facilityId,JSON.stringify({live:false,paused:false}),JSON.stringify({quiet:{on:false,from:'21:00',to:'08:00'}}),admin.staffId]);
    const workspace=await app.inject({method:'GET',url:`/v1/whatsapp-workspace?facilityId=${site.facilityId}`,headers:{authorization:`Bearer ${admin.token}`}});
    expect(workspace.statusCode).toBe(200);const stored=workspace.json(),{connected,...draft}=stored.setup;
    const activation=await app.inject({method:'PUT',url:'/v1/whatsapp-workspace',headers:{authorization:`Bearer ${admin.token}`,'idempotency-key':randomUUID()},payload:{facilityId:site.facilityId,version:stored.version,draft:{...draft,live:true},preferences:stored.data.settings}});
    expect(activation.statusCode,activation.body).toBe(200);
    expect(await inbound('HI')).toContain('reply YES');
    expect(await inbound('YES')).toContain('Reply REMIND');
    expect(await inbound('REMIND')).toContain('Dr Real');
    expect(await inbound('1')).toContain('visit type');
    expect(await inbound('1')).toContain('Choose an available time');
    expect(await inbound('1')).toContain('full name');
    expect(await inbound('Synthetic Visitor')).toContain('Reply CONFIRM');
    const id=randomUUID(),confirmation=await inbound('CONFIRM',id);
    expect(confirmation).toContain('Your appointment is confirmed.');
    await inbound('CONFIRM',id);
    const appointments=(await k.admin.query("SELECT a.id,a.patient_id,a.origin_channel,b.phone FROM booking.appointment a JOIN booking.booking_party b ON b.id=a.booking_party_id WHERE a.tenant_id=$1 AND a.origin_channel='whatsapp'",[site.tenantId])).rows;
    expect(appointments).toHaveLength(1);
    expect((await k.admin.query("SELECT comms.has_consent(p.id,'reminders') ok FROM comms.contact_point p JOIN booking.appointment a ON a.booking_party_id=p.booking_party_id WHERE a.id=$1",[appointments[0].id])).rows[0].ok).toBe(true);expect(appointments[0]).toMatchObject({patient_id:null,origin_channel:'whatsapp',phone:'+919999887766'});
    expect((await k.admin.query("SELECT count(*)::int n FROM comms.outbound_message m JOIN comms.inbound_message i ON i.id=m.managed_inbound_id WHERE i.provider_message_id=$1",[id])).rows[0].n).toBe(1);
    await Promise.all([dispatchManagedWhatsApp(k.db,managed),dispatchManagedWhatsApp(k.db,managed)]);
    expect(sent.filter(m=>m.text?.body?.includes('Your appointment is confirmed.'))).toHaveLength(1);
    expect((await k.admin.query("SELECT count(*)::int n FROM comms.outbound_message WHERE conversation_id=$1 AND status='sent'",[chatId])).rows[0].n).toBe(8);
  });
  it('human handoff and STOP block queued automated sends and do not create bookings',async()=>{
    await inbound('RESTART');
    expect(await inbound('HUMAN')).toBeUndefined();
    const before=sent.length;await dispatchManagedWhatsApp(k.db,managed);expect(sent).toHaveLength(before);
    expect((await k.admin.query('SELECT automation_state FROM comms.conversation WHERE id=$1',[chatId])).rows[0].automation_state).toBe('handoff_requested');
    await k.admin.query("UPDATE comms.conversation SET automation_state='automation' WHERE id=$1",[chatId]);
    await inbound('RESTART');await inbound('STOP');
    await dispatchManagedWhatsApp(k.db,managed);expect(sent).toHaveLength(before);
    expect((await k.admin.query("SELECT comms.has_consent(contact_point_id,'care') ok FROM comms.conversation WHERE id=$1",[chatId])).rows[0].ok).toBe(false);
  });
  it('attributes only committed, origin-matched website bookings once and mirrors no personal data',async()=>{
    const id=randomUUID();await k.admin.query("INSERT INTO comms.analytics_site(id,tenant_id,facility_id,origin,kind,umami_id,enabled,created_by)VALUES($1,$2,$3,$4,'booking',$5,true,$6)",[id,site.tenantId,site.facilityId,origin,randomUUID(),admin.staffId]);
    const [slot]=await slots(),key=randomUUID(),input={...payload(slot!.slotToken),phone:'+919988770009'};
    const made=await request('POST','/appointments',input,key);expect(made.status,JSON.stringify(made.body)).toBe(201);
    expect((await request('POST','/appointments',input,key)).body).toEqual(made.body);
    expect((await k.admin.query('SELECT count(*)::int n FROM comms.booking_attribution WHERE appointment_id=$1',[made.body.appointmentId])).rows[0].n).toBe(1);
    mirrorFails=true;await dispatchAnalyticsMirror(k.db,managed);expect(mirrored).toHaveLength(1);
    await k.admin.query("UPDATE comms.analytics_mirror SET next_attempt_at=now() WHERE tenant_id=$1",[site.tenantId]);
    mirrorFails=false;await Promise.all([dispatchAnalyticsMirror(k.db,managed),dispatchAnalyticsMirror(k.db,managed)]);
    expect(mirrored).toHaveLength(2);expect(mirrored[0].uuid).toBe(mirrored[1].uuid);
    const report=JSON.stringify(mirrored);for(const value of [input.name,input.phone,made.body.appointmentId,made.body.confirmationCode,'patient_id','booking_party_id'])expect(report).not.toContain(value);
    expect(mirrored[0]).toMatchObject({event:'booking_completed',properties:{$process_person_profile:false,page:'/book'}});
  });
  it('attributes the provisioned tenant website booking once and respects GPC', async()=>{
    const tenantApp=buildServer({db:k.db,managed:{...managed,publicOrigin:origin},publicTenantId:site.tenantId,
      verifier:createVerifier({mode:'dev',secret:DEV_SECRET_DEFAULT,issuer:DEV_ISSUER}),publicBooking:{sites:[site],signingSecret:secret}});
    try {
      const make=async(gpc=false)=>{
        const [slot]=await slots();
        const held=await tenantApp.inject({method:'POST',url:'/public/v1/holds',headers:{'idempotency-key':randomUUID()},payload:{facilityId:site.facilityId,staffId:doctor.staffId,slotStart:slot!.startsAt}});
        expect(held.statusCode,held.body).toBe(201);
        const key=randomUUID(),payload={reservationId:held.json().reservationId,name:'Hosted Visitor',phone:'+919988770011'};
        const send=()=>tenantApp.inject({method:'POST',url:'/public/v1/appointments',headers:{origin,'idempotency-key':key,...(gpc?{'sec-gpc':'1'}:{})},payload});
        const first=await send();expect(first.statusCode,first.body).toBe(201);
        expect((await send()).json()).toEqual(first.json());
        return first.json().appointmentId;
      };
      const id=await make();
      expect((await k.admin.query('SELECT count(*)::int n FROM comms.booking_attribution WHERE appointment_id=$1',[id])).rows[0].n).toBe(1);
      const privateId=await make(true);
      expect((await k.admin.query('SELECT count(*)::int n FROM comms.booking_attribution WHERE appointment_id=$1',[privateId])).rows[0].n).toBe(0);
    } finally { await tenantApp.close(); }
  });

});
