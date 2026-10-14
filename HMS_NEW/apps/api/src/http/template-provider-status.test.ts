import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { TemplateProviderStatusResultSchema } from '@hms/contracts';
import { startKit,type Kit,type Person } from './test-kit.ts';
let k:Kit,other:Kit,admin:Person,second:Person,desk:Person,outsider:Person;
const original={...process.env},phone='199900000001',waba='199900000002';
let calls=0, response:(url:URL)=>Promise<Response>|Response;
const fetcher:typeof fetch=async (request,options)=>{
 calls++;const url=new URL(String(request));
 expect(url.origin).toBe('https://graph.facebook.com'); expect(options?.method).toBe('GET');
 expect((options?.headers as Record<string,string>).Authorization).toBe('Bearer test-only-template-clinic-token');
 return response(url);
};
const template=(url:URL,extra:Record<string,unknown>={})=>({id:'188800000001',name:url.searchParams.get('name'),language:'en',category:'UTILITY',status:'APPROVED',parameter_format:'POSITIONAL',components:[{type:'BODY',text:'Hello {{1}}'}],...extra});
const meta=(value:unknown)=>new Response(JSON.stringify({data:value}),{headers:{'content-type':'application/json'}});
beforeAll(async()=>{
 process.env.WA_CLINIC_BINDINGS_JSON='[]';
 k=await startKit('provider-status',undefined,fetcher);other=await startKit('other-provider-status');
 admin=await k.person('Admin','tenant_admin',null);second=await k.person('Second','tenant_admin',null);desk=await k.person('Desk','front_desk',k.tenant.facilityId);outsider=await other.person('Other','tenant_admin',null);
 Object.assign(process.env,{WA_APP_SECRET:'test-only-template-app-secret-more-than-32',WA_VERIFY_TOKEN:'test-template-verification',WA_GRAPH_VERSION:'v23.0',HMS_WA_TOKEN_TEMPLATE:'test-only-template-clinic-token'});
 process.env.WA_CLINIC_BINDINGS_JSON=JSON.stringify([{tenantId:k.tenant.tenantId,facilityId:k.tenant.facilityId,phoneNumberId:phone,businessAccountId:waba,accessTokenEnv:'HMS_WA_TOKEN_TEMPLATE'}]);
 expect((await k.call(admin,'PUT','/v1/comms/settings',{facilityId:k.tenant.facilityId,phoneNumberId:phone,version:0})).status).toBe(200);
 response=url=>meta([template(url)]);
});
afterAll(async()=>{await k.close();await other.close();for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);});
async function draft(){
 const input={facilityId:k.tenant.facilityId,name:'clinic_'+randomUUID().replaceAll('-',''),body:'Hello {{1}}',language:'en',category:'utility',parameterCount:1,header:'none'};
 const saved=await k.call(admin,'POST','/v1/message-templates',input);expect(saved.status).toBe(200);return {input,row:saved.body};
}
const check=(row:any,who=admin,key:string|boolean=true)=>k.call(who,'POST',`/v1/message-templates/${row.id}/provider-status`,{facilityId:k.tenant.facilityId,version:row.version},key);
const listed=async(id:string)=>(await k.call(admin,'GET',`/v1/message-templates?facilityId=${k.tenant.facilityId}`)).body.items.find((r:any)=>r.id===id);
const count=async(id:string)=>Number((await k.admin.query('SELECT count(*) n FROM comms.template_provider_check WHERE template_id=$1',[id])).rows[0].n);

