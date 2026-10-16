// Idempotent database bootstrap for a tenant runtime container.
// Production provisioning runs migrations/reference seeds, enables the restricted application
// login, and then supplies a tenant-specific bootstrap. TENANT_BOOTSTRAP=demo exists only for the
// local Compose acceptance stack.
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { applySeeds, dbmate, enableLocalAppLogin } from './lib.mjs';
import { config } from './config.mjs';

dbmate(config.databaseUrl, ['up']);
await applySeeds(config.databaseUrl, [config.referenceSeedsDir]);
await enableLocalAppLogin();

if (process.env.TENANT_BOOTSTRAP === 'demo') {
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT count(*)::int AS count FROM platform.tenant');
    if (rows[0].count === 0) await applySeeds(config.databaseUrl, [config.devSeedsDir]);
  } finally {
    await client.end();
  }
}

if (process.env.TENANT_BOOTSTRAP === 'custom') {
  const required = (name) => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required for TENANT_BOOTSTRAP=custom`);
    return value;
  };
  const tenantName = required('BOOTSTRAP_TENANT_NAME');
  const slug = required('TENANT_SLUG');
  const ownerName = required('BOOTSTRAP_OWNER_NAME');
  const ownerEmail = required('BOOTSTRAP_OWNER_EMAIL').toLowerCase();
  const facilityName = required('BOOTSTRAP_FACILITY_NAME');
  const city = required('BOOTSTRAP_CITY');
  const plan = process.env.TENANT_PLAN ?? 'launch';
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) throw new Error('TENANT_SLUG is invalid');
  if (!['launch', 'connect', 'scale'].includes(plan)) throw new Error('TENANT_PLAN must be launch, connect, or scale');
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT id FROM platform.tenant WHERE slug=$1', [slug]);
    if (!rows.length) {
      const tenantId = process.env.BOOTSTRAP_TENANT_ID || randomUUID();
      const organisationId = randomUUID();
      const facilityId = process.env.BOOTSTRAP_FACILITY_ID || randomUUID();
      const staffId = randomUUID();
      const voiceRequested = process.env.VOICE_REQUESTED === '1';
      const voiceStaffId = voiceRequested ? required('VOICE_SERVICE_ACCOUNT_ID') : null;
      await client.query('BEGIN');
      try {
        await client.query(
          `INSERT INTO platform.tenant(id,name,slug,legal_name,status,plan_code)
           VALUES($1,$2,$3,$2,'trial',$4)`,
          [tenantId, tenantName, slug, plan],
        );
        await client.query(
          `INSERT INTO platform.organization(id,tenant_id,name,org_type)
           VALUES($1,$2,$3,'clinic')`,
          [organisationId, tenantId, tenantName],
        );
        await client.query(
          `INSERT INTO platform.facility(id,tenant_id,organization_id,code,name,facility_type,state_code,city,timezone)
           VALUES($1,$2,$3,'MAIN',$4,'clinic','29',$5,'Asia/Kolkata')`,
          [facilityId, tenantId, organisationId, facilityName, city],
        );
        await client.query(
          `INSERT INTO platform.staff(id,tenant_id,employee_no,given_name,display_name,email,staff_type)
           VALUES($1,$2,'ADMIN-001',$3,$3,$4,'admin')`,
          [staffId, tenantId, ownerName, ownerEmail],
        );
        await client.query(
          `INSERT INTO platform.user_account(tenant_id,staff_id,identity_issuer,identity_subject,email,status)
           VALUES($1,$2,'local-dev','admin',$3,'active')`,
          [tenantId, staffId, ownerEmail],
        );
        await client.query(
          `INSERT INTO platform.role_grant(tenant_id,staff_id,role_id)
           SELECT $1,$2,id FROM platform.role WHERE tenant_id IS NULL AND code='tenant_admin'`,
          [tenantId, staffId],
        );
        if (voiceStaffId) {
          await client.query(
            `INSERT INTO platform.staff(id,tenant_id,employee_no,given_name,display_name,staff_type,is_system_account)
             VALUES($1,$2,'VOICE-AGENT','Voice','Voice booking agent','other',true)`,
            [voiceStaffId, tenantId],
          );
          await client.query(
            `INSERT INTO platform.role_grant(tenant_id,staff_id,role_id)
             SELECT $1,$2,id FROM platform.role WHERE tenant_id IS NULL AND code='booking_agent'`,
            [tenantId, voiceStaffId],
          );
        }
        const active = ['platform', 'patient', 'catalog', 'booking', 'clinical'];
        if (plan !== 'launch') active.push('comms');
        await client.query(
          `INSERT INTO platform.module_state(tenant_id,module_code,state)
           SELECT $1,module,'active' FROM unnest($2::text[]) AS module`,
          [tenantId, active],
        );
        await client.query('COMMIT');
        console.log(`Provisioned tenant ${slug} (${tenantId})`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    // Voice can be enabled after the tenant already exists. Reconcile the system identity on every
    // container start instead of making it dependent on the first database bootstrap.
    if (process.env.VOICE_REQUESTED === '1') {
      const voiceStaffId = required('VOICE_SERVICE_ACCOUNT_ID');
      const { rows: [tenant] } = await client.query('SELECT id FROM platform.tenant WHERE slug=$1', [slug]);
      if (!tenant) throw new Error(`Tenant ${slug} was not found after bootstrap`);
      await client.query('BEGIN');
      try {
        await client.query(
          `INSERT INTO platform.staff(id,tenant_id,employee_no,given_name,display_name,staff_type,is_system_account)
           VALUES($1,$2,'VOICE-AGENT','Voice','Voice booking agent','other',true)
           ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,status='active',is_system_account=true`,
          [voiceStaffId, tenant.id],
        );
        await client.query(
          `INSERT INTO platform.role_grant(tenant_id,staff_id,role_id)
           SELECT $1,$2,r.id FROM platform.role r
           WHERE r.tenant_id IS NULL AND r.code='booking_agent'
             AND NOT EXISTS (SELECT 1 FROM platform.role_grant g WHERE g.tenant_id=$1 AND g.staff_id=$2 AND g.role_id=r.id AND g.revoked_at IS NULL)`,
          [tenant.id, voiceStaffId],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

console.log('Tenant runtime database is ready');
