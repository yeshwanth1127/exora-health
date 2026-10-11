-- migrate:up
-- M06 (ERD m06-diagnostics): orders, laboratory and imaging. The order, the specimen, the result, the
-- released report and the clinician's acknowledgement are separate rows; one specimen can serve several
-- tests. Released reports are versioned and never edited; Form F (PC-PNDT) is a statutory register.
-- Links to modules that don't exist yet (integration_message M16, equipment M15, document M14, inventory
-- items M10) are plain uuid columns; their FKs are added when those modules land.

-- ---------------------------------------------------------------------------
-- Module setup: schema `diagnostics`, write role mod_diagnostics
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mod_diagnostics') THEN
    CREATE ROLE mod_diagnostics NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT hms_reader TO mod_diagnostics;
GRANT mod_diagnostics TO hms_app WITH INHERIT FALSE, SET TRUE;

CREATE SCHEMA diagnostics;
GRANT USAGE ON SCHEMA diagnostics TO hms_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA diagnostics GRANT SELECT ON TABLES TO hms_reader;

GRANT INSERT ON platform.audit_event, platform.outbox_event, platform.inbox_record TO mod_diagnostics;
GRANT INSERT, UPDATE ON platform.number_series, platform.idempotency_record TO mod_diagnostics;

-- Lab specimens use the 'accession' series; imaging studies get their own (the DICOM worklist key).
ALTER TABLE platform.number_series DROP CONSTRAINT number_series_series_kind_check;
ALTER TABLE platform.number_series ADD CONSTRAINT number_series_series_kind_check CHECK (series_kind IN (
  'mrn', 'encounter', 'ip_no', 'invoice', 'bill_of_supply', 'credit_note', 'receipt', 'mlc', 'order', 'requisition',
  'dispense', 'token', 'accession', 'imaging_accession', 'po', 'grn', 'claim'));

-- ---------------------------------------------------------------------------
-- order_set / order_set_item: CPOE favourites. A personal set has an owner; a department set has none.
-- Sets are retired, never deleted; items leave a set by being marked removed.
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostics.order_set (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  name           text NOT NULL CHECK (btrim(name) <> ''),
  owner_staff_id uuid,
  department_id  uuid,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  retired_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, owner_staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, department_id) REFERENCES platform.department (tenant_id, id),
  CHECK (num_nonnulls(owner_staff_id, department_id) >= 1),
  CHECK ((status = 'retired') = (retired_at IS NOT NULL))
);
CREATE INDEX ON diagnostics.order_set (tenant_id, owner_staff_id);
CREATE INDEX ON diagnostics.order_set (tenant_id, department_id);
SELECT platform.setup_tenant_table('diagnostics.order_set', 'mod_diagnostics');

CREATE TABLE diagnostics.order_set_item (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  order_set_id     uuid NOT NULL,
  service_item_id  uuid NOT NULL,
  default_priority text NOT NULL DEFAULT 'routine' CHECK (default_priority IN ('routine', 'urgent', 'stat')),
  default_details  jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(default_details) = 'object'),
  sequence         smallint NOT NULL DEFAULT 0,
  removed_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, order_set_id) REFERENCES diagnostics.order_set (tenant_id, id),
  FOREIGN KEY (tenant_id, service_item_id) REFERENCES catalog.service_item (tenant_id, id)
);
CREATE UNIQUE INDEX order_set_item_active ON diagnostics.order_set_item (tenant_id, order_set_id, service_item_id) WHERE removed_at IS NULL;
CREATE INDEX ON diagnostics.order_set_item (tenant_id, order_set_id);
CREATE INDEX ON diagnostics.order_set_item (tenant_id, service_item_id);
SELECT platform.setup_tenant_table('diagnostics.order_set_item', 'mod_diagnostics');

-- ---------------------------------------------------------------------------
-- service_order: one requisition placed on an encounter; order_item: one service on it. A lab panel is a
-- parent item whose tests are child items (panel_parent_item_id).
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostics.service_order (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid NOT NULL REFERENCES platform.tenant (id),
  encounter_id        uuid NOT NULL,
  patient_id          uuid NOT NULL,
  facility_id         uuid NOT NULL,
  requisition_no      text NOT NULL,
  priority            text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
  clinical_indication text,
  order_set_id        uuid,
  ordered_at          timestamptz NOT NULL DEFAULT now(),
  ordered_by          uuid NOT NULL,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid,
  version             integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, patient_id),
  UNIQUE (tenant_id, facility_id, requisition_no),
  FOREIGN KEY (tenant_id, encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, order_set_id) REFERENCES diagnostics.order_set (tenant_id, id),
  FOREIGN KEY (tenant_id, ordered_by) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON diagnostics.service_order (tenant_id, encounter_id, patient_id);
