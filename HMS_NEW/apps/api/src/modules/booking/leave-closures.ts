// A doctor's approved full-day leave closes their bookable calendar on those days (schedule exceptions
// linked to the leave request); cancelling the leave revokes them. Appointments already booked are not
// moved — the approver was told how many there are, and the existing calendar alerts show them.
import { sql, type DB, type Transaction } from '@hms/db';
import { writeAudit } from '@hms/platform';

export async function closeCalendarForLeave(
  tx: Transaction<DB>, tenantId: string, leave: { leaveRequestId: string; staffId: string; startsOn: string; endsOn: string; halfDay: string }, correlationId: string | null,
) {
  if (leave.halfDay !== 'none') return 0;
  const resource = await tx.selectFrom('booking.schedulable_resource').select('id').where('staff_id', '=', leave.staffId).where('is_active', '=', true).executeTakeFirst();
  if (!resource) return 0;
  const { rows } = await sql<{ id: string }>`
    INSERT INTO booking.schedule_exception (tenant_id, resource_id, on_date, kind, reason, leave_request_id)
    SELECT ${tenantId}, ${resource.id}, d::date, 'closed', 'On leave', ${leave.leaveRequestId}
    FROM generate_series(${leave.startsOn}::date, ${leave.endsOn}::date, interval '1 day') AS d
    WHERE NOT EXISTS (SELECT 1 FROM booking.schedule_exception e WHERE e.leave_request_id = ${leave.leaveRequestId} AND e.on_date = d::date AND e.revoked_at IS NULL)
    RETURNING id`.execute(tx);
  if (rows.length) {
    await writeAudit(tx, tenantId, { kind: 'system' }, correlationId, [
      { action: 'create', subjectType: 'booking.schedule_exception', reason: 'leave approved', diff: { leaveRequestId: leave.leaveRequestId, days: rows.length } },
    ]);
  }
  return rows.length;
}

export async function reopenCalendarAfterLeave(tx: Transaction<DB>, tenantId: string, leaveRequestId: string, correlationId: string | null) {
  const revoked = await tx.updateTable('booking.schedule_exception').set({ revoked_at: sql`now()`, revoke_reason: 'leave cancelled' })
    .where('leave_request_id', '=', leaveRequestId).where('revoked_at', 'is', null).returning('id').execute();
  if (revoked.length) {
    await writeAudit(tx, tenantId, { kind: 'system' }, correlationId, [
      { action: 'status_change', subjectType: 'booking.schedule_exception', reason: 'leave cancelled', diff: { leaveRequestId, days: revoked.length } },
    ]);
  }
}
