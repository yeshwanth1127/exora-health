-- migrate:up
-- M10 (ERD m10-inventory): items, stores, batches, an append-only stock ledger, internal supply,
-- stock counts and procurement. Stock is the sum of movements; stock_balance is a running total kept
-- by a trigger on every movement, under the balance row's lock, with on_hand >= 0 enforced by a CHECK —
-- so two concurrent issues can never take the same units. Drugs are items with a drug profile, so the
-- pharmacy (M09) and the stores share one catalogue. Quantities are in each item's base unit.
-- Movements reference the line that caused them through typed FKs (exactly one); the dispense, medication
-- return and theatre consumable FKs are added by M09 / M08. Pharmacy posts stock only through the
-- SECURITY DEFINER function at the end of this file.
-- ponytail: stock_movement is one table, not monthly partitions; partition when a tenant's ledger
-- passes a few million rows (nothing references it, so the change is local).

-- ---------------------------------------------------------------------------
-- Module setup: schema `inventory`, write role mod_inventory
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mod_inventory') THEN
    CREATE ROLE mod_inventory NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT hms_reader TO mod_inventory;
GRANT mod_inventory TO hms_app WITH INHERIT FALSE, SET TRUE;

CREATE SCHEMA inventory;
GRANT USAGE ON SCHEMA inventory TO hms_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA inventory GRANT SELECT ON TABLES TO hms_reader;

GRANT INSERT ON platform.audit_event, platform.outbox_event, platform.inbox_record TO mod_inventory;
GRANT INSERT, UPDATE ON platform.number_series, platform.idempotency_record TO mod_inventory;

ALTER TABLE platform.number_series DROP CONSTRAINT number_series_series_kind_check;
ALTER TABLE platform.number_series ADD CONSTRAINT number_series_series_kind_check CHECK (series_kind IN (
  'mrn', 'encounter', 'ip_no', 'invoice', 'bill_of_supply', 'credit_note', 'receipt', 'mlc', 'order', 'requisition',
  'dispense', 'token', 'accession', 'imaging_accession', 'po', 'grn', 'claim',
  'indent', 'transfer', 'stock_count', 'stock_adjustment', 'purchase_return'));

-- ---------------------------------------------------------------------------
-- Items: groups, items, the drug profile and pack sizes.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory.item_group (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id  uuid NOT NULL REFERENCES platform.tenant (id),
  code       text NOT NULL CHECK (code ~ '^[A-Z0-9_-]{1,30}$'),
  name       text NOT NULL CHECK (btrim(name) <> ''),
  parent_id  uuid,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  version    integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, parent_id) REFERENCES inventory.item_group (tenant_id, id),
  CHECK (parent_id <> id)
);
CREATE INDEX ON inventory.item_group (tenant_id, parent_id);
SELECT platform.setup_tenant_table('inventory.item_group', 'mod_inventory');

CREATE TABLE inventory.item (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id         uuid NOT NULL REFERENCES platform.tenant (id),
  item_group_id     uuid,
  code              text NOT NULL CHECK (code ~ '^[A-Z0-9_./-]{1,40}$'),
  name              text NOT NULL CHECK (btrim(name) <> ''),
  item_type         text NOT NULL CHECK (item_type IN ('drug', 'consumable', 'implant', 'reagent', 'vaccine', 'general')),
  base_uom          text NOT NULL CHECK (base_uom ~ '^[a-z_]{1,20}$'),   -- tablet, ml, piece, vial…
  hsn_code          text CHECK (hsn_code ~ '^[0-9]{4,8}$'),
  is_batch_tracked  boolean NOT NULL DEFAULT true,
  is_expiry_tracked boolean NOT NULL DEFAULT true,
  is_serial_tracked boolean NOT NULL DEFAULT false,
  is_cold_chain     boolean NOT NULL DEFAULT false,
  is_billable       boolean NOT NULL DEFAULT true,
  reorder_level     numeric(14, 3) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid,
  version           integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, item_group_id) REFERENCES inventory.item_group (tenant_id, id),
  -- Serial numbers live on batches (implant traceability needs the lot too).
  CHECK (NOT is_serial_tracked OR is_batch_tracked),
  CHECK (NOT is_expiry_tracked OR is_batch_tracked)
);
CREATE INDEX ON inventory.item (tenant_id, item_group_id);
CREATE INDEX item_name_trgm ON inventory.item USING gin (lower(name) gin_trgm_ops);
SELECT platform.setup_tenant_table('inventory.item', 'mod_inventory');

CREATE TABLE inventory.drug_product (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid NOT NULL REFERENCES platform.tenant (id),
  item_id             uuid NOT NULL,
  generic_name        text NOT NULL CHECK (btrim(generic_name) <> ''),
  brand_name          text,
  strength            text,
  dosage_form         text NOT NULL CHECK (dosage_form IN ('tablet', 'capsule', 'syrup', 'suspension', 'injection', 'infusion', 'ointment',
                                                          'cream', 'drops', 'inhaler', 'suppository', 'powder', 'patch', 'other')),
  default_route       text CHECK (default_route IN ('oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'sublingual', 'rectal',
                                                    'ophthalmic', 'otic', 'nasal', 'vaginal', 'other')),
  manufacturer        text,
  regulatory_schedule text NOT NULL DEFAULT 'none' CHECK (regulatory_schedule IN ('none', 'G', 'H', 'H1', 'X')),
  is_ndps             boolean NOT NULL DEFAULT false,
  is_high_alert       boolean NOT NULL DEFAULT false,
  tele_list           text CHECK (tele_list IN ('list_o', 'list_a', 'list_b', 'prohibited')),
  snomed_concept_id   uuid REFERENCES catalog.terminology_concept (id),
  is_nlem             boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid,
  version             integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, item_id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, id)
);
CREATE INDEX ON inventory.drug_product (snomed_concept_id);
CREATE INDEX drug_product_generic_trgm ON inventory.drug_product USING gin (lower(generic_name) gin_trgm_ops);
SELECT platform.setup_tenant_table('inventory.drug_product', 'mod_inventory');

