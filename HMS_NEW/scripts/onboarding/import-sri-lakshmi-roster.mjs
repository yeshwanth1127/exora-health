// One-time catalog import into an explicitly provisioned clinic; never seeds fees or doctor hours.
import { readFile } from 'node:fs/promises';
import pg from 'pg';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tenant=process.env.SRI_LAKSHMI_TENANT_ID,facility=process.env.SRI_LAKSHMI_FACILITY_ID,url=process.env.SRI_LAKSHMI_ADMIN_DATABASE_URL;
if(!url || !uuid.test(tenant??'') || !uuid.test(facility??''))throw Error('Provide the exact admin database URL, tenant ID and Sri Lakshmi facility ID through environment variables.');
const archive=JSON.parse(await readFile(new URL('./sri-lakshmi-roster.json',import.meta.url),'utf8'));
const c=new pg.Client({connectionString:url});await c.connect();
const one=async(q,v)=>String((await c.query(q,v)).rows[0].id);
try {
 await c.query('BEGIN');
 await c.query("SELECT pg_advisory_xact_lock(hashtextextended('sri-lakshmi-roster:' || $1,0))",[tenant]);
 const clinic=(await c.query('SELECT name FROM platform.facility WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenant,facility])).rows[0];
 if(clinic?.name!==archive.clinic)throw Error('Target facility must be Sri Lakshmi Super Speciality Hospital. No import was made.');
 let imported=0,kept=0;
 for(const d of archive.doctors) {
  const employee=`SLH-${d.websiteId}`;
  const existing=(await c.query('SELECT id FROM platform.staff WHERE tenant_id=$1 AND employee_no=$2',[tenant,employee])).rows[0];
  // Re-running never overwrites changes made by hospital staff.
  if(existing){kept++;continue;}
  const department=await one(`INSERT INTO platform.department(tenant_id,facility_id,code,name,kind)
   VALUES($1,$2,$3,$4,'clinical') ON CONFLICT(tenant_id,facility_id,code) DO UPDATE SET code=EXCLUDED.code RETURNING id`,[tenant,facility,d.departmentSlug.toUpperCase(),d.departmentName]);
  const staff=await one(`INSERT INTO platform.staff(tenant_id,employee_no,given_name,display_name,staff_type)
   VALUES($1,$2,$3,$3,'doctor') RETURNING id`,[tenant,employee,d.name]);
  const slug=d.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const specialty=(await c.query('SELECT id FROM catalog.specialty WHERE code=$1 AND status=\'active\'',[d.departmentSlug])).rows[0]?.id??null;
  await c.query(`INSERT INTO catalog.practitioner_profile(tenant_id,staff_id,specialty_id,qualifications,bio,experience_years,
    languages,public_slug,published,accepts_virtual,public_photo_url) VALUES($1,$2,$3,'{}',$4,NULL,'{}',$5,true,false,$6)`,[tenant,staff,specialty,d.bio,slug,d.photoUrl]);
  await c.query(`INSERT INTO catalog.practitioner_affiliation(tenant_id,staff_id,facility_id,department_id,valid_from,role_title)
    VALUES($1,$2,$3,$4,$5,$6)`,[tenant,staff,facility,department,archive.collectedOn,d.roleTitle]);
  await c.query(`INSERT INTO booking.schedulable_resource(tenant_id,staff_id,kind,name) VALUES($1,$2,'practitioner',$3)`,[tenant,staff,d.name]);
  const item=await one(`INSERT INTO catalog.service_item(tenant_id,code,name,category) VALUES($1,$2,$3,'consultation')
    ON CONFLICT(tenant_id,code) DO UPDATE SET code=EXCLUDED.code RETURNING id`,[tenant,`SLH-${d.departmentSlug.toUpperCase()}`,`${d.departmentName} consultation`]);
  await c.query(`INSERT INTO catalog.healthcare_service(tenant_id,department_id,code,name,service_mode,consultation_service_item_id,is_public)
    VALUES($1,$2,$3,$4,'in_person',$5,true) ON CONFLICT(tenant_id,code) DO NOTHING`,[tenant,department,`SLH-${d.departmentSlug.toUpperCase()}`,`${d.departmentName} consultation`,item]);
  imported++;
 }
 await c.query('COMMIT');console.log(`Sri Lakshmi roster: ${imported} imported, ${kept} existing doctors preserved. No fees, weekly hours, virtual eligibility or patients were invented.`);
} catch(error){await c.query('ROLLBACK');throw error;}finally{await c.end();}
