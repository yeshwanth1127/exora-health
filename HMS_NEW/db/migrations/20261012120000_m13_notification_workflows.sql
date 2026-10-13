-- migrate:up
CREATE TABLE comms.followup_rule (
 id uuid PRIMARY KEY DEFAULT uuidv7(),tenant_id uuid NOT NULL REFERENCES platform.tenant(id),facility_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('day_before','same_day','follow_up')),enabled boolean NOT NULL,
 delay_hours integer NOT NULL CHECK(delay_hours BETWEEN 0 AND 720),
 created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,facility_id,kind),FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id)
);
SELECT platform.setup_tenant_table('comms.followup_rule','mod_comms');
ALTER TABLE comms.reminder_job DROP CONSTRAINT reminder_job_kind_check;
ALTER TABLE comms.reminder_job ADD CONSTRAINT reminder_job_kind_check CHECK(kind IN ('confirmation','reschedule','cancellation','day_before','same_day','follow_up','waitlist_offer'));
ALTER TABLE comms.reminder_job ALTER COLUMN appointment_id DROP NOT NULL;
ALTER TABLE comms.reminder_job ADD COLUMN waitlist_offer_id uuid,
 ADD COLUMN rule_version integer,
 ADD CONSTRAINT reminder_job_offer_fk FOREIGN KEY(tenant_id,waitlist_offer_id) REFERENCES booking.waitlist_offer(tenant_id,id),
 ADD CONSTRAINT reminder_job_owner_check CHECK((appointment_id IS NULL)<>(waitlist_offer_id IS NULL)),
 ADD CONSTRAINT reminder_job_offer_kind CHECK((kind='waitlist_offer')=(waitlist_offer_id IS NOT NULL)),
 ADD CONSTRAINT reminder_job_offer_unique UNIQUE(tenant_id,waitlist_offer_id);
CREATE INDEX ON comms.reminder_job(tenant_id,waitlist_offer_id);
CREATE OR REPLACE FUNCTION comms.due_notification_jobs(batch_size integer DEFAULT 100)
RETURNS TABLE(tenant_id uuid,id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT j.tenant_id,j.id FROM comms.reminder_job j WHERE
 (j.status='scheduled' AND j.due_at<=now()) OR (j.status='queued' AND j.expires_at<=now())
 ORDER BY j.due_at,j.id LIMIT least(greatest(batch_size,1),500)
$$;
-- migrate:down
DROP TABLE comms.followup_rule;
DELETE FROM comms.outbound_message WHERE reminder_job_id IN(SELECT id FROM comms.reminder_job WHERE kind IN('same_day','follow_up','waitlist_offer'));
DELETE FROM comms.reminder_job WHERE kind IN('same_day','follow_up','waitlist_offer');
ALTER TABLE comms.reminder_job DROP CONSTRAINT reminder_job_owner_check,DROP CONSTRAINT reminder_job_offer_kind,DROP CONSTRAINT reminder_job_offer_unique,DROP CONSTRAINT reminder_job_offer_fk,DROP COLUMN waitlist_offer_id,DROP COLUMN rule_version;
ALTER TABLE comms.reminder_job ALTER COLUMN appointment_id SET NOT NULL;
ALTER TABLE comms.reminder_job DROP CONSTRAINT reminder_job_kind_check;
ALTER TABLE comms.reminder_job ADD CONSTRAINT reminder_job_kind_check CHECK(kind IN('confirmation','reschedule','cancellation','day_before'));
CREATE OR REPLACE FUNCTION comms.due_notification_jobs(batch_size integer DEFAULT 100)
RETURNS TABLE(tenant_id uuid,id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT j.tenant_id,j.id FROM comms.reminder_job j WHERE j.status='scheduled' AND j.due_at<=now()
 ORDER BY j.due_at,j.id LIMIT least(greatest(batch_size,1),500)
$$;
