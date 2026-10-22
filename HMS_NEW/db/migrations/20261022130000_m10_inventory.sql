-- migrate:up
-- M10 inventory, clinic scope (ERD m10-inventory, trimmed; based on the reverted 4c8ad57): items with an
-- optional drug profile, a pharmacy store per clinic, suppliers, batches (expiry, MRP, cost), direct goods
-- receipts against the supplier's bill, stock adjustments, and an append-only stock ledger. stock_balance
-- is the running total kept by a trigger on every movement, under the balance row's lock, with on_hand >= 0
-- enforced by a CHECK — two concurrent issues can never take the same units. Expired, quarantined or
-- recalled batches are never issued. Pharmacy posts patient movements only through
-- inventory.post_patient_movement (pharmacy migration). Purchase orders, requisitions, store transfers,
-- stock counts and serial numbers are left out for clinics. Quantities are in each item's base unit.

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
  'dispense', 'token', 'accession', 'po', 'grn', 'claim', 'stock_adjustment', 'indent'));

-- ---------------------------------------------------------------------------
-- Items and the drug profile.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory.item (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id         uuid NOT NULL REFERENCES platform.tenant (id),
  code              text NOT NULL CHECK (code ~ '^[A-Z0-9_./-]{1,40}$'),
  name              text NOT NULL CHECK (btrim(name) <> '' AND length(name) <= 200),
  item_type         text NOT NULL CHECK (item_type IN ('drug', 'consumable', 'vaccine', 'general')),
  base_uom          text NOT NULL CHECK (base_uom ~ '^[a-z_]{1,20}$'),   -- tablet, ml, piece, vial…
  pack_uom          text CHECK (pack_uom ~ '^[a-z_]{1,20}$'),           -- strip, bottle, box (how it is bought)
  pack_size         numeric(14, 3) CHECK (pack_size > 0),                -- base units in one pack
  hsn_code          text CHECK (hsn_code ~ '^[0-9]{4,8}$'),
  is_expiry_tracked boolean NOT NULL DEFAULT true,
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
  CHECK ((pack_uom IS NULL) = (pack_size IS NULL))
);
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
CREATE INDEX drug_product_generic_trgm ON inventory.drug_product USING gin (lower(generic_name) gin_trgm_ops);
SELECT platform.setup_tenant_table('inventory.drug_product', 'mod_inventory');

-- ---------------------------------------------------------------------------
-- Stores and suppliers. A store that sells or dispenses to patients needs a drug licence number.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory.store (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id               uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id             uuid NOT NULL,
  code                    text NOT NULL CHECK (code ~ '^[A-Z0-9_-]{1,20}$'),
  name                    text NOT NULL CHECK (btrim(name) <> ''),
  store_type              text NOT NULL DEFAULT 'pharmacy' CHECK (store_type IN ('pharmacy', 'general')),
  can_dispense_to_patient boolean NOT NULL DEFAULT true,
  drug_licence_no         text,
  status                  text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid,
  version                 integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, code),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  CHECK (NOT can_dispense_to_patient OR coalesce(btrim(drug_licence_no), '') <> '')
);
SELECT platform.setup_tenant_table('inventory.store', 'mod_inventory');

CREATE TABLE inventory.supplier (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  code               text NOT NULL CHECK (code ~ '^[A-Z0-9_-]{1,20}$'),
  name               text NOT NULL CHECK (btrim(name) <> ''),
  gstin              text CHECK (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$'),
  state_code         char(2) CHECK (state_code ~ '^[0-9]{2}$'),
  drug_licence_no    text,
  phone              text CHECK (phone ~ '^\+[1-9][0-9]{6,14}$'),
  email              citext,
  address            text,
  payment_terms_days smallint NOT NULL DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 365),
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  CHECK (gstin IS NULL OR state_code IS NULL OR left(gstin, 2) = state_code)
);
CREATE UNIQUE INDEX supplier_gstin ON inventory.supplier (tenant_id, gstin) WHERE gstin IS NOT NULL;
SELECT platform.setup_tenant_table('inventory.supplier', 'mod_inventory');

-- ---------------------------------------------------------------------------
-- Batches (lots). MRP and cost are per base unit.
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

-- ---------------------------------------------------------------------------
-- Goods receipts: what arrived from a supplier, against their bill (no purchase orders for clinics).
-- ---------------------------------------------------------------------------
CREATE TABLE inventory.goods_receipt (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id          uuid NOT NULL,
  grn_no               text NOT NULL,
  store_id             uuid NOT NULL,
  supplier_id          uuid NOT NULL,
  supplier_invoice_no  text NOT NULL CHECK (btrim(supplier_invoice_no) <> '' AND length(supplier_invoice_no) <= 40),
  supplier_invoice_on  date NOT NULL,
  invoice_total_minor  bigint CHECK (invoice_total_minor >= 0),
  received_at          timestamptz NOT NULL DEFAULT now(),
  received_by          uuid NOT NULL,
  notes                text CHECK (length(notes) <= 1000),
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, grn_no),
  UNIQUE (tenant_id, supplier_id, supplier_invoice_no),       -- a supplier bill is received once
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES inventory.supplier (tenant_id, id),
  FOREIGN KEY (tenant_id, received_by) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON inventory.goods_receipt (tenant_id, store_id);
