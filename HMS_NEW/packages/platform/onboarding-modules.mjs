// Shared by the control API, tenant bootstrap and website. This is entitlement selection,
// not provider activation: switched clinic modules start in the configured state.
export const CLINIC_MODULES = ['inpatient', 'billing', 'inventory', 'pharmacy', 'hr'];
export function parseClinicModules(value) {
  if (value === undefined) return [...CLINIC_MODULES]; // Existing callers retain their entitlements.
  if (!Array.isArray(value) || value.length > CLINIC_MODULES.length || value.some(code => !CLINIC_MODULES.includes(code))) throw new Error('Choose supported clinic modules.');
  if (new Set(value).size !== value.length) throw new Error('Choose each module once.');
  if (value.includes('inpatient') && !value.includes('billing')) throw new Error('Inpatient requires Billing.');
  if (value.includes('pharmacy') && !value.includes('inventory')) throw new Error('Pharmacy requires Inventory.');
  return [...value];
}
export function toggleClinicModule(value, code, selected) {
  const next = new Set(value ?? []);
  if (selected) {
    next.add(code);
    if (code === 'inpatient') next.add('billing');
    if (code === 'pharmacy') next.add('inventory');
  } else {
    next.delete(code);
    if (code === 'billing') next.delete('inpatient');
    if (code === 'pharmacy') next.delete('inventory');
  }
  return CLINIC_MODULES.filter(item => next.has(item));
}
export function entitledModules(plan, value) {
  return ['platform', 'patient', 'catalog', 'booking', 'clinical', ...(plan === 'launch' ? [] : ['comms']), ...parseClinicModules(value)];
}
