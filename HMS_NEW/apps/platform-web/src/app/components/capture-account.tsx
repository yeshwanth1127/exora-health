"use client";

import { useCallback, useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import {toggleClinicModule,parseClinicModules} from '../../../../../packages/platform/onboarding-modules.mjs';
import {WalletCards,Hospital,Pill,UsersRound,LoaderCircle} from 'lucide-react';
import {Input} from './onboarding-arc/input/input';
import {Select} from './onboarding-arc/select/select';
import {Checkbox} from './onboarding-arc/checkbox/checkbox';
import {Stepper} from './onboarding-arc/stepper/stepper';
import OnboardingProvisioning from './onboarding-provisioning';
import {WebsiteTemplateGrid} from './quote-website-chooser';
import '../quote/quote.css';
import './onboarding-arc/foundation.css';
import {trackWebsite} from "../../lib/website-analytics";
import { BRAND_NAME } from '../../lib/brand';
import { readIntake } from '../../lib/capture-onboarding';
import { STORAGE, emptyWorkspace, restoreQuoteDraft, restoreActive, persistActive, workspacePayload, requestWorkspace, readWorkspace, safeWorkspaceUrl, slugify, stepErrors, type WorkspaceDraft, type ProvisioningState, type PendingRequest } from '../../lib/workspace-onboarding';
import BrandLogo from './brand-logo';
import OnboardingMascot from './onboarding-mascot';

const steps = ['Account', 'Workspace', 'Facility', 'Modules', 'Website', 'Review'];
const modules=[{id:'billing',name:'Billing',detail:'Invoices, payments and financial operations.',icon:WalletCards},{id:'inpatient',name:'Inpatient',detail:'Admissions and discharge operations. Includes Billing.',icon:Hospital},{id:'pharmacy',name:'Pharmacy & inventory',detail:'Dispensing and stock access together.',icon:Pill},{id:'hr',name:'HR & staff',detail:'Employee and payroll administration.',icon:UsersRound}] as const;
const selectedModules=(d:WorkspaceDraft)=>modules.filter(m=>parseClinicModules(d.clinicModules).includes(m.id));
const plans = [{ id:'launch', name:'Launch', detail:'Website, appointments and staff workspace.' },{id:'connect',name:'Connect',detail:'Add AI reception and patient communication.'},{id:'scale',name:'Scale',detail:'For growing teams and multiple facilities.'}] as const;
function Field({label,...props}: InputHTMLAttributes<HTMLInputElement> & {label:string;error?:string}) { return <Input label={label} data-arc-input {...props}/>; }
function readStored(key:string) { try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;} }