CREATE TABLE inventory.item_uom (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenant (id),
  item_id         uuid NOT NULL,
  uom             text NOT NULL CHECK (uom ~ '^[a-z_]{1,20}$'),
  factor_to_base  numeric(14, 3) NOT NULL CHECK (factor_to_base > 0),
  is_purchase_uom boolean NOT NULL DEFAULT false,
  is_issue_uom    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, item_id, uom),
  FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, id)
);
SELECT platform.setup_tenant_table('inventory.item_uom', 'mod_inventory');

-- ---------------------------------------------------------------------------
-- Stores and suppliers. A store dispensing to patients needs a drug licence number.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory.store (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id               uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id             uuid NOT NULL,
  location_id             uuid,
  code                    text NOT NULL CHECK (code ~ '^[A-Z0-9_-]{1,20}$'),
  name                    text NOT NULL CHECK (btrim(name) <> ''),
  store_type              text NOT NULL CHECK (store_type IN ('central', 'pharmacy', 'ward', 'theatre', 'icu', 'lab', 'emergency')),
  parent_store_id         uuid,
  can_dispense_to_patient boolean NOT NULL DEFAULT false,
  drug_licence_no         text,
  status                  text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid,
  version                 integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, code),
  UNIQUE (tenant_id, location_id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id, location_id) REFERENCES platform.location (tenant_id, facility_id, id),
  FOREIGN KEY (tenant_id, parent_store_id) REFERENCES inventory.store (tenant_id, id),
  CHECK (parent_store_id <> id),
  CHECK (NOT can_dispense_to_patient OR coalesce(btrim(drug_licence_no), '') <> '')
);
CREATE INDEX ON inventory.store (tenant_id, facility_id, location_id);
CREATE INDEX ON inventory.store (tenant_id, parent_store_id);
SELECT platform.setup_tenant_table('inventory.store', 'mod_inventory');

CREATE TABLE inventory.store_item_setting (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  store_id     uuid NOT NULL,
  item_id      uuid NOT NULL,
  min_level    numeric(14, 3) NOT NULL DEFAULT 0 CHECK (min_level >= 0),
  max_level    numeric(14, 3) CHECK (max_level >= 0),
  reorder_qty  numeric(14, 3) CHECK (reorder_qty > 0),
  bin_location text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, store_id, item_id),
  FOREIGN KEY (tenant_id, store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, id),
  CHECK (max_level IS NULL OR max_level >= min_level)
);
CREATE INDEX ON inventory.store_item_setting (tenant_id, item_id);
SELECT platform.setup_tenant_table('inventory.store_item_setting', 'mod_inventory');

CREATE TABLE inventory.supplier (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  code               text NOT NULL CHECK (code ~ '^[A-Z0-9_-]{1,20}$'),
  name               text NOT NULL CHECK (btrim(name) <> ''),
  gstin              text CHECK (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$'),
  state_code         char(2) CHECK (state_code ~ '^[0-9]{2}$'),
  drug_licence_no    text,
  pan                text CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  phone              text CHECK (phone ~ '^\+[1-9][0-9]{6,14}$'),
  email              citext,
  address            text,
  payment_terms_days smallint NOT NULL DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 365),
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  deleted_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  -- The GSTIN's first two digits are the state code.
  CHECK (gstin IS NULL OR state_code IS NULL OR left(gstin, 2) = state_code)
);
CREATE UNIQUE INDEX supplier_gstin ON inventory.supplier (tenant_id, gstin) WHERE gstin IS NOT NULL;
SELECT platform.setup_tenant_table('inventory.supplier', 'mod_inventory');

-- ---------------------------------------------------------------------------
-- Batches (lots) and serialised units. MRP and cost are per base unit.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory.item_batch (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenant (id),
  item_id         uuid NOT NULL,
  supplier_id     uuid,
  batch_no        text NOT NULL CHECK (btrim(batch_no) <> '' AND length(batch_no) <= 40),
  manufactured_on date,
  expiry_date     date,
  mrp_minor       bigint CHECK (mrp_minor >= 0),
  unit_cost_minor bigint NOT NULL DEFAULT 0 CHECK (unit_cost_minor >= 0),
  currency        char(3) NOT NULL DEFAULT 'INR',
  received_at     timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'quarantined', 'recalled', 'expired')),
  status_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, item_id),          -- lets movements and balances prove the batch is of their item
  UNIQUE (tenant_id, item_id, batch_no),
  FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, id),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES inventory.supplier (tenant_id, id),
  CHECK (manufactured_on IS NULL OR expiry_date IS NULL OR manufactured_on <= expiry_date),
  CHECK ((status IN ('quarantined', 'recalled')) <= (status_reason IS NOT NULL))
);
CREATE INDEX ON inventory.item_batch (tenant_id, supplier_id);
CREATE INDEX ON inventory.item_batch (tenant_id, expiry_date) WHERE status = 'available';
SELECT platform.setup_tenant_table('inventory.item_batch', 'mod_inventory');

CREATE TABLE inventory.serial_unit (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  item_id          uuid NOT NULL,
  item_batch_id    uuid NOT NULL,
  serial_no        text NOT NULL CHECK (btrim(serial_no) <> '' AND length(serial_no) <= 60),
  status           text NOT NULL DEFAULT 'in_stock'
                     CHECK (status IN ('in_stock', 'in_transit', 'issued', 'implanted', 'returned_to_vendor', 'written_off')),
  current_store_id uuid,
  patient_id       uuid,                     -- who received it (implant traceability)
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, item_id, serial_no),
  FOREIGN KEY (tenant_id, item_batch_id, item_id) REFERENCES inventory.item_batch (tenant_id, id, item_id),
  FOREIGN KEY (tenant_id, current_store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  CHECK ((status = 'in_stock') <= (current_store_id IS NOT NULL)),
  CHECK ((status IN ('issued', 'implanted')) <= (patient_id IS NOT NULL))
);
CREATE INDEX ON inventory.serial_unit (tenant_id, item_batch_id, item_id);
CREATE INDEX ON inventory.serial_unit (tenant_id, current_store_id);
CREATE INDEX ON inventory.serial_unit (tenant_id, patient_id);
SELECT platform.setup_tenant_table('inventory.serial_unit', 'mod_inventory');

