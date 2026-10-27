-- migrate:up
ALTER TABLE comms.inbound_message ADD COLUMN interactive_reply jsonb;
ALTER TABLE comms.inbound_message ADD CONSTRAINT inbound_interactive_reply_size CHECK (interactive_reply IS NULL OR pg_column_size(interactive_reply)<=8192);
-- migrate:down
ALTER TABLE comms.inbound_message DROP COLUMN interactive_reply;
