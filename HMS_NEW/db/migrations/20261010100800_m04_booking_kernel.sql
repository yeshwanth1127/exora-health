-- migrate:up

-- ---------------------------------------------------------------------------
-- schedulable_resource: anything with a bookable calendar.
-- A practitioner's calendar is tenant-wide (facility_id NULL) so one doctor working at two branches
-- can never be double-booked across them; each schedule session says which facility it is at.
-- Rooms, theatres and equipment belong to one facility. equipment_id gets its FK with M15.
-- ---------------------------------------------------------------------------
CREATE TABLE booking.schedulable_resource (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  kind         text NOT NULL CHECK (kind IN ('practitioner', 'room', 'theatre', 'equipment')),
  staff_id     uuid,
  location_id  uuid,
  equipment_id uuid,
  facility_id  uuid,
  name         text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, staff_id),
  UNIQUE (tenant_id, location_id),
  UNIQUE (tenant_id, equipment_id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id, location_id) REFERENCES platform.location (tenant_id, facility_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  CHECK (num_nonnulls(staff_id, location_id, equipment_id) = 1),
  CHECK (kind <> 'practitioner' OR (staff_id IS NOT NULL AND facility_id IS NULL)),
  CHECK (kind NOT IN ('room', 'theatre') OR (location_id IS NOT NULL AND facility_id IS NOT NULL)),
  CHECK (kind <> 'equipment' OR (equipment_id IS NOT NULL AND facility_id IS NOT NULL))
);
CREATE INDEX ON booking.schedulable_resource (tenant_id, facility_id, location_id);
SELECT platform.setup_tenant_table('booking.schedulable_resource', 'mod_booking');

-- ---------------------------------------------------------------------------
-- schedule_rule: a recurring weekly session ("Mon 09:00–13:00 at Bengaluru, 15-min slots").
-- Times are local to the session's facility. A resource can't have two overlapping sessions
-- (anywhere) on the same weekday in overlapping date ranges.
-- slot_minutes NULL = token-only (walk-in) session.
-- ---------------------------------------------------------------------------
CREATE TABLE booking.schedule_rule (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id             uuid NOT NULL REFERENCES platform.tenant (id),
  resource_id           uuid NOT NULL,
  facility_id           uuid NOT NULL,
  consult_location_id   uuid,
  healthcare_service_id uuid,
  weekday               smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),     -- ISO: 1 = Monday
  start_local           time NOT NULL,
  end_local             time NOT NULL,
  start_minute          integer GENERATED ALWAYS AS ((extract(hour FROM start_local) * 60 + extract(minute FROM start_local))::integer) STORED,
  end_minute            integer GENERATED ALWAYS AS ((extract(hour FROM end_local) * 60 + extract(minute FROM end_local))::integer) STORED,
  slot_minutes          smallint CHECK (slot_minutes BETWEEN 5 AND 240),
  max_walk_in_tokens    smallint NOT NULL DEFAULT 0 CHECK (max_walk_in_tokens >= 0),
  visit_mode            text NOT NULL DEFAULT 'in_person' CHECK (visit_mode IN ('in_person', 'virtual')),
  effective_from        date NOT NULL,
  effective_to          date,                                                   -- exclusive
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid,
  version               integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, resource_id) REFERENCES booking.schedulable_resource (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id, consult_location_id) REFERENCES platform.location (tenant_id, facility_id, id),
  FOREIGN KEY (tenant_id, healthcare_service_id) REFERENCES catalog.healthcare_service (tenant_id, id),
  CHECK (end_local > start_local),
  CHECK (slot_minutes IS NOT NULL OR max_walk_in_tokens > 0),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT schedule_rule_no_overlap EXCLUDE USING gist (
    tenant_id WITH =, resource_id WITH =, weekday WITH =,
    int4range(start_minute, end_minute) WITH &&,
    daterange(effective_from, effective_to) WITH &&
  )
);
CREATE INDEX ON booking.schedule_rule (tenant_id, facility_id, consult_location_id);
CREATE INDEX ON booking.schedule_rule (tenant_id, healthcare_service_id);
SELECT platform.setup_tenant_table('booking.schedule_rule', 'mod_booking');

