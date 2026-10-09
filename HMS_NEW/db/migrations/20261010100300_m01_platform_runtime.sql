-- migrate:up

-- ---------------------------------------------------------------------------
-- module_state: which modules a tenant has switched on
-- ---------------------------------------------------------------------------
CREATE TABLE platform.module_state (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  module_code    text NOT NULL CHECK (module_code IN ('platform', 'patient', 'catalog', 'booking', 'clinical', 'diagnostics',
                                                      'inpatient', 'theatre', 'pharmacy', 'inventory', 'billing', 'insurance',
                                                      'comms', 'documents', 'operations', 'integration', 'abdm')),
  state          text NOT NULL DEFAULT 'not_provisioned'
                   CHECK (state IN ('not_provisioned', 'configured', 'validated', 'active', 'suspended', 'retired')),
  config_version integer NOT NULL DEFAULT 1,
  changed_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, module_code)
);
SELECT platform.setup_tenant_table('platform.module_state', 'mod_platform');

-- ---------------------------------------------------------------------------
-- config_setting: versioned tenant (or facility) configuration
-- ---------------------------------------------------------------------------
CREATE TABLE platform.config_setting (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id    uuid,                -- NULL = tenant-wide
  key            text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_.]*$'),
  value          jsonb NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE NULLS NOT DISTINCT (tenant_id, facility_id, key, effective_from),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id)
);
SELECT platform.setup_tenant_table('platform.config_setting', 'mod_platform');

-- ---------------------------------------------------------------------------
-- number_series: gap-free, race-free numbers (MRN, encounter, invoice per GSTIN per FY, tokens…)
-- ---------------------------------------------------------------------------
CREATE TABLE platform.number_series (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id uuid,                   -- NULL = tenant-wide series (e.g. MRN)
  series_kind text NOT NULL CHECK (series_kind IN ('mrn', 'encounter', 'ip_no', 'invoice', 'bill_of_supply', 'credit_note',
                                                   'receipt', 'mlc', 'order', 'requisition', 'dispense', 'token',
                                                   'accession', 'po', 'grn', 'claim')),
  period_key  text NOT NULL DEFAULT '',   -- '' = never resets; '2026-27' = per financial year; a date or resource:date for tokens
  last_value  bigint NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  version     integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  CONSTRAINT number_series_key UNIQUE NULLS NOT DISTINCT (tenant_id, facility_id, series_kind, period_key),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id)
);
SELECT platform.setup_tenant_table('platform.number_series', 'mod_platform');

-- Returns the next value of a series for the current tenant. The row lock taken by the upsert
-- serialises concurrent callers until their transaction ends, so values never repeat or skip
-- (a rolled-back caller's value is reused by the next caller).
CREATE FUNCTION platform.next_number(p_series_kind text, p_facility_id uuid DEFAULT NULL, p_period_key text DEFAULT '')
RETURNS bigint
LANGUAGE sql AS $$
  INSERT INTO platform.number_series AS s (tenant_id, facility_id, series_kind, period_key, last_value)
  VALUES (platform.current_tenant_id(), p_facility_id, p_series_kind, p_period_key, 1)
  ON CONFLICT ON CONSTRAINT number_series_key
  DO UPDATE SET last_value = s.last_value + 1
  RETURNING last_value;
$$;

-- ---------------------------------------------------------------------------
-- idempotency_record: one effect per command key; same key + different request is rejected by the runner
-- ---------------------------------------------------------------------------
CREATE TABLE platform.idempotency_record (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  scope        text NOT NULL,          -- command name, e.g. 'booking.book_appointment'
  key          text NOT NULL,
  request_hash text NOT NULL,
  status       text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  result_ref   jsonb,
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, scope, key)
);
CREATE INDEX ON platform.idempotency_record (expires_at);
SELECT platform.setup_tenant_table('platform.idempotency_record', 'mod_platform');

