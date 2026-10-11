// Directory administration: clinics, departments, consult rooms and bookable services. Routes check the
// permission at the clinic involved; these commands add the rules that need the database (no stale
// edits, nothing switched off while it's still in use, the tenant always keeps one active clinic).
import { sql, type DB, type Kysely, type Transaction } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand, runQuery, type CommandContext } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { publishPrice, type PriceMode } from './pricing.ts';

type Status = 'active' | 'inactive';

/** Optimistic concurrency: the edit names the version it was made from; a newer row means someone else saved first. */
export function assertVersion(current: number, expected: number, what: string) {
  if (current !== expected) throw conflict(`this ${what} was changed by someone else; reload and try again`, { reason: 'stale_version', currentVersion: current });
}

/** Columns that change, as { column: [before, after] } for the audit record. */
export function changes<T extends Record<string, unknown>>(before: T, set: Partial<T>): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const [k, v] of Object.entries(set)) {
    const was = before[k] instanceof Date ? (before[k] as Date).toISOString().slice(0, 10) : before[k];
    if (v !== undefined && JSON.stringify(was ?? null) !== JSON.stringify(v ?? null)) out[k] = [was ?? null, v ?? null];
  }
  return out;
}

const defined = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

export async function facilityToday(tx: Transaction<DB>, facilityId: string, now: Date): Promise<string> {
  const { rows: [r] } = await sql<{ d: string }>`
    SELECT (${now}::timestamptz AT TIME ZONE f.timezone)::date::text AS d FROM platform.facility f WHERE f.id = ${facilityId}`.execute(tx);
  if (!r) throw notFound('facility', { facilityId });
  return r.d;
}

// ---- clinics ------------------------------------------------------------------------------------

export interface FacilityFields {
  name?: string | undefined;
  facilityType?: 'hospital' | 'clinic' | 'diagnostic_centre' | 'pharmacy' | 'virtual' | undefined;
  addressLine1?: string | null | undefined;
  addressLine2?: string | null | undefined;
  city?: string | null | undefined;
  district?: string | null | undefined;
  pincode?: string | null | undefined;
  stateCode?: string | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  timezone?: string | undefined;
  directionsUrl?: string | null | undefined;
  arrivalInstructions?: string | null | undefined;
}

const facilityColumns = (f: FacilityFields) =>
  defined({
    name: f.name,
    facility_type: f.facilityType,
    is_virtual: f.facilityType === undefined ? undefined : f.facilityType === 'virtual',
    address_line1: f.addressLine1,
    address_line2: f.addressLine2,
    city: f.city,
    district: f.district,
    pincode: f.pincode,
    state_code: f.stateCode,
    phone: f.phone,
    email: f.email,
    timezone: f.timezone,
    directions_url: f.directionsUrl,
    arrival_instructions: f.arrivalInstructions,
  });

function facilityError(err: unknown): never {
  if (pgCode(err) === '23505') throw conflict('another clinic already uses that code or registry id', { reason: 'duplicate_code' });
  if (pgCode(err) === '23514') throw invalid('clinic details failed validation (check the pincode, state code, GSTIN and directions link)');
  throw err;
}

export interface FacilityDetail {
  facilityId: string;
  code: string;
  name: string;
  facilityType: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  pincode: string | null;
  stateCode: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  directionsUrl: string | null;
  arrivalInstructions: string | null;
  status: string;
  version: number;
}

const facilityDetailColumns = [
  'id as facilityId', 'code', 'name', 'facility_type as facilityType', 'address_line1 as addressLine1', 'address_line2 as addressLine2',
  'city', 'district', 'pincode', 'state_code as stateCode', 'phone', 'email', 'timezone', 'directions_url as directionsUrl',
  'arrival_instructions as arrivalInstructions', 'status', 'version',
] as const;

