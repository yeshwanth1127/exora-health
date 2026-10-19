-- migrate:up
ALTER TABLE comms.whatsapp_workspace ADD COLUMN booking_enabled_at timestamptz;
ALTER TABLE comms.outbound_message ADD COLUMN managed_purpose text NOT NULL DEFAULT 'reply' CHECK(managed_purpose IN('reply','booking','booking_prompt','reminder')),
 ADD COLUMN managed_inbound_id uuid,
 ADD COLUMN managed_details jsonb NOT NULL DEFAULT '{}',
 ADD CONSTRAINT outbound_inbound_fk FOREIGN KEY(tenant_id,managed_inbound_id) REFERENCES comms.inbound_message(tenant_id,id),
 ADD CONSTRAINT outbound_inbound_unique UNIQUE(tenant_id,managed_inbound_id);
CREATE INDEX ON comms.outbound_message(tenant_id,managed_inbound_id);
ALTER TABLE comms.managed_delivery ADD CONSTRAINT managed_delivery_connection_fk FOREIGN KEY(tenant_id,connection_id) REFERENCES comms.managed_connection(tenant_id,id);
CREATE INDEX ON comms.managed_delivery(tenant_id,connection_id);
CREATE TABLE comms.booking_chat (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),conversation_id uuid NOT NULL,
 state jsonb NOT NULL DEFAULT '{}',expires_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,conversation_id),FOREIGN KEY(tenant_id,conversation_id) REFERENCES comms.conversation(tenant_id,id)
);
SELECT platform.setup_tenant_table('comms.booking_chat','mod_comms');
CREATE TABLE comms.booking_chat_input (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),inbound_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,inbound_id),FOREIGN KEY(tenant_id,inbound_id) REFERENCES comms.inbound_message(tenant_id,id)
);
SELECT platform.setup_tenant_table('comms.booking_chat_input','mod_comms');
CREATE FUNCTION comms.booking_chat_candidates() RETURNS TABLE(tenant_id uuid,id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT i.tenant_id,i.id FROM comms.inbound_message i JOIN comms.conversation c ON c.tenant_id=i.tenant_id AND c.id=i.conversation_id
 JOIN comms.whatsapp_workspace w ON w.tenant_id=c.tenant_id AND w.facility_id=c.facility_id
 WHERE w.draft->>'live'='true' AND coalesce(w.draft->>'paused','false')<>'true' AND i.created_at>=w.booking_enabled_at
 AND i.received_at>now()-interval '24 hours' AND NOT EXISTS(SELECT 1 FROM comms.booking_chat_input p WHERE p.tenant_id=i.tenant_id AND p.inbound_id=i.id)
 ORDER BY i.created_at,i.id LIMIT 50
$$;
REVOKE ALL ON FUNCTION comms.booking_chat_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION comms.booking_chat_candidates() TO hms_app;
CREATE TABLE comms.booking_attribution (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),site_id uuid NOT NULL,appointment_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,appointment_id),FOREIGN KEY(tenant_id,site_id) REFERENCES comms.analytics_site(tenant_id,id),
 FOREIGN KEY(tenant_id,appointment_id) REFERENCES booking.appointment(tenant_id,id)
);
CREATE INDEX ON comms.booking_attribution(tenant_id,site_id);
SELECT platform.setup_tenant_table('comms.booking_attribution','mod_comms');
CREATE TABLE comms.analytics_mirror (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),site_id uuid NOT NULL,
 payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','done','failed')),
 attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,site_id) REFERENCES comms.analytics_site(tenant_id,id)
);
CREATE INDEX ON comms.analytics_mirror(tenant_id,site_id);
CREATE INDEX ON comms.analytics_mirror(status,next_attempt_at);
SELECT platform.setup_tenant_table('comms.analytics_mirror','mod_comms');
CREATE FUNCTION comms.analytics_mirror_candidates() RETURNS TABLE(tenant_id uuid,id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT tenant_id,id FROM comms.analytics_mirror WHERE status='pending' AND next_attempt_at<=now() ORDER BY next_attempt_at,id LIMIT 50
$$;
REVOKE ALL ON FUNCTION comms.analytics_mirror_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION comms.analytics_mirror_candidates() TO hms_app;
CREATE TABLE comms.managed_automation (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),facility_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('confirmation','day_before','same_day','reschedule','cancellation')),
 enabled boolean NOT NULL DEFAULT false,enabled_at timestamptz NOT NULL DEFAULT now(),provider_status text NOT NULL DEFAULT 'not_submitted' CHECK(provider_status IN('not_submitted','pending','approved','rejected','unknown')),
 attempted_at timestamptz,connection_id uuid NOT NULL,created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,facility_id,kind),FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),
 FOREIGN KEY(tenant_id,connection_id) REFERENCES comms.managed_connection(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES platform.staff(tenant_id,id)
);
CREATE INDEX ON comms.managed_automation(tenant_id,connection_id);
CREATE INDEX ON comms.managed_automation(tenant_id,created_by);
SELECT platform.setup_tenant_table('comms.managed_automation','mod_comms');
CREATE OR REPLACE FUNCTION comms.managed_send_candidates() RETURNS TABLE(tenant_id uuid,id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT m.tenant_id,m.id FROM comms.outbound_message m JOIN comms.managed_connection c ON c.tenant_id=m.tenant_id AND c.facility_id=m.facility_id AND c.provider='whatsapp' AND c.enabled
 LEFT JOIN comms.reminder_job j ON j.tenant_id=m.tenant_id AND j.id=m.reminder_job_id
 WHERE m.managed_send_requested AND m.status='queued' AND m.transport='log'
 AND (m.conversation_id IS NOT NULL OR (j.status IN('scheduled','queued') AND j.due_at<=now()))
 AND NOT EXISTS(SELECT 1 FROM comms.managed_delivery d WHERE d.tenant_id=m.tenant_id AND d.outbound_id=m.id)
 ORDER BY m.created_at,m.id LIMIT 50
$$;


CREATE FUNCTION comms.managed_automation_candidates() RETURNS TABLE(tenant_id uuid,facility_id uuid,kind text) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT tenant_id,facility_id,kind FROM comms.managed_automation WHERE enabled AND provider_status IN('pending','unknown') AND updated_at<now()-interval '1 minute' ORDER BY updated_at,id LIMIT 20
$$;
REVOKE ALL ON FUNCTION comms.managed_automation_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION comms.managed_automation_candidates() TO hms_app;

CREATE TABLE comms.google_scheduled_post (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),facility_id uuid NOT NULL,connection_id uuid NOT NULL,
 external_id text NOT NULL,payload jsonb NOT NULL,due_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'scheduled' CHECK(status IN('scheduled','claimed','accepted','unknown','cancelled')),
 actor_staff_id uuid NOT NULL,actor_user_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),
 FOREIGN KEY(tenant_id,connection_id) REFERENCES comms.managed_connection(tenant_id,id),FOREIGN KEY(tenant_id,actor_staff_id) REFERENCES platform.staff(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_user_id) REFERENCES platform.user_account(tenant_id,id)
);
CREATE INDEX ON comms.google_scheduled_post(tenant_id,facility_id);
CREATE INDEX ON comms.google_scheduled_post(tenant_id,connection_id);
CREATE INDEX ON comms.google_scheduled_post(tenant_id,actor_staff_id);
CREATE INDEX ON comms.google_scheduled_post(tenant_id,actor_user_id);
CREATE INDEX ON comms.google_scheduled_post(status,due_at);
SELECT platform.setup_tenant_table('comms.google_scheduled_post','mod_comms');
CREATE FUNCTION comms.google_post_candidates() RETURNS TABLE(tenant_id uuid,id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT tenant_id,id FROM comms.google_scheduled_post WHERE status='scheduled' AND due_at<=now() ORDER BY due_at,id LIMIT 20
$$;
REVOKE ALL ON FUNCTION comms.google_post_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION comms.google_post_candidates() TO hms_app;

CREATE TABLE comms.managed_broadcast (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),facility_id uuid NOT NULL,connection_id uuid NOT NULL,
 title text NOT NULL,template jsonb NOT NULL,audience_hash text NOT NULL,recipient_count integer NOT NULL,budget_minor integer NOT NULL,estimate_minor integer NOT NULL,
 due_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','scheduled','paused')),
 created_by uuid NOT NULL,approved_by uuid,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),FOREIGN KEY(tenant_id,connection_id) REFERENCES comms.managed_connection(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES platform.staff(tenant_id,id),FOREIGN KEY(tenant_id,approved_by) REFERENCES platform.staff(tenant_id,id)
);
CREATE INDEX ON comms.managed_broadcast(tenant_id,facility_id);
CREATE INDEX ON comms.managed_broadcast(tenant_id,connection_id);
CREATE INDEX ON comms.managed_broadcast(tenant_id,created_by);
CREATE INDEX ON comms.managed_broadcast(tenant_id,approved_by);
SELECT platform.setup_tenant_table('comms.managed_broadcast','mod_comms');
ALTER TABLE comms.outbound_message ADD COLUMN managed_broadcast_id uuid,
 ADD CONSTRAINT outbound_broadcast_fk FOREIGN KEY(tenant_id,managed_broadcast_id) REFERENCES comms.managed_broadcast(tenant_id,id),
 ADD CONSTRAINT outbound_broadcast_unique UNIQUE(tenant_id,managed_broadcast_id,contact_point_id);