-- ---------------------------------------------------------------------------
-- audit_event: append-only, monthly partitions. Written in the same transaction as the change.
-- No FK points here (partitioned PK includes occurred_at).
-- ---------------------------------------------------------------------------
CREATE TABLE platform.audit_event (
  id             uuid NOT NULL DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  actor_staff_id uuid,
  actor_user_id  uuid,
  action         text NOT NULL CHECK (action IN ('create', 'update', 'status_change', 'delete', 'view', 'export',
                                                 'print', 'login', 'logout', 'break_glass')),
  subject_type   text NOT NULL,
  subject_id     uuid,
  patient_id     uuid,
  reason         text,
  from_version   integer,
  to_version     integer,
  diff           jsonb,
  correlation_id uuid,
  ip             inet,
  user_agent     text,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE INDEX ON platform.audit_event (tenant_id, subject_type, subject_id, occurred_at);
CREATE INDEX ON platform.audit_event (tenant_id, patient_id, occurred_at) WHERE patient_id IS NOT NULL;
CREATE INDEX ON platform.audit_event (tenant_id, actor_staff_id, occurred_at);
SELECT platform.apply_tenant_rls('platform.audit_event');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON platform.audit_event
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON platform.audit_event TO mod_platform, mod_patient, mod_catalog, mod_booking;

-- Safety net: a missing monthly partition must never make audit inserts (and so every command) fail.
-- A daily job keeps 3 months of partitions ahead; rows found here mean that job is behind.
CREATE TABLE platform.audit_event_default PARTITION OF platform.audit_event DEFAULT;
SELECT platform.apply_tenant_rls('platform.audit_event_default');
SELECT platform.ensure_month_partitions('platform.audit_event', 3);

-- ---------------------------------------------------------------------------
-- outbox_event: events for other modules, written in the same transaction as the change.
-- Workers claim rows with FOR UPDATE SKIP LOCKED via SECURITY DEFINER functions (added with the worker, Phase 4).
-- ---------------------------------------------------------------------------
CREATE TABLE platform.outbox_event (
  id                uuid NOT NULL DEFAULT uuidv7(),
  tenant_id         uuid NOT NULL REFERENCES platform.tenant (id),
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  event_type        text NOT NULL CHECK (event_type ~ '^[a-z_]+\.[a-z_]+$'),
  aggregate_type    text NOT NULL,
  aggregate_id      uuid NOT NULL,
  aggregate_version integer,
  payload           jsonb NOT NULL,
  correlation_id    uuid,
  claimed_until     timestamptz,
  processed_at      timestamptz,
  attempts          integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error        text,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE INDEX outbox_event_pending ON platform.outbox_event (occurred_at) WHERE processed_at IS NULL;
CREATE INDEX ON platform.outbox_event (tenant_id, aggregate_type, aggregate_id);
SELECT platform.apply_tenant_rls('platform.outbox_event');
CREATE TRIGGER forbid_delete BEFORE DELETE ON platform.outbox_event
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON platform.outbox_event TO mod_platform, mod_patient, mod_catalog, mod_booking;

CREATE TABLE platform.outbox_event_default PARTITION OF platform.outbox_event DEFAULT;
SELECT platform.apply_tenant_rls('platform.outbox_event_default');
SELECT platform.ensure_month_partitions('platform.outbox_event', 3);

-- ---------------------------------------------------------------------------
-- Shared write rights every module needs inside its own transactions
-- ---------------------------------------------------------------------------
GRANT INSERT, UPDATE ON platform.number_series TO mod_patient, mod_catalog, mod_booking;
GRANT INSERT, UPDATE ON platform.idempotency_record TO mod_patient, mod_catalog, mod_booking;

-- migrate:down
DROP TABLE platform.outbox_event;
DROP TABLE platform.audit_event;
DROP TABLE platform.idempotency_record;
DROP FUNCTION platform.next_number(text, uuid, text);
DROP TABLE platform.number_series;
DROP TABLE platform.config_setting;
DROP TABLE platform.module_state;
