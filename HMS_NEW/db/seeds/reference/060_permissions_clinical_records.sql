-- Permissions for the rest of M01/M02/M05 (editable workspace, phase 7). Idempotent.
INSERT INTO platform.permission (code, module_code, description, is_sensitive) VALUES
  ('clinical.sign_nursing',     'clinical', 'Sign your own nursing notes',                              true),
  ('mlc.read',                  'clinical', 'Read medico-legal case records',                           true),
  ('mlc.record',                'clinical', 'Open and update medico-legal case records',                true),
  ('vital_records.record',      'clinical', 'Record births and deaths',                                 true),
  ('consent_documents.manage',  'platform', 'Publish and retire patient consent documents',             false)
ON CONFLICT (code) DO UPDATE
  SET module_code = EXCLUDED.module_code, description = EXCLUDED.description, is_sensitive = EXCLUDED.is_sensitive;

WITH bundle (role_code, permission_code) AS (
  SELECT 'tenant_admin', code FROM platform.permission WHERE code NOT IN ('break_glass.use')
  UNION ALL SELECT 'doctor', unnest(ARRAY['mlc.read', 'mlc.record', 'vital_records.record'])
  UNION ALL SELECT 'nurse', unnest(ARRAY['clinical.sign_nursing', 'mlc.read'])
)
INSERT INTO platform.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM bundle b
JOIN platform.role r ON r.tenant_id IS NULL AND r.code = b.role_code
JOIN platform.permission p ON p.code = b.permission_code
ON CONFLICT DO NOTHING;
