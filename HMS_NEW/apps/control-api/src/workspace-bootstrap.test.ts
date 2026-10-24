import { test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { config } from '../../../db/scripts/config.mjs';
test('workspace setup preserves facility type and timezone in the real bootstrap',async()=>{
 const tenantId=randomUUID(),facilityId=randomUUID();
 const result=spawnSync(process.execPath,['db/scripts/bootstrap-runtime.mjs'],{encoding:'utf8',env:{
  ...process.env,ADMIN_DATABASE_URL:config.adminUrl,DATABASE_URL:config.testDatabaseUrl,APP_DATABASE_URL:config.testAppDatabaseUrl,
  TENANT_BOOTSTRAP:'custom',TENANT_SLUG:`setup-${tenantId.slice(0,8)}`,TENANT_PLAN:'launch',TENANT_CLINIC_MODULES:'billing',VOICE_REQUESTED:'0',AUTH_MODE:'oidc',
  BOOTSTRAP_TENANT_ID:tenantId,BOOTSTRAP_FACILITY_ID:facilityId,BOOTSTRAP_TENANT_NAME:'Setup Hospital',BOOTSTRAP_OWNER_NAME:'Local Owner',BOOTSTRAP_OWNER_EMAIL:'local@example.test',BOOTSTRAP_FACILITY_NAME:'Test Hospital',BOOTSTRAP_CITY:'Dubai',BOOTSTRAP_FACILITY_TYPE:'hospital',BOOTSTRAP_TIMEZONE:'Asia/Dubai',MANAGED_BOOKING_STAFF_ID:randomUUID(),
 }});
 expect(result.status,result.stderr).toBe(0);
 const pool=new pg.Pool({connectionString:config.testDatabaseUrl});
 try{
  const row=await pool.query('SELECT facility_type,timezone FROM platform.facility WHERE id=$1',[facilityId]);expect(row.rows[0]).toEqual({facility_type:'hospital',timezone:'Asia/Dubai'});
  const access=await pool.query('SELECT module_code,state FROM platform.module_state WHERE tenant_id=$1',[tenantId]);expect(access.rows).toContainEqual({module_code:'billing',state:'configured'});expect(access.rows.some(row=>row.module_code==='hr'||row.module_code==='inpatient')).toBe(false);
 }finally{await pool.end();}
});
