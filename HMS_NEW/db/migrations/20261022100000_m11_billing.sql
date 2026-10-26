-- migrate:up
-- M11 billing, clinic scope (ERD m11-billing, trimmed): charges, invoices, credit notes, cashier shifts,
-- payments, allocations, receipts and refunds. Money is bigint paise. Charges point back at what caused
-- them with a unique key, so a redelivered event never charges twice; a charge is reversed (status), never
-- re-priced, once it is on an issued invoice — corrections after issue are credit notes. Invoice numbers
-- are taken from platform.number_series when the invoice is issued (drafts don't burn numbers; GST needs
-- consecutive numbers per facility per financial year). Inpatient accounts, deposits and bed-day charges
-- come with the inpatient module (m11_billing_ipd).
-- Links to modules that don't exist yet (pharmacy dispense lines, inventory items, inpatient admissions
-- and bed occupancies, billing accounts) are plain uuids; they get their FKs in those modules' migrations.

-- ---------------------------------------------------------------------------
-- Module setup: schema `billing`, write role mod_billing
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mod_billing') THEN
    CREATE ROLE mod_billing NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT hms_reader TO mod_billing;
GRANT mod_billing TO hms_app WITH INHERIT FALSE, SET TRUE;

CREATE SCHEMA billing;
GRANT USAGE ON SCHEMA billing TO hms_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA billing GRANT SELECT ON TABLES TO hms_reader;

GRANT INSERT ON platform.audit_event, platform.outbox_event, platform.inbox_record TO mod_billing;
GRANT INSERT, UPDATE ON platform.number_series, platform.idempotency_record TO mod_billing;

-- ---------------------------------------------------------------------------
-- cashier_shift: a counter session. Cash is only taken inside an open shift; closing counts the drawer.
-- ---------------------------------------------------------------------------
CREATE TABLE billing.cashier_shift (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id          uuid NOT NULL,
  staff_id             uuid NOT NULL,
  opened_at            timestamptz NOT NULL DEFAULT now(),
  opening_float_minor  bigint NOT NULL DEFAULT 0 CHECK (opening_float_minor >= 0),
  closed_at            timestamptz,
  expected_cash_minor  bigint CHECK (expected_cash_minor >= 0),
  counted_cash_minor   bigint CHECK (counted_cash_minor >= 0),
  variance_minor       bigint GENERATED ALWAYS AS (counted_cash_minor - expected_cash_minor) STORED,
  close_note           text,
  status               text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'verified')),
  verified_by          uuid,
  verified_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  version              integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, verified_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((status = 'open') = (closed_at IS NULL)),
  CHECK (status = 'open' OR (expected_cash_minor IS NOT NULL AND counted_cash_minor IS NOT NULL)),
  CHECK ((status = 'verified') = (verified_at IS NOT NULL AND verified_by IS NOT NULL)),
  CHECK (closed_at IS NULL OR closed_at >= opened_at)
);
CREATE UNIQUE INDEX cashier_shift_one_open ON billing.cashier_shift (tenant_id, facility_id, staff_id) WHERE status = 'open';
CREATE INDEX ON billing.cashier_shift (tenant_id, facility_id, opened_at);
CREATE INDEX ON billing.cashier_shift (tenant_id, staff_id);
CREATE INDEX ON billing.cashier_shift (tenant_id, verified_by);
SELECT platform.setup_tenant_table('billing.cashier_shift', 'mod_billing');

