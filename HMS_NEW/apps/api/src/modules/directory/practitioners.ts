// Doctor directory administration: the tenant-wide booking profile and where the doctor works.
import { sql, type DB, type Kysely } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { assertVersion, changes, facilityToday } from './admin.ts';

export interface PractitionerDetail {
  staffId: string;
  displayName: string;
  staffType: string;
  status: string;
  phone: string | null;
  email: string | null;
  /** Version of the staff record, for PATCH /v1/staff/:id. */
  staffVersion: number;
  calendarId: string | null;
  profile: {
    specialty: string | null;
    specialtyName: string | null;
    qualifications: string[];
    bio: string | null;
    experienceYears: number | null;
    languages: string[];
    acceptsVirtual: boolean;
    publicSlug: string | null;
    publicPhotoUrl: string | null;
    published: boolean;
    version: number;
  } | null;
  affiliations: {
    affiliationId: string;
    facilityId: string;
    facilityName: string;
    departmentId: string;
    departmentName: string;
    roleTitle: string | null;
    validFrom: string;
    validTo: string | null;
  }[];
}

export async function getPractitioner(db: Kysely<DB>, caller: Caller, staffId: string): Promise<PractitionerDetail> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const staff = await tx
      .selectFrom('platform.staff as s')
      .leftJoin('booking.schedulable_resource as sr', 'sr.staff_id', 's.id')
      .select(['s.id as staffId', 's.display_name as displayName', 's.staff_type as staffType', 's.status', 's.phone', 's.email', 's.is_system_account', 's.version as staffVersion', 'sr.id as calendarId'])
      .where('s.id', '=', staffId)
      .executeTakeFirst();
    if (!staff || staff.is_system_account) throw notFound('staff member', { staffId });
    const [profile, affiliations] = await Promise.all([
      tx
        .selectFrom('catalog.practitioner_profile as pp')
        .leftJoin('catalog.specialty as sp', 'sp.id', 'pp.specialty_id')
        .select([
          'sp.code as specialty', 'sp.name as specialtyName', 'pp.qualifications', 'pp.bio', 'pp.experience_years as experienceYears', 'pp.languages',
          'pp.accepts_virtual as acceptsVirtual', 'pp.public_slug as publicSlug', 'pp.public_photo_url as publicPhotoUrl', 'pp.published', 'pp.version',
        ])
        .where('pp.staff_id', '=', staffId)
        .executeTakeFirst(),
      tx
        .selectFrom('catalog.practitioner_affiliation as pa')
        .innerJoin('platform.facility as f', 'f.id', 'pa.facility_id')
        .innerJoin('platform.department as d', 'd.id', 'pa.department_id')
        .select([
          'pa.id as affiliationId', 'pa.facility_id as facilityId', 'f.name as facilityName', 'pa.department_id as departmentId', 'd.name as departmentName',
          'pa.role_title as roleTitle', 'pa.valid_from as validFrom', 'pa.valid_to as validTo',
        ])
        .where('pa.staff_id', '=', staffId)
        .orderBy('pa.valid_from', 'desc')
        .execute(),
    ]);
    const { is_system_account: _system, ...rest } = staff;
    return { ...rest, email: rest.email as string | null, profile: profile ?? null, affiliations };
  });
}

/** Clinics the doctor works at now or later (the profile is shown at each of them). */
export async function practitionerReach(db: Kysely<DB>, caller: Caller, staffId: string): Promise<string[] | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const staff = await tx.selectFrom('platform.staff').select('is_system_account').where('id', '=', staffId).executeTakeFirst();
    if (!staff || staff.is_system_account) return undefined;
    const { rows } = await sql<{ facility_id: string }>`
      SELECT DISTINCT facility_id FROM catalog.practitioner_affiliation WHERE staff_id = ${staffId} AND (valid_to IS NULL OR valid_to > current_date)`.execute(tx);
    return rows.map((r) => r.facility_id);
  });
}

export interface ProfileInput {
  staffId: string;
  /** Required when a profile exists; omit to create the first one. */
  version?: number | undefined;
  specialty: string | null;
  qualifications: string[];
  bio: string | null;
  experienceYears: number | null;
  languages: string[];
  acceptsVirtual: boolean;
  publicSlug: string | null;
  publicPhotoUrl?: string | null;
  published: boolean;
}