export async function getFacility(db: Kysely<DB>, caller: Caller, facilityId: string): Promise<FacilityDetail> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const f = await tx.selectFrom('platform.facility').select(facilityDetailColumns).where('id', '=', facilityId).executeTakeFirst();
    if (!f) throw notFound('facility', { facilityId });
    return f as FacilityDetail;
  });
}

export async function createFacility(
  db: Kysely<DB>,
  caller: Caller,
  input: FacilityFields & { code: string; name: string; facilityType: NonNullable<FacilityFields['facilityType']>; stateCode: string },
  idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.create_facility', idempotencyKey, request: input }, async (ctx) => {
    // New clinics join the tenant's top-level organisation (provisioning creates it).
    const org = await ctx.tx.selectFrom('platform.organization').select('id').where('parent_id', 'is', null).where('status', '=', 'active').orderBy('created_at').executeTakeFirst();
    if (!org) throw preconditionFailed('this hospital account has no organisation yet');
    try {
      const { id } = await ctx.tx
        .insertInto('platform.facility')
        .values({ tenant_id: ctx.tenantId, organization_id: org.id, code: input.code, ...facilityColumns(input), name: input.name, facility_type: input.facilityType, state_code: input.stateCode, created_by: ctx.actor.staffId ?? null })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'platform.facility', subjectId: id, diff: { code: input.code, name: input.name } });
      return { facilityId: id };
    } catch (err) {
      facilityError(err);
    }
  });
}

export async function updateFacility(db: Kysely<DB>, caller: Caller, input: FacilityFields & { facilityId: string; version: number; status?: Status | undefined }) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.update_facility' }, async (ctx) => {
    const before = await ctx.tx.selectFrom('platform.facility').selectAll().where('id', '=', input.facilityId).forUpdate().executeTakeFirst();
    if (!before) throw notFound('facility', { facilityId: input.facilityId });
    assertVersion(before.version, input.version, 'clinic');
    const set = { ...facilityColumns(input), ...defined({ status: input.status }) };
    const diff = changes(before as unknown as Record<string, unknown>, set);
    if (!Object.keys(diff).length) return { facilityId: before.id, version: before.version };
    if (input.status === 'inactive' && before.status === 'active') await assertFacilityIdle(ctx, before.id, clock(caller));
    try {
      const { version } = await ctx.tx.updateTable('platform.facility').set({ ...set, updated_by: ctx.actor.staffId ?? null }).where('id', '=', before.id).returning('version').executeTakeFirstOrThrow();
      ctx.audit({ action: input.status && diff.status ? 'status_change' : 'update', subjectType: 'platform.facility', subjectId: before.id, diff });
      return { facilityId: before.id, version };
    } catch (err) {
      facilityError(err);
    }
  });
}

/** A clinic is switched off only once nothing points patients at it, and never the last one. */
async function assertFacilityIdle(ctx: CommandContext, facilityId: string, now: Date) {
  const today = await facilityToday(ctx.tx, facilityId, now);
  const { rows: [use] } = await sql<{ others: number; visits: number; hours: number }>`
    SELECT (SELECT count(*)::int FROM platform.facility WHERE status = 'active' AND id <> ${facilityId}) AS others,
           (SELECT count(*)::int FROM booking.appointment WHERE facility_id = ${facilityId} AND status IN ('confirmed', 'checked_in')
              AND session_on >= ${today}::date) AS visits,
           (SELECT count(*)::int FROM booking.schedule_rule WHERE facility_id = ${facilityId} AND withdrawn_at IS NULL
              AND (effective_to IS NULL OR effective_to > ${today}::date)) AS hours`.execute(ctx.tx);
  if (!use!.others) throw conflict("the hospital needs at least one active clinic", { reason: 'last_facility' });
  if (use!.visits) throw conflict('move or cancel the booked visits at this clinic first', { reason: 'future_appointments', count: use!.visits });
  if (use!.hours) throw conflict("end the doctors' weekly hours at this clinic first", { reason: 'published_hours', count: use!.hours });
}

// ---- departments ----------------------------------------------------------------------------------

