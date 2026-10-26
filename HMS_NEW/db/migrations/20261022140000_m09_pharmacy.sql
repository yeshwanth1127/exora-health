-- migrate:up
-- M09 pharmacy, clinic scope (ERD m09-pharmacy, trimmed; based on the reverted 1a3137a): prescriptions
-- (outpatient, inpatient orders, discharge), dispensing against a prescription or a ward indent,
-- walk-in over-the-counter sales, returns, and nurses' medication administration (MAR). Every
-- prescribed dispense line points at the prescription line it fills (Σ dispensed ≤ prescribed is a CHECK);
-- an OTC sale has no prescription and may have no registered patient, and the sale command refuses
-- Schedule H/H1/X and NDPS drugs for it. Pharmacy never writes the inventory ledger: it calls
-- inventory.post_patient_movement, which checks the movement matches the line or return it claims.
-- The controlled-drug register (Schedule H1/X, NDPS) is a view over dispense lines, so it can't drift.

-- ---------------------------------------------------------------------------
-- Module setup: schema `pharmacy`, write role mod_pharmacy
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mod_pharmacy') THEN
    CREATE ROLE mod_pharmacy NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT hms_reader TO mod_pharmacy;
GRANT mod_pharmacy TO hms_app WITH INHERIT FALSE, SET TRUE;

CREATE SCHEMA pharmacy;
GRANT USAGE ON SCHEMA pharmacy TO hms_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA pharmacy GRANT SELECT ON TABLES TO hms_reader;

GRANT INSERT ON platform.audit_event, platform.outbox_event, platform.inbox_record TO mod_pharmacy;
GRANT INSERT, UPDATE ON platform.number_series, platform.idempotency_record TO mod_pharmacy;

-- ---------------------------------------------------------------------------
-- prescription: written as a draft and signed by its prescriber (current registration). Once signed its
-- content is frozen; only its status moves.
-- ---------------------------------------------------------------------------
CREATE TABLE pharmacy.prescription (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid NOT NULL REFERENCES platform.tenant (id),
  encounter_id        uuid NOT NULL,
  patient_id          uuid NOT NULL,
  facility_id         uuid NOT NULL,
  setting             text NOT NULL CHECK (setting IN ('outpatient', 'inpatient', 'discharge', 'virtual')),
  prescriber_staff_id uuid NOT NULL,
  signed_at           timestamptz,
  valid_until         date,
  advice              text CHECK (length(advice) <= 4000),
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'signed', 'partially_dispensed', 'completed', 'cancelled')),
  cancel_reason       text,
  cancelled_at        timestamptz,
  cancelled_by        uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid,
  version             integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, prescriber_staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, cancelled_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (status IN ('draft', 'cancelled') OR signed_at IS NOT NULL),
  CHECK ((status = 'cancelled') = (cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL)),
  CHECK (valid_until IS NULL OR signed_at IS NOT NULL)
);
CREATE INDEX ON pharmacy.prescription (tenant_id, encounter_id, patient_id);
CREATE INDEX ON pharmacy.prescription (tenant_id, patient_id, status);
CREATE INDEX ON pharmacy.prescription (tenant_id, facility_id, status, signed_at);
CREATE INDEX ON pharmacy.prescription (tenant_id, prescriber_staff_id);
CREATE INDEX ON pharmacy.prescription (tenant_id, cancelled_by);
SELECT platform.setup_tenant_table('pharmacy.prescription', 'mod_pharmacy');

CREATE FUNCTION pharmacy.prescription_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  movable text[] := ARRAY['status', 'cancel_reason', 'cancelled_at', 'cancelled_by', 'updated_at', 'updated_by', 'version'];
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
       ('draft', 'signed'), ('draft', 'cancelled'),
       ('signed', 'partially_dispensed'), ('signed', 'completed'), ('signed', 'cancelled'),
       ('partially_dispensed', 'completed'), ('partially_dispensed', 'cancelled')) THEN
    RAISE EXCEPTION 'prescription cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000', HINT = 'invalid_state';
  END IF;
  IF OLD.status <> 'draft' AND (to_jsonb(NEW) - movable) IS DISTINCT FROM (to_jsonb(OLD) - movable) THEN
    RAISE EXCEPTION 'a signed prescription cannot be changed' USING ERRCODE = '55000', HINT = 'prescription_signed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER prescription_guard BEFORE UPDATE ON pharmacy.prescription
  FOR EACH ROW EXECUTE FUNCTION pharmacy.prescription_guard();

