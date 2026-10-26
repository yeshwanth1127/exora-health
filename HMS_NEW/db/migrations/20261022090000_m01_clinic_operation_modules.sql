-- migrate:up
-- Clinic operation modules (inpatient, billing, pharmacy + inventory, HR) are switched per tenant. They
-- are off until their module_state row is 'active' (a missing row means not provisioned for these, see
-- SWITCHED_MODULES in @hms/platform). HR is a new module code; the others were already allowed.
ALTER TABLE platform.module_state DROP CONSTRAINT module_state_module_code_check;
ALTER TABLE platform.module_state ADD CONSTRAINT module_state_module_code_check
  CHECK (module_code IN ('platform', 'patient', 'catalog', 'booking', 'clinical', 'diagnostics',
                         'inpatient', 'theatre', 'pharmacy', 'inventory', 'billing', 'insurance',
                         'comms', 'documents', 'operations', 'integration', 'abdm', 'hr'));

-- migrate:down
DELETE FROM platform.module_state WHERE module_code = 'hr';
ALTER TABLE platform.module_state DROP CONSTRAINT module_state_module_code_check;
ALTER TABLE platform.module_state ADD CONSTRAINT module_state_module_code_check
  CHECK (module_code IN ('platform', 'patient', 'catalog', 'booking', 'clinical', 'diagnostics',
                         'inpatient', 'theatre', 'pharmacy', 'inventory', 'billing', 'insurance',
                         'comms', 'documents', 'operations', 'integration', 'abdm'));