-- ---------------------------------------------------------------------------
-- charge: one billable thing that happened. Priced and taxed when posted (snapshots), so later price or
-- tax changes never move it. patient_id may be NULL only for an over-the-counter pharmacy sale.
-- ---------------------------------------------------------------------------
CREATE TABLE billing.charge (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id          uuid NOT NULL,
  patient_id           uuid,
  encounter_id         uuid,
  billing_account_id   uuid,                 -- inpatient episode account (m11_billing_ipd)
  source_type          text NOT NULL CHECK (source_type IN ('consultation', 'dispense_line', 'bed_day', 'procedure', 'manual')),
  source_id            uuid,                 -- the record that caused the charge; NULL for manual charges
  appointment_id       uuid,
  dispense_line_id     uuid,                 -- FK added by the pharmacy module
  bed_occupancy_id     uuid,                 -- FK added by the inpatient module
  service_date         date NOT NULL,
  service_item_id      uuid,
  item_id              uuid,                 -- FK added by the inventory module
  price_list_item_id   uuid,
  description          text NOT NULL CHECK (length(description) BETWEEN 1 AND 300),
  hsn_sac_code         text CHECK (hsn_sac_code ~ '^[0-9]{4,8}$'),
  quantity             numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_price_minor     bigint NOT NULL CHECK (unit_price_minor >= 0),
  gross_minor          bigint NOT NULL CHECK (gross_minor >= 0),
  discount_minor       bigint NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  taxable_minor        bigint NOT NULL CHECK (taxable_minor >= 0),
  tax_rule_id          uuid,
  is_tax_exempt        boolean NOT NULL,
  is_tax_inclusive     boolean NOT NULL DEFAULT false,   -- MRP-priced medicines: the price already includes GST
  gst_rate_bp          integer NOT NULL DEFAULT 0 CHECK (gst_rate_bp BETWEEN 0 AND 10000),
  cgst_minor           bigint NOT NULL DEFAULT 0 CHECK (cgst_minor >= 0),
  sgst_minor           bigint NOT NULL DEFAULT 0 CHECK (sgst_minor >= 0),
  igst_minor           bigint NOT NULL DEFAULT 0 CHECK (igst_minor >= 0),
  net_minor            bigint NOT NULL CHECK (net_minor >= 0),
  currency             char(3) NOT NULL DEFAULT 'INR',
  status               text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'invoiced', 'reversed')),
  posted_at            timestamptz NOT NULL DEFAULT now(),
  posted_by            uuid,
  reversed_at          timestamptz,
  reversed_by          uuid,
  reverse_reason       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  version              integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id) REFERENCES clinical.encounter (tenant_id, id),
  FOREIGN KEY (tenant_id, appointment_id) REFERENCES booking.appointment (tenant_id, id),
  FOREIGN KEY (tenant_id, service_item_id) REFERENCES catalog.service_item (tenant_id, id),
  FOREIGN KEY (tenant_id, price_list_item_id) REFERENCES catalog.price_list_item (tenant_id, id),
  FOREIGN KEY (tax_rule_id) REFERENCES catalog.tax_rule (id),
  FOREIGN KEY (tenant_id, posted_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, reversed_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (patient_id IS NOT NULL OR source_type = 'dispense_line'),
  CHECK ((source_type = 'manual') = (source_id IS NULL)),
  CHECK (source_type <> 'consultation' OR (appointment_id IS NOT NULL AND source_id = appointment_id)),
  CHECK (source_type <> 'dispense_line' OR (dispense_line_id IS NOT NULL AND source_id = dispense_line_id)),
  CHECK (source_type <> 'bed_day' OR (bed_occupancy_id IS NOT NULL AND source_id = bed_occupancy_id)),
  CHECK (num_nonnulls(service_item_id, item_id) <= 1),
  CHECK (discount_minor <= gross_minor),
  CHECK (taxable_minor = gross_minor - discount_minor),
  CHECK (net_minor = taxable_minor + cgst_minor + sgst_minor + igst_minor),
  CHECK (igst_minor = 0 OR (cgst_minor = 0 AND sgst_minor = 0)),
  CHECK (NOT is_tax_exempt OR (gst_rate_bp = 0 AND cgst_minor = 0 AND sgst_minor = 0 AND igst_minor = 0)),
  CHECK ((status = 'reversed') = (reversed_at IS NOT NULL AND reverse_reason IS NOT NULL))
);
-- A source is charged once per service date (bed days: one charge per occupancy per day).
CREATE UNIQUE INDEX charge_once_per_source ON billing.charge (tenant_id, source_type, source_id, service_date)
  WHERE status <> 'reversed' AND source_id IS NOT NULL;
