import { createHash } from 'node:crypto';
import { sql, type DB, type Kysely } from '@hms/db';
import { conflict, forbidden, notFound, preconditionFailed, runCommand, type CommandContext } from '@hms/platform';
import { TemplateProviderStatusResultSchema } from '@hms/contracts';
import { clock, type Caller } from '../../caller.ts';
import { assertWhatsAppActive, validateTemplateParameters } from './whatsapp.ts';
import { getMetaTemplate, type MetaTemplate } from './meta-template-client.ts';
import { resolveWhatsAppBinding, resolveWhatsAppAccessToken } from './whatsapp-provider-config.ts';
import { lockAccess } from '../access/staff.ts';
import { observeSubmission, type TemplateSubmissionRow } from './template-submissions.ts';

type Draft = { id:string; facility_id:string; name:string; body:string; language:string; category:string;
  parameter_count:number; header:string; version:number };
type Match = 'exact'|'different'|'missing'|'unsupported';

/** The editor currently represents a positional body only. Extra remote components cannot be approved implicitly. */
export function providerTemplateMatch(local: Draft, remote: MetaTemplate|null): Match {
  if (!remote) return 'missing';
  if (local.header !== 'none' || (remote.parameterFormat && remote.parameterFormat !== 'POSITIONAL') ||
    !['UTILITY','MARKETING'].includes(remote.category) || remote.components.length !== 1 ||
    remote.components[0]?.type !== 'BODY' || typeof remote.components[0]?.text !== 'string') return 'unsupported';
  try { validateTemplateParameters(remote.components[0].text, local.parameter_count); } catch { return 'different'; }
  return remote.name === local.name && remote.language === local.language &&
    remote.category.toLowerCase() === local.category && remote.components[0].text === local.body ? 'exact' : 'different';
}

async function authority(ctx: CommandContext, caller: Caller, facilityId: string) {
  const { rows: [allowed] } = await sql<{ ok:boolean }>`SELECT EXISTS(
    SELECT 1 FROM platform.staff_permission p JOIN platform.staff s ON s.id=p.staff_id
     WHERE p.staff_id=${ctx.actor.staffId ?? null} AND s.status='active' AND p.permission='comms.manage'
       AND (p.facility_id IS NULL OR p.facility_id=${facilityId})
       AND EXISTS(SELECT 1 FROM platform.user_account u WHERE u.id=${caller.actor.userId ?? null}
           AND u.staff_id=s.id AND u.status='active')) AS ok`.execute(ctx.tx);
  if (!allowed!.ok) throw forbidden('Current clinic messaging authority is required');
}

