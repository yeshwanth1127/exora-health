-- migrate:up
ALTER TABLE comms.booking_link ADD FOREIGN KEY(tenant_id,created_by) REFERENCES platform.staff(tenant_id,id);
CREATE INDEX ON comms.booking_link(tenant_id,created_by);
ALTER TABLE comms.booking_link_change ADD UNIQUE(tenant_id,id);
CREATE INDEX ON comms.booking_link_change(tenant_id,facility_id,created_at,id);
CREATE INDEX ON comms.booking_link_change(tenant_id,actor_staff_id);
CREATE INDEX ON comms.voice_call(tenant_id,appointment_id);
ALTER TABLE comms.voice_call ADD CONSTRAINT voice_transcript_consent CHECK(NOT transcript_allowed OR(consented_at IS NOT NULL AND available_until IS NOT NULL));
ALTER TABLE comms.voice_recording_access ADD UNIQUE(tenant_id,id);
CREATE INDEX ON comms.voice_recording_access(tenant_id,call_id,created_at,id);
CREATE INDEX ON comms.voice_recording_access(tenant_id,actor_staff_id);
-- Preserve each consented runtime transcript revision; the current table is a read projection.
CREATE TABLE comms.voice_transcript_revision (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),call_id uuid NOT NULL,
 sequence integer NOT NULL,turns jsonb NOT NULL,source text NOT NULL DEFAULT 'runtime' CHECK(source='runtime'),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,call_id,sequence),
 FOREIGN KEY(tenant_id,call_id) REFERENCES comms.voice_call(tenant_id,id)
);
SELECT platform.apply_tenant_rls('comms.voice_transcript_revision');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON comms.voice_transcript_revision FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON comms.voice_transcript_revision TO mod_comms;
-- migrate:down
DROP TABLE comms.voice_transcript_revision;
ALTER TABLE comms.booking_link DROP CONSTRAINT booking_link_tenant_id_created_by_fkey;
DROP INDEX comms.booking_link_tenant_id_created_by_idx;
ALTER TABLE comms.booking_link_change DROP CONSTRAINT booking_link_change_tenant_id_id_key;
DROP INDEX comms.booking_link_change_tenant_id_facility_id_created_at_id_idx,comms.booking_link_change_tenant_id_actor_staff_id_idx;
DROP INDEX comms.voice_call_tenant_id_appointment_id_idx;
ALTER TABLE comms.voice_call DROP CONSTRAINT voice_transcript_consent;
ALTER TABLE comms.voice_recording_access DROP CONSTRAINT voice_recording_access_tenant_id_id_key;
DROP INDEX comms.voice_recording_access_tenant_id_call_id_created_at_id_idx,comms.voice_recording_access_tenant_id_actor_staff_id_idx;