CREATE INDEX ON diagnostics.service_order (tenant_id, patient_id, ordered_at);
CREATE INDEX ON diagnostics.service_order (tenant_id, order_set_id);
CREATE INDEX ON diagnostics.service_order (tenant_id, ordered_by);
SELECT platform.setup_tenant_table('diagnostics.service_order', 'mod_diagnostics');

CREATE FUNCTION diagnostics.service_order_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (('active', 'completed'), ('active', 'cancelled')) THEN
    RAISE EXCEPTION 'service order cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER service_order_transition_guard BEFORE UPDATE OF status ON diagnostics.service_order
  FOR EACH ROW EXECUTE FUNCTION diagnostics.service_order_transition_guard();

CREATE TABLE diagnostics.order_item (
  id                       uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                uuid NOT NULL REFERENCES platform.tenant (id),
  service_order_id         uuid NOT NULL,
  patient_id               uuid NOT NULL,
  service_item_id          uuid NOT NULL,
  performing_department_id uuid,
  panel_parent_item_id     uuid,
  target_staff_id          uuid,               -- internal consult: the doctor asked to see the patient
  quantity                 numeric(14, 3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  details                  jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
  scheduled_at             timestamptz,
  status                   text NOT NULL DEFAULT 'ordered'
                             CHECK (status IN ('ordered', 'scheduled', 'collected', 'in_progress', 'resulted', 'released', 'cancelled')),
  cancel_reason            text,
  cancelled_at             timestamptz,
  cancelled_by             uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid,
  version                  integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, patient_id),            -- lets specimens and results prove they belong to the same patient
  FOREIGN KEY (tenant_id, service_order_id, patient_id) REFERENCES diagnostics.service_order (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, service_item_id) REFERENCES catalog.service_item (tenant_id, id),
  FOREIGN KEY (tenant_id, performing_department_id) REFERENCES platform.department (tenant_id, id),
  FOREIGN KEY (tenant_id, panel_parent_item_id, patient_id) REFERENCES diagnostics.order_item (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, target_staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, cancelled_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (panel_parent_item_id <> id),
  CHECK ((status = 'cancelled') = (cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL))
);
CREATE INDEX ON diagnostics.order_item (tenant_id, service_order_id, patient_id);
CREATE INDEX ON diagnostics.order_item (tenant_id, patient_id);
CREATE INDEX ON diagnostics.order_item (tenant_id, service_item_id);
CREATE INDEX ON diagnostics.order_item (tenant_id, performing_department_id, status);
CREATE INDEX ON diagnostics.order_item (tenant_id, panel_parent_item_id, patient_id);
CREATE INDEX ON diagnostics.order_item (tenant_id, target_staff_id);
CREATE INDEX ON diagnostics.order_item (tenant_id, cancelled_by);
CREATE INDEX ON diagnostics.order_item (tenant_id, status);
SELECT platform.setup_tenant_table('diagnostics.order_item', 'mod_diagnostics');

-- ordered → scheduled → collected → in_progress → resulted → released; cancelled before a result exists.
-- A rejected specimen sends its tests back to `ordered` for recollection.
CREATE FUNCTION diagnostics.order_item_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
       ('ordered', 'scheduled'), ('ordered', 'collected'), ('ordered', 'in_progress'), ('ordered', 'cancelled'),
       ('scheduled', 'collected'), ('scheduled', 'in_progress'), ('scheduled', 'cancelled'),
       ('collected', 'in_progress'), ('collected', 'ordered'), ('collected', 'cancelled'),
       ('in_progress', 'resulted'), ('in_progress', 'ordered'), ('in_progress', 'cancelled'),
       ('resulted', 'released'), ('resulted', 'in_progress')) THEN
    RAISE EXCEPTION 'order item cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_item_transition_guard BEFORE UPDATE OF status ON diagnostics.order_item
  FOR EACH ROW EXECUTE FUNCTION diagnostics.order_item_transition_guard();

