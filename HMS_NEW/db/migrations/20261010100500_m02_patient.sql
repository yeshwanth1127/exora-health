-- migrate:up

-- ---------------------------------------------------------------------------
-- patient: the single longitudinal identity. Created only by registration commands; merges link
-- (status 'merged' + merged_into_patient_id), never delete.
-- ---------------------------------------------------------------------------
CREATE TABLE patient.patient (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id              uuid NOT NULL REFERENCES platform.tenant (id),
  mrn                    text NOT NULL,          -- from platform.next_number('mrn'); one per tenant, shared by branches
  registered_facility_id uuid,
  title                  text,
  given_name             text NOT NULL CHECK (btrim(given_name) <> ''),
  middle_name            text,
  family_name            text,
  search_name            text GENERATED ALWAYS AS (
                           lower(given_name || coalesce(' ' || middle_name, '') || coalesce(' ' || family_name, ''))
                         ) STORED,
  birth_date             date,
  birth_date_estimated   boolean NOT NULL DEFAULT false,
  sex                    text NOT NULL CHECK (sex IN ('male', 'female', 'other', 'unknown')),
  preferred_language     text,
  blood_group            text CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  marital_status         text CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed', 'separated', 'unknown')),
  occupation             text,
  is_temporary           boolean NOT NULL DEFAULT false,   -- unidentified emergency patient
  verification_status    text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified')),
  registration_source    text NOT NULL CHECK (registration_source IN ('front_desk', 'portal', 'whatsapp', 'voice',
                                                                      'abha_scan', 'emergency', 'migration')),
  nka_confirmed_at       timestamptz,            -- "no known allergies" was explicitly confirmed
  deceased_at            timestamptz,
  status                 text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'merged', 'inactive')),
  merged_into_patient_id uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             uuid,
  version                integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, mrn),
  FOREIGN KEY (tenant_id, registered_facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, merged_into_patient_id) REFERENCES patient.patient (tenant_id, id),
  CHECK ((status = 'merged') = (merged_into_patient_id IS NOT NULL)),
  CHECK (merged_into_patient_id <> id)
);
CREATE INDEX ON patient.patient (tenant_id, registered_facility_id);
CREATE INDEX ON patient.patient (tenant_id, merged_into_patient_id);
CREATE INDEX ON patient.patient (tenant_id, birth_date);
CREATE INDEX patient_search_name_trgm ON patient.patient USING gin (search_name gin_trgm_ops);
SELECT platform.setup_tenant_table('patient.patient', 'mod_patient');

-- ---------------------------------------------------------------------------
-- Identifiers: ABHA, PAN, passport, insurer/scheme member numbers… (Aadhaar is deliberately not stored)
-- ---------------------------------------------------------------------------
CREATE TABLE patient.patient_identifier (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  patient_id   uuid NOT NULL,
  system       text NOT NULL CHECK (system IN ('abha_number', 'abha_address', 'pan', 'passport', 'voter_id',
                                               'driving_licence', 'insurer_member_no', 'scheme_id', 'other')),
  value        text NOT NULL CHECK (btrim(value) <> ''),
  issuer       text,                                 -- e.g. insurer or scheme name
  verified_at  timestamptz,
  verified_via text CHECK (verified_via IN ('abdm_otp', 'abdm_face', 'document', 'staff')),
  is_primary   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, system, value),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  CHECK ((verified_at IS NULL) = (verified_via IS NULL)),
  -- ABHA number stored as 14 digits without hyphens
  CHECK (system <> 'abha_number' OR value ~ '^[0-9]{14}$'),
  CHECK (system <> 'abha_address' OR value ~ '^[A-Za-z0-9._]{3,}@[a-z]+$'),
  CHECK (system <> 'pan' OR value ~ '^[A-Z]{5}[0-9]{4}[A-Z]$')
);
CREATE INDEX ON patient.patient_identifier (tenant_id, patient_id);
SELECT platform.setup_tenant_table('patient.patient_identifier', 'mod_patient');