CREATE INDEX ON billing.charge (tenant_id, facility_id, status, service_date);
CREATE INDEX ON billing.charge (tenant_id, patient_id, status);
CREATE INDEX ON billing.charge (tenant_id, encounter_id);
CREATE INDEX ON billing.charge (tenant_id, billing_account_id);
CREATE INDEX ON billing.charge (tenant_id, appointment_id);
CREATE INDEX ON billing.charge (tenant_id, dispense_line_id);
CREATE INDEX ON billing.charge (tenant_id, bed_occupancy_id);
CREATE INDEX ON billing.charge (tenant_id, service_item_id);
CREATE INDEX ON billing.charge (tenant_id, item_id);
CREATE INDEX ON billing.charge (tenant_id, price_list_item_id);
CREATE INDEX ON billing.charge (tax_rule_id);
CREATE INDEX ON billing.charge (tenant_id, posted_by);
CREATE INDEX ON billing.charge (tenant_id, reversed_by);
SELECT platform.setup_tenant_table('billing.charge', 'mod_billing');

-- An invoiced charge's money is fixed: only reversal (by credit note) may still change its status.
CREATE FUNCTION billing.charge_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'posted' AND (NEW.quantity, NEW.unit_price_minor, NEW.gross_minor, NEW.discount_minor, NEW.taxable_minor,
                                 NEW.cgst_minor, NEW.sgst_minor, NEW.igst_minor, NEW.net_minor)
                            IS DISTINCT FROM (OLD.quantity, OLD.unit_price_minor, OLD.gross_minor, OLD.discount_minor, OLD.taxable_minor,
                                 OLD.cgst_minor, OLD.sgst_minor, OLD.igst_minor, OLD.net_minor) THEN
    RAISE EXCEPTION 'charge is %; its amounts can no longer change', OLD.status USING ERRCODE = '55000';
  END IF;
  IF OLD.status = 'reversed' AND NEW.status <> 'reversed' THEN
    RAISE EXCEPTION 'a reversed charge stays reversed' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER charge_guard BEFORE UPDATE ON billing.charge FOR EACH ROW EXECUTE FUNCTION billing.charge_guard();

-- ---------------------------------------------------------------------------
-- charge_adjustment: a discount on a not-yet-invoiced charge. Above the requester's role limit
-- (role.settings.max_discount_percent) it waits for someone with billing.approve.
-- ---------------------------------------------------------------------------
CREATE TABLE billing.charge_adjustment (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenant (id),
  charge_id       uuid NOT NULL,
  kind            text NOT NULL DEFAULT 'discount' CHECK (kind IN ('discount')),
  amount_minor    bigint NOT NULL CHECK (amount_minor > 0),
  reason          text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by    uuid,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  decided_by      uuid,
  decided_at      timestamptz,
  decision_note   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, charge_id) REFERENCES billing.charge (tenant_id, id),
  FOREIGN KEY (tenant_id, requested_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, decided_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((status IN ('pending', 'cancelled')) = (decided_at IS NULL))
);
CREATE UNIQUE INDEX charge_adjustment_one_pending ON billing.charge_adjustment (tenant_id, charge_id) WHERE status = 'pending';
CREATE INDEX ON billing.charge_adjustment (tenant_id, charge_id);
CREATE INDEX ON billing.charge_adjustment (tenant_id, status);
CREATE INDEX ON billing.charge_adjustment (tenant_id, requested_by);
CREATE INDEX ON billing.charge_adjustment (tenant_id, decided_by);
SELECT platform.setup_tenant_table('billing.charge_adjustment', 'mod_billing');

