-- Permissions and built-in roles for M11 billing (charges, invoices, cashier, refunds, deposits). Idempotent.
INSERT INTO platform.permission (code, module_code, description, is_sensitive) VALUES
  ('billing.read',     'billing', 'See charges, invoices, payments, receipts and cashier shifts',                          false),
  ('billing.charge',   'billing', 'Post and reverse not-yet-invoiced charges; ask for discounts',                         false),
  ('billing.invoice',  'billing', 'Draft, issue and void invoices',                                                       false),
  ('billing.collect',  'billing', 'Take payments and deposits, issue receipts, open and close your cashier shift',        false),
  ('billing.refund',   'billing', 'Request refunds and pay out approved refunds',                                          false),
  ('billing.approve',  'billing', 'Approve discounts above your limit, credit notes and refunds; verify cashier shifts',   false),
  ('billing.settings', 'billing', 'Configure deposit rules and billing settings',                                         false)
ON CONFLICT (code) DO UPDATE
  SET module_code = EXCLUDED.module_code, description = EXCLUDED.description, is_sensitive = EXCLUDED.is_sensitive;

-- A cashier may give up to 10% discount without approval (role.settings.max_discount_percent; missing = 0).
INSERT INTO platform.role (tenant_id, code, name, is_clinical, settings) VALUES
  (NULL, 'cashier', 'Cashier', false, '{"max_discount_percent": 10}')
ON CONFLICT ON CONSTRAINT role_tenant_code_key DO UPDATE
  SET name = EXCLUDED.name, is_clinical = EXCLUDED.is_clinical;

WITH bundle (role_code, permission_code) AS (
  SELECT 'tenant_admin', code FROM platform.permission WHERE module_code = 'billing'
  UNION ALL SELECT 'cashier', unnest(ARRAY['patients.read', 'appointments.read', 'billing.read', 'billing.charge', 'billing.invoice',
                                           'billing.collect', 'billing.refund'])
  UNION ALL SELECT 'front_desk', unnest(ARRAY['billing.read', 'billing.charge', 'billing.invoice', 'billing.collect'])
  UNION ALL SELECT 'auditor', unnest(ARRAY['billing.read'])
)
INSERT INTO platform.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM bundle b
JOIN platform.role r ON r.tenant_id IS NULL AND r.code = b.role_code
JOIN platform.permission p ON p.code = b.permission_code
ON CONFLICT DO NOTHING;
