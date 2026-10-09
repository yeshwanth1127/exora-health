-- migrate:up

-- ---------------------------------------------------------------------------
-- staff: everyone who works for the tenant. The same doctor at two tenants is two rows, linked by hpr_id.
-- ---------------------------------------------------------------------------
CREATE TABLE platform.staff (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenant (id),
  employee_no     text NOT NULL,
  title           text,
  given_name      text NOT NULL,
  family_name     text,
  display_name    text NOT NULL,
  sex             text CHECK (sex IN ('male', 'female', 'other', 'unknown')),
  birth_date      date,
  phone           text,
  email           citext,
  staff_type      text NOT NULL CHECK (staff_type IN ('doctor', 'nurse', 'technician', 'pharmacist', 'admin', 'support', 'other')),
  hpr_id          text,                -- ABDM Healthcare Professional Registry ID
  employment_type text NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'visiting', 'contract')),
  active_from     date NOT NULL DEFAULT current_date,
  active_to       date,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, employee_no),
  UNIQUE (tenant_id, hpr_id),
  CHECK (active_to IS NULL OR active_to >= active_from)
);
CREATE INDEX staff_name_trgm ON platform.staff USING gin (display_name gin_trgm_ops);
SELECT platform.setup_tenant_table('platform.staff', 'mod_platform');

-- Professional council registrations; an expired one blocks clinical signing (checked by commands).
-- document_id gets its FK when documents.document exists (M14).
CREATE TABLE platform.staff_registration (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id        uuid NOT NULL,
  council         text NOT NULL,       -- e.g. NMC, Karnataka Medical Council, Indian Nursing Council
  registration_no text NOT NULL,
  valid_until     date,
  verified_at     timestamptz,
  verified_by     uuid,
  document_id     uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, council, registration_no),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, verified_by) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON platform.staff_registration (tenant_id, staff_id);
CREATE INDEX ON platform.staff_registration (tenant_id, verified_by);
SELECT platform.setup_tenant_table('platform.staff_registration', 'mod_platform');

-- ---------------------------------------------------------------------------
-- user_account: a login, for a staff member or (portal) a patient — exactly one.
-- patient_id gets its FK when patient.patient is created (M02).
-- ---------------------------------------------------------------------------
CREATE TABLE platform.user_account (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id           uuid,
  patient_id         uuid,
  identity_issuer    text NOT NULL,    -- OIDC issuer
  identity_subject   text NOT NULL,    -- OIDC subject
  email              citext,
  phone              text,
  mfa_enrolled       boolean NOT NULL DEFAULT false,
  status             text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'locked', 'disabled')),
  last_login_at      timestamptz,
  failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, identity_issuer, identity_subject),
  UNIQUE (tenant_id, staff_id),
  UNIQUE (tenant_id, patient_id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK (num_nonnulls(staff_id, patient_id) = 1)
);
SELECT platform.setup_tenant_table('platform.user_account', 'mod_platform');