async function specialtyId(tx: Transaction<DB>, code: string | null | undefined): Promise<string | null | undefined> {
  if (code === undefined || code === null) return code;
  const s = await tx.selectFrom('catalog.specialty').select('id').where('code', '=', code).where('status', '=', 'active').executeTakeFirst();
  if (!s) throw invalid('unknown specialty', { specialty: code });
  return s.id;
}

export type DepartmentKind = 'clinical' | 'diagnostic' | 'support' | 'administrative';

export async function departmentFacility(db: Kysely<DB>, caller: Caller, departmentId: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('platform.department').select('facility_id').where('id', '=', departmentId).executeTakeFirst())?.facility_id);
}

export async function createDepartment(
  db: Kysely<DB>,
  caller: Caller,
  input: { facilityId: string; code: string; name: string; kind: DepartmentKind; specialty?: string | null | undefined },
  idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.create_department', idempotencyKey, request: input }, async (ctx) => {
    try {
      const { id } = await ctx.tx
        .insertInto('platform.department')
        .values({ tenant_id: ctx.tenantId, facility_id: input.facilityId, code: input.code, name: input.name, kind: input.kind, specialty_id: (await specialtyId(ctx.tx, input.specialty)) ?? null, created_by: ctx.actor.staffId ?? null })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'platform.department', subjectId: id, diff: { facilityId: input.facilityId, code: input.code, name: input.name } });
      return { departmentId: id };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('another department at this clinic uses that code', { reason: 'duplicate_code' });
      if (pgCode(err) === '23503') throw notFound('facility', { facilityId: input.facilityId });
      throw err;
    }
  });
}

export async function updateDepartment(
  db: Kysely<DB>,
  caller: Caller,
  input: { departmentId: string; version: number; name?: string | undefined; kind?: DepartmentKind | undefined; specialty?: string | null | undefined; status?: Status | undefined },
) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.update_department' }, async (ctx) => {
    const before = await ctx.tx.selectFrom('platform.department').selectAll().where('id', '=', input.departmentId).forUpdate().executeTakeFirst();
    if (!before) throw notFound('department', { departmentId: input.departmentId });
    assertVersion(before.version, input.version, 'department');
    const set = defined({ name: input.name, kind: input.kind, specialty_id: await specialtyId(ctx.tx, input.specialty), status: input.status });
    const diff = changes(before as unknown as Record<string, unknown>, set);
    if (!Object.keys(diff).length) return { departmentId: before.id, version: before.version };
    if (input.status === 'inactive' && before.status === 'active') {
      const { rows: [use] } = await sql<{ services: number; doctors: number }>`
        SELECT (SELECT count(*)::int FROM catalog.healthcare_service WHERE department_id = ${before.id} AND status = 'active') AS services,
               (SELECT count(*)::int FROM catalog.practitioner_affiliation WHERE department_id = ${before.id}
                  AND (valid_to IS NULL OR valid_to > current_date)) AS doctors`.execute(ctx.tx);
      if (use!.services || use!.doctors) throw conflict('switch off its services and move its doctors first', { reason: 'in_use', services: use!.services, doctors: use!.doctors });
    }
    const { version } = await ctx.tx.updateTable('platform.department').set({ ...set, updated_by: ctx.actor.staffId ?? null }).where('id', '=', before.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: diff.status ? 'status_change' : 'update', subjectType: 'platform.department', subjectId: before.id, diff });
    return { departmentId: before.id, version };
  });
}

// ---- consult rooms ----------------------------------------------------------------------------------

export async function roomFacility(db: Kysely<DB>, caller: Caller, locationId: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) =>
    (await tx.selectFrom('platform.location').select('facility_id').where('id', '=', locationId).where('kind', '=', 'consult_room').executeTakeFirst())?.facility_id,
  );
}