-- ---------------------------------------------------------------------------
-- invoice: a bill. Drafts are freely rebuilt; issuing assigns the number, fixes the document type and
-- totals and freezes the lines. After issue only the paid/credited totals and status move.
-- document_type: medicines are taxable (tax invoice), clinical services are GST-exempt (bill of supply);
-- a bill with both is an invoice-cum-bill of supply.
-- ---------------------------------------------------------------------------
CREATE TABLE billing.invoice (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id          uuid NOT NULL,
  patient_id           uuid,
  billing_account_id   uuid,
  bill_kind            text NOT NULL CHECK (bill_kind IN ('opd', 'pharmacy', 'ipd_final')),
  bill_to_name         text NOT NULL CHECK (length(bill_to_name) BETWEEN 1 AND 200),
  bill_to_phone        text,
  invoice_no           text,
  document_type        text CHECK (document_type IN ('tax_invoice', 'bill_of_supply', 'invoice_cum_bill_of_supply')),
  financial_year       text CHECK (financial_year ~ '^[0-9]{4}-[0-9]{2}$'),
  facility_gstin       text,                 -- snapshot at issue
  place_of_supply      char(2),              -- state code snapshot at issue
  gross_minor          bigint NOT NULL DEFAULT 0 CHECK (gross_minor >= 0),
  discount_minor       bigint NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  taxable_minor        bigint NOT NULL DEFAULT 0 CHECK (taxable_minor >= 0),
  cgst_minor           bigint NOT NULL DEFAULT 0 CHECK (cgst_minor >= 0),
  sgst_minor           bigint NOT NULL DEFAULT 0 CHECK (sgst_minor >= 0),
  igst_minor           bigint NOT NULL DEFAULT 0 CHECK (igst_minor >= 0),
  round_off_minor      bigint NOT NULL DEFAULT 0 CHECK (round_off_minor BETWEEN -99 AND 99),
  net_minor            bigint NOT NULL DEFAULT 0 CHECK (net_minor >= 0),
  paid_minor           bigint NOT NULL DEFAULT 0 CHECK (paid_minor >= 0),
  credited_minor       bigint NOT NULL DEFAULT 0 CHECK (credited_minor >= 0),
  currency             char(3) NOT NULL DEFAULT 'INR',
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'void', 'credited')),
  issued_at            timestamptz,
  issued_by            uuid,
  voided_at            timestamptz,
  void_reason          text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  version              integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, invoice_no),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, issued_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (patient_id IS NOT NULL OR bill_kind = 'pharmacy'),
  CHECK (bill_kind <> 'ipd_final' OR billing_account_id IS NOT NULL),
  -- a number exactly when issued (a voided draft never had one)
  CHECK ((invoice_no IS NULL) = (issued_at IS NULL)),
  CHECK (status IN ('draft', 'void') OR issued_at IS NOT NULL),
  CHECK (issued_at IS NULL OR (document_type IS NOT NULL AND financial_year IS NOT NULL AND place_of_supply IS NOT NULL)),
  CHECK ((status = 'void') = (voided_at IS NOT NULL AND void_reason IS NOT NULL)),
  CHECK (taxable_minor = gross_minor - discount_minor),
  CHECK (net_minor = taxable_minor + cgst_minor + sgst_minor + igst_minor + round_off_minor),
  CHECK (paid_minor + credited_minor <= net_minor),
  CHECK (status <> 'paid' OR paid_minor + credited_minor = net_minor)
);
CREATE INDEX ON billing.invoice (tenant_id, facility_id, status, issued_at);
CREATE INDEX ON billing.invoice (tenant_id, patient_id);
CREATE INDEX ON billing.invoice (tenant_id, billing_account_id);
CREATE INDEX ON billing.invoice (tenant_id, issued_by);
SELECT platform.setup_tenant_table('billing.invoice', 'mod_billing');

-- Issued invoices are immutable apart from settlement.
CREATE FUNCTION billing.invoice_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status NOT IN ('draft') AND (
       NEW.invoice_no, NEW.document_type, NEW.financial_year, NEW.facility_id, NEW.patient_id, NEW.bill_to_name, NEW.bill_to_phone,
       NEW.gross_minor, NEW.discount_minor, NEW.taxable_minor, NEW.cgst_minor, NEW.sgst_minor, NEW.igst_minor, NEW.round_off_minor,
       NEW.net_minor, NEW.issued_at, NEW.facility_gstin, NEW.place_of_supply)
     IS DISTINCT FROM (
       OLD.invoice_no, OLD.document_type, OLD.financial_year, OLD.facility_id, OLD.patient_id, OLD.bill_to_name, OLD.bill_to_phone,
       OLD.gross_minor, OLD.discount_minor, OLD.taxable_minor, OLD.cgst_minor, OLD.sgst_minor, OLD.igst_minor, OLD.round_off_minor,
       OLD.net_minor, OLD.issued_at, OLD.facility_gstin, OLD.place_of_supply) THEN
    RAISE EXCEPTION 'invoice is %; it can no longer be edited', OLD.status USING ERRCODE = '55000';
  END IF;
  IF OLD.status IN ('void', 'credited') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'invoice is %; its status is final', OLD.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoice_guard BEFORE UPDATE ON billing.invoice FOR EACH ROW EXECUTE FUNCTION billing.invoice_guard();