CREATE TABLE diagnostics.order_item_status_history (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  order_item_id  uuid NOT NULL,
  from_status    text,
  to_status      text NOT NULL,
  actor_staff_id uuid,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, order_item_id) REFERENCES diagnostics.order_item (tenant_id, id)
);
CREATE INDEX ON diagnostics.order_item_status_history (tenant_id, order_item_id, occurred_at);
SELECT platform.apply_tenant_rls('diagnostics.order_item_status_history');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON diagnostics.order_item_status_history
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON diagnostics.order_item_status_history TO mod_diagnostics;

CREATE FUNCTION diagnostics.order_item_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO diagnostics.order_item_status_history (tenant_id, order_item_id, from_status, to_status, actor_staff_id)
    VALUES (NEW.tenant_id, NEW.id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, NEW.status,
            nullif(current_setting('app.actor_staff_id', true), '')::uuid);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_item_history AFTER INSERT OR UPDATE OF status ON diagnostics.order_item
  FOR EACH ROW EXECUTE FUNCTION diagnostics.order_item_history();

-- ---------------------------------------------------------------------------
-- specimen: one container drawn from the patient; specimen_order_item: which tests it serves.
-- A rejected specimen is replaced by a recollection that points back at it.
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostics.specimen (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  patient_id         uuid NOT NULL,
  facility_id        uuid NOT NULL,
  accession_no       text NOT NULL,
  barcode            text NOT NULL,
  specimen_type      text NOT NULL CHECK (specimen_type IN ('whole_blood', 'serum', 'plasma', 'urine', 'stool', 'csf',
                                                            'sputum', 'swab', 'tissue', 'fluid', 'other')),
  container_type     text CHECK (container_type IN ('edta', 'plain', 'sst', 'fluoride', 'citrate', 'heparin', 'sterile', 'other')),
  collection_site    text,
  collected_at       timestamptz,
  collected_by       uuid,
  received_at        timestamptz,
  received_by        uuid,
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'collected', 'received', 'rejected', 'consumed', 'stored', 'disposed')),
  rejection_reason   text CHECK (rejection_reason IN ('haemolysed', 'clotted', 'insufficient', 'mislabelled', 'wrong_container', 'delayed', 'other')),
  rejection_note     text,
  rejected_at        timestamptz,
  rejected_by        uuid,
  recollection_of_id uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, patient_id),
  UNIQUE (tenant_id, accession_no),
  UNIQUE (tenant_id, barcode),
  UNIQUE (tenant_id, recollection_of_id),        -- one recollection per rejected specimen
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, collected_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, received_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, rejected_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, recollection_of_id, patient_id) REFERENCES diagnostics.specimen (tenant_id, id, patient_id),
  CHECK (recollection_of_id <> id),
  CHECK (status = 'pending' OR (collected_at IS NOT NULL AND collected_by IS NOT NULL)),
  CHECK (status NOT IN ('received', 'consumed', 'stored') OR received_at IS NOT NULL),
  CHECK ((status = 'rejected') = (rejection_reason IS NOT NULL AND rejected_at IS NOT NULL)),
  CHECK (received_at IS NULL OR received_at >= collected_at)
);
CREATE INDEX ON diagnostics.specimen (tenant_id, patient_id);
CREATE INDEX ON diagnostics.specimen (tenant_id, facility_id, status);
CREATE INDEX ON diagnostics.specimen (tenant_id, collected_by);
CREATE INDEX ON diagnostics.specimen (tenant_id, received_by);
CREATE INDEX ON diagnostics.specimen (tenant_id, rejected_by);
CREATE INDEX ON diagnostics.specimen (tenant_id, recollection_of_id, patient_id);
SELECT platform.setup_tenant_table('diagnostics.specimen', 'mod_diagnostics');

CREATE FUNCTION diagnostics.specimen_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
       ('pending', 'collected'), ('pending', 'rejected'),
       ('collected', 'received'), ('collected', 'rejected'),
       ('received', 'rejected'), ('received', 'consumed'), ('received', 'stored'),
       ('stored', 'consumed'), ('stored', 'disposed'), ('consumed', 'disposed'), ('rejected', 'disposed')) THEN
    RAISE EXCEPTION 'specimen cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER specimen_transition_guard BEFORE UPDATE OF status ON diagnostics.specimen
  FOR EACH ROW EXECUTE FUNCTION diagnostics.specimen_transition_guard();

