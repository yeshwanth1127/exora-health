-- migrate:up

-- ---------------------------------------------------------------------------
-- Module setup: schema `clinical`, write role mod_clinical
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mod_clinical') THEN
    CREATE ROLE mod_clinical NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT hms_reader TO mod_clinical;
GRANT mod_clinical TO hms_app WITH INHERIT FALSE, SET TRUE;

CREATE SCHEMA clinical;
GRANT USAGE ON SCHEMA clinical TO hms_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA clinical GRANT SELECT ON TABLES TO hms_reader;

GRANT INSERT ON platform.audit_event, platform.outbox_event, platform.inbox_record TO mod_clinical;
GRANT INSERT, UPDATE ON platform.number_series, platform.idempotency_record TO mod_clinical;

-- ---------------------------------------------------------------------------
-- encounter: every contact with a patient (OPD visit, emergency, virtual…). Opened from a booking
-- check-in (by the worker) or directly (unscheduled / emergency). Finishing it completes the visit.
-- ---------------------------------------------------------------------------
CREATE TABLE clinical.encounter (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  encounter_no         text NOT NULL,
  patient_id           uuid NOT NULL,
  facility_id          uuid NOT NULL,
  department_id        uuid,
  attending_staff_id   uuid NOT NULL,
  appointment_id       uuid,
  parent_encounter_id  uuid,
  encounter_class      text NOT NULL CHECK (encounter_class IN ('outpatient', 'emergency', 'inpatient', 'day_care', 'virtual')),
  status               text NOT NULL DEFAULT 'arrived'
                         CHECK (status IN ('planned', 'arrived', 'in_progress', 'finished', 'cancelled', 'entered_in_error')),
  arrived_at           timestamptz NOT NULL DEFAULT now(),
  started_at           timestamptz,
  ended_at             timestamptz,
  chief_complaint      text,
  referral_source      text CHECK (referral_source IN ('self', 'internal', 'external_doctor', 'camp', 'other')),
  disposition          text CHECK (disposition IN ('discharged_home', 'admitted', 'referred_out', 'lama', 'absconded', 'died', 'follow_up')),
  follow_up_advised_on date,
  cancel_reason        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  version              integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, patient_id),            -- lets child rows prove they belong to the same patient
  UNIQUE (tenant_id, encounter_no),
  UNIQUE (tenant_id, appointment_id),            -- one encounter per appointment
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id, department_id) REFERENCES platform.department (tenant_id, facility_id, id),
  FOREIGN KEY (tenant_id, attending_staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, appointment_id) REFERENCES booking.appointment (tenant_id, id),
  FOREIGN KEY (tenant_id, parent_encounter_id) REFERENCES clinical.encounter (tenant_id, id),
  CHECK (parent_encounter_id <> id),
  CHECK (status NOT IN ('in_progress', 'finished') OR started_at IS NOT NULL),
  CHECK ((status = 'finished') = (ended_at IS NOT NULL AND disposition IS NOT NULL)),
  CHECK ((status = 'cancelled') = (cancel_reason IS NOT NULL)),
  CHECK (started_at IS NULL OR started_at >= arrived_at),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX ON clinical.encounter (tenant_id, patient_id, arrived_at);
CREATE INDEX ON clinical.encounter (tenant_id, facility_id, status, arrived_at);
CREATE INDEX ON clinical.encounter (tenant_id, facility_id, department_id);
CREATE INDEX ON clinical.encounter (tenant_id, attending_staff_id, arrived_at);
CREATE INDEX ON clinical.encounter (tenant_id, parent_encounter_id);
SELECT platform.setup_tenant_table('clinical.encounter', 'mod_clinical');

CREATE FUNCTION clinical.encounter_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
       ('planned', 'arrived'), ('planned', 'cancelled'),
       ('arrived', 'in_progress'), ('arrived', 'cancelled'),
       ('in_progress', 'finished'),
       ('planned', 'entered_in_error'), ('arrived', 'entered_in_error'), ('in_progress', 'entered_in_error')) THEN
    RAISE EXCEPTION 'encounter cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER encounter_transition_guard BEFORE UPDATE OF status ON clinical.encounter
  FOR EACH ROW EXECUTE FUNCTION clinical.encounter_transition_guard();

CREATE TABLE clinical.encounter_status_history (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  encounter_id   uuid NOT NULL,
  from_status    text,
  to_status      text NOT NULL,
  actor_staff_id uuid,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id) REFERENCES clinical.encounter (tenant_id, id)
);
CREATE INDEX ON clinical.encounter_status_history (tenant_id, encounter_id, occurred_at);
SELECT platform.apply_tenant_rls('clinical.encounter_status_history');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON clinical.encounter_status_history
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON clinical.encounter_status_history TO mod_clinical;

