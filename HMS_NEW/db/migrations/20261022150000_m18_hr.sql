-- migrate:up
-- M18 HR (new; ERD m18-hr): employee profiles and statutory/bank details for platform.staff, shifts and
-- rosters, attendance (append-only punches → one derived row per person per day), leave (types, an
-- append-only ledger whose sum is the balance, and requests), and monthly payroll (salary structures
-- versioned by date, payroll runs, payslips with snapshot lines). platform.staff stays the identity
-- record (written by the platform module). Approved payslips and attendance in a locked payroll month
-- are frozen. Statutory amounts (PF, ESI, professional tax) follow configurable settings — confirm the
-- values with the clinic's chartered accountant; TDS is entered per payslip.

-- ---------------------------------------------------------------------------
-- Module setup: schema `hr`, write role mod_hr
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mod_hr') THEN
    CREATE ROLE mod_hr NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT hms_reader TO mod_hr;
GRANT mod_hr TO hms_app WITH INHERIT FALSE, SET TRUE;

CREATE SCHEMA hr;
GRANT USAGE ON SCHEMA hr TO hms_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA hr GRANT SELECT ON TABLES TO hms_reader;

GRANT INSERT ON platform.audit_event, platform.outbox_event, platform.inbox_record TO mod_hr;
GRANT INSERT, UPDATE ON platform.number_series, platform.idempotency_record TO mod_hr;

-- ---------------------------------------------------------------------------
-- Employee profile and statutory details (1:1 with platform.staff). Bank and statutory numbers are
-- sensitive: only payroll.read sees them. Aadhaar numbers are never stored.
-- ---------------------------------------------------------------------------
CREATE TABLE hr.employee_profile (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id               uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id                uuid NOT NULL,
  facility_id             uuid NOT NULL,                 -- where they work (payroll and attendance)
  designation             text NOT NULL CHECK (length(designation) BETWEEN 1 AND 100),
  department_id           uuid,
  reporting_to_staff_id   uuid,
  date_of_joining         date NOT NULL,
  date_of_exit            date,
  exit_reason             text,
  emergency_contact_name  text CHECK (length(emergency_contact_name) <= 200),
  emergency_contact_phone text CHECK (emergency_contact_phone ~ '^\+[1-9][0-9]{6,14}$'),
  emergency_contact_relation text CHECK (length(emergency_contact_relation) <= 50),
  address                 text CHECK (length(address) <= 500),
  status                  text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_notice', 'exited')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid,
  version                 integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, staff_id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id, department_id) REFERENCES platform.department (tenant_id, facility_id, id),
  FOREIGN KEY (tenant_id, reporting_to_staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK (reporting_to_staff_id IS DISTINCT FROM staff_id),
  CHECK ((status = 'exited') = (date_of_exit IS NOT NULL AND exit_reason IS NOT NULL)),
  CHECK (date_of_exit IS NULL OR date_of_exit >= date_of_joining)
);
CREATE INDEX ON hr.employee_profile (tenant_id, facility_id, status);
CREATE INDEX ON hr.employee_profile (tenant_id, facility_id, department_id);
CREATE INDEX ON hr.employee_profile (tenant_id, reporting_to_staff_id);
SELECT platform.setup_tenant_table('hr.employee_profile', 'mod_hr');