CREATE TABLE patient.patient_address (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id  uuid NOT NULL REFERENCES platform.tenant (id),
  patient_id uuid NOT NULL,
  kind       text NOT NULL DEFAULT 'home' CHECK (kind IN ('home', 'work', 'temporary')),
  line1      text,
  line2      text,
  city       text,
  district   text,
  state_code char(2) CHECK (state_code ~ '^[0-9]{2}$'),
  pincode    text CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  is_primary boolean NOT NULL DEFAULT false,
  valid_to   date,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  version    integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id)
);
CREATE INDEX ON patient.patient_address (tenant_id, patient_id);
CREATE UNIQUE INDEX patient_address_one_primary ON patient.patient_address (tenant_id, patient_id)
  WHERE is_primary AND valid_to IS NULL;
SELECT platform.setup_tenant_table('patient.patient_address', 'mod_patient');

-- Phone/email (messaging consent lives in the comms module, not here)
CREATE TABLE patient.patient_contact (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL REFERENCES platform.tenant (id),
  patient_id  uuid NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('phone', 'email')),
  value       text NOT NULL,
  is_primary  boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  valid_to    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  version     integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  CHECK (kind <> 'phone' OR value ~ '^\+[1-9][0-9]{7,14}$'),            -- E.164, e.g. +919876543210
  CHECK (kind <> 'email' OR value ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
CREATE INDEX ON patient.patient_contact (tenant_id, patient_id);
CREATE INDEX ON patient.patient_contact (tenant_id, value);                 -- find patients by phone
CREATE UNIQUE INDEX patient_contact_one_primary ON patient.patient_contact (tenant_id, patient_id, kind)
  WHERE is_primary AND valid_to IS NULL;
SELECT platform.setup_tenant_table('patient.patient_contact', 'mod_patient');

-- Relatives, guardians (required for minors' consents), emergency contacts, legal representatives
CREATE TABLE patient.related_person (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id               uuid NOT NULL REFERENCES platform.tenant (id),
  patient_id              uuid NOT NULL,
  name                    text NOT NULL,
  relationship            text NOT NULL CHECK (relationship IN ('spouse', 'parent', 'child', 'sibling', 'grandparent',
                                                                'grandchild', 'guardian', 'relative', 'friend', 'other')),
  phone                   text CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  is_guardian             boolean NOT NULL DEFAULT false,
  is_emergency_contact    boolean NOT NULL DEFAULT false,
  is_legal_representative boolean NOT NULL DEFAULT false,
  representative_scope    text,
  related_patient_id      uuid,                 -- when the relative is also a registered patient
  valid_to                date,
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid,
  version                 integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, patient_id, id),           -- target for "a related person of this same patient"
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, related_patient_id) REFERENCES patient.patient (tenant_id, id),
  CHECK (related_patient_id <> patient_id)
);
CREATE INDEX ON patient.related_person (tenant_id, related_patient_id);
SELECT platform.setup_tenant_table('patient.related_person', 'mod_patient');

-- Clinical consents. A consent signed by someone else must name a related person of the same patient.
-- encounter_id / procedure_request_id / document_id get FKs when their modules exist.
CREATE TABLE patient.patient_consent (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  patient_id           uuid NOT NULL,
  consent_type         text NOT NULL CHECK (consent_type IN ('treatment', 'admission', 'procedure', 'anaesthesia',
                                                             'blood_transfusion', 'high_risk', 'teleconsult',
                                                             'data_sharing_abdm', 'research', 'lama_dama')),
  status               text NOT NULL CHECK (status IN ('signed', 'refused', 'withdrawn', 'expired')),
  signed_by            text NOT NULL CHECK (signed_by IN ('patient', 'guardian', 'representative')),
  related_person_id    uuid,
  witness_staff_id     uuid,
  signed_at            timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz,
  withdrawn_at         timestamptz,
  encounter_id         uuid,
  procedure_request_id uuid,
  document_id          uuid,
  language             text,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  version              integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id, related_person_id) REFERENCES patient.related_person (tenant_id, patient_id, id),
  FOREIGN KEY (tenant_id, witness_staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK (signed_by = 'patient' OR related_person_id IS NOT NULL),
  CHECK ((status = 'withdrawn') = (withdrawn_at IS NOT NULL)),
  CHECK (expires_at IS NULL OR expires_at > signed_at)
);
CREATE INDEX ON patient.patient_consent (tenant_id, patient_id, related_person_id);
CREATE INDEX ON patient.patient_consent (tenant_id, witness_staff_id);
CREATE INDEX ON patient.patient_consent (tenant_id, encounter_id);
CREATE INDEX ON patient.patient_consent (tenant_id, procedure_request_id);
SELECT platform.setup_tenant_table('patient.patient_consent', 'mod_patient');