export default function CaptureAccount() {
  const [draft,setDraft]=useState<WorkspaceDraft>({...emptyWorkspace});
  const [step,setStep]=useState(0),[loaded,setLoaded]=useState(false),[consent,setConsent]=useState(false);
  const [active,setActive]=useState<ProvisioningState|null>(null),[pending,setPending]=useState<PendingRequest|null>(null);
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({}),[refreshing,setRefreshing]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false),[statusVerified,setStatusVerified]=useState(false);
  const lastAnalyticsStatus=useRef('');
  useEffect(()=>{const send=()=>{if(loaded&&!active)trackWebsite('onboarding_step_viewed',{path:'/onboarding',stage:['account','workspace','facility','modules','website','review'][step]});};send();window.addEventListener('website:analytics-ready',send);return()=>window.removeEventListener('website:analytics-ready',send);},[step,loaded,Boolean(active)]);
  useEffect(()=>{const send=()=>{if(statusVerified&&active&&lastAnalyticsStatus.current!==active.status&&trackWebsite('workspace_status_changed',{path:'/onboarding',status:active.status}))lastAnalyticsStatus.current=active.status;};send();window.addEventListener('website:analytics-ready',send);return()=>window.removeEventListener('website:analytics-ready',send);},[statusVerified,active?.status]);
  const heading=useRef<HTMLHeadingElement>(null),inFlight=useRef(false),pollInFlight=useRef(false);
  useEffect(()=>{const prior=document.body.classList.contains('arc-scope');document.body.classList.add('arc-scope');return()=>{if(!prior)document.body.classList.remove('arc-scope');};},[]);
  useEffect(()=>{
    const attempt=readStored(STORAGE.pending) as PendingRequest|null;
    const restored=restoreActive(readStored(STORAGE.active));
    const intake=attempt||restored?null:readIntake();
    const saved=restoreQuoteDraft(readStored(STORAGE.draft),intake,localStorage);
    if(attempt && typeof attempt.key==='string' && attempt.key.length>=16 && typeof attempt.access==='string' && attempt.access.length>=32) {
      try { workspacePayload(attempt.payload,true);setPending(attempt);setDraft(attempt.payload);setStep(5); } catch {setDraft(saved);}
    } else setDraft(saved);
    if(restored){try{persistActive(localStorage,restored);}catch{setError('Allow site storage to recover your saved request.');}}
    setActive(restored);setLoaded(true);
    if(location.hash==='#onboarding')history.replaceState(null,'','/onboarding');
  },[]);
  useEffect(()=>{if(loaded){try{localStorage.setItem(STORAGE.draft,JSON.stringify(draft));}catch{setError('Allow site storage to save and recover your workspace request.');}}},[draft,loaded]);
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[step,loaded,Boolean(active)]);
  const set=<K extends keyof WorkspaceDraft>(key:K,value:WorkspaceDraft[K])=>{if(!pending&&!busy){setDraft(current=>({...current,[key]:value}));setError('');setFieldErrors(current=>{const next={...current};delete next[key];return next;});}};
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    if(!active||pollInFlight.current)return;
    pollInFlight.current=true;setRefreshing(true);
    try{const next=await readWorkspace(active,signal);if(signal?.aborted)return;persistActive(localStorage,next);setActive(next);setStatusVerified(true);setError('');}
    catch(e){if(!signal?.aborted)setError((e as Error).message);}
    finally{pollInFlight.current=false;if(!signal?.aborted)setRefreshing(false);}
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
      trackWebsite('workspace_request_submitted',{path:'/onboarding',outcome:'accepted',plan:attempt.payload.plan,template:attempt.payload.websiteTemplate});
      persistActive(localStorage,state);setActive(state);setStatusVerified(false);localStorage.removeItem(STORAGE.pending);setPending(null);
      // Old recovery keys are replaced only after a successful server acknowledgement.
      localStorage.removeItem('exora-onboarding-key');localStorage.removeItem('exora-onboarding-access');
    }catch(e){
      trackWebsite('workspace_request_failed',{path:'/onboarding',outcome:'unavailable'});
      if((e as Error & {canEdit?:boolean}).canEdit){localStorage.removeItem(STORAGE.pending);setPending(null);}
      setError((e as Error).name==='TimeoutError'?'The connection timed out. Retry to recover this same workspace request.':(e as Error).message);
    }finally{inFlight.current=false;setBusy(false);}
  }
  const ready=Boolean(statusVerified&&active?.status==='ready');
  const publicUrl=ready?safeWorkspaceUrl(active?.public_url):undefined,staffUrl=ready?safeWorkspaceUrl(active?.staff_url):undefined;
  const titles=[`Welcome to ${BRAND_NAME}.`,'Make room for your clinic.','Where will you care?','Make it your own.','Choose your website.','Ready when you are.'];
  const intros=['Start with the person who will own this workspace.','Choose your organisation name and a unique workspace address.','Add your first facility. You can add more later.','Select the modules and channels your team needs.','Choose a starting point. Open either preview to explore it in a new tab.','Check your details before we create your website and staff workspace.'];
  return <div className="capture-account-page arc-scope"><header><a href="/" aria-label={`${BRAND_NAME} home`}><BrandLogo/></a><a className="capture-account-close" href="/" aria-label="Close setup">×</a></header>
    <main className={`capture-account-panel workspace-setup ${active?'workspace-status':''}`} id="main-content">
      {!loaded?<p role="status">Restoring your setup…</p>:active?<>
        <OnboardingProvisioning active={active} verified={statusVerified} draft={draft} refreshing={refreshing} onRefresh={()=>void refresh()}/>
        {ready&&<div className="welcome-actions">{staffUrl&&<a className="brand-button-primary" href={staffUrl}>Open staff workspace ↗</a>}{publicUrl&&<a className="workspace-secondary" href={publicUrl}>Open patient website ↗</a>}</div>}
        {ready&&active.admin_username&&<section className="workspace-credentials" aria-label="Administrator sign-in details"><h2>Your administrator sign-in</h2><p>{active.admin_username}</p>{active.temporary_password&&(!active.credential_expires_at||Date.parse(active.credential_expires_at)>Date.now())?<><label>Temporary password<input type="password" readOnly value={active.temporary_password} autoComplete="off"/></label><button type="button" className="workspace-secondary" onClick={async()=>{try{await navigator.clipboard.writeText(active.temporary_password!);setCopied(true);}catch{setError('Copy is unavailable. Select the password manually.');}}}>{copied?'Copied':'Copy temporary password'}</button><p>Save these details securely. You will replace this password at first sign-in. It is not saved in this browser.</p></>:<p>The temporary password is no longer available here. Use account recovery or contact support.</p>}</section>}
      </>:<>
        <div className="onboarding-stepper"><Stepper label="Setup progress" steps={steps.map((label,index)=>({id:String(index),label}))} current={step} details="current" onStepSelect={busy||pending?undefined:index=>{setStep(index);setFieldErrors({});setError('');}}/></div>
        <div className="capture-account-heading"><OnboardingMascot stage={step===0?'phone':step===5?'profile':'otp'} compact account/><div><p className="capture-account-step">Step {step+1} of {steps.length}</p><h1 ref={heading} tabIndex={-1}>{titles[step]}</h1><p className="capture-account-intro">{intros[step]}</p></div></div>
        {pending&&<p className="workspace-notice">Your last request is saved for recovery. Retry with the same details to avoid creating a duplicate.</p>}
        <form key={step} noValidate onSubmit={event=>{event.preventDefault();const errors=stepErrors(draft,step);setFieldErrors(errors);if(Object.keys(errors).length){requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());return;}if(step===5)void submit();else{setStep(step+1);setError('');}}}>
          <fieldset disabled={busy||Boolean(pending)}>
          {step===0&&<><Field label="Your name" error={fieldErrors.ownerName} required minLength={2} maxLength={100} value={draft.ownerName} onChange={e=>set('ownerName',e.target.value)} autoComplete="name"/><Field label="Work email" error={fieldErrors.email} required type="email" maxLength={254} value={draft.email} onChange={e=>set('email',e.target.value)} autoComplete="email"/><Field label="Phone number (optional)" error={fieldErrors.phone} type="tel" maxLength={30} value={draft.phone} onChange={e=>set('phone',e.target.value)} autoComplete="tel"/><p className="capture-account-note">Your email becomes the first administrator sign-in. No SMS verification is required.</p></>}
          {step===1&&<><Field label="Organisation name" error={fieldErrors.organisation} required minLength={2} maxLength={120} value={draft.organisation} onChange={e=>{const name=e.target.value;setDraft(current=>({...current,organisation:name,slug:!current.slug||current.slug===slugify(current.organisation)?slugify(name):current.slug}));}} autoComplete="organization"/><Field label="Workspace address" error={fieldErrors.slug} required pattern="[a-z0-9][a-z0-9-]{1,62}" minLength={2} maxLength={63} value={draft.slug} onChange={e=>set('slug',slugify(e.target.value))}/><p className="capture-account-note">Your unique workspace identifier. Availability is checked when you submit.</p></>}
          {step===2&&<><Field label="Facility name" error={fieldErrors.facilityName} required minLength={2} maxLength={120} value={draft.facilityName} onChange={e=>set('facilityName',e.target.value)}/><Select label="Facility type" disabled={busy||Boolean(pending)} value={draft.facilityType} onValueChange={value=>set('facilityType',value as WorkspaceDraft['facilityType'])} options={[{value:"clinic",label:"Clinic"},{value:"hospital",label:"Hospital"},{value:"diagnostic_centre",label:"Diagnostic centre"},{value:"virtual",label:"Virtual clinic"}]}/><Field label="City" error={fieldErrors.city} required minLength={2} maxLength={80} autoComplete="address-level2" value={draft.city} onChange={e=>set('city',e.target.value)}/><Select label="Timezone" disabled={busy||Boolean(pending)} value={draft.timezone} onValueChange={value=>set('timezone',value)} options={Array.from(new Set([draft.timezone,'Asia/Kolkata','Asia/Dubai','Europe/London','America/New_York'])).map(value=>({value,label:value.replaceAll('_',' ')}))}/></>}
          {step===3&&<>
            {fieldErrors.plan&&<p role="alert" className="capture-account-error">{fieldErrors.plan}</p>}
            <div className="onboarding-module-count" role="status"><strong>{selectedModules(draft).length} of {modules.length}</strong><span>additional modules selected · choose any combination</span></div>
            <div className="onboarding-module-grid" role="group" aria-label="Additional modules">{modules.map(({id,name,detail,icon:Icon})=><button type="button" className="onboarding-selection-tile" key={id} aria-pressed={draft.clinicModules?.includes(id)||false} onClick={()=>set('clinicModules',toggleClinicModule(draft.clinicModules,id,!draft.clinicModules?.includes(id)))}><Icon aria-hidden="true" size={22}/><strong>{name}</strong><span>{detail}</span></button>)}</div>
            <p className="capture-account-note">Inpatient includes Billing; Pharmacy includes Inventory. These backend modules are configured during provisioning and require administrator activation. Their staff screens are not included in this setup.</p>
            {fieldErrors.clinicModules&&<p role="alert" className="capture-account-error">{fieldErrors.clinicModules}</p>}
            <h2 className="onboarding-section-title">Your channels</h2>
            <div className="onboarding-module-grid" role="group" aria-label="Communication channels">
              <button type="button" className="onboarding-selection-tile" aria-pressed={draft.voice} disabled={draft.plan==='launch'} onClick={()=>set('voice',!draft.voice)}><strong>AI reception & call handling</strong><span>{draft.plan==='launch'?'Available on Connect and Scale.':'Provider setup is completed separately.'}</span></button>
              <button type="button" className="onboarding-selection-tile" aria-pressed={draft.whatsapp} onClick={()=>set('whatsapp',!draft.whatsapp)}><strong>WhatsApp workspace</strong><span>Connection and provider activation follow setup.</span></button>
            </div>
          </>}
          {step===4&&<div className="onboarding-website-chooser"><WebsiteTemplateGrid value={draft.websiteTemplate} category={draft.facilityType==='hospital'?'hospital':'clinic'} disabled={busy||Boolean(pending)} onValueChange={value=>set('websiteTemplate',value)}/>{fieldErrors.websiteTemplate&&<p role="alert" className="capture-account-error">{fieldErrors.websiteTemplate}</p>}<p className="capture-account-note">Select a design below its preview. You can change it before creating your workspace.</p></div>}
          {step===5&&<dl className="workspace-review">{[['Organisation',draft.organisation],['Owner',`${draft.ownerName} · ${draft.email}`],['Workspace address',draft.slug],['Facility',`${draft.facilityName}, ${draft.city}`],['Timezone',draft.timezone],['Additional modules',selectedModules(draft).map(m=>m.name).join(', ')||'Core workspace only'],['Plan',plans.find(p=>p.id===draft.plan)?.name],['Channels',[draft.voice&&'AI reception',draft.whatsapp&&'WhatsApp','Website'].filter(Boolean).join(', ')],['Patient website',draft.websiteTemplate==='standard'?'Standard clinic website':'Sri Lakshmi hospital website']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
          </fieldset>
          {step===5&&<div className="workspace-consent"><Checkbox disabled={busy} checked={consent} onCheckedChange={value=>setConsent(value===true)} label="I confirm these details and authorise creating this organisation’s website and isolated staff workspace."/></div>}
          <div className="workspace-actions"><button className="workspace-secondary" type="button" disabled={step===0||busy||Boolean(pending)} onClick={()=>{setStep(step-1);setError('');}}>← Back</button><button className="brand-button-primary capture-account-continue" disabled={busy||(step===5&&!consent)} type="submit">{busy?<><LoaderCircle size={16} className="provisioning-spin" aria-hidden="true"/>Sending request…</>:step===5?pending?'Recover workspace request':'Create my workspace':'Continue'} ↗</button></div>
        </form>
        <p className="capture-account-note">Your progress is saved on this device.</p>
      </>}
      {error&&<p className="capture-account-error" role="alert">{error}</p>}
    </main></div>;
}