-- prescription_item: one drug. Generic / brand / strength are snapshots (the item may be renamed later).
-- quantity_prescribed is NULL for an ongoing inpatient order. Warnings found at signing (allergy,
-- duplicate therapy) are kept with the reason the prescriber overrode them.
CREATE TABLE pharmacy.prescription_item (
  id                       uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                uuid NOT NULL REFERENCES platform.tenant (id),
  prescription_id          uuid NOT NULL,
  line_no                  integer NOT NULL CHECK (line_no > 0),
  item_id                  uuid NOT NULL,
  generic_name             text NOT NULL CHECK (btrim(generic_name) <> ''),
  brand_name               text,
  strength                 text,
  dose                     numeric(12, 3) NOT NULL CHECK (dose > 0),
  dose_unit                text NOT NULL CHECK (btrim(dose_unit) <> '' AND length(dose_unit) <= 20),
  route                    text NOT NULL CHECK (route IN ('oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'sublingual', 'rectal',
                                                          'ophthalmic', 'otic', 'nasal', 'vaginal', 'other')),
  frequency_code           text NOT NULL CHECK (frequency_code IN ('OD', 'BD', 'TDS', 'QID', 'HS', 'SOS', 'STAT', 'Q4H', 'Q6H', 'Q8H', 'WEEKLY', 'CUSTOM')),
  frequency_text           text CHECK (length(frequency_text) <= 200),
  duration_value           integer CHECK (duration_value > 0),
  duration_unit            text CHECK (duration_unit IN ('days', 'weeks', 'months', 'doses')),
  quantity_prescribed      numeric(14, 3) CHECK (quantity_prescribed > 0),
  quantity_dispensed       numeric(14, 3) NOT NULL DEFAULT 0 CHECK (quantity_dispensed >= 0),
  is_prn                   boolean NOT NULL DEFAULT false,
  prn_min_interval_minutes integer CHECK (prn_min_interval_minutes BETWEEN 15 AND 10080),
  food_relation            text NOT NULL DEFAULT 'any' CHECK (food_relation IN ('before_food', 'after_food', 'with_food', 'empty_stomach', 'any')),
  instructions             text CHECK (length(instructions) <= 1000),
  substitution_allowed     boolean NOT NULL DEFAULT true,
  start_at                 timestamptz,
  stop_at                  timestamptz,
  stopped_by               uuid,
  stop_reason              text,
  warnings                 jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(warnings) = 'array'),
  override_reason          text,
  status                   text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'held', 'stopped', 'completed', 'cancelled')),
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid,
  version                  integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, prescription_id, line_no),
  FOREIGN KEY (tenant_id, prescription_id) REFERENCES pharmacy.prescription (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, id),
  FOREIGN KEY (tenant_id, stopped_by) REFERENCES platform.staff (tenant_id, id),
  CONSTRAINT prescription_item_dispensed_check CHECK (quantity_prescribed IS NULL OR quantity_dispensed <= quantity_prescribed),
  CHECK (frequency_code <> 'CUSTOM' OR frequency_text IS NOT NULL),
  CHECK ((duration_value IS NULL) = (duration_unit IS NULL)),
  CHECK (stop_at IS NULL OR start_at IS NULL OR stop_at >= start_at),
  CHECK ((status = 'stopped') = (stopped_by IS NOT NULL AND stop_reason IS NOT NULL)),
  CHECK (jsonb_array_length(warnings) = 0 OR override_reason IS NOT NULL),
  CHECK (NOT is_prn OR prn_min_interval_minutes IS NOT NULL)
);
CREATE INDEX ON pharmacy.prescription_item (tenant_id, item_id);
CREATE INDEX ON pharmacy.prescription_item (tenant_id, stopped_by);
SELECT platform.setup_tenant_table('pharmacy.prescription_item', 'mod_pharmacy');
-- Draft lines are replaced by deleting them (the guard refuses it once signed).
GRANT DELETE ON pharmacy.prescription_item TO mod_pharmacy;

