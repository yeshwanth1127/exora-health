import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startKit, type Kit, type Person } from './test-kit.ts';
import { ChannelOnboardingSchema } from '@hms/contracts';
let k:Kit, admin:Person, desk:Person, other:Kit, outsider:Person;
const path=(channel='voice')=>`/v1/channel-onboarding/${channel}`;
const draft={channel:'voice',numberStrategy:'existing_forwarded',existingNumber:'+919876543210',receptionistNumber:'+919876543210',languages:['en','kn'],greeting:'Welcome to our clinic.',overflow:{busy:true,noAnswer:true,unavailable:true,ringSeconds:25},humanTransferNumber:'+919876543211',failureAction:'take_callback'};
beforeAll(async()=>{k=await startKit('channel-onboarding');other=await startKit('other-onboarding');admin=await k.person('Admin','tenant_admin',null);desk=await k.person('Desk','front_desk',k.tenant.facilityId);outsider=await other.person('Outsider','tenant_admin',null);});
afterAll(async()=>{await k.close();await other.close();});
describe('managed channel setup requests',()=>{
 it('returns not started independently per clinic and channel; cannot fabricate activation',async()=>{
  const read=await k.call(admin,'GET',`${path()}?facilityId=${k.tenant.facilityId}`);
  expect(read.status).toBe(200);expect(ChannelOnboardingSchema.parse(read.body)).toMatchObject({state:'not_started',version:0,live:false,draft:null});
  expect((await k.call(admin,'PUT',path(),{facilityId:k.tenant.facilityId,version:0,draft,live:true})).status).toBe(400);
  expect((await k.call(desk,'PUT',path(),{facilityId:k.tenant.facilityId,version:0,draft})).status).toBe(403);
  expect((await other.call(outsider,'GET',`${path()}?facilityId=${k.tenant.facilityId}`)).status).toBe(404);
  expect((await k.call(admin,'PUT',path('whatsapp'),{facilityId:k.tenant.facilityId,version:0,draft})).status).toBe(400);
 });
 it('persists one attributed draft through discarded response retry and rejects concurrent stale edits',async()=>{
  const input={facilityId:k.tenant.facilityId,version:0,draft},key=`setup-${k.run}`;
  const saved=await k.call(admin,'PUT',path(),input,key);expect(saved.status).toBe(200);
  expect(await k.call(admin,'PUT',path(),input,key)).toEqual(saved);
  expect(saved.body).toMatchObject({version:1,state:'draft',draft,updatedByStaffId:admin.staffId,live:false});
  const res=await Promise.all(['one','two'].map(greeting=>k.call(admin,'PUT',path(),{...input,version:1,draft:{...draft,greeting:`Hello ${greeting}`}})));
  expect(res.map(r=>r.status).sort()).toEqual([200,409]);
  expect((await k.call(admin,'PUT',path(),input,false)).status).toBe(400);
 });
 it('requests provisioning once and preserves the original receipt after further edits',async()=>{
  const read=await k.call(admin,'GET',`${path()}?facilityId=${k.tenant.facilityId}`), input={facilityId:k.tenant.facilityId,version:read.body.version}, key=`submit-${k.run}`;
  const submitted=await k.call(admin,'POST',`${path()}/submit`,input,key);expect(submitted.status).toBe(200);
  expect(submitted.body).toMatchObject({state:'requested',live:false,activation:'provider_verification_required'});expect(submitted.body.requestedAt).toBeTruthy();
  const edit=await k.call(admin,'PUT',path(),{facilityId:k.tenant.facilityId,version:submitted.body.version,draft});expect(edit.body.state).toBe('draft');expect(edit.body.requestedAt).toBeNull();
  expect(await k.call(admin,'POST',`${path()}/submit`,input,key)).toEqual(submitted);
  const {rows:[events]}=await k.admin.query("SELECT count(*)::int n FROM platform.outbox_event WHERE tenant_id=$1 AND event_type='channel.setup_requested'",[k.tenant.tenantId]);expect(events.n).toBe(1);
 });
 it('supports WhatsApp ownership choices without claiming coexistence eligible or sending live',async()=>{
  const wa={channel:'whatsapp',numberStrategy:'business_app_coexistence',existingNumber:'+919876543212',languages:['en'],greeting:'Hello from the clinic.',humanHandoff:'on_request'};
  const r=await k.call(admin,'PUT',path('whatsapp'),{facilityId:k.tenant.facilityId,version:0,draft:wa});expect(r.status).toBe(200);expect(r.body).toMatchObject({live:false,state:'draft',draft:wa});
  expect((await k.call(admin,'PUT',path('whatsapp'),{facilityId:k.tenant.facilityId,version:1,draft:{...wa,existingNumber:null}})).status).toBe(400);
 });
 it('serializes simultaneous edit and submit against one reviewed version',async()=>{
  const read=await k.call(admin,'GET',`${path('whatsapp')}?facilityId=${k.tenant.facilityId}`);
  const input={facilityId:k.tenant.facilityId,version:read.body.version};
  const results=await Promise.all([
   k.call(admin,'PUT',path('whatsapp'),{...input,draft:{...read.body.draft,greeting:'An updated greeting.'}}),
   k.call(admin,'POST',`${path('whatsapp')}/submit`,input),
  ]);
  expect(results.map(r=>r.status).sort()).toEqual([200,409]);
  const latest=await k.call(admin,'GET',`${path('whatsapp')}?facilityId=${k.tenant.facilityId}`);
  expect(latest.body.version).toBe(input.version+1);
 });

});
