-- migrate:up
CREATE TABLE comms.channel_account (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),facility_id uuid NOT NULL,
 phone_number_id text NOT NULL CHECK(phone_number_id ~ '^[0-9]{5,40}$'),
 created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,facility_id),UNIQUE(phone_number_id),FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id)
);
SELECT platform.setup_tenant_table('comms.channel_account','mod_comms');
CREATE FUNCTION comms.account_for_phone(phone_id text) RETURNS TABLE(id uuid,tenant_id uuid,facility_id uuid)
 LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$ SELECT a.id,a.tenant_id,a.facility_id FROM comms.channel_account a WHERE a.phone_number_id=phone_id $$;
REVOKE ALL ON FUNCTION comms.account_for_phone(text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION comms.account_for_phone(text) TO hms_app;
CREATE TABLE comms.conversation (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),facility_id uuid NOT NULL,contact_point_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN('open','closed')),assigned_staff_id uuid,last_inbound_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,contact_point_id),FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),FOREIGN KEY(tenant_id,contact_point_id) REFERENCES comms.contact_point(tenant_id,id),FOREIGN KEY(tenant_id,assigned_staff_id) REFERENCES platform.staff(tenant_id,id)
);
CREATE INDEX ON comms.conversation(tenant_id,facility_id);CREATE INDEX ON comms.conversation(tenant_id,assigned_staff_id);
SELECT platform.setup_tenant_table('comms.conversation','mod_comms');
CREATE TABLE comms.inbound_message (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),conversation_id uuid NOT NULL,account_id uuid NOT NULL,
 provider_message_id text NOT NULL,text_content text NOT NULL,received_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,account_id,provider_message_id),FOREIGN KEY(tenant_id,conversation_id) REFERENCES comms.conversation(tenant_id,id),FOREIGN KEY(tenant_id,account_id) REFERENCES comms.channel_account(tenant_id,id)
);
CREATE INDEX ON comms.inbound_message(tenant_id,conversation_id);SELECT platform.apply_tenant_rls('comms.inbound_message');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON comms.inbound_message FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();GRANT INSERT ON comms.inbound_message TO mod_comms;
CREATE TABLE comms.support_case (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),conversation_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('issue','feedback')),description text NOT NULL,rating integer CHECK(rating BETWEEN 1 AND 5),status text NOT NULL DEFAULT 'open' CHECK(status IN('open','in_progress','resolved')),
 created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,conversation_id) REFERENCES comms.conversation(tenant_id,id)
);
CREATE INDEX ON comms.support_case(tenant_id,conversation_id);SELECT platform.setup_tenant_table('comms.support_case','mod_comms');
ALTER TABLE comms.outbound_message ALTER COLUMN reminder_job_id DROP NOT NULL;
ALTER TABLE comms.outbound_message ADD COLUMN conversation_id uuid,ADD COLUMN text_content text,ADD COLUMN created_by uuid,
 ADD CONSTRAINT outbound_conversation_fk FOREIGN KEY(tenant_id,conversation_id) REFERENCES comms.conversation(tenant_id,id),
 ADD CONSTRAINT outbound_owner CHECK((reminder_job_id IS NULL)<>(conversation_id IS NULL));