CREATE FUNCTION pharmacy.prescription_item_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  movable text[] := ARRAY['status', 'stop_at', 'stopped_by', 'stop_reason', 'quantity_dispensed', 'warnings', 'override_reason',
                          'updated_at', 'updated_by', 'version'];
  rx_status text;
BEGIN
  SELECT status INTO rx_status FROM pharmacy.prescription WHERE tenant_id = coalesce(NEW.tenant_id, OLD.tenant_id) AND id = coalesce(NEW.prescription_id, OLD.prescription_id);
  IF TG_OP = 'DELETE' THEN
    IF rx_status <> 'draft' THEN RAISE EXCEPTION 'a signed prescription line cannot be removed' USING ERRCODE = '55000', HINT = 'prescription_signed'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND OLD.status IN ('stopped', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'a % prescription line cannot change', OLD.status USING ERRCODE = '55000', HINT = 'invalid_state';
  END IF;
  IF rx_status <> 'draft' AND (to_jsonb(NEW) - movable) IS DISTINCT FROM (to_jsonb(OLD) - movable) THEN
    RAISE EXCEPTION 'a signed prescription line cannot be changed' USING ERRCODE = '55000', HINT = 'prescription_signed';
  END IF;
  IF rx_status NOT IN ('draft') AND (NEW.warnings IS DISTINCT FROM OLD.warnings OR NEW.override_reason IS DISTINCT FROM OLD.override_reason) THEN
    RAISE EXCEPTION 'warnings are recorded when the prescription is signed' USING ERRCODE = '55000', HINT = 'prescription_signed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER prescription_item_guard BEFORE UPDATE OR DELETE ON pharmacy.prescription_item
  FOR EACH ROW EXECUTE FUNCTION pharmacy.prescription_item_guard();

-- ---------------------------------------------------------------------------
-- patient_indent: a nurse asks the pharmacy for an admitted patient's medicines or consumables.
-- ---------------------------------------------------------------------------
CREATE TABLE pharmacy.patient_indent (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id         uuid NOT NULL REFERENCES platform.tenant (id),
  indent_no         text NOT NULL,
  admission_id      uuid NOT NULL,
  encounter_id      uuid NOT NULL,
  patient_id        uuid NOT NULL,
  facility_id       uuid NOT NULL,
  pharmacy_store_id uuid NOT NULL,
  requested_at      timestamptz NOT NULL DEFAULT now(),
  requested_by      uuid NOT NULL,
  notes             text CHECK (length(notes) <= 1000),
  status            text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'partially_dispensed', 'dispensed', 'cancelled')),
  cancel_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid,
  version           integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, indent_no),
  FOREIGN KEY (tenant_id, admission_id, patient_id) REFERENCES inpatient.admission (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, pharmacy_store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, requested_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((status = 'cancelled') = (cancel_reason IS NOT NULL))
);
CREATE INDEX ON pharmacy.patient_indent (tenant_id, admission_id, patient_id);
CREATE INDEX ON pharmacy.patient_indent (tenant_id, encounter_id, patient_id);
CREATE INDEX ON pharmacy.patient_indent (tenant_id, patient_id);
CREATE INDEX ON pharmacy.patient_indent (tenant_id, pharmacy_store_id, status);
CREATE INDEX ON pharmacy.patient_indent (tenant_id, requested_by);
SELECT platform.setup_tenant_table('pharmacy.patient_indent', 'mod_pharmacy');

CREATE FUNCTION pharmacy.patient_indent_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
       ('submitted', 'partially_dispensed'), ('submitted', 'dispensed'), ('submitted', 'cancelled'),
       ('partially_dispensed', 'dispensed'), ('partially_dispensed', 'cancelled')) THEN
    RAISE EXCEPTION 'patient indent cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000', HINT = 'invalid_state';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER patient_indent_transition_guard BEFORE UPDATE OF status ON pharmacy.patient_indent
  FOR EACH ROW EXECUTE FUNCTION pharmacy.patient_indent_transition_guard();

