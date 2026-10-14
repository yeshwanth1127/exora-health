// Patient-facing projection and atomic booking. No patient identity/record lookup is exposed.
import { createHmac } from 'node:crypto';
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, forbidden, notFound, preconditionFailed, runCommand, runQuery, setTransactionContext, type CommandContext } from '@hms/platform';
import type { Caller } from '../../caller.ts';
import { clock } from '../../caller.ts';
import { lockAccess } from '../access/staff.ts';
import { consultationFee, confirmHeldReservation, createBookingParty, placeHold } from './appointments.ts';
import { signSlot, type PublicBookingSite, type SlotClaim } from './public-config.ts';
import { lockCalendar } from './calendar-lock.ts';

export async function consumePublicBudget(db: Kysely<DB>, site: PublicBookingSite, secret: string, subject: string, seconds: number, limit: number, now: Date) {
  const allowed = await db.transaction().execute(async tx => {
    await setTransactionContext(tx,site.tenantId);
    await sql`SET LOCAL ROLE mod_booking`.execute(tx);
    return consumeBudgetIn(tx,site,secret,subject,seconds,limit,now);
  });
  // Throw only AFTER committing: failed HTTP attempts still consume the shared IP budget.
  if(!allowed) throw Object.assign(Error('Too many requests. Please wait before trying again.'),{statusCode:429});
}
async function consumeBudgetIn(tx: Transaction<DB>, site: PublicBookingSite, secret: string, subject: string, seconds: number, limit: number, now: Date) {
  const hash=createHmac('sha256',secret).update(`${site.siteSlug}:${subject}`).digest('hex');
  const bucket=new Date(Math.floor(now.getTime()/(seconds*1000))*seconds*1000);
  const {rows:[r]}=await sql<{requests:number}>`INSERT INTO booking.public_request_budget(tenant_id,site_slug,subject_hash,bucket_start,requests)
    VALUES(${site.tenantId},${site.siteSlug},${hash},${bucket},1)
    ON CONFLICT(tenant_id,site_slug,subject_hash,bucket_start) DO UPDATE SET requests=least(booking.public_request_budget.requests+1,10000)
    RETURNING requests`.execute(tx);
  // Bounded retention per caller rather than a whole-table sweep on each request.
  await sql`DELETE FROM booking.public_request_budget WHERE tenant_id=${site.tenantId} AND site_slug=${site.siteSlug}
    AND subject_hash=${hash} AND bucket_start<${new Date(now.getTime()-2*86400000)}`.execute(tx);
  return r!.requests<=limit;
}

