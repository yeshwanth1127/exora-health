import type { Metadata } from 'next';
import { BRAND_NAME, BRAND_LOGO } from './brand.ts';
import { SEARCH_ENABLED, SITE_ORIGIN } from './site.ts';
export const publicPages = [
 {path:'/',title:`AI Receptionist & Clinic Management Software | ${BRAND_NAME}`,description:'Answer patient calls, coordinate appointments, follow up on WhatsApp and understand clinic growth in one connected healthcare workspace.'},
 {path:'/product/features',title:`Healthcare Reception & Patient Engagement Features | ${BRAND_NAME}`,description:'Explore AI reception and call handling, WhatsApp outreach, Google Business management and clinic analytics for healthcare providers.'},
 {path:'/pricing',title:`Clinic Software Plans & Pricing | ${BRAND_NAME}`,description:'Explore location-based plans for clinic reception, appointments, patient outreach and local visibility. Find the right starting point for your practice.'},
 {path:'/teams',title:`Software for Independent & Multi-doctor Clinics | ${BRAND_NAME}`,description:'Bring clinic calls, appointment requests, patient queues and follow-ups into one shared workspace for your front desk and care team.'},
 {path:'/enterprise',title:`Connected Hospital & Healthcare Group Software | ${BRAND_NAME}`,description:'Coordinate reception, appointments, patient engagement and clinic activity across larger healthcare teams and multiple facilities.'},
 {path:'/contact-sales',title:`Request a Healthcare Software Demo | ${BRAND_NAME}`,description:'Discuss AI reception, appointments and patient communication workflows for your clinic or hospital with the team.'},
 {path:'/blog',title:`Clinic Reception & Patient Engagement Guides | ${BRAND_NAME}`,description:'Practical guides to patient enquiries, clinic queues and useful follow-ups for healthcare providers and front-desk teams.'},
 {path:'/help',title:`Help with Clinic Software & Getting Started | ${BRAND_NAME}`,description:'Answers about setup, AI reception, bookings, patient outreach and your healthcare workspace.'},
 {path:'/releases',title:`Product Updates & Release Notes | ${BRAND_NAME}`,description:`See what is new in ${BRAND_NAME}: reception, appointments, communication and clinic workflow updates.`},
 {path:'/solutions/ai-receptionist',title:`AI Receptionist for Clinics & Hospitals | ${BRAND_NAME}`,description:'Handle routine patient calls and appointment requests with AI reception. Keep staff handoffs visible and clinical decisions with your care team.'},
 {path:'/solutions/whatsapp-outreach',title:`WhatsApp Patient Outreach for Clinics | ${BRAND_NAME}`,description:'Organise patient reminders, follow-ups and booking conversations through a connected WhatsApp workflow for your clinic team.'},
 {path:'/solutions/google-business-management',title:`Google Business Profile Management for Clinics | ${BRAND_NAME}`,description:'Manage your clinic’s Google Business information, local discovery and patient enquiries alongside appointment and reception workflows.'},
 {path:'/solutions/clinic-analytics',title:`Clinic Booking & Patient Enquiry Analytics | ${BRAND_NAME}`,description:'Understand enquiries, bookings, cancellations and appointment sources with clinic analytics that keep workflow states and measurement limits clear.'},
 {path:'/resources/clinic-front-desk-checklist',title:`Clinic Front-Desk Workflow Checklist | ${BRAND_NAME}`,description:'A practical checklist for patient calls, booking requests, arrivals, queue handoffs and follow-ups. Read online or download the editable checklist.'},
 {path:'/labs-diagnostics',title:`Lab & Diagnostic Centre Reception Software | ${BRAND_NAME}`,description:'Connect service enquiries, test appointments, patient arrivals and administrative follow-ups for laboratories and diagnostic centres.'},
 {path:'/specialties/dental',title:`Dental Practice Reception & Appointment Workflows | ${BRAND_NAME}`,description:'Coordinate dental enquiries, consultation and treatment appointments, patient reminders and recall conversations in one reception workflow.'},
 {path:'/specialties/physiotherapy',title:`Physiotherapy Appointment & Patient Follow-up Workflows | ${BRAND_NAME}`,description:'Keep initial assessment bookings, ongoing sessions, attendance and administrative follow-ups connected for your physiotherapy practice.'},
 {path:'/solutions/teleconsultations',title:`Teleconsultation Appointment Workflows for Healthcare Teams | ${BRAND_NAME}`,description:'Connect remote appointment coordination, joining information and administrative follow-ups to your configured teleconsultation service.'},
 {path:'/privacy',title:`Website Analytics & Privacy | ${BRAND_NAME}`,description:'How optional website analytics works, which information is excluded and how to change your analytics preference.'},
] as const;
export const privateRobots = {index:false,follow:true};
export function pageMetadata(path:string,title?:string,description?:string): Metadata {
 const page=publicPages.find(p=>p.path===path);
 const pageTitle=title||page?.title||`${BRAND_NAME} · Care, connected`;
 const summary=description||page?.description||'Reception, appointments and patient communication for healthcare providers.';
 const url=SITE_ORIGIN ? SITE_ORIGIN+path : undefined;
 return {title:pageTitle,description:summary,alternates:url?{canonical:url}:undefined,
  robots:{index:SEARCH_ENABLED,follow:true,'max-image-preview':'large','max-snippet':-1,'max-video-preview':-1},
  openGraph:{type:'website',title:pageTitle,description:summary,url,siteName:BRAND_NAME,locale:'en_IN',images:SITE_ORIGIN?[{url:SITE_ORIGIN+'/social-card.png',width:1200,height:630,alt:`${BRAND_NAME} — A clearer clinic day`}]:undefined},
  twitter:{card:'summary_large_image',title:pageTitle,description:summary,images:SITE_ORIGIN?[SITE_ORIGIN+'/social-card.png']:undefined}};
}
export function jsonLd(value:unknown) { return JSON.stringify(value).replace(/</g,'\\u003c'); }
export function organisationGraph() {
 if(!SITE_ORIGIN)return null;
 return {'@context':'https://schema.org','@graph':[
  {'@type':'Organization','@id':SITE_ORIGIN+'/#organisation',name:BRAND_NAME,url:SITE_ORIGIN,logo:{'@type':'ImageObject',url:SITE_ORIGIN+BRAND_LOGO},description:'Healthcare software for reception, appointments, patient communication and clinic activity.'},
  {'@type':'WebSite','@id':SITE_ORIGIN+'/#website',name:BRAND_NAME,url:SITE_ORIGIN,publisher:{'@id':SITE_ORIGIN+'/#organisation'},inLanguage:'en-IN'}]};
}
export function breadcrumbs(items:{name:string;path:string}[]) { return {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items.map((item,index)=>({'@type':'ListItem',position:index+1,name:item.name,item:SITE_ORIGIN+item.path}))}; }
