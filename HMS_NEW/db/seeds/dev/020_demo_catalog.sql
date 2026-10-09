-- Demo catalogue: bed categories and beds, doctor profiles, services, a lab test, vital-sign
-- definitions and an active cash price list, for tenant 'Demo Health' (010).

INSERT INTO catalog.bed_category (id, tenant_id, code, name, rank, is_icu) VALUES
  ('01920000-0000-7000-8000-000000000501', '01920000-0000-7000-8000-000000000001', 'GEN',  'General',      1, false),
  ('01920000-0000-7000-8000-000000000502', '01920000-0000-7000-8000-000000000001', 'SEMI', 'Semi-Private', 2, false),
  ('01920000-0000-7000-8000-000000000503', '01920000-0000-7000-8000-000000000001', 'PVT',  'Private',      3, false),
  ('01920000-0000-7000-8000-000000000504', '01920000-0000-7000-8000-000000000001', 'ICU',  'ICU',          4, true);

-- ICU ward next to General Ward 1, and beds in both
INSERT INTO platform.location (id, tenant_id, facility_id, parent_location_id, kind, code, name, ward_type) VALUES
  ('01920000-0000-7000-8000-000000000306', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000101', '01920000-0000-7000-8000-000000000302', 'ward', 'W-ICU', 'Medical ICU', 'icu');

INSERT INTO platform.location (tenant_id, facility_id, parent_location_id, kind, code, name, bed_category_id)
SELECT '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000101', w.ward_id::uuid, 'bed', w.prefix || '-B' || n, w.label || ' Bed ' || n, w.cat::uuid
FROM (VALUES
  ('01920000-0000-7000-8000-000000000303', 'W-GEN-1', 'General Ward 1', '01920000-0000-7000-8000-000000000501', 6),
  ('01920000-0000-7000-8000-000000000306', 'W-ICU',   'Medical ICU',    '01920000-0000-7000-8000-000000000504', 4)
) AS w (ward_id, prefix, label, cat, beds),
LATERAL generate_series(1, w.beds) AS n;

INSERT INTO catalog.practitioner_profile (tenant_id, staff_id, specialty_id, qualifications, experience_years, languages, public_slug, published, accepts_virtual)
SELECT '01920000-0000-7000-8000-000000000001', p.staff_id::uuid, s.id, p.quals, p.years, p.langs, p.slug, true, p.virtual
FROM (VALUES
  ('01920000-0000-7000-8000-000000000401', 'general_medicine', ARRAY['MBBS', 'MD (General Medicine)'], 12, ARRAY['en', 'kn', 'hi'], 'dr-asha-rao', true),
  ('01920000-0000-7000-8000-000000000402', 'paediatrics',      ARRAY['MBBS', 'DCH'],                    8, ARRAY['en', 'ta'],       'dr-vikram-iyer', false)
) AS p (staff_id, specialty, quals, years, langs, slug, virtual)
JOIN catalog.specialty s ON s.code = p.specialty;

INSERT INTO catalog.practitioner_affiliation (tenant_id, staff_id, facility_id, department_id, role_title, valid_from) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000401', '01920000-0000-7000-8000-000000000101', '01920000-0000-7000-8000-000000000201', 'Consultant Physician', '2024-01-01'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000402', '01920000-0000-7000-8000-000000000101', '01920000-0000-7000-8000-000000000202', 'Consultant Paediatrician', '2024-01-01'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000402', '01920000-0000-7000-8000-000000000102', '01920000-0000-7000-8000-000000000204', 'Visiting Paediatrician', '2025-06-01');

UPDATE platform.department d SET specialty_id = s.id
FROM catalog.specialty s
WHERE d.tenant_id = '01920000-0000-7000-8000-000000000001' AND ((d.code = 'GENMED' AND s.code = 'general_medicine') OR (d.code = 'PAED' AND s.code = 'paediatrics') OR (d.code = 'LAB' AND s.code = 'pathology'));

INSERT INTO catalog.service_item (id, tenant_id, code, name, category, performing_department_id, sac_code) VALUES
  ('01920000-0000-7000-8000-000000000601', '01920000-0000-7000-8000-000000000001', 'CONS-GM',   'General Medicine consultation', 'consultation', '01920000-0000-7000-8000-000000000201', '9993'),
  ('01920000-0000-7000-8000-000000000602', '01920000-0000-7000-8000-000000000001', 'CONS-PAED', 'Paediatrics consultation',      'consultation', '01920000-0000-7000-8000-000000000202', '9993'),
  ('01920000-0000-7000-8000-000000000603', '01920000-0000-7000-8000-000000000001', 'LAB-HB',    'Haemoglobin',                   'lab_test',     '01920000-0000-7000-8000-000000000203', '9993'),
  ('01920000-0000-7000-8000-000000000604', '01920000-0000-7000-8000-000000000001', 'BED-DAY',   'Bed charges (per day)',         'bed_day',      NULL,                                   '9993');

INSERT INTO catalog.healthcare_service (tenant_id, department_id, code, name, service_mode, default_duration_min, consultation_service_item_id) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000201', 'GM-OPD',   'General Medicine OPD', 'both',      15, '01920000-0000-7000-8000-000000000601'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000202', 'PAED-OPD', 'Paediatrics OPD',      'in_person', 15, '01920000-0000-7000-8000-000000000602');

