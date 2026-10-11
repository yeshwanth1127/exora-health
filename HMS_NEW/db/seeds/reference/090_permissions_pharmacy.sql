-- Permissions and built-in roles for M09 pharmacy (prescribing, verification, dispensing, MAR). Idempotent.
INSERT INTO platform.permission (code, module_code, description, is_sensitive) VALUES
  ('prescriptions.read',    'pharmacy', 'Read prescriptions and medication charts',                                   true),
  ('prescriptions.write',   'pharmacy', 'Write, sign, cancel and stop prescriptions for patients under your care',    true),
  ('pharmacy.verify',       'pharmacy', 'Verify prescriptions as a pharmacist (approve, reject, query)',              true),
  ('pharmacy.dispense',     'pharmacy', 'Dispense prescriptions and patient indents, hand over and take returns',     true),
  ('pharmacy.registers',    'pharmacy', 'Read the Schedule H1 / X and NDPS registers',                                true),
  ('pharmacy.indent',       'pharmacy', 'Raise and cancel patient indents to the pharmacy',                           false),
  ('medication.administer', 'pharmacy', 'Chart medication administration (MAR) and witness controlled drugs',         true)
ON CONFLICT (code) DO UPDATE
  SET module_code = EXCLUDED.module_code, description = EXCLUDED.description, is_sensitive = EXCLUDED.is_sensitive;

INSERT INTO platform.role (tenant_id, code, name, is_clinical) VALUES
  (NULL, 'pharmacist', 'Pharmacist', true)
ON CONFLICT ON CONSTRAINT role_tenant_code_key DO UPDATE
  SET name = EXCLUDED.name, is_clinical = EXCLUDED.is_clinical;

WITH bundle (role_code, permission_code) AS (
  SELECT 'tenant_admin', code FROM platform.permission WHERE code NOT IN ('break_glass.use')
  UNION ALL SELECT 'doctor', unnest(ARRAY['prescriptions.read', 'prescriptions.write'])
  UNION ALL SELECT 'nurse', unnest(ARRAY['prescriptions.read', 'pharmacy.indent', 'medication.administer'])
  UNION ALL SELECT 'pharmacist', unnest(ARRAY['staff.read', 'patients.read', 'catalog.read', 'prescriptions.read', 'pharmacy.verify',
                                              'pharmacy.dispense', 'pharmacy.registers', 'inventory.read', 'inventory.indent',
                                              'inventory.issue', 'inventory.receive', 'inventory.count'])
)
INSERT INTO platform.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM bundle b
JOIN platform.role r ON r.tenant_id IS NULL AND r.code = b.role_code
JOIN platform.permission p ON p.code = b.permission_code
ON CONFLICT DO NOTHING;
