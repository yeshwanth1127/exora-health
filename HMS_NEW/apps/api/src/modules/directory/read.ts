// Facilities and practitioners for booking screens and channels.
import type { DB, Kysely } from '@hms/db';
import { runQuery } from '@hms/platform';
import type { Caller } from '../../caller.ts';

export async function listFacilities(db: Kysely<DB>, caller: Caller) {
  return runQuery(db, caller.tenantId, (tx) =>
    tx
      .selectFrom('platform.facility')
      .select(['id as facilityId', 'code', 'name', 'facility_type as facilityType', 'city', 'timezone'])
      .where('status', '=', 'active')
      .orderBy('name')
      .execute(),
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
