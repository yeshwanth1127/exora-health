-- Demo patients. MRNs follow the tenant's 'mrn' number series, which is advanced to match.

INSERT INTO patient.patient (id, tenant_id, mrn, registered_facility_id, given_name, family_name, birth_date, sex, blood_group, registration_source, verification_status, preferred_language) VALUES
  ('01920000-0000-7000-8000-000000000901', '01920000-0000-7000-8000-000000000001', '000001', '01920000-0000-7000-8000-000000000101', 'Lakshmi', 'Devi',    '1968-02-14', 'female', 'B+', 'front_desk', 'verified',   'kn'),
  ('01920000-0000-7000-8000-000000000902', '01920000-0000-7000-8000-000000000001', '000002', '01920000-0000-7000-8000-000000000101', 'Arjun',   'Menon',   '2019-09-03', 'male',   'O+', 'portal',     'unverified', 'en'),
  ('01920000-0000-7000-8000-000000000903', '01920000-0000-7000-8000-000000000001', '000003', '01920000-0000-7000-8000-000000000101', 'Farhan',  'Sheikh',  '1985-11-21', 'male',   NULL, 'abha_scan',  'verified',   'hi');

INSERT INTO platform.number_series (tenant_id, facility_id, series_kind, period_key, last_value) VALUES
  ('01920000-0000-7000-8000-000000000001', NULL, 'mrn', '', 3);

INSERT INTO patient.patient_identifier (tenant_id, patient_id, system, value, verified_at, verified_via, is_primary) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000901', 'abha_number',  '91123456789012', now(), 'abdm_otp', true),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000901', 'abha_address', 'lakshmi.devi@sbx', now(), 'abdm_otp', false),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000903', 'abha_number',  '91987654321098', now(), 'abdm_face', true);

INSERT INTO patient.patient_contact (tenant_id, patient_id, kind, value, is_primary) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000901', 'phone', '+919900000001', true),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000902', 'phone', '+919900000002', true),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000903', 'phone', '+919900000003', true);

INSERT INTO patient.patient_address (tenant_id, patient_id, line1, city, district, state_code, pincode, is_primary) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000901', '12 Temple Road', 'Bengaluru', 'Bengaluru Urban', '29', '560004', true);

-- Arjun is a child: his mother is his guardian and signs for him.
INSERT INTO patient.related_person (id, tenant_id, patient_id, name, relationship, phone, is_guardian, is_emergency_contact) VALUES
  ('01920000-0000-7000-8000-000000000951', '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000902', 'Divya Menon', 'parent', '+919900000012', true, true);

INSERT INTO patient.patient_consent (tenant_id, patient_id, consent_type, status, signed_by, related_person_id, witness_staff_id) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000902', 'treatment', 'signed', 'guardian', '01920000-0000-7000-8000-000000000951', '01920000-0000-7000-8000-000000000403'),
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000901', 'data_sharing_abdm', 'signed', 'patient', NULL, NULL);
