import { sql, type DB, type Kysely } from '@hms/db';
import { notFound, runQuery } from '@hms/platform';
import { CommsSummarySchema } from '@hms/contracts';
import { clock, type Caller } from '../../caller.ts';

/** Clinic-local records only; counts never imply provider delivery. */
export async function notificationSummary(db: Kysely<DB>, caller: Caller, facilityId: string) {
  const now = clock(caller);
  return runQuery(db, caller.tenantId, async (tx) => {
    const facility = await tx.selectFrom('platform.facility').select('id').where('id', '=', facilityId).executeTakeFirst();
    if (!facility) throw notFound('facility');
    const state = (await tx.selectFrom('platform.module_state').select('state').where('module_code', '=', 'comms').executeTakeFirst())?.state ?? 'active';
    const { rows: [counts] } = await sql<{ scheduled: number; queued: number; skipped: number; cancelled: number }>`
      SELECT count(*) FILTER (WHERE status='scheduled' AND expires_at>${now})::int AS scheduled,
        count(*) FILTER (WHERE status='queued' AND expires_at>${now})::int AS queued,
        count(*) FILTER (WHERE status IN ('skipped','skipped_no_consent'))::int AS skipped,
        count(*) FILTER (WHERE status='cancelled')::int AS cancelled
      FROM comms.reminder_job WHERE facility_id=${facilityId}`.execute(tx);
    return CommsSummarySchema.parse({ facilityId, moduleStatus: state, transport: 'log', liveSending: false,
      asOf: now.toISOString(), counts, pending: state === 'active' || state === 'suspended' ? counts!.scheduled + counts!.queued : null });
  });
}
