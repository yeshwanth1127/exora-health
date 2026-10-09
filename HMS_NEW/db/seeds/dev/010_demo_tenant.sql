-- Local demo data. Fixed UUIDs make it easy to reference in requests and tests.
-- Beds are added in Phase 2, once bed categories exist.
INSERT INTO platform.tenant (id, name, slug, legal_name, status) VALUES
  ('01920000-0000-7000-8000-000000000001', 'Demo Health', 'demo-health', 'Demo Health Private Limited', 'active');

INSERT INTO platform.organization (id, tenant_id, name, org_type) VALUES
  ('01920000-0000-7000-8000-000000000010', '01920000-0000-7000-8000-000000000001', 'Demo Health Group', 'group');

INSERT INTO platform.facility (id, tenant_id, organization_id, code, name, facility_type, gstin, state_code, city, district, pincode) VALUES
  ('01920000-0000-7000-8000-000000000101', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000010',
   'BLR', 'Demo Health Bengaluru', 'hospital', '29ABCDE1234F1Z5', '29', 'Bengaluru', 'Bengaluru Urban', '560001'),
  ('01920000-0000-7000-8000-000000000102', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000010',
   'MAA', 'Demo Health Chennai', 'clinic', '33ABCDE1234F1Z9', '33', 'Chennai', 'Chennai', '600001');

INSERT INTO platform.department (id, tenant_id, facility_id, code, name, kind) VALUES
  ('01920000-0000-7000-8000-000000000201', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000101', 'GENMED', 'General Medicine', 'clinical'),
  ('01920000-0000-7000-8000-000000000202', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000101', 'PAED',   'Paediatrics',      'clinical'),
  ('01920000-0000-7000-8000-000000000203', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000101', 'LAB',    'Laboratory',       'diagnostic'),
  ('01920000-0000-7000-8000-000000000204', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000102', 'GENMED', 'General Medicine', 'clinical');

INSERT INTO platform.location (id, tenant_id, facility_id, parent_location_id, department_id, kind, code, name, ward_type) VALUES
  ('01920000-0000-7000-8000-000000000301', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000101', NULL, NULL, 'building', 'MAIN', 'Main Block', NULL),
  ('01920000-0000-7000-8000-000000000302', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000101', '01920000-0000-7000-8000-000000000301', NULL, 'floor', 'MAIN-1', 'First Floor', NULL),
  ('01920000-0000-7000-8000-000000000303', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000101', '01920000-0000-7000-8000-000000000302', '01920000-0000-7000-8000-000000000201', 'ward', 'W-GEN-1', 'General Ward 1', 'general'),
  ('01920000-0000-7000-8000-000000000304', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000101', '01920000-0000-7000-8000-000000000301', '01920000-0000-7000-8000-000000000201', 'consult_room', 'OPD-1', 'OPD Room 1', NULL),
  ('01920000-0000-7000-8000-000000000305', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000101', '01920000-0000-7000-8000-000000000301', NULL, 'counter', 'CASH-1', 'Cash Counter 1', NULL);

INSERT INTO platform.staff (id, tenant_id, employee_no, title, given_name, family_name, display_name, sex, staff_type, hpr_id) VALUES
  ('01920000-0000-7000-8000-000000000401', '01920000-0000-7000-8000-000000000001', 'E001', 'Dr', 'Asha',  'Rao',    'Dr Asha Rao',    'female', 'doctor', '71-0000-0000-0001'),
  ('01920000-0000-7000-8000-000000000402', '01920000-0000-7000-8000-000000000001', 'E002', 'Dr', 'Vikram','Iyer',   'Dr Vikram Iyer', 'male',   'doctor', '71-0000-0000-0002'),
  ('01920000-0000-7000-8000-000000000403', '01920000-0000-7000-8000-000000000001', 'E003', NULL, 'Meena', 'Kumari', 'Meena Kumari',   'female', 'nurse',  NULL),
  ('01920000-0000-7000-8000-000000000404', '01920000-0000-7000-8000-000000000001', 'E004', NULL, 'Ravi',  'Shankar','Ravi Shankar',   'male',   'admin',  NULL),
  ('01920000-0000-7000-8000-000000000405', '01920000-0000-7000-8000-000000000001', 'E005', NULL, 'Priya', 'Nair',   'Priya Nair',     'female', 'admin',  NULL);

INSERT INTO platform.staff_registration (tenant_id, staff_id, council, registration_no, valid_until) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000401', 'Karnataka Medical Council', 'KMC-100001', '2030-03-31'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000402', 'Karnataka Medical Council', 'KMC-100002', '2029-12-31'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000403', 'Karnataka State Nursing Council', 'KSNC-200001', '2028-06-30');

INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, email, status) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000401', 'local-dev', 'asha',  'asha@demo.example',  'active'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000403', 'local-dev', 'meena', 'meena@demo.example', 'active'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000404', 'local-dev', 'ravi',  'ravi@demo.example',  'active'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000405', 'local-dev', 'priya', 'priya@demo.example', 'active');

INSERT INTO platform.role_grant (tenant_id, staff_id, role_id, facility_id)
SELECT '01920000-0000-7000-8000-000000000001', g.staff_id::uuid, r.id, g.facility_id::uuid
FROM (VALUES
  ('01920000-0000-7000-8000-000000000401', 'doctor',       '01920000-0000-7000-8000-000000000101'),
  ('01920000-0000-7000-8000-000000000402', 'doctor',       NULL),
  ('01920000-0000-7000-8000-000000000403', 'nurse',        '01920000-0000-7000-8000-000000000101'),
  ('01920000-0000-7000-8000-000000000404', 'front_desk',   '01920000-0000-7000-8000-000000000101'),
  ('01920000-0000-7000-8000-000000000405', 'tenant_admin', NULL)
) AS g (staff_id, role_code, facility_id)
JOIN platform.role r ON r.tenant_id IS NULL AND r.code = g.role_code;

INSERT INTO platform.module_state (tenant_id, module_code, state)
SELECT '01920000-0000-7000-8000-000000000001', m, 'active'
FROM unnest(ARRAY['platform', 'patient', 'catalog', 'booking']) AS m;