-- ---------------------------------------------------------------------------
-- Procurement: purchase orders, goods receipts, supplier invoices, returns to the vendor.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory.purchase_order (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id   uuid NOT NULL,
  po_no         text NOT NULL,
  supplier_id   uuid NOT NULL,
  store_id      uuid NOT NULL,              -- receiving store
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'approved', 'sent', 'partially_received', 'received', 'closed', 'cancelled')),
  expected_on   date,
  notes         text,
  taxable_minor bigint NOT NULL DEFAULT 0 CHECK (taxable_minor >= 0),
  tax_minor     bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor   bigint NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  currency      char(3) NOT NULL DEFAULT 'INR',
  approved_by   uuid,
  approved_at   timestamptz,
  sent_at       timestamptz,
  cancel_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid,
  version       integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, po_no),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES inventory.supplier (tenant_id, id),
  FOREIGN KEY (tenant_id, store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, approved_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (total_minor = taxable_minor + tax_minor),
  CHECK ((approved_at IS NULL) = (approved_by IS NULL)),
  CHECK ((status IN ('draft', 'cancelled')) OR approved_at IS NOT NULL),
  -- Four eyes: whoever raised the order doesn't approve it.
  CHECK (approved_by IS DISTINCT FROM created_by),
  CHECK ((status = 'cancelled') = (cancel_reason IS NOT NULL))
);
CREATE INDEX ON inventory.purchase_order (tenant_id, supplier_id);
CREATE INDEX ON inventory.purchase_order (tenant_id, store_id);
CREATE INDEX ON inventory.purchase_order (tenant_id, created_by);
CREATE INDEX ON inventory.purchase_order (tenant_id, approved_by);
CREATE INDEX ON inventory.purchase_order (tenant_id, facility_id, status);
SELECT platform.setup_tenant_table('inventory.purchase_order', 'mod_inventory');

CREATE FUNCTION inventory.purchase_order_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
       ('draft', 'approved'), ('draft', 'cancelled'),
       ('approved', 'sent'), ('approved', 'partially_received'), ('approved', 'received'), ('approved', 'cancelled'),
       ('sent', 'partially_received'), ('sent', 'received'), ('sent', 'cancelled'),
       ('partially_received', 'received'), ('partially_received', 'closed'), ('received', 'closed')) THEN
    RAISE EXCEPTION 'purchase order cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchase_order_transition_guard BEFORE UPDATE OF status ON inventory.purchase_order
  FOR EACH ROW EXECUTE FUNCTION inventory.purchase_order_transition_guard();

-- Quantities in the line's unit of purchase (strip, box); factor_to_base converts to base units.
CREATE TABLE inventory.purchase_order_line (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id         uuid NOT NULL REFERENCES platform.tenant (id),
  purchase_order_id uuid NOT NULL,
  item_id           uuid NOT NULL,
  uom               text NOT NULL,
  factor_to_base    numeric(14, 3) NOT NULL CHECK (factor_to_base > 0),
  quantity          numeric(14, 3) NOT NULL CHECK (quantity > 0),
  free_qty          numeric(14, 3) NOT NULL DEFAULT 0 CHECK (free_qty >= 0),
  unit_price_minor  bigint NOT NULL CHECK (unit_price_minor >= 0),
  gst_rate_bp       integer NOT NULL DEFAULT 0 CHECK (gst_rate_bp IN (0, 500, 1200, 1800, 2800)),
  received_base_qty numeric(14, 3) NOT NULL DEFAULT 0 CHECK (received_base_qty >= 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid,
  version           integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, purchase_order_id, item_id),
  FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES inventory.purchase_order (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, id),
  -- Ordered plus free goods, in base units, bounds what can be received.
  CHECK (received_base_qty <= (quantity + free_qty) * factor_to_base)
);
CREATE INDEX ON inventory.purchase_order_line (tenant_id, item_id);
SELECT platform.setup_tenant_table('inventory.purchase_order_line', 'mod_inventory');

-- A supplier invoice can bill several receipts; three-way matched against PO prices and received goods.
CREATE TABLE inventory.supplier_invoice (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenant (id),
  supplier_id     uuid NOT NULL,
  invoice_no      text NOT NULL CHECK (btrim(invoice_no) <> '' AND length(invoice_no) <= 40),
  invoice_date    date NOT NULL,
  taxable_minor   bigint NOT NULL CHECK (taxable_minor >= 0),
  cgst_minor      bigint NOT NULL DEFAULT 0 CHECK (cgst_minor >= 0),
  sgst_minor      bigint NOT NULL DEFAULT 0 CHECK (sgst_minor >= 0),
  igst_minor      bigint NOT NULL DEFAULT 0 CHECK (igst_minor >= 0),
  round_off_minor bigint NOT NULL DEFAULT 0 CHECK (round_off_minor BETWEEN -100 AND 100),
  total_minor     bigint NOT NULL CHECK (total_minor >= 0),
  currency        char(3) NOT NULL DEFAULT 'INR',
  due_on          date NOT NULL,
  expected_minor  bigint NOT NULL CHECK (expected_minor >= 0),  -- taxable value of the goods received at PO prices
  match_status    text NOT NULL CHECK (match_status IN ('unmatched', 'matched', 'variance')),
  status          text NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'approved', 'paid')),
  approved_by     uuid,
  approved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, supplier_id, invoice_no),        -- the same invoice can't be entered twice
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES inventory.supplier (tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, approved_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (total_minor = taxable_minor + cgst_minor + sgst_minor + igst_minor + round_off_minor),
  CHECK (cgst_minor = sgst_minor),                       -- intra-state GST splits evenly
  CHECK (igst_minor = 0 OR cgst_minor = 0),              -- either intra- or inter-state
  CHECK (due_on >= invoice_date),
  CHECK ((approved_at IS NULL) = (approved_by IS NULL)),
  CHECK ((status = 'recorded') = (approved_at IS NULL)),
  CHECK (approved_by IS DISTINCT FROM created_by)
);
CREATE INDEX ON inventory.supplier_invoice (tenant_id, created_by);
CREATE INDEX ON inventory.supplier_invoice (tenant_id, approved_by);
CREATE INDEX ON inventory.supplier_invoice (tenant_id, status, due_on);
SELECT platform.setup_tenant_table('inventory.supplier_invoice', 'mod_inventory');

