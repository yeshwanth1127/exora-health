-- migrate:up
CREATE TABLE comms.booking_link (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),facility_id uuid NOT NULL,
 booking_url text NOT NULL CHECK(char_length(booking_url)<=500),created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,facility_id),FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id)
);
SELECT platform.setup_tenant_table('comms.booking_link','mod_comms');
CREATE TABLE comms.booking_link_change (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),facility_id uuid NOT NULL,actor_staff_id uuid NOT NULL,
 before_url text,after_url text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),FOREIGN KEY(tenant_id,actor_staff_id) REFERENCES platform.staff(tenant_id,id)
);
SELECT platform.apply_tenant_rls('comms.booking_link_change');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON comms.booking_link_change FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON comms.booking_link_change TO mod_comms;
CREATE TABLE comms.voice_call (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),facility_id uuid NOT NULL,
 runtime_account_id text NOT NULL,session_id text NOT NULL,last_sequence integer NOT NULL,
 status text NOT NULL CHECK(status IN('active','completed','booked','error','abandoned','transferred')),
 started_at timestamptz NOT NULL,ended_at timestamptz,agent_version integer,tool_calls integer NOT NULL DEFAULT 0,
 appointment_id uuid,recording_allowed boolean NOT NULL DEFAULT false,transcript_allowed boolean NOT NULL DEFAULT false,
 consented_at timestamptz,consent_evidence text,available_until timestamptz,recording_url text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,runtime_account_id,session_id),
 FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),FOREIGN KEY(tenant_id,appointment_id) REFERENCES booking.appointment(tenant_id,id),
 CHECK(ended_at IS NULL OR ended_at>=started_at),CHECK(NOT recording_allowed OR(consented_at IS NOT NULL AND available_until IS NOT NULL))
);
CREATE INDEX ON comms.voice_call(tenant_id,facility_id,started_at,id);
SELECT platform.setup_tenant_table('comms.voice_call','mod_comms');
CREATE TABLE comms.voice_transcript (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),call_id uuid NOT NULL,turns jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,call_id),FOREIGN KEY(tenant_id,call_id) REFERENCES comms.voice_call(tenant_id,id)
);
SELECT platform.setup_tenant_table('comms.voice_transcript','mod_comms');
CREATE TABLE comms.voice_recording_access (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),call_id uuid NOT NULL,actor_staff_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('recording','transcript')),outcome text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,call_id) REFERENCES comms.voice_call(tenant_id,id),FOREIGN KEY(tenant_id,actor_staff_id) REFERENCES platform.staff(tenant_id,id)
);
SELECT platform.apply_tenant_rls('comms.voice_recording_access');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON comms.voice_recording_access FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON comms.voice_recording_access TO mod_comms;
-- migrate:down
DROP TABLE comms.voice_recording_access,comms.voice_transcript,comms.voice_call,comms.booking_link_change,comms.booking_link;