CREATE TABLE diagnostics.specimen_order_item (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL REFERENCES platform.tenant (id),
  specimen_id   uuid NOT NULL,
  order_item_id uuid NOT NULL,
  patient_id    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, specimen_id, order_item_id),
  -- Both sides must belong to the same patient.
  FOREIGN KEY (tenant_id, specimen_id, patient_id) REFERENCES diagnostics.specimen (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, order_item_id, patient_id) REFERENCES diagnostics.order_item (tenant_id, id, patient_id)
);
CREATE INDEX ON diagnostics.specimen_order_item (tenant_id, specimen_id, patient_id);
CREATE INDEX ON diagnostics.specimen_order_item (tenant_id, order_item_id, patient_id);
SELECT platform.apply_tenant_rls('diagnostics.specimen_order_item');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON diagnostics.specimen_order_item
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON diagnostics.specimen_order_item TO mod_diagnostics;

-- ---------------------------------------------------------------------------
-- result_item: one value for one parameter. Reference limits are snapshotted at entry; values are never
-- edited — a correction is a new row (status corrected) that supersedes the old one.
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostics.result_item (
  id                        uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                 uuid NOT NULL REFERENCES platform.tenant (id),
  order_item_id             uuid NOT NULL,
  patient_id                uuid NOT NULL,
  observation_definition_id uuid NOT NULL,
  specimen_id               uuid,
  integration_message_id    uuid,              -- FK to integration.integration_message added with M16
  value_num                 numeric,
  value_text                text,
  value_option_id           uuid,
  unit                      text,
  ref_low                   numeric,
  ref_high                  numeric,
  ref_text                  text,
  abnormal_flag             text CHECK (abnormal_flag IN ('normal', 'low', 'high', 'critical_low', 'critical_high', 'abnormal')),
  is_critical               boolean NOT NULL DEFAULT false,
  status                    text NOT NULL DEFAULT 'preliminary' CHECK (status IN ('preliminary', 'final', 'corrected', 'cancelled')),
  source                    text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'instrument')),
  comment                   text,
  correction_reason         text,
  entered_by                uuid NOT NULL,
  entered_at                timestamptz NOT NULL DEFAULT now(),
  verified_by               uuid,
  verified_at               timestamptz,
  supersedes_id             uuid,
  superseded_at             timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  created_by                uuid,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                uuid,
  version                   integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, supersedes_id),
  FOREIGN KEY (tenant_id, order_item_id, patient_id) REFERENCES diagnostics.order_item (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, observation_definition_id) REFERENCES catalog.observation_definition (tenant_id, id),
  FOREIGN KEY (tenant_id, specimen_id, patient_id) REFERENCES diagnostics.specimen (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, value_option_id) REFERENCES catalog.answer_option (tenant_id, id),
  FOREIGN KEY (tenant_id, entered_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, verified_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, supersedes_id) REFERENCES diagnostics.result_item (tenant_id, id),
  CHECK (num_nonnulls(value_num, value_text, value_option_id) >= 1),
  CHECK ((status = 'corrected') = (supersedes_id IS NOT NULL)),
  CHECK ((supersedes_id IS NULL) = (correction_reason IS NULL)),
  CHECK ((verified_at IS NULL) = (verified_by IS NULL)),
  CHECK (status <> 'final' OR verified_at IS NOT NULL),
  CHECK (is_critical = (abnormal_flag IS NOT NULL AND abnormal_flag IN ('critical_low', 'critical_high')))
);
-- One current value per test and parameter.
CREATE UNIQUE INDEX result_item_current ON diagnostics.result_item (tenant_id, order_item_id, observation_definition_id)
  WHERE superseded_at IS NULL AND status <> 'cancelled';
CREATE INDEX ON diagnostics.result_item (tenant_id, order_item_id, patient_id);
CREATE INDEX ON diagnostics.result_item (tenant_id, observation_definition_id);
CREATE INDEX ON diagnostics.result_item (tenant_id, specimen_id, patient_id);
CREATE INDEX ON diagnostics.result_item (tenant_id, integration_message_id);
CREATE INDEX ON diagnostics.result_item (tenant_id, value_option_id);
CREATE INDEX ON diagnostics.result_item (tenant_id, entered_by);
CREATE INDEX ON diagnostics.result_item (tenant_id, verified_by);
CREATE INDEX ON diagnostics.result_item (tenant_id, patient_id, observation_definition_id, entered_at);
SELECT platform.setup_tenant_table('diagnostics.result_item', 'mod_diagnostics');