CREATE FUNCTION clinical.encounter_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO clinical.encounter_status_history (tenant_id, encounter_id, from_status, to_status, actor_staff_id)
    VALUES (NEW.tenant_id, NEW.id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, NEW.status,
            nullif(current_setting('app.actor_staff_id', true), '')::uuid);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER encounter_history AFTER INSERT OR UPDATE OF status ON clinical.encounter
  FOR EACH ROW EXECUTE FUNCTION clinical.encounter_history();

-- Who took part in the encounter; participation is what grants access to the patient's chart.
CREATE TABLE clinical.encounter_participant (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  encounter_id uuid NOT NULL,
  staff_id     uuid NOT NULL,
  role         text NOT NULL CHECK (role IN ('attending', 'consulting', 'resident', 'nurse', 'referrer', 'other')),
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id) REFERENCES clinical.encounter (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK (period_end IS NULL OR period_end > period_start)
);
CREATE UNIQUE INDEX encounter_participant_active ON clinical.encounter_participant (tenant_id, encounter_id, staff_id, role) WHERE period_end IS NULL;
CREATE INDEX ON clinical.encounter_participant (tenant_id, staff_id);
SELECT platform.setup_tenant_table('clinical.encounter_participant', 'mod_clinical');

ALTER TABLE platform.care_assignment
  ADD FOREIGN KEY (tenant_id, encounter_id) REFERENCES clinical.encounter (tenant_id, id);

-- ---------------------------------------------------------------------------
-- observation: vital signs, scores and measurements, one row per value. Recorded values are never
-- edited: a correction marks the old row 'amended' (or 'entered_in_error') and points a new one at it.
-- ---------------------------------------------------------------------------
CREATE TABLE clinical.observation (
  id                        uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                 uuid NOT NULL REFERENCES platform.tenant (id),
  patient_id                uuid NOT NULL,
  encounter_id              uuid NOT NULL,
  observation_definition_id uuid,
  code                      text NOT NULL,          -- definition code, e.g. BP_SYS
  display                   text NOT NULL,
  category                  text NOT NULL CHECK (category IN ('vital_sign', 'score', 'measurement', 'nursing_assessment')),
  value_num                 numeric,
  value_text                text,
  unit                      text,
  group_id                  uuid NOT NULL,          -- one capture (all vitals taken together)
  effective_at              timestamptz NOT NULL,   -- when measured
  recorded_by               uuid NOT NULL,
  is_abnormal               boolean,
  status                    text NOT NULL DEFAULT 'final' CHECK (status IN ('final', 'amended', 'entered_in_error')),
  status_reason             text,
  supersedes_id             uuid,
  created_at                timestamptz NOT NULL DEFAULT now(),
  created_by                uuid,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                uuid,
  version                   integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, supersedes_id),
  FOREIGN KEY (tenant_id, encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, observation_definition_id) REFERENCES catalog.observation_definition (tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, supersedes_id) REFERENCES clinical.observation (tenant_id, id),
  CHECK (num_nonnulls(value_num, value_text) >= 1),
  CHECK (status = 'final' OR status_reason IS NOT NULL)
);
CREATE INDEX ON clinical.observation (tenant_id, patient_id, code, effective_at);
CREATE INDEX ON clinical.observation (tenant_id, encounter_id, patient_id);
CREATE INDEX ON clinical.observation (tenant_id, observation_definition_id);
CREATE INDEX ON clinical.observation (tenant_id, recorded_by);
SELECT platform.setup_tenant_table('clinical.observation', 'mod_clinical');

-- Only the status may change, and only away from 'final'.
CREATE FUNCTION clinical.observation_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['status', 'status_reason', 'updated_at', 'updated_by', 'version'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'status_reason', 'updated_at', 'updated_by', 'version']) THEN
    RAISE EXCEPTION 'recorded observations cannot be edited; record a correction instead' USING ERRCODE = '55000';
  END IF;
  IF OLD.status <> 'final' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'observation is already %', OLD.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER observation_guard BEFORE UPDATE ON clinical.observation
  FOR EACH ROW EXECUTE FUNCTION clinical.observation_guard();

