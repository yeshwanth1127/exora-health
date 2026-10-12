-- migrate:up
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mod_comms') THEN CREATE ROLE mod_comms NOLOGIN NOBYPASSRLS; END IF;
END $$;
GRANT hms_reader TO mod_comms;
GRANT mod_comms TO hms_app WITH INHERIT FALSE, SET TRUE;
CREATE SCHEMA comms;
GRANT USAGE ON SCHEMA comms TO hms_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA comms GRANT SELECT ON TABLES TO hms_reader;
GRANT INSERT ON platform.audit_event, platform.outbox_event, platform.inbox_record TO mod_comms;
GRANT INSERT, UPDATE ON platform.idempotency_record TO mod_comms;

CREATE TABLE comms.contact_point (
 id uuid PRIMARY KEY DEFAULT uuidv7(), tenant_id uuid NOT NULL REFERENCES platform.tenant(id),
 facility_id uuid NOT NULL, patient_id uuid, booking_party_id uuid,
 channel text NOT NULL CHECK(channel = 'whatsapp'), address text NOT NULL CHECK(address ~ '^\+[1-9][0-9]{7,14}$'),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')),
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id), CHECK((patient_id IS NULL) <> (booking_party_id IS NULL)),
 FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),
 FOREIGN KEY(tenant_id,patient_id) REFERENCES patient.patient(tenant_id,id),
 FOREIGN KEY(tenant_id,booking_party_id) REFERENCES booking.booking_party(tenant_id,id)
);
CREATE INDEX ON comms.contact_point(tenant_id,facility_id);
CREATE INDEX ON comms.contact_point(tenant_id,patient_id);
CREATE INDEX ON comms.contact_point(tenant_id,booking_party_id);
CREATE INDEX ON comms.contact_point(tenant_id,channel,address);
CREATE UNIQUE INDEX contact_owner_address ON comms.contact_point(tenant_id,facility_id,channel,address,coalesce(patient_id,booking_party_id)) WHERE status='active';
SELECT platform.setup_tenant_table('comms.contact_point','mod_comms');

CREATE TABLE comms.messaging_consent_event (
 id uuid PRIMARY KEY DEFAULT uuidv7(), tenant_id uuid NOT NULL REFERENCES platform.tenant(id), contact_point_id uuid NOT NULL,
 purpose text NOT NULL CHECK(purpose IN ('care','reminders','marketing')),
 action text NOT NULL CHECK(action IN ('opt_in','opt_out','stop')), source text NOT NULL CHECK(source='staff'),
 evidence text NOT NULL CHECK(char_length(btrim(evidence)) BETWEEN 3 AND 500),
 explicit_opt_in boolean NOT NULL DEFAULT false, occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(), recorded_by uuid NOT NULL,
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,contact_point_id) REFERENCES comms.contact_point(tenant_id,id),
 FOREIGN KEY(tenant_id,recorded_by) REFERENCES platform.staff(tenant_id,id), CHECK(action <> 'opt_in' OR explicit_opt_in)
);
CREATE INDEX ON comms.messaging_consent_event(tenant_id,contact_point_id,occurred_at DESC,id DESC);
CREATE INDEX ON comms.messaging_consent_event(tenant_id,recorded_by);
SELECT platform.apply_tenant_rls('comms.messaging_consent_event');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON comms.messaging_consent_event FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON comms.messaging_consent_event TO mod_comms;

-- Address-wide STOP includes contacts created later and aliases at other clinics. Opt-in is local to
-- the selected contact/purpose, and must be affirmative and strictly newer than every matching STOP.
CREATE FUNCTION comms.has_consent(contact_id uuid, required_purpose text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce((SELECT e.action='opt_in' AND e.explicit_opt_in AND e.occurred_at > coalesce((
   SELECT max(s.occurred_at) FROM comms.messaging_consent_event s JOIN comms.contact_point alias ON alias.id=s.contact_point_id AND alias.tenant_id=s.tenant_id
   WHERE alias.tenant_id=c.tenant_id AND alias.channel=c.channel AND alias.address=c.address AND s.action='stop'
 ),'-infinity'::timestamptz)
 FROM comms.contact_point c JOIN comms.messaging_consent_event e ON e.tenant_id=c.tenant_id AND e.contact_point_id=c.id
 WHERE c.id=contact_id AND c.status='active' AND (e.purpose=required_purpose OR e.action='stop')
 ORDER BY e.occurred_at DESC,e.id DESC LIMIT 1),false)
$$;

CREATE TABLE comms.reminder_job (
 id uuid PRIMARY KEY DEFAULT uuidv7(), tenant_id uuid NOT NULL REFERENCES platform.tenant(id),
 facility_id uuid NOT NULL, appointment_id uuid NOT NULL, contact_point_id uuid,
 kind text NOT NULL CHECK(kind IN ('confirmation','reschedule','cancellation','day_before')),
 purpose text NOT NULL CHECK(purpose IN ('care','reminders')), due_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL, status text NOT NULL CHECK(status IN ('scheduled','queued','cancelled','skipped_no_consent','skipped')),
 reason text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,appointment_id,kind),
 FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),
 FOREIGN KEY(tenant_id,appointment_id) REFERENCES booking.appointment(tenant_id,id),
 FOREIGN KEY(tenant_id,contact_point_id) REFERENCES comms.contact_point(tenant_id,id)
);
CREATE INDEX ON comms.reminder_job(tenant_id,facility_id);
CREATE INDEX ON comms.reminder_job(tenant_id,contact_point_id);
CREATE INDEX ON comms.reminder_job(status,due_at);
SELECT platform.setup_tenant_table('comms.reminder_job','mod_comms');
CREATE TABLE comms.outbound_message (
 id uuid PRIMARY KEY DEFAULT uuidv7(), tenant_id uuid NOT NULL REFERENCES platform.tenant(id),
 facility_id uuid NOT NULL, reminder_job_id uuid NOT NULL, contact_point_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','claimed','sent','delivered','read','failed','unknown','cancelled')),
 transport text NOT NULL DEFAULT 'log' CHECK(transport='log'), attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,reminder_job_id),
 FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id),
 FOREIGN KEY(tenant_id,reminder_job_id) REFERENCES comms.reminder_job(tenant_id,id),
 FOREIGN KEY(tenant_id,contact_point_id) REFERENCES comms.contact_point(tenant_id,id),
 -- This release has no provider adapter: the database itself refuses a simulated delivery claim.
 CHECK(transport <> 'log' OR (status IN ('queued','cancelled') AND attempts=0))
);
CREATE INDEX ON comms.outbound_message(tenant_id,facility_id);
CREATE INDEX ON comms.outbound_message(tenant_id,contact_point_id);
SELECT platform.setup_tenant_table('comms.outbound_message','mod_comms');

-- Housekeeping obtains only bounded IDs, then ordinary module transactions enforce tenant RLS.
CREATE FUNCTION comms.due_notification_jobs(batch_size integer DEFAULT 100)
RETURNS TABLE(tenant_id uuid,id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT j.tenant_id,j.id FROM comms.reminder_job j WHERE j.status='scheduled' AND j.due_at<=now()
 ORDER BY j.due_at,j.id LIMIT least(greatest(batch_size,1),500)
$$;
REVOKE ALL ON FUNCTION comms.due_notification_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION comms.due_notification_jobs(integer) TO hms_app;
-- migrate:down
DROP SCHEMA comms CASCADE;
REVOKE mod_comms FROM hms_app;
