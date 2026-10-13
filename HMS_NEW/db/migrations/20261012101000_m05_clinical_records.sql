-- migrate:up
-- The rest of M05 (ERD m05-clinical): triage, medico-legal cases, immunizations, care plans, referrals,
-- birth and death records. Every row hangs off an encounter of the same patient (composite FK through
-- encounter (tenant_id, id, patient_id)), so a record can't be filed against someone else's visit.

-- ---------------------------------------------------------------------------
-- triage_assessment: emergency triage, repeatable (re-triage)
-- ---------------------------------------------------------------------------
CREATE TABLE clinical.triage_assessment (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  encounter_id     uuid NOT NULL,
  patient_id       uuid NOT NULL,
  triage_scale     text NOT NULL CHECK (triage_scale IN ('india_colour', 'esi', 'mts')),
  category         text NOT NULL CHECK (category IN ('red', 'yellow', 'green', 'black', '1', '2', '3', '4', '5')),
  arrival_mode     text CHECK (arrival_mode IN ('walk_in', 'ambulance_108', 'private_ambulance', 'police', 'referred')),
  chief_complaint  text,
  assessed_by      uuid NOT NULL,
  assessed_at      timestamptz NOT NULL DEFAULT now(),
  reassess_due_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, assessed_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((triage_scale = 'india_colour') = (category IN ('red', 'yellow', 'green', 'black'))),
  CHECK (reassess_due_at IS NULL OR reassess_due_at > assessed_at)
);
CREATE INDEX ON clinical.triage_assessment (tenant_id, encounter_id, patient_id);
CREATE INDEX ON clinical.triage_assessment (tenant_id, patient_id);
CREATE INDEX ON clinical.triage_assessment (tenant_id, assessed_by);
SELECT platform.setup_tenant_table('clinical.triage_assessment', 'mod_clinical');

-- ---------------------------------------------------------------------------
-- mlc_record: medico-legal case, 1:1 with the encounter. Police fields are all optional: treatment
-- never waits on them. Read needs the sensitive `mlc.read` permission.
-- ---------------------------------------------------------------------------
CREATE TABLE clinical.mlc_record (
  id                            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                     uuid NOT NULL REFERENCES platform.tenant (id),
  encounter_id                  uuid NOT NULL,
  patient_id                    uuid NOT NULL,
  facility_id                   uuid NOT NULL,
  mlc_no                        text NOT NULL,
  mlc_type                      text NOT NULL CHECK (mlc_type IN ('road_traffic', 'assault', 'burns', 'poisoning', 'fall', 'sexual_assault',
                                                                  'animal_bite', 'industrial', 'suspected_suicide', 'brought_dead', 'other')),
  incident_at                   timestamptz,
  incident_place                text,
  brought_by_name               text,
  brought_by_relation           text,
  brought_by_phone              text CHECK (brought_by_phone ~ '^\+[1-9][0-9]{7,14}$'),
  police_station                text,
  police_intimated_at           timestamptz,
  intimation_mode               text CHECK (intimation_mode IN ('phone', 'in_person', 'written', 'email')),
  intimation_ref                text,
  officer_name                  text,
  officer_badge_no              text,
  injury_details                jsonb NOT NULL DEFAULT '[]',
  wound_certificate_document_id uuid,
  evidence_handover             jsonb NOT NULL DEFAULT '[]',
  is_pocso                      boolean NOT NULL DEFAULT false,
  recorded_by                   uuid NOT NULL,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  created_by                    uuid,
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  updated_by                    uuid,
  version                       integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, encounter_id),
  UNIQUE (tenant_id, facility_id, mlc_no),
  FOREIGN KEY (tenant_id, encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (jsonb_typeof(injury_details) = 'array' AND jsonb_typeof(evidence_handover) = 'array')
);
CREATE INDEX ON clinical.mlc_record (tenant_id, encounter_id, patient_id);
CREATE INDEX ON clinical.mlc_record (tenant_id, patient_id);
CREATE INDEX ON clinical.mlc_record (tenant_id, recorded_by);
SELECT platform.setup_tenant_table('clinical.mlc_record', 'mod_clinical');

