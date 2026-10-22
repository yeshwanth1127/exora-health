"use client";

import { useCallback, useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { BRAND_NAME } from '../../lib/brand';
import { readIntake } from '../../lib/capture-onboarding';
import { STORAGE, emptyWorkspace, fromIntake, restoreDraft, restoreActive, persistActive, workspacePayload, requestWorkspace, readWorkspace, safeWorkspaceUrl, slugify, type WorkspaceDraft, type ProvisioningState, type PendingRequest } from '../../lib/workspace-onboarding';
import BrandLogo from './brand-logo';
import OnboardingMascot from './onboarding-mascot';

const steps = ['Your account', 'Your workspace', 'Your facility', 'Your launch', 'Review'];
const plans = [{ id:'launch', name:'Launch', detail:'Website, appointments and staff workspace.' },{id:'connect',name:'Connect',detail:'Add AI reception and patient communication.'},{id:'scale',name:'Scale',detail:'For growing teams and multiple facilities.'}] as const;
function Field({label,...props}: InputHTMLAttributes<HTMLInputElement> & {label:string}) { return <label>{label}<input {...props}/></label>; }
function readStored(key:string) { try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;} }

export default function CaptureAccount() {
  const [draft,setDraft]=useState<WorkspaceDraft>({...emptyWorkspace});
  const [step,setStep]=useState(0),[loaded,setLoaded]=useState(false),[consent,setConsent]=useState(false);
  const [active,setActive]=useState<ProvisioningState|null>(null),[pending,setPending]=useState<PendingRequest|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false),[statusVerified,setStatusVerified]=useState(false);
  const heading=useRef<HTMLHeadingElement>(null),inFlight=useRef(false);
  useEffect(()=>{
    const fallback=fromIntake(readIntake());
    const saved=restoreDraft(readStored(STORAGE.draft),fallback);
    const attempt=readStored(STORAGE.pending) as PendingRequest|null;
    if(attempt && typeof attempt.key==='string' && attempt.key.length>=16 && typeof attempt.access==='string' && attempt.access.length>=32) {
      try { workspacePayload(attempt.payload,true);setPending(attempt);setDraft(attempt.payload);setStep(4); } catch {setDraft(saved);}
    } else setDraft(saved);
    const restored=restoreActive(readStored(STORAGE.active));
    if(restored){try{persistActive(localStorage,restored);}catch{setError('Allow site storage to recover your saved request.');}}
    setActive(restored);setLoaded(true);
    if(location.hash==='#onboarding')history.replaceState(null,'','/onboarding');
  },[]);
  useEffect(()=>{if(loaded){try{localStorage.setItem(STORAGE.draft,JSON.stringify(draft));}catch{setError('Allow site storage to save and recover your workspace request.');}}},[draft,loaded]);
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[step,loaded,Boolean(active)]);
  const set=<K extends keyof WorkspaceDraft>(key:K,value:WorkspaceDraft[K])=>{if(!pending&&!busy){setDraft(current=>({...current,[key]:value}));setError('');}};
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    if(!active)return;
    try{const next=await readWorkspace(active,signal);if(signal?.aborted)return;persistActive(localStorage,next);setActive(next);setStatusVerified(true);setError('');}
    catch(e){if(!signal?.aborted)setError((e as Error).message);}
  },[active?.onboardingId,active?.accessToken]);
  useEffect(()=>{
    if(!active)return;
    const controller=new AbortController();void refresh(controller.signal);
    const timer=['queued','provisioning'].includes(active.status)?setInterval(()=>void refresh(controller.signal),2500):undefined;
    return()=>{controller.abort();clearInterval(timer);};
  },[refresh,active?.status]);
  async function submit(){
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);setError('');
    let attempt=pending;
    try{
      const payload=workspacePayload(draft,consent);
      attempt=attempt||{key:crypto.randomUUID(),access:crypto.randomUUID()+crypto.randomUUID(),payload};
      // Save the exact request before sending. A timeout must retry the same payload and keys.
      localStorage.setItem(STORAGE.pending,JSON.stringify(attempt));setPending(attempt);
      const state=await requestWorkspace(attempt,AbortSignal.timeout(20000));
      persistActive(localStorage,state);setActive(state);setStatusVerified(false);localStorage.removeItem(STORAGE.pending);setPending(null);
      // Old recovery keys are replaced only after a successful server acknowledgement.
      localStorage.removeItem('exora-onboarding-key');localStorage.removeItem('exora-onboarding-access');
    }catch(e){
      if((e as Error & {canEdit?:boolean}).canEdit){localStorage.removeItem(STORAGE.pending);setPending(null);}
      setError((e as Error).name==='TimeoutError'?'The connection timed out. Retry to recover this same workspace request.':(e as Error).message);
    }finally{inFlight.current=false;setBusy(false);}
  }
  const ready=Boolean(statusVerified&&active?.status==='ready');
  const publicUrl=ready?safeWorkspaceUrl(active?.public_url):undefined,staffUrl=ready?safeWorkspaceUrl(active?.staff_url):undefined;
  const titles=[`Welcome to ${BRAND_NAME}.`,'Make room for your clinic.','Where will you care?','Choose your starting point.','Ready when you are.'];
  const intros=['Start with the person who will own this workspace.','Choose your organisation name and a unique workspace address.','Add your first facility. You can add more later.','Pick your plan, channels and patient website.','Check your details before we create your website and staff workspace.'];
  return <div className="capture-account-page"><header><a href="/" aria-label={`${BRAND_NAME} home`}><BrandLogo/></a><a className="capture-account-close" href="/" aria-label="Close setup">×</a></header>
    <main className={`capture-account-panel workspace-setup ${active?'workspace-status':''}`} id="main-content">
      {!loaded?<p role="status">Restoring your setup…</p>:active?<>
        <div className="capture-account-heading"><OnboardingMascot stage={ready?'profile':'otp'} compact account/><div><p className="capture-account-step">{!statusVerified?'Checking your workspace':ready?'Workspace ready':active.status==='failed'?'Setup needs attention':active.status==='queued'?'Request received':'Creating your workspace'}</p><h1 ref={heading} tabIndex={-1}>{ready?`${draft.organisation || 'Your workspace'} is ready.`:active.status==='failed'?'Let’s get your setup back on track.':'Your next chapter in care.'}</h1><p className="capture-account-intro">{!statusVerified?'Fetching the latest status from your saved request.':ready?'Your website and staff workspace are ready to open.':'This page follows your request as the deployment is prepared. Voice and WhatsApp may need additional provider setup.'}</p></div></div>
        <ol className="workspace-progress" aria-label="Workspace provisioning"><li className="done">Request received</li><li className={active.status==='provisioning'||ready?'done':''}>Create website and workspace</li><li className={ready?'done':''}>Ready to open</li></ol>
        {active.error&&<p role="alert" className="capture-account-error">{active.error}</p>}
        {ready&&<div className="welcome-actions">{staffUrl&&<a className="brand-button-primary" href={staffUrl}>Open staff workspace ↗</a>}{publicUrl&&<a className="workspace-secondary" href={publicUrl}>Open patient website ↗</a>}</div>}
        {ready&&active.admin_username&&<section className="workspace-credentials" aria-label="Administrator sign-in details"><h2>Your administrator sign-in</h2><p>{active.admin_username}</p>{active.temporary_password&&(!active.credential_expires_at||Date.parse(active.credential_expires_at)>Date.now())?<><label>Temporary password<input type="password" readOnly value={active.temporary_password} autoComplete="off"/></label><button type="button" className="workspace-secondary" onClick={async()=>{try{await navigator.clipboard.writeText(active.temporary_password!);setCopied(true);}catch{setError('Copy is unavailable. Select the password manually.');}}}>{copied?'Copied':'Copy temporary password'}</button><p>Save these details securely. You will replace this password at first sign-in. It is not saved in this browser.</p></>:<p>The temporary password is no longer available here. Use account recovery or contact support.</p>}</section>}
        <p className="capture-account-note">Request ID: {active.onboardingId}</p>
        <button className="workspace-secondary" type="button" onClick={()=>void refresh()}>Refresh status</button>
      </>:<>
        <nav className="workspace-steps" aria-label="Setup progress">{steps.map((name,index)=><button key={name} type="button" disabled={busy||Boolean(pending)||index>step} aria-current={index===step?'step':undefined} onClick={()=>{setStep(index);setError('');}}><span>{index+1}</span>{name}</button>)}</nav>
        <div className="capture-account-heading"><OnboardingMascot stage={step===0?'phone':step===4?'profile':'otp'} compact account/><div><p className="capture-account-step">Step {step+1} of {steps.length}</p><h1 ref={heading} tabIndex={-1}>{titles[step]}</h1><p className="capture-account-intro">{intros[step]}</p></div></div>
        {pending&&<p className="workspace-notice">Your last request is saved for recovery. Retry with the same details to avoid creating a duplicate.</p>}
        <form key={step} onSubmit={event=>{event.preventDefault();if(step===4)void submit();else{setStep(step+1);setError('');}}}>
          <fieldset disabled={busy||Boolean(pending)}>
          {step===0&&<><Field label="Your name" required minLength={2} maxLength={100} value={draft.ownerName} onChange={e=>set('ownerName',e.target.value)} autoComplete="name"/><Field label="Work email" required type="email" maxLength={254} value={draft.email} onChange={e=>set('email',e.target.value)} autoComplete="email"/><Field label="Phone number (optional)" type="tel" maxLength={30} value={draft.phone} onChange={e=>set('phone',e.target.value)} autoComplete="tel"/><p className="capture-account-note">Your email becomes the first administrator sign-in. No SMS verification is required.</p></>}
          {step===1&&<><Field label="Organisation name" required minLength={2} maxLength={120} value={draft.organisation} onChange={e=>{const name=e.target.value;setDraft(current=>({...current,organisation:name,slug:!current.slug||current.slug===slugify(current.organisation)?slugify(name):current.slug}));}} autoComplete="organization"/><Field label="Workspace address" required pattern="[a-z0-9][a-z0-9-]{1,62}" minLength={2} maxLength={63} value={draft.slug} onChange={e=>set('slug',slugify(e.target.value))}/><p className="capture-account-note">Your unique workspace identifier. Availability is checked when you submit.</p></>}
          {step===2&&<><Field label="Facility name" required minLength={2} maxLength={120} value={draft.facilityName} onChange={e=>set('facilityName',e.target.value)}/><label>Facility type<select value={draft.facilityType} onChange={e=>set('facilityType',e.target.value as WorkspaceDraft['facilityType'])}><option value="clinic">Clinic</option><option value="hospital">Hospital</option><option value="diagnostic_centre">Diagnostic centre</option><option value="virtual">Virtual clinic</option></select></label><Field label="City" required minLength={2} maxLength={80} autoComplete="address-level2" value={draft.city} onChange={e=>set('city',e.target.value)}/><label>Timezone<select value={draft.timezone} onChange={e=>set('timezone',e.target.value)}>{Array.from(new Set([draft.timezone,'Asia/Kolkata','Asia/Dubai','Europe/London','America/New_York'])).map(t=><option key={t}>{t}</option>)}</select></label></>}
          {step===3&&<><div className="workspace-options">{plans.map(plan=><label key={plan.id} className={draft.plan===plan.id?'selected':''}><input type="radio" name="plan" value={plan.id} checked={draft.plan===plan.id} onChange={()=>setDraft(d=>({...d,plan:plan.id,voice:plan.id==='launch'?false:d.voice}))}/><span><strong>{plan.name}</strong><small>{plan.detail}</small></span></label>)}</div><label className="workspace-check"><input type="checkbox" checked={draft.voice} disabled={draft.plan==='launch'} onChange={e=>set('voice',e.target.checked)}/><span>AI reception & call handling{draft.plan==='launch'&&<small>Available on Connect and Scale.</small>}</span></label><label className="workspace-check"><input type="checkbox" checked={draft.whatsapp} onChange={e=>set('whatsapp',e.target.checked)}/><span>WhatsApp workspace</span></label><label>Patient website<select value={draft.websiteTemplate} onChange={e=>set('websiteTemplate',e.target.value as WorkspaceDraft['websiteTemplate'])}><option value="standard">Standard clinic website</option><option value="sri-lakshmi">Sri Lakshmi hospital website</option></select></label><p className="capture-account-note">These are the two templates available for deployment. Your earlier design preference can be reviewed after launch.</p></>}
          {step===4&&<dl className="workspace-review">{[['Organisation',draft.organisation],['Owner',`${draft.ownerName} · ${draft.email}`],['Workspace address',draft.slug],['Facility',`${draft.facilityName}, ${draft.city}`],['Timezone',draft.timezone],['Plan',plans.find(p=>p.id===draft.plan)?.name],['Channels',[draft.voice&&'AI reception',draft.whatsapp&&'WhatsApp','Website'].filter(Boolean).join(', ')],['Patient website',draft.websiteTemplate==='standard'?'Standard clinic website':'Sri Lakshmi hospital website']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
          </fieldset>
          {step===4&&<label className="workspace-check workspace-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy} required/><span>I confirm these details and authorise creating this organisation’s website and isolated staff workspace.</span></label>}
          <div className="workspace-actions"><button className="workspace-secondary" type="button" disabled={step===0||busy||Boolean(pending)} onClick={()=>{setStep(step-1);setError('');}}>← Back</button><button className="brand-button-primary capture-account-continue" disabled={busy||(step===4&&!consent)} type="submit">{busy?'Sending request…':step===4?pending?'Recover workspace request':'Create my workspace':'Continue'} ↗</button></div>
        </form>
        <p className="capture-account-note">Your progress is saved on this device.</p>
      </>}
      {error&&<p className="capture-account-error" role="alert">{error}</p>}
    </main></div>;
}
