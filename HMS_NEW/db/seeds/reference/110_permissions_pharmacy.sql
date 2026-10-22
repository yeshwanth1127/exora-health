-- Permissions and built-in roles for M10 inventory and M09 pharmacy (clinic scope). Idempotent.
INSERT INTO platform.permission (code, module_code, description, is_sensitive) VALUES
  ('inventory.read',        'inventory', 'See items, stock levels, batches, suppliers and the stock ledger',                     false),
  ('inventory.manage',      'inventory', 'Maintain items, drug profiles, stores, suppliers, reorder levels and batch status',      false),
  ('inventory.receive',     'inventory', 'Receive goods from suppliers and post opening stock',                                     false),
  ('inventory.adjust',      'inventory', 'Write off damaged or expired stock, record consumption and returns to suppliers',         false),
  ('prescriptions.read',    'pharmacy',  'Read prescriptions and medication charts',                                               true),
  ('prescriptions.write',   'pharmacy',  'Write, sign, cancel and stop prescriptions for patients under your care',                true),
  ('pharmacy.read',         'pharmacy',  'See the dispensing queue, dispenses, counter sales and ward indents',                    false),
  ('pharmacy.dispense',     'pharmacy',  'Dispense prescriptions and ward indents, take returns, clear the pharmacy discharge step', true),
  ('pharmacy.sell',         'pharmacy',  'Sell over the counter to walk-in buyers (no Schedule H/H1/X or NDPS drugs)',             false),
  ('pharmacy.registers',    'pharmacy',  'Read the Schedule H1 / X and NDPS register',                                             true),
  ('pharmacy.indent',       'pharmacy',  'Raise and cancel ward indents for admitted patients',                                    false),
  ('medication.administer', 'pharmacy',  'Chart medication administration (MAR) and witness controlled drugs',                    true)
ON CONFLICT (code) DO UPDATE
  SET module_code = EXCLUDED.module_code, description = EXCLUDED.description, is_sensitive = EXCLUDED.is_sensitive;

INSERT INTO platform.role (tenant_id, code, name, is_clinical) VALUES
  (NULL, 'pharmacist', 'Pharmacist', true)
ON CONFLICT ON CONSTRAINT role_tenant_code_key DO UPDATE
  SET name = EXCLUDED.name, is_clinical = EXCLUDED.is_clinical;

WITH bundle (role_code, permission_code) AS (
  SELECT 'tenant_admin', code FROM platform.permission WHERE module_code IN ('inventory', 'pharmacy')
  UNION ALL SELECT 'doctor', unnest(ARRAY['prescriptions.read', 'prescriptions.write', 'inventory.read'])
  UNION ALL SELECT 'nurse', unnest(ARRAY['prescriptions.read', 'pharmacy.indent', 'medication.administer', 'inventory.read'])
  UNION ALL SELECT 'pharmacist', unnest(ARRAY['staff.read', 'patients.read', 'catalog.read', 'encounters.read', 'inpatient.read', 'prescriptions.read',
                                              'pharmacy.read', 'pharmacy.dispense', 'pharmacy.sell', 'pharmacy.registers',
                                              'inventory.read', 'inventory.manage', 'inventory.receive', 'inventory.adjust',
                                              'billing.read', 'billing.charge', 'billing.invoice', 'billing.collect'])
  UNION ALL SELECT 'auditor', unnest(ARRAY['inventory.read', 'pharmacy.read', 'pharmacy.registers'])
)
INSERT INTO platform.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM bundle b
JOIN platform.role r ON r.tenant_id IS NULL AND r.code = b.role_code
JOIN platform.permission p ON p.code = b.permission_code
ON CONFLICT DO NOTHING;
