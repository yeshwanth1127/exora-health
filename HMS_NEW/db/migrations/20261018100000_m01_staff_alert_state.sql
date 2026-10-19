-- migrate:up
-- Per-person read / dismissed / snoozed marks for derived alerts (docs/prd/staff-alerts.md).
-- Alerts themselves are never stored: they are recomputed from live records on every read.
CREATE TABLE platform.staff_alert_state (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id      uuid NOT NULL,
  alert_key     text NOT NULL CHECK (alert_key ~ '^[a-z_]{2,20}:[A-Za-z0-9:._-]{1,200}$'),
  read_at       timestamptz,
  dismissed_at  timestamptz,
  snoozed_until timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  version       integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, staff_id, alert_key),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id)
);
CREATE INDEX ON platform.staff_alert_state (tenant_id, staff_id, updated_at);
SELECT platform.setup_tenant_table('platform.staff_alert_state', 'mod_platform');
-- migrate:down
DROP TABLE platform.staff_alert_state;