INSERT INTO catalog.lab_test_def (tenant_id, service_item_id, section, specimen_type, container_type, min_volume_ml, tat_minutes) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000603', 'haematology', 'whole_blood', 'edta', 2, 120);

INSERT INTO catalog.observation_definition (id, tenant_id, lab_test_item_id, code, name, category, loinc_concept_id, value_type, unit, decimal_places)
SELECT '01920000-0000-7000-8000-000000000701', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000603', 'HB', 'Haemoglobin', 'lab', c.id, 'numeric', 'g/dL', 1
FROM catalog.terminology_concept c WHERE c.system = 'loinc' AND c.code = '718-7';

-- Adult haemoglobin ranges (18 years = 6570 days). Illustrative values for the demo only.
INSERT INTO catalog.reference_range (tenant_id, observation_definition_id, sex, age_min_days, low, high, critical_low, critical_high, valid_from) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000701', 'male',   6570, 13.0, 17.0, 7.0, 20.0, '2024-01-01'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000701', 'female', 6570, 12.0, 15.0, 7.0, 20.0, '2024-01-01');

INSERT INTO catalog.observation_definition (tenant_id, code, name, category, loinc_concept_id, value_type, unit, decimal_places, sequence)
SELECT '01920000-0000-7000-8000-000000000001', v.code, v.name, 'vital_sign', c.id, 'numeric', v.unit, v.dp, v.seq
FROM (VALUES
  ('BP_SYS', 'Systolic BP',        '8480-6',  'mm[Hg]',   0, 1),
  ('BP_DIA', 'Diastolic BP',       '8462-4',  'mm[Hg]',   0, 2),
  ('PULSE',  'Pulse',              '8867-4',  '/min',     0, 3),
  ('RESP',   'Respiratory rate',   '9279-1',  '/min',     0, 4),
  ('TEMP',   'Temperature',        '8310-5',  'Cel',      1, 5),
  ('SPO2',   'SpO2',               '59408-5', '%',        0, 6),
  ('WEIGHT', 'Weight',             '29463-7', 'kg',       1, 7),
  ('HEIGHT', 'Height',             '8302-2',  'cm',       0, 8),
  ('BMI',    'BMI',                '39156-5', 'kg/m2',    1, 9)
) AS v (code, name, loinc, unit, dp, seq)
JOIN catalog.terminology_concept c ON c.system = 'loinc' AND c.code = v.loinc;

-- Cash price list: prices are added while it is a draft, then it is activated (and frozen).
INSERT INTO catalog.price_list (id, tenant_id, code, name, kind, valid_from) VALUES
  ('01920000-0000-7000-8000-000000000801', '01920000-0000-7000-8000-000000000001', 'CASH-STD', 'Standard cash rates', 'cash', '2026-04-01');

INSERT INTO catalog.price_list_item (tenant_id, price_list_id, service_item_id, staff_id, bed_category_id, unit_price_minor, charge_trigger, valid_from) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000801', '01920000-0000-7000-8000-000000000601', NULL, NULL,  50000, 'on_order',       '2026-04-01'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000801', '01920000-0000-7000-8000-000000000601', '01920000-0000-7000-8000-000000000401', NULL, 80000, 'on_order', '2026-04-01'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000801', '01920000-0000-7000-8000-000000000602', NULL, NULL,  60000, 'on_order',       '2026-04-01'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000801', '01920000-0000-7000-8000-000000000603', NULL, NULL,  15000, 'on_order',       '2026-04-01'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000801', '01920000-0000-7000-8000-000000000604', NULL, '01920000-0000-7000-8000-000000000501',  150000, 'daily', '2026-04-01'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000801', '01920000-0000-7000-8000-000000000604', NULL, '01920000-0000-7000-8000-000000000502',  300000, 'daily', '2026-04-01'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000801', '01920000-0000-7000-8000-000000000604', NULL, '01920000-0000-7000-8000-000000000503',  500000, 'daily', '2026-04-01'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000801', '01920000-0000-7000-8000-000000000604', NULL, '01920000-0000-7000-8000-000000000504', 1200000, 'daily', '2026-04-01');

UPDATE catalog.price_list
SET status = 'active', activated_at = now(), activated_by = '01920000-0000-7000-8000-000000000405', is_default = true
WHERE id = '01920000-0000-7000-8000-000000000801';

INSERT INTO catalog.bed_charge_rule (tenant_id, method, grace_minutes, retained_bed_percent_bp, valid_from) VALUES
  ('01920000-0000-7000-8000-000000000001', 'midnight_census', 120, 5000, '2026-04-01');

-- GST rules are intentionally not seeded: rates must be confirmed by the hospital's tax advisor.
