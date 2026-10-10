-- migrate:up

-- ---------------------------------------------------------------------------
-- Virtual OPD (teleconsultation). The HMS decides who may join and when; the video provider (Jitsi)
-- only carries media. One tele_session per virtual appointment. The patient has no account: they use
-- a join link whose secret is stored here only as a SHA-256 hash.
-- ---------------------------------------------------------------------------

-- Consent text shown to patients, versioned per tenant. Published text never changes; a new
-- version is published instead. A tenant without a published document cannot run teleconsultations.
CREATE TABLE clinical.tele_consent_document (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  doc_version  text NOT NULL CHECK (doc_version ~ '^[A-Za-z0-9._-]{1,40}$'),
  language     text NOT NULL DEFAULT 'en' CHECK (language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  title        text NOT NULL CHECK (btrim(title) <> ''),
  body         text NOT NULL CHECK (btrim(body) <> ''),
  published_at timestamptz,
  retired_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, doc_version, language),
  CHECK (retired_at IS NULL OR (published_at IS NOT NULL AND retired_at >= published_at))
);
SELECT platform.setup_tenant_table('clinical.tele_consent_document', 'mod_clinical');

CREATE FUNCTION clinical.tele_consent_document_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.published_at IS NOT NULL AND (NEW.title, NEW.body, NEW.doc_version, NEW.language, NEW.published_at)
       IS DISTINCT FROM (OLD.title, OLD.body, OLD.doc_version, OLD.language, OLD.published_at) THEN
    RAISE EXCEPTION 'a published consent document cannot be changed; publish a new version' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tele_consent_document_guard BEFORE UPDATE ON clinical.tele_consent_document
  FOR EACH ROW EXECUTE FUNCTION clinical.tele_consent_document_guard();

CREATE TABLE clinical.tele_session (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id               uuid NOT NULL REFERENCES platform.tenant (id),
  appointment_id          uuid NOT NULL,
  facility_id             uuid NOT NULL,
  practitioner_staff_id   uuid NOT NULL,
  provider                text NOT NULL DEFAULT 'jitsi' CHECK (provider IN ('jitsi')),
  room_name               text NOT NULL CHECK (room_name ~ '^tc[0-9a-f]{32}$'),   -- random, no PHI
  status                  text NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show')),
  patient_link_hash       text CHECK (patient_link_hash ~ '^[0-9a-f]{64}$'),
  patient_link_issued_at  timestamptz,
  patient_link_expires_at timestamptz,
  patient_waiting_since   timestamptz,
  patient_left_at         timestamptz,
  started_at              timestamptz,
  ended_at                timestamptz,
  ended_by                uuid,
  end_outcome             text CHECK (end_outcome IN ('consulted', 'patient_did_not_join', 'technical_failure')),
  end_note                text,
  identity_method         text CHECK (identity_method IN ('known_patient', 'photo_id', 'abha', 'verified_by_staff')),
  identity_verified_by    uuid,
  identity_verified_at    timestamptz,
  identity_note           text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid,
  version                 integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, appointment_id),
  UNIQUE (room_name),
  UNIQUE (patient_link_hash),
  FOREIGN KEY (tenant_id, appointment_id) REFERENCES booking.appointment (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, practitioner_staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, ended_by) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, identity_verified_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((patient_link_hash IS NULL) = (patient_link_expires_at IS NULL)),
  CHECK (patient_link_hash IS NULL OR patient_link_issued_at IS NOT NULL),
  CHECK (status NOT IN ('in_progress', 'completed') OR started_at IS NOT NULL),
  CHECK ((status = 'completed') = (ended_at IS NOT NULL AND end_outcome IS NOT NULL)),
  CHECK (ended_at IS NULL OR ended_at >= started_at),
  CHECK ((identity_method IS NULL) = (identity_verified_at IS NULL)),
  CHECK ((identity_method IS NULL) = (identity_verified_by IS NULL)),
  -- Telemedicine Practice Guidelines 2020: the doctor verifies the patient's identity before treating.
  CHECK (end_outcome IS DISTINCT FROM 'consulted' OR identity_verified_at IS NOT NULL)
);
CREATE INDEX ON clinical.tele_session (tenant_id, facility_id, status);
CREATE INDEX ON clinical.tele_session (tenant_id, practitioner_staff_id, status);
CREATE INDEX ON clinical.tele_session (tenant_id, ended_by);
CREATE INDEX ON clinical.tele_session (tenant_id, identity_verified_by);
SELECT platform.setup_tenant_table('clinical.tele_session', 'mod_clinical');

