-- migrate:up
-- Schedule scope and reversal (ledger G37, G06; ERD m04).
--   * Leave ('closed') and blocks may name one facility: a clinic-specific block. NULL keeps the
--     practitioner-wide meaning (every facility the doctor works at). Extra hours always name one.
--   * Exceptions and facility holidays are revoked, never deleted: revoked_at/by + a reason, audited.
--     Revoked rows stop shaping sessions and slots; a revoked holiday's date can be declared again.
--   * Weekly rules that never took effect are withdrawn (not deleted) when a weekly plan is replaced;
--     withdrawn rules leave the no-overlap constraint and the computed sessions.

ALTER TABLE booking.schedule_exception
  DROP CONSTRAINT schedule_exception_check3,
  ADD CONSTRAINT schedule_exception_extra_hours_facility CHECK (kind <> 'extra_hours' OR facility_id IS NOT NULL),
  ADD COLUMN revoked_at    timestamptz,
  ADD COLUMN revoked_by    uuid,
  ADD COLUMN revoke_reason text,
  ADD CONSTRAINT schedule_exception_revocation CHECK ((revoked_at IS NULL) = (revoke_reason IS NULL));

ALTER TABLE booking.facility_holiday
  DROP CONSTRAINT facility_holiday_tenant_id_facility_id_holiday_on_key,
  ADD COLUMN revoked_at    timestamptz,
  ADD COLUMN revoked_by    uuid,
  ADD COLUMN revoke_reason text,
  ADD CONSTRAINT facility_holiday_revocation CHECK ((revoked_at IS NULL) = (revoke_reason IS NULL));
ALTER TABLE booking.schedule_rule
  ADD COLUMN withdrawn_at timestamptz,
  ADD COLUMN withdrawn_by uuid,
  DROP CONSTRAINT schedule_rule_no_overlap,
  ADD CONSTRAINT schedule_rule_no_overlap EXCLUDE USING gist (
    tenant_id WITH =, resource_id WITH =, weekday WITH =,
    int4range(start_minute, end_minute) WITH &&,
    daterange(effective_from, effective_to) WITH &&
  ) WHERE (withdrawn_at IS NULL);

CREATE UNIQUE INDEX facility_holiday_active ON booking.facility_holiday (tenant_id, facility_id, holiday_on) WHERE revoked_at IS NULL;

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

CREATE OR REPLACE FUNCTION booking.available_slots(p_resource_id uuid, p_from date, p_to date,
                                        p_at timestamptz DEFAULT now())
RETURNS TABLE (
  slot_start            timestamptz,
  slot_end              timestamptz,
  facility_id           uuid,
  consult_location_id   uuid,
  healthcare_service_id uuid,
  visit_mode            text,
  status                text
)
LANGUAGE sql STABLE AS $$
  WITH slots AS (
    SELECT g AS slot_start, g + make_interval(mins => s.slot_minutes) AS slot_end, s.*
    FROM booking.sessions(p_resource_id, p_from, p_to) s
    CROSS JOIN LATERAL generate_series(s.starts_at, s.ends_at - make_interval(mins => s.slot_minutes),
                                       make_interval(mins => s.slot_minutes)) AS g
    WHERE s.slot_minutes IS NOT NULL
  )
  SELECT sl.slot_start, sl.slot_end, sl.facility_id, sl.consult_location_id, sl.healthcare_service_id, sl.visit_mode,
         CASE
           WHEN EXISTS (
             SELECT 1 FROM booking.schedule_exception e
             JOIN platform.facility f ON f.id = sl.facility_id
             WHERE e.resource_id = p_resource_id AND e.on_date = sl.session_on
               AND e.kind IN ('closed', 'block') AND e.start_local IS NOT NULL
               AND e.revoked_at IS NULL AND (e.facility_id IS NULL OR e.facility_id = sl.facility_id)
               AND tstzrange((e.on_date + e.start_local) AT TIME ZONE f.timezone,
                             (e.on_date + e.end_local) AT TIME ZONE f.timezone) && tstzrange(sl.slot_start, sl.slot_end))
             THEN 'blocked'
           WHEN EXISTS (
             SELECT 1 FROM booking.reservation r
             WHERE r.resource_id = p_resource_id AND r.status IN ('held', 'booked')
               AND NOT (r.status = 'held' AND r.hold_expires_at <= p_at)
               AND r.period && tstzrange(sl.slot_start, sl.slot_end))
             THEN 'taken'
           ELSE 'free'
         END
  FROM slots sl
  WHERE sl.slot_start >= p_at
  ORDER BY sl.slot_start
