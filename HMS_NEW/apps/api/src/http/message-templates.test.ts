import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startKit, type Kit, type Person } from './test-kit.ts';
let k:Kit, admin:Person, second:Person, wrong:Person;
const create = (body='Hello {{1}}') => ({facilityId:k.tenant.facilityId,name:`template-${randomUUID().slice(0,8)}`,body,language:'en',category:'marketing',parameterCount:1,header:'none'});
beforeAll(async()=>{
  k=await startKit('template-edit'); admin=await k.person('Template admin','tenant_admin',null); second=await k.person('Second admin','tenant_admin',null);
  const clinic=(await k.admin.query<{id:string}>(`INSERT INTO platform.facility(tenant_id,organization_id,code,name,facility_type,state_code) VALUES($1,$2,'OTHER','Other clinic','clinic','29') RETURNING id`,[k.tenant.tenantId,k.tenant.organizationId])).rows[0]!.id;
  wrong=await k.person('Other clinic staff','tenant_admin',clinic);
});
afterAll(async()=>{await k.close();});
async function newTemplate(){const body=create(), res=await k.call(admin,'POST','/v1/message-templates',body,true);expect(res.status).toBe(200);return {body,saved:res.body};}
async function campaign(templateId:string,status='draft',approved=false){return (await k.admin.query<{id:string}>(`INSERT INTO comms.campaign(tenant_id,facility_id,title,template_id,parameters,scheduled_at,rate_minor,budget_minor,status,local_tested,approval_hash,approved_by) VALUES($1,$2,'Template campaign',$3,'["Name"]','2035-01-01',100,10000,$4,true,$5,$6) RETURNING id`,[k.tenant.tenantId,k.tenant.facilityId,templateId,status,approved?'approved-snapshot':null,approved?admin.staffId:null])).rows[0]!.id;}

