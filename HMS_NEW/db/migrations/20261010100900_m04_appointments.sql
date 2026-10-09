-- migrate:up

-- ---------------------------------------------------------------------------
-- booking_party: whoever made the booking (patient, relative, caller). An appointment can exist
-- before the patient's identity is verified; patient_id is filled in once it is linked.
-- ---------------------------------------------------------------------------
CREATE TABLE booking.booking_party (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  name             text NOT NULL CHECK (btrim(name) <> ''),
  phone            text CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email            citext,
  verified_channel text CHECK (verified_channel IN ('otp_sms', 'whatsapp', 'portal', 'staff')),
  verified_at      timestamptz,
  patient_id       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  CHECK (phone IS NOT NULL OR email IS NOT NULL OR patient_id IS NOT NULL),
  CHECK ((verified_at IS NULL) = (verified_channel IS NULL))
);
CREATE INDEX ON booking.booking_party (tenant_id, patient_id);
CREATE INDEX ON booking.booking_party (tenant_id, phone);
SELECT platform.setup_tenant_table('booking.booking_party', 'mod_booking');

CREATE TABLE booking.web_booking_session (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  booking_party_id uuid NOT NULL,
  token_hash       text NOT NULL,           -- SHA-256 of the session token; the token itself is never stored
  verified_via     text NOT NULL CHECK (verified_via IN ('otp_sms', 'whatsapp', 'email')),
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, token_hash),
  FOREIGN KEY (tenant_id, booking_party_id) REFERENCES booking.booking_party (tenant_id, id)
);
CREATE INDEX ON booking.web_booking_session (tenant_id, booking_party_id);
SELECT platform.setup_tenant_table('booking.web_booking_session', 'mod_booking');

-- ---------------------------------------------------------------------------
-- appointment
--   slot     : backed by exactly one 'booked' reservation (UNIQUE reservation_id)
--   walk_in  : no reservation; joins the doctor's token queue on arrival
-- The fee is snapshotted at booking time from the price list (price_list_item_id records which price).
-- ---------------------------------------------------------------------------
CREATE TABLE booking.appointment (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id             uuid NOT NULL REFERENCES platform.tenant (id),
  confirmation_code     text NOT NULL CHECK (confirmation_code ~ '^[A-Z0-9]{6,10}$'),
  reservation_id        uuid,
  booking_party_id      uuid,
  patient_id            uuid,
  practitioner_staff_id uuid NOT NULL,
  resource_id           uuid NOT NULL,
  facility_id           uuid NOT NULL,
  healthcare_service_id uuid,
  session_on            date NOT NULL,
  starts_at             timestamptz,
  ends_at               timestamptz,
  booking_kind          text NOT NULL CHECK (booking_kind IN ('slot', 'walk_in')),
  visit_type            text NOT NULL DEFAULT 'new' CHECK (visit_type IN ('new', 'follow_up', 'review', 'procedure')),
  visit_mode            text NOT NULL DEFAULT 'in_person' CHECK (visit_mode IN ('in_person', 'virtual')),
  origin_channel        text NOT NULL CHECK (origin_channel IN ('web', 'portal', 'whatsapp', 'voice', 'front_desk', 'walk_in', 'referral')),
  priority              text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'senior_citizen', 'emergency', 'vip')),
  fee_snapshot_minor    bigint CHECK (fee_snapshot_minor >= 0),
  currency              char(3) NOT NULL DEFAULT 'INR',
  price_list_item_id    uuid,
  reason_text           text,
  status                text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
  checked_in_at         timestamptz,
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  cancel_reason         text,
  rescheduled_from_id   uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid,
  version               integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, confirmation_code),
  UNIQUE (tenant_id, reservation_id),
  UNIQUE (tenant_id, rescheduled_from_id),          -- an appointment is rescheduled at most once (to one successor)
  FOREIGN KEY (tenant_id, reservation_id) REFERENCES booking.reservation (tenant_id, id),
  FOREIGN KEY (tenant_id, booking_party_id) REFERENCES booking.booking_party (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  FOREIGN KEY (tenant_id, practitioner_staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, resource_id) REFERENCES booking.schedulable_resource (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, healthcare_service_id) REFERENCES catalog.healthcare_service (tenant_id, id),
  FOREIGN KEY (tenant_id, price_list_item_id) REFERENCES catalog.price_list_item (tenant_id, id),
  FOREIGN KEY (tenant_id, rescheduled_from_id) REFERENCES booking.appointment (tenant_id, id),
  CHECK (booking_party_id IS NOT NULL OR patient_id IS NOT NULL),
  CHECK ((booking_kind = 'slot') = (reservation_id IS NOT NULL)),
  CHECK ((booking_kind = 'slot') = (starts_at IS NOT NULL AND ends_at IS NOT NULL)),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  CHECK (status NOT IN ('checked_in', 'completed') OR patient_id IS NOT NULL),
  CHECK ((status IN ('checked_in', 'completed')) <= (checked_in_at IS NOT NULL)),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL)),
  CHECK (rescheduled_from_id <> id)
);
CREATE INDEX ON booking.appointment (tenant_id, booking_party_id);
CREATE INDEX ON booking.appointment (tenant_id, patient_id, session_on);
CREATE INDEX ON booking.appointment (tenant_id, practitioner_staff_id, session_on);
CREATE INDEX ON booking.appointment (tenant_id, resource_id, session_on);
CREATE INDEX ON booking.appointment (tenant_id, facility_id, session_on);
CREATE INDEX ON booking.appointment (tenant_id, healthcare_service_id);
CREATE INDEX ON booking.appointment (tenant_id, price_list_item_id);
SELECT platform.setup_tenant_table('booking.appointment', 'mod_booking');