-- ---------------------------------------------------------------------------
-- immunization (item_batch_id gets its FK with M10 inventory)
-- ---------------------------------------------------------------------------
CREATE TABLE clinical.immunization (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  patient_id         uuid NOT NULL,
  encounter_id       uuid,
  vaccine            text NOT NULL CHECK (btrim(vaccine) <> ''),
  vaccine_concept_id uuid REFERENCES catalog.terminology_concept (id),
  item_batch_id      uuid,
  lot_number         text,
  dose_number        smallint CHECK (dose_number BETWEEN 1 AND 20),
  administered_at    timestamptz NOT NULL,
  route              text CHECK (route IN ('intramuscular', 'subcutaneous', 'intradermal', 'oral', 'intranasal')),
  site               text,
  administered_by    uuid NOT NULL,
  status             text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'not_done', 'entered_in_error')),
  not_done_reason    text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, administered_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((status = 'not_done') = (not_done_reason IS NOT NULL))
);
CREATE INDEX ON clinical.immunization (tenant_id, patient_id);
CREATE INDEX ON clinical.immunization (tenant_id, encounter_id, patient_id);
CREATE INDEX ON clinical.immunization (vaccine_concept_id);
CREATE INDEX ON clinical.immunization (tenant_id, item_batch_id);
CREATE INDEX ON clinical.immunization (tenant_id, administered_by);
SELECT platform.setup_tenant_table('clinical.immunization', 'mod_clinical');

-- ---------------------------------------------------------------------------
-- care_plan / care_plan_activity (activities become operations.work_task rows with M15)
-- ---------------------------------------------------------------------------
CREATE TABLE clinical.care_plan (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  patient_id   uuid NOT NULL,
  encounter_id uuid,
  title        text NOT NULL CHECK (btrim(title) <> ''),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'revoked')),
  period_start date NOT NULL DEFAULT current_date,
  period_end   date,
  authored_by  uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, authored_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (period_end IS NULL OR period_end >= period_start)
);
CREATE INDEX ON clinical.care_plan (tenant_id, patient_id);
CREATE INDEX ON clinical.care_plan (tenant_id, encounter_id, patient_id);
CREATE INDEX ON clinical.care_plan (tenant_id, authored_by);
SELECT platform.setup_tenant_table('clinical.care_plan', 'mod_clinical');

CREATE TABLE clinical.care_plan_activity (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  care_plan_id uuid NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('medication', 'observation', 'procedure', 'education', 'diet', 'follow_up', 'other')),
  description  text NOT NULL CHECK (btrim(description) <> ''),
  frequency    text,
  status       text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, care_plan_id) REFERENCES clinical.care_plan (tenant_id, id)
);
CREATE INDEX ON clinical.care_plan_activity (tenant_id, care_plan_id);
SELECT platform.setup_tenant_table('clinical.care_plan_activity', 'mod_clinical');

-- ---------------------------------------------------------------------------
-- referral: internal (to a department / doctor) or outbound/inbound (another organisation)
-- ---------------------------------------------------------------------------
CREATE TABLE clinical.referral (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  encounter_id     uuid NOT NULL,
  patient_id       uuid NOT NULL,
  direction        text NOT NULL CHECK (direction IN ('internal', 'outbound', 'inbound')),
  reason           text NOT NULL CHECK (btrim(reason) <> ''),
  urgency          text NOT NULL DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'emergency')),
  status           text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'rejected', 'completed', 'cancelled')),
  to_facility_id   uuid,
  to_department_id uuid,
  to_staff_id      uuid,
  external_org     text,
  external_doctor  text,
  referred_by      uuid NOT NULL,
  responded_by     uuid,
  responded_at     timestamptz,
  response_note    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, to_facility_id, to_department_id) REFERENCES platform.department (tenant_id, facility_id, id),
  FOREIGN KEY (tenant_id, to_staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, referred_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, responded_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (direction <> 'internal' OR to_department_id IS NOT NULL OR to_staff_id IS NOT NULL),
  CHECK (direction = 'internal' OR external_org IS NOT NULL),
  CHECK ((status IN ('accepted', 'rejected')) <= (responded_at IS NOT NULL))
);
CREATE INDEX ON clinical.referral (tenant_id, encounter_id, patient_id);
CREATE INDEX ON clinical.referral (tenant_id, patient_id);
CREATE INDEX ON clinical.referral (tenant_id, to_facility_id, to_department_id);
CREATE INDEX ON clinical.referral (tenant_id, to_staff_id);
CREATE INDEX ON clinical.referral (tenant_id, referred_by);
CREATE INDEX ON clinical.referral (tenant_id, responded_by);
SELECT platform.setup_tenant_table('clinical.referral', 'mod_clinical');