CREATE TABLE pharmacy.patient_indent_line (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  patient_indent_id    uuid NOT NULL,
  prescription_item_id uuid,                     -- NULL for consumables
  item_id              uuid NOT NULL,
  qty_requested        numeric(14, 3) NOT NULL CHECK (qty_requested > 0),
  qty_dispensed        numeric(14, 3) NOT NULL DEFAULT 0 CHECK (qty_dispensed >= 0),
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  version              integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_indent_id) REFERENCES pharmacy.patient_indent (tenant_id, id),
  FOREIGN KEY (tenant_id, prescription_item_id) REFERENCES pharmacy.prescription_item (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, id),
  CONSTRAINT patient_indent_line_dispensed_check CHECK (qty_dispensed <= qty_requested)
);
CREATE INDEX ON pharmacy.patient_indent_line (tenant_id, patient_indent_id);
CREATE INDEX ON pharmacy.patient_indent_line (tenant_id, prescription_item_id);
CREATE INDEX ON pharmacy.patient_indent_line (tenant_id, item_id);
SELECT platform.setup_tenant_table('pharmacy.patient_indent_line', 'mod_pharmacy');

-- ---------------------------------------------------------------------------
-- dispense / dispense_line: what left the pharmacy, from which batch, at what price. The MRP is
-- snapshotted per line and the selling price may not exceed it (Drugs Price Control Order).
-- ---------------------------------------------------------------------------
CREATE TABLE pharmacy.dispense (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id         uuid NOT NULL REFERENCES platform.tenant (id),
  dispense_no       text NOT NULL,
  dispense_type     text NOT NULL CHECK (dispense_type IN ('prescription', 'ipd_indent', 'otc')),
  prescription_id   uuid,
  patient_indent_id uuid,
  patient_id        uuid,
  encounter_id      uuid,
  buyer_name        text CHECK (length(buyer_name) BETWEEN 1 AND 200),
  buyer_phone       text CHECK (length(buyer_phone) BETWEEN 6 AND 20),
  facility_id       uuid NOT NULL,
  store_id          uuid NOT NULL,
  dispensed_at      timestamptz NOT NULL DEFAULT now(),
  dispensed_by      uuid NOT NULL,
  handed_over_to    text CHECK (length(handed_over_to) <= 200),
  status            text NOT NULL DEFAULT 'dispensed' CHECK (status IN ('dispensed', 'partially_returned', 'returned')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid,
  version           integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, dispense_no),
  FOREIGN KEY (tenant_id, prescription_id) REFERENCES pharmacy.prescription (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_indent_id) REFERENCES pharmacy.patient_indent (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id) REFERENCES clinical.encounter (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, dispensed_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (CASE dispense_type
           WHEN 'prescription' THEN prescription_id IS NOT NULL AND patient_indent_id IS NULL AND patient_id IS NOT NULL AND encounter_id IS NOT NULL
           WHEN 'ipd_indent' THEN patient_indent_id IS NOT NULL AND patient_id IS NOT NULL AND encounter_id IS NOT NULL
           WHEN 'otc' THEN prescription_id IS NULL AND patient_indent_id IS NULL AND encounter_id IS NULL AND (patient_id IS NOT NULL OR buyer_name IS NOT NULL)
         END)
);
CREATE INDEX ON pharmacy.dispense (tenant_id, prescription_id);
CREATE INDEX ON pharmacy.dispense (tenant_id, patient_indent_id);
CREATE INDEX ON pharmacy.dispense (tenant_id, patient_id);
CREATE INDEX ON pharmacy.dispense (tenant_id, encounter_id);
CREATE INDEX ON pharmacy.dispense (tenant_id, facility_id, dispensed_at);
CREATE INDEX ON pharmacy.dispense (tenant_id, store_id);
CREATE INDEX ON pharmacy.dispense (tenant_id, dispensed_by);
SELECT platform.setup_tenant_table('pharmacy.dispense', 'mod_pharmacy');

CREATE FUNCTION pharmacy.dispense_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  movable text[] := ARRAY['status', 'updated_at', 'updated_by', 'version'];
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
       ('dispensed', 'partially_returned'), ('dispensed', 'returned'), ('partially_returned', 'returned')) THEN
    RAISE EXCEPTION 'dispense cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000', HINT = 'invalid_state';
  END IF;
  IF (to_jsonb(NEW) - movable) IS DISTINCT FROM (to_jsonb(OLD) - movable) THEN
    RAISE EXCEPTION 'a dispense cannot be changed' USING ERRCODE = '55000', HINT = 'immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER dispense_guard BEFORE UPDATE ON pharmacy.dispense
  FOR EACH ROW EXECUTE FUNCTION pharmacy.dispense_guard();

