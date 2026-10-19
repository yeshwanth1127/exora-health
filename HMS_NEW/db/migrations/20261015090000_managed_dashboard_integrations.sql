-- migrate:up
CREATE TABLE comms.managed_connection (
 id uuid PRIMARY KEY DEFAULT uuidv7(), tenant_id uuid NOT NULL REFERENCES platform.tenant(id), facility_id uuid NOT NULL,
 provider text NOT NULL CHECK(provider IN ('google','whatsapp')), external_id text NOT NULL,
 credential text NOT NULL, enabled boolean NOT NULL DEFAULT true, metadata jsonb NOT NULL DEFAULT '{}',
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,facility_id,provider), UNIQUE(provider,external_id),
 FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id), FOREIGN KEY(tenant_id,created_by) REFERENCES platform.staff(tenant_id,id)
);
SELECT platform.setup_tenant_table('comms.managed_connection','mod_comms');
CREATE TABLE comms.integration_attempt (
 id uuid PRIMARY KEY DEFAULT uuidv7(), tenant_id uuid NOT NULL REFERENCES platform.tenant(id), facility_id uuid NOT NULL,
 provider text NOT NULL CHECK(provider IN ('google','whatsapp')), actor_staff_id uuid NOT NULL, actor_user_id uuid NOT NULL,
 state_hash text NOT NULL UNIQUE, verifier text NOT NULL, credential text,
 UNIQUE(tenant_id,id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','exchanging','ready','used','failed')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id), FOREIGN KEY(tenant_id,actor_staff_id) REFERENCES platform.staff(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_user_id) REFERENCES platform.user_account(tenant_id,id)
);
SELECT platform.setup_tenant_table('comms.integration_attempt','mod_comms');
-- The public callback can resolve only an opaque state to a tenant, never credentials.
CREATE FUNCTION comms.integration_tenant(state_digest text) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT tenant_id FROM comms.integration_attempt WHERE state_hash=state_digest AND status='pending' AND expires_at>now()
$$;
REVOKE ALL ON FUNCTION comms.integration_tenant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION comms.integration_tenant(text) TO hms_app;
CREATE TABLE comms.analytics_site (
 id uuid PRIMARY KEY DEFAULT uuidv7(), tenant_id uuid NOT NULL REFERENCES platform.tenant(id), facility_id uuid NOT NULL,
 origin text NOT NULL, kind text NOT NULL CHECK(kind IN ('booking','own')), umami_id uuid NOT NULL UNIQUE,
 enabled boolean NOT NULL DEFAULT true, retired boolean NOT NULL DEFAULT false, last_event_at timestamptz, created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,facility_id,origin),
 FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id), FOREIGN KEY(tenant_id,created_by) REFERENCES platform.staff(tenant_id,id)
);
CREATE INDEX ON comms.analytics_site(tenant_id,facility_id);
SELECT platform.setup_tenant_table('comms.analytics_site','mod_comms');
CREATE FUNCTION comms.analytics_site_tenant(site_id uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT tenant_id FROM comms.analytics_site WHERE id=site_id AND enabled AND NOT retired
$$;
REVOKE ALL ON FUNCTION comms.analytics_site_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION comms.analytics_site_tenant(uuid) TO hms_app;
CREATE TABLE comms.whatsapp_workspace (
 id uuid PRIMARY KEY DEFAULT uuidv7(), tenant_id uuid NOT NULL REFERENCES platform.tenant(id), facility_id uuid NOT NULL,
 draft jsonb NOT NULL DEFAULT '{}', preferences jsonb NOT NULL DEFAULT '{}',
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,facility_id), FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES platform.staff(tenant_id,id)
);
SELECT platform.setup_tenant_table('comms.whatsapp_workspace','mod_comms');
-- Live sends use a separate irreversible-attempt ledger; log rows cannot claim delivery.
ALTER TABLE comms.outbound_message ADD COLUMN managed_send_requested boolean NOT NULL DEFAULT false;
ALTER TABLE comms.outbound_message DROP CONSTRAINT outbound_message_transport_check;
ALTER TABLE comms.outbound_message ADD CONSTRAINT outbound_message_transport_check CHECK(transport IN ('log','meta'));
CREATE TABLE comms.managed_delivery (
 id uuid PRIMARY KEY DEFAULT uuidv7(), tenant_id uuid NOT NULL REFERENCES platform.tenant(id), outbound_id uuid NOT NULL,
 connection_id uuid NOT NULL, provider_message_id text, state text NOT NULL DEFAULT 'claimed' CHECK(state IN ('claimed','accepted','uncertain','failed')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,outbound_id), UNIQUE(provider_message_id),
 FOREIGN KEY(tenant_id,outbound_id) REFERENCES comms.outbound_message(tenant_id,id)
);
SELECT platform.setup_tenant_table('comms.managed_delivery','mod_comms');
CREATE FUNCTION comms.managed_send_candidates() RETURNS TABLE(tenant_id uuid,id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT m.tenant_id,m.id FROM comms.outbound_message m JOIN comms.managed_connection c ON c.tenant_id=m.tenant_id AND c.facility_id=m.facility_id AND c.provider='whatsapp' AND c.enabled
 WHERE m.managed_send_requested AND m.status='queued' AND m.transport='log' AND m.conversation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM comms.managed_delivery d WHERE d.tenant_id=m.tenant_id AND d.outbound_id=m.id)
 ORDER BY m.created_at,m.id LIMIT 50
$$;
REVOKE ALL ON FUNCTION comms.managed_send_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION comms.managed_send_candidates() TO hms_app;
CREATE INDEX ON comms.managed_connection(tenant_id,created_by);
CREATE INDEX ON comms.integration_attempt(tenant_id,facility_id);
CREATE INDEX ON comms.integration_attempt(tenant_id,actor_staff_id);
CREATE INDEX ON comms.integration_attempt(tenant_id,actor_user_id);
CREATE INDEX ON comms.analytics_site(tenant_id,created_by);
CREATE INDEX ON comms.whatsapp_workspace(tenant_id,created_by);
-- migrate:down
DROP FUNCTION comms.managed_send_candidates();
DROP TABLE comms.managed_delivery;
-- Refuse rollback while real sends exist rather than rewriting delivery history as simulation.
ALTER TABLE comms.outbound_message DROP CONSTRAINT outbound_message_transport_check;
ALTER TABLE comms.outbound_message ADD CONSTRAINT outbound_message_transport_check CHECK(transport='log');
ALTER TABLE comms.outbound_message DROP COLUMN managed_send_requested;
DROP TABLE comms.whatsapp_workspace;
DROP FUNCTION comms.analytics_site_tenant(uuid);
DROP TABLE comms.analytics_site;
DROP FUNCTION comms.integration_tenant(text);
DROP TABLE comms.integration_attempt,comms.managed_connection;
