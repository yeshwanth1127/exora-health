-- migrate:up
ALTER TABLE comms.voice_call ADD COLUMN recording_revoked_at timestamptz,ADD COLUMN transcript_revoked_at timestamptz;
CREATE TABLE comms.voice_consent_event (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),call_id uuid NOT NULL,
 recording_requested boolean NOT NULL,transcript_requested boolean NOT NULL,recording_effective boolean NOT NULL,transcript_effective boolean NOT NULL,
 occurred_at timestamptz NOT NULL,evidence text NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,call_id) REFERENCES comms.voice_call(tenant_id,id)
);
CREATE INDEX ON comms.voice_consent_event(tenant_id,call_id,created_at,id);
SELECT platform.apply_tenant_rls('comms.voice_consent_event');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON comms.voice_consent_event FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON comms.voice_consent_event TO mod_comms;
-- migrate:down
DROP TABLE comms.voice_consent_event;
ALTER TABLE comms.voice_call DROP COLUMN recording_revoked_at,DROP COLUMN transcript_revoked_at;