export async function savePractitionerProfile(db: Kysely<DB>, caller: Caller, input: ProfileInput, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'catalog', name: 'catalog.save_practitioner_profile', idempotencyKey, request: input }, async (ctx) => {
    const staff = await ctx.tx.selectFrom('platform.staff').select(['is_system_account']).where('id', '=', input.staffId).executeTakeFirst();
    if (!staff || staff.is_system_account) throw notFound('staff member', { staffId: input.staffId });
    let specialtyId: string | null = null;
    if (input.specialty) {
      const s = await ctx.tx.selectFrom('catalog.specialty').select('id').where('code', '=', input.specialty).where('status', '=', 'active').executeTakeFirst();
      if (!s) throw invalid('unknown specialty', { specialty: input.specialty });
      specialtyId = s.id;
    }
    if (input.published && !input.publicSlug) throw invalid('a published profile needs a public web address', { reason: 'slug_required' });
    const values = {
      specialty_id: specialtyId,
      qualifications: input.qualifications,
      bio: input.bio,
      experience_years: input.experienceYears,
      languages: input.languages,
      accepts_virtual: input.acceptsVirtual,
      public_slug: input.publicSlug,
      ...(input.publicPhotoUrl!==undefined?{public_photo_url:input.publicPhotoUrl}:{}),
      published: input.published,
    };
    const before = await ctx.tx.selectFrom('catalog.practitioner_profile').selectAll().where('staff_id', '=', input.staffId).forUpdate().executeTakeFirst();
    try {
      if (!before) {
        const { id, version } = await ctx.tx
          .insertInto('catalog.practitioner_profile')
          .values({ tenant_id: ctx.tenantId, staff_id: input.staffId, ...values, created_by: ctx.actor.staffId ?? null })
          .returning(['id', 'version'])
          .executeTakeFirstOrThrow();
        ctx.audit({ action: 'create', subjectType: 'catalog.practitioner_profile', subjectId: id, diff: { staffId: input.staffId, ...values } });
        return { staffId: input.staffId, version };
      }
      if (input.version === undefined) throw conflict('this profile already exists; reload and try again', { reason: 'stale_version', currentVersion: before.version });
      assertVersion(before.version, input.version, 'profile');
      const diff = changes(before as unknown as Record<string, unknown>, values);
      if (!Object.keys(diff).length) return { staffId: input.staffId, version: before.version };
      const { version } = await ctx.tx
        .updateTable('catalog.practitioner_profile')
        .set({ ...values, updated_by: ctx.actor.staffId ?? null })
        .where('id', '=', before.id)
        .returning('version')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'update', subjectType: 'catalog.practitioner_profile', subjectId: before.id, diff });
      return { staffId: input.staffId, version };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('another doctor already uses that web address', { reason: 'duplicate_slug' });
      throw err;
    }
  });
}

export async function addAffiliation(
  db: Kysely<DB>,
  caller: Caller,
  input: { staffId: string; facilityId: string; departmentId: string; roleTitle?: string | null | undefined; validFrom: string },
  idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'catalog', name: 'catalog.add_affiliation', idempotencyKey, request: input }, async (ctx) => {
    const staff = await ctx.tx.selectFrom('platform.staff').select(['status', 'is_system_account']).where('id', '=', input.staffId).executeTakeFirst();
    if (!staff || staff.is_system_account) throw notFound('staff member', { staffId: input.staffId });
    if (staff.status !== 'active') throw preconditionFailed('this person is not active');
    const dept = await ctx.tx.selectFrom('platform.department').select(['facility_id', 'status']).where('id', '=', input.departmentId).executeTakeFirst();
    if (!dept || dept.facility_id !== input.facilityId) throw invalid('the department must belong to that clinic');
    if (dept.status !== 'active') throw preconditionFailed('the department is switched off');
    try {
      const { id } = await ctx.tx
        .insertInto('catalog.practitioner_affiliation')
        .values({ tenant_id: ctx.tenantId, staff_id: input.staffId, facility_id: input.facilityId, department_id: input.departmentId, role_title: input.roleTitle ?? null, valid_from: input.validFrom, created_by: ctx.actor.staffId ?? null })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'catalog.practitioner_affiliation', subjectId: id, diff: { staffId: input.staffId, facilityId: input.facilityId, departmentId: input.departmentId, validFrom: input.validFrom } });
      return { affiliationId: id };
    } catch (err) {
      if (pgCode(err) === '23P01') throw conflict('the doctor already works in this department for those dates', { reason: 'already_affiliated' });
      throw err;
    }
  });
}

export async function affiliationFacility(db: Kysely<DB>, caller: Caller, affiliationId: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('catalog.practitioner_affiliation').select('facility_id').where('id', '=', affiliationId).executeTakeFirst())?.facility_id);
}

