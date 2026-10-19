-- migrate:up
-- Preserve the receiving phone on immutable inbound records. Historical unbound rows cannot open a live reply window.
ALTER TABLE comms.inbound_message ADD COLUMN phone_number_id text CHECK(phone_number_id ~ '^[0-9]{5,40}$');
CREATE INDEX ON comms.inbound_message(tenant_id,conversation_id,phone_number_id,received_at);
-- migrate:down
ALTER TABLE comms.inbound_message DROP COLUMN phone_number_id;
