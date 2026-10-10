-- Fixed permission list (global). Idempotent: safe to re-run in every environment.
-- Later modules append their permissions in their own seed files.
INSERT INTO platform.permission (code, module_code, description, is_sensitive) VALUES
  -- platform
  ('tenant.manage',          'platform', 'Edit tenant profile and module switches',             true),
  ('facility.manage',        'platform', 'Create and edit facilities, departments, locations',  false),
  ('staff.read',             'platform', 'View staff directory',                                false),
  ('staff.manage',           'platform', 'Create and edit staff and registrations',             false),
  ('access.manage',          'platform', 'Edit roles, permissions and role grants',             true),
  ('care_assignment.manage', 'platform', 'Assign staff to patients and encounters',             false),
  ('audit.read',             'platform', 'Read the audit log',                                  true),
  ('config.manage',          'platform', 'Edit configuration settings',                         false),
  ('break_glass.use',        'platform', 'Open a chart without a care relationship (audited)',  true),
  ('break_glass.review',     'platform', 'Review break-glass access',                           true),
  -- patient
  ('patients.read',          'patient',  'Search and view patient demographics',                false),
  ('patients.register',      'patient',  'Register new patients',                               false),
  ('patients.update',        'patient',  'Edit patient demographics and contacts',              false),
  ('patients.merge',         'patient',  'Merge and unmerge duplicate patients',                true),
  ('patient_flags.manage',   'patient',  'Set and clear patient flags',                         false),
  ('consents.record',        'patient',  'Record clinical consents',                            false),
  -- catalog
  ('catalog.read',           'catalog',  'View services, prices and directory',                 false),
  ('catalog.manage',         'catalog',  'Edit service catalogue and directory',                false),
  ('pricing.manage',         'catalog',  'Edit price lists and tax rules',                      true),
  -- booking
  ('appointments.read',      'booking',  'View appointments and queues',                        false),
  ('appointments.book',      'booking',  'Book appointments',                                   false),
  ('appointments.reschedule','booking',  'Reschedule appointments',                             false),
  ('appointments.cancel',    'booking',  'Cancel appointments',                                 false),
  ('appointments.check_in',  'booking',  'Check patients in',                                   false),
  ('schedules.manage',       'booking',  'Edit schedules, exceptions and day plans',            false),
  ('queue.manage',           'booking',  'Issue, call and skip queue tokens',                   false),
  -- clinical
  ('encounters.read',        'clinical', 'See encounter worklists (no chart contents)',         false),
  ('encounters.manage',      'clinical', 'Open, start, finish and cancel encounters',           false),
  ('clinical.read',          'clinical', 'Read charts of patients under your care',             true),
  ('clinical.write',         'clinical', 'Record vitals, notes, diagnoses and allergies',       true),
  ('clinical.sign',          'clinical', 'Sign clinical notes',                                 true),
  -- teleconsultation (Virtual OPD)
  ('teleconsult.read',       'clinical', 'See the teleconsultation worklist',                   false),
  ('teleconsult.manage',     'clinical', 'Issue patient join links for teleconsultations',      false),
  ('teleconsult.conduct',    'clinical', 'Start, join and end your own teleconsultations',      true)
ON CONFLICT (code) DO UPDATE
  SET module_code = EXCLUDED.module_code,
      description = EXCLUDED.description,
      is_sensitive = EXCLUDED.is_sensitive;