-- ---------------------------------------------------------------------------
-- schedule_exception: one-off changes for one resource on one date.
--   closed      : no bookings (whole day when times are NULL) — leave, conference…
--   block       : no bookings in a time window
--   extra_hours : an additional session (needs facility and times)
-- ---------------------------------------------------------------------------
CREATE TABLE booking.schedule_exception (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id             uuid NOT NULL REFERENCES platform.tenant (id),
  resource_id           uuid NOT NULL,
  on_date               date NOT NULL,
  kind                  text NOT NULL CHECK (kind IN ('closed', 'block', 'extra_hours')),
  start_local           time,
  end_local             time,
  facility_id           uuid,
  healthcare_service_id uuid,
  slot_minutes          smallint CHECK (slot_minutes BETWEEN 5 AND 240),
  reason                text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid,
  version               integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, resource_id) REFERENCES booking.schedulable_resource (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, healthcare_service_id) REFERENCES catalog.healthcare_service (tenant_id, id),
  CHECK ((start_local IS NULL) = (end_local IS NULL)),
  CHECK (start_local IS NULL OR end_local > start_local),
  CHECK (kind = 'closed' OR start_local IS NOT NULL),
  CHECK ((kind = 'extra_hours') = (facility_id IS NOT NULL)),
  CHECK (kind <> 'extra_hours' OR slot_minutes IS NOT NULL)
);
CREATE INDEX ON booking.schedule_exception (tenant_id, resource_id, on_date);
CREATE INDEX ON booking.schedule_exception (tenant_id, facility_id);
CREATE INDEX ON booking.schedule_exception (tenant_id, healthcare_service_id);
SELECT platform.setup_tenant_table('booking.schedule_exception', 'mod_booking');

CREATE TABLE booking.facility_holiday (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id uuid NOT NULL,
  holiday_on  date NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  version     integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, holiday_on),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id)
);
SELECT platform.setup_tenant_table('booking.facility_holiday', 'mod_booking');

-- ---------------------------------------------------------------------------
-- day_plan: a saved plan for one resource on one date. The highest revision wins. When
-- replaces_weekly is true its blocks are the whole day; otherwise they are added to the weekly rules.
-- ---------------------------------------------------------------------------
CREATE TABLE booking.day_plan (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenant (id),
  resource_id     uuid NOT NULL,
  plan_on         date NOT NULL,
  revision        integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  replaces_weekly boolean NOT NULL DEFAULT true,
  saved_by        uuid,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, resource_id, plan_on, revision),
  FOREIGN KEY (tenant_id, resource_id) REFERENCES booking.schedulable_resource (tenant_id, id),
  FOREIGN KEY (tenant_id, saved_by) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON booking.day_plan (tenant_id, saved_by);
SELECT platform.setup_tenant_table('booking.day_plan', 'mod_booking');

CREATE TABLE booking.day_plan_block (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id             uuid NOT NULL REFERENCES platform.tenant (id),
  day_plan_id           uuid NOT NULL,
  facility_id           uuid NOT NULL,
  consult_location_id   uuid,
  healthcare_service_id uuid,
  start_local           time NOT NULL,
  end_local             time NOT NULL,
  slot_minutes          smallint CHECK (slot_minutes BETWEEN 5 AND 240),
  max_walk_in_tokens    smallint NOT NULL DEFAULT 0 CHECK (max_walk_in_tokens >= 0),
  visit_mode            text NOT NULL DEFAULT 'in_person' CHECK (visit_mode IN ('in_person', 'virtual')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid,
  version               integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, day_plan_id) REFERENCES booking.day_plan (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id, consult_location_id) REFERENCES platform.location (tenant_id, facility_id, id),
  FOREIGN KEY (tenant_id, healthcare_service_id) REFERENCES catalog.healthcare_service (tenant_id, id),
  CHECK (end_local > start_local),
  CHECK (slot_minutes IS NOT NULL OR max_walk_in_tokens > 0)
);
CREATE INDEX ON booking.day_plan_block (tenant_id, day_plan_id);
CREATE INDEX ON booking.day_plan_block (tenant_id, facility_id, consult_location_id);
CREATE INDEX ON booking.day_plan_block (tenant_id, healthcare_service_id);
SELECT platform.setup_tenant_table('booking.day_plan_block', 'mod_booking');

