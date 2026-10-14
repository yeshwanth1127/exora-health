import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {startKit,type Kit,type Person} from './test-kit.ts';
import {processTemplateSubmission, dispatchTemplateSubmissions} from '../modules/comms/template-submissions.ts';
let k:Kit,other:Kit,admin:Person,desk:Person,outsider:Person;
const original={...process.env},phone='277700000001',waba='277700000002';
let posts=0,remote:Record<string,any>|null=null,mode='success';
const fetcher:typeof fetch=async(request,options)=>{
 const url=new URL(String(request));
 expect(url.origin).toBe('https://graph.facebook.com');
 if(options?.method==='GET')return new Response(JSON.stringify({data:remote?[remote]:[]}));
 expect(options?.method).toBe('POST');posts++;
 const payload=JSON.parse(String(options?.body));
 remote={...payload,id:'188800000001',status:'PENDING'};
 if(mode==='unknown')throw new Error('private-provider-error');
 if(mode==='reject')return new Response(JSON.stringify({error:{type:'OAuthException',code:100,message:'private validation'}}),{status:400});
 return new Response(JSON.stringify({id:remote!.id,status:remote!.status,category:remote!.category}));
};
beforeAll(async()=>{
 process.env.WA_CLINIC_BINDINGS_JSON='[]';
 k=await startKit('template-submit',undefined,fetcher);other=await startKit('template-submit-other');
 admin=await k.person('Admin','tenant_admin',null);desk=await k.person('Desk','front_desk',k.tenant.facilityId);outsider=await other.person('Other','tenant_admin',null);
 Object.assign(process.env,{WA_APP_SECRET:'test-only-submit-app-secret-more-than32',WA_VERIFY_TOKEN:'test-submit-verification',WA_GRAPH_VERSION:'v23.0',HMS_WA_TOKEN_SUBMIT:'test-only-template-submit-token',WA_TEMPLATE_SUBMISSIONS_ENABLED:'true'});
 process.env.WA_CLINIC_BINDINGS_JSON=JSON.stringify([{tenantId:k.tenant.tenantId,facilityId:k.tenant.facilityId,phoneNumberId:phone,businessAccountId:waba,accessTokenEnv:'HMS_WA_TOKEN_SUBMIT'}]);
 expect((await k.call(admin,'PUT','/v1/comms/settings',{facilityId:k.tenant.facilityId,phoneNumberId:phone,version:0})).status).toBe(200);
});
afterAll(async()=>{await k.close();await other.close();for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);});
async function draft(body=`Welcome ${randomUUID()} {{1}}`){
 const input={facilityId:k.tenant.facilityId,name:'local_'+randomUUID().replaceAll('-',''),body,language:'en',category:'utility',parameterCount:1,header:'none'};
 const result=await k.call(admin,'POST','/v1/message-templates',input);expect(result.status).toBe(200);return {input,row:result.body};
}
const submit=(row:any,who=admin,key:string|boolean=true,samples=['Fictional person'])=>k.call(who,'POST',`/v1/message-templates/${row.id}/submissions`,{facilityId:k.tenant.facilityId,version:row.version,samples,fictionalExamples:true},key);
const history=async(id:string)=>(await k.call(admin,'GET',`/v1/message-templates/${id}/submissions`)).body.items;
const dispatchRevision=(id:string)=>processTemplateSubmission(k.db,k.tenant.tenantId,id,{fetcher});
describe('durable WhatsApp template creation revisions',()=>{
 it('requires exact authority, keys, enabled provider and validated fictional examples without provider traffic',async()=>{
  const {row}=await draft();expect((await submit(row,admin,false)).status).toBe(400);expect((await submit(row,desk)).status).toBe(403);
  expect((await other.call(outsider,'POST',`/v1/message-templates/${row.id}/submissions`,{facilityId:k.tenant.facilityId,version:row.version,samples:['Example'],fictionalExamples:true})).status).toBe(404);
  expect((await submit(row,admin,true,[])).status).toBe(400);
  process.env.WA_TEMPLATE_SUBMISSIONS_ENABLED='false';try{expect((await submit(row)).status).toBe(422);}finally{process.env.WA_TEMPLATE_SUBMISSIONS_ENABLED='true';}
  expect(await history(row.id)).toEqual([]);expect(posts).toBe(0);
 });
 it('freezes an immutable snapshot, original receipt and blocks new keys/aliases/examples from duplicate creation',async()=>{
  const {row,input}=await draft(),key=randomUUID();const saved=await submit(row,admin,key);
  expect(saved.status).toBe(200);
  expect(saved.body).toMatchObject({templateId:row.id,version:row.version+1,submission:{state:'queued',templateVersion:row.version,currentDraftMatches:true,body:input.body}});
  expect(saved.body.submission.providerName).toMatch(/^hms_[0-9a-f]{32}$/);
  expect(await submit(row,admin,key)).toEqual(saved);
  expect((await submit({...row,version:saved.body.version})).status).toBe(409);
  const alias=await draft(input.body);expect((await submit(alias.row,admin,true,['Different fictional sample'])).status).toBe(409);
  await expect(k.admin.query('UPDATE comms.template_submission SET body=$1 WHERE id=$2',['changed',saved.body.submission.id])).rejects.toThrow('immutable');
  const edited=await k.call(admin,'PATCH',`/v1/message-templates/${row.id}`,{...input,version:saved.body.version,body:'New revision {{1}}'});expect(edited.status).toBe(200);
  expect((await history(row.id))[0]).toMatchObject({body:input.body,currentDraftMatches:false});expect(await submit(row,admin,key)).toEqual(saved);
 });
 it('commits one attempt before POST, handles competing workers, and status checks use the captured provider name',async()=>{
  remote=null;mode='success';const {row}=await draft(),saved=await submit(row);expect(saved.status).toBe(200);const before=posts;
  await Promise.all([dispatchRevision(saved.body.submission.id),dispatchRevision(saved.body.submission.id)]);expect(posts).toBe(before+1);
  expect((await history(row.id))[0]).toMatchObject({state:'submitted',providerTemplateId:'188800000001',providerStatus:'PENDING'});
  expect(remote!.name).toBe(saved.body.submission.providerName);
  const checked=await k.call(admin,'POST',`/v1/message-templates/${row.id}/provider-status`,{facilityId:k.tenant.facilityId,version:saved.body.version});
  expect(checked.status).toBe(200);expect(checked.body).toMatchObject({match:'exact',providerStatus:'PENDING'});
  await dispatchRevision(saved.body.submission.id);expect(posts).toBe(before+1);
 });
 it('lost creation response stays uncertain, missing lookups never repost, exact readback reconciles',async()=>{
  remote=null;mode='unknown';const {row}=await draft(),saved=await submit(row),before=posts;
  await dispatchRevision(saved.body.submission.id);expect(posts).toBe(before+1);expect((await history(row.id))[0]).toMatchObject({state:'uncertain',reason:'provider_result_unknown'});
  const captured=remote;remote=null;await dispatchRevision(saved.body.submission.id);expect(posts).toBe(before+1);expect((await history(row.id))[0].state).toBe('uncertain');
  expect((await submit({...row,version:saved.body.version})).status).toBe(409);
  remote=captured;await dispatchRevision(saved.body.submission.id);expect(posts).toBe(before+1);expect((await history(row.id))[0].state).toBe('submitted');
 });
 it('a committed attempt abandoned by its worker can only reconcile, never requeue or create again',async()=>{
  remote=null;mode='success';const {row}=await draft(),saved=await submit(row),before=posts;
  await k.admin.query("UPDATE comms.template_submission SET state='dispatching',attempt_id=$1,attempted_at=now()-interval '5 minutes' WHERE id=$2",[randomUUID(),saved.body.submission.id]);
  await dispatchRevision(saved.body.submission.id);expect(posts).toBe(before);expect((await history(row.id))[0].state).toBe('uncertain');
  await expect(k.admin.query("UPDATE comms.template_submission SET state='queued' WHERE id=$1",[saved.body.submission.id])).rejects.toThrow('requeued');
 });
 it('known provider validation failure permits a new reviewed revision, while suspended modules prevent dispatch',async()=>{
  remote=null;mode='reject';const {row}=await draft(),saved=await submit(row);await dispatchRevision(saved.body.submission.id);
  expect((await history(row.id))[0]).toMatchObject({state:'failed',reason:'provider_validation_rejected'});
  remote=null;const again=await submit({...row,version:saved.body.version});expect(again.status).toBe(200);const before=posts;
  const module=(await k.call(admin,'GET','/v1/modules')).body.items.find((m:any)=>m.module==='comms'||m.moduleCode==='comms'||m.code==='comms');
  expect((await k.call(admin,'PUT','/v1/modules/comms',{state:'suspended',version:module?.version??0,reason:'Synthetic template suspension test'})).status).toBe(200);
  await dispatchRevision(again.body.submission.id);expect(posts).toBe(before);expect((await history(row.id))[0].state).toBe('cancelled');
  expect((await k.call(admin,'PUT','/v1/modules/comms',{state:'active',version:(module?.version??0)+1,reason:'Synthetic template test complete'})).status).toBe(200);
 });
 it('rechecks original requester authority before creating and pins account history against number replacement',async()=>{
  remote=null;mode='success';const second=await k.person('Temporary manager','tenant_admin',null),{row}=await draft(),saved=await submit(row,second),before=posts;
  expect(saved.status).toBe(200);await k.admin.query('DELETE FROM platform.role_grant WHERE staff_id=$1',[second.staffId]);
  await dispatchRevision(saved.body.submission.id);expect(posts).toBe(before);expect((await history(row.id))[0]).toMatchObject({state:'cancelled',reason:'requester_authority_withdrawn'});
  const old=process.env.WA_CLINIC_BINDINGS_JSON!;const changed=JSON.parse(old);changed[0].phoneNumberId='177700000003';process.env.WA_CLINIC_BINDINGS_JSON=JSON.stringify(changed);
  const settings=(await k.call(admin,'GET',`/v1/comms/settings?facilityId=${k.tenant.facilityId}`)).body;
  try{expect((await k.call(admin,'PUT','/v1/comms/settings',{facilityId:k.tenant.facilityId,phoneNumberId:changed[0].phoneNumberId,version:settings.version})).status).toBe(409);}finally{process.env.WA_CLINIC_BINDINGS_JSON=old;}
 });
 it('can read back an earlier provider revision without approving an edited draft or recreating its template',async()=>{
  remote=null;mode='success';const {row,input}=await draft(),saved=await submit(row);await dispatchRevision(saved.body.submission.id);
  const edited=await k.call(admin,'PATCH',`/v1/message-templates/${row.id}`,{...input,version:saved.body.version,body:'A newer changed message {{1}}'});expect(edited.status).toBe(200);
  remote!.status='APPROVED';const checked=await k.call(admin,'POST',`/v1/message-templates/${row.id}/provider-status`,{facilityId:k.tenant.facilityId,version:edited.body.version});
  expect(checked.status).toBe(200);expect(checked.body.match).toBe('different');
  const current=(await k.call(admin,'GET',`/v1/message-templates?facilityId=${k.tenant.facilityId}`)).body.items.find((r:any)=>r.id===row.id);
  expect(current.providerApproval).toBe('not_synced');expect(current.submission.currentDraftMatches).toBe(false);
 });
 it('due-work enumeration is bounded and a switched WABA cannot receive an old revision POST',async()=>{
  remote=null;mode='success';const {row}=await draft(),saved=await submit(row),before=posts,old=process.env.WA_CLINIC_BINDINGS_JSON!;
  const changed=JSON.parse(old);changed[0].businessAccountId='177700000004';process.env.WA_CLINIC_BINDINGS_JSON=JSON.stringify(changed);
  try{await dispatchTemplateSubmissions(k.db);expect(posts).toBe(before);expect((await history(row.id))[0].state).toBe('queued');}
  finally{process.env.WA_CLINIC_BINDINGS_JSON=old;}
  expect(saved.body.submission.state).toBe('queued');
 });
 it('returning to earlier content reuses its immutable provider revision rather than requiring a duplicate',async()=>{
  remote=null;mode='success';const {row,input}=await draft(),first=await submit(row);await dispatchRevision(first.body.submission.id);
  const firstRemote=remote;
  const edited=await k.call(admin,'PATCH',`/v1/message-templates/${row.id}`,{...input,version:first.body.version,body:`Second ${randomUUID()} {{1}}`});expect(edited.status).toBe(200);
  const second=await submit(edited.body);expect(second.status).toBe(200);
  const restored=await k.call(admin,'PATCH',`/v1/message-templates/${row.id}`,{...input,version:second.body.version});expect(restored.status).toBe(200);
  const listed=(await k.call(admin,'GET',`/v1/message-templates?facilityId=${k.tenant.facilityId}`)).body.items.find((r:any)=>r.id===row.id);
  expect(listed.submission.id).toBe(first.body.submission.id);expect(listed.submission.currentDraftMatches).toBe(true);
  remote=firstRemote;remote!.status='APPROVED';const before=posts;
  const checked=await k.call(admin,'POST',`/v1/message-templates/${row.id}/provider-status`,{facilityId:k.tenant.facilityId,version:restored.body.version});
  expect(checked.status).toBe(200);expect(checked.body).toMatchObject({match:'exact',providerStatus:'APPROVED'});expect(posts).toBe(before);
 });
});