CREATE TABLE inventory.goods_receipt (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id          uuid NOT NULL,
  grn_no               text NOT NULL,
  store_id             uuid NOT NULL,
  supplier_id          uuid NOT NULL,
  purchase_order_id    uuid,                -- NULL: a direct receipt
  supplier_invoice_ref text,
  supplier_invoice_id  uuid,
  received_at          timestamptz NOT NULL DEFAULT now(),
  received_by          uuid NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  version              integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, grn_no),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES inventory.supplier (tenant_id, id),
  FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES inventory.purchase_order (tenant_id, id),
  FOREIGN KEY (tenant_id, supplier_invoice_id) REFERENCES inventory.supplier_invoice (tenant_id, id),
  FOREIGN KEY (tenant_id, received_by) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON inventory.goods_receipt (tenant_id, store_id);
CREATE INDEX ON inventory.goods_receipt (tenant_id, supplier_id);
CREATE INDEX ON inventory.goods_receipt (tenant_id, purchase_order_id);
CREATE INDEX ON inventory.goods_receipt (tenant_id, supplier_invoice_id);
CREATE INDEX ON inventory.goods_receipt (tenant_id, received_by);
SELECT platform.setup_tenant_table('inventory.goods_receipt', 'mod_inventory');

-- A receipt is posted once; only the invoice link may be set (once) afterwards.
CREATE FUNCTION inventory.goods_receipt_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  movable text[] := ARRAY['supplier_invoice_id', 'updated_at', 'updated_by', 'version'];
BEGIN
  IF (to_jsonb(NEW) - movable) IS DISTINCT FROM (to_jsonb(OLD) - movable)
     OR (OLD.supplier_invoice_id IS NOT NULL AND NEW.supplier_invoice_id IS DISTINCT FROM OLD.supplier_invoice_id) THEN
    RAISE EXCEPTION 'a posted goods receipt cannot change' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER goods_receipt_guard BEFORE UPDATE ON inventory.goods_receipt
  FOR EACH ROW EXECUTE FUNCTION inventory.goods_receipt_guard();

CREATE TABLE inventory.goods_receipt_line (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id              uuid NOT NULL REFERENCES platform.tenant (id),
  goods_receipt_id       uuid NOT NULL,
  purchase_order_line_id uuid,
  item_id                uuid NOT NULL,
  item_batch_id          uuid NOT NULL,
  batch_no               text NOT NULL,
  expiry_date            date,
  mrp_minor              bigint CHECK (mrp_minor >= 0),
  unit_cost_minor        bigint NOT NULL CHECK (unit_cost_minor >= 0),   -- per base unit
  qty_received           numeric(14, 3) NOT NULL CHECK (qty_received >= 0),
  qty_free               numeric(14, 3) NOT NULL DEFAULT 0 CHECK (qty_free >= 0),
  qty_rejected           numeric(14, 3) NOT NULL DEFAULT 0 CHECK (qty_rejected >= 0),
  reject_reason          text,
  serial_nos             text[] NOT NULL DEFAULT '{}',
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, goods_receipt_id) REFERENCES inventory.goods_receipt (tenant_id, id),
  FOREIGN KEY (tenant_id, purchase_order_line_id) REFERENCES inventory.purchase_order_line (tenant_id, id),
  FOREIGN KEY (tenant_id, item_batch_id, item_id) REFERENCES inventory.item_batch (tenant_id, id, item_id),
  CHECK (qty_received + qty_free > 0 OR qty_rejected > 0),
  CHECK ((qty_rejected > 0) = (reject_reason IS NOT NULL))
);
CREATE INDEX ON inventory.goods_receipt_line (tenant_id, goods_receipt_id);
CREATE INDEX ON inventory.goods_receipt_line (tenant_id, purchase_order_line_id);
CREATE INDEX ON inventory.goods_receipt_line (tenant_id, item_batch_id, item_id);
SELECT platform.apply_tenant_rls('inventory.goods_receipt_line');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON inventory.goods_receipt_line
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON inventory.goods_receipt_line TO mod_inventory;