describe('dashboard message template editing',()=>{
  it('edits a draft, resets provider approval, and recovers a discarded committed response without another version or audit',async()=>{
    const {body,saved}=await newTemplate();
    await k.admin.query(`UPDATE comms.message_template SET provider_approval='approved' WHERE id=$1`,[saved.id]);
    const initial=(await k.call(admin,'GET',`/v1/message-templates?facilityId=${k.tenant.facilityId}`)).body.items.find((t:any)=>t.id===saved.id);
    const change={...body,body:'Good morning {{1}}',version:initial.version}, key=randomUUID();
    const first=await k.call(admin,'PATCH',`/v1/message-templates/${saved.id}`,change,key);
    expect(first.status).toBe(200);expect(first.body).toMatchObject({body:change.body,providerApproval:'not_synced',simulationOnly:true,editable:true,version:initial.version+1});
    expect(await k.call(admin,'PATCH',`/v1/message-templates/${saved.id}`,change,key)).toEqual(first);
    expect((await k.call(second,'PATCH',`/v1/message-templates/${saved.id}`,change,key)).status).toBe(409);
    const audits=await k.admin.query<{count:string}>(`SELECT count(*) FROM platform.audit_event WHERE tenant_id=$1 AND subject_id=$2 AND action='update'`,[k.tenant.tenantId,saved.id]);expect(Number(audits.rows[0]!.count)).toBe(1);
  });
  it('serializes two edits with the same reviewed version',async()=>{
    const {body,saved}=await newTemplate();
    const results=await Promise.all([k.call(admin,'PATCH',`/v1/message-templates/${saved.id}`,{...body,version:saved.version,body:'First {{1}}'},true),k.call(second,'PATCH',`/v1/message-templates/${saved.id}`,{...body,version:saved.version,body:'Second {{1}}'},true)]);
    expect(results.map(r=>r.status).sort()).toEqual([200,409]);
  });
  it('blocks changes to scheduled and approved/paused campaign content',async()=>{
    for(const [status,approved] of [['scheduled',false],['paused',true]] as const){
      const {body,saved}=await newTemplate();await campaign(saved.id,status,approved);
      expect((await k.call(admin,'PATCH',`/v1/message-templates/${saved.id}`,{...body,version:saved.version,body:'Changed {{1}}'},true)).status).toBe(409);
      const listed=(await k.call(admin,'GET',`/v1/message-templates?facilityId=${k.tenant.facilityId}`)).body.items.find((t:any)=>t.id===saved.id);expect(listed.editable).toBe(false);
    }
  });
  it('invalidates prior tests and campaign review versions when an unapproved draft changes',async()=>{
    const {body,saved}=await newTemplate();const id=await campaign(saved.id);
    const first=await k.call(admin,'PATCH',`/v1/message-templates/${saved.id}`,{...body,version:saved.version,body:'Updated {{1}}'},true);expect(first.status).toBe(200);
    const c=(await k.admin.query<{local_tested:boolean;version:number}>(`SELECT local_tested,version FROM comms.campaign WHERE id=$1`,[id])).rows[0]!;expect(c).toEqual({local_tested:false,version:2});
    expect((await k.call(admin,'PATCH',`/v1/message-templates/${saved.id}`,{...body,version:first.body.version,body:'Plain body',parameterCount:0},true)).status).toBe(409);
  });
  it('rejects malformed named, zero, padded or skipped placeholders and accepts repeated valid numbered parameters',async()=>{
    for(const body of ['Hello {{name}}','Hello {{0}}','Hello {{01}}','Hello {{2}}','Hello {{1}','Hello {{{1}}}'])expect((await k.call(admin,'POST','/v1/message-templates',create(body),true)).status).toBe(400);
    expect((await k.call(admin,'POST','/v1/message-templates',create('Hello {{1}}, thanks {{1}}'),true)).status).toBe(200);
    const {body,saved}=await newTemplate();expect((await k.call(admin,'PATCH',`/v1/message-templates/${saved.id}`,{...body,version:saved.version,body:'Hello {{patient}}'},true)).status).toBe(400);
  });
  it('serializes template edits against campaign approval so reviewed content cannot change',async()=>{
    const {body,saved}=await newTemplate(), id=await campaign(saved.id);
    const preview=(await k.call(admin,'GET',`/v1/campaigns/${id}/preview`)).body;
    const [edited,approved]=await Promise.all([
      k.call(admin,'PATCH',`/v1/message-templates/${saved.id}`,{...body,version:saved.version,body:'New content {{1}}'},true),
      k.call(second,'POST',`/v1/campaigns/${id}/approve`,{version:preview.version,audienceHash:preview.audienceHash,expectedCount:preview.recipients,testReceived:true},true),
    ]);
    if(approved.status===200){
      expect(edited.status).toBe(409);
      const persisted=(await k.admin.query<{body:string}>(`SELECT body FROM comms.message_template WHERE id=$1`,[saved.id])).rows[0]!;
      expect(persisted.body).toBe(body.body);
    }else{
      expect(edited.status).toBe(200);expect([409,422]).toContain(approved.status);
    }
  });
  it('reports duplicate draft names as known conflicts without creating a second template',async()=>{
    const {body}=await newTemplate();
    const duplicate=await k.call(admin,'POST','/v1/message-templates',body,true);
    expect(duplicate.status).toBe(409);expect(duplicate.body.error.details.reason).toBe('duplicate_template');
    const count=(await k.admin.query<{count:string}>(`SELECT count(*) FROM comms.message_template WHERE tenant_id=$1 AND facility_id=$2 AND name=$3 AND language=$4`,[k.tenant.tenantId,k.tenant.facilityId,body.name,body.language])).rows[0]!.count;
    expect(Number(count)).toBe(1);
  });
  it('enforces keys, exact clinic permissions and tenant isolation',async()=>{
    const {body,saved}=await newTemplate(),edit={...body,version:saved.version};
    expect((await k.call(admin,'PATCH',`/v1/message-templates/${saved.id}`,edit,false)).status).toBe(400);
    expect((await k.call(wrong,'PATCH',`/v1/message-templates/${saved.id}`,edit,true)).status).toBe(403);
    const other=await startKit('other-template-tenant');try{const who=await other.person('Other admin','tenant_admin',null);expect((await other.call(who,'PATCH',`/v1/message-templates/${saved.id}`,edit,true)).status).toBe(404);}finally{await other.close();}
  });
});
