-- migrate:up
-- Preserve the routing identity observed when a signed callback was accepted.
-- Historical rows stay unknown rather than backfilling an unverified original phone.
ALTER TABLE comms.provider_event
 ADD COLUMN facility_id uuid,
 ADD COLUMN phone_number_id text CHECK(phone_number_id ~ '^[0-9]{5,40}$'),
 ADD COLUMN business_account_id text CHECK(business_account_id ~ '^[0-9]{5,40}$'),
 ADD CONSTRAINT provider_event_facility_fk FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),
 ADD CONSTRAINT provider_event_binding_pair CHECK((facility_id IS NULL)=(phone_number_id IS NULL));
CREATE INDEX ON comms.provider_event(tenant_id,facility_id);
-- migrate:down
-- Dropping accepted routing evidence is not a safe rollback once it has been written.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM comms.provider_event WHERE facility_id IS NOT NULL) THEN
  RAISE EXCEPTION 'Cannot discard accepted WhatsApp callback routing evidence';
 END IF;
END $$;
ALTER TABLE comms.provider_event DROP CONSTRAINT provider_event_facility_fk,DROP CONSTRAINT provider_event_binding_pair,
 DROP COLUMN facility_id,DROP COLUMN phone_number_id,DROP COLUMN business_account_id;
