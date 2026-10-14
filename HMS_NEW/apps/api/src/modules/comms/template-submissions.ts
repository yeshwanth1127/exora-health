import { randomUUID } from 'node:crypto';
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, DomainError, forbidden, invalid, notFound, preconditionFailed, runCommand, runQuery, setTransactionContext, writeAudit, writeOutbox } from '@hms/platform';
import { TemplateSubmissionResultSchema } from '@hms/contracts';
import type { Caller } from '../../caller.ts';
import { assertWhatsAppActive } from './whatsapp.ts';
import { resolveWhatsAppBinding, resolveWhatsAppAccessToken, type WhatsAppBinding } from './whatsapp-provider-config.ts';
import { createMetaTemplate, validateMetaTemplateCreateInput } from './meta-template-create.ts';
import { getMetaTemplate, type MetaTemplate } from './meta-template-client.ts';
import { providerTemplateMatch } from './template-provider-status.ts';
import { templateContentHash, templateSubmissionDto } from './template-submission-shape.ts';
type Tx=Transaction<DB>;
export type TemplateSubmissionRow={id:string;tenant_id:string;facility_id:string;template_id:string;account_id:string;requested_by:string;requested_user_id:string;
 template_version:number;provider_name:string;body:string;language:string;category:'utility'|'marketing';parameter_count:number;samples:string[];
 content_sha256:string;phone_number_id:string;business_account_id:string;access_token_env:string;state:string;attempt_id:string|null;
 attempted_at:Date|null;provider_template_id:string|null;provider_status:string|null;version:number;created_at:Date;updated_at:Date;reason:string|null};