async function clinic(tx: Transaction<DB>, site: PublicBookingSite, now: Date) {
  const c=await tx.selectFrom('platform.facility').select(['name','timezone','status','address_line1','address_line2','city','pincode','phone']).where('id','=',site.facilityId).executeTakeFirst();
  const tenant=await tx.selectFrom('platform.tenant').select('status').where('id','=',site.tenantId).executeTakeFirst();
  const module=await tx.selectFrom('platform.module_state').select('state').where('module_code','=','booking').executeTakeFirst();
  if(!c || c.status!=='active' || !tenant || !['active','trial'].includes(tenant.status) || module?.state!=='active') throw notFound('Online booking is not available for this clinic');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:c.timezone}).format(now);
  const bookingUntil=new Date(Date.parse(`${today}T12:00:00Z`)+31*86400000).toISOString().slice(0,10);
  return {clinicName:c.name,timezone:c.timezone,today,bookingUntil,addressLine1:c.address_line1??'',addressLine2:[c.address_line2,c.city,c.pincode].filter(Boolean).join(', '),phone:c.phone??''};
}
interface Doctor {roleTitle:string|null;staffId:string;slug:string;name:string;specialty:string|null;acceptsVirtual:boolean;qualifications:string[];bio:string|null;experienceYears:number|null;languages:string[];photoUrl:string|null;departments:string[]}
async function doctors(tx: Transaction<DB>,site:PublicBookingSite,day:string):Promise<Doctor[]> {
  const {rows}=await sql<Doctor>`SELECT s.id AS "staffId",pp.public_slug AS slug,s.display_name AS name,sp.name AS specialty,pp.accepts_virtual AS "acceptsVirtual",
    (SELECT a.role_title FROM catalog.practitioner_affiliation a WHERE a.staff_id=s.id AND a.facility_id=${site.facilityId}
      AND a.valid_from<=${day}::date AND (a.valid_to IS NULL OR a.valid_to>${day}::date) ORDER BY a.id LIMIT 1) AS "roleTitle",
    pp.qualifications,pp.bio,pp.experience_years AS "experienceYears",pp.languages,pp.public_photo_url AS "photoUrl",
    ARRAY(SELECT DISTINCT d.name FROM catalog.practitioner_affiliation a JOIN platform.department d ON d.id=a.department_id
      WHERE a.staff_id=s.id AND a.facility_id=${site.facilityId} AND d.status='active' AND a.valid_from<=${day}::date
        AND (a.valid_to IS NULL OR a.valid_to>${day}::date) ORDER BY d.name) AS departments
    FROM platform.staff s JOIN catalog.practitioner_profile pp ON pp.staff_id=s.id
    LEFT JOIN catalog.specialty sp ON sp.id=pp.specialty_id
    WHERE s.status='active' AND s.staff_type='doctor' AND NOT s.is_system_account AND pp.published AND pp.public_slug IS NOT NULL
      AND EXISTS(SELECT 1 FROM booking.schedulable_resource r WHERE r.staff_id=s.id AND r.is_active)
      AND EXISTS(SELECT 1 FROM catalog.practitioner_affiliation a JOIN platform.department d ON d.id=a.department_id
        WHERE a.staff_id=s.id AND a.facility_id=${site.facilityId} AND d.status='active'
          AND a.valid_from<=${day}::date AND (a.valid_to IS NULL OR a.valid_to>${day}::date))
    ORDER BY s.display_name,s.id LIMIT 100`.execute(tx);
  return rows;
}
export async function publicCatalog(db:Kysely<DB>,caller:Caller,site:PublicBookingSite) {
  return runQuery(db,site.tenantId,async tx=>{
    const c=await clinic(tx,site,clock(caller));
    return {siteSlug:site.siteSlug,websiteBranchId:site.websiteBranchId,...c,doctors:(await doctors(tx,site,c.today)).map(({staffId:_id,...d})=>({...d,websiteIds:site.doctorAliases[d.slug]??[]}))};
  });
}
export async function publicSlots(db:Kysely<DB>,caller:Caller,site:PublicBookingSite,secret:string,input:{doctor:string;mode:'in_person'|'virtual';from:string;to:string}) {
  return runQuery(db,site.tenantId,async tx=>{
    const now=clock(caller),c=await clinic(tx,site,now);
    if(input.from<c.today || input.to>c.bookingUntil || input.to<input.from || Date.parse(input.to)-Date.parse(input.from)>13*86400000)
      throw preconditionFailed('Choose up to 14 days within the next 31 days.');
    const doctor=(await doctors(tx,site,c.today)).find(d=>d.slug===input.doctor);
    if(!doctor || (input.mode==='virtual' && !doctor.acceptsVirtual)) throw notFound('Published doctor for this appointment type');
    const {rows}=await sql<{slot_start:Date;slot_end:Date;healthcare_service_id:string;session_on:string;service_name:string}>`
      SELECT a.slot_start,a.slot_end,a.healthcare_service_id,h.name AS service_name,(a.slot_start AT TIME ZONE ${c.timezone})::date::text AS session_on FROM booking.schedulable_resource r
      CROSS JOIN LATERAL booking.available_slots(r.id,${input.from}::date,${input.to}::date,${now}) a
      JOIN catalog.healthcare_service h ON h.id=a.healthcare_service_id AND h.status='active' AND h.is_public
      JOIN platform.department d ON d.id=h.department_id AND d.status='active' AND d.facility_id=${site.facilityId}
      JOIN catalog.service_item i ON i.id=h.consultation_service_item_id AND i.status='active'
      WHERE r.staff_id=${doctor.staffId} AND r.is_active AND a.facility_id=${site.facilityId} AND a.visit_mode=${input.mode} AND a.status='free'
        AND (h.service_mode=${input.mode} OR h.service_mode='both')
        AND EXISTS(SELECT 1 FROM catalog.practitioner_affiliation p WHERE p.staff_id=r.staff_id AND p.facility_id=${site.facilityId}
          AND p.valid_from<=(a.slot_start AT TIME ZONE ${c.timezone})::date AND (p.valid_to IS NULL OR p.valid_to>(a.slot_start AT TIME ZONE ${c.timezone})::date))
      ORDER BY a.slot_start LIMIT 1501`.execute(tx);
    if(rows.length>1500) throw preconditionFailed('Choose a shorter date range to see all available times.');
    const cache=new Map<string,Awaited<ReturnType<typeof consultationFee>>>();
    const slots=[],unpricedSlots=[];
    for(const row of rows) {
      const key=`${row.healthcare_service_id}:${row.session_on}`;
      if(!cache.has(key)) cache.set(key,await consultationFee(tx,row.healthcare_service_id,doctor.staffId,row.session_on,input.mode));
      const fee=cache.get(key);if(!fee){unpricedSlots.push({startsAt:row.slot_start.toISOString(),endsAt:row.slot_end.toISOString(),serviceName:row.service_name});continue;}
      const claim:SlotClaim={siteSlug:site.siteSlug,tenantId:site.tenantId,facilityId:site.facilityId,staffId:doctor.staffId,doctorSlug:doctor.slug,
        serviceId:row.healthcare_service_id,visitMode:input.mode,startsAt:row.slot_start.toISOString(),endsAt:row.slot_end.toISOString(),
        feeMinor:fee.unitPriceMinor,expiresAt:now.getTime()+15*60000};
      slots.push({startsAt:claim.startsAt,endsAt:claim.endsAt,feeMinor:claim.feeMinor,slotToken:signSlot(claim,secret)});
    }
    return {timezone:c.timezone,slots,unpricedSlots};
  });
}

