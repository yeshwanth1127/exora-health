-- migrate:up
-- Persist a non-reversible owner fingerprint. Legacy receipts cannot be attributed safely and
-- must never be exposed through the outcome lookup. Fresh commands populate this atomically.
ALTER TABLE platform.idempotency_record ADD COLUMN actor_hash text
  CHECK (actor_hash IS NULL OR actor_hash ~ '^[0-9a-f]{64}$');

-- migrate:down
ALTER TABLE platform.idempotency_record DROP COLUMN actor_hash;
