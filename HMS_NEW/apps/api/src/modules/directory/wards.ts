// Inpatient setup: bed categories (what a bed is billed as), wards and beds (platform.location rows, a
// bed always under a ward), and each category's daily bed price on the default price list. Who is in a
// bed and its housekeeping state belong to the inpatient module.
import { sql, type DB, type Kysely } from '@hms/db';
import { conflict, invalid, notFound, pgCode, preconditionFailed, runCommand, runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';
import { publishPrice } from './pricing.ts';

const duplicate = (err: unknown, what: string) => {
  if (pgCode(err) === '23505') return conflict(`another ${what} uses that code`, { reason: 'duplicate_code' });
  return null;
};

export async function listBedCategories(db: Kysely<DB>, caller: Caller) {
  return runQuery(db, caller.tenantId, (tx) => tx.selectFrom('catalog.bed_category').select(['id as bedCategoryId', 'code', 'name', 'rank', 'is_icu as isIcu', 'status', 'version']).orderBy('rank').orderBy('name').execute());
}

export async function createBedCategory(db: Kysely<DB>, caller: Caller, input: { code: string; name: string; rank: number; isIcu: boolean }, idempotencyKey: string) {
  return runCommand(db, { ...caller, module: 'catalog', name: 'catalog.create_bed_category', idempotencyKey, request: input }, async (ctx) => {
    try {
      const r = await ctx.tx.insertInto('catalog.bed_category').values({ tenant_id: ctx.tenantId, code: input.code, name: input.name, rank: input.rank, is_icu: input.isIcu, created_by: ctx.actor.staffId ?? null })
        .returning(['id', 'version']).executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'catalog.bed_category', subjectId: r.id, diff: input });
      return { bedCategoryId: r.id, version: r.version };
    } catch (err) {
      throw duplicate(err, 'bed category') ?? err;
    }
  });
}

/**
 * Sets a bed category's daily price from a date on the default cash list (a new list version, like a
 * consultation fee). The tenant's 'BED-DAY' service item is created the first time.
 */
export async function setBedPrice(db: Kysely<DB>, caller: Caller, input: { bedCategoryId: string; priceMinor: number | null; effectiveFrom: string }, idempotencyKey: string) {
  return runCommand(db, { ...caller, module: 'catalog', name: 'catalog.set_bed_price', idempotencyKey, request: input }, async (ctx) => {
    const cat = await ctx.tx.selectFrom('catalog.bed_category').select(['id', 'status']).where('id', '=', input.bedCategoryId).executeTakeFirst();
    if (!cat) throw notFound('bed category', { bedCategoryId: input.bedCategoryId });
    await ctx.tx.insertInto('catalog.service_item').values({ tenant_id: ctx.tenantId, code: 'BED-DAY', name: 'Bed charges', category: 'bed_day', is_orderable: false, created_by: ctx.actor.staffId ?? null })
      .onConflict((oc) => oc.columns(['tenant_id', 'code']).doNothing()).execute();
    const service = await ctx.tx.selectFrom('catalog.service_item').select(['id', 'category']).where('code', '=', 'BED-DAY').executeTakeFirstOrThrow();
    if (service.category !== 'bed_day') throw preconditionFailed('the BED-DAY service is not a bed-day service', { reason: 'bed_day_item_mismatch' });
    const published = await publishPrice(ctx, { serviceItemId: service.id, staffId: null, mode: 'any', feeMinor: input.priceMinor, effectiveFrom: input.effectiveFrom, bedCategoryId: cat.id });
    return { ...published, bedCategoryId: cat.id, priceMinor: input.priceMinor };
  });
}

export async function createWard(
  db: Kysely<DB>, caller: Caller,
  input: { facilityId: string; code: string; name: string; wardType: string; departmentId?: string | undefined; genderRestriction?: 'male' | 'female' | 'any' | undefined },
  idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.create_ward', idempotencyKey, request: input }, async (ctx) => {
    try {
      const r = await ctx.tx.insertInto('platform.location').values({
        tenant_id: ctx.tenantId, facility_id: input.facilityId, kind: 'ward', code: input.code, name: input.name, ward_type: input.wardType as never,
        department_id: input.departmentId ?? null, gender_restriction: input.genderRestriction ?? 'any', created_by: ctx.actor.staffId ?? null,
      }).returning(['id', 'version']).executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'platform.location', subjectId: r.id, diff: { kind: 'ward', ...input } });
      return { wardId: r.id, version: r.version };
    } catch (err) {
      if (pgCode(err) === '23503') throw invalid('the department must belong to the same clinic', { reason: 'department_mismatch' });
      throw duplicate(err, 'room, ward or bed at this clinic') ?? err;
    }
  });
}

