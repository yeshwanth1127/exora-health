-- migrate:up

-- ---------------------------------------------------------------------------
-- tenant: a customer (hospital group). Created by provisioning, not by the app.
-- A tenant can read and update only its own row.
-- ---------------------------------------------------------------------------
CREATE TABLE platform.tenant (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  legal_name       text,
  pan              text CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  default_currency char(3) NOT NULL DEFAULT 'INR',
  default_timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  status           text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'closed')),
  plan_code        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1
);
ALTER TABLE platform.tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.tenant FORCE ROW LEVEL SECURITY;
CREATE POLICY own_tenant ON platform.tenant
  USING (id = (SELECT platform.current_tenant_id()))
  WITH CHECK (id = (SELECT platform.current_tenant_id()));
CREATE TRIGGER touch_row BEFORE UPDATE ON platform.tenant FOR EACH ROW EXECUTE FUNCTION platform.touch_row();
GRANT UPDATE ON platform.tenant TO mod_platform;

-- ---------------------------------------------------------------------------
-- organization: legal/administrative grouping inside a tenant
-- ---------------------------------------------------------------------------
CREATE TABLE platform.organization (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL REFERENCES platform.tenant (id),
  parent_id   uuid,
  name        text NOT NULL,
  org_type    text NOT NULL CHECK (org_type IN ('group', 'hospital', 'clinic')),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  version     integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, parent_id) REFERENCES platform.organization (tenant_id, id),
  CHECK (parent_id <> id)
);
CREATE INDEX ON platform.organization (tenant_id, parent_id);
SELECT platform.setup_tenant_table('platform.organization', 'mod_platform');

-- ---------------------------------------------------------------------------
-- facility: a physical branch. GSTIN is registered per state, so it lives here.
-- ---------------------------------------------------------------------------
CREATE TABLE platform.facility (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id             uuid NOT NULL REFERENCES platform.tenant (id),
  organization_id       uuid NOT NULL,
  code                  text NOT NULL,
  name                  text NOT NULL,
  facility_type         text NOT NULL CHECK (facility_type IN ('hospital', 'clinic', 'diagnostic_centre', 'pharmacy', 'virtual')),
  hfr_id                text,                       -- ABDM Health Facility Registry ID
  nabh_accreditation_no text,
  gstin                 text CHECK (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  state_code            char(2) NOT NULL CHECK (state_code ~ '^[0-9]{2}$'),  -- GST state code
  address_line1         text,
  address_line2         text,
  city                  text,
  district              text,
  pincode               text CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  phone                 text,
  email                 citext,
  timezone              text NOT NULL DEFAULT 'Asia/Kolkata',
  is_virtual            boolean NOT NULL DEFAULT false,
  status                text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid,
  version               integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, hfr_id),
  FOREIGN KEY (tenant_id, organization_id) REFERENCES platform.organization (tenant_id, id),
  CHECK (gstin IS NULL OR left(gstin, 2) = state_code)
);
CREATE INDEX ON platform.facility (tenant_id, organization_id);
SELECT platform.setup_tenant_table('platform.facility', 'mod_platform');

-- ---------------------------------------------------------------------------
-- department: clinical/support unit of one facility (parent must be in the same facility)
-- specialty_id gets its FK when catalog.specialty is created (M03).
-- ---------------------------------------------------------------------------
CREATE TABLE platform.department (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id  uuid NOT NULL,
  parent_id    uuid,
  code         text NOT NULL,
  name         text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('clinical', 'diagnostic', 'support', 'administrative')),
  specialty_id uuid,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, id),
  UNIQUE (tenant_id, facility_id, code),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id, parent_id) REFERENCES platform.department (tenant_id, facility_id, id),
  CHECK (parent_id <> id)
);
CREATE INDEX ON platform.department (tenant_id, facility_id, parent_id);
SELECT platform.setup_tenant_table('platform.department', 'mod_platform');

-- ---------------------------------------------------------------------------
-- location: one tree per facility — building › floor › ward › room › bed, plus theatres, stores,
-- counters, labs, consult and imaging rooms. Parent and department must be in the same facility.
-- bed_category_id gets its FK when catalog.bed_category is created (M03).
-- ---------------------------------------------------------------------------
CREATE TABLE platform.location (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id        uuid NOT NULL,
  parent_location_id uuid,
  department_id      uuid,
  kind               text NOT NULL CHECK (kind IN ('building', 'floor', 'ward', 'room', 'bed', 'theatre', 'store',
                                                   'counter', 'lab', 'imaging_room', 'consult_room')),
  code               text NOT NULL,
  name               text NOT NULL,
  ward_type          text CHECK (ward_type IN ('general', 'icu', 'nicu', 'picu', 'hdu', 'maternity', 'isolation',
                                               'daycare', 'emergency', 'burns', 'dialysis')),
  gender_restriction text NOT NULL DEFAULT 'any' CHECK (gender_restriction IN ('male', 'female', 'any')),
  isolation_capable  boolean NOT NULL DEFAULT false,
  bed_category_id    uuid,
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, id),
  UNIQUE (tenant_id, facility_id, code),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id, parent_location_id) REFERENCES platform.location (tenant_id, facility_id, id),
  FOREIGN KEY (tenant_id, facility_id, department_id) REFERENCES platform.department (tenant_id, facility_id, id),
  CHECK (parent_location_id <> id),
  CHECK ((kind = 'ward') = (ward_type IS NOT NULL)),
  CHECK ((kind = 'bed') = (bed_category_id IS NOT NULL))
);
CREATE INDEX ON platform.location (tenant_id, facility_id, parent_location_id);
CREATE INDEX ON platform.location (tenant_id, facility_id, department_id);
CREATE INDEX ON platform.location (tenant_id, bed_category_id);
SELECT platform.setup_tenant_table('platform.location', 'mod_platform');

-- Tree rules the FKs can't express: no cycles, bounded depth, and every bed sits under a ward.
CREATE FUNCTION platform.location_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  cur      uuid := NEW.parent_location_id;
  cur_kind text;
  depth    int := 0;
  has_ward boolean := false;
BEGIN
  WHILE cur IS NOT NULL LOOP
    IF cur = NEW.id THEN
      RAISE EXCEPTION 'location % would become its own ancestor', NEW.id USING ERRCODE = '23514';
    END IF;
    depth := depth + 1;
    IF depth > 32 THEN
      RAISE EXCEPTION 'location tree is deeper than 32 levels' USING ERRCODE = '23514';
    END IF;
    SELECT l.kind, l.parent_location_id INTO cur_kind, cur
    FROM platform.location l
    WHERE l.tenant_id = NEW.tenant_id AND l.id = cur;
    IF cur_kind = 'ward' THEN
      has_ward := true;
    END IF;
  END LOOP;
  IF NEW.kind = 'bed' AND NOT has_ward THEN
    RAISE EXCEPTION 'bed % must sit under a ward', NEW.code USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER location_check
  BEFORE INSERT OR UPDATE OF parent_location_id, kind ON platform.location
  FOR EACH ROW EXECUTE FUNCTION platform.location_check();

-- migrate:down
DROP TABLE platform.location;
DROP FUNCTION platform.location_check();
DROP TABLE platform.department;
DROP TABLE platform.facility;
DROP TABLE platform.organization;
DROP TABLE platform.tenant;