-- ---------------------------------------------------------------------------
-- birth_record: on the mother's encounter; the newborn is registered as their own patient
-- ---------------------------------------------------------------------------
CREATE TABLE clinical.birth_record (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id              uuid NOT NULL REFERENCES platform.tenant (id),
  encounter_id           uuid NOT NULL,
  mother_patient_id      uuid NOT NULL,
  baby_patient_id        uuid,
  born_at                timestamptz NOT NULL,
  sex                    text NOT NULL CHECK (sex IN ('male', 'female', 'other', 'unknown')),
  birth_weight_g         integer CHECK (birth_weight_g BETWEEN 200 AND 7000),
  gestation_weeks        smallint CHECK (gestation_weeks BETWEEN 20 AND 45),
  delivery_method        text NOT NULL CHECK (delivery_method IN ('normal_vaginal', 'assisted_vaginal', 'lscs', 'other')),
  birth_order            smallint NOT NULL DEFAULT 1 CHECK (birth_order BETWEEN 1 AND 9),
  apgar_1                smallint CHECK (apgar_1 BETWEEN 0 AND 10),
  apgar_5                smallint CHECK (apgar_5 BETWEEN 0 AND 10),
  is_live_birth          boolean NOT NULL,
  attended_by            uuid NOT NULL,
  civil_registration_ref text,
  reported_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             uuid,
  version                integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, encounter_id, birth_order),
  FOREIGN KEY (tenant_id, encounter_id, mother_patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, mother_patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, baby_patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, attended_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (baby_patient_id IS NULL OR baby_patient_id <> mother_patient_id)
);
CREATE INDEX ON clinical.birth_record (tenant_id, encounter_id, mother_patient_id);
CREATE INDEX ON clinical.birth_record (tenant_id, mother_patient_id);
CREATE INDEX ON clinical.birth_record (tenant_id, baby_patient_id);
CREATE INDEX ON clinical.birth_record (tenant_id, attended_by);
SELECT platform.setup_tenant_table('clinical.birth_record', 'mod_clinical');

-- ---------------------------------------------------------------------------
-- death_record: 1:1 with the encounter. Recording it marks the patient deceased (trigger below).
-- ---------------------------------------------------------------------------
CREATE TABLE clinical.death_record (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id               uuid NOT NULL REFERENCES platform.tenant (id),
  encounter_id            uuid NOT NULL,
  patient_id              uuid NOT NULL,
  died_at                 timestamptz NOT NULL,
  pronounced_by           uuid NOT NULL,
  cause_chain             jsonb NOT NULL,
  contributing_conditions jsonb NOT NULL DEFAULT '[]',
  manner                  text NOT NULL CHECK (manner IN ('natural', 'accident', 'suicide', 'homicide', 'pending_investigation', 'undetermined')),
  mccd_form               text CHECK (mccd_form IN ('form_4', 'form_4a')),
  mccd_issued_at          timestamptz,
  certified_by            uuid,
  is_mlc                  boolean NOT NULL DEFAULT false,
  post_mortem_required    boolean NOT NULL DEFAULT false,
  body_released_to        text,
  body_released_at        timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid,
  version                 integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, encounter_id),
  UNIQUE (tenant_id, patient_id),
  FOREIGN KEY (tenant_id, encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, pronounced_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, certified_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (jsonb_typeof(cause_chain) = 'array' AND jsonb_array_length(cause_chain) BETWEEN 1 AND 4),
  CHECK (jsonb_typeof(contributing_conditions) = 'array'),
  CHECK ((mccd_issued_at IS NULL) = (mccd_form IS NULL)),
  CHECK (mccd_issued_at IS NULL OR certified_by IS NOT NULL),
  CHECK ((body_released_at IS NULL) = (body_released_to IS NULL))
);
CREATE INDEX ON clinical.death_record (tenant_id, encounter_id, patient_id);
CREATE INDEX ON clinical.death_record (tenant_id, pronounced_by);
CREATE INDEX ON clinical.death_record (tenant_id, certified_by);
SELECT platform.setup_tenant_table('clinical.death_record', 'mod_clinical');