CREATE TABLE inventory.purchase_return (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id    uuid NOT NULL,
  return_no      text NOT NULL,
  supplier_id    uuid NOT NULL,
  store_id       uuid NOT NULL,
  reason         text NOT NULL CHECK (reason IN ('expired', 'damaged', 'recalled', 'excess')),
  debit_note_ref text,
  returned_at    timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, return_no),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES inventory.supplier (tenant_id, id),
  FOREIGN KEY (tenant_id, store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON inventory.purchase_return (tenant_id, supplier_id);
CREATE INDEX ON inventory.purchase_return (tenant_id, store_id);
CREATE INDEX ON inventory.purchase_return (tenant_id, created_by);
SELECT platform.apply_tenant_rls('inventory.purchase_return');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON inventory.purchase_return
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON inventory.purchase_return TO mod_inventory;

CREATE TABLE inventory.purchase_return_line (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  purchase_return_id uuid NOT NULL,
  item_id            uuid NOT NULL,
  item_batch_id      uuid NOT NULL,
  quantity           numeric(14, 3) NOT NULL CHECK (quantity > 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, purchase_return_id, item_batch_id),
  FOREIGN KEY (tenant_id, purchase_return_id) REFERENCES inventory.purchase_return (tenant_id, id),
  FOREIGN KEY (tenant_id, item_batch_id, item_id) REFERENCES inventory.item_batch (tenant_id, id, item_id)
);
CREATE INDEX ON inventory.purchase_return_line (tenant_id, item_batch_id, item_id);
SELECT platform.apply_tenant_rls('inventory.purchase_return_line');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON inventory.purchase_return_line
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON inventory.purchase_return_line TO mod_inventory;

-- ---------------------------------------------------------------------------
-- Internal supply: a ward or department store requests (indent) from its supplying store, which
-- dispatches a transfer; the receiving store confirms what arrived.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory.requisition (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id         uuid NOT NULL,
  indent_no           text NOT NULL,
  requesting_store_id uuid NOT NULL,
  supplying_store_id  uuid NOT NULL,
  status              text NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('draft', 'submitted', 'approved', 'partially_issued', 'issued', 'cancelled')),
  note                text,
  requested_by        uuid NOT NULL,
  requested_at        timestamptz NOT NULL DEFAULT now(),
  approved_by         uuid,
  approved_at         timestamptz,
  cancel_reason       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid,
  version             integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, indent_no),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, requesting_store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, supplying_store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, requested_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, approved_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (requesting_store_id <> supplying_store_id),
  CHECK ((approved_at IS NULL) = (approved_by IS NULL)),
  CHECK ((status = 'cancelled') = (cancel_reason IS NOT NULL))
);
CREATE INDEX ON inventory.requisition (tenant_id, requesting_store_id);
CREATE INDEX ON inventory.requisition (tenant_id, supplying_store_id, status);
CREATE INDEX ON inventory.requisition (tenant_id, requested_by);
CREATE INDEX ON inventory.requisition (tenant_id, approved_by);
SELECT platform.setup_tenant_table('inventory.requisition', 'mod_inventory');

CREATE FUNCTION inventory.requisition_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
       ('draft', 'submitted'), ('draft', 'cancelled'),
       ('submitted', 'approved'), ('submitted', 'cancelled'),
       ('approved', 'partially_issued'), ('approved', 'issued'), ('approved', 'cancelled'),
       ('partially_issued', 'issued')) THEN
    RAISE EXCEPTION 'requisition cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER requisition_transition_guard BEFORE UPDATE OF status ON inventory.requisition
  FOR EACH ROW EXECUTE FUNCTION inventory.requisition_transition_guard();

CREATE TABLE inventory.requisition_line (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  requisition_id uuid NOT NULL,
  item_id        uuid NOT NULL,
  qty_requested  numeric(14, 3) NOT NULL CHECK (qty_requested > 0),
  qty_approved   numeric(14, 3) CHECK (qty_approved >= 0),
  qty_issued     numeric(14, 3) NOT NULL DEFAULT 0 CHECK (qty_issued >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, requisition_id, item_id),
  FOREIGN KEY (tenant_id, requisition_id) REFERENCES inventory.requisition (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, id),
  CHECK (qty_issued <= coalesce(qty_approved, 0))
);
CREATE INDEX ON inventory.requisition_line (tenant_id, item_id);
SELECT platform.setup_tenant_table('inventory.requisition_line', 'mod_inventory');

CREATE TABLE inventory.stock_transfer (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id    uuid NOT NULL,
  transfer_no    text NOT NULL,
  requisition_id uuid,
  from_store_id  uuid NOT NULL,
  to_store_id    uuid NOT NULL,
  status         text NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit', 'received', 'partially_received')),
  dispatched_at  timestamptz NOT NULL DEFAULT now(),
  dispatched_by  uuid NOT NULL,
  received_at    timestamptz,
  received_by    uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, transfer_no),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, requisition_id) REFERENCES inventory.requisition (tenant_id, id),
  FOREIGN KEY (tenant_id, from_store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, to_store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, dispatched_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, received_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (from_store_id <> to_store_id),
  CHECK ((status = 'in_transit') = (received_at IS NULL)),
  CHECK ((received_at IS NULL) = (received_by IS NULL))
);
CREATE INDEX ON inventory.stock_transfer (tenant_id, requisition_id);
CREATE INDEX ON inventory.stock_transfer (tenant_id, from_store_id);
CREATE INDEX ON inventory.stock_transfer (tenant_id, to_store_id, status);
CREATE INDEX ON inventory.stock_transfer (tenant_id, dispatched_by);
CREATE INDEX ON inventory.stock_transfer (tenant_id, received_by);
SELECT platform.setup_tenant_table('inventory.stock_transfer', 'mod_inventory');

CREATE FUNCTION inventory.stock_transfer_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (('in_transit', 'received'), ('in_transit', 'partially_received')) THEN
    RAISE EXCEPTION 'stock transfer cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stock_transfer_transition_guard BEFORE UPDATE OF status ON inventory.stock_transfer
  FOR EACH ROW EXECUTE FUNCTION inventory.stock_transfer_transition_guard();