CREATE FUNCTION clinical.tele_session_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
       ('scheduled', 'waiting'), ('scheduled', 'in_progress'), ('waiting', 'in_progress'),
       ('in_progress', 'completed'),
       ('scheduled', 'cancelled'), ('waiting', 'cancelled'), ('in_progress', 'cancelled'),
       ('scheduled', 'no_show'), ('waiting', 'no_show')) THEN
    RAISE EXCEPTION 'teleconsultation cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tele_session_transition_guard BEFORE UPDATE OF status ON clinical.tele_session
  FOR EACH ROW EXECUTE FUNCTION clinical.tele_session_transition_guard();

-- What happened in a session, in order (consent, waiting, start, joins, leave, end). Append-only.
CREATE TABLE clinical.tele_session_event (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  session_id     uuid NOT NULL,
  event_type     text NOT NULL CHECK (event_type IN ('created', 'link_issued', 'consent_recorded', 'patient_waiting',
                                                     'started', 'join_granted', 'patient_left', 'identity_verified',
                                                     'ended', 'cancelled', 'no_show')),
  actor_kind     text NOT NULL CHECK (actor_kind IN ('staff', 'patient', 'system')),
  actor_staff_id uuid,
  detail         jsonb NOT NULL DEFAULT '{}',
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, session_id) REFERENCES clinical.tele_session (tenant_id, id),
  FOREIGN KEY (tenant_id, actor_staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK ((actor_kind = 'staff') = (actor_staff_id IS NOT NULL))
);
CREATE INDEX ON clinical.tele_session_event (tenant_id, session_id, occurred_at);
CREATE INDEX ON clinical.tele_session_event (tenant_id, actor_staff_id);
SELECT platform.apply_tenant_rls('clinical.tele_session_event');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON clinical.tele_session_event
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON clinical.tele_session_event TO mod_clinical;

-- Consent to this teleconsultation, against a specific document. Captured before the patient's
-- identity may be linked, so it belongs to the session (not patient.patient_consent). Immutable.
CREATE TABLE clinical.tele_consent (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  session_id           uuid NOT NULL,
  document_id          uuid NOT NULL,
  method               text NOT NULL CHECK (method IN ('patient_link', 'verbal_recorded_by_staff')),
  accepted_at          timestamptz NOT NULL DEFAULT now(),
  recorded_by_staff_id uuid,
  client_ip_hash       text CHECK (client_ip_hash ~ '^[0-9a-f]{64}$'),      -- minimised evidence, not raw values
  user_agent_hash      text CHECK (user_agent_hash ~ '^[0-9a-f]{64}$'),
  note                 text,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, session_id, document_id),
  FOREIGN KEY (tenant_id, session_id) REFERENCES clinical.tele_session (tenant_id, id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES clinical.tele_consent_document (tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by_staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK ((method = 'verbal_recorded_by_staff') = (recorded_by_staff_id IS NOT NULL))
);
CREATE INDEX ON clinical.tele_consent (tenant_id, document_id);
CREATE INDEX ON clinical.tele_consent (tenant_id, recorded_by_staff_id);
SELECT platform.apply_tenant_rls('clinical.tele_consent');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON clinical.tele_consent
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON clinical.tele_consent TO mod_clinical;

-- A patient join link arrives before any tenant is known, so RLS would hide every session. This
-- narrowly-scoped SECURITY DEFINER function returns only the session matching one link hash.
CREATE FUNCTION clinical.resolve_tele_link(p_hash text)
RETURNS TABLE (tenant_id uuid, session_id uuid, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, clinical AS $$
  SELECT s.tenant_id, s.id, s.patient_link_expires_at
  FROM clinical.tele_session s
  JOIN platform.tenant t ON t.id = s.tenant_id AND t.status IN ('trial', 'active')
  WHERE s.patient_link_hash = p_hash;
$$;
REVOKE EXECUTE ON FUNCTION clinical.resolve_tele_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clinical.resolve_tele_link(text) TO hms_app;

-- migrate:down
DROP FUNCTION clinical.resolve_tele_link(text);
DROP TABLE clinical.tele_consent;
DROP TABLE clinical.tele_session_event;
DROP TABLE clinical.tele_session;
DROP FUNCTION clinical.tele_session_transition_guard();
DROP TABLE clinical.tele_consent_document;
DROP FUNCTION clinical.tele_consent_document_guard();
