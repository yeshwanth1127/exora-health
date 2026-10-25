import type { OnboardingIntake } from './capture-onboarding';

export type WorkspaceDraft = {
  organisation: string; slug: string; ownerName: string; email: string; phone: string;
  city: string; timezone: string; facilityName: string;
  facilityType: 'clinic' | 'hospital' | 'diagnostic_centre' | 'virtual';
  plan: 'launch' | 'connect' | 'scale'; voice: boolean; whatsapp: boolean;
  websiteTemplate: 'standard' | 'sri-lakshmi' | 'hospital-editorial';
};
export type WorkspaceRequest = WorkspaceDraft & { termsAccepted: true };
export type ProvisioningState = {
  onboardingId: string; accessToken: string; status: 'queued' | 'provisioning' | 'ready' | 'failed';
  public_url?: string; staff_url?: string; error?: string;
  admin_username?: string; temporary_password?: string; credential_expires_at?: string;
};
export type PendingRequest = { key: string; access: string; payload: WorkspaceRequest };
export const STORAGE = { draft: 'exora-onboarding', active: 'exora-onboarding-active', pending: 'exora-onboarding-pending-v2' };
export const emptyWorkspace: WorkspaceDraft = {
  organisation: '', slug: '', ownerName: '', email: '', phone: '', city: '', timezone: 'Asia/Kolkata',
  facilityName: '', facilityType: 'clinic', plan: 'connect', voice: true, whatsapp: false, websiteTemplate: 'standard',
};
export const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
export function fromIntake(intake: OnboardingIntake | null): WorkspaceDraft {
  if (!intake) return { ...emptyWorkspace };
  return { ...emptyWorkspace, organisation: intake.facility.name, slug: slugify(intake.facility.name),
    facilityName: intake.facility.name, city: intake.facility.city, ownerName: intake.profile.name,
    email: intake.profile.email, phone: intake.profile.phone,
    facilityType: intake.facility.size === 'hospital' ? 'hospital' : 'clinic',
    websiteTemplate: ['standard','sri-lakshmi','hospital-editorial'].includes(intake.preferences.template) ? intake.preferences.template as WorkspaceDraft['websiteTemplate'] : 'standard' };
}
export function draftErrors(d: WorkspaceDraft): string[] {
  const errors: string[] = [];
  for (const [key, label, max] of [['organisation','Organisation name',120],['ownerName','Your name',100],['facilityName','Facility name',120],['city','City',80]] as const)
    if (typeof d[key] !== 'string' || d[key].trim().length < 2 || d[key].trim().length > max) errors.push(`${label} must be between 2 and ${max} characters.`);
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(d.slug)) errors.push('Use 2–63 lowercase letters, numbers or hyphens for your workspace address.');
  if (d.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) errors.push('Enter a valid email address.');
  if (d.phone.length > 30) errors.push('Phone number must be 30 characters or fewer.');
  try { new Intl.DateTimeFormat('en', { timeZone: d.timezone }); } catch { errors.push('Choose a valid timezone.'); }
  if (!['clinic','hospital','diagnostic_centre','virtual'].includes(d.facilityType)) errors.push('Choose a facility type.');
  if (!['launch','connect','scale'].includes(d.plan)) errors.push('Choose a launch plan.');
  if (!['standard','sri-lakshmi','hospital-editorial'].includes(d.websiteTemplate)) errors.push('Choose a supported website template.');
  if (typeof d.voice !== 'boolean' || typeof d.whatsapp !== 'boolean') errors.push('Choose your channels.');
  if (d.voice && d.plan === 'launch') errors.push('AI reception requires Connect or Scale.');
  return errors;
}
export function workspacePayload(draft: WorkspaceDraft, consent: boolean): WorkspaceRequest {
  const clean = Object.fromEntries(Object.entries(draft).filter(([key]) => key in emptyWorkspace).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])) as WorkspaceDraft;
  const errors = draftErrors(clean);
  if (!consent) errors.push('Confirm your launch details before requesting a workspace.');
  if (errors.length) throw new Error(errors.join(' '));
  return { ...clean, termsAccepted: true };
}
export function restoreDraft(value: unknown, fallback: WorkspaceDraft): WorkspaceDraft {
  if (!value || typeof value !== 'object') return fallback;
  const next = { ...fallback };
  for (const key of Object.keys(emptyWorkspace) as (keyof WorkspaceDraft)[]) {
    const item = (value as Record<string, unknown>)[key];
    if (typeof item === typeof emptyWorkspace[key] && (typeof item !== 'string' || item.length <= 254)) Object.assign(next, { [key]: item });
  }
  if (!['launch','connect','scale'].includes(next.plan)) next.plan = 'connect';
  if (!['standard','sri-lakshmi','hospital-editorial'].includes(next.websiteTemplate)) next.websiteTemplate = 'standard';
  if (next.plan === 'launch') next.voice = false;
  return next;
}
export function restoreActive(value: unknown): ProvisioningState | null {
  const v = value as ProvisioningState;
  if (!v || !/^[a-f0-9-]{36}$/i.test(v.onboardingId) || typeof v.accessToken !== 'string' || v.accessToken.length < 32 || !['queued','provisioning','ready','failed'].includes(v.status)) return null;
  return { onboardingId: v.onboardingId, accessToken: v.accessToken, status: v.status };
}
export function persistActive(storage: Pick<Storage, 'setItem'>, value: ProvisioningState) {
  // Temporary credentials and deployment responses are never written to browser storage.
  storage.setItem(STORAGE.active, JSON.stringify({ onboardingId: value.onboardingId, accessToken: value.accessToken, status: value.status }));
}
export async function requestWorkspace(pending: PendingRequest, signal?: AbortSignal): Promise<ProvisioningState> {
  const response = await fetch('/control/v1/onboarding', { method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'idempotency-key': pending.key, 'x-onboarding-access': pending.access }, body: JSON.stringify(pending.payload) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || body.issues?.map((i: { path?: string; message?: string }) => `${i.path || ''}: ${i.message || ''}`).join(' · ') || 'Workspace setup is unavailable. Please try again.');
    Object.assign(error, { canEdit: response.status === 400 || body.error === 'slug_unavailable' });
    throw error;
  }
  const state = restoreActive({ ...body, accessToken: body.accessToken || pending.access });
  if (!state) throw new Error('The server returned an incomplete workspace response. Retry to recover the request.');
  return state;
}
export async function readWorkspace(active: ProvisioningState, signal?: AbortSignal): Promise<ProvisioningState> {
  const response = await fetch(`/control/v1/onboarding/${encodeURIComponent(active.onboardingId)}`, { signal, cache: 'no-store', headers: { authorization: `Bearer ${active.accessToken}` } });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 404 ? 'This setup cannot be accessed with the saved request. Contact support with your request ID.' : 'We could not refresh your setup. Your request is still saved; try again.');
  const body = await response.json();
  const base = restoreActive({ ...body, onboardingId: body.id || body.onboardingId || active.onboardingId, accessToken: active.accessToken });
  if (!base) throw new Error('The server returned an unknown setup status. Try refreshing.');
  return { ...base, ...Object.fromEntries(['public_url','staff_url','error','admin_username','temporary_password','credential_expires_at'].filter(key => typeof body[key] === 'string').map(key => [key, body[key]])) };
}
export function safeWorkspaceUrl(value?: string): string | undefined {
  try { const url = new URL(value || ''); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; }
}
