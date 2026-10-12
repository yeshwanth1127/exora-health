-- migrate:up
-- Extra hours preserve the staff-selected visit mode. Closures/blocks have no visit mode.
ALTER TABLE booking.schedule_exception
  ADD COLUMN visit_mode text CHECK (visit_mode IN ('in_person', 'virtual'));
UPDATE booking.schedule_exception SET visit_mode = 'in_person' WHERE kind = 'extra_hours';
ALTER TABLE booking.schedule_exception
  ADD CONSTRAINT schedule_exception_visit_mode CHECK ((kind = 'extra_hours') = (visit_mode IS NOT NULL));

CREATE OR REPLACE FUNCTION booking.sessions(p_resource_id uuid, p_from date, p_to date)
RETURNS TABLE (
  session_on            date,
  facility_id           uuid,
  consult_location_id   uuid,
  healthcare_service_id uuid,
  visit_mode            text,
  slot_minutes          smallint,
  max_walk_in_tokens    smallint,
  starts_at             timestamptz,
  ends_at               timestamptz,
  source                text
)
LANGUAGE sql STABLE AS $$
  WITH days AS (
    SELECT d::date AS day FROM generate_series(p_from, p_to, interval '1 day') AS d
  ),
  latest_plan AS (
    SELECT DISTINCT ON (dp.plan_on) dp.id, dp.plan_on, dp.replaces_weekly
    FROM booking.day_plan dp
    WHERE dp.resource_id = p_resource_id AND dp.plan_on BETWEEN p_from AND p_to
    ORDER BY dp.plan_on, dp.revision DESC
  ),
  raw AS (
    -- weekly rules, unless a day plan replaces them
    SELECT d.day, r.facility_id, r.consult_location_id, r.healthcare_service_id, r.visit_mode,
           r.slot_minutes, r.max_walk_in_tokens, r.start_local, r.end_local, 'weekly'::text AS source
    FROM days d
    JOIN booking.schedule_rule r
      ON r.resource_id = p_resource_id
     AND r.weekday = extract(isodow FROM d.day)
     AND d.day >= r.effective_from AND (r.effective_to IS NULL OR d.day < r.effective_to)
     AND r.withdrawn_at IS NULL
    WHERE NOT EXISTS (SELECT 1 FROM latest_plan lp WHERE lp.plan_on = d.day AND lp.replaces_weekly)
    UNION ALL
    -- blocks of the latest day plan
    SELECT lp.plan_on, b.facility_id, b.consult_location_id, b.healthcare_service_id, b.visit_mode,
           b.slot_minutes, b.max_walk_in_tokens, b.start_local, b.end_local, 'day_plan'
    FROM latest_plan lp
    JOIN booking.day_plan_block b ON b.day_plan_id = lp.id
    UNION ALL
    -- one-off extra hours
    SELECT e.on_date, e.facility_id, NULL, e.healthcare_service_id, e.visit_mode,
           e.slot_minutes, 0::smallint, e.start_local, e.end_local, 'extra_hours'
    FROM booking.schedule_exception e
    WHERE e.resource_id = p_resource_id AND e.kind = 'extra_hours' AND e.on_date BETWEEN p_from AND p_to
      AND e.revoked_at IS NULL
  )
  SELECT raw.day, raw.facility_id, raw.consult_location_id, raw.healthcare_service_id, raw.visit_mode,
         raw.slot_minutes, raw.max_walk_in_tokens,
         (raw.day + raw.start_local) AT TIME ZONE f.timezone,
         (raw.day + raw.end_local) AT TIME ZONE f.timezone,
         raw.source
  FROM raw
  JOIN platform.facility f ON f.id = raw.facility_id
  WHERE NOT EXISTS (                                   -- whole-day closure of the resource
          SELECT 1 FROM booking.schedule_exception e
          WHERE e.resource_id = p_resource_id AND e.on_date = raw.day AND e.kind = 'closed' AND e.start_local IS NULL
            AND e.revoked_at IS NULL AND (e.facility_id IS NULL OR e.facility_id = raw.facility_id))
    AND NOT EXISTS (                                   -- facility holiday
          SELECT 1 FROM booking.facility_holiday h
          WHERE h.facility_id = raw.facility_id AND h.holiday_on = raw.day AND h.revoked_at IS NULL)