-- The patient row belongs to M02; the death record is the only source of deceased_at, so a narrowly
-- scoped definer function sets it in the same transaction.
CREATE FUNCTION clinical.mark_patient_deceased() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, patient AS $$
BEGIN
  UPDATE patient.patient SET deceased_at = NEW.died_at WHERE tenant_id = NEW.tenant_id AND id = NEW.patient_id;
  RETURN NEW;
END $$;
CREATE TRIGGER mark_patient_deceased AFTER INSERT OR UPDATE OF died_at ON clinical.death_record
  FOR EACH ROW EXECUTE FUNCTION clinical.mark_patient_deceased();

-- A doctor who accepts a referral needs to read the patient's chart: a 30-day consulting care
-- assignment (platform-owned) is created by this narrowly scoped definer function.
CREATE FUNCTION clinical.grant_referral_care(p_tenant_id uuid, p_staff_id uuid, p_patient_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, platform AS $$
  INSERT INTO platform.care_assignment (tenant_id, staff_id, patient_id, reason, valid_from, valid_to, created_by)
  SELECT p_tenant_id, p_staff_id, p_patient_id, 'consulting', now(), now() + interval '30 days', p_staff_id
  WHERE p_tenant_id = platform.current_tenant_id();
$$;
REVOKE EXECUTE ON FUNCTION clinical.grant_referral_care(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clinical.grant_referral_care(uuid, uuid, uuid) TO mod_clinical;
REVOKE EXECUTE ON FUNCTION clinical.mark_patient_deceased() FROM PUBLIC;

-- Care access follows merges: a relationship with a record merged into this one (or with the record this
-- one was merged into) counts, because both are the same person's history now.
CREATE OR REPLACE FUNCTION clinical.has_care_access(p_staff_id uuid, p_patient_id uuid, p_at timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE up AS (
    SELECT id, merged_into_patient_id, 0 AS depth FROM patient.patient WHERE id = p_patient_id
    UNION ALL
    SELECT p.id, p.merged_into_patient_id, u.depth + 1 FROM patient.patient p JOIN up u ON p.id = u.merged_into_patient_id WHERE u.depth < 10
  ), family AS (
    SELECT id FROM up WHERE merged_into_patient_id IS NULL
    UNION
    SELECT p.id FROM patient.patient p JOIN family f ON p.merged_into_patient_id = f.id
  )
  SELECT EXISTS (
           SELECT 1 FROM clinical.encounter_participant ep
           JOIN clinical.encounter e ON e.id = ep.encounter_id
           WHERE ep.staff_id = p_staff_id AND e.patient_id IN (SELECT id FROM family)
             AND e.status NOT IN ('cancelled', 'entered_in_error')
             AND (e.ended_at IS NULL OR e.ended_at > p_at - interval '30 days'))
      OR EXISTS (
           SELECT 1 FROM platform.care_assignment ca
           LEFT JOIN clinical.encounter e ON e.id = ca.encounter_id
           WHERE ca.staff_id = p_staff_id AND coalesce(ca.patient_id, e.patient_id) IN (SELECT id FROM family)
             AND ca.valid_from <= p_at AND (ca.valid_to IS NULL OR ca.valid_to > p_at))
      OR EXISTS (
           SELECT 1 FROM platform.emergency_access_grant g
           WHERE g.staff_id = p_staff_id AND g.patient_id IN (SELECT id FROM family)
             AND g.granted_at <= p_at AND g.expires_at > p_at)
$$;

-- migrate:down
DROP FUNCTION clinical.grant_referral_care(uuid, uuid, uuid);
DROP TABLE clinical.death_record;
DROP FUNCTION clinical.mark_patient_deceased();
DROP TABLE clinical.birth_record;
DROP TABLE clinical.referral;
DROP TABLE clinical.care_plan_activity;
DROP TABLE clinical.care_plan;
DROP TABLE clinical.immunization;
DROP TABLE clinical.mlc_record;
DROP TABLE clinical.triage_assessment;
