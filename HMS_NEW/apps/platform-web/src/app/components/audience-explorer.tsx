'use client';
import SiteImage from "./site-image";

import {useId,useRef,useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {organisationLinks,specialtyLinks} from '../../lib/site-navigation';
import {audienceIcons} from '../../lib/audience-icons';
import './showcase-pages.css';
const details=[
 {title:'A clearer day for your clinic.',body:'Bring patient enquiries, appointments and follow-ups together, with a shared view for reception and your care team.',steps:['Patient enquiries','Appointments & arrivals','Reminders & replies']},
 {title:'Keep care teams connected.',body:'Coordinate reception, patient handoffs and appointment activity across a larger organisation, with clear ownership of the next step.',steps:['Reception & booking','Team handoffs','Patient engagement']},
 {title:'Before the test. After the enquiry.',body:'Keep service questions, test appointments and patient communication organised around the way your centre works.',steps:['Service enquiries','Test appointments','Visit follow-ups']},
];
export default function AudienceExplorer({compact=false}:{compact?:boolean}) {
 const [active,setActive]=useState(0);const id=useId();const refs=useRef<(HTMLButtonElement|null)[]>([]);
 if(compact)return <section className="audience-discover" aria-label="Explore more healthcare workflows"><header><h2>Find your workflow.</h2><p>Built around the way your team cares for patients.</p></header><nav className="audience-discover-cards" aria-label="Organisations and specialties">{[...organisationLinks,...specialtyLinks].map(link=><a className={`audience-discover-card audience-discover-${link.icon}`} href={link.href} key={link.href}><span className="audience-discover-art"><SiteImage src={audienceIcons[link.icon]} alt="" width="512" height="512" loading="lazy"/></span><span className="audience-discover-copy"><strong>{link.label}</strong><span>{link.description}</span><ArrowRight size={18} aria-hidden="true"/></span></a>)}</nav></section>;
 function move(event:React.KeyboardEvent,index:number){let next=index;if(event.key==='ArrowRight')next=(index+1)%organisationLinks.length;else if(event.key==='ArrowLeft')next=(index-1+organisationLinks.length)%organisationLinks.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=organisationLinks.length-1;else return;event.preventDefault();setActive(next);refs.current[next]?.focus();}
 return <section className="audience-explorer" aria-labelledby={`${id}-heading`}>
  <header><p className="showcase-kicker">Built around your practice</p><h2 id={`${id}-heading`}>Different teams.<br/>One connected day.</h2></header>
  <div className="audience-tabs" role="tablist" aria-label="Choose your organisation">{organisationLinks.map((link,index)=><button type="button" role="tab" key={link.href} id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={active===index} tabIndex={active===index?0:-1} ref={el=>{refs.current[index]=el;}} onClick={()=>setActive(index)} onKeyDown={event=>move(event,index)}>{link.label}</button>)}</div>
  {details.map((detail,index)=><div className="audience-explorer-panel" key={detail.title} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={active!==index} tabIndex={0}><div><h3>{detail.title}</h3><p>{detail.body}</p><a href={organisationLinks[index].href}>Explore {index===2?'labs & diagnostics':index===1?'hospitals':'clinics'} <ArrowRight size={18} aria-hidden="true"/></a></div><ol>{detail.steps.map((step,i)=><li key={step}><span aria-hidden="true">0{i+1}</span>{step}</li>)}</ol></div>)}
  <div className="audience-specialties"><span>For your specialty</span>{specialtyLinks.map(link=><a key={link.href} href={link.href}>{link.label} <ArrowRight size={15} aria-hidden="true"/></a>)}</div>
 </section>;
}
