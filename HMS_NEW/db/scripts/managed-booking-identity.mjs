// Reconciled by the privileged migration process, never by a customer's browser.
export async function ensureManagedBookingIdentity(client, { tenantId, facilityId, staffId }) {
  await client.query('BEGIN');
  try {
    const { rows } = await client.query('SELECT id FROM platform.facility WHERE id=$1 AND tenant_id=$2 AND status=\'active\'', [facilityId, tenantId]);
    if (!rows.length) throw new Error('Managed booking requires an active facility in this tenant');
    await client.query(
      `INSERT INTO platform.staff(id,tenant_id,employee_no,given_name,display_name,staff_type,is_system_account)
       VALUES($1,$2,'MANAGED-BOOKING','Booking','Online booking assistant','other',true)
       ON CONFLICT(id) DO NOTHING`, [staffId, tenantId]);
    const { rows: [staff] } = await client.query('SELECT id FROM platform.staff WHERE id=$1 AND tenant_id=$2 AND is_system_account AND status=\'active\'', [staffId, tenantId]);
    if (!staff) throw new Error('Managed booking identity does not match this tenant');
    await client.query(
      `INSERT INTO platform.user_account(tenant_id,staff_id,identity_issuer,identity_subject,status)
       VALUES($1::uuid,$2::uuid,'hms-managed-booking',$1::uuid::text,'active')
       ON CONFLICT DO NOTHING`, [tenantId, staffId]);
    const { rows: [account] } = await client.query(
      `SELECT id FROM platform.user_account WHERE tenant_id=$1 AND staff_id=$2
       AND identity_issuer='hms-managed-booking' AND identity_subject=$1::uuid::text AND status='active'`, [tenantId, staffId]);
    if (!account) throw new Error('Managed booking account binding is inconsistent');
    await client.query(
      `INSERT INTO platform.role_grant(tenant_id,staff_id,role_id,facility_id)
       SELECT $1,$2,r.id,$3 FROM platform.role r WHERE r.tenant_id IS NULL AND r.code='booking_agent'
       AND NOT EXISTS(SELECT 1 FROM platform.role_grant g WHERE g.tenant_id=$1 AND g.staff_id=$2 AND g.role_id=r.id AND g.facility_id=$3 AND g.revoked_at IS NULL)`,
      [tenantId, staffId, facilityId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
