-- Permissions and built-in roles for M18 HR (profiles, attendance, leave, payroll). Idempotent.
INSERT INTO platform.permission (code, module_code, description, is_sensitive) VALUES
  ('hr.read',           'hr', 'See the staff directory, employment details, rosters, attendance and leave',              false),
  ('hr.manage',         'hr', 'Maintain employment profiles, shifts, rosters and leave types; grant leave',              false),
  ('attendance.manage', 'hr', 'Record attendance for others and decide regularisation requests',                         false),
  ('leave.approve',     'hr', 'Approve or reject leave requests',                                                        false),
  ('payroll.read',      'hr', 'See salary structures, bank and statutory details, payroll runs and payslips',             true),
  ('payroll.manage',    'hr', 'Maintain salary components and structures, payroll settings; compute payroll',            true),
  ('payroll.approve',   'hr', 'Approve payroll, mark it paid and lock the month',                                       true),
  ('attendance.self',   'hr', 'Clock in and out and see your own attendance',                                            false),
  ('leave.request',     'hr', 'Request and cancel your own leave; see your balances and payslips',                       false)
ON CONFLICT (code) DO UPDATE
  SET module_code = EXCLUDED.module_code, description = EXCLUDED.description, is_sensitive = EXCLUDED.is_sensitive;

INSERT INTO platform.role (tenant_id, code, name, is_clinical) VALUES
  (NULL, 'hr_manager', 'HR manager', false)
ON CONFLICT ON CONSTRAINT role_tenant_code_key DO UPDATE
  SET name = EXCLUDED.name, is_clinical = EXCLUDED.is_clinical;

WITH bundle (role_code, permission_code) AS (
  SELECT 'tenant_admin', code FROM platform.permission WHERE module_code = 'hr'
  UNION ALL SELECT 'hr_manager', unnest(ARRAY['staff.read', 'hr.read', 'hr.manage', 'attendance.manage', 'leave.approve', 'payroll.read', 'payroll.manage',
                                              'attendance.self', 'leave.request'])
  -- Everyone who works at the clinic clocks in and asks for leave.
  UNION ALL SELECT r.code, unnest(ARRAY['attendance.self', 'leave.request'])
    FROM platform.role r WHERE r.tenant_id IS NULL AND r.code IN ('front_desk', 'doctor', 'nurse', 'cashier', 'pharmacist', 'clinic_setup', 'auditor')
)
INSERT INTO platform.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM bundle b
JOIN platform.role r ON r.tenant_id IS NULL AND r.code = b.role_code
JOIN platform.permission p ON p.code = b.permission_code
ON CONFLICT DO NOTHING;