$$;

-- migrate:down
-- Development only (production is forward-only). Fails once data uses the new meaning: clinic
-- closures/blocks, a holiday re-declared after a revocation, or a withdrawn weekly rule.
CREATE OR REPLACE FUNCTION booking.available_slots(p_resource_id uuid, p_from date, p_to date,
                                        p_at timestamptz DEFAULT now())
RETURNS TABLE (
  slot_start            timestamptz,
  slot_end              timestamptz,
  facility_id           uuid,
  consult_location_id   uuid,
  healthcare_service_id uuid,
  visit_mode            text,
  status                text
)
LANGUAGE sql STABLE AS $$
  WITH slots AS (
    SELECT g AS slot_start, g + make_interval(mins => s.slot_minutes) AS slot_end, s.*
    FROM booking.sessions(p_resource_id, p_from, p_to) s
    CROSS JOIN LATERAL generate_series(s.starts_at, s.ends_at - make_interval(mins => s.slot_minutes),
                                       make_interval(mins => s.slot_minutes)) AS g
    WHERE s.slot_minutes IS NOT NULL
  )
  SELECT sl.slot_start, sl.slot_end, sl.facility_id, sl.consult_location_id, sl.healthcare_service_id, sl.visit_mode,
         CASE
           WHEN EXISTS (
             SELECT 1 FROM booking.schedule_exception e
             JOIN platform.facility f ON f.id = sl.facility_id
             WHERE e.resource_id = p_resource_id AND e.on_date = sl.session_on
               AND e.kind IN ('closed', 'block') AND e.start_local IS NOT NULL
               AND tstzrange((e.on_date + e.start_local) AT TIME ZONE f.timezone,
                             (e.on_date + e.end_local) AT TIME ZONE f.timezone) && tstzrange(sl.slot_start, sl.slot_end))
             THEN 'blocked'
           WHEN EXISTS (
             SELECT 1 FROM booking.reservation r
             WHERE r.resource_id = p_resource_id AND r.status IN ('held', 'booked')
               AND NOT (r.status = 'held' AND r.hold_expires_at <= p_at)
               AND r.period && tstzrange(sl.slot_start, sl.slot_end))
             THEN 'taken'
           ELSE 'free'
         END
  FROM slots sl
  WHERE sl.slot_start >= p_at
  ORDER BY sl.slot_start
$$;

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
          WHERE e.resource_id = p_resource_id AND e.on_date = raw.day AND e.kind = 'closed' AND e.start_local IS NULL)
    AND NOT EXISTS (                                   -- facility holiday
          SELECT 1 FROM booking.facility_holiday h
          WHERE h.facility_id = raw.facility_id AND h.holiday_on = raw.day)
$$;

ALTER TABLE booking.schedule_rule
  DROP CONSTRAINT schedule_rule_no_overlap,
  DROP COLUMN withdrawn_by,
  DROP COLUMN withdrawn_at,
  ADD CONSTRAINT schedule_rule_no_overlap EXCLUDE USING gist (
    tenant_id WITH =, resource_id WITH =, weekday WITH =,
    int4range(start_minute, end_minute) WITH &&,
    daterange(effective_from, effective_to) WITH &&
  );

DROP INDEX booking.facility_holiday_active;
ALTER TABLE booking.facility_holiday
  DROP CONSTRAINT facility_holiday_revocation,
  DROP COLUMN revoke_reason,
  DROP COLUMN revoked_by,
  DROP COLUMN revoked_at,
  ADD CONSTRAINT facility_holiday_tenant_id_facility_id_holiday_on_key UNIQUE (tenant_id, facility_id, holiday_on);

ALTER TABLE booking.schedule_exception
  DROP CONSTRAINT schedule_exception_revocation,
  DROP COLUMN revoke_reason,
  DROP COLUMN revoked_by,
  DROP COLUMN revoked_at,
  DROP CONSTRAINT schedule_exception_extra_hours_facility,
  ADD CONSTRAINT schedule_exception_check3 CHECK ((kind = 'extra_hours') = (facility_id IS NOT NULL));