CREATE TABLE inventory.stock_transfer_line (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid NOT NULL REFERENCES platform.tenant (id),
  stock_transfer_id   uuid NOT NULL,
  requisition_line_id uuid,
  item_id             uuid NOT NULL,
  item_batch_id       uuid NOT NULL,
  serial_unit_id      uuid,
  qty_sent            numeric(14, 3) NOT NULL CHECK (qty_sent > 0),
  qty_received        numeric(14, 3) CHECK (qty_received >= 0),
  discrepancy_reason  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid,
  version             integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, stock_transfer_id) REFERENCES inventory.stock_transfer (tenant_id, id),
  FOREIGN KEY (tenant_id, requisition_line_id) REFERENCES inventory.requisition_line (tenant_id, id),
  FOREIGN KEY (tenant_id, item_batch_id, item_id) REFERENCES inventory.item_batch (tenant_id, id, item_id),
  FOREIGN KEY (tenant_id, serial_unit_id) REFERENCES inventory.serial_unit (tenant_id, id),
  CHECK (qty_received IS NULL OR qty_received <= qty_sent),
  -- A short receipt says why.
  CHECK (qty_received IS NULL OR qty_received = qty_sent OR coalesce(btrim(discrepancy_reason), '') <> '')
);
CREATE INDEX ON inventory.stock_transfer_line (tenant_id, stock_transfer_id);
CREATE INDEX ON inventory.stock_transfer_line (tenant_id, requisition_line_id);
CREATE INDEX ON inventory.stock_transfer_line (tenant_id, item_batch_id, item_id);
CREATE INDEX ON inventory.stock_transfer_line (tenant_id, serial_unit_id);
SELECT platform.setup_tenant_table('inventory.stock_transfer_line', 'mod_inventory');

-- ---------------------------------------------------------------------------
-- Stock counts: lines snapshot the system quantity when the count opens; approval writes the
-- differences as adjustment movements (refused if stock moved since).
-- ---------------------------------------------------------------------------
CREATE TABLE inventory.stock_count (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id  uuid NOT NULL,
  count_no     text NOT NULL,
  store_id     uuid NOT NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'approved')),
  opened_by    uuid NOT NULL,
  counted_at   timestamptz,
  submitted_by uuid,
  approved_by  uuid,
  approved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, count_no),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, opened_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, submitted_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, approved_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((status = 'open') = (submitted_by IS NULL)),
  CHECK ((status = 'approved') = (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CHECK (approved_by <> submitted_by)
);
-- One open count per store at a time.
CREATE UNIQUE INDEX stock_count_one_open ON inventory.stock_count (tenant_id, store_id) WHERE status <> 'approved';
CREATE INDEX ON inventory.stock_count (tenant_id, store_id);
CREATE INDEX ON inventory.stock_count (tenant_id, opened_by);
CREATE INDEX ON inventory.stock_count (tenant_id, submitted_by);
CREATE INDEX ON inventory.stock_count (tenant_id, approved_by);
SELECT platform.setup_tenant_table('inventory.stock_count', 'mod_inventory');

CREATE FUNCTION inventory.stock_count_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (('open', 'submitted'), ('submitted', 'approved'), ('submitted', 'open')) THEN
    RAISE EXCEPTION 'stock count cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stock_count_transition_guard BEFORE UPDATE OF status ON inventory.stock_count
  FOR EACH ROW EXECUTE FUNCTION inventory.stock_count_transition_guard();

CREATE TABLE inventory.stock_count_line (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  stock_count_id uuid NOT NULL,
  item_id        uuid NOT NULL,
  item_batch_id  uuid NOT NULL,
  system_qty     numeric(14, 3) NOT NULL CHECK (system_qty >= 0),
  counted_qty    numeric(14, 3) CHECK (counted_qty >= 0),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, stock_count_id, item_batch_id),
  FOREIGN KEY (tenant_id, stock_count_id) REFERENCES inventory.stock_count (tenant_id, id),
  FOREIGN KEY (tenant_id, item_batch_id, item_id) REFERENCES inventory.item_batch (tenant_id, id, item_id)
);
CREATE INDEX ON inventory.stock_count_line (tenant_id, item_batch_id, item_id);
SELECT platform.setup_tenant_table('inventory.stock_count_line', 'mod_inventory');

