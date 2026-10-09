-- migrate:up

-- ---------------------------------------------------------------------------
-- Global reference data (no tenant_id, no RLS). Loaded by reference seeds / loaders run as the
-- migrator; no module role can write it.
-- ---------------------------------------------------------------------------
CREATE TABLE catalog.specialty (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  code       text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  name       text NOT NULL,
  parent_id  uuid REFERENCES catalog.specialty (id),
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_id <> id)
);
CREATE INDEX ON catalog.specialty (parent_id);

-- One row per code per release. SNOMED CT India edition (NRCeS), WHO ICD-10 (not ICD-10-CM), LOINC, UCUM.
CREATE TABLE catalog.terminology_concept (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  system       text NOT NULL CHECK (system IN ('snomed_ct', 'icd10_who', 'loinc', 'ucum', 'dicom_modality')),
  code         text NOT NULL,
  display      text NOT NULL,
  system_version text NOT NULL DEFAULT '',   -- code-system release (e.g. LOINC 2.78); '' = unversioned
  is_active    boolean NOT NULL DEFAULT true,
  parent_codes text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system, code, system_version)
);
CREATE INDEX terminology_display_trgm ON catalog.terminology_concept USING gin (display gin_trgm_ops);

-- e.g. SNOMED CT → ICD-10 for claims
CREATE TABLE catalog.concept_map (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  source_concept_id uuid NOT NULL REFERENCES catalog.terminology_concept (id),
  target_concept_id uuid NOT NULL REFERENCES catalog.terminology_concept (id),
  map_priority      smallint NOT NULL DEFAULT 1,
  map_rule          text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_concept_id, target_concept_id),
  CHECK (source_concept_id <> target_concept_id)
);
CREATE INDEX ON catalog.concept_map (target_concept_id);

ALTER TABLE platform.department
  ADD FOREIGN KEY (specialty_id) REFERENCES catalog.specialty (id);
CREATE INDEX ON platform.department (specialty_id);

-- ---------------------------------------------------------------------------
-- Directory
-- ---------------------------------------------------------------------------
CREATE TABLE catalog.practitioner_profile (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id         uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id          uuid NOT NULL,
  specialty_id      uuid REFERENCES catalog.specialty (id),
  qualifications    text[] NOT NULL DEFAULT '{}',
  bio               text,
  experience_years  smallint CHECK (experience_years BETWEEN 0 AND 80),
  languages         text[] NOT NULL DEFAULT '{}',
  photo_document_id uuid,                -- FK when documents module exists
  accepts_virtual   boolean NOT NULL DEFAULT false,
  public_slug       text CHECK (public_slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  published         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid,
  version           integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, staff_id),
  UNIQUE (tenant_id, public_slug),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK (NOT published OR public_slug IS NOT NULL)
);
CREATE INDEX ON catalog.practitioner_profile (specialty_id);
SELECT platform.setup_tenant_table('catalog.practitioner_profile', 'mod_catalog');

-- Where a practitioner works (replaces doctor_branches / doctor_departments). No overlapping duplicates.
CREATE TABLE catalog.practitioner_affiliation (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id      uuid NOT NULL,
  facility_id   uuid NOT NULL,
  department_id uuid NOT NULL,
  role_title    text,
  valid_from    date NOT NULL DEFAULT current_date,
  valid_to      date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid,
  version       integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id, department_id) REFERENCES platform.department (tenant_id, facility_id, id),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  EXCLUDE USING gist (tenant_id WITH =, staff_id WITH =, department_id WITH =,
                      daterange(valid_from, valid_to) WITH &&)
);
CREATE INDEX ON catalog.practitioner_affiliation (tenant_id, staff_id);
CREATE INDEX ON catalog.practitioner_affiliation (tenant_id, facility_id, department_id);
SELECT platform.setup_tenant_table('catalog.practitioner_affiliation', 'mod_catalog');

-- What patients can book. consultation_service_item_id gets its FK when service_item exists.
CREATE TABLE catalog.healthcare_service (
  id                           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                    uuid NOT NULL REFERENCES platform.tenant (id),
  department_id                uuid NOT NULL,
  code                         text NOT NULL,
  name                         text NOT NULL,
  service_mode                 text NOT NULL DEFAULT 'in_person' CHECK (service_mode IN ('in_person', 'virtual', 'both')),
  default_duration_min         smallint NOT NULL DEFAULT 15 CHECK (default_duration_min BETWEEN 1 AND 480),
  consultation_service_item_id uuid,
  is_public                    boolean NOT NULL DEFAULT true,
  status                       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at                   timestamptz NOT NULL DEFAULT now(),
  created_by                   uuid,
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  updated_by                   uuid,
  version                      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, department_id) REFERENCES platform.department (tenant_id, id)
);
CREATE INDEX ON catalog.healthcare_service (tenant_id, department_id);
CREATE INDEX ON catalog.healthcare_service (tenant_id, consultation_service_item_id);
SELECT platform.setup_tenant_table('catalog.healthcare_service', 'mod_catalog');

-- Billing class of a bed (General, Semi-Private, Private, ICU…); rank orders upgrades/downgrades.
CREATE TABLE catalog.bed_category (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id  uuid NOT NULL REFERENCES platform.tenant (id),
  code       text NOT NULL,
  name       text NOT NULL,
  rank       smallint NOT NULL CHECK (rank >= 0),
  is_icu     boolean NOT NULL DEFAULT false,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  version    integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);
SELECT platform.setup_tenant_table('catalog.bed_category', 'mod_catalog');

ALTER TABLE platform.location
  ADD FOREIGN KEY (tenant_id, bed_category_id) REFERENCES catalog.bed_category (tenant_id, id);

-- migrate:down
ALTER TABLE platform.location DROP CONSTRAINT location_tenant_id_bed_category_id_fkey;
DROP TABLE catalog.bed_category;
DROP TABLE catalog.healthcare_service;
DROP TABLE catalog.practitioner_affiliation;
DROP TABLE catalog.practitioner_profile;
ALTER TABLE platform.department DROP CONSTRAINT department_specialty_id_fkey;
DROP INDEX platform.department_specialty_id_idx;
DROP TABLE catalog.concept_map;
DROP TABLE catalog.terminology_concept;
DROP TABLE catalog.specialty;