-- ---------------------------------------------------------------------------
-- reservation: the lock on a resource's time. 'held' is a short hold while the patient confirms;
-- 'booked' backs an appointment. The exclusion constraint makes double-booking impossible.
-- Expired holds are released by the hold command (for the slot it wants) and by a sweeper job;
-- an index predicate can't use now().
-- ---------------------------------------------------------------------------
CREATE TABLE booking.reservation (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenant (id),
  resource_id     uuid NOT NULL,
  facility_id     uuid NOT NULL,
  period          tstzrange NOT NULL,
  status          text NOT NULL CHECK (status IN ('held', 'booked', 'released', 'expired')),
  owner_type      text CHECK (owner_type IN ('appointment', 'theatre_booking', 'imaging_study', 'waitlist_offer')),
  owner_id        uuid,
  hold_expires_at timestamptz,
  idempotency_key text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, resource_id) REFERENCES booking.schedulable_resource (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  CHECK (NOT isempty(period) AND lower_inc(period) AND NOT upper_inc(period) AND NOT upper_inf(period)),
  CHECK (status <> 'held' OR hold_expires_at IS NOT NULL),          -- expired holds keep their expiry time
  CHECK (status <> 'booked' OR owner_id IS NOT NULL),
  CONSTRAINT reservation_no_double_booking EXCLUDE USING gist (
    tenant_id WITH =, resource_id WITH =, period WITH &&
  ) WHERE (status IN ('held', 'booked'))
);
CREATE INDEX ON booking.reservation (tenant_id, facility_id);
CREATE INDEX reservation_expired_holds ON booking.reservation (hold_expires_at) WHERE status = 'held';
CREATE UNIQUE INDEX reservation_idempotency ON booking.reservation (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
SELECT platform.setup_tenant_table('booking.reservation', 'mod_booking');

-- Sweeper for the worker: marks lapsed holds 'expired' in every tenant. SECURITY DEFINER because the
-- worker has no tenant context; it can do nothing else.
CREATE FUNCTION booking.expire_holds() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, booking AS $$
  WITH expired AS (
    UPDATE booking.reservation SET status = 'expired'
    WHERE status = 'held' AND hold_expires_at <= now()
    RETURNING 1
  )
  SELECT count(*)::integer FROM expired;
$$;
REVOKE EXECUTE ON FUNCTION booking.expire_holds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION booking.expire_holds() TO hms_app;

-- ---------------------------------------------------------------------------
-- booking.sessions(resource, from, to): the effective sessions of a resource per date, after
-- day plans, extra hours, closures and holidays (blocks are applied per slot by available_slots).
-- ---------------------------------------------------------------------------
CREATE FUNCTION booking.sessions(p_resource_id uuid, p_from date, p_to date)
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

-- ---------------------------------------------------------------------------
-- booking.available_slots(resource, from, to, at): bookable slots with their status as of `p_at`
-- (default now(); commands pass their own clock so behaviour is testable).
-- 'free' slots can be held; 'taken' overlap an unexpired hold or a booking; 'blocked' fall in a
-- closed/blocked window. Slots starting before p_at are omitted.
-- ---------------------------------------------------------------------------
CREATE FUNCTION booking.available_slots(p_resource_id uuid, p_from date, p_to date,
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

-- migrate:down
DROP FUNCTION booking.available_slots(uuid, date, date, timestamptz);
DROP FUNCTION booking.expire_holds();
DROP FUNCTION booking.sessions(uuid, date, date);
DROP TABLE booking.reservation;
DROP TABLE booking.day_plan_block;
DROP TABLE booking.day_plan;
DROP TABLE booking.facility_holiday;
DROP TABLE booking.schedule_exception;
DROP TABLE booking.schedule_rule;
DROP TABLE booking.schedulable_resource;