-- ---------------------------------------------------------------------------
-- stock_adjustment: the reason behind opening balances, departmental consumption, damage, expiry
-- disposal and corrections. Its movements carry the quantities.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory.stock_adjustment (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id   uuid NOT NULL,
  adjustment_no text NOT NULL,
  store_id      uuid NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('opening', 'consumption', 'adjustment', 'expiry_disposal', 'damage')),
  department_id uuid,                       -- consumption: the department that used it
  reason        text NOT NULL CHECK (btrim(reason) <> ''),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, adjustment_no),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, department_id) REFERENCES platform.department (tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON inventory.stock_adjustment (tenant_id, store_id);
CREATE INDEX ON inventory.stock_adjustment (tenant_id, department_id);
CREATE INDEX ON inventory.stock_adjustment (tenant_id, created_by);
SELECT platform.apply_tenant_rls('inventory.stock_adjustment');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON inventory.stock_adjustment
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON inventory.stock_adjustment TO mod_inventory;

-- ---------------------------------------------------------------------------
-- stock_movement: the append-only ledger. Quantity is signed (base units); the movement type fixes the
-- sign and which source line it must point at.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory.stock_movement (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id               uuid NOT NULL REFERENCES platform.tenant (id),
  store_id                uuid NOT NULL,
  item_id                 uuid NOT NULL,
  item_batch_id           uuid NOT NULL,
  serial_unit_id          uuid,
  movement_type           text NOT NULL CHECK (movement_type IN ('opening', 'receipt', 'transfer_out', 'transfer_in', 'issue_to_patient',
                                                                 'patient_return', 'consumption', 'adjustment', 'expiry_disposal',
                                                                 'damage', 'vendor_return')),
  quantity                numeric(14, 3) NOT NULL CHECK (quantity <> 0),
  unit_cost_minor         bigint NOT NULL CHECK (unit_cost_minor >= 0),
  occurred_at             timestamptz NOT NULL DEFAULT now(),
  actor_staff_id          uuid,
  patient_id              uuid,
  adjustment_id           uuid,
  goods_receipt_line_id   uuid,
  transfer_line_id        uuid,
  count_line_id           uuid,
  purchase_return_line_id uuid,
  dispense_line_id        uuid,               -- FK to pharmacy.dispense_line added with M09
  medication_return_id    uuid,               -- FK to pharmacy.medication_return added with M09
  procedure_consumable_id uuid,               -- FK to theatre.procedure_consumable added with M08
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, item_batch_id, item_id) REFERENCES inventory.item_batch (tenant_id, id, item_id),
  FOREIGN KEY (tenant_id, serial_unit_id) REFERENCES inventory.serial_unit (tenant_id, id),
  FOREIGN KEY (tenant_id, actor_staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, adjustment_id) REFERENCES inventory.stock_adjustment (tenant_id, id),
  FOREIGN KEY (tenant_id, goods_receipt_line_id) REFERENCES inventory.goods_receipt_line (tenant_id, id),
  FOREIGN KEY (tenant_id, transfer_line_id) REFERENCES inventory.stock_transfer_line (tenant_id, id),
  FOREIGN KEY (tenant_id, count_line_id) REFERENCES inventory.stock_count_line (tenant_id, id),
  FOREIGN KEY (tenant_id, purchase_return_line_id) REFERENCES inventory.purchase_return_line (tenant_id, id),
  CHECK (num_nonnulls(adjustment_id, goods_receipt_line_id, transfer_line_id, count_line_id, purchase_return_line_id,
                      dispense_line_id, medication_return_id, procedure_consumable_id) = 1),
  CHECK (CASE movement_type
           WHEN 'opening' THEN quantity > 0 AND adjustment_id IS NOT NULL
           WHEN 'receipt' THEN quantity > 0 AND goods_receipt_line_id IS NOT NULL
           WHEN 'transfer_in' THEN quantity > 0 AND transfer_line_id IS NOT NULL
           WHEN 'transfer_out' THEN quantity < 0 AND transfer_line_id IS NOT NULL
           WHEN 'issue_to_patient' THEN quantity < 0 AND patient_id IS NOT NULL AND (dispense_line_id IS NOT NULL OR procedure_consumable_id IS NOT NULL)
           WHEN 'patient_return' THEN quantity > 0 AND patient_id IS NOT NULL AND medication_return_id IS NOT NULL
           WHEN 'consumption' THEN quantity < 0 AND adjustment_id IS NOT NULL
           WHEN 'expiry_disposal' THEN quantity < 0 AND adjustment_id IS NOT NULL
           WHEN 'damage' THEN quantity < 0 AND adjustment_id IS NOT NULL
           WHEN 'vendor_return' THEN quantity < 0 AND purchase_return_line_id IS NOT NULL
           WHEN 'adjustment' THEN adjustment_id IS NOT NULL OR count_line_id IS NOT NULL
         END)
);
CREATE INDEX ON inventory.stock_movement (tenant_id, store_id, occurred_at);
CREATE INDEX ON inventory.stock_movement (tenant_id, item_batch_id, item_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, item_id, occurred_at);
CREATE INDEX ON inventory.stock_movement (tenant_id, serial_unit_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, actor_staff_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, patient_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, adjustment_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, goods_receipt_line_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, transfer_line_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, count_line_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, purchase_return_line_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, dispense_line_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, medication_return_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, procedure_consumable_id);
SELECT platform.apply_tenant_rls('inventory.stock_movement');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON inventory.stock_movement
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON inventory.stock_movement TO mod_inventory;

-- stock_balance: on hand per store and batch. Written only by the movement trigger below.
CREATE TABLE inventory.stock_balance (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL REFERENCES platform.tenant (id),
  store_id      uuid NOT NULL,
  item_id       uuid NOT NULL,
  item_batch_id uuid NOT NULL,
  on_hand       numeric(14, 3) NOT NULL DEFAULT 0 CONSTRAINT stock_balance_on_hand_check CHECK (on_hand >= 0),
  reserved      numeric(14, 3) NOT NULL DEFAULT 0 CONSTRAINT stock_balance_reserved_check CHECK (reserved >= 0 AND reserved <= on_hand),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid,
  version       integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, store_id, item_batch_id),
  FOREIGN KEY (tenant_id, store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, item_batch_id, item_id) REFERENCES inventory.item_batch (tenant_id, id, item_id)
);
CREATE INDEX ON inventory.stock_balance (tenant_id, item_batch_id, item_id);
CREATE INDEX ON inventory.stock_balance (tenant_id, store_id, item_id) WHERE on_hand > 0;
SELECT platform.setup_tenant_table('inventory.stock_balance', 'mod_inventory');

-- Before a movement: stock leaving for use (patients, departments, other stores) must come from an
-- available, unexpired batch. Disposal, damage and vendor returns take any batch.
CREATE FUNCTION inventory.stock_movement_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  b record;
BEGIN
  IF NEW.movement_type IN ('issue_to_patient', 'consumption', 'transfer_out') THEN
    SELECT status, expiry_date INTO b FROM inventory.item_batch WHERE tenant_id = NEW.tenant_id AND id = NEW.item_batch_id;
    IF b.status <> 'available' THEN
      RAISE EXCEPTION 'batch is % and cannot be issued', b.status USING ERRCODE = '55000', HINT = 'batch_unavailable';
    END IF;
    IF b.expiry_date IS NOT NULL AND b.expiry_date < (NEW.occurred_at AT TIME ZONE 'Asia/Kolkata')::date THEN
      RAISE EXCEPTION 'batch expired on %', b.expiry_date USING ERRCODE = '55000', HINT = 'batch_expired';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stock_movement_guard BEFORE INSERT ON inventory.stock_movement
  FOR EACH ROW EXECUTE FUNCTION inventory.stock_movement_guard();