CREATE TABLE hr.employee_statutory (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id           uuid NOT NULL,
  pan                text CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  uan                text CHECK (uan ~ '^[0-9]{12}$'),
  esic_no            text CHECK (esic_no ~ '^[0-9]{10,17}$'),
  bank_account_no    text CHECK (bank_account_no ~ '^[0-9]{6,18}$'),
  bank_ifsc          text CHECK (bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_name          text CHECK (length(bank_name) <= 100),
  account_holder     text CHECK (length(account_holder) <= 200),
  pf_applicable      boolean NOT NULL DEFAULT false,
  esi_applicable     boolean NOT NULL DEFAULT false,
  pt_state_code      char(2) CHECK (pt_state_code ~ '^[0-9]{2}$'),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, staff_id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK ((bank_account_no IS NULL) = (bank_ifsc IS NULL)),
  CHECK (NOT pf_applicable OR uan IS NOT NULL OR pan IS NOT NULL)
);
SELECT platform.setup_tenant_table('hr.employee_statutory', 'mod_hr');

-- ---------------------------------------------------------------------------
-- Shifts and rosters.
-- ---------------------------------------------------------------------------
CREATE TABLE hr.shift_definition (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id     uuid NOT NULL,
  code            text NOT NULL CHECK (code ~ '^[A-Z0-9_-]{1,20}$'),
  name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  start_local     time NOT NULL,
  end_local       time NOT NULL,                    -- earlier than start = ends the next day
  break_minutes   smallint NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 240),
  grace_minutes   smallint NOT NULL DEFAULT 10 CHECK (grace_minutes BETWEEN 0 AND 120),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, code),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  CHECK (start_local <> end_local)
);
SELECT platform.setup_tenant_table('hr.shift_definition', 'mod_hr');

CREATE TABLE hr.roster_assignment (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id            uuid NOT NULL,
  facility_id         uuid NOT NULL,
  on_date             date NOT NULL,
  kind                text NOT NULL DEFAULT 'shift' CHECK (kind IN ('shift', 'week_off')),
  shift_definition_id uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid,
  version             integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, staff_id, on_date),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, shift_definition_id) REFERENCES hr.shift_definition (tenant_id, id),
  CHECK ((kind = 'shift') = (shift_definition_id IS NOT NULL))
);
CREATE INDEX ON hr.roster_assignment (tenant_id, facility_id, on_date);
CREATE INDEX ON hr.roster_assignment (tenant_id, shift_definition_id);
SELECT platform.setup_tenant_table('hr.roster_assignment', 'mod_hr');
-- A roster day is replaced by deleting it (refused once the payroll month is locked, by the command).
GRANT DELETE ON hr.roster_assignment TO mod_hr;

-- ---------------------------------------------------------------------------
-- Attendance: punches (append-only) and the derived day.
-- ---------------------------------------------------------------------------
CREATE TABLE hr.attendance_punch (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id     uuid NOT NULL,
  facility_id  uuid NOT NULL,
  punched_at   timestamptz NOT NULL,
  direction    text NOT NULL CHECK (direction IN ('in', 'out')),
  source       text NOT NULL CHECK (source IN ('self', 'manager', 'kiosk')),
  recorded_by  uuid NOT NULL,
  note         text CHECK (length(note) <= 300),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (source = 'self' OR note IS NOT NULL OR source = 'kiosk')
);
CREATE INDEX ON hr.attendance_punch (tenant_id, staff_id, punched_at);
CREATE INDEX ON hr.attendance_punch (tenant_id, facility_id);
CREATE INDEX ON hr.attendance_punch (tenant_id, recorded_by);
SELECT platform.apply_tenant_rls('hr.attendance_punch');
GRANT INSERT ON hr.attendance_punch TO mod_hr;
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON hr.attendance_punch
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();

CREATE TABLE hr.attendance_day (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id       uuid NOT NULL,
  facility_id    uuid NOT NULL,
  on_date        date NOT NULL,
  status         text NOT NULL CHECK (status IN ('present', 'half_day', 'absent', 'paid_leave', 'unpaid_leave', 'holiday', 'week_off')),
  first_in       timestamptz,
  last_out       timestamptz,
  worked_minutes integer NOT NULL DEFAULT 0 CHECK (worked_minutes >= 0),
  late_minutes   integer NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  source         text NOT NULL DEFAULT 'computed' CHECK (source IN ('computed', 'regularised')),
  is_locked      boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, staff_id, on_date),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id)
);
CREATE INDEX ON hr.attendance_day (tenant_id, facility_id, on_date);
SELECT platform.setup_tenant_table('hr.attendance_day', 'mod_hr');

