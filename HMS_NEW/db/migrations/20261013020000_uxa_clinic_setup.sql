-- migrate:up
-- Creating a clinic grants only directory setup access for that clinic. The role is immutable
-- shared system metadata, and cannot confer clinical or tenant-wide administration privileges.
INSERT INTO platform.permission (code, module_code, description, is_sensitive) VALUES
  ('catalog.read', 'catalog', 'View services, prices and directory', false),
  ('facility.manage', 'platform', 'Create and edit facilities, departments, locations', false)
ON CONFLICT (code) DO NOTHING;
INSERT INTO platform.role (code, name) VALUES ('clinic_setup', 'Clinic setup');
INSERT INTO platform.role_permission (role_id, permission_id)
SELECT r.id, p.id FROM platform.role r CROSS JOIN platform.permission p
WHERE r.tenant_id IS NULL AND r.code = 'clinic_setup' AND p.code IN ('catalog.read', 'facility.manage');

-- migrate:down
DELETE FROM platform.role_grant WHERE role_id IN (SELECT id FROM platform.role WHERE tenant_id IS NULL AND code = 'clinic_setup');
DELETE FROM platform.role_permission WHERE role_id IN (SELECT id FROM platform.role WHERE tenant_id IS NULL AND code = 'clinic_setup');
DELETE FROM platform.role WHERE tenant_id IS NULL AND code = 'clinic_setup';