export async function createConsultRoom(
  db: Kysely<DB>,
  caller: Caller,
  input: { facilityId: string; code: string; name: string; departmentId?: string | null | undefined },
  idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.create_consult_room', idempotencyKey, request: input }, async (ctx) => {
    try {
      const { id } = await ctx.tx
        .insertInto('platform.location')
        .values({ tenant_id: ctx.tenantId, facility_id: input.facilityId, kind: 'consult_room', code: input.code, name: input.name, department_id: input.departmentId ?? null, created_by: ctx.actor.staffId ?? null })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'platform.location', subjectId: id, diff: { kind: 'consult_room', facilityId: input.facilityId, code: input.code, name: input.name } });
      return { locationId: id };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('another room at this clinic uses that code', { reason: 'duplicate_code' });
      if (pgCode(err) === '23503') throw invalid('the department must belong to the same clinic');
      throw err;
    }
  });
}

export async function updateConsultRoom(
  db: Kysely<DB>,
  caller: Caller,
  input: { locationId: string; version: number; name?: string | undefined; departmentId?: string | null | undefined; status?: Status | undefined },
) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.update_consult_room' }, async (ctx) => {
    const before = await ctx.tx.selectFrom('platform.location').selectAll().where('id', '=', input.locationId).where('kind', '=', 'consult_room').forUpdate().executeTakeFirst();
    if (!before) throw notFound('consult room', { locationId: input.locationId });
    assertVersion(before.version, input.version, 'room');
    const set = defined({ name: input.name, department_id: input.departmentId, status: input.status });
    const diff = changes(before as unknown as Record<string, unknown>, set);
    if (!Object.keys(diff).length) return { locationId: before.id, version: before.version };
    if (input.status === 'inactive' && before.status === 'active') {
      const { rows: [use] } = await sql<{ n: number }>`
        SELECT count(*)::int AS n FROM booking.schedule_rule WHERE consult_location_id = ${before.id} AND withdrawn_at IS NULL
          AND (effective_to IS NULL OR effective_to > current_date)`.execute(ctx.tx);
      if (use!.n) throw conflict('weekly hours still use this room; change them first', { reason: 'in_use', hours: use!.n });
    }
    try {
      const { version } = await ctx.tx.updateTable('platform.location').set({ ...set, updated_by: ctx.actor.staffId ?? null }).where('id', '=', before.id).returning('version').executeTakeFirstOrThrow();
      ctx.audit({ action: diff.status ? 'status_change' : 'update', subjectType: 'platform.location', subjectId: before.id, diff });
      return { locationId: before.id, version };
    } catch (err) {
      if (pgCode(err) === '23503') throw invalid('the department must belong to the same clinic');
      throw err;
    }
  });
}

// ---- bookable services ------------------------------------------------------------------------------

export type ServiceMode = 'in_person' | 'virtual' | 'both';

export async function serviceFacility(db: Kysely<DB>, caller: Caller, healthcareServiceId: string): Promise<string | undefined> {
  return runQuery(db, caller.tenantId, async (tx) =>
    (
      await tx
        .selectFrom('catalog.healthcare_service as hs')
        .innerJoin('platform.department as d', 'd.id', 'hs.department_id')
        .select('d.facility_id')
        .where('hs.id', '=', healthcareServiceId)
        .executeTakeFirst()
    )?.facility_id,
  );
}

export interface CreateServiceInput {
  departmentId: string;
  code: string;
  name: string;
  serviceMode: ServiceMode;
  defaultDurationMin: number;
  isPublic: boolean;
  /** Opening default fee, from the clinic's today. */
  feeMinor?: number | undefined;
}

