-- Demo orderables for M06: a glucose test, an anaemia panel (Hb + glucose), a urine culture and two
-- imaging services. Illustrative ranges for the demo only.
INSERT INTO catalog.service_item (id, tenant_id, code, name, category, modality, performing_department_id, sac_code) VALUES
  ('01920000-0000-7000-8000-000000000611', '01920000-0000-7000-8000-000000000001', 'LAB-FBS',     'Fasting blood sugar',        'lab_test',  NULL, '01920000-0000-7000-8000-000000000203', '9993'),
  ('01920000-0000-7000-8000-000000000612', '01920000-0000-7000-8000-000000000001', 'LAB-BASIC',   'Basic screen (Hb + FBS)',    'lab_panel', NULL, '01920000-0000-7000-8000-000000000203', '9993'),
  ('01920000-0000-7000-8000-000000000613', '01920000-0000-7000-8000-000000000001', 'LAB-UCS',     'Urine culture & sensitivity','lab_test',  NULL, '01920000-0000-7000-8000-000000000203', '9993'),
  ('01920000-0000-7000-8000-000000000614', '01920000-0000-7000-8000-000000000001', 'IMG-CXR',     'X-ray chest PA',             'imaging',   'DX', NULL, '9993'),
  ('01920000-0000-7000-8000-000000000615', '01920000-0000-7000-8000-000000000001', 'IMG-USG-OB',  'USG obstetric',              'imaging',   'US', NULL, '9993');

INSERT INTO catalog.service_component (tenant_id, parent_item_id, child_item_id, sequence) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000612', '01920000-0000-7000-8000-000000000603', 1),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000612', '01920000-0000-7000-8000-000000000611', 2);

INSERT INTO catalog.lab_test_def (tenant_id, service_item_id, section, specimen_type, container_type, min_volume_ml, tat_minutes) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000611', 'biochemistry', 'plasma', 'fluoride', 2, 120),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000613', 'microbiology', 'urine', 'sterile', 10, 4320);

INSERT INTO catalog.observation_definition (id, tenant_id, lab_test_item_id, code, name, category, value_type, unit, decimal_places) VALUES
  ('01920000-0000-7000-8000-000000000711', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000611', 'FBS', 'Glucose (fasting)', 'lab', 'numeric', 'mg/dL', 0),
  ('01920000-0000-7000-8000-000000000712', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000613', 'UCS_GROWTH', 'Culture growth', 'lab', 'culture', NULL, NULL);

INSERT INTO catalog.reference_range (tenant_id, observation_definition_id, sex, age_min_days, low, high, critical_low, critical_high, valid_from) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000711', 'any', 0, 70, 100, 40, 450, '2024-01-01');
