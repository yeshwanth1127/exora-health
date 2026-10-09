-- migrate:up

-- ---------------------------------------------------------------------------
-- service_item: the single orderable AND billable catalogue
-- ---------------------------------------------------------------------------
CREATE TABLE catalog.service_item (
  id                       uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                uuid NOT NULL REFERENCES platform.tenant (id),
  code                     text NOT NULL,
  name                     text NOT NULL,
  short_name               text,
  category                 text NOT NULL CHECK (category IN ('consultation', 'lab_test', 'lab_panel', 'imaging', 'procedure',
                                                             'package', 'bed_day', 'nursing', 'diet', 'physiotherapy',
                                                             'referral', 'equipment', 'misc')),
  modality                 text CHECK (modality IN ('CR', 'DX', 'CT', 'MR', 'US', 'MG', 'NM', 'PT', 'XA', 'RF')),  -- DICOM codes
  concept_id               uuid REFERENCES catalog.terminology_concept (id),
  performing_department_id uuid,
  is_orderable             boolean NOT NULL DEFAULT true,
  is_billable              boolean NOT NULL DEFAULT true,
  requires_consent         boolean NOT NULL DEFAULT false,
  prep_instructions        text,
  sac_code                 text CHECK (sac_code ~ '^[0-9]{4,8}$'),   -- GST services accounting code
  status                   text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid,
  version                  integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, performing_department_id) REFERENCES platform.department (tenant_id, id),
  CHECK ((category = 'imaging') = (modality IS NOT NULL))
);
CREATE INDEX ON catalog.service_item (concept_id);
CREATE INDEX ON catalog.service_item (tenant_id, performing_department_id);
CREATE INDEX service_item_name_trgm ON catalog.service_item USING gin (name gin_trgm_ops);
SELECT platform.setup_tenant_table('catalog.service_item', 'mod_catalog');

ALTER TABLE catalog.healthcare_service
  ADD CONSTRAINT healthcare_service_consultation_item_fkey
  FOREIGN KEY (tenant_id, consultation_service_item_id) REFERENCES catalog.service_item (tenant_id, id);

-- Extension tables (lab_test_def, procedure_def, package_def) may only point at items of the right category.
-- Usage: EXECUTE FUNCTION catalog.require_item_category('lab_test')
CREATE FUNCTION catalog.require_item_category() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  actual text;
BEGIN
  SELECT s.category INTO actual FROM catalog.service_item s
  WHERE s.tenant_id = NEW.tenant_id AND s.id = NEW.service_item_id;
  IF actual IS DISTINCT FROM TG_ARGV[0] THEN
    RAISE EXCEPTION '%.% needs a service item of category %, got %', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_ARGV[0], actual
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

-- Panels (Lipid profile → tests) and package bundles. No cycles.
CREATE TABLE catalog.service_component (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  parent_item_id uuid NOT NULL,
  child_item_id  uuid NOT NULL,
  quantity       numeric(14, 3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sequence       smallint NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, parent_item_id, child_item_id),
  FOREIGN KEY (tenant_id, parent_item_id) REFERENCES catalog.service_item (tenant_id, id),
  FOREIGN KEY (tenant_id, child_item_id) REFERENCES catalog.service_item (tenant_id, id),
  CHECK (parent_item_id <> child_item_id)
);
CREATE INDEX ON catalog.service_component (tenant_id, child_item_id);
SELECT platform.setup_tenant_table('catalog.service_component', 'mod_catalog');

CREATE FUNCTION catalog.service_component_no_cycle() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE descendants (item_id) AS (
      SELECT NEW.child_item_id
      UNION
      SELECT sc.child_item_id
      FROM catalog.service_component sc
      JOIN descendants d ON sc.parent_item_id = d.item_id
      WHERE sc.tenant_id = NEW.tenant_id
    )
    SELECT 1 FROM descendants WHERE item_id = NEW.parent_item_id
  ) THEN
    RAISE EXCEPTION 'service component % → % would create a cycle', NEW.parent_item_id, NEW.child_item_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER no_cycle BEFORE INSERT OR UPDATE OF parent_item_id, child_item_id ON catalog.service_component
  FOR EACH ROW EXECUTE FUNCTION catalog.service_component_no_cycle();

