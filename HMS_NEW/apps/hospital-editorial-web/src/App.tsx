import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Navbar from './cloned/welbeck/sections/navbar2';
import Hero from './cloned/welbeck/sections/hero-section';
import Services from './cloned/welbeck/sections/services-section';
import HospitalStory from './cloned/welbeck/sections/welbeck-way-welbeck-section';
import { DoctorsGridSection } from './components/sections/DoctorsGridSection';
import { HospitalGallerySection } from './components/sections/HospitalGallerySection';
import { LightPricingRailSection } from './components/variants/LightPricingRailSection';
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
  if(to===location.pathname+location.search)return;
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
 const departments=[...new Set(doctors.flatMap(doctor=>doctor.departments.length?doctor.departments:doctor.specialty?[doctor.specialty]:[]))];
 const directory=<HmsDoctorDirectory key={query} roster={doctors} clinicName={name} loading={catalogLoading} error={catalogError} initialQuery={new URLSearchParams(query).get('q')||''} onRetry={()=>setRetry(n=>n+1)} onBackToHome={home} onSelectDoctor={id=>navigate('/doctors/'+id)} onBookDoctor={book} onExploreDepartments={()=>navigate('/departments')}/>;
 const gallery=content.photos.length>0?<HospitalGallerySection name={name} photos={content.photos} onExploreHospital={()=>navigate('/facilities')}/>:null;
 const healthChecks=<div className="editorial-package-grid">{content.packages.map(item=><article key={item.id}><p>Health check</p><h2>{item.name}</h2><strong>{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(item.priceMinor/100)}</strong><p>{item.description}</p><ul>{item.inclusions.map(inclusion=><li key={inclusion}>{inclusion}</li>)}</ul><a href={'/contact?package='+encodeURIComponent(item.id)}>Ask about this package ↗</a></article>)}</div>;
 let body:ReactNode;
 if(!page)body=<>
  <div className="welbeck-shell" data-component-source="ditto-welbeck"><Hero name={name} city={city} image={content.heroImage||stock} headline={content.headline} introduction={content.introduction} cards={[
   {href:'/doctors',imgSrc:stock,title:'Find your specialist',label2:'Get to know the care team and choose your consultation.',label3:'Meet our doctors'},
   {href:'/departments',imgSrc:'/images/pediatrics-specialty.jpg',title:'Explore your care',label2:'Browse the specialties published by your hospital.',label3:'Our specialties'},
   {href:'/visit',imgSrc:content.storyImage||stock,title:'Plan your visit',label2:'Find hospital details and prepare for your appointment.',label3:'Before you visit'},
  ]}/><Services name={name} cards={[
   {imgSrc:stock,title:'Specialist consultations',href:'/doctors'},
   {imgSrc:content.storyImage||stock,title:'Health checks',href:'/packages'},
   {imgSrc:'/images/pediatrics-specialty.jpg',title:'Your hospital',href:'/about'},
  ]}/></div>
  <div className="sri-module" data-component-source="sri-lakshmi/DoctorsGridSection">{doctors.length>0?<DoctorsGridSection key={doctors.map(d=>d.slug).join(',')} roster={doctors} clinicName={name} city={city} onViewAll={()=>navigate('/doctors')} onViewDoctor={id=>navigate('/doctors/'+id)} onBookDoctor={book}/>:<section className="editorial-empty"><h2>Meet your care team.</h2><p>{catalogLoading?'Loading the hospital’s published doctors…':catalogError||'The hospital has not published its online doctor list yet.'}</p>{catalogError&&<button onClick={()=>setRetry(n=>n+1)}>Try again</button>}<a href="/contact">Contact reception ↗</a></section>}</div>
  <div className="welbeck-shell"><HospitalStory name={name} city={city} image={content.storyImage||content.heroImage||stock} story={content.story}/></div>
  <div className="sri-module">{content.packages.length>0&&<LightPricingRailSection packages={content.packages} clinicName={name} onBookPackage={id=>navigate('/contact?package='+encodeURIComponent(id))} onExploreAll={()=>navigate('/packages')}/>}{gallery}</div>
 </>;
 else if(page==='doctors'&&id&&selected)body=<HmsDoctorProfile doctor={selected} clinicName={name} onBackToHome={home} onBackToSearch={()=>navigate('/doctors')} onScheduleAppointment={book}/>;
 else if(page==='doctors'&&id)body=<Page title="Doctor profile unavailable"><p>{catalogLoading?'Loading published profiles…':catalogError||'This doctor is not published for this hospital.'}</p><a href="/doctors">View published doctors ↗</a></Page>;
 else if(page==='doctors')body=directory;
 else if(page==='book')body=api?<HmsBookingPage key={id||'all'} api={api} requestedDoctorId={id} onBack={()=>navigate('/doctors')}/>:<Page title="Online booking is unavailable"><p>{catalogError}</p><a href="/contact">Contact reception ↗</a></Page>;
 else if(page==='departments')body=<Page title="Find the right specialty."><p>Explore the specialties represented by {name}’s published care team.</p><div className="editorial-links">{departments.map(department=><a key={department} href={'/doctors?q='+encodeURIComponent(department)}>{department} ↗</a>)}</div>{!departments.length&&<p>{catalogLoading?'Loading specialties…':'Specialty information is not published yet. Please contact reception.'}</p>}</Page>;
 else if(page==='packages')body=<Page title="Health checks, clearly explained."><p>Explore packages published by {name}. Contact reception to confirm preparation and current availability.</p>{content.packages.length?healthChecks:<p>No health check packages are published here yet. <a href="/contact">Ask reception ↗</a></p>}</Page>;
 else if(['facilities','gallery'].includes(page))body=<><Page title={`A look inside ${name}.`}><p>{content.photos.length?'Explore photographs published by the hospital.':'Hospital photographs are not published here yet.'}</p></Page>{gallery}<Page title="Plan your visit."><p>{profile.address||city||'Contact reception for directions.'}</p><a href="/visit">Visitor information ↗</a></Page></>;
 else if(page==='about')body=<><div className="focused-page-heading"><p>About {name}</p><h1>Care, close to home.</h1></div><div className="welbeck-shell"><HospitalStory name={name} city={city} image={content.storyImage||stock} story={content.story}/></div></>;
 else if(page==='visit'||page==='locations')body=<Page title={`Visit ${name}.`}><p>{profile.address||city||'Contact reception for hospital directions.'}</p>{profile.address&&<a href={'https://maps.google.com/?q='+encodeURIComponent(name+' '+profile.address)} target="_blank" rel="noopener">Get directions ↗</a>}<ol className="editorial-steps"><li>Choose a doctor from the published care team.</li><li>Review current availability and fees before booking.</li><li>Bring previous records and your current medicine list if relevant.</li></ol><a className="editorial-action" href="/book">Arrange your visit ↗</a></Page>;
 else if(page==='contact'){
  const pack=content.packages.find(p=>p.id===new URLSearchParams(query).get('package'));
  body=<Page title={`Speak with ${name}.`}>{pack&&<p>Your health check enquiry: <strong>{pack.name}</strong>. Ask reception about preparation, inclusions and current availability.</p>}<p>{phone?<a href={phone}>Call reception: {profile.phone}</a>:'A public reception number has not been published yet.'}</p><p>{profile.address||city}</p><a href="/book">View online appointment availability ↗</a></Page>;
 }
 else if(page==='insurance')body=<Page title="Insurance & payment"><p>Ask {name} about accepted insurance and payment arrangements before your visit. Online appointment fees are displayed when a published time is selected.</p><a href="/contact">Contact reception ↗</a></Page>;
 else if(page==='privacy')body=<Page title="Your information"><p>Patient details are sent to {name} only when you confirm a booking. A pending request and receipt are retained in this browser tab for safe recovery. No patient account, payment or message delivery is implied by selecting a time.</p><a href="/contact">Contact the hospital ↗</a></Page>;
 else body=<Page title="This page could not be found."><a href="/">Return to {name} ↗</a></Page>;
 return <div className="focused-site"><a className="focused-skip" href="#main-content">Skip to content</a><div className="welbeck-shell focused-header"><Navbar name={name} logoUrl={content.logoUrl} listRowData={[...(phone?[{href:phone,label:profile.phone}]:[]),...(city?[{href:'/visit',label:city}]:[]),{href:'/contact',label:'Contact us'}]}/></div><main id="main-content" className={page?'sri-module':''}>{body}</main><footer className="focused-footer"><div>{content.logoUrl?<img src={content.logoUrl} alt={name}/>:<strong className="editorial-footer-brand">{name}</strong>}<h2>Here for your next step.</h2>{phone&&<a href={phone}>{profile.phone} ↗</a>}</div><div><h3>Find your care</h3><a href="/doctors">Our doctors</a><a href="/departments">Specialties</a><a href="/packages">Health checks</a><a href="/book">Arrange a consultation</a></div><div><h3>Your hospital</h3><a href="/about">About {name}</a><a href="/facilities">Facilities & gallery</a><a href="/visit">Plan your visit</a><a href="/insurance">Insurance & payment</a></div><div><h3>Come and see us</h3><p>{profile.address||city||'Contact reception for directions.'}</p><a href="/contact">Contact us ↗</a></div><div className="focused-footer-bottom"><span>© {new Date().getFullYear()} {name}</span><a href="/privacy">Privacy information</a></div></footer><div className="focused-mobile-contact">{phone?<a href={phone}>Call reception</a>:<a href="/contact">Contact reception</a>}<a href="/book">Arrange a visit ↗</a></div></div>;
}