CREATE FUNCTION hr.attendance_day_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_locked THEN
    RAISE EXCEPTION 'attendance for % is locked by payroll', OLD.on_date USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_day_guard BEFORE UPDATE ON hr.attendance_day FOR EACH ROW EXECUTE FUNCTION hr.attendance_day_guard();

CREATE TABLE hr.attendance_regularisation (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id         uuid NOT NULL,
  on_date          date NOT NULL,
  requested_status text NOT NULL CHECK (requested_status IN ('present', 'half_day')),
  reason           text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  status           text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'cancelled')),
  decided_by       uuid,
  decided_at       timestamptz,
  decision_note    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, decided_by) REFERENCES platform.staff (tenant_id, id),
  CHECK ((status IN ('approved', 'rejected')) = (decided_at IS NOT NULL))
);
CREATE UNIQUE INDEX attendance_regularisation_one_open ON hr.attendance_regularisation (tenant_id, staff_id, on_date) WHERE status = 'requested';
CREATE INDEX ON hr.attendance_regularisation (tenant_id, staff_id, on_date);
CREATE INDEX ON hr.attendance_regularisation (tenant_id, decided_by);
SELECT platform.setup_tenant_table('hr.attendance_regularisation', 'mod_hr');

-- ---------------------------------------------------------------------------
-- Leave: types, the ledger (balance = Σ days), requests.
-- ---------------------------------------------------------------------------
CREATE TABLE hr.leave_type (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  code               text NOT NULL CHECK (code ~ '^[A-Z0-9_-]{1,20}$'),
  name               text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  is_paid            boolean NOT NULL DEFAULT true,
  annual_quota_days  numeric(5, 1) NOT NULL DEFAULT 0 CHECK (annual_quota_days >= 0),
  carry_forward_max  numeric(5, 1) NOT NULL DEFAULT 0 CHECK (carry_forward_max >= 0),
  allow_negative     boolean NOT NULL DEFAULT false,
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);
SELECT platform.setup_tenant_table('hr.leave_type', 'mod_hr');

CREATE TABLE hr.leave_request (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id       uuid NOT NULL,
  leave_type_id  uuid NOT NULL,
  starts_on      date NOT NULL,
  ends_on        date NOT NULL,
  half_day       text NOT NULL DEFAULT 'none' CHECK (half_day IN ('none', 'first_half', 'second_half')),
  days           numeric(5, 1) NOT NULL CHECK (days > 0),
  reason         text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  status         text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'cancelled')),
  decided_by     uuid,
  decided_at     timestamptz,
  decision_note  text,
  cancelled_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, leave_type_id) REFERENCES hr.leave_type (tenant_id, id),
  FOREIGN KEY (tenant_id, decided_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (ends_on >= starts_on),
  CHECK (half_day = 'none' OR (starts_on = ends_on AND days = 0.5)),
  CHECK (status NOT IN ('approved', 'rejected') OR decided_at IS NOT NULL),
  CHECK (status <> 'requested' OR decided_at IS NULL),      -- a cancelled request keeps its decision, if it had one
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  -- Overlapping live requests of one person are refused.
  CONSTRAINT leave_request_no_overlap EXCLUDE USING gist (
    tenant_id WITH =, staff_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&
  ) WHERE (status IN ('requested', 'approved'))
);
CREATE INDEX ON hr.leave_request (tenant_id, staff_id, starts_on);
CREATE INDEX ON hr.leave_request (tenant_id, leave_type_id);
CREATE INDEX ON hr.leave_request (tenant_id, status);
CREATE INDEX ON hr.leave_request (tenant_id, decided_by);
SELECT platform.setup_tenant_table('hr.leave_request', 'mod_hr');