-- Recorded values never change; only verification, supersession and status move (forward).
CREATE FUNCTION diagnostics.result_item_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  movable text[] := ARRAY['status', 'verified_by', 'verified_at', 'superseded_at', 'updated_at', 'updated_by', 'version'];
BEGIN
  IF (to_jsonb(NEW) - movable) IS DISTINCT FROM (to_jsonb(OLD) - movable) THEN
    RAISE EXCEPTION 'recorded results cannot be edited; record a correction instead' USING ERRCODE = '55000';
  END IF;
  IF OLD.superseded_at IS NOT NULL AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at THEN
    RAISE EXCEPTION 'result was already superseded' USING ERRCODE = '55000';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (('preliminary', 'final'), ('preliminary', 'cancelled'), ('final', 'cancelled')) THEN
    RAISE EXCEPTION 'result cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER result_item_guard BEFORE UPDATE ON diagnostics.result_item
  FOR EACH ROW EXECUTE FUNCTION diagnostics.result_item_guard();

-- critical_alert: documented communication of a critical value (NABH / NABL) — who told whom, how, read-back.
CREATE TABLE diagnostics.critical_alert (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  result_item_id       uuid NOT NULL,
  notified_by          uuid NOT NULL,
  notified_to_staff_id uuid,
  notified_to_name     text,
  notified_at          timestamptz NOT NULL DEFAULT now(),
  channel              text NOT NULL CHECK (channel IN ('phone', 'in_person', 'app')),
  read_back_confirmed  boolean NOT NULL,
  note                 text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, result_item_id) REFERENCES diagnostics.result_item (tenant_id, id),
  FOREIGN KEY (tenant_id, notified_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, notified_to_staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK (num_nonnulls(notified_to_staff_id, nullif(btrim(notified_to_name), '')) >= 1)
);
CREATE INDEX ON diagnostics.critical_alert (tenant_id, result_item_id);
CREATE INDEX ON diagnostics.critical_alert (tenant_id, notified_by);
CREATE INDEX ON diagnostics.critical_alert (tenant_id, notified_to_staff_id);
SELECT platform.apply_tenant_rls('diagnostics.critical_alert');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON diagnostics.critical_alert
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON diagnostics.critical_alert TO mod_diagnostics;

-- ---------------------------------------------------------------------------
-- Microbiology: organisms grown on a culture, and their antibiotic susceptibility (AST).
-- antibiotic_item_id gets its FK to inventory.item with M10.
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostics.micro_isolate (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid NOT NULL REFERENCES platform.tenant (id),
  order_item_id       uuid NOT NULL,
  patient_id          uuid NOT NULL,
  sequence            smallint NOT NULL CHECK (sequence BETWEEN 1 AND 20),
  organism_concept_id uuid REFERENCES catalog.terminology_concept (id),
  organism_name       text NOT NULL CHECK (btrim(organism_name) <> ''),
  colony_count        text,
  comment             text,
  entered_by          uuid NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid,
  version             integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, order_item_id, sequence),
  FOREIGN KEY (tenant_id, order_item_id, patient_id) REFERENCES diagnostics.order_item (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, entered_by) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON diagnostics.micro_isolate (tenant_id, order_item_id, patient_id);
CREATE INDEX ON diagnostics.micro_isolate (organism_concept_id);
CREATE INDEX ON diagnostics.micro_isolate (tenant_id, entered_by);
SELECT platform.setup_tenant_table('diagnostics.micro_isolate', 'mod_diagnostics');

CREATE TABLE diagnostics.micro_susceptibility (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  micro_isolate_id   uuid NOT NULL,
  antibiotic_item_id uuid,                   -- FK to inventory.item added with M10
  antibiotic_name    text NOT NULL CHECK (btrim(antibiotic_name) <> ''),
  method             text NOT NULL CHECK (method IN ('disc', 'mic')),
  mic_value          numeric CHECK (mic_value > 0),
  zone_mm            numeric(5, 1) CHECK (zone_mm >= 0),
  interpretation     text NOT NULL CHECK (interpretation IN ('S', 'I', 'R')),
  entered_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, micro_isolate_id, antibiotic_name),
  FOREIGN KEY (tenant_id, micro_isolate_id) REFERENCES diagnostics.micro_isolate (tenant_id, id),
  FOREIGN KEY (tenant_id, entered_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (method <> 'mic' OR mic_value IS NOT NULL),
  CHECK (method <> 'disc' OR zone_mm IS NOT NULL)
);
CREATE INDEX ON diagnostics.micro_susceptibility (tenant_id, antibiotic_item_id);
CREATE INDEX ON diagnostics.micro_susceptibility (tenant_id, entered_by);
SELECT platform.setup_tenant_table('diagnostics.micro_susceptibility', 'mod_diagnostics');