/** A bookable service with its consultation billing item, and optionally its first price. */
export async function createService(db: Kysely<DB>, caller: Caller, input: CreateServiceInput, idempotencyKey: string) {
  return runCommand(db, { ...caller, module: 'catalog', name: 'catalog.create_service', idempotencyKey, request: input }, async (ctx) => {
    const dept = await ctx.tx.selectFrom('platform.department').select(['facility_id', 'status']).where('id', '=', input.departmentId).executeTakeFirst();
    if (!dept) throw notFound('department', { departmentId: input.departmentId });
    if (dept.status !== 'active') throw preconditionFailed('the department is switched off');
    try {
      const item = await ctx.tx
        .insertInto('catalog.service_item')
        .values({ tenant_id: ctx.tenantId, code: `CONS-${input.code}`, name: `${input.name} consultation`, category: 'consultation', performing_department_id: input.departmentId, sac_code: '9993', created_by: ctx.actor.staffId ?? null })
        .returning('id')
        .executeTakeFirstOrThrow();
      const { id } = await ctx.tx
        .insertInto('catalog.healthcare_service')
        .values({
          tenant_id: ctx.tenantId,
          department_id: input.departmentId,
          code: input.code,
          name: input.name,
          service_mode: input.serviceMode,
          default_duration_min: input.defaultDurationMin,
          is_public: input.isPublic,
          consultation_service_item_id: item.id,
          created_by: ctx.actor.staffId ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'catalog.healthcare_service', subjectId: id, diff: { departmentId: input.departmentId, code: input.code, name: input.name, serviceMode: input.serviceMode } });
      if (input.feeMinor !== undefined) {
        await publishPrice(ctx, { serviceItemId: item.id, staffId: null, mode: 'any', feeMinor: input.feeMinor, effectiveFrom: await facilityToday(ctx.tx, dept.facility_id, clock(caller)) });
      }
      return { healthcareServiceId: id };
    } catch (err) {
      if (pgCode(err) === '23505') throw conflict('another service already uses that code', { reason: 'duplicate_code' });
      throw err;
    }
  });
}

export async function updateService(
  db: Kysely<DB>,
  caller: Caller,
  input: { healthcareServiceId: string; version: number; name?: string | undefined; serviceMode?: ServiceMode | undefined; defaultDurationMin?: number | undefined; isPublic?: boolean | undefined; status?: Status | undefined },
) {
  return runCommand(db, { ...caller, module: 'catalog', name: 'catalog.update_service' }, async (ctx) => {
    const before = await ctx.tx.selectFrom('catalog.healthcare_service').selectAll().where('id', '=', input.healthcareServiceId).forUpdate().executeTakeFirst();
    if (!before) throw notFound('service', { healthcareServiceId: input.healthcareServiceId });
    assertVersion(before.version, input.version, 'service');
    const set = defined({ name: input.name, service_mode: input.serviceMode, default_duration_min: input.defaultDurationMin, is_public: input.isPublic, status: input.status });
    const diff = changes(before as unknown as Record<string, unknown>, set);
    if (!Object.keys(diff).length) return { healthcareServiceId: before.id, version: before.version };
    if ((input.status === 'inactive' && before.status === 'active') || (input.serviceMode && input.serviceMode !== 'both')) {
      // Hours already published for this service keep pointing at it; they must change first.
      const { rows: [use] } = await sql<{ n: number }>`
        SELECT count(*)::int AS n FROM booking.schedule_rule WHERE healthcare_service_id = ${before.id} AND withdrawn_at IS NULL
          AND (effective_to IS NULL OR effective_to > current_date)
          AND (${input.status === 'inactive'}::boolean OR visit_mode <> ${input.serviceMode ?? ''})`.execute(ctx.tx);
      if (use!.n) throw conflict('weekly hours still use this service; change them first', { reason: 'in_use', hours: use!.n });
    }
    const { version } = await ctx.tx.updateTable('catalog.healthcare_service').set({ ...set, updated_by: ctx.actor.staffId ?? null }).where('id', '=', before.id).returning('version').executeTakeFirstOrThrow();
    if (input.name && before.consultation_service_item_id) {
      await ctx.tx.updateTable('catalog.service_item').set({ name: `${input.name} consultation`, updated_by: ctx.actor.staffId ?? null }).where('id', '=', before.consultation_service_item_id).execute();
    }
    ctx.audit({ action: diff.status ? 'status_change' : 'update', subjectType: 'catalog.healthcare_service', subjectId: before.id, diff });
    return { healthcareServiceId: before.id, version };
  });
}