describe('versioned Meta template status observations',()=>{
 it('requires configured clinic credentials, keys and exact clinic authority before provider reads',async()=>{
  const {row}=await draft(),before=calls;
  expect((await check(row,admin,false)).status).toBe(400);expect((await check(row,desk)).status).toBe(403);
  expect((await other.call(outsider,'POST',`/v1/message-templates/${row.id}/provider-status`,{facilityId:k.tenant.facilityId,version:row.version})).status).toBe(404);
  expect((await k.call(admin,'POST',`/v1/message-templates/${row.id}/provider-status`,{facilityId:k.tenant.facilityId,version:row.version,actor:admin.staffId})).status).toBe(400);
  const token=process.env.HMS_WA_TOKEN_TEMPLATE;delete process.env.HMS_WA_TOKEN_TEMPLATE;
  try{expect((await check(row)).status).toBe(422);expect((await k.call(admin,'GET',`/v1/comms/settings?facilityId=${k.tenant.facilityId}`)).body.templateStatusAvailable).toBe(false);}finally{process.env.HMS_WA_TOKEN_TEMPLATE=token;}
  expect(calls).toBe(before);expect(await count(row.id)).toBe(0);
 });
 it('persists exact content approval, attributed evidence and original receipt without another provider request',async()=>{
  const {row}=await draft(),key=randomUUID(),before=calls;
  response=url=>meta([template(url)]);
  const saved=await check(row,admin,key);expect(saved.status).toBe(200);
  expect(TemplateProviderStatusResultSchema.parse(saved.body)).toMatchObject({templateId:row.id,version:row.version+1,providerStatus:'APPROVED',match:'exact',providerTemplateId:'188800000001'});
  response=()=>new Response('provider credential must not be exposed',{status:401});
  expect(await check(row,admin,key)).toEqual(saved);expect((await check(row,second,key)).status).toBe(409);expect(calls).toBe(before+1);
  const read=await listed(row.id);expect(read).toMatchObject({providerApproval:'approved',simulationOnly:true,providerStatusCheck:{status:'APPROVED',match:'exact',localVersion:saved.body.version}});
  const evidence=(await k.admin.query('SELECT checked_by,phone_number_id,business_account_id,template_version FROM comms.template_provider_check WHERE template_id=$1',[row.id])).rows;
  expect(evidence).toEqual([{checked_by:admin.staffId,phone_number_id:phone,business_account_id:waba,template_version:saved.body.version}]);
  expect(JSON.stringify(read)).not.toContain('test-only-template-clinic-token');
 });
 it('keeps old provider observation visibly stale after an edit and recovers its old receipt',async()=>{
  const {input,row}=await draft(),key=randomUUID();response=url=>meta([template(url)]);
  const observed=await check(row,admin,key);expect(observed.status).toBe(200);
  const edited=await k.call(admin,'PATCH',`/v1/message-templates/${row.id}`,{...input,version:observed.body.version,body:'Good morning {{1}}'});expect(edited.status).toBe(200);
  const read=await listed(row.id);expect(read.providerApproval).toBe('not_synced');expect(read.providerStatusCheck.localVersion).toBeLessThan(read.version);
  const before=calls;expect(await check(row,admin,key)).toEqual(observed);expect(calls).toBe(before);expect(await count(row.id)).toBe(1);
 });
 it('does not approve missing, changed, named, header/footer, unknown or paused provider versions',async()=>{
  const scenarios:[Record<string,unknown>|null,string,string][]=[
   [null,'missing','not_synced'],[{components:[{type:'BODY',text:'Another {{1}}'}]},'different','not_synced'],
   [{parameter_format:'NAMED'},'unsupported','not_synced'],[{components:[{type:'HEADER',format:'IMAGE'},{type:'BODY',text:'Hello {{1}}'}]},'unsupported','not_synced'],
   [{components:[{type:'BODY',text:'Hello {{1}}'},{type:'FOOTER',text:'Extra content'}]},'unsupported','not_synced'],
   [{status:'NEW_PROVIDER_STATUS'},'exact','not_synced'],[{status:'PAUSED'},'exact','not_synced'],[{status:'PENDING'},'exact','pending'],[{status:'REJECTED'},'exact','rejected'],
  ];
  for(const [extra,match,approval] of scenarios){const {row}=await draft();response=url=>meta(extra?[template(url,extra)]:[]);const result=await check(row);expect(result.status).toBe(200);expect(result.body.match).toBe(match);expect((await listed(row.id)).providerApproval).toBe(approval);}
 });
 it('preserves the previous observation on provider failure without recording fabricated status',async()=>{
  const {row}=await draft();response=url=>meta([template(url)]);const result=await check(row);expect(result.status).toBe(200);
  response=()=>new Response('secret-provider-error-content',{status:500});
  const failed=await check({...row,version:result.body.version});expect(failed.status).toBe(422);expect(JSON.stringify(failed.body)).not.toContain('secret-provider-error-content');expect(await count(row.id)).toBe(1);expect((await listed(row.id)).version).toBe(result.body.version);
 });
 it('refuses an edit that races the provider read and leaves no stale approval evidence',async()=>{
  const {input,row}=await draft();let enter!:()=>void,release!:()=>void;
  const entered=new Promise<void>(resolve=>enter=resolve),gate=new Promise<void>(resolve=>release=resolve);
  response=async url=>{enter();await gate;return meta([template(url)]);};
  const pending=check(row);await entered;
  try{expect((await k.call(second,'PATCH',`/v1/message-templates/${row.id}`,{...input,version:row.version,body:'Edited {{1}}'})).status).toBe(200);}finally{release();}
  expect((await pending).status).toBe(409);expect(await count(row.id)).toBe(0);expect((await listed(row.id)).providerApproval).toBe('not_synced');
 });
 it('refuses changed WABA binding and withdrawn authority while a read is in flight',async()=>{
  for(const mode of ['binding','authority']){
   const {row}=await draft();let enter!:()=>void,release!:()=>void;
   const entered=new Promise<void>(resolve=>enter=resolve),gate=new Promise<void>(resolve=>release=resolve);
   response=async url=>{enter();await gate;return meta([template(url)]);};
   const pending=check(row,second);await entered;const bindings=process.env.WA_CLINIC_BINDINGS_JSON!;
   try{
    if(mode==='binding'){const changed=JSON.parse(bindings);changed[0].businessAccountId='199900000003';process.env.WA_CLINIC_BINDINGS_JSON=JSON.stringify(changed);}
    else await k.admin.query('DELETE FROM platform.role_grant WHERE tenant_id=$1 AND staff_id=$2',[k.tenant.tenantId,second.staffId]);
    release();expect((await pending).status).toBe(mode==='binding'?409:403);expect(await count(row.id)).toBe(0);
   }finally{process.env.WA_CLINIC_BINDINGS_JSON=bindings;release();}
  }
 });
});
