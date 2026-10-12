-- migrate:up
ALTER TABLE comms.messaging_consent_event DROP CONSTRAINT messaging_consent_event_source_check;
ALTER TABLE comms.messaging_consent_event ADD CONSTRAINT messaging_consent_event_source_check CHECK(source IN('staff','provider'));
ALTER TABLE comms.messaging_consent_event ALTER COLUMN recorded_by DROP NOT NULL;
ALTER TABLE comms.messaging_consent_event ADD CONSTRAINT messaging_consent_actor CHECK(source<>'staff' OR recorded_by IS NOT NULL);
-- Narrow booking-owned bridge for previously unregistered inbound senders; never creates a patient.
CREATE OR REPLACE FUNCTION booking.create_comms_caller(phone text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,booking,platform AS $$
DECLARE caller_id uuid;
BEGIN
 IF phone !~ '^\+[1-9][0-9]{7,14}$' THEN RAISE EXCEPTION 'invalid phone' USING ERRCODE='23514'; END IF;
 INSERT INTO booking.booking_party(tenant_id,name,phone) VALUES(platform.current_tenant_id(),'WhatsApp caller (unverified)',phone) RETURNING id INTO caller_id;
 RETURN caller_id;
END $$;
REVOKE ALL ON FUNCTION booking.create_comms_caller(text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION booking.create_comms_caller(text) TO mod_comms;
-- migrate:down
DROP FUNCTION booking.create_comms_caller(text);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM comms.messaging_consent_event WHERE source='provider') THEN RAISE EXCEPTION 'Provider consent history exists; use a forward migration rather than deleting audit history'; END IF; END $$;
ALTER TABLE comms.messaging_consent_event DROP CONSTRAINT messaging_consent_actor,DROP CONSTRAINT messaging_consent_event_source_check;
ALTER TABLE comms.messaging_consent_event ADD CONSTRAINT messaging_consent_event_source_check CHECK(source='staff');
ALTER TABLE comms.messaging_consent_event ALTER COLUMN recorded_by SET NOT NULL;
