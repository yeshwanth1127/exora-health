import {PatientPage} from './PatientPages';
import { CommunityHome, CommunityHeader, CommunityFooter } from './CommunityHome';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { HospitalGallerySection } from './components/sections/HospitalGallerySection';
import { HmsDoctorDirectory } from './components/doctor/HmsDoctorDirectory';
import { HmsDoctorProfile } from './components/doctor/HmsDoctorProfile';
import { HmsBookingPage } from './components/booking/HmsBookingPage';
import { createPublicBookingApi, type PublicCatalog } from './lib/publicBookingApi';
import { loadWebsite, phoneLink, type WebsiteProfile } from './lib/website';

function Page({title,children}:{title:string;children:ReactNode}){return <section className="focused-page-heading sri-module"><h1>{title}</h1>{children}</section>;}
const stock='/images/cardiology-consultation.jpg';
export default function App(){
 const [profile,setProfile]=useState<WebsiteProfile|null>(null),[profileError,setProfileError]=useState(''),[retry,setRetry]=useState(0);
 const [catalog,setCatalog]=useState<PublicCatalog|null>(null),[catalogLoading,setCatalogLoading]=useState(true),[catalogError,setCatalogError]=useState('');
 const [path,setPath]=useState(location.pathname),[query,setQuery]=useState(location.search);
 const previous=useRef(location.pathname+location.search);
 const api=useMemo(()=>{try{return createPublicBookingApi();}catch{return null;}},[]);
 const navigate=(to:string)=>{
  if(to===location.pathname+location.search){window.scrollTo(0,0);return;}
  if(!window.dispatchEvent(new Event('hms-booking-leave',{cancelable:true})))return;
  history.pushState({},'',to);previous.current=to;setPath(location.pathname);setQuery(location.search);window.dispatchEvent(new Event('popstate'));window.scrollTo(0,0);
 };
 useEffect(()=>{
  const controller=new AbortController();setProfileError('');
  loadWebsite(controller.signal).then(setProfile).catch(error=>{if(!controller.signal.aborted)setProfileError(error.message);});
  return()=>controller.abort();
 },[retry]);
 useEffect(()=>{
  const controller=new AbortController();setCatalogLoading(true);setCatalogError('');
  if(!api){setCatalogLoading(false);setCatalogError('Online booking is not configured for this hospital. Contact reception for help.');return;}
  api.catalog(controller.signal).then(setCatalog).catch(error=>{if(!controller.signal.aborted){setCatalog(null);setCatalogError(error.message);}}).finally(()=>{if(!controller.signal.aborted)setCatalogLoading(false);});
  return()=>controller.abort();
 },[api,retry]);
 useEffect(()=>{
  const sync=()=>{
   const next=location.pathname+location.search;
   if(next!==previous.current&&!window.dispatchEvent(new Event('hms-booking-leave',{cancelable:true}))){history.pushState({},'',previous.current);return;}
   previous.current=next;setPath(location.pathname);setQuery(location.search);
  };
  const clicks=(event:MouseEvent)=>{
   if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
   const link=(event.target as Element).closest('a');if(!link||link.target==='_blank'||link.hasAttribute('download'))return;
   const url=new URL(link.href);if(url.origin!==location.origin||url.hash)return;
   event.preventDefault();navigate(url.pathname+url.search);
  };
  window.addEventListener('popstate',sync);document.addEventListener('click',clicks);
  return()=>{window.removeEventListener('popstate',sync);document.removeEventListener('click',clicks);};
 },[]);
 useEffect(()=>{document.title=profile?`${profile.name}${path==='/'?'':' · '+(path.split('/').filter(Boolean)[0]||'')}`:'Hospital website';},[profile,path]);
 const home=()=>navigate('/'),book=(id?:string)=>navigate('/book'+(id?'/'+encodeURIComponent(id):''));
 if(profileError)return <Page title="The hospital website is temporarily unavailable."><p role="alert">{profileError}</p><button className="editorial-action" onClick={()=>setRetry(n=>n+1)}>Try again</button></Page>;
 if(!profile)return <Page title="Loading hospital website"><p role="status">Loading the hospital’s saved details…</p></Page>;
 const {name,city,content}=profile;
 const phone=phoneLink(profile.phone);
 const doctors=catalog?.doctors||[];
 const [page,id]=path.split('/').filter(Boolean).map(value=>{try{return decodeURIComponent(value);}catch{return '';}});
 const selected=doctors.find(doctor=>doctor.slug===id);
 const departments=content.specialties?.map(s=>s.name)||[...new Set(doctors.flatMap(doctor=>doctor.departments.length?doctor.departments:doctor.specialty?[doctor.specialty]:[]))];
 const directory=<HmsDoctorDirectory key={query} roster={doctors} clinicName={name} loading={catalogLoading} error={catalogError} initialQuery={new URLSearchParams(query).get('q')||''} onRetry={()=>setRetry(n=>n+1)} onBackToHome={home} onSelectDoctor={id=>navigate('/doctors/'+id)} onBookDoctor={book} onExploreDepartments={()=>navigate('/departments')}/>;
 const gallery=content.photos.length>0?<HospitalGallerySection preview={content.preview} name={name} photos={content.photos} onExploreHospital={()=>navigate('/facilities')}/>:null;
 const healthChecks=<div className="editorial-package-grid">{content.packages.map(item=><article key={item.id}><p>Health check</p><h2>{item.name}</h2><strong>{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(item.priceMinor/100)}</strong><p>{item.description}</p><ul>{item.inclusions.map(inclusion=><li key={inclusion}>{inclusion}</li>)}</ul><a href={'/contact?package='+encodeURIComponent(item.id)}>Ask about this package ↗</a></article>)}</div>;
 let body:ReactNode;
 if(!page)body=<CommunityHome profile={profile} roster={doctors} loading={catalogLoading} error={catalogError} onRetry={()=>setRetry(n=>n+1)} onBook={book} onNavigate={navigate}/>;
 else if(page==='doctors'&&id&&selected)body=<HmsDoctorProfile doctor={selected} clinicName={name} onBackToHome={home} onBackToSearch={()=>navigate('/doctors')} onScheduleAppointment={book}/>;
 else if(page==='doctors'&&id)body=<Page title="Doctor profile unavailable"><p>{catalogLoading?'Loading published profiles…':catalogError||'This doctor is not published for this hospital.'}</p><a href="/doctors">View published doctors ↗</a></Page>;
 else if(page==='doctors')body=directory;
 else if(page==='book')body=api?<HmsBookingPage key={id||'all'} api={api} requestedDoctorId={id} onBack={()=>navigate('/doctors')}/>:<Page title="Online booking is unavailable"><p>{catalogError}</p><a href="/contact">Contact reception ↗</a></Page>;
 else if(page==='departments'&&id)body=departments.includes(id)?<HmsDoctorDirectory title={`${id} at ${name}`} roster={doctors.filter(doctor=>doctor.departments.includes(id)||doctor.specialty===id)} clinicName={name} loading={catalogLoading} error={catalogError} onRetry={()=>setRetry(n=>n+1)} onBackToHome={home} onSelectDoctor={slug=>navigate('/doctors/'+slug)} onBookDoctor={book} onExploreDepartments={()=>navigate('/departments')}/>:<Page title="Specialty information is unavailable."><p>This specialty is not published for this hospital.</p><a href="/departments">Explore published specialties ↗</a></Page>;
 else if(page==='departments')body=<Page title="Find the right specialty."><p>Explore the specialties represented by {name}’s published care team.</p><div className="editorial-links">{departments.map(department=><a key={department} href={'/departments/'+encodeURIComponent(department)}>{department} ↗</a>)}</div>{!departments.length&&<p>{catalogLoading?'Loading specialties…':'Specialty information is not published yet. Please contact reception.'}</p>}</Page>;
 else if(page==='packages')body=<Page title="Health checks, clearly explained."><p>Explore packages published by {name}. Contact reception to confirm preparation and current availability.</p>{content.packages.length?healthChecks:<p>No health check packages are published here yet. <a href="/contact">Ask reception ↗</a></p>}</Page>;
 else if(['facilities','gallery'].includes(page))body=<><Page title={content.preview?'Illustrative care gallery.':`A look inside ${name}.`}><p>{content.photos.length?'Explore photographs published by the hospital.':'Hospital photographs are not published here yet.'}</p></Page>{gallery}<Page title="Plan your visit."><p>{profile.address||city||'Contact reception for directions.'}</p><a href="/visit">Visitor information ↗</a></Page></>;
 else if(page==='about'||page==='visit'||page==='locations')body=<PatientPage profile={profile} page={page==='about'?'about':'visit'}/>;
 else if(page==='contact'){
  const pack=content.packages.find(p=>p.id===new URLSearchParams(query).get('package'));
  body=<Page title={`Speak with ${name}.`}>{pack&&<p>Your health check enquiry: <strong>{pack.name}</strong>. Ask reception about preparation, inclusions and current availability.</p>}<p>{phone?<a href={phone}>Call reception: {profile.phone}</a>:'A public reception number has not been published yet.'}</p><p>{profile.address||city}</p><a href="/book">View online appointment availability ↗</a></Page>;
 }
 else if(page==='insurance')body=<PatientPage profile={profile} page="insurance"/>;
 else if(['faq','articles','testimonials'].includes(page))body=<CommunityHome profile={profile} roster={doctors} loading={catalogLoading} error={catalogError} onRetry={()=>setRetry(n=>n+1)} onBook={book} onNavigate={navigate} only={page}/>;
 else if(page==='privacy')body=<Page title="Your information"><p>Patient details are sent to {name} only when you confirm a booking. A pending request and receipt are retained in this browser tab for safe recovery. No patient account, payment or message delivery is implied by selecting a time.</p><a href="/contact">Contact the hospital ↗</a></Page>;
 else body=<Page title="This page could not be found."><a href="/">Return to {name} ↗</a></Page>;
 return <div className="community-site"><a className="focused-skip" href="#main-content">Skip to content</a><CommunityHeader profile={profile} path={path}/><main id="main-content" className={page?'inner-page sri-module':''}>{body}</main><CommunityFooter profile={profile}/></div>;
}