-- ---------------------------------------------------------------------------
-- appointment_status_history: written by trigger, so no status change can go unrecorded.
-- The acting staff member comes from the transaction setting app.actor_staff_id (set by the command runner).
-- ---------------------------------------------------------------------------
CREATE TABLE booking.appointment_status_history (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  appointment_id uuid NOT NULL,
  from_status    text,
  to_status      text NOT NULL,
  actor_staff_id uuid,
  reason         text,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, appointment_id) REFERENCES booking.appointment (tenant_id, id)
);
CREATE INDEX ON booking.appointment_status_history (tenant_id, appointment_id, occurred_at);
SELECT platform.apply_tenant_rls('booking.appointment_status_history');
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON booking.appointment_status_history
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();
GRANT INSERT ON booking.appointment_status_history TO mod_booking;

CREATE FUNCTION booking.appointment_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO booking.appointment_status_history (tenant_id, appointment_id, from_status, to_status, actor_staff_id, reason)
    VALUES (NEW.tenant_id, NEW.id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, NEW.status,
            nullif(current_setting('app.actor_staff_id', true), '')::uuid,
            CASE WHEN NEW.status = 'cancelled' THEN NEW.cancel_reason END);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointment_history AFTER INSERT OR UPDATE OF status ON booking.appointment
  FOR EACH ROW EXECUTE FUNCTION booking.appointment_history();

-- Allowed status moves. Terminal states (completed, cancelled, no_show) never change.
CREATE FUNCTION booking.appointment_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
       ('confirmed', 'checked_in'), ('confirmed', 'cancelled'), ('confirmed', 'no_show'),
       ('checked_in', 'completed'), ('checked_in', 'cancelled')) THEN
    RAISE EXCEPTION 'appointment cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointment_transition_guard BEFORE UPDATE OF status ON booking.appointment
  FOR EACH ROW EXECUTE FUNCTION booking.appointment_transition_guard();