CREATE INDEX ON inventory.goods_receipt (tenant_id, received_by);
SELECT platform.apply_tenant_rls('inventory.goods_receipt');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON inventory.goods_receipt
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON inventory.goods_receipt TO mod_inventory;

CREATE TABLE inventory.goods_receipt_line (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id              uuid NOT NULL REFERENCES platform.tenant (id),
  goods_receipt_id       uuid NOT NULL,
  item_id                uuid NOT NULL,
  item_batch_id          uuid NOT NULL,
  qty_received           numeric(14, 3) NOT NULL CHECK (qty_received >= 0),
  qty_free               numeric(14, 3) NOT NULL DEFAULT 0 CHECK (qty_free >= 0),
  unit_cost_minor        bigint NOT NULL CHECK (unit_cost_minor >= 0),   -- per base unit, before GST
  gst_rate_bp            integer NOT NULL DEFAULT 0 CHECK (gst_rate_bp BETWEEN 0 AND 10000),
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, goods_receipt_id) REFERENCES inventory.goods_receipt (tenant_id, id),
  FOREIGN KEY (tenant_id, item_batch_id, item_id) REFERENCES inventory.item_batch (tenant_id, id, item_id),
  CHECK (qty_received + qty_free > 0)
);
CREATE INDEX ON inventory.goods_receipt_line (tenant_id, goods_receipt_id);
CREATE INDEX ON inventory.goods_receipt_line (tenant_id, item_batch_id, item_id);
SELECT platform.apply_tenant_rls('inventory.goods_receipt_line');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON inventory.goods_receipt_line
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON inventory.goods_receipt_line TO mod_inventory;

-- ---------------------------------------------------------------------------
-- stock_adjustment: the reason behind opening balances, consumption, damage, expiry disposal, returns to
-- the supplier and corrections. Its movements carry the quantities.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory.stock_adjustment (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id   uuid NOT NULL,
  adjustment_no text NOT NULL,
  store_id      uuid NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('opening', 'consumption', 'adjustment', 'expiry_disposal', 'damage', 'vendor_return')),
  supplier_id   uuid,                       -- vendor_return: who it went back to
  reason        text NOT NULL CHECK (btrim(reason) <> '' AND length(reason) <= 500),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, adjustment_no),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES inventory.supplier (tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((kind = 'vendor_return') = (supplier_id IS NOT NULL))
);
CREATE INDEX ON inventory.stock_adjustment (tenant_id, store_id);
CREATE INDEX ON inventory.stock_adjustment (tenant_id, supplier_id);
CREATE INDEX ON inventory.stock_adjustment (tenant_id, created_by);
SELECT platform.apply_tenant_rls('inventory.stock_adjustment');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON inventory.stock_adjustment
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON inventory.stock_adjustment TO mod_inventory;

