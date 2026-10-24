'use client';
import {useRef,useEffect} from 'react';
import {Check,Globe2,Layers3,LoaderCircle,Clock3,ArrowUpRight,RefreshCw} from 'lucide-react';
import {provisioningProgress,safeWorkspaceUrl,type ProvisioningState,type WorkspaceDraft} from '../../lib/workspace-onboarding';
import {Stepper} from './onboarding-arc/stepper/stepper';

export default function OnboardingProvisioning({active,verified,draft,refreshing,onRefresh}:{active:ProvisioningState;verified:boolean;draft:WorkspaceDraft;refreshing:boolean;onRefresh:()=>void}){
 const progress=provisioningProgress(active.status,verified);
 const ready=verified&&active.status==='ready',failed=verified&&active.status==='failed';
 const title=useRef<HTMLHeadingElement>(null);
 useEffect(()=>title.current?.focus({preventScroll:true}),[ready,failed]);
 const working=verified&&active.status==='provisioning';
 const target=safeWorkspaceUrl(active.public_url)||safeWorkspaceUrl(active.target_url);
 return <section className="onboarding-provisioning" aria-labelledby="provisioning-title" aria-busy={!verified||working}>
  <p className="capture-account-step">{ready?'Ready to open':failed?'Action needed':'WORKSPACE SETUP'}</p>
  <h1 ref={title} id="provisioning-title" tabIndex={-1}>{progress.label}</h1>
  <p className="capture-account-intro" role="status" aria-live="polite">{progress.detail}</p>
  <div className="provisioning-track"><Stepper label="Website provisioning" current={progress.current} details="current" steps={[{id:'received',label:'Request received'},{id:'deploy',label:verified&&active.status==='queued'?'Waiting to start':'Provision website',error:failed?'Setup stopped':undefined},{id:'ready',label:'Ready to open'}]}/></div>
  <div className="provisioning-destinations">
   <article><Globe2 aria-hidden="true" size={21}/><div><h2>Patient website</h2><p>{draft.websiteTemplate==='sri-lakshmi'?'Sri Lakshmi hospital template':'Standard clinic template'}</p><span>{target?new URL(target).host:'Your website address appears when assigned'}</span></div>{ready?<Check size={18} aria-label="Ready"/>:working?<LoaderCircle className="provisioning-spin" size={18} aria-label="In progress"/>:<Clock3 size={18} aria-label="Waiting"/>}</article>
   <article><Layers3 aria-hidden="true" size={21}/><div><h2>Staff workspace</h2><p>{active.slug||draft.slug||'Your isolated clinic workspace'}</p><span>{ready?'Deployment verified':working?'Preparing workspace and checking services':'Prepared with your website'}</span></div>{ready?<ArrowUpRight size={18} aria-hidden="true"/>:<span className="provisioning-state-label">{working?'In progress':'Pending'}</span>}</article>
  </div>
  <div className="provisioning-recovery"><div><span>Request reference</span><code>{active.onboardingId}</code></div><button className="workspace-secondary" type="button" disabled={refreshing} onClick={onRefresh}><RefreshCw size={14} className={refreshing?'provisioning-spin':''} aria-hidden="true"/>{refreshing?'Checking…':'Check status'}</button></div>
 </section>;
}