-- ---------------------------------------------------------------------------
-- invoice_line: a charge on an invoice. A charge is on at most one live invoice; voiding a draft or
-- issued-but-unpaid invoice releases its lines so the charges can be billed again.
-- ---------------------------------------------------------------------------
CREATE TABLE billing.invoice_line (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  invoice_id       uuid NOT NULL,
  charge_id        uuid NOT NULL,
  line_no          smallint NOT NULL CHECK (line_no > 0),
  share            text NOT NULL DEFAULT 'patient' CHECK (share IN ('patient')),   -- payer shares come with insurance
  amount_minor     bigint NOT NULL CHECK (amount_minor >= 0),
  released_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, invoice_id, line_no),
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES billing.invoice (tenant_id, id),
  FOREIGN KEY (tenant_id, charge_id) REFERENCES billing.charge (tenant_id, id)
);
CREATE UNIQUE INDEX invoice_line_one_live_invoice ON billing.invoice_line (tenant_id, charge_id) WHERE released_at IS NULL;
CREATE INDEX ON billing.invoice_line (tenant_id, invoice_id);
CREATE INDEX ON billing.invoice_line (tenant_id, charge_id);
SELECT platform.setup_tenant_table('billing.invoice_line', 'mod_billing');
-- Draft lines are rebuilt by deleting them.
GRANT DELETE ON billing.invoice_line TO mod_billing;

CREATE FUNCTION billing.invoice_line_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  inv_status text;
BEGIN
  SELECT i.status INTO inv_status FROM billing.invoice i
  WHERE i.tenant_id = coalesce(NEW.tenant_id, OLD.tenant_id) AND i.id = coalesce(NEW.invoice_id, OLD.invoice_id);
  IF TG_OP = 'UPDATE' AND NEW.released_at IS NOT NULL AND OLD.released_at IS NULL
     AND (NEW.invoice_id, NEW.charge_id, NEW.amount_minor, NEW.line_no) IS NOT DISTINCT FROM (OLD.invoice_id, OLD.charge_id, OLD.amount_minor, OLD.line_no) THEN
    RETURN NEW;                                                            -- releasing on void
  END IF;
  IF inv_status <> 'draft' THEN
    RAISE EXCEPTION 'invoice is %; its lines can no longer change', inv_status USING ERRCODE = '55000';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER invoice_line_guard BEFORE INSERT OR UPDATE OR DELETE ON billing.invoice_line
  FOR EACH ROW EXECUTE FUNCTION billing.invoice_line_guard();

-- ---------------------------------------------------------------------------
-- credit_note / credit_note_line: money taken back off an issued invoice (whole or per charge), with the
-- tax reversed in the same proportions. Numbered from the credit_note series.
-- ---------------------------------------------------------------------------
CREATE TABLE billing.credit_note (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id      uuid NOT NULL,
  invoice_id       uuid NOT NULL,
  note_no          text NOT NULL,
  financial_year   text NOT NULL CHECK (financial_year ~ '^[0-9]{4}-[0-9]{2}$'),
  reason           text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  taxable_minor    bigint NOT NULL CHECK (taxable_minor >= 0),
  cgst_minor       bigint NOT NULL DEFAULT 0 CHECK (cgst_minor >= 0),
  sgst_minor       bigint NOT NULL DEFAULT 0 CHECK (sgst_minor >= 0),
  igst_minor       bigint NOT NULL DEFAULT 0 CHECK (igst_minor >= 0),
  amount_minor     bigint NOT NULL CHECK (amount_minor > 0),
  issued_at        timestamptz NOT NULL DEFAULT now(),
  approved_by      uuid NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, note_no),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES billing.invoice (tenant_id, id),
  FOREIGN KEY (tenant_id, approved_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (amount_minor = taxable_minor + cgst_minor + sgst_minor + igst_minor)
);
CREATE INDEX ON billing.credit_note (tenant_id, invoice_id);
CREATE INDEX ON billing.credit_note (tenant_id, approved_by);
SELECT platform.setup_tenant_table('billing.credit_note', 'mod_billing');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON billing.credit_note
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();

