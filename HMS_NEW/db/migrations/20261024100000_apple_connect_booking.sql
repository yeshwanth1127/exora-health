-- migrate:up
ALTER TABLE booking.appointment DROP CONSTRAINT appointment_origin_channel_check;
ALTER TABLE booking.appointment ADD CONSTRAINT appointment_origin_channel_check
 CHECK(origin_channel IN ('web','portal','whatsapp','voice','front_desk','walk_in','referral','apple_messages'));
CREATE TABLE comms.apple_conversation (
 id uuid PRIMARY KEY DEFAULT uuidv7(), tenant_id uuid NOT NULL REFERENCES platform.tenant(id), facility_id uuid NOT NULL,
 instance_arn text NOT NULL, contact_id uuid NOT NULL,
 source text NOT NULL CHECK(source IN ('amazon_connect','local_demo')),
 status text NOT NULL DEFAULT 'automation' CHECK(status IN ('automation','handoff','closed')),
 state jsonb NOT NULL DEFAULT '{}', state_expires_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id), UNIQUE(instance_arn,contact_id),
 FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id)
);
SELECT platform.setup_tenant_table('comms.apple_conversation','mod_comms');
CREATE INDEX ON comms.apple_conversation(tenant_id,facility_id);
CREATE TABLE comms.apple_message (
 id uuid PRIMARY KEY DEFAULT uuidv7(), tenant_id uuid NOT NULL REFERENCES platform.tenant(id), conversation_id uuid NOT NULL,
 direction text NOT NULL CHECK(direction IN ('inbound','outbound')),
 provider_id text, text_content text NOT NULL CHECK(length(text_content)<=4096), occurred_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL CHECK(status IN ('received','queued','accepted','failed','cancelled')),
 reply_to uuid, actor_staff_id uuid, processed_at timestamptz, provider_response_id text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,conversation_id,provider_id), UNIQUE(tenant_id,reply_to),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES comms.apple_conversation(tenant_id,id),
 FOREIGN KEY(tenant_id,reply_to) REFERENCES comms.apple_message(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_staff_id) REFERENCES platform.staff(tenant_id,id),
 CHECK((direction='inbound')=(status='received'))
);
CREATE INDEX ON comms.apple_message(tenant_id,conversation_id,occurred_at);
CREATE INDEX ON comms.apple_message(tenant_id,reply_to);
CREATE INDEX ON comms.apple_message(tenant_id,actor_staff_id);
SELECT platform.setup_tenant_table('comms.apple_message','mod_comms');
GRANT SELECT ON comms.apple_conversation,comms.apple_message TO mod_booking;
-- migrate:down
DROP TABLE comms.apple_message,comms.apple_conversation;
ALTER TABLE booking.appointment DROP CONSTRAINT appointment_origin_channel_check;
ALTER TABLE booking.appointment ADD CONSTRAINT appointment_origin_channel_check
 CHECK(origin_channel IN ('web','portal','whatsapp','voice','front_desk','walk_in','referral'));
