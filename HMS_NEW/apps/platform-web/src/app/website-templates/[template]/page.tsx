import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import './template.css';

export function generateStaticParams(){return [{template:'standard'},{template:'sri-lakshmi'}];}
export const dynamicParams=false;
export const metadata:Metadata={title:'Patient website example',robots:{index:false,follow:false},alternates:{canonical:null},openGraph:{title:'Patient website example',description:'Explore an example patient website layout.'}};

export default async function TemplateExample({params}:{params:Promise<{template:string}>}){
 const {template}=await params;
 if(!['standard','sri-lakshmi'].includes(template))notFound();
 const hospital=template==='sri-lakshmi';
 const name=hospital?'Your Hospital':'Your Clinic';
 const services=hospital?['Primary care','Women’s health','Orthopaedics','Diagnostics']:['General consultations','Preventive care','Follow-up visits'];
 return <div className={`patient-example ${hospital?'is-hospital':''}`}>
  <aside className="example-notice">Website layout example · Booking and contact services are not connected.<a href="/onboarding">Return to setup ↗</a></aside>
  <header className="example-nav"><a className="example-brand" href="#home"><span aria-hidden="true">+</span>{name}</a><nav aria-label="Example website"><a href="#services">{hospital?'Departments':'Care & services'}</a><a href="#team">Our approach</a><a href="#visit">Plan your visit</a></nav></header>
  <main id="home"><section className="example-hero"><div><p className="example-eyebrow">{hospital?'Care for your whole family':'A place to feel cared for'}</p><h1>{hospital?'Good care.\nCloser to home.':'Your health,\nin good hands.'}</h1><p>Find the care you need, get to know your team and plan your next visit. All in one place.</p><a className="example-primary" href="#visit">Plan your visit <span aria-hidden="true">↗</span></a><a className="example-text-link" href="#services">Explore our services ↓</a></div><div className="example-hero-art"><img src={`/assets/capture-onboarding/doctor-${hospital?'welcome':'ready'}.webp`} alt="Illustration of a doctor welcoming patients" width="480" height="480"/><span>Here for every next step.</span></div></section>
  <section id="services" className="example-services"><p className="example-eyebrow">{hospital?'Our departments':'How we can help'}</p><h2>Care that fits your life.</h2><div>{services.map((service,index)=><article key={service}><span className="example-service-number">0{index+1}</span><h3>{service}</h3><p>Explore the care available at your {hospital?'hospital':'clinic'} and find the right next step for you.</p><a href="#visit">Plan a visit ↗</a></article>)}</div></section>
  <section id="team" className="example-team"><p className="example-eyebrow">People, first</p><h2>A team that takes time<br/>to understand you.</h2><p>Your website can introduce your clinicians, specialties and approach to care. Add your own team information during website setup.</p></section>
  <section id="visit" className="example-visit"><div><p className="example-eyebrow">Before you arrive</p><h2>Let’s plan your next visit.</h2><p>Your facility address, opening hours and appointment options will appear here once configured.</p></div><div className="example-booking"><h3>Appointments</h3><p>This is a layout preview. Appointment availability and booking will be connected to your own facility after setup.</p><button disabled>Booking unavailable in this preview</button></div></section></main>
  <footer><strong>{name}</strong><p>Patient website layout example</p><a href="/onboarding">Return to setup ↗</a></footer>
 </div>;
}