CREATE TABLE billing.credit_note_line (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  credit_note_id   uuid NOT NULL,
  charge_id        uuid NOT NULL,
  taxable_minor    bigint NOT NULL CHECK (taxable_minor >= 0),
  cgst_minor       bigint NOT NULL DEFAULT 0 CHECK (cgst_minor >= 0),
  sgst_minor       bigint NOT NULL DEFAULT 0 CHECK (sgst_minor >= 0),
  igst_minor       bigint NOT NULL DEFAULT 0 CHECK (igst_minor >= 0),
  amount_minor     bigint NOT NULL CHECK (amount_minor > 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, credit_note_id) REFERENCES billing.credit_note (tenant_id, id),
  FOREIGN KEY (tenant_id, charge_id) REFERENCES billing.charge (tenant_id, id),
  CHECK (amount_minor = taxable_minor + cgst_minor + sgst_minor + igst_minor)
);
CREATE INDEX ON billing.credit_note_line (tenant_id, credit_note_id);
CREATE INDEX ON billing.credit_note_line (tenant_id, charge_id);
SELECT platform.apply_tenant_rls('billing.credit_note_line');
GRANT INSERT ON billing.credit_note_line TO mod_billing;
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON billing.credit_note_line
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();

-- ---------------------------------------------------------------------------
-- payment: money received (recorded, no gateway). Cash needs an open cashier shift. Income Tax Act
-- s.269ST (≥ ₹2,00,000 cash from one person in a day, or for one episode) is refused by the command.
-- is_advance marks an inpatient deposit (m11_billing_ipd).
-- ---------------------------------------------------------------------------
CREATE TABLE billing.payment (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id          uuid NOT NULL,
  patient_id           uuid,
  payer_name           text NOT NULL CHECK (length(payer_name) BETWEEN 1 AND 200),
  billing_account_id   uuid,
  is_advance           boolean NOT NULL DEFAULT false,
  method               text NOT NULL CHECK (method IN ('cash', 'upi', 'card', 'net_banking', 'cheque', 'wallet')),
  amount_minor         bigint NOT NULL CHECK (amount_minor > 0),
  refunded_minor       bigint NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0),
  currency             char(3) NOT NULL DEFAULT 'INR',
  reference_no         text CHECK (length(reference_no) BETWEEN 1 AND 100),
  cashier_shift_id     uuid,
  received_by          uuid,
  captured_at          timestamptz NOT NULL DEFAULT now(),
  status               text NOT NULL DEFAULT 'captured' CHECK (status IN ('captured', 'partially_refunded', 'refunded', 'bounced')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  version              integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, cashier_shift_id) REFERENCES billing.cashier_shift (tenant_id, id),
  FOREIGN KEY (tenant_id, received_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (method <> 'cash' OR cashier_shift_id IS NOT NULL),
  CHECK (method IN ('cash') OR reference_no IS NOT NULL),
  CHECK (NOT is_advance OR billing_account_id IS NOT NULL),
  CHECK (refunded_minor <= amount_minor),
  CHECK ((status = 'refunded') = (refunded_minor = amount_minor)),
  CHECK (status <> 'partially_refunded' OR refunded_minor BETWEEN 1 AND amount_minor - 1)
);
CREATE INDEX ON billing.payment (tenant_id, facility_id, captured_at);
CREATE INDEX ON billing.payment (tenant_id, patient_id, captured_at);
CREATE INDEX ON billing.payment (tenant_id, billing_account_id);
CREATE INDEX ON billing.payment (tenant_id, cashier_shift_id);
CREATE INDEX ON billing.payment (tenant_id, received_by);
SELECT platform.setup_tenant_table('billing.payment', 'mod_billing');

