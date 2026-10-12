// Facilities and practitioners for booking screens and channels.
import type { DB, Kysely } from '@hms/db';
import { runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';

export async function listFacilities(db: Kysely<DB>, caller: Caller, opts: { includeInactive?: boolean } = {}) {
  return runQuery(db, caller.tenantId, (tx) => {
    let q = tx.selectFrom('platform.facility').select(['id as facilityId', 'code', 'name', 'facility_type as facilityType', 'city', 'timezone', 'status']);
    if (!opts.includeInactive) q = q.where('status', '=', 'active');
    return q.orderBy('name').execute();
  });
}

/** Reference specialties for pickers (global data). */
export async function listSpecialties(db: Kysely<DB>, caller: Caller) {
  return runQuery(db, caller.tenantId, (tx) =>
    tx.selectFrom('catalog.specialty').select(['code', 'name']).where('status', '=', 'active').orderBy('name').execute(),
  );
}

export async function listPractitioners(db: Kysely<DB>, caller: Caller, filter: { facilityId?: string | undefined; specialty?: string | undefined }) {
  return runQuery(db, caller.tenantId, async (tx) => {
    let q = tx
      .selectFrom('platform.staff as s')
      .innerJoin('catalog.practitioner_affiliation as pa', 'pa.staff_id', 's.id')
      .innerJoin('platform.department as d', 'd.id', 'pa.department_id')
      .leftJoin('catalog.practitioner_profile as pp', 'pp.staff_id', 's.id')
      .leftJoin('catalog.specialty as sp', 'sp.id', 'pp.specialty_id')
      .leftJoin('booking.schedulable_resource as sr', 'sr.staff_id', 's.id')
      .select([
        's.id as staffId',
        's.display_name as name',
        'sp.code as specialty',
        'sp.name as specialtyName',
        'pa.facility_id as facilityId',
        'd.name as department',
        'pp.accepts_virtual as acceptsVirtual',
        'sr.id as calendarId',
      ])
      .where('s.status', '=', 'active')
      .where('s.is_system_account', '=', false)
      .where('pa.valid_from', '<=', new Date().toISOString().slice(0, 10))
      .where((eb) => eb.or([eb('pa.valid_to', 'is', null), eb('pa.valid_to', '>', new Date().toISOString().slice(0, 10))]));
    if (filter.facilityId) q = q.where('pa.facility_id', '=', filter.facilityId);
    if (filter.specialty) q = q.where('sp.code', '=', filter.specialty);
    return q.orderBy('s.display_name').execute();
  });
}

/**
 * A clinic's active departments, the services they offer, and its consult rooms. Managers editing the
 * catalogue also get switched-off rows (`includeInactive`); every row carries its status and version.
 */
export async function facilityDirectory(db: Kysely<DB>, caller: Caller, facilityId: string, opts: { includeInactive?: boolean } = {}) {
  const all = !!opts.includeInactive;
  return runQuery(db, caller.tenantId, async (tx) => {
    const [departments, services, consultRooms] = await Promise.all([
      tx
        .selectFrom('platform.department as d')
        .leftJoin('catalog.specialty as sp', 'sp.id', 'd.specialty_id')
        .select(['d.id as departmentId', 'd.code', 'd.name', 'd.kind', 'sp.code as specialty', 'sp.name as specialtyName', 'd.status', 'd.version'])
        .where('d.facility_id', '=', facilityId)
        .where((eb) => (all ? eb.lit(true) : eb('d.status', '=', 'active')))
        .orderBy('d.name')
        .execute(),
      tx
        .selectFrom('catalog.healthcare_service as hs')
        .innerJoin('platform.department as d', 'd.id', 'hs.department_id')
        .select([
          'hs.id as healthcareServiceId', 'hs.code', 'hs.name', 'hs.department_id as departmentId', 'hs.service_mode as serviceMode',
          'hs.default_duration_min as defaultDurationMin', 'hs.is_public as isPublic', 'hs.status', 'hs.version',
        ])
        .where('d.facility_id', '=', facilityId)
        .where((eb) => (all ? eb.lit(true) : eb.and([eb('hs.status', '=', 'active'), eb('d.status', '=', 'active')])))
        .orderBy('hs.name')
        .execute(),
      tx
        .selectFrom('platform.location')
        .select(['id as locationId', 'code', 'name', 'department_id as departmentId', 'status', 'version'])
        .where('facility_id', '=', facilityId)
        .where('kind', '=', 'consult_room')
        .where((eb) => (all ? eb.lit(true) : eb('status', '=', 'active')))
        .orderBy('name')
        .execute(),
    ]);
    return { facilityId, departments, services, consultRooms };
  });
}
