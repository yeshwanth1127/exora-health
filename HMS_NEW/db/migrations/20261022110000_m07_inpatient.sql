-- migrate:up
-- M07 inpatient, clinic scope (ERD m07-inpatient, trimmed): admissions, bed status, bed occupancy,
-- transfers and discharge with clearances. Beds are platform.location rows (kind 'bed', under a ward);
-- this module owns their status and who occupies them. A bed has at most one occupant at a time and an
-- admission at most one primary bed (exclusion constraints). The admission's inpatient encounter is
-- opened by the clinical module from the admission.admitted event and points back here
-- (clinical.encounter.admission_id). Housekeeping is a simple dirty → ready step.

-- ---------------------------------------------------------------------------
-- Module setup: schema `inpatient`, write role mod_inpatient
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mod_inpatient') THEN
    CREATE ROLE mod_inpatient NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT hms_reader TO mod_inpatient;
GRANT mod_inpatient TO hms_app WITH INHERIT FALSE, SET TRUE;

CREATE SCHEMA inpatient;
GRANT USAGE ON SCHEMA inpatient TO hms_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA inpatient GRANT SELECT ON TABLES TO hms_reader;

GRANT INSERT ON platform.audit_event, platform.outbox_event, platform.inbox_record TO mod_inpatient;
GRANT INSERT, UPDATE ON platform.number_series, platform.idempotency_record TO mod_inpatient;

-- ---------------------------------------------------------------------------
-- admission: an inpatient or day-care stay. bed_pending = admitted while waiting for a bed.
-- ---------------------------------------------------------------------------
CREATE TABLE inpatient.admission (
  id                        uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                 uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id               uuid NOT NULL,
  ip_no                     text NOT NULL,
  patient_id                uuid NOT NULL,
  admission_type            text NOT NULL CHECK (admission_type IN ('elective', 'emergency', 'day_care', 'maternity', 'transfer_in')),
  admitting_staff_id        uuid NOT NULL,
  department_id             uuid,
  source_encounter_id       uuid,
  requested_bed_category_id uuid,
  admission_reason          text NOT NULL CHECK (length(admission_reason) BETWEEN 3 AND 1000),
  admitted_at               timestamptz NOT NULL DEFAULT now(),
  expected_discharge_on     date,
  status                    text NOT NULL DEFAULT 'admitted'
                              CHECK (status IN ('bed_pending', 'admitted', 'discharge_planned', 'discharged', 'cancelled')),
  discharged_at             timestamptz,
  cancelled_at              timestamptz,
  cancel_reason             text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  created_by                uuid,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                uuid,
  version                   integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, patient_id),
  UNIQUE (tenant_id, facility_id, ip_no),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, admitting_staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id, department_id) REFERENCES platform.department (tenant_id, facility_id, id),
  FOREIGN KEY (tenant_id, source_encounter_id) REFERENCES clinical.encounter (tenant_id, id),
  FOREIGN KEY (tenant_id, requested_bed_category_id) REFERENCES catalog.bed_category (tenant_id, id),
  CHECK ((status = 'discharged') = (discharged_at IS NOT NULL)),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL)),
  CHECK (discharged_at IS NULL OR discharged_at >= admitted_at)
);
-- One open stay per patient per clinic.
CREATE UNIQUE INDEX admission_one_open ON inpatient.admission (tenant_id, facility_id, patient_id)
  WHERE status IN ('bed_pending', 'admitted', 'discharge_planned');
CREATE INDEX ON inpatient.admission (tenant_id, facility_id, status, admitted_at);
CREATE INDEX ON inpatient.admission (tenant_id, patient_id);
CREATE INDEX ON inpatient.admission (tenant_id, admitting_staff_id);
CREATE INDEX ON inpatient.admission (tenant_id, facility_id, department_id);
CREATE INDEX ON inpatient.admission (tenant_id, source_encounter_id);
CREATE INDEX ON inpatient.admission (tenant_id, requested_bed_category_id);
SELECT platform.setup_tenant_table('inpatient.admission', 'mod_inpatient');