export interface PublicBookingInput {slotToken:string;name:string;phone:string;email?:string;reason?:string}
async function assertLiveBookingActor(ctx:CommandContext,site:PublicBookingSite) {
  await lockAccess(ctx);
  const {rows:[r]}=await sql<{ok:boolean}>`SELECT EXISTS(SELECT 1 FROM platform.user_account u
    JOIN platform.staff s ON s.id=u.staff_id AND s.status='active' AND s.is_system_account
    JOIN platform.staff_permission p ON p.staff_id=s.id AND p.permission='appointments.book'
    WHERE u.id=${ctx.actor.userId??null} AND u.staff_id=${ctx.actor.staffId??null} AND u.status='active'
      AND u.identity_issuer=${site.identityIssuer} AND u.identity_subject=${site.identitySubject}
      AND (p.facility_id IS NULL OR p.facility_id=${site.facilityId})) AS ok`.execute(ctx.tx);
  if(!r?.ok) throw forbidden('Online booking access has been withdrawn.');
}
export async function publicBook(db:Kysely<DB>,caller:Caller,site:PublicBookingSite,secret:string,input:PublicBookingInput,claim:SlotClaim,key:string) {
  if(claim.siteSlug!==site.siteSlug || claim.tenantId!==site.tenantId || claim.facilityId!==site.facilityId) throw forbidden('This time selection belongs to another clinic.');
  return runCommand(db,{...caller,module:'booking',name:`booking.public_book.${site.siteSlug}`,idempotencyKey:key,request:input},async ctx=>{
    const now=clock(caller);
    await assertLiveBookingActor(ctx,site);
    await lockCalendar(ctx.tx,site.tenantId);
    await sql`SELECT id FROM booking.schedulable_resource WHERE staff_id=${claim.staffId} FOR UPDATE`.execute(ctx.tx);
    // Owning module roles acquire locks; booking never receives cross-module write grants.
    await sql`SET LOCAL ROLE mod_platform`.execute(ctx.tx);
    await sql`SELECT id FROM platform.tenant WHERE id=${site.tenantId} FOR SHARE`.execute(ctx.tx);
    await sql`SELECT id FROM platform.facility WHERE id=${site.facilityId} FOR UPDATE`.execute(ctx.tx);
    await sql`SELECT id FROM platform.module_state WHERE module_code='booking' FOR SHARE`.execute(ctx.tx);
    await sql`SELECT id FROM platform.staff WHERE id=${claim.staffId} FOR SHARE`.execute(ctx.tx);
    await sql`SET LOCAL ROLE mod_catalog`.execute(ctx.tx);
    await sql`SELECT id FROM catalog.practitioner_profile WHERE staff_id=${claim.staffId} FOR SHARE`.execute(ctx.tx);
    await sql`SELECT id FROM catalog.healthcare_service WHERE id=${claim.serviceId} FOR SHARE`.execute(ctx.tx);
    await sql`SELECT i.id FROM catalog.service_item i JOIN catalog.healthcare_service h ON h.consultation_service_item_id=i.id
      WHERE h.id=${claim.serviceId} FOR SHARE OF i`.execute(ctx.tx);
    await sql`SET LOCAL ROLE mod_platform`.execute(ctx.tx);
    await sql`SELECT d.id FROM platform.department d JOIN catalog.healthcare_service h ON h.department_id=d.id
      WHERE h.id=${claim.serviceId} FOR SHARE OF d`.execute(ctx.tx);
    await sql`SET LOCAL ROLE mod_catalog`.execute(ctx.tx);
    // All affiliations used below are re-read after waiting for their locks.
    await sql`SELECT id FROM catalog.practitioner_affiliation WHERE staff_id=${claim.staffId} AND facility_id=${site.facilityId} FOR SHARE`.execute(ctx.tx);
    await sql`SET LOCAL ROLE mod_booking`.execute(ctx.tx);
    await sql`SELECT pg_advisory_xact_lock(hashtextextended('pricing:' || ${ctx.tenantId},0))`.execute(ctx.tx);
    const c=await clinic(ctx.tx,site,now);
    if(claim.expiresAt<=now.getTime() || Date.parse(claim.startsAt)<=now.getTime()) throw preconditionFailed('This time selection expired. Choose an available time again.');
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:c.timezone}).format(new Date(claim.startsAt));
    if(day<c.today || day>c.bookingUntil)throw preconditionFailed('This time is outside the online booking window.');
    const doctor=(await doctors(ctx.tx,site,day)).find(d=>d.staffId===claim.staffId && d.slug===claim.doctorSlug);
    if(!doctor || (claim.visitMode==='virtual' && !doctor.acceptsVirtual))throw conflict('This doctor is no longer available for this appointment type.');
    const service=await ctx.tx.selectFrom('catalog.healthcare_service as h').innerJoin('platform.department as d','d.id','h.department_id')
      .innerJoin('catalog.service_item as i','i.id','h.consultation_service_item_id')
      .select(['h.id','h.status','h.is_public','h.service_mode','d.facility_id','d.status as departmentStatus','d.id as departmentId','i.status as itemStatus'])
      .where('h.id','=',claim.serviceId).executeTakeFirst();
    if(!service || service.status!=='active' || !service.is_public || service.facility_id!==site.facilityId || service.departmentStatus!=='active' || service.itemStatus!=='active' || ![claim.visitMode,'both'].includes(service.service_mode))
      throw conflict('This consultation is no longer offered online.');
    // Affiliation, department and service item also stay valid while the booking is committed.
    const {rows:affiliation}=await sql`SELECT id FROM catalog.practitioner_affiliation WHERE staff_id=${claim.staffId}
      AND facility_id=${site.facilityId} AND valid_from<=${day}::date
      AND (valid_to IS NULL OR valid_to>${day}::date)`.execute(ctx.tx);
    if(!affiliation.length)throw conflict('This doctor is no longer seeing patients at this clinic.');
    const fee=await consultationFee(ctx.tx,claim.serviceId,claim.staffId,day,claim.visitMode);
    if(!fee || fee.unitPriceMinor!==claim.feeMinor)throw conflict('The consultation fee changed. Review the available time again.');
    if(!await consumeBudgetIn(ctx.tx,site,secret,`phone:${input.phone}`,86400,3,now))
      throw preconditionFailed('This phone has reached the daily online booking limit. Please contact reception.');
    const hold=await placeHold(ctx,now,{staffId:claim.staffId,facilityId:site.facilityId,slotStart:claim.startsAt},1);
    if(hold.slotEnd.toISOString()!==claim.endsAt)throw conflict('The appointment duration changed. Choose the time again.');
    const {rows:sessions}=await sql<{healthcare_service_id:string|null;visit_mode:string}>`SELECT healthcare_service_id,visit_mode FROM booking.sessions(
      (SELECT resource_id FROM booking.reservation WHERE id=${hold.reservationId}),${day}::date,${day}::date)
      WHERE facility_id=${site.facilityId} AND tstzrange(starts_at,ends_at) @> tstzrange(${new Date(claim.startsAt)},${new Date(claim.endsAt)})`.execute(ctx.tx);
    if(sessions.length!==1 || sessions[0]!.healthcare_service_id!==claim.serviceId || sessions[0]!.visit_mode!==claim.visitMode)throw conflict('The schedule changed. Choose the appointment time again.');
    const partyId=await createBookingParty(ctx,{name:input.name,phone:input.phone,...(input.email?{email:input.email}:{})},null,now);
    const result=await confirmHeldReservation(ctx,now,hold.reservationId,{patientId:null,bookingPartyId:partyId,visitType:'new',originChannel:'web',priority:'normal',reason:input.reason??null,rescheduledFromId:null});
    // Defend against a price/session change between the quote check and core confirmation.
    const saved=await ctx.tx.selectFrom('booking.appointment').select(['practitioner_staff_id','facility_id','healthcare_service_id','visit_mode','starts_at','ends_at','fee_snapshot_minor']).where('id','=',result.appointmentId).executeTakeFirstOrThrow();
    if(saved.practitioner_staff_id!==claim.staffId || saved.facility_id!==claim.facilityId || saved.healthcare_service_id!==claim.serviceId || saved.visit_mode!==claim.visitMode || saved.starts_at?.toISOString()!==claim.startsAt || saved.ends_at?.toISOString()!==claim.endsAt || saved.fee_snapshot_minor!==claim.feeMinor)
      throw conflict('The consultation changed. Review the available time again.');
    return {appointmentId:result.appointmentId,confirmationCode:result.confirmationCode,status:'confirmed' as const,
      startsAt:claim.startsAt,endsAt:claim.endsAt,feeMinor:claim.feeMinor,clinicName:c.clinicName,doctorName:doctor.name,visitMode:claim.visitMode,timezone:c.timezone};
  });
}