/**
 * The doctor stops working in that department from `validTo` (the first day they no longer work there).
 * Refused while booked visits or weekly hours at that clinic remain from that day and no other current
 * affiliation keeps the doctor at the clinic, so patients are moved first.
 */
export async function endAffiliation(db: Kysely<DB>, caller: Caller, input: { affiliationId: string; validTo: string; reason: string }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'catalog', name: 'catalog.end_affiliation', idempotencyKey, request: input }, async (ctx) => {
    const a = await ctx.tx.selectFrom('catalog.practitioner_affiliation').selectAll().where('id', '=', input.affiliationId).forUpdate().executeTakeFirst();
    if (!a) throw notFound('affiliation', { affiliationId: input.affiliationId });
    if (a.valid_to !== null && a.valid_to <= input.validTo) return { affiliationId: a.id, validTo: a.valid_to };
    const today = await facilityToday(ctx.tx, a.facility_id, clock(caller));
    if (input.validTo < today) throw invalid("an end date can't be in the past", { reason: 'past_date', today });
    if (input.validTo <= a.valid_from) throw invalid('the end date must be after the start date');
    const { rows: [use] } = await sql<{ stays: boolean; visits: number; hours: number }>`
      SELECT EXISTS (SELECT 1 FROM catalog.practitioner_affiliation o WHERE o.staff_id = ${a.staff_id} AND o.facility_id = ${a.facility_id}
                       AND o.id <> ${a.id} AND (o.valid_to IS NULL OR o.valid_to > ${input.validTo}::date)) AS stays,
             (SELECT count(*)::int FROM booking.appointment ap JOIN booking.schedulable_resource sr ON sr.id = ap.resource_id
               WHERE sr.staff_id = ${a.staff_id} AND ap.facility_id = ${a.facility_id} AND ap.status IN ('confirmed', 'checked_in')
                 AND ap.session_on >= ${input.validTo}::date) AS visits,
             (SELECT count(*)::int FROM booking.schedule_rule r JOIN booking.schedulable_resource sr ON sr.id = r.resource_id
               WHERE sr.staff_id = ${a.staff_id} AND r.facility_id = ${a.facility_id} AND r.withdrawn_at IS NULL
                 AND (r.effective_to IS NULL OR r.effective_to > ${input.validTo}::date)) AS hours`.execute(ctx.tx);
    if (!use!.stays) {
      if (use!.visits) throw conflict('move or cancel their booked visits at this clinic first', { reason: 'future_appointments', count: use!.visits });
      if (use!.hours) throw conflict('end their weekly hours at this clinic first (Schedules → Weekly hours)', { reason: 'published_hours', count: use!.hours });
    }
    await ctx.tx.updateTable('catalog.practitioner_affiliation').set({ valid_to: input.validTo, updated_by: ctx.actor.staffId ?? null }).where('id', '=', a.id).execute();
    ctx.audit({ action: 'status_change', subjectType: 'catalog.practitioner_affiliation', subjectId: a.id, reason: input.reason, diff: { validTo: [a.valid_to, input.validTo] } });
    return { affiliationId: a.id, validTo: input.validTo };
  });
}

/** Display name and work phone (staff records are platform-owned; email stays tied to the sign-in). */
export async function updateStaffDetails(db: Kysely<DB>, caller: Caller, input: { staffId: string; version: number; displayName?: string | undefined; phone?: string | null | undefined }, idempotencyKey?: string) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.update_staff', idempotencyKey, request: input }, async (ctx) => {
    const before = await ctx.tx.selectFrom('platform.staff').selectAll().where('id', '=', input.staffId).forUpdate().executeTakeFirst();
    if (!before || before.is_system_account) throw notFound('staff member', { staffId: input.staffId });
    assertVersion(before.version, input.version, 'staff record');
    const set: Record<string, unknown> = {};
    if (input.displayName !== undefined) {
      const [given, ...rest] = input.displayName.trim().split(/\s+/);
      Object.assign(set, { display_name: input.displayName.trim(), given_name: given!, family_name: rest.join(' ') || null });
    }
    if (input.phone !== undefined) set.phone = input.phone;
    const diff = changes(before as unknown as Record<string, unknown>, set);
    if (!Object.keys(diff).length) return { staffId: before.id, version: before.version };
    const { version } = await ctx.tx.updateTable('platform.staff').set({ ...set, updated_by: ctx.actor.staffId ?? null }).where('id', '=', before.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: 'update', subjectType: 'platform.staff', subjectId: before.id, diff });
    return { staffId: before.id, version };
  });
}