-- ---------------------------------------------------------------------------
-- payment_allocation: which invoice a payment settles. The command locks both rows and keeps
-- Σ allocations ≤ payment (less refunds) and ≤ the invoice's balance.
-- ---------------------------------------------------------------------------
CREATE TABLE billing.payment_allocation (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  payment_id       uuid NOT NULL,
  invoice_id       uuid NOT NULL,
  amount_minor     bigint NOT NULL CHECK (amount_minor > 0),
  allocated_at     timestamptz NOT NULL DEFAULT now(),
  reversed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, payment_id) REFERENCES billing.payment (tenant_id, id),
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES billing.invoice (tenant_id, id)
);
CREATE INDEX ON billing.payment_allocation (tenant_id, payment_id);
CREATE INDEX ON billing.payment_allocation (tenant_id, invoice_id);
SELECT platform.setup_tenant_table('billing.payment_allocation', 'mod_billing');

-- ---------------------------------------------------------------------------
-- receipt: the numbered acknowledgement of a payment (1:1).
-- ---------------------------------------------------------------------------
CREATE TABLE billing.receipt (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id      uuid NOT NULL,
  payment_id       uuid NOT NULL,
  receipt_no       text NOT NULL,
  financial_year   text NOT NULL CHECK (financial_year ~ '^[0-9]{4}-[0-9]{2}$'),
  issued_at        timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, payment_id),
  UNIQUE (tenant_id, facility_id, receipt_no),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, payment_id) REFERENCES billing.payment (tenant_id, id)
);
SELECT platform.apply_tenant_rls('billing.receipt');
GRANT INSERT ON billing.receipt TO mod_billing;
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON billing.receipt
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();

-- ---------------------------------------------------------------------------
-- refund: money paid back against a payment (optionally for a credit note). Requested, approved by
-- someone with billing.approve, then marked paid (cash refunds from an open shift).
-- ---------------------------------------------------------------------------
CREATE TABLE billing.refund (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id      uuid NOT NULL,
  payment_id       uuid NOT NULL,
  credit_note_id   uuid,
  amount_minor     bigint NOT NULL CHECK (amount_minor > 0),
  reason           text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  method           text NOT NULL CHECK (method IN ('cash', 'upi', 'card', 'net_banking', 'cheque', 'wallet')),
  reference_no     text,
  status           text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'paid')),
  requested_by     uuid,
  requested_at     timestamptz NOT NULL DEFAULT now(),
  decided_by       uuid,
  decided_at       timestamptz,
  paid_by          uuid,
  paid_at          timestamptz,
  cashier_shift_id uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, payment_id) REFERENCES billing.payment (tenant_id, id),
  FOREIGN KEY (tenant_id, credit_note_id) REFERENCES billing.credit_note (tenant_id, id),
  FOREIGN KEY (tenant_id, requested_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, decided_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, paid_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, cashier_shift_id) REFERENCES billing.cashier_shift (tenant_id, id),
  CHECK ((status IN ('approved', 'rejected', 'paid')) = (decided_at IS NOT NULL)),
  CHECK ((status = 'paid') = (paid_at IS NOT NULL)),
  CHECK (status <> 'paid' OR method <> 'cash' OR cashier_shift_id IS NOT NULL),
  CHECK (status <> 'paid' OR method = 'cash' OR reference_no IS NOT NULL)
);
CREATE INDEX ON billing.refund (tenant_id, facility_id, status);
CREATE INDEX ON billing.refund (tenant_id, payment_id);
CREATE INDEX ON billing.refund (tenant_id, credit_note_id);
CREATE INDEX ON billing.refund (tenant_id, requested_by);
CREATE INDEX ON billing.refund (tenant_id, decided_by);
CREATE INDEX ON billing.refund (tenant_id, paid_by);
CREATE INDEX ON billing.refund (tenant_id, cashier_shift_id);
SELECT platform.setup_tenant_table('billing.refund', 'mod_billing');

-- migrate:down
DROP SCHEMA billing CASCADE;
