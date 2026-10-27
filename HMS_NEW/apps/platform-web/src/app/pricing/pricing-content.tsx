"use client";
import FaqSection from "../components/faq";
import { useState } from 'react';
import { Check, ChevronDown, ArrowRight } from 'lucide-react';
import {useRegion} from '../components/regional/region-provider';
import RegionSwitcher from '../components/regional/region-switcher';
import {countryCurrency} from '../../lib/regional-pricing';
import { comparison, plans, pricingFaqs } from './pricing-data';
import './pricing-polish.css';

export default function PricingContent(){
 const [comparisonOpen,setComparisonOpen]=useState(false),[moreFaqs,setMoreFaqs]=useState(false);
 const {country}=useRegion();
 const countryName=new Intl.DisplayNames(['en'],{type:'region'}).of(country);
 const quote=(id:string)=>id==='preview'?'Guided product tour':'Contact us for a quote';
 return <main className="pricing-page capture-pricing">
  <header className="pricing-hero flex mt-10 flex-col gap-5"><h1>One workspace for your clinic.</h1><p>Booking, patient follow-up and clinic visibility in one workspace.</p></header>
  <div className="pricing-billing"><span>Plans tailored to your practice. Scope and fees confirmed in your quote.</span><small>{countryName} · {countryCurrency(country)}</small><RegionSwitcher expanded/></div>
  <div className="pricing-plan-groups grid gap-6 grid-cols-2 max-lg:grid-cols-1">
   {[plans.slice(0,2),plans.slice(2)].map((group,i)=><section className={`pricing-plan-group grid p-8 rounded-xl gap-8 ${i===1?'pricing-growth-group bg-clr-12':'border-2 border-solid border-border bg-background'}`} key={i} aria-labelledby={`plan-group-${i}`}>
    <header><h2 id={`plan-group-${i}`}>{i===0?'Essentials for a calmer clinic day.':'More ways to connect with patients.'}</h2></header>
    <div className="pricing-plan-columns grid gap-x-8 grid-cols-2 max-lg:grid-cols-1">{group.map(p=><article className="pricing-plan grid gap-2 grid-cols-1" key={p.id} aria-labelledby={`plan-${p.id}`}>
     <h3 id={`plan-${p.id}`}>{p.name}</h3><div className="pricing-price"><strong>{quote(p.id)}</strong></div>
     <p className="pricing-billed">{p.id==='preview'?'Explore the workflow with example data':'Based on your agreed scope'}</p>
     <p className="pricing-plan-description">{p.description}</p><a className={`pricing-cta ${i===1?'pricing-cta-solid':''}`} href={p.href}>{p.cta}</a>
     <p className="pricing-setup">{p.setup}</p><div className="pricing-inclusions"><p>{p.id==='preview'?'Explore the workflow:':p.id==='booking'?'Proposed Booking scope:':p.id==='growth'?'Proposed Growth scope:':'Subject to a scoped agreement:'}</p><ul>{p.features.map(f=><li key={f}><Check size={15} aria-hidden="true"/>{f}</li>)}</ul></div>
    </article>)}</div>
   </section>)}
  </div>
  <aside className="pricing-proposal"><p>Ask for a quote for your practice in {countryName}. Scope, setup, communication usage and any integrations are agreed before a paid pilot.</p></aside>
  <div className="pricing-boundaries"><p>Paid location proposal: up to ten bookable practitioners and reasonable named staff access. Essential access protection, auditability and applicable data agreements are required across relevant paid plans.</p><p>Setup, communication usage, migration, advertising and custom integrations are separately scoped.</p></div>
  <section className="pricing-comparison" data-mobile-expanded={comparisonOpen} aria-labelledby="comparison-title">
   <h2 id="comparison-title">Plans and features</h2><p className="pricing-table-intro">Proposed allocation after release conditions pass. “Pilot” and “requires activation” indicate qualification is still needed.</p><p className="pricing-table-hint">Swipe to compare all four plans →</p>
   <button className="pricing-mobile-compare" type="button" aria-expanded={comparisonOpen} aria-controls="full-plan-comparison" onClick={()=>setComparisonOpen(v=>!v)}>{comparisonOpen?'Hide full comparison':'Show full comparison'} <ChevronDown size={16} aria-hidden="true"/></button>
   <div id="full-plan-comparison" className="pricing-table-scroll" tabIndex={0} role="region" aria-label="Plan feature comparison"><table><colgroup><col className="pricing-label-col"/>{plans.map(p=><col key={p.id}/>)}</colgroup><thead><tr><th scope="col"><span className="pricing-sr">Feature</span></th>{plans.map(p=><th scope="col" key={p.id}><strong>{p.name}</strong><span>{quote(p.id)}</span><a href={p.href}>{p.cta}<ArrowRight size={12} aria-hidden="true"/></a></th>)}</tr></thead>{comparison.map(g=><tbody key={g.title}><tr className="pricing-category"><th colSpan={5} scope="rowgroup">{g.title}</th></tr>{g.rows.map(r=><tr key={r.label}><th scope="row">{r.label}</th>{r.values.map((v,i)=><td key={i}>{v}</td>)}</tr>)}</tbody>)}</table></div>
  </section>
  <FaqSection className="pricing-faq" id="pricing-faq-title" title="Questions & answers." items={moreFaqs?pricingFaqs:pricingFaqs.slice(0,6)}/><button className="pricing-faq-more" type="button" aria-expanded={moreFaqs} onClick={()=>setMoreFaqs(v=>!v)}>{moreFaqs?'Show fewer questions':'More questions'}</button>
 </main>;
}