CREATE TABLE hr.leave_ledger (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id         uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id          uuid NOT NULL,
  leave_type_id     uuid NOT NULL,
  entry             text NOT NULL CHECK (entry IN ('grant', 'consume', 'reverse', 'lapse', 'adjust')),
  days              numeric(5, 1) NOT NULL CHECK (days <> 0),
  effective_on      date NOT NULL,
  leave_request_id  uuid,
  note              text CHECK (length(note) <= 300),
  recorded_by       uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  FOREIGN KEY (tenant_id, leave_type_id) REFERENCES hr.leave_type (tenant_id, id),
  FOREIGN KEY (tenant_id, leave_request_id) REFERENCES hr.leave_request (tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (CASE entry WHEN 'grant' THEN days > 0 WHEN 'consume' THEN days < 0 AND leave_request_id IS NOT NULL
                    WHEN 'reverse' THEN days > 0 AND leave_request_id IS NOT NULL WHEN 'lapse' THEN days < 0 ELSE true END)
);
-- A request is consumed once and reversed at most once.
CREATE UNIQUE INDEX leave_ledger_once ON hr.leave_ledger (tenant_id, leave_request_id, entry) WHERE leave_request_id IS NOT NULL;
CREATE INDEX ON hr.leave_ledger (tenant_id, staff_id, leave_type_id);
CREATE INDEX ON hr.leave_ledger (tenant_id, leave_type_id);
CREATE INDEX ON hr.leave_ledger (tenant_id, recorded_by);
SELECT platform.apply_tenant_rls('hr.leave_ledger');
GRANT INSERT ON hr.leave_ledger TO mod_hr;
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON hr.leave_ledger
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();

-- ---------------------------------------------------------------------------
-- Payroll: settings, components, salary structures, runs, payslips.
-- ---------------------------------------------------------------------------
CREATE TABLE hr.payroll_setting (
  id                        uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                 uuid NOT NULL REFERENCES platform.tenant (id),
  pf_employee_rate_bp       integer NOT NULL DEFAULT 1200 CHECK (pf_employee_rate_bp BETWEEN 0 AND 10000),
  pf_wage_ceiling_minor     bigint NOT NULL DEFAULT 1500000 CHECK (pf_wage_ceiling_minor >= 0),
  esi_employee_rate_bp      integer NOT NULL DEFAULT 75 CHECK (esi_employee_rate_bp BETWEEN 0 AND 10000),
  esi_gross_ceiling_minor   bigint NOT NULL DEFAULT 2100000 CHECK (esi_gross_ceiling_minor >= 0),
  created_at                timestamptz NOT NULL DEFAULT now(),
  created_by                uuid,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                uuid,
  version                   integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id)
);
SELECT platform.setup_tenant_table('hr.payroll_setting', 'mod_hr');

-- Professional tax slabs by state on monthly gross (values set per deployment).
CREATE TABLE hr.professional_tax_slab (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  state_code       char(2) NOT NULL CHECK (state_code ~ '^[0-9]{2}$'),
  min_gross_minor  bigint NOT NULL CHECK (min_gross_minor >= 0),
  max_gross_minor  bigint,
  amount_minor     bigint NOT NULL CHECK (amount_minor >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  CHECK (max_gross_minor IS NULL OR max_gross_minor > min_gross_minor),
  CONSTRAINT pt_slab_no_overlap EXCLUDE USING gist (
    tenant_id WITH =, state_code WITH =, int8range(min_gross_minor, max_gross_minor) WITH &&
  )
);
SELECT platform.setup_tenant_table('hr.professional_tax_slab', 'mod_hr');
GRANT DELETE ON hr.professional_tax_slab TO mod_hr;

CREATE TABLE hr.salary_component (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL REFERENCES platform.tenant (id),
  code           text NOT NULL CHECK (code ~ '^[A-Z0-9_]{1,20}$'),
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  kind           text NOT NULL CHECK (kind IN ('earning', 'deduction')),
  calc           text NOT NULL CHECK (calc IN ('fixed', 'percent_of_basic')),
  is_basic       boolean NOT NULL DEFAULT false,
  prorate        boolean NOT NULL DEFAULT true,       -- scaled by paid days / days in the month
  display_order  smallint NOT NULL DEFAULT 100,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  CHECK (NOT is_basic OR (kind = 'earning' AND calc = 'fixed'))
);
CREATE UNIQUE INDEX salary_component_one_basic ON hr.salary_component (tenant_id) WHERE is_basic;
SELECT platform.setup_tenant_table('hr.salary_component', 'mod_hr');

CREATE TABLE hr.salary_structure (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenant (id),
  staff_id        uuid NOT NULL,
  effective_from  date NOT NULL,
  note            text CHECK (length(note) <= 300),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, staff_id, effective_from),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK (extract(day FROM effective_from) = 1)
);
SELECT platform.apply_tenant_rls('hr.salary_structure');
GRANT INSERT ON hr.salary_structure TO mod_hr;
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON hr.salary_structure
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();

