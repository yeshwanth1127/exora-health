// Synthetic clinic fixture shared by the local demo and the real-Postgres integration tests.
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
export async function createAppleDemoClinic(admin: pg.Pool) {
  const one = async (text: string, values: unknown[]) =>
    String((await admin.query(text, values)).rows[0].id);
  const tenantId = await one(
    "INSERT INTO platform.tenant(name,slug,status,default_currency) VALUES('Apple demo clinic (synthetic)',$1,'active','USD') RETURNING id",
    ['apple-demo-' + randomUUID().slice(0, 8)],
  );
  const organizationId = await one(
    "INSERT INTO platform.organization(tenant_id,name,org_type) VALUES($1,'Synthetic demo','clinic') RETURNING id",
    [tenantId],
  );
  const facilityId = await one(
    "INSERT INTO platform.facility(tenant_id,organization_id,code,name,facility_type,state_code,timezone) VALUES($1,$2,'DEMO','Apple demo clinic (synthetic)','clinic','29','America/New_York') RETURNING id",
    [tenantId, organizationId],
  );
  const staff = async (name: string, type: string, system = false) =>
    one(
      'INSERT INTO platform.staff(tenant_id,employee_no,given_name,display_name,staff_type,is_system_account) VALUES($1,$2,$3,$3,$4,$5) RETURNING id',
      [tenantId, randomUUID(), name, type, system],
    );
  const ownerStaffId = await staff('Demo receptionist', 'admin'),
    doctorId = await staff('Dr Demo', 'doctor'),
    integrationId = await staff('Apple booking integration', 'other', true);
  const ownerSubject = 'apple-demo-owner-' + randomUUID();
  await admin.query(
    "INSERT INTO platform.user_account(tenant_id,staff_id,identity_issuer,identity_subject,status) VALUES($1::uuid,$2,'local-dev',$3,'active'),($1::uuid,$4,'apple-demo-booking',$1::text,'active')",
    [tenantId, ownerStaffId, ownerSubject, integrationId],
  );
  await admin.query(
    "INSERT INTO platform.role_grant(tenant_id,staff_id,role_id,facility_id) SELECT $1::uuid,$2::uuid,id,NULL::uuid FROM platform.role WHERE tenant_id IS NULL AND code='tenant_admin' UNION ALL SELECT $1::uuid,$3::uuid,id,$4::uuid FROM platform.role WHERE tenant_id IS NULL AND code='front_desk'",
    [tenantId, ownerStaffId, integrationId, facilityId],
  );
  const department = await one(
    "INSERT INTO platform.department(tenant_id,facility_id,code,name,kind) VALUES($1,$2,'MED','General medicine','clinical') RETURNING id",
    [tenantId, facilityId],
  );
  const item = await one(
    "INSERT INTO catalog.service_item(tenant_id,code,name,category) VALUES($1,'CONS','Demo consultation','consultation') RETURNING id",
    [tenantId],
  );
  const service = await one(
    "INSERT INTO catalog.healthcare_service(tenant_id,department_id,code,name,service_mode,consultation_service_item_id) VALUES($1,$2,'CONS','Demo consultation','in_person',$3) RETURNING id",
    [tenantId, department, item],
  );
  const priceList = await one(
    "INSERT INTO catalog.price_list(tenant_id,code,name,kind,is_default,valid_from,currency) VALUES($1,'CASH','Demo USD fee','cash',true,'2020-01-01','USD') RETURNING id",
    [tenantId],
  );
  await admin.query(
    "INSERT INTO catalog.price_list_item(tenant_id,price_list_id,service_item_id,unit_price_minor,valid_from) VALUES($1,$2,$3,12500,'2020-01-01')",
    [tenantId, priceList, item],
  );
  await admin.query(
    "UPDATE catalog.price_list SET status='active',activated_at=now() WHERE id=$1",
    [priceList],
  );
  await admin.query(
    "INSERT INTO catalog.practitioner_profile(tenant_id,staff_id,published,public_slug,accepts_virtual) VALUES($1,$2,true,'dr-demo',false)",
    [tenantId, doctorId],
  );
  await admin.query(
    "INSERT INTO catalog.practitioner_affiliation(tenant_id,staff_id,facility_id,department_id,valid_from) VALUES($1,$2,$3,$4,'2020-01-01')",
    [tenantId, doctorId, facilityId, department],
  );
  const resource = await one(
    "INSERT INTO booking.schedulable_resource(tenant_id,staff_id,kind,name) VALUES($1,$2,'practitioner','Demo doctor') RETURNING id",
    [tenantId, doctorId],
  );
  for (let weekday = 1; weekday <= 7; weekday++)
    await admin.query(
      "INSERT INTO booking.schedule_rule(tenant_id,resource_id,facility_id,weekday,start_local,end_local,slot_minutes,healthcare_service_id,visit_mode,effective_from) VALUES($1,$2,$3,$4,'09:00','17:00',30,$5,'in_person','2020-01-01')",
      [tenantId, resource, facilityId, weekday, service],
    );
  for (const module of ['booking', 'comms'])
    await admin.query(
      "INSERT INTO platform.module_state(tenant_id,module_code,state) VALUES($1,$2,'active') ON CONFLICT(tenant_id,module_code) DO UPDATE SET state='active'",
      [tenantId, module],
    );
  return {
    tenantId,
    organizationId,
    facilityId,
    ownerStaffId,
    ownerSubject,
    doctorId,
    service,
    priceList,
    site: {
      siteSlug: 'apple-demo',
      tenantId,
      facilityId,
      identityIssuer: 'apple-demo-booking',
      identitySubject: tenantId,
      origins: ['http://127.0.0.1:5209'],
      websiteBranchId: null,
      doctorAliases: {},
    },
  };
}