-- ---------------------------------------------------------------------------
-- Clinical notes: a note has versions; versions are never edited. Drafts may be saved many times;
-- after signing, a new version is an amendment and needs a reason.
-- ---------------------------------------------------------------------------
CREATE TABLE clinical.form_template (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id  uuid REFERENCES platform.tenant (id),     -- NULL = system template for every tenant
  code       text NOT NULL CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  template_version integer NOT NULL CHECK (template_version > 0),
  name       text NOT NULL,
  note_type  text NOT NULL,
  schema     jsonb NOT NULL,                         -- JSON Schema of `data`
  status     text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (tenant_id, id),
  UNIQUE NULLS NOT DISTINCT (tenant_id, code, template_version)
);
ALTER TABLE clinical.form_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.form_template FORCE ROW LEVEL SECURITY;
CREATE POLICY system_or_own ON clinical.form_template
  USING (tenant_id IS NULL OR tenant_id = (SELECT platform.current_tenant_id()))
  WITH CHECK (tenant_id = (SELECT platform.current_tenant_id()));
GRANT INSERT, UPDATE (status) ON clinical.form_template TO mod_clinical;

CREATE TABLE clinical.clinical_note (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenant (id),
  encounter_id    uuid NOT NULL,
  patient_id      uuid NOT NULL,
  note_type       text NOT NULL CHECK (note_type IN ('consultation', 'history', 'examination', 'progress', 'nursing',
                                                     'procedure', 'discharge_summary', 'referral_letter')),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed', 'amended', 'entered_in_error')),
  author_staff_id uuid NOT NULL,
  current_version integer NOT NULL DEFAULT 0 CHECK (current_version >= 0),
  signed_at       timestamptz,
  signed_by       uuid,
  status_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, author_staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, signed_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((status IN ('signed', 'amended')) <= (signed_at IS NOT NULL AND signed_by IS NOT NULL)),
  CHECK (status <> 'entered_in_error' OR status_reason IS NOT NULL)
);
CREATE INDEX ON clinical.clinical_note (tenant_id, encounter_id, patient_id);
CREATE INDEX ON clinical.clinical_note (tenant_id, patient_id, created_at);
CREATE INDEX ON clinical.clinical_note (tenant_id, author_staff_id);
CREATE INDEX ON clinical.clinical_note (tenant_id, signed_by);
SELECT platform.setup_tenant_table('clinical.clinical_note', 'mod_clinical');