CREATE TABLE hr.salary_structure_line (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  salary_structure_id  uuid NOT NULL,
  salary_component_id  uuid NOT NULL,
  amount_minor         bigint CHECK (amount_minor >= 0),    -- monthly, for fixed components
  percent_bp           integer CHECK (percent_bp BETWEEN 0 AND 100000),
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, salary_structure_id, salary_component_id),
  FOREIGN KEY (tenant_id, salary_structure_id) REFERENCES hr.salary_structure (tenant_id, id),
  FOREIGN KEY (tenant_id, salary_component_id) REFERENCES hr.salary_component (tenant_id, id),
  CHECK ((amount_minor IS NULL) <> (percent_bp IS NULL))
);
CREATE INDEX ON hr.salary_structure_line (tenant_id, salary_component_id);
SELECT platform.apply_tenant_rls('hr.salary_structure_line');
GRANT INSERT ON hr.salary_structure_line TO mod_hr;
CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON hr.salary_structure_line
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_change();

CREATE TABLE hr.payroll_run (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenant (id),
  facility_id      uuid NOT NULL,
  period_month     date NOT NULL CHECK (extract(day FROM period_month) = 1),
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'computed', 'approved', 'paid', 'locked')),
  computed_at      timestamptz,
  approved_by      uuid,
  approved_at      timestamptz,
  paid_at          timestamptz,
  locked_at        timestamptz,
  gross_minor      bigint NOT NULL DEFAULT 0,
  deductions_minor bigint NOT NULL DEFAULT 0,
  net_minor        bigint NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, period_month),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id),
  FOREIGN KEY (tenant_id, approved_by) REFERENCES platform.staff (tenant_id, id),
  CHECK (status IN ('draft', 'computed') OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)),
  CHECK (status NOT IN ('paid', 'locked') OR paid_at IS NOT NULL),
  CHECK ((status = 'locked') = (locked_at IS NOT NULL))
);
CREATE INDEX ON hr.payroll_run (tenant_id, approved_by);
SELECT platform.setup_tenant_table('hr.payroll_run', 'mod_hr');

CREATE FUNCTION hr.payroll_run_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
       ('draft', 'computed'), ('computed', 'computed'), ('computed', 'approved'), ('approved', 'paid'), ('paid', 'locked')) THEN
    RAISE EXCEPTION 'payroll run cannot move from % to %', OLD.status, NEW.status USING ERRCODE = '55000';
  END IF;
  IF OLD.status IN ('approved', 'paid', 'locked') AND (NEW.gross_minor, NEW.deductions_minor, NEW.net_minor) IS DISTINCT FROM (OLD.gross_minor, OLD.deductions_minor, OLD.net_minor) THEN
    RAISE EXCEPTION 'an approved payroll cannot be recomputed' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payroll_run_guard BEFORE UPDATE ON hr.payroll_run FOR EACH ROW EXECUTE FUNCTION hr.payroll_run_guard();