-- ---------------------------------------------------------------------------
-- queue_token: the day's queue per doctor, shared by booked and walk-in patients.
-- token_no comes from platform.next_number('token', facility, '<resource>:<date>').
-- encounter_id gets its FK when the clinical module exists.
-- ---------------------------------------------------------------------------
CREATE TABLE booking.queue_token (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id        uuid NOT NULL,
  resource_id        uuid NOT NULL,
  session_on         date NOT NULL,
  token_no           integer NOT NULL CHECK (token_no > 0),
  appointment_id     uuid,
  encounter_id       uuid,
  patient_id         uuid NOT NULL,
  priority           text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'senior_citizen', 'emergency', 'vip')),
  status             text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'in_service', 'done', 'skipped', 'cancelled')),
  issued_at          timestamptz NOT NULL DEFAULT now(),
  called_at          timestamptz,
  service_started_at timestamptz,
  done_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, resource_id, session_on, token_no),
  UNIQUE (tenant_id, appointment_id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, resource_id) REFERENCES booking.schedulable_resource (tenant_id, id),
  FOREIGN KEY (tenant_id, appointment_id) REFERENCES booking.appointment (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id),
  CHECK (status NOT IN ('called', 'in_service', 'done') OR called_at IS NOT NULL),
  CHECK (status NOT IN ('in_service', 'done') OR service_started_at IS NOT NULL),
  CHECK ((status = 'done') = (done_at IS NOT NULL))
);
CREATE INDEX ON booking.queue_token (tenant_id, facility_id);
CREATE INDEX ON booking.queue_token (tenant_id, encounter_id);
CREATE INDEX ON booking.queue_token (tenant_id, patient_id);
CREATE INDEX queue_token_waiting ON booking.queue_token (tenant_id, resource_id, session_on, token_no) WHERE status = 'waiting';
SELECT platform.setup_tenant_table('booking.queue_token', 'mod_booking');

-- ---------------------------------------------------------------------------
-- Waitlist: people waiting for an earlier slot; an offer holds one reservation for a while.
-- ---------------------------------------------------------------------------
CREATE TABLE booking.waitlist_entry (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id             uuid NOT NULL REFERENCES platform.tenant (id),
  booking_party_id      uuid NOT NULL,
  practitioner_staff_id uuid,
  healthcare_service_id uuid,
  facility_id           uuid,
  preferred_from        date NOT NULL,
  preferred_to          date NOT NULL,
  status                text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'accepted', 'withdrawn', 'expired')),
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid,
  version               integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, booking_party_id) REFERENCES booking.booking_party (tenant_id, id),
  FOREIGN KEY (tenant_id, practitioner_staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, healthcare_service_id) REFERENCES catalog.healthcare_service (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  CHECK (num_nonnulls(practitioner_staff_id, healthcare_service_id) >= 1),
  CHECK (preferred_to >= preferred_from)
);
CREATE INDEX ON booking.waitlist_entry (tenant_id, booking_party_id);
CREATE INDEX ON booking.waitlist_entry (tenant_id, practitioner_staff_id);
CREATE INDEX ON booking.waitlist_entry (tenant_id, healthcare_service_id);
CREATE INDEX ON booking.waitlist_entry (tenant_id, facility_id);
SELECT platform.setup_tenant_table('booking.waitlist_entry', 'mod_booking');

CREATE TABLE booking.waitlist_offer (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id         uuid NOT NULL REFERENCES platform.tenant (id),
  waitlist_entry_id uuid NOT NULL,
  reservation_id    uuid NOT NULL,
  offered_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  outcome           text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'accepted', 'declined', 'expired')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid,
  version           integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, reservation_id),
  FOREIGN KEY (tenant_id, waitlist_entry_id) REFERENCES booking.waitlist_entry (tenant_id, id),
  FOREIGN KEY (tenant_id, reservation_id) REFERENCES booking.reservation (tenant_id, id),
  CHECK (expires_at > offered_at)
);
CREATE INDEX ON booking.waitlist_offer (tenant_id, waitlist_entry_id);
SELECT platform.setup_tenant_table('booking.waitlist_offer', 'mod_booking');

-- migrate:down
DROP TABLE booking.waitlist_offer;
DROP TABLE booking.waitlist_entry;
DROP TABLE booking.queue_token;
DROP TABLE booking.appointment_status_history;
DROP TABLE booking.appointment;
DROP FUNCTION booking.appointment_transition_guard();
DROP FUNCTION booking.appointment_history();
DROP TABLE booking.web_booking_session;
DROP TABLE booking.booking_party;