export async function createBed(
  db: Kysely<DB>, caller: Caller, input: { wardId: string; code: string; name: string; bedCategoryId: string }, idempotencyKey: string,
) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.create_bed', idempotencyKey, request: input }, async (ctx) => {
    const ward = await ctx.tx.selectFrom('platform.location').select(['id', 'facility_id', 'kind', 'status']).where('id', '=', input.wardId).executeTakeFirst();
    if (!ward || ward.kind !== 'ward') throw notFound('ward', { wardId: input.wardId });
    if (ward.status !== 'active') throw preconditionFailed('the ward is switched off', { reason: 'ward_inactive' });
    try {
      const r = await ctx.tx.insertInto('platform.location').values({
        tenant_id: ctx.tenantId, facility_id: ward.facility_id, parent_location_id: ward.id, kind: 'bed', code: input.code, name: input.name,
        bed_category_id: input.bedCategoryId, created_by: ctx.actor.staffId ?? null,
      }).returning(['id', 'version']).executeTakeFirstOrThrow();
      ctx.audit({ action: 'create', subjectType: 'platform.location', subjectId: r.id, diff: { kind: 'bed', ...input } });
      return { bedId: r.id, version: r.version };
    } catch (err) {
      if (pgCode(err) === '23503') throw invalid('unknown bed category', { reason: 'bed_category_unknown' });
      throw duplicate(err, 'room, ward or bed at this clinic') ?? err;
    }
  });
}

/** Renames a bed, changes what it is billed as, or switches it off (not while occupied). */
export async function updateBed(
  db: Kysely<DB>, caller: Caller, input: { bedId: string; version: number; name?: string | undefined; bedCategoryId?: string | undefined; status?: 'active' | 'inactive' | undefined },
  idempotencyKey?: string,
) {
  return runCommand(db, { ...caller, module: 'platform', name: 'platform.update_bed', idempotencyKey, request: input }, async (ctx) => {
    const bed = await ctx.tx.selectFrom('platform.location').selectAll().where('id', '=', input.bedId).where('kind', '=', 'bed').forUpdate().executeTakeFirst();
    if (!bed) throw notFound('bed', { bedId: input.bedId });
    if (bed.version !== input.version) throw conflict('this bed was changed by someone else; reload and try again', { reason: 'stale_version', currentVersion: bed.version });
    if (input.status === 'inactive') {
      const { rows: [occ] } = await sql<{ n: number }>`SELECT count(*)::int AS n FROM inpatient.bed_occupancy WHERE bed_location_id = ${bed.id} AND upper_inf(period)`.execute(ctx.tx);
      if (occ!.n) throw preconditionFailed('the bed is occupied', { reason: 'bed_occupied' });
    }
    const set = Object.fromEntries(Object.entries({ name: input.name, bed_category_id: input.bedCategoryId, status: input.status }).filter(([, v]) => v !== undefined));
    if (!Object.keys(set).length) return { bedId: bed.id, version: bed.version };
    const { version } = await ctx.tx.updateTable('platform.location').set({ ...set, updated_by: ctx.actor.staffId ?? null }).where('id', '=', bed.id).returning('version').executeTakeFirstOrThrow();
    ctx.audit({ action: input.status ? 'status_change' : 'update', subjectType: 'platform.location', subjectId: bed.id, diff: set });
    return { bedId: bed.id, version };
  });
}

export async function wardFacility(db: Kysely<DB>, caller: Caller, wardId: string) {
  return runQuery(db, caller.tenantId, async (tx) => (await tx.selectFrom('platform.location').select('facility_id').where('id', '=', wardId).where('kind', '=', 'ward').executeTakeFirst())?.facility_id);
}