CREATE TABLE hr.payslip (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL REFERENCES platform.tenant (id),
  payroll_run_id     uuid NOT NULL,
  staff_id           uuid NOT NULL,
  days_in_month      smallint NOT NULL CHECK (days_in_month BETWEEN 28 AND 31),
  paid_days          numeric(5, 1) NOT NULL CHECK (paid_days >= 0),
  lop_days           numeric(5, 1) NOT NULL DEFAULT 0 CHECK (lop_days >= 0),
  gross_minor        bigint NOT NULL CHECK (gross_minor >= 0),
  deductions_minor   bigint NOT NULL CHECK (deductions_minor >= 0),
  tds_minor          bigint NOT NULL DEFAULT 0 CHECK (tds_minor >= 0),
  net_minor          bigint NOT NULL,
  bank_account_last4 text,
  bank_ifsc          text,
  payment_ref        text CHECK (length(payment_ref) <= 100),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, payroll_run_id, staff_id),
  FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES hr.payroll_run (tenant_id, id),
  FOREIGN KEY (tenant_id, staff_id) REFERENCES platform.staff (tenant_id, id),
  CHECK (paid_days + lop_days <= days_in_month),
  CHECK (net_minor = gross_minor - deductions_minor)
);
CREATE INDEX ON hr.payslip (tenant_id, staff_id);
SELECT platform.setup_tenant_table('hr.payslip', 'mod_hr');
-- A draft/computed run's payslips are rebuilt by deleting them (refused afterwards by the trigger).
GRANT DELETE ON hr.payslip TO mod_hr;

CREATE TABLE hr.payslip_line (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL REFERENCES platform.tenant (id),
  payslip_id           uuid NOT NULL,
  salary_component_id  uuid,                    -- NULL for statutory lines (PF, ESI, PT, TDS)
  code                 text NOT NULL,
  name                 text NOT NULL,
  kind                 text NOT NULL CHECK (kind IN ('earning', 'deduction')),
  amount_minor         bigint NOT NULL CHECK (amount_minor >= 0),
  display_order        smallint NOT NULL DEFAULT 100,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, payslip_id, code),
  FOREIGN KEY (tenant_id, payslip_id) REFERENCES hr.payslip (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, salary_component_id) REFERENCES hr.salary_component (tenant_id, id)
);
CREATE INDEX ON hr.payslip_line (tenant_id, salary_component_id);
SELECT platform.apply_tenant_rls('hr.payslip_line');
GRANT INSERT ON hr.payslip_line TO mod_hr;

-- Payslips of an approved run are frozen (only the payment reference may be set once paid).
CREATE FUNCTION hr.payslip_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  run_status text;
  movable text[] := ARRAY['payment_ref', 'updated_at', 'updated_by', 'version'];
BEGIN
  SELECT status INTO run_status FROM hr.payroll_run WHERE tenant_id = coalesce(NEW.tenant_id, OLD.tenant_id) AND id = coalesce(NEW.payroll_run_id, OLD.payroll_run_id);
  IF run_status NOT IN ('draft', 'computed') THEN
    IF TG_OP = 'DELETE' OR (to_jsonb(NEW) - movable) IS DISTINCT FROM (to_jsonb(OLD) - movable) THEN
      RAISE EXCEPTION 'payslips of a % payroll cannot change', run_status USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER payslip_guard BEFORE UPDATE OR DELETE ON hr.payslip FOR EACH ROW EXECUTE FUNCTION hr.payslip_guard();

-- ---------------------------------------------------------------------------
-- Booking: calendar closures made for approved leave point back at the request (revoked on cancel).
-- ---------------------------------------------------------------------------
ALTER TABLE booking.schedule_exception ADD COLUMN leave_request_id uuid;
ALTER TABLE booking.schedule_exception ADD CONSTRAINT schedule_exception_leave_fk
  FOREIGN KEY (tenant_id, leave_request_id) REFERENCES hr.leave_request (tenant_id, id);
CREATE INDEX schedule_exception_leave ON booking.schedule_exception (tenant_id, leave_request_id);

-- migrate:down
DROP INDEX booking.schedule_exception_leave;
ALTER TABLE booking.schedule_exception DROP CONSTRAINT schedule_exception_leave_fk;
ALTER TABLE booking.schedule_exception DROP COLUMN leave_request_id;
DROP SCHEMA hr CASCADE;
REVOKE INSERT ON platform.audit_event, platform.outbox_event, platform.inbox_record FROM mod_hr;
REVOKE INSERT, UPDATE ON platform.number_series, platform.idempotency_record FROM mod_hr;
