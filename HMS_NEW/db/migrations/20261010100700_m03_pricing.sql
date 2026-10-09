-- migrate:up

-- ---------------------------------------------------------------------------
-- tax_rule: GST as configurable data (rates and exemptions change; the tenant's CA configures them).
-- tenant_id NULL = system default visible to all tenants (like system roles). Rates in basis points
-- (5% = 500). No rates are seeded: they must be confirmed for each deployment.
-- ---------------------------------------------------------------------------
CREATE TABLE catalog.tax_rule (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id             uuid REFERENCES platform.tenant (id),
  tax_code              text NOT NULL,
  description           text NOT NULL,
  hsn_sac_code          text CHECK (hsn_sac_code ~ '^[0-9]{4,8}$'),
  service_category      text,
  item_type             text,
  encounter_class       text CHECK (encounter_class IN ('outpatient', 'emergency', 'inpatient', 'day_care', 'virtual')),
  min_unit_price_minor  bigint CHECK (min_unit_price_minor >= 0),   -- threshold rules (e.g. room rent per day)
  excluded_ward_types   text[] NOT NULL DEFAULT '{}',
  gst_rate_bp           integer NOT NULL CHECK (gst_rate_bp BETWEEN 0 AND 10000),
  cess_rate_bp          integer NOT NULL DEFAULT 0 CHECK (cess_rate_bp BETWEEN 0 AND 10000),
  itc_allowed           boolean NOT NULL DEFAULT true,
  priority              smallint NOT NULL DEFAULT 100,               -- lower wins when several rules match
  valid_from            date NOT NULL,
  valid_to              date,
  legal_reference       text,                                        -- notification number
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid,
  version               integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE NULLS NOT DISTINCT (tenant_id, tax_code, valid_from),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
ALTER TABLE catalog.tax_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.tax_rule FORCE ROW LEVEL SECURITY;
CREATE POLICY system_or_own ON catalog.tax_rule
  USING (tenant_id IS NULL OR tenant_id = (SELECT platform.current_tenant_id()))
  WITH CHECK (tenant_id = (SELECT platform.current_tenant_id()));
CREATE TRIGGER touch_row BEFORE UPDATE ON catalog.tax_rule FOR EACH ROW EXECUTE FUNCTION platform.touch_row();
GRANT INSERT, UPDATE ON catalog.tax_rule TO mod_catalog;

-- ---------------------------------------------------------------------------
-- price_list: a rate card. Edited only while 'draft'; once active it is frozen (a new list_version
-- replaces it), so every charge can point at the exact prices it used.
-- payer_id gets its FK when the insurance module exists.
-- ---------------------------------------------------------------------------
CREATE TABLE catalog.price_list (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  code         text NOT NULL,
  name         text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('cash', 'corporate', 'insurer_contract', 'government_scheme', 'staff')),
  payer_id     uuid,
  currency     char(3) NOT NULL DEFAULT 'INR',
  list_version integer NOT NULL DEFAULT 1 CHECK (list_version > 0),
  valid_from   date NOT NULL,
  valid_to     date,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  is_default   boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  activated_by uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code, list_version),
  FOREIGN KEY (tenant_id, activated_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  CHECK ((status = 'draft') = (activated_at IS NULL)),
  CHECK (NOT is_default OR kind = 'cash')
);
CREATE UNIQUE INDEX price_list_one_default ON catalog.price_list (tenant_id) WHERE is_default AND status = 'active';
CREATE INDEX ON catalog.price_list (tenant_id, payer_id);
CREATE INDEX ON catalog.price_list (tenant_id, activated_by);
SELECT platform.setup_tenant_table('catalog.price_list', 'mod_catalog');

-- Lifecycle draft → active → retired; once active only status, valid_to and is_default may change.
CREATE FUNCTION catalog.price_list_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'draft' AND (NEW.code, NEW.name, NEW.kind, NEW.payer_id, NEW.currency, NEW.list_version, NEW.valid_from)
       IS DISTINCT FROM (OLD.code, OLD.name, OLD.kind, OLD.payer_id, OLD.currency, OLD.list_version, OLD.valid_from) THEN
    RAISE EXCEPTION 'price list % is %; create a new version instead of editing it', OLD.code, OLD.status
      USING ERRCODE = '55000';
  END IF;
  IF (OLD.status, NEW.status) IN (('active', 'draft'), ('retired', 'draft'), ('retired', 'active')) THEN
    RAISE EXCEPTION 'price list cannot go from % back to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER price_list_guard BEFORE UPDATE ON catalog.price_list
  FOR EACH ROW EXECUTE FUNCTION catalog.price_list_guard();

-- ---------------------------------------------------------------------------
-- price_list_item: a service price (fixed) or an inventory pricing rule (MRP − discount / cost + markup).
-- Most specific match wins: staff > bed category > encounter class > generic.
-- item_id / item_group_id get FKs when the inventory module exists.
-- ---------------------------------------------------------------------------
CREATE TABLE catalog.price_list_item (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  price_list_id        uuid NOT NULL,
  service_item_id      uuid,
  item_id              uuid,
  item_group_id        uuid,
  bed_category_id      uuid,
  staff_id             uuid,                 -- doctor-specific consultation fee
  encounter_class      text CHECK (encounter_class IN ('outpatient', 'emergency', 'inpatient', 'day_care', 'virtual')),
  unit_price_minor     bigint CHECK (unit_price_minor >= 0),
  item_pricing_method  text CHECK (item_pricing_method IN ('mrp_less_discount', 'cost_plus_markup')),
  percent_bp           integer CHECK (percent_bp BETWEEN 0 AND 100000),
  charge_trigger       text NOT NULL DEFAULT 'on_order' CHECK (charge_trigger IN ('on_order', 'on_performance', 'daily', 'on_dispense')),
  tax_rule_id          uuid REFERENCES catalog.tax_rule (id),
  valid_from           date NOT NULL,
  valid_to             date,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  version              integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, price_list_id) REFERENCES catalog.price_list (tenant_id, id),
  FOREIGN KEY (tenant_id, service_item_id) REFERENCES catalog.service_item (tenant_id, id),
  FOREIGN KEY (tenant_id, bed_category_id) REFERENCES catalog.bed_category (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK (num_nonnulls(service_item_id, item_id, item_group_id) = 1),
  CHECK ((unit_price_minor IS NULL) <> (item_pricing_method IS NULL)),          -- a fixed price or a rule
  CHECK ((item_pricing_method IS NULL) = (percent_bp IS NULL)),
  CHECK (service_item_id IS NULL OR unit_price_minor IS NOT NULL),              -- services always have a fixed price
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT price_list_item_no_overlap EXCLUDE USING gist (
    tenant_id WITH =,
    price_list_id WITH =,
    (coalesce(service_item_id, item_id, item_group_id)) WITH =,
    (coalesce(bed_category_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    (coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    (coalesce(encounter_class, '')) WITH =,
    daterange(valid_from, valid_to) WITH &&
  )
);
CREATE INDEX ON catalog.price_list_item (tenant_id, price_list_id);
CREATE INDEX ON catalog.price_list_item (tenant_id, service_item_id);
CREATE INDEX ON catalog.price_list_item (tenant_id, item_id);
CREATE INDEX ON catalog.price_list_item (tenant_id, item_group_id);
CREATE INDEX ON catalog.price_list_item (tenant_id, bed_category_id);
CREATE INDEX ON catalog.price_list_item (tenant_id, staff_id);
CREATE INDEX ON catalog.price_list_item (tax_rule_id);
SELECT platform.setup_tenant_table('catalog.price_list_item', 'mod_catalog');

-- Items of a non-draft list are frozen.
CREATE FUNCTION catalog.price_list_item_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  list_status text;
BEGIN
  SELECT pl.status INTO list_status FROM catalog.price_list pl
  WHERE pl.tenant_id = coalesce(NEW.tenant_id, OLD.tenant_id) AND pl.id = coalesce(NEW.price_list_id, OLD.price_list_id);
  IF list_status <> 'draft' THEN
    RAISE EXCEPTION 'price list is %; its prices can no longer change', list_status USING ERRCODE = '55000';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER price_list_item_guard BEFORE INSERT OR UPDATE OR DELETE ON catalog.price_list_item
  FOR EACH ROW EXECUTE FUNCTION catalog.price_list_item_guard();

-- ---------------------------------------------------------------------------
-- Surgical team fees as a share of the primary surgeon's fee
-- ---------------------------------------------------------------------------
CREATE TABLE catalog.team_fee_rule (
  id                         uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                  uuid NOT NULL REFERENCES platform.tenant (id),
  price_list_id              uuid NOT NULL,
  team_role                  text NOT NULL CHECK (team_role IN ('assistant_surgeon', 'anaesthetist', 'scrub_nurse',
                                                                'circulating_nurse', 'perfusionist', 'technician')),
  percent_of_surgeon_fee_bp  integer NOT NULL CHECK (percent_of_surgeon_fee_bp BETWEEN 0 AND 10000),
  valid_from                 date NOT NULL,
  valid_to                   date,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  created_by                 uuid,
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  updated_by                 uuid,
  version                    integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, price_list_id) REFERENCES catalog.price_list (tenant_id, id),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  EXCLUDE USING gist (tenant_id WITH =, price_list_id WITH =, team_role WITH =, daterange(valid_from, valid_to) WITH &&)
);
SELECT platform.setup_tenant_table('catalog.team_fee_rule', 'mod_catalog');

-- ---------------------------------------------------------------------------
-- How bed-days are counted (hospitals and payers differ)
-- ---------------------------------------------------------------------------
CREATE TABLE catalog.bed_charge_rule (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id               uuid NOT NULL REFERENCES platform.tenant (id),
  price_list_id           uuid,          -- NULL = tenant default
  facility_id             uuid,          -- NULL = all facilities
  method                  text NOT NULL CHECK (method IN ('midnight_census', 'per_24h_from_admit', 'calendar_day_any_part')),
  grace_minutes           integer NOT NULL DEFAULT 0 CHECK (grace_minutes BETWEEN 0 AND 1440),
  half_day_after_minutes  integer CHECK (half_day_after_minutes BETWEEN 1 AND 1440),
  retained_bed_percent_bp integer NOT NULL DEFAULT 10000 CHECK (retained_bed_percent_bp BETWEEN 0 AND 10000),
  valid_from              date NOT NULL,
  valid_to                date,
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid,
  version                 integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, price_list_id) REFERENCES catalog.price_list (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  EXCLUDE USING gist (
    tenant_id WITH =,
    (coalesce(price_list_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    (coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    daterange(valid_from, valid_to) WITH &&
  )
);
CREATE INDEX ON catalog.bed_charge_rule (tenant_id, price_list_id);
CREATE INDEX ON catalog.bed_charge_rule (tenant_id, facility_id);
SELECT platform.setup_tenant_table('catalog.bed_charge_rule', 'mod_catalog');

-- migrate:down
DROP TABLE catalog.bed_charge_rule;
DROP TABLE catalog.team_fee_rule;
DROP TABLE catalog.price_list_item;
DROP FUNCTION catalog.price_list_item_guard();
DROP TABLE catalog.price_list;
DROP FUNCTION catalog.price_list_guard();
DROP TABLE catalog.tax_rule;