CREATE TABLE pharmacy.dispense_line (
  id                       uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                uuid NOT NULL REFERENCES platform.tenant (id),
  dispense_id              uuid NOT NULL,
  prescription_item_id     uuid,
  patient_indent_line_id   uuid,
  item_id                  uuid NOT NULL,
  item_batch_id            uuid NOT NULL,
  quantity                 numeric(14, 3) NOT NULL CHECK (quantity > 0),
  returned_qty             numeric(14, 3) NOT NULL DEFAULT 0,
  mrp_snapshot_minor       bigint CHECK (mrp_snapshot_minor >= 0),
  unit_price_minor         bigint NOT NULL CHECK (unit_price_minor >= 0),
  price_list_item_id       uuid,
  substitution_approved_by uuid,
  substituted_from_item_id uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid,
  version                  integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, dispense_id) REFERENCES pharmacy.dispense (tenant_id, id),
  FOREIGN KEY (tenant_id, prescription_item_id) REFERENCES pharmacy.prescription_item (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_indent_line_id) REFERENCES pharmacy.patient_indent_line (tenant_id, id),
  FOREIGN KEY (tenant_id, item_batch_id, item_id) REFERENCES inventory.item_batch (tenant_id, id, item_id),
  FOREIGN KEY (tenant_id, price_list_item_id) REFERENCES catalog.price_list_item (tenant_id, id),
  FOREIGN KEY (tenant_id, substitution_approved_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, substituted_from_item_id) REFERENCES inventory.item (tenant_id, id),
  CONSTRAINT dispense_line_mrp_check CHECK (mrp_snapshot_minor IS NULL OR unit_price_minor <= mrp_snapshot_minor),
  CONSTRAINT dispense_line_returned_check CHECK (returned_qty >= 0 AND returned_qty <= quantity),
  CHECK ((substituted_from_item_id IS NULL) = (substitution_approved_by IS NULL)),
  CHECK (substituted_from_item_id IS DISTINCT FROM item_id)
);
CREATE INDEX ON pharmacy.dispense_line (tenant_id, dispense_id);
CREATE INDEX ON pharmacy.dispense_line (tenant_id, prescription_item_id);
CREATE INDEX ON pharmacy.dispense_line (tenant_id, patient_indent_line_id);
CREATE INDEX ON pharmacy.dispense_line (tenant_id, item_batch_id, item_id);
CREATE INDEX ON pharmacy.dispense_line (tenant_id, item_id);
CREATE INDEX ON pharmacy.dispense_line (tenant_id, price_list_item_id);
CREATE INDEX ON pharmacy.dispense_line (tenant_id, substitution_approved_by);
CREATE INDEX ON pharmacy.dispense_line (tenant_id, substituted_from_item_id);
SELECT platform.setup_tenant_table('pharmacy.dispense_line', 'mod_pharmacy');

-- Only the returned quantity of a dispense line ever changes (by returns, below).
CREATE FUNCTION pharmacy.dispense_line_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  movable text[] := ARRAY['returned_qty', 'updated_at', 'updated_by', 'version'];
BEGIN
  IF (to_jsonb(NEW) - movable) IS DISTINCT FROM (to_jsonb(OLD) - movable) OR NEW.returned_qty < OLD.returned_qty THEN
    RAISE EXCEPTION 'a dispense line cannot be changed' USING ERRCODE = '55000', HINT = 'immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER dispense_line_guard BEFORE UPDATE ON pharmacy.dispense_line
  FOR EACH ROW EXECUTE FUNCTION pharmacy.dispense_line_guard();