-- ---------------------------------------------------------------------------
-- diagnostic_report: the released interpretation of an order item. Each change writes an immutable
-- version with a body snapshot (results, findings, impression). Release (final) is by an authorised
-- signatory (NABL); later changes are amendments with a reason.
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostics.diagnostic_report (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenant (id),
  order_item_id   uuid NOT NULL,
  patient_id      uuid NOT NULL,
  report_type     text NOT NULL CHECK (report_type IN ('lab', 'imaging', 'pathology')),
  status          text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'preliminary', 'final', 'amended', 'cancelled')),
  conclusion      text,
  released_at     timestamptz,
  released_by     uuid,
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  cancel_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, order_item_id, patient_id) REFERENCES diagnostics.order_item (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, released_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((status IN ('final', 'amended')) <= (released_at IS NOT NULL AND released_by IS NOT NULL)),
  CHECK ((status = 'cancelled') = (cancel_reason IS NOT NULL))
);
-- One live report per order item.
CREATE UNIQUE INDEX diagnostic_report_one_live ON diagnostics.diagnostic_report (tenant_id, order_item_id) WHERE status <> 'cancelled';
CREATE INDEX ON diagnostics.diagnostic_report (tenant_id, order_item_id, patient_id);
CREATE INDEX ON diagnostics.diagnostic_report (tenant_id, patient_id, released_at);
CREATE INDEX ON diagnostics.diagnostic_report (tenant_id, released_by);
SELECT platform.setup_tenant_table('diagnostics.diagnostic_report', 'mod_diagnostics');

CREATE FUNCTION diagnostics.diagnostic_report_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
       ('registered', 'preliminary'), ('registered', 'final'), ('registered', 'cancelled'),
       ('preliminary', 'final'), ('preliminary', 'cancelled'),
       ('final', 'amended')) THEN
    RAISE EXCEPTION 'diagnostic report cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  IF OLD.status IN ('final', 'amended') AND NEW.current_version = OLD.current_version
     AND (NEW.conclusion, NEW.released_at, NEW.released_by) IS DISTINCT FROM (OLD.conclusion, OLD.released_at, OLD.released_by) THEN
    RAISE EXCEPTION 'a released report changes only by amendment (a new version)' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER diagnostic_report_transition_guard BEFORE UPDATE ON diagnostics.diagnostic_report
  FOR EACH ROW EXECUTE FUNCTION diagnostics.diagnostic_report_transition_guard();

CREATE TABLE diagnostics.diagnostic_report_version (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  diagnostic_report_id uuid NOT NULL,
  version_no           integer NOT NULL CHECK (version_no > 0),
  status               text NOT NULL CHECK (status IN ('registered', 'preliminary', 'final', 'amended', 'cancelled')),
  body                 jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(body) = 'object'),
  form_template_id     uuid REFERENCES clinical.form_template (id),
  amendment_reason     text,
  document_id          uuid,                 -- rendered PDF; FK to documents.document added with M14
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, diagnostic_report_id, version_no),
  FOREIGN KEY (tenant_id, diagnostic_report_id) REFERENCES diagnostics.diagnostic_report (tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (status <> 'amended' OR coalesce(btrim(amendment_reason), '') <> '')
);
CREATE INDEX ON diagnostics.diagnostic_report_version (form_template_id);
CREATE INDEX ON diagnostics.diagnostic_report_version (tenant_id, created_by);
CREATE INDEX ON diagnostics.diagnostic_report_version (tenant_id, document_id);
SELECT platform.apply_tenant_rls('diagnostics.diagnostic_report_version');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON diagnostics.diagnostic_report_version
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON diagnostics.diagnostic_report_version TO mod_diagnostics;