CREATE TABLE clinical.clinical_note_version (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  note_id          uuid NOT NULL,
  version_no       integer NOT NULL CHECK (version_no > 0),
  form_template_id uuid REFERENCES clinical.form_template (id),
  data             jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(data) = 'object'),
  narrative        text,
  amendment_reason text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, note_id, version_no),
  FOREIGN KEY (tenant_id, note_id) REFERENCES clinical.clinical_note (tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON clinical.clinical_note_version (form_template_id);
CREATE INDEX ON clinical.clinical_note_version (tenant_id, created_by);
SELECT platform.apply_tenant_rls('clinical.clinical_note_version');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON clinical.clinical_note_version
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON clinical.clinical_note_version TO mod_clinical;

-- New versions of a signed note are amendments and need a reason; voided notes take no versions.
CREATE FUNCTION clinical.note_version_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  note_status text;
BEGIN
  SELECT n.status INTO note_status FROM clinical.clinical_note n WHERE n.tenant_id = NEW.tenant_id AND n.id = NEW.note_id;
  IF note_status = 'entered_in_error' THEN
    RAISE EXCEPTION 'note was marked entered in error' USING ERRCODE = '55000';
  END IF;
  IF note_status IN ('signed', 'amended') AND coalesce(btrim(NEW.amendment_reason), '') = '' THEN
    RAISE EXCEPTION 'changing a signed note is an amendment and needs a reason' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER note_version_guard BEFORE INSERT ON clinical.clinical_note_version
  FOR EACH ROW EXECUTE FUNCTION clinical.note_version_guard();

-- ---------------------------------------------------------------------------
-- Diagnoses: the patient's problem list (condition) and which conditions each encounter addressed.
-- ---------------------------------------------------------------------------
CREATE TABLE clinical.condition (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid NOT NULL REFERENCES platform.tenant (id),
  patient_id          uuid NOT NULL,
  code_system         text CHECK (code_system IN ('icd10_who', 'snomed_ct', 'local')),
  code                text,
  display             text NOT NULL CHECK (btrim(display) <> ''),
  concept_id          uuid REFERENCES catalog.terminology_concept (id),
  clinical_status     text NOT NULL DEFAULT 'active' CHECK (clinical_status IN ('active', 'recurrence', 'remission', 'resolved')),
  verification_status text NOT NULL DEFAULT 'provisional'
                        CHECK (verification_status IN ('provisional', 'differential', 'confirmed', 'refuted', 'entered_in_error')),
  is_chronic          boolean NOT NULL DEFAULT false,
  onset_on            date,
  abatement_on        date,
  recorded_by         uuid NOT NULL,
  source_encounter_id uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid,
  version             integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, source_encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  CHECK ((code IS NULL) = (code_system IS NULL)),
  CHECK (abatement_on IS NULL OR onset_on IS NULL OR abatement_on >= onset_on)
);
CREATE INDEX ON clinical.condition (tenant_id, patient_id, clinical_status);
CREATE INDEX ON clinical.condition (concept_id);
CREATE INDEX ON clinical.condition (tenant_id, recorded_by);
CREATE INDEX ON clinical.condition (tenant_id, source_encounter_id, patient_id);
SELECT platform.setup_tenant_table('clinical.condition', 'mod_clinical');

CREATE TABLE clinical.encounter_diagnosis (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  encounter_id uuid NOT NULL,
  patient_id   uuid NOT NULL,
  condition_id uuid NOT NULL,
  role         text NOT NULL CHECK (role IN ('admitting', 'provisional', 'primary', 'secondary', 'discharge')),
  rank         smallint NOT NULL DEFAULT 1 CHECK (rank > 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, encounter_id, condition_id, role),
  -- Both sides must belong to the same patient.
  FOREIGN KEY (tenant_id, encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, condition_id, patient_id) REFERENCES clinical.condition (tenant_id, id, patient_id)
);
CREATE UNIQUE INDEX encounter_diagnosis_one_primary ON clinical.encounter_diagnosis (tenant_id, encounter_id) WHERE role = 'primary';
CREATE INDEX ON clinical.encounter_diagnosis (tenant_id, condition_id, patient_id);
CREATE INDEX ON clinical.encounter_diagnosis (tenant_id, encounter_id, patient_id);
SELECT platform.setup_tenant_table('clinical.encounter_diagnosis', 'mod_clinical');

CREATE TABLE clinical.allergy_intolerance (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  patient_id           uuid NOT NULL,
  category             text NOT NULL CHECK (category IN ('drug', 'food', 'environment', 'other')),
  substance            text NOT NULL CHECK (btrim(substance) <> ''),
  substance_concept_id uuid REFERENCES catalog.terminology_concept (id),
  reaction             text,
  severity             text CHECK (severity IN ('mild', 'moderate', 'severe')),
  criticality          text CHECK (criticality IN ('low', 'high', 'unable_to_assess')),
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'refuted', 'entered_in_error')),
  recorded_by          uuid NOT NULL,
  recorded_at          timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  version              integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON clinical.allergy_intolerance (tenant_id, patient_id, status);
CREATE INDEX ON clinical.allergy_intolerance (substance_concept_id);
CREATE INDEX ON clinical.allergy_intolerance (tenant_id, recorded_by);
SELECT platform.setup_tenant_table('clinical.allergy_intolerance', 'mod_clinical');

-- ---------------------------------------------------------------------------
-- Chart access: a staff member may open a patient's chart only with a care relationship —
-- participation in one of the patient's encounters (open, or ended within 30 days), an active
-- care assignment, or an unexpired break-glass grant.
-- ---------------------------------------------------------------------------
CREATE FUNCTION clinical.has_care_access(p_staff_id uuid, p_patient_id uuid, p_at timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
           SELECT 1 FROM clinical.encounter_participant ep
           JOIN clinical.encounter e ON e.id = ep.encounter_id
           WHERE ep.staff_id = p_staff_id AND e.patient_id = p_patient_id
             AND e.status NOT IN ('cancelled', 'entered_in_error')
             AND (e.ended_at IS NULL OR e.ended_at > p_at - interval '30 days'))
      OR EXISTS (
           SELECT 1 FROM platform.care_assignment ca
           LEFT JOIN clinical.encounter e ON e.id = ca.encounter_id
           WHERE ca.staff_id = p_staff_id AND coalesce(ca.patient_id, e.patient_id) = p_patient_id
             AND ca.valid_from <= p_at AND (ca.valid_to IS NULL OR ca.valid_to > p_at))
      OR EXISTS (
           SELECT 1 FROM platform.emergency_access_grant g
           WHERE g.staff_id = p_staff_id AND g.patient_id = p_patient_id
             AND g.granted_at <= p_at AND g.expires_at > p_at)
$$;

-- migrate:down
DROP FUNCTION clinical.has_care_access(uuid, uuid, timestamptz);
ALTER TABLE platform.care_assignment DROP CONSTRAINT care_assignment_tenant_id_encounter_id_fkey;
DROP SCHEMA clinical CASCADE;
