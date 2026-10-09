-- migrate:up

-- ---------------------------------------------------------------------------
-- Service accounts: integrations (WhatsApp bot, voice agent) sign in as a staff row flagged as a
-- system account, so every action they take is attributed and permission-checked like a person's.
-- They are excluded from staff directories.
-- ---------------------------------------------------------------------------
ALTER TABLE platform.staff ADD COLUMN is_system_account boolean NOT NULL DEFAULT false;
ALTER TABLE platform.staff ADD CONSTRAINT staff_system_account_type CHECK (NOT is_system_account OR staff_type = 'other');

-- ---------------------------------------------------------------------------
-- Outbox delivery state: an event that keeps failing is parked (dead-lettered) for a human to look at
-- instead of being retried forever.
-- ---------------------------------------------------------------------------
ALTER TABLE platform.outbox_event ADD COLUMN dead_lettered_at timestamptz;
DROP INDEX platform.outbox_event_pending;
CREATE INDEX outbox_event_pending ON platform.outbox_event (occurred_at) WHERE processed_at IS NULL AND dead_lettered_at IS NULL;

-- inbox_record: which consumer already handled which event; makes redelivery harmless.
-- (Moves to the integration module's schema when M16 is built.)
CREATE TABLE platform.inbox_record (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  consumer     text NOT NULL,
  event_id     uuid NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, consumer, event_id)
);
SELECT platform.apply_tenant_rls('platform.inbox_record');
GRANT INSERT ON platform.inbox_record TO mod_platform, mod_patient, mod_catalog, mod_booking;

-- ---------------------------------------------------------------------------
-- Worker functions. The worker has no tenant context, so these run as the owner (SECURITY DEFINER)
-- and do exactly one thing each. Event handlers themselves run per tenant, under RLS.
-- ---------------------------------------------------------------------------

-- Leases up to p_limit undelivered events (oldest first). A lease that isn't completed in time
-- expires and the event is offered again.
CREATE FUNCTION platform.claim_outbox_events(p_limit integer, p_lease interval DEFAULT interval '60 seconds')
RETURNS TABLE (id uuid, occurred_at timestamptz, tenant_id uuid, event_type text, aggregate_type text,
               aggregate_id uuid, aggregate_version integer, payload jsonb, correlation_id uuid, attempts integer)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, platform AS $$
  WITH next AS (
    SELECT e.id, e.occurred_at
    FROM platform.outbox_event e
    WHERE e.processed_at IS NULL AND e.dead_lettered_at IS NULL
      AND (e.claimed_until IS NULL OR e.claimed_until < now())
    ORDER BY e.occurred_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE platform.outbox_event e
  SET claimed_until = now() + p_lease, attempts = e.attempts + 1
  FROM next
  WHERE e.id = next.id AND e.occurred_at = next.occurred_at
  RETURNING e.id, e.occurred_at, e.tenant_id, e.event_type, e.aggregate_type, e.aggregate_id,
            e.aggregate_version, e.payload, e.correlation_id, e.attempts;
$$;

-- Events are addressed by id alone (uuidv7, unique): occurred_at can't be round-tripped exactly
-- through JavaScript, whose dates drop the microseconds PostgreSQL stores.
CREATE FUNCTION platform.complete_outbox_event(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, platform AS $$
  UPDATE platform.outbox_event
  SET processed_at = now(), claimed_until = NULL, last_error = NULL
  WHERE id = p_id;
$$;

-- Records a failure. Retries back off exponentially (capped at 1 hour); after p_max_attempts the
-- event is dead-lettered.
CREATE FUNCTION platform.fail_outbox_event(p_id uuid, p_error text, p_max_attempts integer DEFAULT 10)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, platform AS $$
  UPDATE platform.outbox_event
  SET last_error = left(p_error, 2000),
      claimed_until = now() + least(interval '1 hour', interval '5 seconds' * power(2, greatest(attempts - 1, 0))),
      dead_lettered_at = CASE WHEN attempts >= p_max_attempts THEN now() END
  WHERE id = p_id;
$$;

-- Keeps 3 months of partitions ahead for the partitioned platform tables.
CREATE FUNCTION platform.maintain_partitions() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, platform AS $$
BEGIN
  PERFORM platform.ensure_month_partitions('platform.audit_event', 3);
  PERFORM platform.ensure_month_partitions('platform.outbox_event', 3);
END $$;

-- Deletes idempotency records past their expiry (they only guard retries for a few days).
CREATE FUNCTION platform.purge_idempotency_records() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, platform AS $$
  WITH gone AS (DELETE FROM platform.idempotency_record WHERE expires_at < now() RETURNING 1)
  SELECT count(*)::integer FROM gone;
$$;

REVOKE EXECUTE ON FUNCTION platform.claim_outbox_events(integer, interval), platform.complete_outbox_event(uuid),
  platform.fail_outbox_event(uuid, text, integer), platform.maintain_partitions(),
  platform.purge_idempotency_records() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.claim_outbox_events(integer, interval), platform.complete_outbox_event(uuid),
  platform.fail_outbox_event(uuid, text, integer), platform.maintain_partitions(),
  platform.purge_idempotency_records() TO hms_app;

-- ---------------------------------------------------------------------------
-- Request authorization data: a staff member's active permissions per facility scope.
-- (facility_id NULL = granted for all facilities.) Readable under RLS like any other table.
-- ---------------------------------------------------------------------------
CREATE VIEW platform.staff_permission AS
  SELECT rg.tenant_id, rg.staff_id, rg.facility_id, p.code AS permission
  FROM platform.role_grant rg
  JOIN platform.role r ON r.id = rg.role_id AND r.status = 'active'
  JOIN platform.role_permission rp ON rp.role_id = r.id
  JOIN platform.permission p ON p.id = rp.permission_id
  WHERE rg.revoked_at IS NULL
    AND rg.valid_from <= now()
    AND (rg.valid_to IS NULL OR rg.valid_to > now());
ALTER VIEW platform.staff_permission SET (security_invoker = true);

-- migrate:down
DROP VIEW platform.staff_permission;
DROP FUNCTION platform.purge_idempotency_records();
DROP FUNCTION platform.maintain_partitions();
DROP FUNCTION platform.fail_outbox_event(uuid, text, integer);
DROP FUNCTION platform.complete_outbox_event(uuid);
DROP FUNCTION platform.claim_outbox_events(integer, interval);
DROP TABLE platform.inbox_record;
DROP INDEX platform.outbox_event_pending;
CREATE INDEX outbox_event_pending ON platform.outbox_event (occurred_at) WHERE processed_at IS NULL;
ALTER TABLE platform.outbox_event DROP COLUMN dead_lettered_at;
ALTER TABLE platform.staff DROP CONSTRAINT staff_system_account_type;
ALTER TABLE platform.staff DROP COLUMN is_system_account;
