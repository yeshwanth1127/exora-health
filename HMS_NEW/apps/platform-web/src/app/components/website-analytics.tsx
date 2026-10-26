"use client";
import {useEffect,useState,useRef} from 'react';
import {usePathname} from 'next/navigation';
import {ANALYTICS_CONSENT_KEY,analyticsPath,analyticsHost,referrerType,sanitisePosthogEvent} from '../../lib/analytics-policy';
import {setAnalyticsSender,trackWebsite} from '../../lib/website-analytics';
import {SITE_ORIGIN} from '../../lib/site';
import type {PostHog} from 'posthog-js';
import './website-analytics.css';
const token=process.env.NEXT_PUBLIC_POSTHOG_KEY||'';
const host=analyticsHost(process.env.NEXT_PUBLIC_POSTHOG_HOST||'https://us.i.posthog.com');
const configured=Boolean(token&&host);
export default function WebsiteAnalytics(){
 const pathname=usePathname();const path=analyticsPath(pathname||'/');
 const [consent,setConsent]=useState<'accepted'|'declined'|null>(null),[loaded,setLoaded]=useState(false),[open,setOpen]=useState(false),[client,setClient]=useState<PostHog|null>(null);
 const lastPage=useRef('');const sdk=useRef<PostHog|null>(null);const trackable=Boolean(path);
 useEffect(()=>{
  const privacy=(navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl===true||navigator.doNotTrack==='1';
  let saved:null|string=null;try{saved=localStorage.getItem(ANALYTICS_CONSENT_KEY);}catch{}
  setConsent(privacy?'declined':saved==='accepted'?'accepted':saved==='declined'?'declined':null);setLoaded(true);
  const preferences=()=>setOpen(true);window.addEventListener('website:analytics-preferences',preferences);
  const sync=(event:StorageEvent)=>{if(event.key!==ANALYTICS_CONSENT_KEY)return;const next=event.newValue==='accepted'&&!privacy?'accepted':'declined';if(next==='declined'){setAnalyticsSender(undefined);sdk.current?.opt_out_capturing();sdk.current?.reset();setClient(null);lastPage.current='';}setConsent(next);};
  window.addEventListener('storage',sync);
  return()=>{window.removeEventListener('website:analytics-preferences',preferences);window.removeEventListener('storage',sync);};
 },[]);
 useEffect(()=>{
  if(!configured||consent!=='accepted'||!trackable){setAnalyticsSender(undefined);return;}
  let cancelled=false;
  void import('posthog-js').then(({default:posthog})=>{
   if(cancelled)return;
   posthog.init(token,{
    api_host:host,autocapture:false,capture_pageview:false,capture_pageleave:false,disable_session_recording:true,disable_surveys:true,
    person_profiles:'never',persistence:'localStorage',cross_subdomain_cookie:false,ip:false,respect_dnt:true,
    advanced_disable_feature_flags:true,disable_external_dependency_loading:true,capture_exceptions:false,capture_performance:false,rageclick:false,
    save_referrer:false,save_campaign_params:false,
    before_send:event=>sanitisePosthogEvent(event,SITE_ORIGIN),
   });
   posthog.opt_in_capturing({captureEventName:false});
   sdk.current=posthog;setClient(posthog);setAnalyticsSender((event,properties)=>posthog.capture(event,properties));window.dispatchEvent(new Event("website:analytics-ready"));
  }).catch(()=>{});
  return()=>{cancelled=true;setAnalyticsSender(undefined);};
 },[consent,trackable]);
 useEffect(()=>{
  if(!client||consent!=='accepted'||!path||lastPage.current===path)return;
  lastPage.current=path;trackWebsite('$pageview',{path,referrer_type:referrerType(document.referrer)});
 },[client,path,consent]);
 useEffect(()=>{
  if(!client||consent!=='accepted'||!path)return;
  const click=(event:MouseEvent)=>{
   const anchor=(event.target as Element)?.closest?.('a[href]');if(!anchor)return;
   const href=anchor.getAttribute('href')||'';let url:URL;try{url=new URL(href,location.origin);}catch{return;}
   if(url.origin!==location.origin)return;
   const target=analyticsPath(url.pathname);if(target&&target!==path)trackWebsite('website_cta_clicked',{path,target_path:target});
  };
  document.addEventListener('click',click);return()=>document.removeEventListener('click',click);
 },[client,path,consent]);
 function choose(value:'accepted'|'declined'){
  if(value==='accepted'&&((navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl||navigator.doNotTrack==='1')){setConsent('declined');setOpen(false);return;}
  try{localStorage.setItem(ANALYTICS_CONSENT_KEY,value);}catch{}
  if(value==='declined'){setAnalyticsSender(undefined);client?.opt_out_capturing();client?.reset();setClient(null);lastPage.current='';}
  setConsent(value);setOpen(false);
 }
 if(!configured||!loaded||(!open&&consent!==null)||pathname?.startsWith('/demo'))return null;
 return <aside className="website-analytics-choice" aria-label="Optional website analytics"><div><strong>Help us improve the website?</strong><p>Optional analytics measures page visits and setup steps. Form entries and session recordings are excluded. <a href="/privacy">How it works</a></p></div><div><button type="button" onClick={()=>choose('declined')}>No thanks</button><button type="button" onClick={()=>choose('accepted')}>Allow analytics</button></div></aside>;
}
export function AnalyticsPreferences(){if(!configured)return <span>Analytics is off</span>;return <button className="analytics-preferences" type="button" onClick={()=>window.dispatchEvent(new Event('website:analytics-preferences'))}>Analytics preferences</button>;}
