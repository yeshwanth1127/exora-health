-- migrate:up

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- uuid/text equality inside exclusion constraints
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy name search
CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive emails

-- ---------------------------------------------------------------------------
-- Database roles (cluster-wide, so created only if missing).
--   hms_reader   : SELECT on every module schema; inherited by the app and every module role
--   hms_app      : the API/worker connection; reads everything, writes nothing by itself
--   mod_<module> : write rights for one module's schema; hms_app gains them only via SET ROLE
--   hms_readonly : reporting (published views only, granted later)
-- LOGIN and passwords are set by environment provisioning, never in migrations.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['hms_reader', 'hms_app', 'hms_readonly',
                           'mod_platform', 'mod_patient', 'mod_catalog', 'mod_booking'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOBYPASSRLS', r);
    END IF;
  END LOOP;
END $$;

GRANT hms_reader TO hms_app, mod_platform, mod_patient, mod_catalog, mod_booking;
GRANT mod_platform, mod_patient, mod_catalog, mod_booking TO hms_app WITH INHERIT FALSE, SET TRUE;

-- ---------------------------------------------------------------------------
-- Schemas (one per module; later modules add theirs in their first migration)
-- ---------------------------------------------------------------------------
CREATE SCHEMA platform;
CREATE SCHEMA patient;
CREATE SCHEMA catalog;
CREATE SCHEMA booking;

GRANT USAGE ON SCHEMA platform, patient, catalog, booking TO hms_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform, patient, catalog, booking GRANT SELECT ON TABLES TO hms_reader;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Tenant of the current transaction. Raises if the app forgot to set it, so queries fail closed.
CREATE FUNCTION platform.current_tenant_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v text := current_setting('app.tenant_id', true);
BEGIN
  IF v IS NULL OR v = '' THEN
    RAISE EXCEPTION 'app.tenant_id is not set for this transaction' USING ERRCODE = '42501';
  END IF;
  RETURN v::uuid;
END $$;

-- BEFORE UPDATE: stamps updated_at and bumps version (the app updates WHERE version = <read version>).
CREATE FUNCTION platform.touch_row() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END $$;

-- BEFORE UPDATE/DELETE on append-only tables. Backs up the missing grants; also stops superusers by accident.
CREATE FUNCTION platform.forbid_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on %.% is not allowed: rows are immutable', TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = '42501';
END $$;

-- Standard tenant-isolation policy: rows are visible and writable only for the transaction's tenant.
CREATE FUNCTION platform.apply_tenant_rls(tbl regclass) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %s
       USING (tenant_id = (SELECT platform.current_tenant_id()))
       WITH CHECK (tenant_id = (SELECT platform.current_tenant_id()))', tbl);
END $$;

-- Everything a normal tenant-owned table needs: RLS, version/updated_at trigger, module write grant.
CREATE FUNCTION platform.setup_tenant_table(tbl regclass, module_role name) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM platform.apply_tenant_rls(tbl);
  EXECUTE format('CREATE TRIGGER touch_row BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION platform.touch_row()', tbl);
  EXECUTE format('GRANT INSERT, UPDATE ON %s TO %I', tbl, module_role);
END $$;

-- Creates monthly partitions (UTC month boundaries) for `parent` from `from_month` through
-- `months_ahead` months later, each with the tenant policy (policies are not inherited by partitions).
CREATE FUNCTION platform.ensure_month_partitions(parent regclass, months_ahead int DEFAULT 3,
                                                 from_month date DEFAULT current_date) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  m   date := date_trunc('month', from_month)::date;
  sch text;
  rel text;
  part text;
BEGIN
  SELECT n.nspname, c.relname INTO sch, rel
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = parent;

  FOR i IN 0..months_ahead LOOP
    part := format('%s_y%sm%s', rel, to_char(m, 'YYYY'), to_char(m, 'MM'));
    IF to_regclass(format('%I.%I', sch, part)) IS NULL THEN
      EXECUTE format('CREATE TABLE %I.%I PARTITION OF %s FOR VALUES FROM (%L) TO (%L)',
                     sch, part, parent,
                     m::timestamp AT TIME ZONE 'UTC',
                     (m + interval '1 month')::timestamp AT TIME ZONE 'UTC');
      PERFORM platform.apply_tenant_rls(format('%I.%I', sch, part)::regclass);
    END IF;
    m := (m + interval '1 month')::date;
  END LOOP;
END $$;

-- migrate:down
DROP SCHEMA booking CASCADE;
DROP SCHEMA catalog CASCADE;
DROP SCHEMA patient CASCADE;
DROP SCHEMA platform CASCADE;
-- Roles are cluster-wide and may be used by other databases; they are left in place.