CREATE TABLE inpatient.admission_status_history (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL REFERENCES platform.tenant (id),
  admission_id  uuid NOT NULL,
  from_status   text,
  to_status     text NOT NULL,
  actor_staff_id uuid,
  reason        text,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, admission_id) REFERENCES inpatient.admission (tenant_id, id),
  FOREIGN KEY (tenant_id, actor_staff_id) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON inpatient.admission_status_history (tenant_id, admission_id, occurred_at);
CREATE INDEX ON inpatient.admission_status_history (tenant_id, actor_staff_id);
SELECT platform.apply_tenant_rls('inpatient.admission_status_history');
GRANT INSERT ON inpatient.admission_status_history TO mod_inpatient;
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON inpatient.admission_status_history
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();

-- ---------------------------------------------------------------------------
-- bed_status: the bed's current state (a bed with no row is ready). Admit/transfer lock this row.
-- ---------------------------------------------------------------------------
CREATE TABLE inpatient.bed_status (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id      uuid NOT NULL,
  bed_location_id  uuid NOT NULL,
  status           text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'occupied', 'dirty', 'blocked', 'maintenance')),
  since            timestamptz NOT NULL DEFAULT now(),
  reason           text,
  set_by           uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, bed_location_id),
  FOREIGN KEY (tenant_id, facility_id, bed_location_id) REFERENCES platform.location (tenant_id, facility_id, id),
  FOREIGN KEY (tenant_id, set_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (status NOT IN ('blocked', 'maintenance') OR reason IS NOT NULL)
);
CREATE INDEX ON inpatient.bed_status (tenant_id, facility_id, bed_location_id);
CREATE INDEX ON inpatient.bed_status (tenant_id, set_by);
SELECT platform.setup_tenant_table('inpatient.bed_status', 'mod_inpatient');

-- Only beds have a bed status.
CREATE FUNCTION inpatient.bed_status_is_bed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM platform.location l WHERE l.tenant_id = NEW.tenant_id AND l.id = NEW.bed_location_id AND l.kind = 'bed') THEN
    RAISE EXCEPTION 'location % is not a bed', NEW.bed_location_id USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bed_status_is_bed BEFORE INSERT ON inpatient.bed_status FOR EACH ROW EXECUTE FUNCTION inpatient.bed_status_is_bed();

CREATE TABLE inpatient.bed_status_history (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  bed_location_id  uuid NOT NULL,
  from_status      text,
  to_status        text NOT NULL,
  actor_staff_id   uuid,
  reason           text,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, bed_location_id) REFERENCES platform.location (tenant_id, id),
  FOREIGN KEY (tenant_id, actor_staff_id) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON inpatient.bed_status_history (tenant_id, bed_location_id, occurred_at);
CREATE INDEX ON inpatient.bed_status_history (tenant_id, actor_staff_id);
SELECT platform.apply_tenant_rls('inpatient.bed_status_history');
GRANT INSERT ON inpatient.bed_status_history TO mod_inpatient;
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON inpatient.bed_status_history
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();