CREATE TABLE patient.patient_flag (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL REFERENCES platform.tenant (id),
  patient_id  uuid NOT NULL,
  flag_type   text NOT NULL CHECK (flag_type IN ('isolation', 'fall_risk', 'allergy_alert', 'safeguarding', 'vip',
                                                 'confidential', 'mlc', 'do_not_resuscitate')),
  active_from timestamptz NOT NULL DEFAULT now(),
  active_to   timestamptz,
  set_by      uuid NOT NULL,
  cleared_by  uuid,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  version     integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, set_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, cleared_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (active_to IS NULL OR active_to > active_from),
  CHECK ((cleared_by IS NULL) OR (active_to IS NOT NULL))
);
CREATE INDEX ON patient.patient_flag (tenant_id, patient_id);
CREATE INDEX ON patient.patient_flag (tenant_id, set_by);
CREATE INDEX ON patient.patient_flag (tenant_id, cleared_by);
SELECT platform.setup_tenant_table('patient.patient_flag', 'mod_patient');

-- Duplicate handling history. A merge needs two different people (maker-checker).
CREATE TABLE patient.patient_link (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid NOT NULL REFERENCES platform.tenant (id),
  survivor_patient_id uuid NOT NULL,
  other_patient_id    uuid NOT NULL,
  link_type           text NOT NULL CHECK (link_type IN ('possible_duplicate', 'merged', 'unmerged', 'not_duplicate')),
  decided_by          uuid,
  second_reviewer_id  uuid,
  reason              text,
  decided_at          timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid,
  version             integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, survivor_patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, other_patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, decided_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, second_reviewer_id) REFERENCES platform.staff (tenant_id, id),
  CHECK (survivor_patient_id <> other_patient_id),
  CHECK (link_type NOT IN ('merged', 'unmerged')
         OR (decided_by IS NOT NULL AND second_reviewer_id IS NOT NULL AND decided_by <> second_reviewer_id))
);
CREATE INDEX ON patient.patient_link (tenant_id, survivor_patient_id);
CREATE INDEX ON patient.patient_link (tenant_id, other_patient_id);
CREATE INDEX ON patient.patient_link (tenant_id, decided_by);
CREATE INDEX ON patient.patient_link (tenant_id, second_reviewer_id);
SELECT platform.setup_tenant_table('patient.patient_link', 'mod_patient');

-- ---------------------------------------------------------------------------
-- Foreign keys from M01 tables that were waiting for patient.patient
-- ---------------------------------------------------------------------------
ALTER TABLE platform.user_account
  ADD FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id);
ALTER TABLE platform.care_assignment
  ADD FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id);
ALTER TABLE platform.emergency_access_grant
  ADD FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id);

-- migrate:down
ALTER TABLE platform.emergency_access_grant DROP CONSTRAINT emergency_access_grant_tenant_id_patient_id_fkey;
ALTER TABLE platform.care_assignment DROP CONSTRAINT care_assignment_tenant_id_patient_id_fkey;
ALTER TABLE platform.user_account DROP CONSTRAINT user_account_tenant_id_patient_id_fkey;
DROP TABLE patient.patient_link;
DROP TABLE patient.patient_flag;
DROP TABLE patient.patient_consent;
DROP TABLE patient.related_person;
DROP TABLE patient.patient_contact;
DROP TABLE patient.patient_address;
DROP TABLE patient.patient_identifier;
DROP TABLE patient.patient;