-- result_acknowledgement: the clinician has seen a released report (once per clinician) and what they did.
CREATE TABLE diagnostics.result_acknowledgement (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  diagnostic_report_id uuid NOT NULL,
  staff_id             uuid NOT NULL,
  report_version_no    integer NOT NULL CHECK (report_version_no > 0),
  acknowledged_at      timestamptz NOT NULL DEFAULT now(),
  action_taken         text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, diagnostic_report_id, staff_id),
  FOREIGN KEY (tenant_id, diagnostic_report_id) REFERENCES diagnostics.diagnostic_report (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON diagnostics.result_acknowledgement (tenant_id, staff_id);
SELECT platform.apply_tenant_rls('diagnostics.result_acknowledgement');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON diagnostics.result_acknowledgement
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON diagnostics.result_acknowledgement TO mod_diagnostics;

-- ---------------------------------------------------------------------------
-- imaging_study: 1:1 with an imaging order item. The accession number is the DICOM worklist key.
-- equipment_id / contrast_item_id get FKs with M15 / M10; the scan slot is an M04 reservation.
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostics.imaging_study (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  order_item_id      uuid NOT NULL,
  patient_id         uuid NOT NULL,
  facility_id        uuid NOT NULL,
  modality           text NOT NULL CHECK (modality IN ('CR', 'DX', 'CT', 'MR', 'US', 'MG', 'NM', 'PT', 'XA', 'RF')),
  accession_no       text NOT NULL,
  study_instance_uid text NOT NULL CHECK (study_instance_uid ~ '^[0-9]+(\.[0-9]+)*$' AND length(study_instance_uid) <= 64),
  status             text NOT NULL DEFAULT 'scheduled'
                       CHECK (status IN ('scheduled', 'arrived', 'in_progress', 'completed', 'reported', 'cancelled')),
  scheduled_at       timestamptz,
  reservation_id     uuid,
  arrived_at         timestamptz,
  started_at         timestamptz,
  performed_at       timestamptz,
  performed_by       uuid,
  equipment_id       uuid,                   -- FK to operations.equipment added with M15
  contrast_item_id   uuid,                   -- FK to inventory.item added with M10
  dose_dlp_mgy_cm    numeric(10, 2) CHECK (dose_dlp_mgy_cm >= 0),
  pacs_url           text CHECK (pacs_url ~ '^https?://'),
  is_obstetric       boolean NOT NULL DEFAULT false,
  cancel_reason      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, patient_id),
  UNIQUE (tenant_id, order_item_id),
  UNIQUE (tenant_id, facility_id, accession_no),
  UNIQUE (tenant_id, study_instance_uid),
  UNIQUE (tenant_id, reservation_id),
  FOREIGN KEY (tenant_id, order_item_id, patient_id) REFERENCES diagnostics.order_item (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, reservation_id) REFERENCES booking.reservation (tenant_id, id),
  FOREIGN KEY (tenant_id, performed_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((status IN ('completed', 'reported')) <= (performed_at IS NOT NULL AND performed_by IS NOT NULL)),
  CHECK ((status = 'cancelled') = (cancel_reason IS NOT NULL))
);
CREATE INDEX ON diagnostics.imaging_study (tenant_id, order_item_id, patient_id);
CREATE INDEX ON diagnostics.imaging_study (tenant_id, patient_id);
CREATE INDEX ON diagnostics.imaging_study (tenant_id, facility_id, status);
CREATE INDEX ON diagnostics.imaging_study (tenant_id, performed_by);
CREATE INDEX ON diagnostics.imaging_study (tenant_id, equipment_id);
CREATE INDEX ON diagnostics.imaging_study (tenant_id, contrast_item_id);
SELECT platform.setup_tenant_table('diagnostics.imaging_study', 'mod_diagnostics');

-- ---------------------------------------------------------------------------
-- pcpndt_form_f: PC-PNDT Act Form F for every ultrasound on a pregnant woman. Reported monthly to the
-- Appropriate Authority, kept two years (deletion blocked), frozen once submitted. Sensitive: read only
-- with pcpndt.manage.
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostics.pcpndt_form_f (
  id                        uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                 uuid NOT NULL REFERENCES platform.tenant (id),
  imaging_study_id          uuid NOT NULL,
  patient_id                uuid NOT NULL,
  facility_id               uuid NOT NULL,
  form_data                 jsonb NOT NULL CHECK (jsonb_typeof(form_data) = 'object'),
  patient_declaration_at    timestamptz,
  doctor_declaration_by     uuid,
  doctor_declaration_at     timestamptz,
  reporting_month           date NOT NULL CHECK (extract(day FROM reporting_month) = 1),
  submitted_to_authority_at timestamptz,
  submitted_by              uuid,
  submission_ref            text,
  retain_until              date NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  created_by                uuid,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                uuid,
  version                   integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, imaging_study_id),
  FOREIGN KEY (tenant_id, imaging_study_id, patient_id) REFERENCES diagnostics.imaging_study (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, doctor_declaration_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, submitted_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((doctor_declaration_at IS NULL) = (doctor_declaration_by IS NULL)),
  CHECK ((submitted_to_authority_at IS NULL) = (submitted_by IS NULL)),
  CHECK (retain_until >= ((created_at AT TIME ZONE 'UTC') + interval '2 years')::date)
);
CREATE INDEX ON diagnostics.pcpndt_form_f (tenant_id, imaging_study_id, patient_id);
CREATE INDEX ON diagnostics.pcpndt_form_f (tenant_id, facility_id, reporting_month);
CREATE INDEX ON diagnostics.pcpndt_form_f (tenant_id, doctor_declaration_by);
CREATE INDEX ON diagnostics.pcpndt_form_f (tenant_id, submitted_by);
SELECT platform.setup_tenant_table('diagnostics.pcpndt_form_f', 'mod_diagnostics');

-- Statutory register: never deleted (and not before retain_until in any case); frozen once submitted.
CREATE FUNCTION diagnostics.form_f_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Form F records are kept until % (PC-PNDT Act) and are never deleted', OLD.retain_until USING ERRCODE = '42501';
  END IF;
  IF OLD.submitted_to_authority_at IS NOT NULL
     AND (to_jsonb(NEW) - ARRAY['updated_at', 'updated_by', 'version']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at', 'updated_by', 'version']) THEN
    RAISE EXCEPTION 'Form F was submitted to the Appropriate Authority and cannot change' USING ERRCODE = '55000';
  END IF;
  IF NEW.retain_until < OLD.retain_until THEN
    RAISE EXCEPTION 'Form F retention cannot be shortened' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER form_f_guard BEFORE UPDATE OR DELETE ON diagnostics.pcpndt_form_f
  FOR EACH ROW EXECUTE FUNCTION diagnostics.form_f_guard();

-- An obstetric ultrasound can't be completed without a Form F carrying both declarations.
CREATE FUNCTION diagnostics.imaging_study_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
       ('scheduled', 'arrived'), ('scheduled', 'cancelled'),
       ('arrived', 'in_progress'), ('arrived', 'cancelled'),
       ('in_progress', 'completed'), ('in_progress', 'cancelled'),
       ('completed', 'reported')) THEN
    RAISE EXCEPTION 'imaging study cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  IF NEW.status = 'completed' AND OLD.status <> 'completed' AND NEW.is_obstetric AND NEW.modality = 'US' AND NOT EXISTS (
       SELECT 1 FROM diagnostics.pcpndt_form_f f
       WHERE f.tenant_id = NEW.tenant_id AND f.imaging_study_id = NEW.id
         AND f.patient_declaration_at IS NOT NULL AND f.doctor_declaration_at IS NOT NULL) THEN
    RAISE EXCEPTION 'an obstetric ultrasound needs a declared Form F before it is completed' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER imaging_study_guard BEFORE UPDATE ON diagnostics.imaging_study
  FOR EACH ROW EXECUTE FUNCTION diagnostics.imaging_study_guard();

-- migrate:down
DROP SCHEMA diagnostics CASCADE;
DELETE FROM platform.number_series WHERE series_kind = 'imaging_accession';
ALTER TABLE platform.number_series DROP CONSTRAINT number_series_series_kind_check;
ALTER TABLE platform.number_series ADD CONSTRAINT number_series_series_kind_check CHECK (series_kind IN (
  'mrn', 'encounter', 'ip_no', 'invoice', 'bill_of_supply', 'credit_note', 'receipt', 'mlc', 'order', 'requisition',
  'dispense', 'token', 'accession', 'po', 'grn', 'claim'));
REVOKE INSERT ON platform.audit_event, platform.outbox_event, platform.inbox_record FROM mod_diagnostics;
REVOKE INSERT, UPDATE ON platform.number_series, platform.idempotency_record FROM mod_diagnostics;