-- ---------------------------------------------------------------------------
-- bed_occupancy: who is in which bed, when. Open occupancies have no upper bound. 'retained' keeps a
-- room billed while the patient is elsewhere (e.g. in ICU).
-- ---------------------------------------------------------------------------
CREATE TABLE inpatient.bed_occupancy (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id               uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id             uuid NOT NULL,
  admission_id            uuid NOT NULL,
  bed_location_id         uuid NOT NULL,
  billed_bed_category_id  uuid NOT NULL,
  period                  tstzrange NOT NULL,
  kind                    text NOT NULL DEFAULT 'primary' CHECK (kind IN ('primary', 'retained')),
  reason                  text NOT NULL CHECK (reason IN ('admit', 'transfer', 'retain')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid,
  version                 integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, admission_id) REFERENCES inpatient.admission (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id, bed_location_id) REFERENCES platform.location (tenant_id, facility_id, id),
  FOREIGN KEY (tenant_id, billed_bed_category_id) REFERENCES catalog.bed_category (tenant_id, id),
  CHECK (NOT isempty(period) AND lower(period) IS NOT NULL),
  CONSTRAINT bed_one_occupant EXCLUDE USING gist (tenant_id WITH =, bed_location_id WITH =, period WITH &&),
  CONSTRAINT admission_one_primary_bed EXCLUDE USING gist (tenant_id WITH =, admission_id WITH =, period WITH &&) WHERE (kind = 'primary')
);
CREATE INDEX ON inpatient.bed_occupancy (tenant_id, admission_id);
CREATE INDEX ON inpatient.bed_occupancy (tenant_id, facility_id, bed_location_id);
CREATE INDEX ON inpatient.bed_occupancy (tenant_id, billed_bed_category_id);
CREATE INDEX ON inpatient.bed_occupancy (tenant_id, facility_id);
SELECT platform.setup_tenant_table('inpatient.bed_occupancy', 'mod_inpatient');

-- An occupancy only ever ends (its upper bound is set once); where and when it started never change.
CREATE FUNCTION inpatient.bed_occupancy_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.admission_id, NEW.bed_location_id, NEW.kind, lower(NEW.period), NEW.billed_bed_category_id)
     IS DISTINCT FROM (OLD.admission_id, OLD.bed_location_id, OLD.kind, lower(OLD.period), OLD.billed_bed_category_id)
     OR NOT upper_inf(OLD.period) THEN
    RAISE EXCEPTION 'an occupancy can only be ended, once' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bed_occupancy_guard BEFORE UPDATE ON inpatient.bed_occupancy FOR EACH ROW EXECUTE FUNCTION inpatient.bed_occupancy_guard();

-- ---------------------------------------------------------------------------
-- transfer: a bed move, done in one step (old occupancy ends, new one starts, old bed goes dirty).
-- ---------------------------------------------------------------------------
CREATE TABLE inpatient.transfer (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid NOT NULL REFERENCES platform.tenant (id),
  admission_id        uuid NOT NULL,
  from_occupancy_id   uuid NOT NULL,
  to_occupancy_id     uuid NOT NULL,
  retained_occupancy_id uuid,
  reason              text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  moved_at            timestamptz NOT NULL DEFAULT now(),
  moved_by            uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, admission_id) REFERENCES inpatient.admission (tenant_id, id),
  FOREIGN KEY (tenant_id, from_occupancy_id) REFERENCES inpatient.bed_occupancy (tenant_id, id),
  FOREIGN KEY (tenant_id, to_occupancy_id) REFERENCES inpatient.bed_occupancy (tenant_id, id),
  FOREIGN KEY (tenant_id, retained_occupancy_id) REFERENCES inpatient.bed_occupancy (tenant_id, id),
  FOREIGN KEY (tenant_id, moved_by) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON inpatient.transfer (tenant_id, admission_id);
CREATE INDEX ON inpatient.transfer (tenant_id, from_occupancy_id);
CREATE INDEX ON inpatient.transfer (tenant_id, to_occupancy_id);
CREATE INDEX ON inpatient.transfer (tenant_id, retained_occupancy_id);
CREATE INDEX ON inpatient.transfer (tenant_id, moved_by);
SELECT platform.apply_tenant_rls('inpatient.transfer');
GRANT INSERT ON inpatient.transfer TO mod_inpatient;
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON inpatient.transfer
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();