-- ---------------------------------------------------------------------------
-- Lab definitions
-- ---------------------------------------------------------------------------
CREATE TABLE catalog.lab_test_def (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenant (id),
  service_item_id uuid NOT NULL,
  section         text NOT NULL CHECK (section IN ('biochemistry', 'haematology', 'clinical_pathology', 'microbiology',
                                                   'serology', 'histopathology', 'cytology', 'molecular', 'immunology')),
  specimen_type   text NOT NULL CHECK (specimen_type IN ('whole_blood', 'serum', 'plasma', 'urine', 'stool', 'csf',
                                                         'sputum', 'swab', 'tissue', 'fluid', 'other')),
  container_type  text CHECK (container_type IN ('edta', 'plain', 'sst', 'fluoride', 'citrate', 'heparin', 'sterile', 'other')),
  min_volume_ml   numeric(6, 2) CHECK (min_volume_ml > 0),
  tat_minutes     integer CHECK (tat_minutes > 0),
  method          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, service_item_id),
  FOREIGN KEY (tenant_id, service_item_id) REFERENCES catalog.service_item (tenant_id, id)
);
SELECT platform.setup_tenant_table('catalog.lab_test_def', 'mod_catalog');
CREATE TRIGGER item_category BEFORE INSERT OR UPDATE OF service_item_id ON catalog.lab_test_def
  FOR EACH ROW EXECUTE FUNCTION catalog.require_item_category('lab_test');

-- A reportable parameter: a lab test component (Hb, WBC…) or, with no test, a vital sign / score.
CREATE TABLE catalog.observation_definition (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id         uuid NOT NULL REFERENCES platform.tenant (id),
  lab_test_item_id  uuid,
  code              text NOT NULL,
  name              text NOT NULL,
  category          text NOT NULL CHECK (category IN ('lab', 'vital_sign', 'score', 'measurement')),
  loinc_concept_id  uuid REFERENCES catalog.terminology_concept (id),
  value_type        text NOT NULL CHECK (value_type IN ('numeric', 'text', 'coded', 'titre', 'culture')),
  unit              text,              -- UCUM
  decimal_places    smallint CHECK (decimal_places BETWEEN 0 AND 6),
  sequence          smallint NOT NULL DEFAULT 0,
  is_reportable     boolean NOT NULL DEFAULT true,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid,
  version           integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, lab_test_item_id) REFERENCES catalog.service_item (tenant_id, id),
  CHECK ((category = 'lab') = (lab_test_item_id IS NOT NULL))
);
CREATE INDEX ON catalog.observation_definition (tenant_id, lab_test_item_id);
CREATE INDEX ON catalog.observation_definition (loinc_concept_id);
SELECT platform.setup_tenant_table('catalog.observation_definition', 'mod_catalog');

-- Age/sex-specific normal and critical limits. Ages in days so neonatal ranges work.
CREATE TABLE catalog.reference_range (
  id                        uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                 uuid NOT NULL REFERENCES platform.tenant (id),
  observation_definition_id uuid NOT NULL,
  sex                       text NOT NULL DEFAULT 'any' CHECK (sex IN ('male', 'female', 'any')),
  age_min_days              integer NOT NULL DEFAULT 0 CHECK (age_min_days >= 0),
  age_max_days              integer,                       -- exclusive; NULL = no upper limit
  low                       numeric,
  high                      numeric,
  critical_low              numeric,
  critical_high             numeric,
  text_range                text,
  valid_from                date NOT NULL DEFAULT current_date,
  valid_to                  date,
  created_at                timestamptz NOT NULL DEFAULT now(),
  created_by                uuid,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                uuid,
  version                   integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, observation_definition_id) REFERENCES catalog.observation_definition (tenant_id, id),
  CHECK (age_max_days IS NULL OR age_max_days > age_min_days),
  CHECK (low IS NULL OR high IS NULL OR low <= high),
  CHECK (critical_low IS NULL OR low IS NULL OR critical_low <= low),
  CHECK (critical_high IS NULL OR high IS NULL OR critical_high >= high),
  CHECK (num_nonnulls(low, high, text_range) >= 1),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  -- No two ranges for the same parameter and sex may cover the same age on the same date.
  EXCLUDE USING gist (tenant_id WITH =, observation_definition_id WITH =, sex WITH =,
                      int4range(age_min_days, age_max_days) WITH &&,
                      daterange(valid_from, valid_to) WITH &&)
);
SELECT platform.setup_tenant_table('catalog.reference_range', 'mod_catalog');

CREATE TABLE catalog.answer_option (
  id                        uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                 uuid NOT NULL REFERENCES platform.tenant (id),
  observation_definition_id uuid NOT NULL,
  code                      text NOT NULL,
  display                   text NOT NULL,
  is_abnormal               boolean NOT NULL DEFAULT false,
  sequence                  smallint NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now(),
  created_by                uuid,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                uuid,
  version                   integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, observation_definition_id, code),
  FOREIGN KEY (tenant_id, observation_definition_id) REFERENCES catalog.observation_definition (tenant_id, id)
);
SELECT platform.setup_tenant_table('catalog.answer_option', 'mod_catalog');

