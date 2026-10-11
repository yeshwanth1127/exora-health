-- Permissions and built-in roles for M10 inventory (items, stores, stock, internal supply, purchasing). Idempotent.
INSERT INTO platform.permission (code, module_code, description, is_sensitive) VALUES
  ('inventory.read',     'inventory', 'See items, stores, stock levels, batches and the stock ledger',            false),
  ('inventory.manage',   'inventory', 'Maintain items, drug profiles, stores, suppliers, levels and batch status', false),
  ('inventory.indent',   'inventory', 'Raise and cancel indents (requisitions) from a store',                     false),
  ('inventory.issue',    'inventory', 'Dispatch transfers, post opening stock, consumption, damage and disposal', false),
  ('inventory.receive',  'inventory', 'Receive goods from suppliers and transfers from other stores',            false),
  ('inventory.count',    'inventory', 'Open, record and submit physical stock counts',                           false),
  ('inventory.purchase', 'inventory', 'Raise purchase orders, record supplier invoices and vendor returns',       false),
  ('inventory.approve',  'inventory', 'Approve purchase orders, supplier invoices, indents and count variances',  false)
ON CONFLICT (code) DO UPDATE
  SET module_code = EXCLUDED.module_code, description = EXCLUDED.description, is_sensitive = EXCLUDED.is_sensitive;

INSERT INTO platform.role (tenant_id, code, name, is_clinical) VALUES
  (NULL, 'store_keeper', 'Store keeper', false)
ON CONFLICT ON CONSTRAINT role_tenant_code_key DO UPDATE
  SET name = EXCLUDED.name, is_clinical = EXCLUDED.is_clinical;

WITH bundle (role_code, permission_code) AS (
  SELECT 'tenant_admin', code FROM platform.permission WHERE code NOT IN ('break_glass.use')
  UNION ALL SELECT 'store_keeper', unnest(ARRAY['staff.read', 'catalog.read', 'inventory.read', 'inventory.manage', 'inventory.indent', 'inventory.issue',
                                                'inventory.receive', 'inventory.count', 'inventory.purchase'])
  UNION ALL SELECT 'nurse', unnest(ARRAY['inventory.read', 'inventory.indent', 'inventory.receive'])
)
INSERT INTO platform.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM bundle b
JOIN platform.role r ON r.tenant_id IS NULL AND r.code = b.role_code
JOIN platform.permission p ON p.code = b.permission_code
ON CONFLICT DO NOTHING;
