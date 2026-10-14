-- migrate:up
CREATE TABLE comms.template_provider_check (
 id uuid PRIMARY KEY DEFAULT uuidv7(), tenant_id uuid NOT NULL REFERENCES platform.tenant(id),
 facility_id uuid NOT NULL, template_id uuid NOT NULL, account_id uuid NOT NULL,
 template_version integer NOT NULL CHECK(template_version>0),
 phone_number_id text NOT NULL CHECK(phone_number_id ~ '^[0-9]{5,40}$'),
 business_account_id text NOT NULL CHECK(business_account_id ~ '^[0-9]{5,40}$'),
 provider_template_id text CHECK(provider_template_id ~ '^[0-9]{1,40}$'), provider_status text,
 content_match text NOT NULL CHECK(content_match IN('exact','different','missing','unsupported')),
 body_sha256 text NOT NULL CHECK(body_sha256 ~ '^[0-9a-f]{64}$'),
 checked_at timestamptz NOT NULL, checked_by uuid NOT NULL,
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),
 FOREIGN KEY(tenant_id,template_id) REFERENCES comms.message_template(tenant_id,id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES comms.channel_account(tenant_id,id),
 FOREIGN KEY(tenant_id,checked_by) REFERENCES platform.staff(tenant_id,id),
 CHECK((content_match='missing')=(provider_template_id IS NULL)),
 CHECK((provider_template_id IS NULL)=(provider_status IS NULL))
);
CREATE INDEX ON comms.template_provider_check(tenant_id,template_id,checked_at DESC,id DESC);
CREATE INDEX ON comms.template_provider_check(tenant_id,account_id);
CREATE INDEX ON comms.template_provider_check(tenant_id,facility_id);
CREATE INDEX ON comms.template_provider_check(tenant_id,checked_by);
SELECT platform.apply_tenant_rls('comms.template_provider_check');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON comms.template_provider_check FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON comms.template_provider_check TO mod_comms;
-- migrate:down
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM comms.template_provider_check) THEN
  RAISE EXCEPTION 'Cannot discard observed WhatsApp provider template evidence';
 END IF;
END $$;
DROP TABLE comms.template_provider_check;
