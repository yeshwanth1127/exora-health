import {parseClinicModules,type ClinicModule} from '../../../../packages/platform/onboarding-modules.mjs';
import type { OnboardingIntake } from './capture-onboarding';

export type WorkspaceDraft = {
  organisation: string; slug: string; ownerName: string; email: string; phone: string;
  city: string; timezone: string; facilityName: string;
  facilityType: 'clinic' | 'hospital' | 'diagnostic_centre' | 'virtual';
  plan: 'launch' | 'connect' | 'scale'; voice: boolean; whatsapp: boolean;
  websiteTemplate: 'standard' | 'sri-lakshmi';
  clinicModules?: ClinicModule[];
};
export type WorkspaceRequest = WorkspaceDraft & { termsAccepted: true };
export type ProvisioningState = {
  onboardingId: string; accessToken: string; status: 'queued' | 'provisioning' | 'ready' | 'failed';
  public_url?: string; staff_url?: string; target_url?: string; slug?: string; created_at?: string; updated_at?: string; error?: string;
  admin_username?: string; temporary_password?: string; credential_expires_at?: string;
};
export type PendingRequest = { key: string; access: string; payload: WorkspaceRequest };
export const STORAGE = { draft: 'exora-onboarding', active: 'exora-onboarding-active', pending: 'exora-onboarding-pending-v2' };
export const emptyWorkspace: WorkspaceDraft = {
  organisation: '', slug: '', ownerName: '', email: '', phone: '', city: '', timezone: 'Asia/Kolkata',
  facilityName: '', facilityType: 'clinic', clinicModules: [], plan: 'connect', voice: true, whatsapp: false, websiteTemplate: 'standard',
};
export const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
export function fromIntake(intake: OnboardingIntake | null): WorkspaceDraft {
  if (!intake) return { ...emptyWorkspace };
  return { ...emptyWorkspace, organisation: intake.facility.name, slug: slugify(intake.facility.name),
    facilityName: intake.facility.name, city: intake.facility.city, ownerName: intake.profile.name,
    email: intake.profile.email, phone: intake.profile.phone,
    facilityType: intake.facility.size === 'hospital' ? 'hospital' : 'clinic',
    websiteTemplate: intake.preferences.template === 'sri-lakshmi' ? 'sri-lakshmi' : 'standard' };
}
// Apply each quote handoff once. Subsequent onboarding edits survive reloads.
export function restoreQuoteDraft(value:unknown,intake:OnboardingIntake|null,storage:Pick<Storage,'getItem'|'setItem'>):WorkspaceDraft {
  const draft=restoreDraft(value,fromIntake(intake));
  const template=intake?.preferences.template;
  if(intake&&(template==='standard'||template==='sri-lakshmi')){
    const marker=`${intake.expiresAt}:${template}`;
    let applied:string|null=null;
    try{applied=storage.getItem('exora-onboarding-quote-applied');}catch{}
    if(applied!==marker){
      draft.websiteTemplate=template;
      try{
        storage.setItem(STORAGE.draft,JSON.stringify(draft));
        storage.setItem('exora-onboarding-quote-applied',marker);
      }catch{} // The wizard reports unavailable draft storage without blocking restoration.
    }
  }
  return draft;
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
  if (!['standard','sri-lakshmi'].includes(d.websiteTemplate)) errors.push('Choose a supported website template.');
  if (typeof d.voice !== 'boolean' || typeof d.whatsapp !== 'boolean') errors.push('Choose your channels.');
  try{parseClinicModules(d.clinicModules);}catch(error){errors.push((error as Error).message);}
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
  if (!['standard','sri-lakshmi'].includes(next.websiteTemplate)) next.websiteTemplate = 'standard';
  try{next.clinicModules=parseClinicModules((value as WorkspaceDraft).clinicModules);}catch{next.clinicModules=[];}
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
  return { ...base, ...Object.fromEntries(['public_url','staff_url','target_url','slug','created_at','updated_at','error','admin_username','temporary_password','credential_expires_at'].filter(key => typeof body[key] === 'string').map(key => [key, body[key]])) };
}
export function safeWorkspaceUrl(value?: string): string | undefined {
  try { const url = new URL(value || ''); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; }
}

export function stepErrors(d:WorkspaceDraft,step:number):Record<string,string>{
 const errors:Record<string,string>={};
 const bounded=(key:'ownerName'|'organisation'|'facilityName'|'city',label:string,max:number)=>{if(d[key].trim().length<2||d[key].trim().length>max)errors[key]=`${label} must be between 2 and ${max} characters.`;};
 if(step===0){bounded('ownerName','Your name',100);if(d.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()))errors.email='Enter a valid work email address.';if(d.phone.length>30)errors.phone='Use 30 characters or fewer.';}
 if(step===1){bounded('organisation','Organisation name',120);if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(d.slug))errors.slug='Use 2–63 lowercase letters, numbers or hyphens.';}
 if(step===2){bounded('facilityName','Facility name',120);bounded('city','City',80);if(!['clinic','hospital','diagnostic_centre','virtual'].includes(d.facilityType))errors.facilityType='Choose a facility type.';try{new Intl.DateTimeFormat('en',{timeZone:d.timezone});}catch{errors.timezone='Choose a valid timezone.';}}
 if(step===3){try{parseClinicModules(d.clinicModules);}catch(error){errors.clinicModules=(error as Error).message;}}
 if(step===3){if(!['launch','connect','scale'].includes(d.plan))errors.plan='Choose a plan.';if(d.voice&&d.plan==='launch')errors.plan='AI reception requires Connect or Scale.';}
 if(step===4){if(!['standard','sri-lakshmi'].includes(d.websiteTemplate))errors.websiteTemplate='Choose a supported website template.';}
 return errors;
}
export function provisioningProgress(status:ProvisioningState['status'],verified:boolean){
 if(!verified)return {current:0,label:'Checking your saved request',detail:'Fetching the latest status. Ready links appear only after the server confirms them.'};
 if(status==='queued')return {current:1,label:'Your setup is in the queue',detail:'Your request is saved and waiting for the provisioning worker. You can leave and return on this device.'};
 if(status==='provisioning')return {current:1,label:'Your website is being provisioned',detail:'The provisioning worker is preparing your patient website and isolated staff workspace. We’ll update this page when checks finish.'};
 if(status==='failed')return {current:1,label:'Your setup needs attention',detail:'Provisioning stopped before completion. Your request is saved; contact support with the request ID below.'};
 return {current:3,label:'Your workspace is ready',detail:'The server has confirmed your deployment. Open your patient website or continue into the staff workspace.'};
}