ALTER TABLE comms.outbound_message DROP CONSTRAINT outbound_owner,DROP CONSTRAINT outbound_message_managed_purpose_check;
ALTER TABLE comms.outbound_message ADD CONSTRAINT outbound_owner CHECK(num_nonnulls(reminder_job_id,conversation_id,managed_broadcast_id)=1),
 ADD CONSTRAINT outbound_message_managed_purpose_check CHECK(managed_purpose IN('reply','booking','booking_prompt','reminder','broadcast'));
CREATE OR REPLACE FUNCTION comms.managed_send_candidates() RETURNS TABLE(tenant_id uuid,id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT m.tenant_id,m.id FROM comms.outbound_message m JOIN comms.managed_connection c ON c.tenant_id=m.tenant_id AND c.facility_id=m.facility_id AND c.provider='whatsapp' AND c.enabled
 LEFT JOIN comms.reminder_job j ON j.tenant_id=m.tenant_id AND j.id=m.reminder_job_id
 LEFT JOIN comms.managed_broadcast b ON b.tenant_id=m.tenant_id AND b.id=m.managed_broadcast_id
 JOIN platform.facility f ON f.id=m.facility_id AND f.tenant_id=m.tenant_id
 LEFT JOIN comms.whatsapp_workspace w ON w.facility_id=m.facility_id AND w.tenant_id=m.tenant_id
 WHERE m.managed_send_requested AND m.status='queued' AND m.transport='log'
 AND (m.conversation_id IS NOT NULL OR (j.status IN('scheduled','queued') AND j.due_at<=now()) OR (b.status='scheduled' AND b.due_at<=now()))
 AND (m.managed_purpose NOT IN('reminder','broadcast') OR NOT (
 coalesce((w.preferences#>>'{quiet,on}')::boolean,true)
 AND coalesce(w.preferences#>>'{quiet,from}','21:00')<>coalesce(w.preferences#>>'{quiet,to}','08:00')
 AND CASE WHEN coalesce(w.preferences#>>'{quiet,from}','21:00')<coalesce(w.preferences#>>'{quiet,to}','08:00')
 THEN to_char(now() AT TIME ZONE f.timezone,'HH24:MI')>=coalesce(w.preferences#>>'{quiet,from}','21:00') AND to_char(now() AT TIME ZONE f.timezone,'HH24:MI')<coalesce(w.preferences#>>'{quiet,to}','08:00')
 ELSE to_char(now() AT TIME ZONE f.timezone,'HH24:MI')>=coalesce(w.preferences#>>'{quiet,from}','21:00') OR to_char(now() AT TIME ZONE f.timezone,'HH24:MI')<coalesce(w.preferences#>>'{quiet,to}','08:00') END))
 AND NOT EXISTS(SELECT 1 FROM comms.managed_delivery d WHERE d.tenant_id=m.tenant_id AND d.outbound_id=m.id)
 ORDER BY m.created_at,m.id LIMIT 50
$$;

-- migrate:down
DO $$ BEGIN IF EXISTS(SELECT 1 FROM comms.outbound_message WHERE managed_broadcast_id IS NOT NULL) THEN RAISE EXCEPTION 'Cannot roll back managed operations with promotion delivery history'; END IF; END $$;
CREATE OR REPLACE FUNCTION comms.managed_send_candidates() RETURNS TABLE(tenant_id uuid,id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT m.tenant_id,m.id FROM comms.outbound_message m JOIN comms.managed_connection c ON c.tenant_id=m.tenant_id AND c.facility_id=m.facility_id AND c.provider='whatsapp' AND c.enabled
 WHERE m.managed_send_requested AND m.status='queued' AND m.transport='log' AND m.conversation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM comms.managed_delivery d WHERE d.tenant_id=m.tenant_id AND d.outbound_id=m.id)
 ORDER BY m.created_at,m.id LIMIT 50
$$;

ALTER TABLE comms.outbound_message DROP CONSTRAINT outbound_owner,DROP COLUMN managed_broadcast_id;
ALTER TABLE comms.outbound_message ADD CONSTRAINT outbound_owner CHECK((reminder_job_id IS NULL)<>(conversation_id IS NULL));
DROP TABLE comms.managed_broadcast;
DROP FUNCTION comms.google_post_candidates();
DROP TABLE comms.google_scheduled_post;
DROP FUNCTION comms.managed_automation_candidates();
DROP TABLE comms.managed_automation;
DROP FUNCTION comms.analytics_mirror_candidates();
DROP TABLE comms.analytics_mirror,comms.booking_attribution;
DROP FUNCTION comms.booking_chat_candidates();
DROP TABLE comms.booking_chat_input,comms.booking_chat;
ALTER TABLE comms.managed_delivery DROP CONSTRAINT managed_delivery_connection_fk;
ALTER TABLE comms.outbound_message DROP COLUMN managed_details,DROP COLUMN managed_inbound_id,DROP COLUMN managed_purpose;
ALTER TABLE comms.whatsapp_workspace DROP COLUMN booking_enabled_at;