$$;

-- migrate:down
CREATE OR REPLACE FUNCTION booking.sessions(p_resource_id uuid, p_from date, p_to date)
RETURNS TABLE (
  session_on            date,
  facility_id           uuid,
  consult_location_id   uuid,
  healthcare_service_id uuid,
  visit_mode            text,
  slot_minutes          smallint,
  max_walk_in_tokens    smallint,
  starts_at             timestamptz,
  ends_at               timestamptz,
  source                text
)
LANGUAGE sql STABLE AS $$
  WITH days AS (
    SELECT d::date AS day FROM generate_series(p_from, p_to, interval '1 day') AS d
  ),
  latest_plan AS (
    SELECT DISTINCT ON (dp.plan_on) dp.id, dp.plan_on, dp.replaces_weekly
    FROM booking.day_plan dp
    WHERE dp.resource_id = p_resource_id AND dp.plan_on BETWEEN p_from AND p_to
    ORDER BY dp.plan_on, dp.revision DESC
  ),
  raw AS (
    -- weekly rules, unless a day plan replaces them
    SELECT d.day, r.facility_id, r.consult_location_id, r.healthcare_service_id, r.visit_mode,
           r.slot_minutes, r.max_walk_in_tokens, r.start_local, r.end_local, 'weekly'::text AS source
    FROM days d
    JOIN booking.schedule_rule r
      ON r.resource_id = p_resource_id
     AND r.weekday = extract(isodow FROM d.day)
     AND d.day >= r.effective_from AND (r.effective_to IS NULL OR d.day < r.effective_to)
     AND r.withdrawn_at IS NULL
    WHERE NOT EXISTS (SELECT 1 FROM latest_plan lp WHERE lp.plan_on = d.day AND lp.replaces_weekly)
    UNION ALL
    -- blocks of the latest day plan
    SELECT lp.plan_on, b.facility_id, b.consult_location_id, b.healthcare_service_id, b.visit_mode,
           b.slot_minutes, b.max_walk_in_tokens, b.start_local, b.end_local, 'day_plan'
    FROM latest_plan lp
    JOIN booking.day_plan_block b ON b.day_plan_id = lp.id
    UNION ALL
    -- one-off extra hours
    SELECT e.on_date, e.facility_id, NULL, e.healthcare_service_id, 'in_person',
           e.slot_minutes, 0::smallint, e.start_local, e.end_local, 'extra_hours'
    FROM booking.schedule_exception e
    WHERE e.resource_id = p_resource_id AND e.kind = 'extra_hours' AND e.on_date BETWEEN p_from AND p_to
      AND e.revoked_at IS NULL
  )
  SELECT raw.day, raw.facility_id, raw.consult_location_id, raw.healthcare_service_id, raw.visit_mode,
         raw.slot_minutes, raw.max_walk_in_tokens,
         (raw.day + raw.start_local) AT TIME ZONE f.timezone,
         (raw.day + raw.end_local) AT TIME ZONE f.timezone,
         raw.source
  FROM raw
  JOIN platform.facility f ON f.id = raw.facility_id
  WHERE NOT EXISTS (                                   -- whole-day closure of the resource
          SELECT 1 FROM booking.schedule_exception e
          WHERE e.resource_id = p_resource_id AND e.on_date = raw.day AND e.kind = 'closed' AND e.start_local IS NULL
            AND e.revoked_at IS NULL AND (e.facility_id IS NULL OR e.facility_id = raw.facility_id))
    AND NOT EXISTS (                                   -- facility holiday
          SELECT 1 FROM booking.facility_holiday h
          WHERE h.facility_id = raw.facility_id AND h.holiday_on = raw.day AND h.revoked_at IS NULL)
$$;

ALTER TABLE booking.schedule_exception DROP CONSTRAINT schedule_exception_visit_mode, DROP COLUMN visit_mode;