type Row=TemplateSubmissionRow;
export const templateSubmissionsEnabled=()=>process.env.WA_TEMPLATE_SUBMISSIONS_ENABLED==='true';
async function authority(tx:Tx,staff:string,user:string,facility:string) {
 const {rows:[r]}=await sql<{ok:boolean}>`SELECT EXISTS(SELECT 1 FROM platform.staff_permission p JOIN platform.staff s ON s.id=p.staff_id
 WHERE p.staff_id=${staff} AND s.status='active' AND p.permission='comms.manage' AND (p.facility_id IS NULL OR p.facility_id=${facility})
 AND EXISTS(SELECT 1 FROM platform.user_account u WHERE u.id=${user} AND u.staff_id=s.id AND u.status='active')
 AND EXISTS(SELECT 1 FROM platform.facility f WHERE f.id=${facility} AND f.status='active')) AS ok`.execute(tx);
 return !!r?.ok;
}
const accountLock=(tx:Tx,tenant:string,facility:string)=>sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenant}:account:${facility}`},0))`.execute(tx);
const accessLock=(tx:Tx,tenant:string)=>sql`SELECT pg_advisory_xact_lock(hashtextextended(${`access:${tenant}`},0))`.execute(tx);
async function bindingFor(tx:Tx,tenant:string,facility:string) {
 const {rows:[account]}=await sql<{id:string;phone_number_id:string}>`SELECT id,phone_number_id FROM comms.channel_account WHERE facility_id=${facility}`.execute(tx);
 const binding=account ? resolveWhatsAppBinding(account.phone_number_id) : null;
 if(!account||binding?.mode!=='multi_clinic'||binding.tenantId!==tenant||binding.facilityId!==facility||!resolveWhatsAppAccessToken(binding))return null;
 return {account,binding};
}
function matchesBinding(row:Row,b:WhatsAppBinding) {
 return b.mode==='multi_clinic'&&b.tenantId===row.tenant_id&&b.facilityId===row.facility_id&&b.phoneNumberId===row.phone_number_id&&
 b.businessAccountId===row.business_account_id&&b.accessTokenEnv===row.access_token_env&&!!resolveWhatsAppAccessToken(b);
}
export async function submitTemplate(db:Kysely<DB>,caller:Caller,id:string,input:{facilityId:string;version:number;samples:string[];fictionalExamples:true},key:string) {
 return runCommand(db,{...caller,module:'comms',name:'comms.submit_template',request:{id,...input},idempotencyKey:key},async ctx=>{
  if(!templateSubmissionsEnabled())throw preconditionFailed('Meta template submission is not enabled.',{reason:'template_submission_disabled'});
  await accountLock(ctx.tx,ctx.tenantId,input.facilityId);
  const connected=await bindingFor(ctx.tx,ctx.tenantId,input.facilityId);
  if(!connected)throw preconditionFailed('Connect this clinic’s verified WhatsApp account before submitting.',{reason:'provider_not_configured'});
  const {rows:[draft]}=await sql<any>`SELECT * FROM comms.message_template WHERE id=${id} AND facility_id=${input.facilityId} FOR UPDATE`.execute(ctx.tx);
  if(!draft)throw notFound('message template');
  if(draft.version!==input.version)throw conflict('Template changed. Reload before submitting.',{reason:'stale_version'});
  if(draft.header!=='none'||input.fictionalExamples!==true)throw invalid('Submission requires a body-only template and fictional examples.');
  const submissionId=randomUUID(),providerName=`hms_${submissionId.replaceAll('-','')}`;
  validateMetaTemplateCreateInput({name:providerName,body:draft.body,language:draft.language,category:draft.category,parameterCount:draft.parameter_count,samples:input.samples});
  await accessLock(ctx.tx,ctx.tenantId);
  if(!caller.actor.staffId||!caller.actor.userId||!await authority(ctx.tx,caller.actor.staffId,caller.actor.userId,input.facilityId))throw forbidden('Current clinic messaging authority is required');
  await assertWhatsAppActive(ctx.tx);
  const hash=templateContentHash(draft);
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${ctx.tenantId}:template-content:${connected.binding.businessAccountId}:${hash}`},0))`.execute(ctx.tx);
  const {rows:[existing]}=await sql<Row>`SELECT * FROM comms.template_submission WHERE business_account_id=${connected.binding.businessAccountId} AND content_sha256=${hash} AND state NOT IN('failed','cancelled') LIMIT 1`.execute(ctx.tx);
  if(existing)throw conflict('This content already has a Meta submission. Check its status before creating another.',{reason:'submission_exists'});
  const {rows:[saved]}=await sql<{version:number}>`UPDATE comms.message_template SET provider_approval='not_synced' WHERE id=${id} RETURNING version`.execute(ctx.tx);
  const {rows:[revision]}=await sql<Row>`INSERT INTO comms.template_submission(id,tenant_id,facility_id,template_id,account_id,requested_by,requested_user_id,
   template_version,provider_name,body,language,category,parameter_count,samples,content_sha256,phone_number_id,business_account_id,access_token_env)
   VALUES(${submissionId},${ctx.tenantId},${input.facilityId},${id},${connected.account.id},${caller.actor.staffId},${caller.actor.userId},${input.version},
   ${providerName},${draft.body},${draft.language},${draft.category},${draft.parameter_count},${JSON.stringify(input.samples)}::jsonb,${hash},
   ${connected.binding.phoneNumberId},${connected.binding.businessAccountId},${connected.binding.accessTokenEnv}) RETURNING *`.execute(ctx.tx);
  ctx.audit({action:'create',subjectType:'comms.template_submission',subjectId:submissionId,diff:{templateId:id,templateVersion:input.version,state:'queued'}});
  ctx.emit({eventType:'template.submission_queued',aggregateType:'comms.template_submission',aggregateId:submissionId,aggregateVersion:revision!.version,payload:{templateId:id}});
  return TemplateSubmissionResultSchema.parse({templateId:id,version:saved!.version,submission:templateSubmissionDto(revision!,draft)});
 });
}
export async function listTemplateSubmissions(db:Kysely<DB>,caller:Caller,id:string) {
 return runQuery(db,caller.tenantId,async tx=>{
  const {rows:[draft]}=await sql<any>`SELECT * FROM comms.message_template WHERE id=${id}`.execute(tx);
  if(!draft)throw notFound('message template');
  const {rows}=await sql<Row>`SELECT * FROM comms.template_submission WHERE template_id=${id} ORDER BY created_at DESC,id DESC LIMIT 100`.execute(tx);
  return {items:rows.map(row=>templateSubmissionDto(row,draft))};
 });
}
async function tenantTx<T>(db:Kysely<DB>,tenant:string,fn:(tx:Tx)=>Promise<T>) {
 return db.transaction().execute(async tx=>{await setTransactionContext(tx,tenant);await sql`SET LOCAL ROLE mod_comms`.execute(tx);return fn(tx);});
}
async function transition(tx:Tx,row:Row,state:string,reason:string|null,fields:{id?:string;status?:string;attempt?:string}={}) {
 const {rows:[saved]}=await sql<Row>`UPDATE comms.template_submission SET state=${state},reason=${reason},next_check_at=now()+interval '60 seconds',
 provider_template_id=coalesce(${fields.id??null},provider_template_id),provider_status=coalesce(${fields.status??null},provider_status),
 attempt_id=coalesce(${fields.attempt??null}::uuid,attempt_id),attempted_at=CASE WHEN ${fields.attempt??null}::uuid IS NOT NULL THEN now() ELSE attempted_at END
 WHERE id=${row.id} AND version=${row.version} RETURNING *`.execute(tx);
 if(!saved)throw conflict('Template submission changed');
 await writeAudit(tx,row.tenant_id,{kind:'staff',staffId:row.requested_by,userId:row.requested_user_id},null,[{action:'update',subjectType:'comms.template_submission',subjectId:row.id,diff:{state,reason}}]);
 await writeOutbox(tx,row.tenant_id,null,[{eventType:'template.submission_updated',aggregateType:'comms.template_submission',aggregateId:row.id,aggregateVersion:saved.version,payload:{state}}]);
 return saved;
}
/** Used by explicit status checks too. A missing provider read can never authorize a second POST. */
export async function observeSubmission(tx:Tx,row:Row,remote:MetaTemplate|null) {
 const match=providerTemplateMatch({id:row.template_id,facility_id:row.facility_id,name:row.provider_name,body:row.body,language:row.language,
 category:row.category,parameter_count:row.parameter_count,header:'none',version:row.template_version},remote);
 if(remote&&row.provider_template_id&&row.provider_template_id!==remote.id)throw conflict('Provider revision identity changed. Review the original submission.',{reason:'provider_revision_changed'});
 if(remote && match==='exact' && ['queued','dispatching','uncertain','conflict','submitted'].includes(row.state))
  return transition(tx,row,'submitted',null,{id:remote.id,status:remote.status});
 if(remote && match!=='exact' && ['queued','dispatching','uncertain'].includes(row.state))return transition(tx,row,'conflict','provider_content_conflict');
 if(!remote && row.state==='uncertain')return transition(tx,row,'uncertain','provider_result_not_found');
 return row;
}
/** At most one POST per immutable revision. All claims commit before external writes. */
export async function processTemplateSubmission(db:Kysely<DB>,tenant:string,id:string,options:{fetcher?:typeof fetch}={}) {
 if(!templateSubmissionsEnabled())return;
 let row=await tenantTx(db,tenant,async tx=>{
  const {rows:[r]}=await sql<Row>`SELECT * FROM comms.template_submission WHERE id=${id} FOR UPDATE`.execute(tx);
  if(r?.state==='dispatching'&&r.attempted_at&&Date.now()-r.attempted_at.getTime()>120_000)return transition(tx,r,'uncertain','worker_result_missing');
  return r;
 });
 if(!row||!['queued','uncertain'].includes(row.state))return;
 const binding=resolveWhatsAppBinding(row.phone_number_id);
 if(!binding||!matchesBinding(row,binding))return; // Never read another WABA to recover old evidence.
 let remote:MetaTemplate|null;
 try{remote=await getMetaTemplate(binding,row.provider_name,row.language,options);}catch{
  await tenantTx(db,tenant,async tx=>{const {rows:[current]}=await sql<Row>`SELECT * FROM comms.template_submission WHERE id=${id} FOR UPDATE`.execute(tx);
   if(current&&current.state===row!.state)await transition(tx,current,current.state,'provider_read_unavailable');});return;
 }
 if(remote||row.state==='uncertain') {
  await tenantTx(db,tenant,async tx=>{const {rows:[current]}=await sql<Row>`SELECT * FROM comms.template_submission WHERE id=${id} FOR UPDATE`.execute(tx);
   if(current&&['queued','uncertain'].includes(current.state))await observeSubmission(tx,current,remote);});return;
 }
 // Recheck the same snapshot/binding and original requester under current authority before committing the attempt.
 const claim=await tenantTx(db,tenant,async tx=>{
  await accountLock(tx,tenant,row!.facility_id);
  const connected=await bindingFor(tx,tenant,row!.facility_id);
  const {rows:[current]}=await sql<Row>`SELECT * FROM comms.template_submission WHERE id=${id} FOR UPDATE`.execute(tx);
  if(!current||current.state!=='queued')return null;
  if(!connected||connected.account.id!==current.account_id||!matchesBinding(current,connected.binding))return null;
  await accessLock(tx,tenant);
  if(!await authority(tx,current.requested_by,current.requested_user_id,current.facility_id))return transition(tx,current,'cancelled','requester_authority_withdrawn');
  try{await assertWhatsAppActive(tx);}catch{return transition(tx,current,'cancelled','module_inactive');}
  if(!templateSubmissionsEnabled())return null;
  return transition(tx,current,'dispatching',null,{attempt:randomUUID()});
 });
 if(!claim||claim.state!=='dispatching')return;
 row=claim;
 // Binding changes after claim cannot turn this attempt into another account's creation.
 const latest=resolveWhatsAppBinding(row.phone_number_id);
 if(!latest||!matchesBinding(row,latest)) {
  await tenantTx(db,tenant,tx=>transition(tx,row!,'uncertain','provider_binding_changed'));return;
 }
 let outcome:{id:string;status:string}|undefined,state='uncertain',reason:string|null='provider_result_unknown';
 try {
  outcome=await createMetaTemplate(latest,{name:row.provider_name,body:row.body,language:row.language,category:row.category,parameterCount:row.parameter_count,samples:row.samples},options);
  state='submitted';reason=null;
 } catch(error) {
  if(error instanceof DomainError&&error.code==='validation'){state='failed';reason='provider_validation_rejected';}
  // Duplicate responses need a read of this exact revision, not another creation request.
 }
 // Provider evidence is recorded even if the requester loses authority after the committed attempt.
 await tenantTx(db,tenant,async tx=>{const {rows:[current]}=await sql<Row>`SELECT * FROM comms.template_submission WHERE id=${id} FOR UPDATE`.execute(tx);
  if(current?.attempt_id===row!.attempt_id&&['dispatching','uncertain'].includes(current.state))
   await transition(tx,current,state,reason,outcome ? {id:outcome.id,status:outcome.status} : {});
 });
}
export async function dispatchTemplateSubmissions(db:Kysely<DB>) {
 if(!templateSubmissionsEnabled())return 0;
 const {rows}=await sql<{tenant_id:string;id:string}>`SELECT * FROM comms.due_template_submissions(10)`.execute(db);
 for(const r of rows)await processTemplateSubmission(db,r.tenant_id,r.id);
 return rows.length;
}
