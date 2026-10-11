-- Permissions and built-in roles for M06 diagnostics (orders, laboratory, imaging). Idempotent.
INSERT INTO platform.permission (code, module_code, description, is_sensitive) VALUES
  ('orders.place',        'diagnostics', 'Place lab, imaging and service orders on encounters',             true),
  ('orders.cancel',       'diagnostics', 'Cancel order items that have no result yet',                      true),
  ('order_sets.manage',   'diagnostics', 'Create, edit and retire department order sets',                   false),
  ('lab.collect',         'diagnostics', 'Collect specimens and recollect rejected ones',                   false),
  ('lab.process',         'diagnostics', 'Receive and reject specimens, enter results and microbiology',    true),
  ('lab.verify',          'diagnostics', 'Verify and release lab reports (authorised signatory) and amend', true),
  ('results.read',        'diagnostics', 'Read orders, results and reports of patients under your care',    true),
  ('results.acknowledge', 'diagnostics', 'Acknowledge released results for patients under your care',       true),
  ('imaging.manage',      'diagnostics', 'Run the imaging worklist: arrive, start, complete, cancel',       false),
  ('imaging.report',      'diagnostics', 'Write and release imaging reports',                               true),
  ('pcpndt.manage',       'diagnostics', 'Record PC-PNDT Form F and submit the monthly report',             true)
ON CONFLICT (code) DO UPDATE
  SET module_code = EXCLUDED.module_code, description = EXCLUDED.description, is_sensitive = EXCLUDED.is_sensitive;

-- Laboratory and radiology staff.
INSERT INTO platform.role (tenant_id, code, name, is_clinical) VALUES
  (NULL, 'lab_technician', 'Laboratory technician',          true),
  (NULL, 'pathologist',    'Pathologist (lab signatory)',    true),
  (NULL, 'radiologist',    'Radiologist',                    true),
  (NULL, 'radiographer',   'Radiographer / sonographer',     true)
ON CONFLICT ON CONSTRAINT role_tenant_code_key DO UPDATE
  SET name = EXCLUDED.name, is_clinical = EXCLUDED.is_clinical;

WITH bundle (role_code, permission_code) AS (
  SELECT 'tenant_admin', code FROM platform.permission WHERE code NOT IN ('break_glass.use')
  UNION ALL SELECT 'doctor', unnest(ARRAY['orders.place', 'orders.cancel', 'order_sets.manage', 'results.read', 'results.acknowledge'])
  UNION ALL SELECT 'nurse', unnest(ARRAY['lab.collect', 'results.read'])
  UNION ALL SELECT 'lab_technician', unnest(ARRAY['staff.read', 'patients.read', 'catalog.read', 'lab.collect', 'lab.process'])
  UNION ALL SELECT 'pathologist', unnest(ARRAY['staff.read', 'patients.read', 'catalog.read', 'lab.collect', 'lab.process', 'lab.verify'])
  UNION ALL SELECT 'radiographer', unnest(ARRAY['staff.read', 'patients.read', 'catalog.read', 'imaging.manage', 'pcpndt.manage'])
  UNION ALL SELECT 'radiologist', unnest(ARRAY['staff.read', 'patients.read', 'catalog.read', 'imaging.manage', 'imaging.report', 'pcpndt.manage'])
)
INSERT INTO platform.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM bundle b
JOIN platform.role r ON r.tenant_id IS NULL AND r.code = b.role_code
JOIN platform.permission p ON p.code = b.permission_code
ON CONFLICT DO NOTHING;