-- ---------------------------------------------------------------------------
-- discharge: the decision, its clearances and the departure, each with its own time.
-- ---------------------------------------------------------------------------
CREATE TABLE inpatient.discharge (
  id                          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                   uuid NOT NULL REFERENCES platform.tenant (id),
  admission_id                uuid NOT NULL,
  discharge_type              text NOT NULL CHECK (discharge_type IN ('routine', 'lama', 'dama', 'absconded', 'transfer_out', 'referred', 'death')),
  decided_at                  timestamptz NOT NULL DEFAULT now(),
  decided_by                  uuid NOT NULL,
  expected_departure_at       timestamptz,
  departed_at                 timestamptz,
  summary_note_id             uuid,
  discharge_prescription_id   uuid,              -- FK added by the pharmacy module
  notes                       text CHECK (length(notes) <= 2000),
  status                      text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'cleared', 'departed', 'cancelled')),
  cancelled_at                timestamptz,
  cancel_reason               text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  created_by                  uuid,
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  uuid,
  version                     integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, admission_id) REFERENCES inpatient.admission (tenant_id, id),
  FOREIGN KEY (tenant_id, decided_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, summary_note_id) REFERENCES clinical.clinical_note (tenant_id, id),
  CHECK ((status = 'departed') = (departed_at IS NOT NULL)),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL))
);
CREATE UNIQUE INDEX discharge_one_live ON inpatient.discharge (tenant_id, admission_id) WHERE status <> 'cancelled';
CREATE INDEX ON inpatient.discharge (tenant_id, admission_id);
CREATE INDEX ON inpatient.discharge (tenant_id, decided_by);
CREATE INDEX ON inpatient.discharge (tenant_id, summary_note_id);
SELECT platform.setup_tenant_table('inpatient.discharge', 'mod_inpatient');

CREATE TABLE inpatient.discharge_clearance (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  discharge_id   uuid NOT NULL,
  kind           text NOT NULL CHECK (kind IN ('clinical', 'pharmacy', 'nursing', 'finance')),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'waived')),
  cleared_at     timestamptz,
  cleared_by     uuid,
  waiver_reason  text,
  note           text CHECK (length(note) <= 1000),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, discharge_id, kind),
  FOREIGN KEY (tenant_id, discharge_id) REFERENCES inpatient.discharge (tenant_id, id),
  FOREIGN KEY (tenant_id, cleared_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((status = 'pending') = (cleared_at IS NULL)),
  CHECK ((status = 'waived') = (waiver_reason IS NOT NULL))
);
CREATE INDEX ON inpatient.discharge_clearance (tenant_id, cleared_by);
SELECT platform.setup_tenant_table('inpatient.discharge_clearance', 'mod_inpatient');

-- ---------------------------------------------------------------------------
-- The clinical side: an encounter can belong to an admission (one inpatient encounter per stay).
-- ---------------------------------------------------------------------------
ALTER TABLE clinical.encounter ADD COLUMN admission_id uuid;
ALTER TABLE clinical.encounter ADD CONSTRAINT encounter_admission_fk
  FOREIGN KEY (tenant_id, admission_id, patient_id) REFERENCES inpatient.admission (tenant_id, id, patient_id);
ALTER TABLE clinical.encounter ADD CONSTRAINT encounter_one_per_admission UNIQUE (tenant_id, admission_id);
CREATE INDEX encounter_admission_patient ON clinical.encounter (tenant_id, admission_id, patient_id);
ALTER TABLE clinical.encounter ADD CONSTRAINT encounter_admission_class
  CHECK (admission_id IS NULL OR encounter_class IN ('inpatient', 'day_care'));

-- Billing's bed-day charges point at occupancies.
ALTER TABLE billing.charge ADD CONSTRAINT charge_bed_occupancy_fk
  FOREIGN KEY (tenant_id, bed_occupancy_id) REFERENCES inpatient.bed_occupancy (tenant_id, id);

-- migrate:down
ALTER TABLE billing.charge DROP CONSTRAINT charge_bed_occupancy_fk;
ALTER TABLE clinical.encounter DROP CONSTRAINT encounter_admission_class;
DROP INDEX clinical.encounter_admission_patient;
ALTER TABLE clinical.encounter DROP CONSTRAINT encounter_one_per_admission;
ALTER TABLE clinical.encounter DROP CONSTRAINT encounter_admission_fk;
ALTER TABLE clinical.encounter DROP COLUMN admission_id;
DROP SCHEMA inpatient CASCADE;