-- ---------------------------------------------------------------------------
-- medication_administration (MAR): append-only. A scheduled dose is charted as given once; PRN doses are
-- spaced by the line's minimum interval (checked by the command under the line's lock). Controlled and
-- high-alert drugs need a second person as witness (requires_witness is set from the drug profile).
-- ---------------------------------------------------------------------------
CREATE TABLE pharmacy.medication_administration (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  prescription_item_id uuid NOT NULL,
  patient_id           uuid NOT NULL,
  encounter_id         uuid NOT NULL,
  dispense_line_id     uuid,
  scheduled_at         timestamptz,
  administered_at      timestamptz,
  recorded_at          timestamptz NOT NULL DEFAULT now(),
  dose_given           numeric(12, 3) CHECK (dose_given > 0),
  dose_unit            text CHECK (length(dose_unit) <= 20),
  route                text CHECK (route IN ('oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'sublingual', 'rectal',
                                             'ophthalmic', 'otic', 'nasal', 'vaginal', 'other')),
  site                 text CHECK (length(site) <= 100),
  status               text NOT NULL CHECK (status IN ('given', 'not_given', 'held', 'refused', 'self_administered')),
  reason               text CHECK (length(reason) <= 500),
  is_prn               boolean NOT NULL DEFAULT false,
  prn_reason           text CHECK (length(prn_reason) <= 500),
  administered_by      uuid NOT NULL,
  requires_witness     boolean NOT NULL DEFAULT false,
  witness_staff_id     uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, prescription_item_id) REFERENCES pharmacy.prescription_item (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id, patient_id) REFERENCES clinical.encounter (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, dispense_line_id) REFERENCES pharmacy.dispense_line (tenant_id, id),
  FOREIGN KEY (tenant_id, administered_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, witness_staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK ((status IN ('given', 'self_administered')) = (administered_at IS NOT NULL)),
  CHECK (status IN ('given', 'self_administered') OR coalesce(btrim(reason), '') <> ''),
  CHECK (status <> 'given' OR (dose_given IS NOT NULL AND dose_unit IS NOT NULL)),
  CHECK (is_prn OR scheduled_at IS NOT NULL),
  CHECK (NOT is_prn OR status <> 'given' OR coalesce(btrim(prn_reason), '') <> ''),
  CONSTRAINT medication_administration_witness_check
    CHECK (NOT requires_witness OR status <> 'given' OR witness_staff_id IS NOT NULL),
  CHECK (witness_staff_id IS DISTINCT FROM administered_by)
);
CREATE UNIQUE INDEX medication_administration_once ON pharmacy.medication_administration (tenant_id, prescription_item_id, scheduled_at)
  WHERE status = 'given' AND NOT is_prn;
CREATE INDEX ON pharmacy.medication_administration (tenant_id, prescription_item_id, administered_at);
CREATE INDEX ON pharmacy.medication_administration (tenant_id, patient_id);
CREATE INDEX ON pharmacy.medication_administration (tenant_id, encounter_id, patient_id);
CREATE INDEX ON pharmacy.medication_administration (tenant_id, dispense_line_id);
CREATE INDEX ON pharmacy.medication_administration (tenant_id, administered_by);
CREATE INDEX ON pharmacy.medication_administration (tenant_id, witness_staff_id);
SELECT platform.apply_tenant_rls('pharmacy.medication_administration');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON pharmacy.medication_administration
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON pharmacy.medication_administration TO mod_pharmacy;