-- ---------------------------------------------------------------------------
-- Procedures and packages
-- ---------------------------------------------------------------------------
CREATE TABLE catalog.procedure_def (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  service_item_id      uuid NOT NULL,
  snomed_concept_id    uuid REFERENCES catalog.terminology_concept (id),
  specialty_id         uuid REFERENCES catalog.specialty (id),
  surgery_grade        text CHECK (surgery_grade IN ('minor', 'intermediate', 'major', 'supra_major')),
  default_duration_min smallint CHECK (default_duration_min > 0),
  needs_theatre        boolean NOT NULL DEFAULT false,
  needs_anaesthesia    boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  version              integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, service_item_id),
  FOREIGN KEY (tenant_id, service_item_id) REFERENCES catalog.service_item (tenant_id, id)
);
CREATE INDEX ON catalog.procedure_def (snomed_concept_id);
CREATE INDEX ON catalog.procedure_def (specialty_id);
SELECT platform.setup_tenant_table('catalog.procedure_def', 'mod_catalog');
CREATE TRIGGER item_category BEFORE INSERT OR UPDATE OF service_item_id ON catalog.procedure_def
  FOR EACH ROW EXECUTE FUNCTION catalog.require_item_category('procedure');

CREATE TABLE catalog.package_def (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id             uuid NOT NULL REFERENCES platform.tenant (id),
  service_item_id       uuid NOT NULL,
  included_los_days     smallint CHECK (included_los_days >= 0),
  max_bed_category_rank smallint,
  procedure_def_id      uuid,
  scheme_package_code   text,           -- e.g. PM-JAY health benefit package code
  valid_from            date NOT NULL DEFAULT current_date,
  valid_to              date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid,
  version               integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, service_item_id),
  FOREIGN KEY (tenant_id, service_item_id) REFERENCES catalog.service_item (tenant_id, id),
  FOREIGN KEY (tenant_id, procedure_def_id) REFERENCES catalog.procedure_def (tenant_id, id),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE INDEX ON catalog.package_def (tenant_id, procedure_def_id);
SELECT platform.setup_tenant_table('catalog.package_def', 'mod_catalog');
CREATE TRIGGER item_category BEFORE INSERT OR UPDATE OF service_item_id ON catalog.package_def
  FOR EACH ROW EXECUTE FUNCTION catalog.require_item_category('package');

-- What a package covers; usage beyond qty/amount limits bills normally.
-- item_id / item_group_id get FKs when the inventory module exists.
CREATE TABLE catalog.package_inclusion (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  package_def_id     uuid NOT NULL,
  kind               text NOT NULL CHECK (kind IN ('service_item', 'service_category', 'item', 'item_group', 'bed_days')),
  service_item_id    uuid,
  service_category   text,
  item_id            uuid,
  item_group_id      uuid,
  qty_limit          numeric(14, 3) CHECK (qty_limit > 0),
  amount_limit_minor bigint CHECK (amount_limit_minor >= 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, package_def_id) REFERENCES catalog.package_def (tenant_id, id),
  FOREIGN KEY (tenant_id, service_item_id) REFERENCES catalog.service_item (tenant_id, id),
  CHECK ((kind = 'service_item') = (service_item_id IS NOT NULL)),
  CHECK ((kind = 'service_category') = (service_category IS NOT NULL)),
  CHECK ((kind = 'item') = (item_id IS NOT NULL)),
  CHECK ((kind = 'item_group') = (item_group_id IS NOT NULL)),
  CHECK (kind <> 'bed_days' OR qty_limit IS NOT NULL)
);
CREATE INDEX ON catalog.package_inclusion (tenant_id, package_def_id);
CREATE INDEX ON catalog.package_inclusion (tenant_id, service_item_id);
CREATE INDEX ON catalog.package_inclusion (tenant_id, item_id);
CREATE INDEX ON catalog.package_inclusion (tenant_id, item_group_id);
SELECT platform.setup_tenant_table('catalog.package_inclusion', 'mod_catalog');

-- migrate:down
DROP TABLE catalog.package_inclusion;
DROP TABLE catalog.package_def;
DROP TABLE catalog.procedure_def;
DROP TABLE catalog.answer_option;
DROP TABLE catalog.reference_range;
DROP TABLE catalog.observation_definition;
DROP TABLE catalog.lab_test_def;
DROP TABLE catalog.service_component;
DROP FUNCTION catalog.service_component_no_cycle();
DROP FUNCTION catalog.require_item_category();
ALTER TABLE catalog.healthcare_service DROP CONSTRAINT healthcare_service_consultation_item_fkey;
DROP TABLE catalog.service_item;
