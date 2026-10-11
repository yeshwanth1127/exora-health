-- migrate:up
-- Patient identifiers are retired, not deleted (a wrong passport number is removed from use but the
-- row stays for the audit trail). A retired value may be registered again, so uniqueness only covers
-- identifiers in use.
ALTER TABLE patient.patient_identifier
  ADD COLUMN removed_at timestamptz,
  ADD COLUMN removed_by uuid,
  ADD COLUMN removed_reason text,
  ADD CONSTRAINT patient_identifier_removed_check
    CHECK ((removed_at IS NULL) = (removed_reason IS NULL) AND (removed_reason IS NULL OR char_length(btrim(removed_reason)) >= 3));
ALTER TABLE patient.patient_identifier DROP CONSTRAINT patient_identifier_tenant_id_system_value_key;
CREATE UNIQUE INDEX patient_identifier_live_value ON patient.patient_identifier (tenant_id, system, value) WHERE removed_at IS NULL;

-- migrate:down
DROP INDEX patient.patient_identifier_live_value;
DELETE FROM patient.patient_identifier WHERE removed_at IS NOT NULL;
ALTER TABLE patient.patient_identifier ADD CONSTRAINT patient_identifier_tenant_id_system_value_key UNIQUE (tenant_id, system, value);
ALTER TABLE patient.patient_identifier DROP CONSTRAINT patient_identifier_removed_check,
  DROP COLUMN removed_reason, DROP COLUMN removed_by, DROP COLUMN removed_at;
