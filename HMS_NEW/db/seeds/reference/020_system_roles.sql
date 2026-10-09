-- System roles (tenant_id NULL): visible to every tenant, editable by none. Tenants clone them to customise.
INSERT INTO platform.role (tenant_id, code, name, is_clinical) VALUES
  (NULL, 'tenant_admin', 'Tenant administrator', false),
  (NULL, 'front_desk',   'Front desk',           false),
  (NULL, 'doctor',       'Doctor',               true),
  (NULL, 'nurse',        'Nurse',                true),
  (NULL, 'auditor',      'Auditor',              false)
ON CONFLICT ON CONSTRAINT role_tenant_code_key DO UPDATE
  SET name = EXCLUDED.name, is_clinical = EXCLUDED.is_clinical;

-- Role → permission bundles. Re-running adds missing links; links are never removed here.
WITH bundle (role_code, permission_code) AS (
  SELECT 'tenant_admin', code FROM platform.permission
    WHERE code NOT IN ('break_glass.use')
  UNION ALL SELECT 'front_desk', unnest(ARRAY[
    'staff.read', 'patients.read', 'patients.register', 'patients.update', 'consents.record', 'catalog.read',
    'appointments.read', 'appointments.book', 'appointments.reschedule', 'appointments.cancel',
    'appointments.check_in', 'queue.manage'])
  UNION ALL SELECT 'doctor', unnest(ARRAY[
    'staff.read', 'patients.read', 'patients.update', 'patient_flags.manage', 'consents.record', 'catalog.read',
    'appointments.read', 'queue.manage', 'care_assignment.manage', 'break_glass.use'])
  UNION ALL SELECT 'nurse', unnest(ARRAY[
    'staff.read', 'patients.read', 'patient_flags.manage', 'consents.record', 'catalog.read',
    'appointments.read', 'appointments.check_in', 'queue.manage', 'break_glass.use'])
  UNION ALL SELECT 'auditor', unnest(ARRAY[
    'audit.read', 'break_glass.review', 'staff.read', 'patients.read', 'catalog.read', 'appointments.read'])
)
INSERT INTO platform.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM bundle b
JOIN platform.role r ON r.tenant_id IS NULL AND r.code = b.role_code
JOIN platform.permission p ON p.code = b.permission_code
ON CONFLICT DO NOTHING;