export async function checkTemplateProviderStatus(db:Kysely<DB>,caller:Caller,id:string,input:{facilityId:string;version:number},key:string,
  options:{fetcher?:typeof fetch} = {}) {
  return runCommand(db,{...caller,module:'comms',name:'comms.check_template_provider_status',request:{id,...input},idempotencyKey:key},async ctx => {
    await authority(ctx,caller,input.facilityId);
    await assertWhatsAppActive(ctx.tx);
    const { rows: [before] } = await sql<Draft>`SELECT * FROM comms.message_template WHERE id=${id} AND facility_id=${input.facilityId}`.execute(ctx.tx);
    if (!before) throw notFound('message template');
    if (before.version !== input.version) throw conflict('Template changed. Reload before checking Meta.',{reason:'stale_version'});
    const { rows: [account] } = await sql<{id:string;phone_number_id:string}>`SELECT id,phone_number_id FROM comms.channel_account WHERE facility_id=${input.facilityId}`.execute(ctx.tx);
    const binding = account ? resolveWhatsAppBinding(account.phone_number_id) : null;
    if (!account || binding?.mode !== 'multi_clinic' || binding.tenantId !== ctx.tenantId || binding.facilityId !== input.facilityId ||
      !resolveWhatsAppAccessToken(binding)) throw preconditionFailed('Connect this clinic’s verified WhatsApp account before checking Meta.',{reason:'provider_not_configured'});
    // The keyed command claims its receipt before the provider read, so lost-response retries
    // return the original observation without contacting Meta again. No template/account lock is held during fetch.
    const {rows:[revision]}=await sql<TemplateSubmissionRow>`SELECT * FROM comms.template_submission WHERE template_id=${id}
      ORDER BY (body=${before.body} AND language=${before.language} AND category=${before.category} AND parameter_count=${before.parameter_count}
        AND ${before.header}='none' AND state NOT IN('failed','cancelled')) DESC,created_at DESC,id DESC LIMIT 1`.execute(ctx.tx);
    if(revision&&(revision.account_id!==account.id||revision.business_account_id!==binding.businessAccountId||revision.phone_number_id!==binding.phoneNumberId||revision.access_token_env!==binding.accessTokenEnv))
      throw conflict('Submission belongs to an earlier provider binding. Review its original account.',{reason:'provider_binding_changed'});
    const remote = await getMetaTemplate(binding,revision?.provider_name ?? before.name,revision?.language ?? before.language,options);
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${ctx.tenantId}:account:${input.facilityId}`},0))`.execute(ctx.tx);
    const { rows: [currentAccount] } = await sql<{ id:string;phone_number_id:string }>`SELECT id,phone_number_id FROM comms.channel_account WHERE facility_id=${input.facilityId} FOR UPDATE`.execute(ctx.tx);
    const currentBinding = currentAccount ? resolveWhatsAppBinding(currentAccount.phone_number_id) : null;
    if (!currentAccount || currentAccount.id !== account.id || currentAccount.phone_number_id !== account.phone_number_id ||
      currentBinding?.tenantId !== binding.tenantId || currentBinding?.facilityId !== binding.facilityId ||
      currentBinding?.businessAccountId !== binding.businessAccountId || currentBinding?.accessTokenEnv !== binding.accessTokenEnv ||
      !resolveWhatsAppAccessToken(currentBinding)) throw conflict('Clinic provider binding changed. Reload before checking again.',{reason:'provider_binding_changed'});
    const { rows: [current] } = await sql<Draft>`SELECT * FROM comms.message_template WHERE id=${id} AND facility_id=${input.facilityId} FOR UPDATE`.execute(ctx.tx);
    if (!current || current.version !== input.version) throw conflict('Template changed while checking Meta. Reload.',{reason:'stale_version'});
    if(revision){
      const {rows:[locked]}=await sql<TemplateSubmissionRow>`SELECT * FROM comms.template_submission WHERE id=${revision.id} FOR UPDATE`.execute(ctx.tx);
      if(locked)await observeSubmission(ctx.tx,locked,remote);
    }
    // Account/template/submission locks precede access to match the dispatcher claim order.
    await lockAccess(ctx);
    await authority(ctx,caller,input.facilityId);
    await assertWhatsAppActive(ctx.tx);
    const match = providerTemplateMatch({...current,name:revision?.provider_name ?? current.name},remote);
    const approval = match === 'exact' ? ({APPROVED:'approved',PENDING:'pending',REJECTED:'rejected'} as Record<string,string>)[remote!.status] ?? 'not_synced' : 'not_synced';
    const { rows: [saved] } = await sql<{version:number}>`UPDATE comms.message_template SET provider_approval=${approval} WHERE id=${id} RETURNING version`.execute(ctx.tx);
    const checkedAt = clock(caller).toISOString();
    await sql`INSERT INTO comms.template_provider_check(tenant_id,facility_id,template_id,account_id,template_version,phone_number_id,business_account_id,
       provider_template_id,provider_status,content_match,body_sha256,checked_at,checked_by)
       VALUES(${ctx.tenantId},${input.facilityId},${id},${account.id},${saved!.version},${binding.phoneNumberId},${binding.businessAccountId},
       ${remote?.id ?? null},${remote?.status ?? null},${match},${createHash('sha256').update(current.body).digest('hex')},${checkedAt}::timestamptz,${ctx.actor.staffId!})`.execute(ctx.tx);
    ctx.audit({action:'update',subjectType:'comms.message_template',subjectId:id,diff:{providerStatus:remote?.status ?? null,match,version:saved!.version}});
    ctx.emit({eventType:'template.provider_status_checked',aggregateType:'comms.message_template',aggregateId:id,aggregateVersion:saved!.version,
      payload:{templateId:id,match,providerStatus:remote?.status ?? null}});
    return TemplateProviderStatusResultSchema.parse({templateId:id,version:saved!.version,providerStatus:remote?.status ?? null,match,checkedAt,providerTemplateId:remote?.id ?? null});
  });
}
