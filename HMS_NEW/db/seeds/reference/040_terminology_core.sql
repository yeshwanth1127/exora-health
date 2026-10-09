-- Minimal LOINC set for vital signs and haemoglobin. Full SNOMED CT (India edition), WHO ICD-10 and
-- LOINC releases are licensed downloads loaded by separate scripts, not committed seeds.
INSERT INTO catalog.terminology_concept (system, code, display) VALUES
  ('loinc', '8480-6',  'Systolic blood pressure'),
  ('loinc', '8462-4',  'Diastolic blood pressure'),
  ('loinc', '8867-4',  'Heart rate'),
  ('loinc', '9279-1',  'Respiratory rate'),
  ('loinc', '8310-5',  'Body temperature'),
  ('loinc', '59408-5', 'Oxygen saturation in Arterial blood by Pulse oximetry'),
  ('loinc', '29463-7', 'Body weight'),
  ('loinc', '8302-2',  'Body height'),
  ('loinc', '39156-5', 'Body mass index (BMI) [Ratio]'),
  ('loinc', '718-7',   'Hemoglobin [Mass/volume] in Blood')
ON CONFLICT (system, code, system_version) DO UPDATE SET display = EXCLUDED.display;