-- Login happens before a tenant is chosen, so RLS would hide every account. This narrowly-scoped
-- SECURITY DEFINER function returns only the accounts matching one verified identity.
CREATE FUNCTION platform.accounts_for_identity(p_issuer text, p_subject text)
RETURNS TABLE (tenant_id uuid, user_account_id uuid, staff_id uuid, patient_id uuid, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, platform AS $$
  SELECT ua.tenant_id, ua.id, ua.staff_id, ua.patient_id, ua.status
  FROM platform.user_account ua
  JOIN platform.tenant t ON t.id = ua.tenant_id AND t.status IN ('trial', 'active')
  WHERE ua.identity_issuer = p_issuer AND ua.identity_subject = p_subject;
$$;
REVOKE EXECUTE ON FUNCTION platform.accounts_for_identity(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.accounts_for_identity(text, text) TO hms_app;

-- ---------------------------------------------------------------------------
-- RBAC. permission is a fixed global list (seeded). role.tenant_id NULL = system role,
-- readable by every tenant and changeable by none; tenants clone system roles to customise.
-- ---------------------------------------------------------------------------
CREATE TABLE platform.permission (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  code         text NOT NULL UNIQUE CHECK (code ~ '^[a-z_]+(\.[a-z_]+)+$'),
  module_code  text NOT NULL,
  description  text NOT NULL,
  is_sensitive boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform.role (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid REFERENCES platform.tenant (id),
  code           text NOT NULL CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  name           text NOT NULL,
  is_clinical    boolean NOT NULL DEFAULT false,
  is_system      boolean GENERATED ALWAYS AS (tenant_id IS NULL) STORED,
  cloned_from_id uuid REFERENCES platform.role (id),
  settings       jsonb NOT NULL DEFAULT '{}',   -- e.g. {"max_discount_percent": 10}
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  CONSTRAINT role_tenant_code_key UNIQUE NULLS NOT DISTINCT (tenant_id, code)
);
CREATE INDEX ON platform.role (cloned_from_id);
ALTER TABLE platform.role ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.role FORCE ROW LEVEL SECURITY;
CREATE POLICY system_or_own ON platform.role
  USING (tenant_id IS NULL OR tenant_id = (SELECT platform.current_tenant_id()))
  WITH CHECK (tenant_id = (SELECT platform.current_tenant_id()));
CREATE TRIGGER touch_row BEFORE UPDATE ON platform.role FOR EACH ROW EXECUTE FUNCTION platform.touch_row();
GRANT INSERT, UPDATE ON platform.role TO mod_platform;

-- tenant_id mirrors the role's tenant (set by trigger), so the same visibility rule applies.
CREATE TABLE platform.role_permission (
  role_id       uuid NOT NULL REFERENCES platform.role (id),
  permission_id uuid NOT NULL REFERENCES platform.permission (id),
  tenant_id     uuid REFERENCES platform.tenant (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  PRIMARY KEY (role_id, permission_id)
);
CREATE INDEX ON platform.role_permission (permission_id);
CREATE INDEX ON platform.role_permission (tenant_id);

CREATE FUNCTION platform.role_permission_tenant() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  SELECT r.tenant_id INTO NEW.tenant_id FROM platform.role r WHERE r.id = NEW.role_id;
  RETURN NEW;
END $$;
CREATE TRIGGER role_permission_tenant BEFORE INSERT ON platform.role_permission
  FOR EACH ROW EXECUTE FUNCTION platform.role_permission_tenant();

ALTER TABLE platform.role_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.role_permission FORCE ROW LEVEL SECURITY;
CREATE POLICY system_or_own ON platform.role_permission
  USING (tenant_id IS NULL OR tenant_id = (SELECT platform.current_tenant_id()))
  WITH CHECK (tenant_id = (SELECT platform.current_tenant_id()));
-- Removing a permission from a custom role is a normal admin action (audited), so DELETE is allowed here.
GRANT INSERT, DELETE ON platform.role_permission TO mod_platform;

-- role_grant: gives a staff member a role, optionally limited to one facility and a time window.
CREATE TABLE platform.role_grant (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id    uuid NOT NULL,
  role_id     uuid NOT NULL REFERENCES platform.role (id),
  facility_id uuid,                     -- NULL = all facilities of the tenant
  valid_from  timestamptz NOT NULL DEFAULT now(),
  valid_to    timestamptz,
  granted_by  uuid,
  revoked_at  timestamptz,
  revoked_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  version     integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, granted_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, revoked_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE INDEX ON platform.role_grant (tenant_id, staff_id);
CREATE INDEX ON platform.role_grant (role_id);
CREATE INDEX ON platform.role_grant (tenant_id, facility_id);
CREATE INDEX ON platform.role_grant (tenant_id, granted_by);
CREATE INDEX ON platform.role_grant (tenant_id, revoked_by);
SELECT platform.setup_tenant_table('platform.role_grant', 'mod_platform');

-- A plain FK can't say "system role or one of this tenant's roles" (FK checks ignore RLS).
-- Under RLS another tenant's role is simply not found, so "not found" must be rejected too —
-- it must never be mistaken for a system role (tenant_id NULL).
CREATE FUNCTION platform.role_grant_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  role_tenant uuid;
BEGIN
  SELECT r.tenant_id INTO role_tenant FROM platform.role r WHERE r.id = NEW.role_id;
  IF NOT FOUND OR (role_tenant IS NOT NULL AND role_tenant <> NEW.tenant_id) THEN
    RAISE EXCEPTION 'role % belongs to another tenant', NEW.role_id USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER role_grant_check BEFORE INSERT OR UPDATE OF role_id ON platform.role_grant
  FOR EACH ROW EXECUTE FUNCTION platform.role_grant_check();

-- ---------------------------------------------------------------------------
-- Clinical access beyond roles: a care relationship, or time-limited break-glass access.
-- patient_id / encounter_id get FKs when M02 / M05 tables exist.
-- ---------------------------------------------------------------------------
CREATE TABLE platform.care_assignment (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id     uuid NOT NULL,
  patient_id   uuid,
  encounter_id uuid,
  reason       text NOT NULL CHECK (reason IN ('attending', 'consulting', 'nursing', 'cover', 'other')),
  valid_from   timestamptz NOT NULL DEFAULT now(),
  valid_to     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK (num_nonnulls(patient_id, encounter_id) = 1),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE INDEX ON platform.care_assignment (tenant_id, staff_id);
CREATE INDEX ON platform.care_assignment (tenant_id, patient_id);
CREATE INDEX ON platform.care_assignment (tenant_id, encounter_id);
SELECT platform.setup_tenant_table('platform.care_assignment', 'mod_platform');

CREATE TABLE platform.emergency_access_grant (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id       uuid NOT NULL,
  patient_id     uuid NOT NULL,
  reason         text NOT NULL CHECK (length(btrim(reason)) >= 10),
  granted_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  review_outcome text CHECK (review_outcome IN ('appropriate', 'inappropriate')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, reviewed_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (expires_at > granted_at AND expires_at <= granted_at + interval '24 hours'),
  CHECK ((reviewed_at IS NULL) = (review_outcome IS NULL)),
  CHECK (reviewed_by IS NULL OR reviewed_by <> staff_id)
);
CREATE INDEX ON platform.emergency_access_grant (tenant_id, staff_id);
CREATE INDEX ON platform.emergency_access_grant (tenant_id, patient_id);
CREATE INDEX ON platform.emergency_access_grant (tenant_id, reviewed_by);
CREATE INDEX emergency_access_unreviewed ON platform.emergency_access_grant (tenant_id, granted_at) WHERE reviewed_at IS NULL;
SELECT platform.setup_tenant_table('platform.emergency_access_grant', 'mod_platform');

-- migrate:down
DROP TABLE platform.emergency_access_grant;
DROP TABLE platform.care_assignment;
DROP TABLE platform.role_grant;
DROP FUNCTION platform.role_grant_check();
DROP TABLE platform.role_permission;
DROP FUNCTION platform.role_permission_tenant();
DROP TABLE platform.role;
DROP TABLE platform.permission;
DROP FUNCTION platform.accounts_for_identity(text, text);
DROP TABLE platform.user_account;
DROP TABLE platform.staff_registration;
DROP TABLE platform.staff;
