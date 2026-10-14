// Read-only evidence for an exact published slot. This neither holds capacity nor promises a booking.
import { sql, type DB, type Kysely } from '@hms/db';
import type { BookingReadiness, BookingReadinessQuery } from '@hms/contracts';
import { notFound, runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { consultationFee } from './appointments.ts';

export async function bookingReadiness(db: Kysely<DB>, caller: Caller, input: BookingReadinessQuery): Promise<BookingReadiness> {
  const now = clock(caller);
  return runQuery(db, caller.tenantId, async (tx) => {
    const start = new Date(input.slotStart);
    const clinic = await tx.selectFrom('platform.facility').select(['status', 'timezone']).where('id', '=', input.facilityId).executeTakeFirst();
    if (!clinic) throw notFound('facility');
    const doctor = await tx.selectFrom('platform.staff as s')
      .leftJoin('booking.schedulable_resource as sr', (j) => j.onRef('sr.staff_id', '=', 's.id').on('sr.is_active', '=', true))
      .leftJoin('catalog.practitioner_profile as pp', 'pp.staff_id', 's.id')
      .select(['s.status', 's.staff_type', 'sr.id as resourceId', 'pp.accepts_virtual'])
      .where('s.id', '=', input.staffId).executeTakeFirst();
    if (!doctor) throw notFound('practitioner');
    const { rows: [date] } = await sql<{ day: string }>`SELECT (${start}::timestamptz AT TIME ZONE ${clinic.timezone})::date::text AS day`.execute(tx);
    const day = date!.day;
    const affiliated = await tx.selectFrom('catalog.practitioner_affiliation').select('id')
      .where('staff_id', '=', input.staffId).where('facility_id', '=', input.facilityId)
      .where('valid_from', '<=', day).where((e) => e.or([e('valid_to', 'is', null), e('valid_to', '>', day)]))
      .executeTakeFirst();
    // Return the same 404 for an unrelated or tenant-hidden doctor; do not expose other clinics' calendars.
    if (!affiliated) throw notFound('practitioner at facility');
    const issues: BookingReadiness['configuration']['issues'] = [];
    if (clinic.status !== 'active') issues.push('clinic_inactive');
    if (doctor.status !== 'active' || !['doctor'].includes(doctor.staff_type)) issues.push('doctor_inactive');
    if (input.visitMode === 'virtual' && !doctor.accepts_virtual) issues.push('virtual_not_enabled');
    const { rows: sessions } = doctor.resourceId ? await sql<{
      session_on: string; healthcare_service_id: string | null; visit_mode: string;
      starts_at: Date; ends_at: Date; source: 'weekly' | 'day_plan' | 'extra_hours';
    }>`SELECT session_on::text, healthcare_service_id, visit_mode, starts_at, ends_at, source
       FROM booking.sessions(${doctor.resourceId}, ${day}::date, ${day}::date)
       WHERE facility_id=${input.facilityId} AND starts_at <= ${start} AND ends_at > ${start}`.execute(tx) : { rows: [] };
    // Booking resolves the containing session without substituting a different mode/service.
    const session = sessions[0] ?? null;
    const matchingSession = !!session && session.visit_mode === input.visitMode && session.healthcare_service_id === input.healthcareServiceId;
    if (!session || session.visit_mode !== input.visitMode) issues.push('session_not_found');
    if (!input.healthcareServiceId) issues.push('service_not_selected');
    else if (!matchingSession) issues.push('service_not_in_session');
    let compatibleService = false;
    if (input.healthcareServiceId) {
      const service = await tx.selectFrom('catalog.healthcare_service as hs')
        .innerJoin('platform.department as d', 'd.id', 'hs.department_id')
        .leftJoin('catalog.service_item as si', 'si.id', 'hs.consultation_service_item_id')
        .select(['hs.status', 'hs.service_mode', 'd.status as departmentStatus', 'd.facility_id', 'si.status as itemStatus'])
        .where('hs.id', '=', input.healthcareServiceId)
        .where(sql<boolean>`EXISTS (SELECT 1 FROM catalog.practitioner_affiliation pa
          WHERE pa.staff_id=${input.staffId} AND pa.department_id=hs.department_id AND pa.facility_id=${input.facilityId}
            AND pa.valid_from<=${day}::date AND (pa.valid_to IS NULL OR pa.valid_to>${day}::date))`).executeTakeFirst();
      compatibleService = !!service && service.facility_id === input.facilityId && service.status === 'active' && service.departmentStatus === 'active' &&
        service.itemStatus === 'active' && (service.service_mode === input.visitMode || service.service_mode === 'both');
      if (!compatibleService) issues.push('service_inactive_or_incompatible');
    }
    const fee = matchingSession && compatibleService
      ? await consultationFee(tx, input.healthcareServiceId, input.staffId, day, input.visitMode) : null;
    if (matchingSession && compatibleService && !fee) issues.push('fee_not_recorded');
    // The same authoritative slot function used by holds; this never changes reservations.
    const { rows: [slot] } = doctor.resourceId ? await sql<{ slot_end: Date; status: 'free' | 'taken' | 'blocked' }>`
      SELECT slot_end, status FROM booking.available_slots(${doctor.resourceId}, ${day}::date, ${day}::date, ${now})
      WHERE facility_id=${input.facilityId} AND slot_start=${start} AND visit_mode=${input.visitMode}
        AND healthcare_service_id IS NOT DISTINCT FROM ${input.healthcareServiceId}::uuid`.execute(tx) : { rows: [] };
    const occupancy = start < now && matchingSession ? 'past' : slot?.status ?? 'not_a_slot';
    return {
      ...input, slotStart: start.toISOString(), checkedAt: now.toISOString(), sessionOn: day,
      slotEnd: slot?.slot_end.toISOString() ?? null,
      session: matchingSession ? { startsAt: session!.starts_at.toISOString(), endsAt: session!.ends_at.toISOString(), source: session!.source } : null,
      configuration: { complete: issues.length === 0, issues },
      fee: fee ? { priceListItemId: fee.priceListItemId, feeMinor: fee.unitPriceMinor, pricedOn: day } : null,
      occupancy, slotCanBeHeld: occupancy === 'free' && matchingSession,
      guarantee: 'revalidated_on_write',
      separateChecks: { videoProvider: 'not_checked', videoConsent: 'not_checked', signingEligibility: 'not_checked', walkInCapacity: 'not_applicable' },
    };
  });
}
