-- Permissions and built-in roles for M07 inpatient (admissions, beds, transfers, discharge). Idempotent.
INSERT INTO platform.permission (code, module_code, description, is_sensitive) VALUES
  ('inpatient.read',               'inpatient', 'See the bed board, admissions and discharges',                                 false),
  ('inpatient.manage',             'inpatient', 'Admit, assign beds, transfer, cancel admissions and change bed status',        false),
  ('inpatient.discharge',          'inpatient', 'Plan discharges and clear the clinical and nursing clearances',               false),
  ('inpatient.discharge.override', 'inpatient', 'Waive a discharge clearance (with a reason)',                                 false)
ON CONFLICT (code) DO UPDATE
  SET module_code = EXCLUDED.module_code, description = EXCLUDED.description, is_sensitive = EXCLUDED.is_sensitive;

WITH bundle (role_code, permission_code) AS (
  SELECT 'tenant_admin', code FROM platform.permission WHERE module_code = 'inpatient'
  UNION ALL SELECT 'doctor', unnest(ARRAY['inpatient.read', 'inpatient.discharge'])
  UNION ALL SELECT 'nurse', unnest(ARRAY['inpatient.read', 'inpatient.discharge'])
  UNION ALL SELECT 'front_desk', unnest(ARRAY['inpatient.read', 'inpatient.manage'])
  UNION ALL SELECT 'cashier', unnest(ARRAY['inpatient.read'])
  UNION ALL SELECT 'auditor', unnest(ARRAY['inpatient.read'])
)
INSERT INTO platform.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM bundle b
JOIN platform.role r ON r.tenant_id IS NULL AND r.code = b.role_code
JOIN platform.permission p ON p.code = b.permission_code
ON CONFLICT DO NOTHING;
