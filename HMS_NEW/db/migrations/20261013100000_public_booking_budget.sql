-- migrate:up
ALTER TABLE catalog.practitioner_profile ADD COLUMN public_photo_url text
 CHECK(public_photo_url IS NULL OR public_photo_url ~ '^(/clients/[A-Za-z0-9_./-]+|https://[^[:space:]]+)$');
-- Shared across API replicas. No raw IP, phone or name is retained in request budgets.
CREATE TABLE booking.public_request_budget (
 id uuid NOT NULL DEFAULT uuidv7(),
 tenant_id uuid NOT NULL REFERENCES platform.tenant(id),
 site_slug text NOT NULL CHECK(site_slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
 subject_hash text NOT NULL CHECK(subject_hash ~ '^[0-9a-f]{64}$'),
 bucket_start timestamptz NOT NULL,
 requests integer NOT NULL CHECK(requests>0),
 UNIQUE(tenant_id,id),
 PRIMARY KEY(tenant_id,site_slug,subject_hash,bucket_start)
);
ALTER TABLE booking.public_request_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking.public_request_budget FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_budget ON booking.public_request_budget
 USING(tenant_id=(SELECT platform.current_tenant_id())) WITH CHECK(tenant_id=(SELECT platform.current_tenant_id()));
GRANT SELECT,INSERT,UPDATE,DELETE ON booking.public_request_budget TO mod_booking;
CREATE INDEX ON booking.public_request_budget(tenant_id,bucket_start);
-- migrate:down
DROP TABLE booking.public_request_budget;
ALTER TABLE catalog.practitioner_profile DROP COLUMN public_photo_url;