CREATE INDEX ON comms.outbound_message(tenant_id,conversation_id);
CREATE TABLE comms.asset (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),facility_id uuid NOT NULL,
 owner_type text NOT NULL CHECK(owner_type IN('practitioner','department','campaign')),owner_id uuid,
 filename text NOT NULL,mime_type text NOT NULL CHECK(mime_type IN('image/jpeg','image/png','application/pdf')),size_bytes integer NOT NULL CHECK(size_bytes>0),sha256 text NOT NULL,object_key text NOT NULL UNIQUE,
 status text NOT NULL CHECK(status IN('local_validated','quarantined','retired')),
 created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id)
);
CREATE INDEX ON comms.asset(tenant_id,facility_id);SELECT platform.setup_tenant_table('comms.asset','mod_comms');
CREATE TABLE comms.message_template (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),facility_id uuid NOT NULL,
 name text NOT NULL,body text NOT NULL,language text NOT NULL,category text NOT NULL CHECK(category IN('utility','marketing')),parameter_count integer NOT NULL CHECK(parameter_count BETWEEN 0 AND 10),header text NOT NULL CHECK(header IN('text','image','none')),
 provider_approval text NOT NULL DEFAULT 'not_synced' CHECK(provider_approval IN('not_synced','approved','rejected','pending')),
 created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,facility_id,name,language),FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id)
);
SELECT platform.setup_tenant_table('comms.message_template','mod_comms');
CREATE TABLE comms.contact_interest (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),contact_point_id uuid NOT NULL,interest text NOT NULL,evidence text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),created_by uuid, UNIQUE(tenant_id,id),UNIQUE(tenant_id,contact_point_id,interest),FOREIGN KEY(tenant_id,contact_point_id) REFERENCES comms.contact_point(tenant_id,id)
);
SELECT platform.apply_tenant_rls('comms.contact_interest');CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON comms.contact_interest FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();GRANT INSERT ON comms.contact_interest TO mod_comms;
CREATE TABLE comms.campaign (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),facility_id uuid NOT NULL,title text NOT NULL,template_id uuid NOT NULL,parameters jsonb NOT NULL,asset_id uuid,scheduled_at timestamptz NOT NULL,interest text,
 rate_minor integer NOT NULL CHECK(rate_minor>=0),budget_minor bigint NOT NULL CHECK(budget_minor>=0),reserved_minor bigint NOT NULL DEFAULT 0 CHECK(reserved_minor>=0 AND reserved_minor<=budget_minor),status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','scheduled','paused','completed')),
 approval_hash text,approved_by uuid,approved_count integer NOT NULL DEFAULT 0,local_tested boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),FOREIGN KEY(tenant_id,template_id) REFERENCES comms.message_template(tenant_id,id),FOREIGN KEY(tenant_id,asset_id) REFERENCES comms.asset(tenant_id,id),FOREIGN KEY(tenant_id,approved_by) REFERENCES platform.staff(tenant_id,id)
);
CREATE INDEX ON comms.campaign(tenant_id,facility_id);CREATE INDEX ON comms.campaign(tenant_id,template_id);CREATE INDEX ON comms.campaign(tenant_id,asset_id);CREATE INDEX ON comms.campaign(tenant_id,approved_by);SELECT platform.setup_tenant_table('comms.campaign','mod_comms');
CREATE TABLE comms.campaign_recipient (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),campaign_id uuid NOT NULL,contact_point_id uuid NOT NULL,address_hash text NOT NULL,
 reserved_minor integer NOT NULL CHECK(reserved_minor>=0),status text NOT NULL CHECK(status IN('queued','excluded','cancelled')),excluded_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,campaign_id,address_hash),FOREIGN KEY(tenant_id,campaign_id) REFERENCES comms.campaign(tenant_id,id),FOREIGN KEY(tenant_id,contact_point_id) REFERENCES comms.contact_point(tenant_id,id)
);
CREATE INDEX ON comms.campaign_recipient(tenant_id,contact_point_id);SELECT platform.setup_tenant_table('comms.campaign_recipient','mod_comms');
CREATE TABLE comms.provider_event (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),account_id uuid NOT NULL,event_key text NOT NULL,payload jsonb NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,account_id,event_key),FOREIGN KEY(tenant_id,account_id) REFERENCES comms.channel_account(tenant_id,id)
);
SELECT platform.apply_tenant_rls('comms.provider_event');CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON comms.provider_event FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();GRANT INSERT ON comms.provider_event TO mod_comms;
CREATE TABLE comms.delivery_receipt (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),account_id uuid NOT NULL,provider_event_id text NOT NULL,provider_message_id text NOT NULL,provider_status text NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,account_id,provider_event_id),FOREIGN KEY(tenant_id,account_id) REFERENCES comms.channel_account(tenant_id,id)
);
SELECT platform.apply_tenant_rls('comms.delivery_receipt');CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON comms.delivery_receipt FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();GRANT INSERT ON comms.delivery_receipt TO mod_comms;
-- migrate:down
-- Refuse destructive rollback once local conversations have outbound history.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM comms.outbound_message WHERE conversation_id IS NOT NULL) THEN
  RAISE EXCEPTION 'Cannot roll back WhatsApp workspace with outbound conversation history';
 END IF;
END $$;
DROP FUNCTION comms.account_for_phone(text);
DROP TABLE comms.delivery_receipt,comms.provider_event,comms.campaign_recipient,comms.campaign,comms.contact_interest,comms.message_template,comms.asset;
ALTER TABLE comms.outbound_message DROP CONSTRAINT outbound_owner,DROP CONSTRAINT outbound_conversation_fk,DROP COLUMN conversation_id,DROP COLUMN text_content,DROP COLUMN created_by;
ALTER TABLE comms.outbound_message ALTER COLUMN reminder_job_id SET NOT NULL;
DROP TABLE comms.support_case,comms.inbound_message,comms.conversation,comms.channel_account CASCADE;
