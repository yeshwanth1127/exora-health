import { sql, type DB, type Kysely } from '@hms/db';
import { runQuery, runCommand, notFound, conflict } from '@hms/platform';
import { ChannelOnboardingSchema, type ChannelOnboardingDraft } from '@hms/contracts';
import { clock, type Caller } from '../../caller.ts';
import { assertWhatsAppActive } from './whatsapp.ts';
type Channel = 'voice' | 'whatsapp';
type Row = { id:string; state:'draft'|'requested'; draft:unknown; version:number; requested_at:Date|null; updated_at:Date; updated_by:string|null };
const iso = (v:Date|null|undefined) => v ? new Date(v).toISOString() : null;
function dto(facilityId:string, channel:Channel, row?:Row) {
  return ChannelOnboardingSchema.parse({ facilityId, channel, management:'company_managed', state:row?.state ?? 'not_started', version:row?.version ?? 0, draft:row?.draft ?? null,
    requestedAt:iso(row?.requested_at), updatedAt:iso(row?.updated_at), updatedByStaffId:row?.updated_by ?? null, live:false, activation:'provider_verification_required' });
}
export async function channelOnboarding(db:Kysely<DB>, caller:Caller, facilityId:string, channel:Channel) {
  return runQuery(db,caller.tenantId,async tx => {
    if (!await tx.selectFrom('platform.facility').select('id').where('id','=',facilityId).executeTakeFirst()) throw notFound('clinic');
    const {rows:[r]} = await sql<Row>`SELECT * FROM comms.channel_onboarding WHERE facility_id=${facilityId} AND channel=${channel}`.execute(tx);
    return dto(facilityId,channel,r);
  });
}
export async function saveChannelOnboarding(db:Kysely<DB>, caller:Caller, input:{facilityId:string;version:number;draft:ChannelOnboardingDraft}, key:string) {
  return runCommand(db,{...caller,module:'comms',name:'comms.channel_onboarding_save',request:input,idempotencyKey:key},async ctx => {
    await assertWhatsAppActive(ctx.tx);
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.tenantId+':onboarding:'+input.facilityId+':'+input.draft.channel},0))`.execute(ctx.tx);
    if (!await ctx.tx.selectFrom('platform.facility').select('id').where('id','=',input.facilityId).executeTakeFirst()) throw notFound('clinic');
    const {rows:[previous]} = await sql<Row>`SELECT * FROM comms.channel_onboarding WHERE facility_id=${input.facilityId} AND channel=${input.draft.channel}`.execute(ctx.tx);
    if ((previous?.version ?? 0)!==input.version) throw conflict('Channel setup changed. Reload before editing.',{reason:'stale_version'});
    const {rows:[r]} = await sql<Row>`INSERT INTO comms.channel_onboarding(tenant_id,facility_id,channel,state,draft,created_by,updated_by)
      VALUES(${ctx.tenantId},${input.facilityId},${input.draft.channel},'draft',${JSON.stringify(input.draft)}::jsonb,${ctx.actor.staffId},${ctx.actor.staffId})
      ON CONFLICT(tenant_id,facility_id,channel) DO UPDATE SET draft=EXCLUDED.draft,state='draft',requested_at=NULL,updated_by=EXCLUDED.updated_by RETURNING *`.execute(ctx.tx);
    ctx.audit({action:previous?'update':'create',subjectType:'comms.channel_onboarding',subjectId:r!.id,diff:{channel:input.draft.channel,state:'draft'}});
    return dto(input.facilityId,input.draft.channel,r);
  });
}
export async function submitChannelOnboarding(db:Kysely<DB>, caller:Caller, facilityId:string, channel:Channel, version:number, key:string) {
  return runCommand(db,{...caller,module:'comms',name:'comms.channel_onboarding_submit',request:{facilityId,channel,version},idempotencyKey:key},async ctx => {
    await assertWhatsAppActive(ctx.tx);
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.tenantId+':onboarding:'+facilityId+':'+channel},0))`.execute(ctx.tx);
    const {rows:[r]} = await sql<Row>`SELECT * FROM comms.channel_onboarding WHERE facility_id=${facilityId} AND channel=${channel} FOR UPDATE`.execute(ctx.tx);
    if (!r) throw notFound('channel setup');
    if(r.version!==version) throw conflict('Channel setup changed. Reload before submitting.',{reason:'stale_version'});
    if(r.state!=='draft') throw conflict('This setup request was already submitted');
    const {rows:[saved]}=await sql<Row>`UPDATE comms.channel_onboarding SET state='requested',requested_at=${clock(caller)},updated_by=${ctx.actor.staffId} WHERE id=${r.id} RETURNING *`.execute(ctx.tx);
    ctx.audit({action:'update',subjectType:'comms.channel_onboarding',subjectId:r.id,diff:{channel,state:'requested'}});
    ctx.emit({eventType:'channel.setup_requested',aggregateType:'comms.channel_onboarding',aggregateId:r.id,payload:{facilityId,channel,version:saved!.version}});
    return dto(facilityId,channel,saved);
  });
}
