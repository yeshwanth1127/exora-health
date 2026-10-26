-- migrate:up
-- M11 billing for inpatient stays: one billing account per admission collects the stay's charges (bed
-- days, ward dispensing, procedures), the deposits taken against it, and ends with the final bill.
-- Deposits are advance payments (billing.payment.is_advance) held on the account until the final bill
-- applies them through ordinary payment allocations; any excess is refunded.

-- ---------------------------------------------------------------------------
-- billing_account: the stay's running account. Opened by the worker when the patient is admitted.
-- ---------------------------------------------------------------------------
CREATE TABLE billing.billing_account (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id        uuid NOT NULL,
  patient_id         uuid NOT NULL,
  admission_id       uuid NOT NULL,
  account_no         text NOT NULL,
  account_type       text NOT NULL DEFAULT 'self_pay' CHECK (account_type IN ('self_pay')),   -- payers come with insurance
  status             text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'final_billed', 'settled', 'closed')),
  opened_at          timestamptz NOT NULL DEFAULT now(),
  final_invoice_id   uuid,
  settled_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, admission_id),
  UNIQUE (tenant_id, facility_id, account_no),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, admission_id, patient_id) REFERENCES inpatient.admission (tenant_id, id, patient_id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, final_invoice_id) REFERENCES billing.invoice (tenant_id, id),
  CHECK (status NOT IN ('final_billed', 'settled') OR final_invoice_id IS NOT NULL),
  CHECK (status <> 'open' OR final_invoice_id IS NULL),
  CHECK (status <> 'settled' OR settled_at IS NOT NULL)
);
CREATE INDEX ON billing.billing_account (tenant_id, facility_id, status);
CREATE INDEX ON billing.billing_account (tenant_id, admission_id, patient_id);
CREATE INDEX ON billing.billing_account (tenant_id, patient_id);
CREATE INDEX ON billing.billing_account (tenant_id, final_invoice_id);
SELECT platform.setup_tenant_table('billing.billing_account', 'mod_billing');

-- Charges, bills and payments of a stay point at its account.
ALTER TABLE billing.charge ADD CONSTRAINT charge_billing_account_fk
  FOREIGN KEY (tenant_id, billing_account_id) REFERENCES billing.billing_account (tenant_id, id);
ALTER TABLE billing.invoice ADD CONSTRAINT invoice_billing_account_fk
  FOREIGN KEY (tenant_id, billing_account_id) REFERENCES billing.billing_account (tenant_id, id);
ALTER TABLE billing.payment ADD CONSTRAINT payment_billing_account_fk
  FOREIGN KEY (tenant_id, billing_account_id) REFERENCES billing.billing_account (tenant_id, id);
-- One final bill per stay (voided ones excepted).
CREATE UNIQUE INDEX invoice_one_final_per_account ON billing.invoice (tenant_id, billing_account_id)
  WHERE bill_kind = 'ipd_final' AND status <> 'void';

-- ---------------------------------------------------------------------------
-- deposit_rule: the advance a clinic asks for at admission, and when to warn that it is running low.
-- ---------------------------------------------------------------------------
CREATE TABLE billing.deposit_rule (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id         uuid NOT NULL,
  bed_category_id     uuid,              -- NULL = any bed category
  min_deposit_minor   bigint NOT NULL CHECK (min_deposit_minor >= 0),
  alert_below_minor   bigint NOT NULL CHECK (alert_below_minor >= 0),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid,
  version             integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, bed_category_id) REFERENCES catalog.bed_category (tenant_id, id)
);
CREATE UNIQUE INDEX deposit_rule_one_active ON billing.deposit_rule
  (tenant_id, facility_id, coalesce(bed_category_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE status = 'active';
CREATE INDEX ON billing.deposit_rule (tenant_id, facility_id);
CREATE INDEX ON billing.deposit_rule (tenant_id, bed_category_id);
SELECT platform.setup_tenant_table('billing.deposit_rule', 'mod_billing');

-- Open stay accounts across tenants, for the worker's daily bed-day charging (it then works on each
-- account inside that tenant's context).
CREATE FUNCTION billing.open_stay_accounts(batch_size integer DEFAULT 500)
RETURNS TABLE (tenant_id uuid, id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, billing AS $$
  SELECT a.tenant_id, a.id FROM billing.billing_account a WHERE a.status = 'open'
  ORDER BY a.opened_at, a.id LIMIT least(greatest(batch_size, 1), 5000)
$$;

-- migrate:down
DROP FUNCTION billing.open_stay_accounts(integer);
DROP TABLE billing.deposit_rule;
DROP INDEX billing.invoice_one_final_per_account;
ALTER TABLE billing.payment DROP CONSTRAINT payment_billing_account_fk;
ALTER TABLE billing.invoice DROP CONSTRAINT invoice_billing_account_fk;
ALTER TABLE billing.charge DROP CONSTRAINT charge_billing_account_fk;
DROP TABLE billing.billing_account;