-- ---------------------------------------------------------------------------
-- stock_movement: the append-only ledger. Quantity is signed (base units); the movement type fixes the
-- sign and which source it must point at (exactly one).
-- ---------------------------------------------------------------------------
CREATE TABLE inventory.stock_movement (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id               uuid NOT NULL REFERENCES platform.tenant (id),
  store_id                uuid NOT NULL,
  item_id                 uuid NOT NULL,
  item_batch_id           uuid NOT NULL,
  movement_type           text NOT NULL CHECK (movement_type IN ('opening', 'receipt', 'issue_to_patient', 'patient_return', 'consumption',
                                                                 'adjustment', 'expiry_disposal', 'damage', 'vendor_return')),
  quantity                numeric(14, 3) NOT NULL CHECK (quantity <> 0),
  unit_cost_minor         bigint NOT NULL CHECK (unit_cost_minor >= 0),
  occurred_at             timestamptz NOT NULL DEFAULT now(),
  actor_staff_id          uuid,
  patient_id              uuid,                 -- NULL for an over-the-counter sale to an unregistered buyer
  adjustment_id           uuid,
  goods_receipt_line_id   uuid,
  dispense_line_id        uuid,                 -- FK added by the pharmacy migration
  medication_return_id    uuid,                 -- FK added by the pharmacy migration
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, store_id) REFERENCES inventory.store (tenant_id, id),
  FOREIGN KEY (tenant_id, item_batch_id, item_id) REFERENCES inventory.item_batch (tenant_id, id, item_id),
  FOREIGN KEY (tenant_id, actor_staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, adjustment_id) REFERENCES inventory.stock_adjustment (tenant_id, id),
  FOREIGN KEY (tenant_id, goods_receipt_line_id) REFERENCES inventory.goods_receipt_line (tenant_id, id),
  CHECK (num_nonnulls(adjustment_id, goods_receipt_line_id, dispense_line_id, medication_return_id) = 1),
  CHECK (CASE movement_type
           WHEN 'opening' THEN quantity > 0 AND adjustment_id IS NOT NULL
           WHEN 'receipt' THEN quantity > 0 AND goods_receipt_line_id IS NOT NULL
           WHEN 'issue_to_patient' THEN quantity < 0 AND dispense_line_id IS NOT NULL
           WHEN 'patient_return' THEN quantity > 0 AND medication_return_id IS NOT NULL
           WHEN 'consumption' THEN quantity < 0 AND adjustment_id IS NOT NULL
           WHEN 'expiry_disposal' THEN quantity < 0 AND adjustment_id IS NOT NULL
           WHEN 'damage' THEN quantity < 0 AND adjustment_id IS NOT NULL
           WHEN 'vendor_return' THEN quantity < 0 AND adjustment_id IS NOT NULL
           WHEN 'adjustment' THEN adjustment_id IS NOT NULL
         END)
);
CREATE INDEX ON inventory.stock_movement (tenant_id, store_id, occurred_at);
CREATE INDEX ON inventory.stock_movement (tenant_id, item_batch_id, item_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, item_id, occurred_at);
CREATE INDEX ON inventory.stock_movement (tenant_id, actor_staff_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, patient_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, adjustment_id);
CREATE INDEX ON inventory.stock_movement (tenant_id, goods_receipt_line_id);
CREATE UNIQUE INDEX stock_movement_dispense_line_once ON inventory.stock_movement (tenant_id, dispense_line_id) WHERE dispense_line_id IS NOT NULL;
CREATE UNIQUE INDEX stock_movement_medication_return_once ON inventory.stock_movement (tenant_id, medication_return_id) WHERE medication_return_id IS NOT NULL;
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

-- Before a movement: stock leaving for use (patients, consumption) must come from an available, unexpired
-- batch. Disposal, damage and vendor returns take any batch.
CREATE FUNCTION inventory.stock_movement_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  b record;
BEGIN
  IF NEW.movement_type IN ('issue_to_patient', 'consumption') THEN
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

-- Reconcile: balances that differ from the sum of their movements (should always be empty).
CREATE VIEW inventory.stock_balance_drift WITH (security_invoker = true) AS
SELECT b.tenant_id, b.store_id, b.item_batch_id, b.on_hand, coalesce(m.total, 0) AS ledger_total
FROM inventory.stock_balance b
LEFT JOIN (SELECT tenant_id, store_id, item_batch_id, sum(quantity) AS total FROM inventory.stock_movement GROUP BY 1, 2, 3) m
  ON m.tenant_id = b.tenant_id AND m.store_id = b.store_id AND m.item_batch_id = b.item_batch_id
WHERE b.on_hand <> coalesce(m.total, 0);

-- ---------------------------------------------------------------------------
-- Links that waited for inventory.
-- ---------------------------------------------------------------------------
ALTER TABLE catalog.price_list_item ADD CONSTRAINT price_list_item_item_fk FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, id);
ALTER TABLE clinical.immunization ADD CONSTRAINT immunization_item_batch_fk FOREIGN KEY (tenant_id, item_batch_id) REFERENCES inventory.item_batch (tenant_id, id);
ALTER TABLE billing.charge ADD CONSTRAINT charge_item_fk FOREIGN KEY (tenant_id, item_id) REFERENCES inventory.item (tenant_id, id);

-- migrate:down
ALTER TABLE billing.charge DROP CONSTRAINT charge_item_fk;
ALTER TABLE clinical.immunization DROP CONSTRAINT immunization_item_batch_fk;
ALTER TABLE catalog.price_list_item DROP CONSTRAINT price_list_item_item_fk;
DROP SCHEMA inventory CASCADE;
DELETE FROM platform.number_series WHERE series_kind IN ('stock_adjustment', 'indent');
ALTER TABLE platform.number_series DROP CONSTRAINT number_series_series_kind_check;
ALTER TABLE platform.number_series ADD CONSTRAINT number_series_series_kind_check CHECK (series_kind IN (
  'mrn', 'encounter', 'ip_no', 'invoice', 'bill_of_supply', 'credit_note', 'receipt', 'mlc', 'order', 'requisition',
  'dispense', 'token', 'accession', 'po', 'grn', 'claim'));
REVOKE INSERT ON platform.audit_event, platform.outbox_event, platform.inbox_record FROM mod_inventory;
REVOKE INSERT, UPDATE ON platform.number_series, platform.idempotency_record FROM mod_inventory;