/** The service's default fee (or a doctor's own fee when staffId is given) from a date. */
export async function setServiceFee(
  db: Kysely<DB>,
  caller: Caller,
  input: { healthcareServiceId: string; staffId?: string | null | undefined; mode: PriceMode; feeMinor: number | null; effectiveFrom: string },
) {
  return runCommand(db, { ...caller, module: 'catalog', name: 'catalog.set_fee' }, async (ctx) => {
    const svc = await ctx.tx
      .selectFrom('catalog.healthcare_service as hs')
      .innerJoin('platform.department as d', 'd.id', 'hs.department_id')
      .select(['hs.consultation_service_item_id as itemId', 'hs.status', 'd.facility_id as facilityId'])
      .where('hs.id', '=', input.healthcareServiceId)
      .executeTakeFirst();
    if (!svc) throw notFound('service', { healthcareServiceId: input.healthcareServiceId });
    if (!svc.itemId) throw preconditionFailed('this service has no billing item');
    const today = await facilityToday(ctx.tx, svc.facilityId, clock(caller));
    if (input.effectiveFrom < today) throw invalid("a fee can't start in the past", { reason: 'past_date', today });
    if (input.staffId) {
      const { rows } = await sql`
        SELECT 1 FROM catalog.practitioner_affiliation WHERE staff_id = ${input.staffId} AND facility_id = ${svc.facilityId}
          AND (valid_to IS NULL OR valid_to > ${input.effectiveFrom}::date) LIMIT 1`.execute(ctx.tx);
      if (!rows.length) throw preconditionFailed("the doctor doesn't work at this service's clinic on that date", { reason: 'not_affiliated' });
    }
    const result = await publishPrice(ctx, { serviceItemId: svc.itemId, staffId: input.staffId ?? null, mode: input.mode, feeMinor: input.feeMinor, effectiveFrom: input.effectiveFrom });
    return { healthcareServiceId: input.healthcareServiceId, ...result };
  });
}

/**
 * Price book for one clinic on a date: each service's default fees and the doctor-specific fees of the
 * doctors affiliated there, as booking prices them (staff-specific beats generic, mode-specific beats any).
 */
export async function facilityPriceBook(db: Kysely<DB>, caller: Caller, facilityId: string, on: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<{ healthcareServiceId: string; staffId: string | null; mode: PriceMode; feeMinor: number; validFrom: string; validTo: string | null }>`
      SELECT hs.id AS "healthcareServiceId", pli.staff_id AS "staffId",
             CASE pli.encounter_class WHEN 'outpatient' THEN 'in_person' WHEN 'virtual' THEN 'virtual' ELSE 'any' END AS mode,
             pli.unit_price_minor::int AS "feeMinor", pli.valid_from::text AS "validFrom", pli.valid_to::text AS "validTo"
      FROM catalog.healthcare_service hs
      JOIN platform.department d ON d.id = hs.department_id
      JOIN catalog.price_list_item pli ON pli.service_item_id = hs.consultation_service_item_id
      JOIN catalog.price_list pl ON pl.id = pli.price_list_id AND pl.status = 'active' AND pl.is_default
      WHERE d.facility_id = ${facilityId} AND pli.bed_category_id IS NULL
        AND (pli.valid_to IS NULL OR pli.valid_to > ${on}::date)
        AND (pli.staff_id IS NULL OR EXISTS (SELECT 1 FROM catalog.practitioner_affiliation pa WHERE pa.staff_id = pli.staff_id AND pa.facility_id = d.facility_id))
      ORDER BY hs.name, pli.staff_id NULLS FIRST, pli.valid_from`.execute(tx);
    return { facilityId, on, items: rows };
  });
}
