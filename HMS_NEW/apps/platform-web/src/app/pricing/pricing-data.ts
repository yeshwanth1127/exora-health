import { BRAND_NAME } from "../../lib/brand";
export const plans=[
 {id:'preview',name:'Explore',monthly:0,annual:null,effective:null,description:'Take a guided tour of your clinic workflow.',cta:("Explore " + BRAND_NAME),href:'/demo/overview',setup:'No live patient workspace',features:['Guided product tour','Sample booking and reception workflow','Appointment reporting walkthrough','No real patient data or connected accounts']},
 {id:'booking',name:'Booking',monthly:149,annual:1490,effective:124.17,description:'A clearer clinic day, from the first booking to the next handoff.',cta:'Book a demo',href:'/contact-sales',setup:'Proposed standard setup: $299',features:['Booking, rescheduling and cancellations','Doctor availability and schedule configuration','Check-in, queue and reception handoffs','Staff-mediated waitlist workflows','Appointment activity and reporting','Up to 10 bookable practitioners per location']},
 {id:'growth',name:'Growth',monthly:399,annual:3990,effective:332.50,description:'Booking plus qualified patient outreach and local visibility.',cta:'Book a demo',href:'/contact-sales',setup:'Proposed standard setup: $799',features:['Everything in Booking','Shared WhatsApp inbox and approved templates','Qualified reminders and outreach campaigns','Supported Google Business workflows','Website and channel activity reporting','Provider activation and live acceptance required']},
 {id:'connected',name:'Connected',monthly:null,annual:null,effective:null,description:'Growth with a separately scoped, customer-approved EHR connection.',cta:'Discuss your integration',href:'/contact-sales',setup:'Implementation and maintenance quoted separately',features:['Accepted Growth features','EHR feasibility and host/API review','Customer-approved connector scope','Booking and attendance sync only if contracted','Scoped operational support and rollout','No standard Epic connection included']}
] as const;
export type Values=readonly [string,string,string,string];
export const comparison: {title:string;rows:{label:string;values:Values}[]}[]=[
 {title:'Booking & reception',rows:[
  {label:'Booking, cancellation & rescheduling',values:['Product tour','Pilot scope','Booking scope','Growth scope']},
  {label:'Doctor availability & schedule setup',values:['Product tour','Pilot scope','Booking scope','Growth scope']},
  {label:'Check-in, queue & front-desk handoffs',values:['Product tour','Pilot scope','Booking scope','Growth scope']},
  {label:'Staff-mediated waitlist',values:['Product tour','Pilot scope','Booking scope','Growth scope']},
  {label:'Staff call records & follow-ups',values:['Product tour','Staff workflow','Staff workflow','Staff workflow']},
  {label:'Automated AI call answering & booking',values:['Not included','Qualified voice add-on','Qualified voice add-on','Qualified voice add-on']}
 ]},
 {title:'Outreach & conversations',rows:[
  {label:'Shared WhatsApp inbox & templates',values:['Not connected','Not included','Pilot · requires activation','Growth scope · requires activation']},
  {label:'Visit reminders & appointment notices',values:['Product tour','Not included','Pilot · provider approval','Growth scope · provider approval']},
  {label:'Targeted, approved outreach campaigns',values:['Product tour','Not included','Pilot · consent required','Growth scope · consent required']},
  {label:'Post-visit follow-up & re-engagement',values:['Product tour','Not included','Staged pilot','Separately agreed scope']}
 ]},
 {title:'Google Business',rows:[
  {label:'Profile, hours & contact information',values:['Not connected','Not included','Supported fields · owner consent','Growth scope · owner consent']},
  {label:'Reviews, replies & supported text updates',values:['Not connected','Not included','Pilot · requires activation','Growth scope · requires activation']},
  {label:'Local discovery insights',values:['Sample data','Not included','Authorized listing required','Growth scope · authorized listing']},
  {label:'Google photo upload & management',values:['Not included','Not included','Not supported','Not supported']}
 ]},
 {title:'Analytics & outcomes',rows:[
  {label:'Appointment trends & practice overview',values:['Sample data','Pilot scope','Booking scope','Growth scope']},
  {label:'Outreach & channel activity',values:['Sample data','Not included','Pilot · connected channels','Growth scope · connected channels']},
  {label:'Website enquiry-to-booking attribution',values:['Sample data','Not included','Supported website scope','Separately agreed scope']},
  {label:'Cross-channel / EHR attendance attribution',values:['Not included','Not included','Not established','Requires separate qualification']}
 ]},
 {title:'Team & controls',rows:[
  {label:'Bookable practitioners per location',values:['Fictional examples','Up to 10 proposed','Up to 10 proposed','Scoped quote']},
  {label:'Named staff access',values:['Product tour','Reasonable staff access','Reasonable staff access','Scoped team requirements']},
  {label:'Access protection, auditability & data agreements',values:['Example data only','Required in every paid pilot','Required in every paid pilot','Required in every paid pilot']}
 ]},
 {title:'Connections',rows:[
  {label:'Voice reception platform',values:['Not included','$149/month + usage · qualified pilot','$149/month + usage · qualified pilot','Separately qualified']},
  {label:'Existing EHR connection',values:['Not connected','Not included','Not included','Customer-approved scope']},
  {label:'Epic availability, booking writes & attendance sync',values:['Not included','Not included','Not included','Feasibility + contracted scope']}
 ]},
 {title:'Usage & support',rows:[
  {label:'Standard configuration setup',values:['No live setup','$299 proposed','$799 proposed','Custom quote']},
  {label:'Communication usage',values:['No live usage','Additional · tariff pending','Additional · tariff pending','Additional · agreed scope']},
  {label:'Support proposal',values:['Guided tour','Business-hours email/chat','Priority triage','Contracted targets; no default SLA']},
  {label:'Advertising, custom migration & bespoke work',values:['Not included','Separately scoped','Separately scoped','Separately scoped']}
 ]}
];
export const pricingFaqs=[
 {q:'What counts as a clinic location?',a:'The proposal treats one bookable physical practice site as one location. Virtual-only practices and shared reception across sites need an agreed definition before contracting. Prices are not per patient or per receptionist seat.'},
 {q:'How many practitioners and staff are included?',a:'The proposed Booking and Growth packages include up to ten bookable practitioners per location and reasonable named staff access. Larger groups receive a scoped quote. Staff responsibilities and access should be agreed during setup.'},
 {q:'Are these prices final, and can I buy a plan online?',a:'These are proposed pilot prices in USD, not final commercial terms. The demo links start a discussion; there is no checkout or automatic subscription. Scope, eligibility, fees and terms must be confirmed before a paid pilot.'},
 {q:'Which communication channels and regions are supported?',a:'Qualify each clinic, region and channel separately. WhatsApp source support does not establish US SMS or telephone availability. Voice, numbers, templates and customer onboarding must pass the applicable provider and live-runtime checks before use.'},
 {q:'What does communication usage cost?',a:'Communication usage is additional to the subscription. The tariff is not final. Review provider charges, destinations and call minutes with the team before agreeing a pilot budget. There is no unlimited AI, SMS, voice or messaging allowance promised here.'},
 {q:'What is included in the proposed setup fee?',a:'Standard setup is proposed at $299 for Booking or $799 for Growth: one site, clinic catalogue and schedule configuration, one staff training session and supported account connections. Website creation, custom migration, new integrations and bespoke content are separately scoped.'},
 {q:'Can we keep our existing EHR?',a:'Yes—the offer is designed around reception, booking, follow-up and visibility. Your existing EHR can remain the clinical system of record. Connecting it is not included in Booking or Growth and requires a separate agreed design in Connected.'},
 {q:'Does Connected include an existing Epic integration?',a:'No. Epic is a future, separately qualified connector with no public starting price. A customer and host sponsor, API access and a contracted implementation scope are needed. Chart reads alone do not establish availability, booking writes, cancellations or attendance synchronization.'},
 {q:'Who authorises access to our Google Business Profile?',a:'The clinic owner or an authorised manager must grant access and select the correct listing. Google API provisioning and supported field readback must also be qualified. Photo upload and broad directory synchronization are not offered as delivered features.'},
 {q:'How are data protection and access handled?',a:'Appropriate access protection, auditability and applicable data agreements are required in every relevant paid plan. The actual deployment and data handling must be reviewed before real patient use. This page does not claim compliance certification or a blanket retention guarantee.'},
 {q:'How do cancellation and data export work?',a:'Cancellation notice, refunds, export format, access after termination and deletion timelines must be agreed in the customer contract. No binding cancellation or retention policy is established by this pricing draft. Discuss these requirements before starting a paid pilot.'},
 {q:'How does the annual proposal work?',a:'Annual pricing illustrates two months free: $1,490 for Booking or $3,990 for Growth, paid in advance. That is approximately 16.7% less than twelve monthly payments. The displayed monthly equivalent is rounded. Annual billing is proposed only after live onboarding is repeatable; launch pilots use monthly terms.'},
 {q:'Are advertising and guaranteed results included?',a:'No. Advertising spend, website creation, bespoke campaign management and profile content services are separately scoped. There is no guarantee of rankings, leads, attended visits or revenue. A delivered message or a booking does not establish incremental attendance.'},
 {q:'What happens when a patient needs a person?',a:'Reception workflows must keep staff handoffs visible. Questions outside approved clinic information or booking scope should be escalated to the care team. Live warm transfer and closed-loop handover require separate acceptance; AI reception is not a promise of clinical advice.'},
 {q:'What do Pilot, activation and separately scoped mean?',a:'Pilot means the workflow must pass the agreed release checks before live use. Requires activation means provider access, consent or account setup is still needed. Separately scoped means the implementation, cost and acceptance criteria need their own agreement. Tier placement does not prove availability.'}
];