-- medication_return: append-only. A restockable return puts the units back on the shelf (a patient_return
-- movement); taking the charge back is billing's job (event dispense.returned).
CREATE TABLE pharmacy.medication_return (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  dispense_line_id uuid NOT NULL,
  patient_id       uuid,
  store_id         uuid NOT NULL,
  quantity         numeric(14, 3) NOT NULL CHECK (quantity > 0),
  reason           text NOT NULL CHECK (btrim(reason) <> '' AND length(reason) <= 500),
  is_restockable   boolean NOT NULL,
  received_by      uuid NOT NULL,
  received_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, dispense_line_id) REFERENCES pharmacy.dispense_line (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, received_by) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON pharmacy.medication_return (tenant_id, dispense_line_id);
CREATE INDEX ON pharmacy.medication_return (tenant_id, patient_id);
CREATE INDEX ON pharmacy.medication_return (tenant_id, store_id, received_at);
CREATE INDEX ON pharmacy.medication_return (tenant_id, received_by);
SELECT platform.apply_tenant_rls('pharmacy.medication_return');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON pharmacy.medication_return
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON pharmacy.medication_return TO mod_pharmacy;

-- ---------------------------------------------------------------------------
-- The ledger links inventory left open, and the pharmacy's way into it. Each dispense line / return
-- posts at most one movement (unique indexes in inventory), and the movement must match it.
-- ---------------------------------------------------------------------------
ALTER TABLE inventory.stock_movement
  ADD CONSTRAINT stock_movement_dispense_line_fk FOREIGN KEY (tenant_id, dispense_line_id) REFERENCES pharmacy.dispense_line (tenant_id, id),
  ADD CONSTRAINT stock_movement_medication_return_fk FOREIGN KEY (tenant_id, medication_return_id) REFERENCES pharmacy.medication_return (tenant_id, id);

