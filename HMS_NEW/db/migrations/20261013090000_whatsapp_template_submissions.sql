-- migrate:up
CREATE TABLE comms.template_submission (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES platform.tenant(id), facility_id uuid NOT NULL,
 template_id uuid NOT NULL, account_id uuid NOT NULL, requested_by uuid NOT NULL, requested_user_id uuid NOT NULL,
 template_version integer NOT NULL CHECK(template_version>0),
 provider_name text NOT NULL CHECK(provider_name ~ '^[a-z0-9_]+$' AND length(provider_name) BETWEEN 1 AND 512),
 body text NOT NULL CHECK(length(body) BETWEEN 3 AND 1024), language text NOT NULL,
 category text NOT NULL CHECK(category IN('utility','marketing')), parameter_count integer NOT NULL CHECK(parameter_count BETWEEN 0 AND 10),
 samples jsonb NOT NULL CHECK(jsonb_typeof(samples)='array' AND jsonb_array_length(samples)=parameter_count),
 content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[0-9a-f]{64}$'),
 phone_number_id text NOT NULL, business_account_id text NOT NULL, access_token_env text NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN('queued','dispatching','submitted','uncertain','failed','conflict','cancelled')),
 attempt_id uuid, attempted_at timestamptz, provider_template_id text CHECK(provider_template_id ~ '^[0-9]{1,40}$'), provider_status text,
 reason text, next_check_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id), UNIQUE(business_account_id,provider_name,language),
 FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),
 FOREIGN KEY(tenant_id,template_id) REFERENCES comms.message_template(tenant_id,id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES comms.channel_account(tenant_id,id),
 FOREIGN KEY(tenant_id,requested_by) REFERENCES platform.staff(tenant_id,id),
 FOREIGN KEY(tenant_id,requested_user_id) REFERENCES platform.user_account(tenant_id,id),
 CHECK((attempt_id IS NULL)=(attempted_at IS NULL)),
 CHECK(state NOT IN('dispatching','uncertain') OR attempt_id IS NOT NULL),
 CHECK(state<>'submitted' OR provider_template_id IS NOT NULL)
);
-- Samples, aliases and generated provider names must not bypass an uncertain creation.
CREATE UNIQUE INDEX template_submission_content_guard ON comms.template_submission(tenant_id,business_account_id,content_sha256)
 WHERE state NOT IN('failed','cancelled');
CREATE INDEX ON comms.template_submission(tenant_id,template_id,created_at DESC,id DESC);
CREATE INDEX ON comms.template_submission(tenant_id,facility_id);
CREATE INDEX ON comms.template_submission(tenant_id,account_id);
CREATE INDEX ON comms.template_submission(tenant_id,requested_by);
CREATE INDEX ON comms.template_submission(tenant_id,requested_user_id);
CREATE INDEX ON comms.template_submission(next_check_at,id) WHERE state IN('queued','dispatching','uncertain');
SELECT platform.setup_tenant_table('comms.template_submission','mod_comms');
CREATE FUNCTION comms.template_submission_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Template submission evidence cannot be deleted'; END IF;
 IF ROW(NEW.id,NEW.tenant_id,NEW.facility_id,NEW.template_id,NEW.account_id,NEW.requested_by,NEW.requested_user_id,
  NEW.template_version,NEW.provider_name,NEW.body,NEW.language,NEW.category,NEW.parameter_count,NEW.samples,
  NEW.content_sha256,NEW.phone_number_id,NEW.business_account_id,NEW.access_token_env,NEW.created_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.facility_id,OLD.template_id,OLD.account_id,OLD.requested_by,OLD.requested_user_id,
  OLD.template_version,OLD.provider_name,OLD.body,OLD.language,OLD.category,OLD.parameter_count,OLD.samples,
  OLD.content_sha256,OLD.phone_number_id,OLD.business_account_id,OLD.access_token_env,OLD.created_at) THEN
  RAISE EXCEPTION 'Template submission snapshot is immutable';
 END IF;
 IF OLD.attempt_id IS NOT NULL AND ROW(NEW.attempt_id,NEW.attempted_at) IS DISTINCT FROM ROW(OLD.attempt_id,OLD.attempted_at) THEN
  RAISE EXCEPTION 'Template creation attempt cannot be replaced';
 END IF;
 IF OLD.state<>'queued' AND NEW.state='queued' THEN RAISE EXCEPTION 'Template creation cannot be requeued'; END IF;
 IF OLD.state IN('submitted','failed','cancelled') AND NEW.state<>OLD.state THEN
  RAISE EXCEPTION 'Terminal template submission cannot change state';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER snapshot_guard BEFORE UPDATE OR DELETE ON comms.template_submission FOR EACH ROW EXECUTE FUNCTION comms.template_submission_guard();
CREATE FUNCTION comms.due_template_submissions(n integer) RETURNS TABLE(tenant_id uuid,id uuid)
 LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT s.tenant_id,s.id FROM comms.template_submission s
 WHERE s.state IN('queued','uncertain') AND s.next_check_at<=now()
 OR s.state='dispatching' AND s.attempted_at<now()-interval '2 minutes'
 ORDER BY s.next_check_at,s.id LIMIT least(greatest(n,0),100)
$$;
REVOKE ALL ON FUNCTION comms.due_template_submissions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION comms.due_template_submissions(integer) TO hms_app;
-- migrate:down
DO $$ BEGIN IF EXISTS(SELECT 1 FROM comms.template_submission) THEN
 RAISE EXCEPTION 'Cannot discard WhatsApp template submission evidence'; END IF; END $$;
DROP FUNCTION comms.due_template_submissions(integer);
DROP TABLE comms.template_submission;
DROP FUNCTION comms.template_submission_guard();
