-- Demo doctor calendars.
--   Dr Asha Rao (General Medicine, Bengaluru): Mon–Sat 09:00–13:00, 15-min slots, OPD Room 1;
--     Mon–Fri 17:00–19:00 walk-in token session (up to 20 tokens).
--   Dr Vikram Iyer (Paediatrics): Mon/Wed/Fri 10:00–13:00 Bengaluru, Tue/Thu 10:00–13:00 Chennai, 20-min slots.
-- One calendar per doctor across branches, so he can never be booked in both cities at once.

INSERT INTO booking.schedulable_resource (id, tenant_id, kind, staff_id, name) VALUES
  ('01920000-0000-7000-8000-000000000a01', '01920000-0000-7000-8000-000000000001', 'practitioner', '01920000-0000-7000-8000-000000000401', 'Dr Asha Rao'),
  ('01920000-0000-7000-8000-000000000a02', '01920000-0000-7000-8000-000000000001', 'practitioner', '01920000-0000-7000-8000-000000000402', 'Dr Vikram Iyer');

INSERT INTO booking.schedule_rule (tenant_id, resource_id, facility_id, consult_location_id, healthcare_service_id, weekday,
                                   start_local, end_local, slot_minutes, max_walk_in_tokens, effective_from)
SELECT '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000a01', '01920000-0000-7000-8000-000000000101', '01920000-0000-7000-8000-000000000304',
       hs.id, wd, '09:00', '13:00', 15, 0, '2026-04-01'
FROM generate_series(1, 6) AS wd, catalog.healthcare_service hs
WHERE hs.tenant_id = '01920000-0000-7000-8000-000000000001' AND hs.code = 'GM-OPD';

INSERT INTO booking.schedule_rule (tenant_id, resource_id, facility_id, healthcare_service_id, weekday,
                                   start_local, end_local, slot_minutes, max_walk_in_tokens, effective_from)
SELECT '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000a01', '01920000-0000-7000-8000-000000000101', hs.id, wd, '17:00', '19:00', NULL, 20, '2026-04-01'
FROM generate_series(1, 5) AS wd, catalog.healthcare_service hs
WHERE hs.tenant_id = '01920000-0000-7000-8000-000000000001' AND hs.code = 'GM-OPD';

INSERT INTO booking.schedule_rule (tenant_id, resource_id, facility_id, healthcare_service_id, weekday,
                                   start_local, end_local, slot_minutes, effective_from)
SELECT '01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000a02', w.facility::uuid, hs.id, w.wd, '10:00', '13:00', 20, '2026-04-01'
FROM (VALUES (1, '01920000-0000-7000-8000-000000000101'), (3, '01920000-0000-7000-8000-000000000101'),
             (5, '01920000-0000-7000-8000-000000000101'), (2, '01920000-0000-7000-8000-000000000102'),
             (4, '01920000-0000-7000-8000-000000000102')) AS w (wd, facility),
     catalog.healthcare_service hs
WHERE hs.tenant_id = '01920000-0000-7000-8000-000000000001' AND hs.code = 'PAED-OPD';

INSERT INTO booking.facility_holiday (tenant_id, facility_id, holiday_on, name) VALUES
  ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-000000000101', '2026-12-25', 'Christmas');