CREATE FUNCTION inventory.post_patient_movement(
  p_store_id uuid, p_item_batch_id uuid, p_quantity numeric, p_patient_id uuid, p_actor_staff_id uuid,
  p_dispense_line_id uuid, p_medication_return_id uuid, p_occurred_at timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, inventory AS $$
DECLARE
  t uuid := platform.current_tenant_id();
  b record;
  src record;
  moved uuid;
BEGIN
  IF t IS NULL THEN RAISE EXCEPTION 'no tenant in context' USING ERRCODE = '42501'; END IF;
  IF num_nonnulls(p_dispense_line_id, p_medication_return_id) <> 1 OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'post one positive quantity for one dispense line or one medication return' USING ERRCODE = '22023';
  END IF;
  IF p_dispense_line_id IS NOT NULL THEN
    SELECT d.store_id, l.item_batch_id, l.quantity, d.patient_id INTO src
    FROM pharmacy.dispense_line l JOIN pharmacy.dispense d ON d.tenant_id = l.tenant_id AND d.id = l.dispense_id
    WHERE l.tenant_id = t AND l.id = p_dispense_line_id;
  ELSE
    SELECT r.store_id, l.item_batch_id, r.quantity, r.patient_id INTO src
    FROM pharmacy.medication_return r JOIN pharmacy.dispense_line l ON l.tenant_id = r.tenant_id AND l.id = r.dispense_line_id
    WHERE r.tenant_id = t AND r.id = p_medication_return_id;
  END IF;
  IF NOT FOUND OR (src.store_id, src.item_batch_id, src.quantity) IS DISTINCT FROM (p_store_id, p_item_batch_id, p_quantity)
     OR src.patient_id IS DISTINCT FROM p_patient_id THEN
    RAISE EXCEPTION 'the movement does not match its dispense line or return' USING ERRCODE = '22023';
  END IF;
  SELECT item_id, unit_cost_minor INTO b FROM inventory.item_batch WHERE tenant_id = t AND id = p_item_batch_id;
  INSERT INTO inventory.stock_movement (tenant_id, store_id, item_id, item_batch_id, movement_type, quantity, unit_cost_minor,
                                        occurred_at, actor_staff_id, patient_id, dispense_line_id, medication_return_id)
  VALUES (t, p_store_id, b.item_id, p_item_batch_id,
          CASE WHEN p_dispense_line_id IS NOT NULL THEN 'issue_to_patient' ELSE 'patient_return' END,
          CASE WHEN p_dispense_line_id IS NOT NULL THEN -p_quantity ELSE p_quantity END,
          b.unit_cost_minor, p_occurred_at, p_actor_staff_id, p_patient_id, p_dispense_line_id, p_medication_return_id)
  RETURNING id INTO moved;
  RETURN moved;
END $$;
REVOKE EXECUTE ON FUNCTION inventory.post_patient_movement(uuid, uuid, numeric, uuid, uuid, uuid, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventory.post_patient_movement(uuid, uuid, numeric, uuid, uuid, uuid, uuid, timestamptz) TO mod_pharmacy;

-- Links from other modules that waited for pharmacy.
ALTER TABLE billing.charge ADD CONSTRAINT charge_dispense_line_fk FOREIGN KEY (tenant_id, dispense_line_id) REFERENCES pharmacy.dispense_line (tenant_id, id);
ALTER TABLE inpatient.discharge ADD CONSTRAINT discharge_prescription_fk FOREIGN KEY (tenant_id, discharge_prescription_id) REFERENCES pharmacy.prescription (tenant_id, id);
CREATE INDEX discharge_prescription ON inpatient.discharge (tenant_id, discharge_prescription_id);

-- ---------------------------------------------------------------------------
-- Statutory register (Drugs and Cosmetics Rules: Schedule H1 / X, NDPS): who got which controlled drug,
-- on whose prescription, from which batch. A view, so it can't drift from what was dispensed.
-- ---------------------------------------------------------------------------
CREATE VIEW pharmacy.controlled_drug_register WITH (security_invoker = true) AS
SELECT l.tenant_id, d.facility_id, d.store_id, d.id AS dispense_id, d.dispense_no, d.dispensed_at,
       d.patient_id, p.mrn, concat_ws(' ', p.given_name, p.family_name) AS patient_name,
       rx.prescriber_staff_id, ps.display_name AS prescriber_name,
       dp.generic_name, i.name AS item_name, dp.regulatory_schedule, dp.is_ndps,
       ib.batch_no, l.quantity, l.returned_qty, d.dispensed_by
FROM pharmacy.dispense_line l
JOIN pharmacy.dispense d ON d.tenant_id = l.tenant_id AND d.id = l.dispense_id
JOIN inventory.drug_product dp ON dp.tenant_id = l.tenant_id AND dp.item_id = l.item_id
JOIN inventory.item i ON i.tenant_id = l.tenant_id AND i.id = l.item_id
JOIN inventory.item_batch ib ON ib.tenant_id = l.tenant_id AND ib.id = l.item_batch_id
LEFT JOIN patient.patient p ON p.tenant_id = d.tenant_id AND p.id = d.patient_id
LEFT JOIN pharmacy.prescription_item pi ON pi.tenant_id = l.tenant_id AND pi.id = l.prescription_item_id
LEFT JOIN pharmacy.prescription rx ON rx.tenant_id = pi.tenant_id AND rx.id = pi.prescription_id
LEFT JOIN platform.staff ps ON ps.tenant_id = rx.tenant_id AND ps.id = rx.prescriber_staff_id
WHERE dp.regulatory_schedule IN ('H1', 'X') OR dp.is_ndps;

-- migrate:down
DROP VIEW pharmacy.controlled_drug_register;
DROP INDEX inpatient.discharge_prescription;
ALTER TABLE inpatient.discharge DROP CONSTRAINT discharge_prescription_fk;
ALTER TABLE billing.charge DROP CONSTRAINT charge_dispense_line_fk;
DROP FUNCTION inventory.post_patient_movement(uuid, uuid, numeric, uuid, uuid, uuid, uuid, timestamptz);
ALTER TABLE inventory.stock_movement DROP CONSTRAINT stock_movement_dispense_line_fk, DROP CONSTRAINT stock_movement_medication_return_fk;
DROP SCHEMA pharmacy CASCADE;
REVOKE INSERT ON platform.audit_event, platform.outbox_event, platform.inbox_record FROM mod_pharmacy;
REVOKE INSERT, UPDATE ON platform.number_series, platform.idempotency_record FROM mod_pharmacy;
