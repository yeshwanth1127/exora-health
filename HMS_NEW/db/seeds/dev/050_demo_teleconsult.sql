-- Virtual OPD demo: Dr Asha Rao takes video consultations on Saturdays 14:00–16:00 (20-min slots),
-- and the tenant has a published teleconsultation consent document.
-- The consent text is a SAMPLE for development; real text needs legal and clinical sign-off.
INSERT INTO booking.schedule_rule (tenant_id, resource_id, facility_id, healthcare_service_id, weekday,
                                   start_local, end_local, slot_minutes, visit_mode, effective_from)
SELECT '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000a01', '01920000-0000-7000-8000-000000000101',
       hs.id, 6, '14:00', '16:00', 20, 'virtual', '2026-04-01'
FROM catalog.healthcare_service hs
WHERE hs.tenant_id = '01920000-0000-7000-8000-000000000001' AND hs.code = 'GM-OPD';

INSERT INTO clinical.tele_consent_document (tenant_id, doc_version, language, title, body, published_at) VALUES
  ('01920000-0000-7000-8000-000000000001', '2026-10-01', 'en', 'Consent for video consultation (sample)',
   E'SAMPLE TEXT — NOT LEGALLY REVIEWED.\n\n'
   'I agree to consult the doctor by video. I understand that:\n'
   '1. The doctor cannot examine me physically and may ask me to visit the hospital in person.\n'
   '2. The doctor will confirm my identity at the start of the call.\n'
   '3. The call is not recorded. The doctor records notes and any prescription in my hospital record.\n'
   '4. Some medicines cannot be prescribed by video under the Telemedicine Practice Guidelines.\n'
   '5. In an emergency I should go to the nearest emergency department instead.',
   '2026-10-01T00:00:00+05:30');
