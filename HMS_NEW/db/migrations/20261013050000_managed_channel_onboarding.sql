-- migrate:up
-- Preference requests are separate from provider bindings. Staff cannot mark a channel live.
CREATE TABLE comms.channel_onboarding (
 id uuid PRIMARY KEY DEFAULT uuidv7(), tenant_id uuid NOT NULL REFERENCES platform.tenant(id), facility_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('voice','whatsapp')), state text NOT NULL CHECK(state IN ('draft','requested')),
 draft jsonb NOT NULL CHECK(jsonb_typeof(draft)='object' AND draft->>'channel'=channel), requested_at timestamptz,
 created_by uuid, updated_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,facility_id,channel),
 FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES platform.staff(tenant_id,id), FOREIGN KEY(tenant_id,updated_by) REFERENCES platform.staff(tenant_id,id),
 CHECK((state='requested')=(requested_at IS NOT NULL))
);
CREATE INDEX ON comms.channel_onboarding(tenant_id,created_by);
CREATE INDEX ON comms.channel_onboarding(tenant_id,updated_by);
SELECT platform.setup_tenant_table('comms.channel_onboarding','mod_comms');
INSERT INTO platform.permission(code,module_code,description,is_sensitive) VALUES
 ('voice.manage','comms','Manage clinic voice onboarding and routing preferences',true) ON CONFLICT(code) DO NOTHING;
INSERT INTO platform.role_permission(role_id,permission_id)
 SELECT r.id,p.id FROM platform.role r CROSS JOIN platform.permission p
 WHERE r.tenant_id IS NULL AND r.code='tenant_admin' AND p.code='voice.manage' ON CONFLICT DO NOTHING;
-- migrate:down
DROP TABLE comms.channel_onboarding;
DELETE FROM platform.role_permission WHERE permission_id IN (SELECT id FROM platform.permission WHERE code='voice.manage');
DELETE FROM platform.permission WHERE code='voice.manage';