-- After a movement: the running balance moves in the same transaction under the balance row's lock
-- (a missing row is created at zero first, race-safe); the CHECK refuses anything below zero.
CREATE FUNCTION inventory.apply_stock_movement() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE inventory.stock_balance SET on_hand = on_hand + NEW.quantity, updated_by = NEW.actor_staff_id
  WHERE tenant_id = NEW.tenant_id AND store_id = NEW.store_id AND item_batch_id = NEW.item_batch_id;
  IF NOT FOUND THEN
    INSERT INTO inventory.stock_balance (tenant_id, store_id, item_id, item_batch_id, on_hand, created_by, updated_by)
    VALUES (NEW.tenant_id, NEW.store_id, NEW.item_id, NEW.item_batch_id, 0, NEW.actor_staff_id, NEW.actor_staff_id)
    ON CONFLICT (tenant_id, store_id, item_batch_id) DO NOTHING;
    UPDATE inventory.stock_balance SET on_hand = on_hand + NEW.quantity, updated_by = NEW.actor_staff_id
    WHERE tenant_id = NEW.tenant_id AND store_id = NEW.store_id AND item_batch_id = NEW.item_batch_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER apply_stock_movement AFTER INSERT ON inventory.stock_movement
  FOR EACH ROW EXECUTE FUNCTION inventory.apply_stock_movement();

-- Nightly reconcile: balances that differ from the sum of their movements (should always be empty).
CREATE VIEW inventory.stock_balance_drift WITH (security_invoker = true) AS
SELECT b.tenant_id, b.store_id, b.item_batch_id, b.on_hand, coalesce(m.total, 0) AS ledger_total
FROM inventory.stock_balance b
LEFT JOIN (SELECT tenant_id, store_id, item_batch_id, sum(quantity) AS total FROM inventory.stock_movement GROUP BY 1, 2, 3) m
  ON m.tenant_id = b.tenant_id AND m.store_id = b.store_id AND m.item_batch_id = b.item_batch_id
WHERE b.on_hand <> coalesce(m.total, 0);

-- ---------------------------------------------------------------------------
-- Links that waited for M10.
-- ---------------------------------------------------------------------------
ALTER TABLE catalog.price_list_item
  ADD FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, id),
  ADD FOREIGN KEY (tenant_id, item_group_id) REFERENCES inventory.item_group (tenant_id, id);
CREATE INDEX IF NOT EXISTS price_list_item_tenant_item ON catalog.price_list_item (tenant_id, item_id);
CREATE INDEX IF NOT EXISTS price_list_item_tenant_item_group ON catalog.price_list_item (tenant_id, item_group_id);
ALTER TABLE diagnostics.micro_susceptibility ADD FOREIGN KEY (tenant_id, antibiotic_item_id) REFERENCES inventory.item (tenant_id, id);
ALTER TABLE diagnostics.imaging_study ADD FOREIGN KEY (tenant_id, contrast_item_id) REFERENCES inventory.item (tenant_id, id);
ALTER TABLE clinical.immunization ADD FOREIGN KEY (tenant_id, item_batch_id) REFERENCES inventory.item_batch (tenant_id, id);

-- ---------------------------------------------------------------------------
-- The pharmacy's way into the ledger (M09 grants it to mod_pharmacy). It posts exactly one patient
-- movement — an issue against a dispense line or a return against a medication return — for the
-- caller's tenant, so pharmacy never writes inventory tables itself. The stock rules above still apply.
-- ---------------------------------------------------------------------------
CREATE FUNCTION inventory.post_patient_movement(
  p_store_id uuid, p_item_batch_id uuid, p_quantity numeric, p_patient_id uuid, p_actor_staff_id uuid,
  p_dispense_line_id uuid, p_medication_return_id uuid, p_occurred_at timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, inventory AS $$
DECLARE
  t uuid := platform.current_tenant_id();
  b record;
  moved uuid;
BEGIN
  IF t IS NULL THEN RAISE EXCEPTION 'no tenant in context' USING ERRCODE = '42501'; END IF;
  IF num_nonnulls(p_dispense_line_id, p_medication_return_id) <> 1 OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'post one positive quantity for one dispense line or one medication return' USING ERRCODE = '22023';
  END IF;
  SELECT item_id, unit_cost_minor INTO b FROM inventory.item_batch WHERE tenant_id = t AND id = p_item_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch not found' USING ERRCODE = '23503'; END IF;
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

-- migrate:down
DROP FUNCTION inventory.post_patient_movement(uuid, uuid, numeric, uuid, uuid, uuid, uuid, timestamptz);
ALTER TABLE clinical.immunization DROP CONSTRAINT IF EXISTS immunization_tenant_id_item_batch_id_fkey;
ALTER TABLE diagnostics.imaging_study DROP CONSTRAINT IF EXISTS imaging_study_tenant_id_contrast_item_id_fkey;
ALTER TABLE diagnostics.micro_susceptibility DROP CONSTRAINT IF EXISTS micro_susceptibility_tenant_id_antibiotic_item_id_fkey;
ALTER TABLE catalog.price_list_item DROP CONSTRAINT IF EXISTS price_list_item_tenant_id_item_id_fkey;
ALTER TABLE catalog.price_list_item DROP CONSTRAINT IF EXISTS price_list_item_tenant_id_item_group_id_fkey;
DROP INDEX IF EXISTS catalog.price_list_item_tenant_item;
DROP INDEX IF EXISTS catalog.price_list_item_tenant_item_group;
DROP SCHEMA inventory CASCADE;
DELETE FROM platform.number_series WHERE series_kind IN ('indent', 'transfer', 'stock_count', 'stock_adjustment', 'purchase_return');
ALTER TABLE platform.number_series DROP CONSTRAINT number_series_series_kind_check;
ALTER TABLE platform.number_series ADD CONSTRAINT number_series_series_kind_check CHECK (series_kind IN (
  'mrn', 'encounter', 'ip_no', 'invoice', 'bill_of_supply', 'credit_note', 'receipt', 'mlc', 'order', 'requisition',
  'dispense', 'token', 'accession', 'imaging_accession', 'po', 'grn', 'claim'));
REVOKE INSERT ON platform.audit_event, platform.outbox_event, platform.inbox_record FROM mod_inventory;
REVOKE INSERT, UPDATE ON platform.number_series, platform.idempotency_record FROM mod_inventory;
