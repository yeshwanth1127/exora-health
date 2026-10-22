"use client";
import { BRAND_NAME } from "../../lib/brand";
import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion, motion } from 'motion/react';
import { Phone, Headphones, ArrowUpRight, Check, CalendarDays, MessageCircle, Send, Users, Sparkles } from 'lucide-react';
import './feature-story.css';
const photos='/assets/dashboard-people/';

export default function FeatureStory({kind}:{kind:'reception'|'outreach'}) {
 const ref=useRef<HTMLDivElement>(null); const visible=useInView(ref,{amount:.4});const reduce=useReducedMotion();const [complete,setComplete]=useState(false);
 useEffect(()=>{if(!visible||reduce){setComplete(true);return;}setComplete(false);const tick=setInterval(()=>setComplete(value=>!value),4200);return()=>clearInterval(tick);},[visible,reduce]);
 return <div ref={ref} id={`feature-story-${kind}`} className={`feature-story feature-story-${kind}`} role="img" aria-label={kind==='reception'?'AI reception workflow: a patient calls, clinic-approved information is shared, and an appointment request is prepared.':'Outreach workflow: a clinic sends a follow-up campaign, receives replies and tracks booking requests.'}>
  {kind==='reception'?<>
   <motion.div className="story-reception-sheet" initial={{y:18,opacity:0}} whileInView={{y:0,opacity:1}} viewport={{once:true}} transition={{duration:reduce?0:.5}}>
    <div className="story-app-heading"><span className="story-app-icon"><Headphones size={17}/></span><strong>Reception</strong><span className="story-tiny-tag">Your clinic’s voice</span></div>
    <div className="story-call-hero"><div className="story-call-avatar"><img src={photos+'sofia-ramirez.jpg'} alt=""/><span><Phone size={11}/></span></div><div><small>Incoming patient call</small><h3>Ananya Sharma</h3><p><span className="story-live-dot"/>{complete?'Enquiry captured':(BRAND_NAME + " is listening")}<span className="story-call-time">01:24</span></p></div></div>
    <div className={`story-wave ${complete?'is-done':''}`} aria-hidden="true">{Array.from({length:39},(_,i)=><i key={i} style={{height:7+((i*17)%29),animationDelay:`${i*.055}s`}}/>)}</div>
    <div className="story-transcript"><div><span>Patient</span><p>“Can I see a doctor tomorrow morning?”</p></div><div><span><Sparkles size={10}/>{BRAND_NAME}</span><p>“Of course. Let’s find a time that works for you.”</p></div></div>
   </motion.div>
   <div className={`story-booking-slip ${complete?'is-complete':''}`}><span className="story-slip-icon"><CalendarDays size={20}/></span><div><small>{complete?'Ready for your front desk':'Finding the next step'}</small><strong>Tomorrow, 10:30 am</strong><p>Dr Asha Rao · In-person visit</p></div><span className="story-slip-check"><Check size={17}/></span></div>

  </>:<>
   <motion.div className="story-outreach-sheet" initial={{y:18,opacity:0}} whileInView={{y:0,opacity:1}} viewport={{once:true}} transition={{duration:reduce?0:.5,delay:reduce?0:.08}}>
    <div className="story-app-heading"><span className="story-app-icon"><MessageCircle size={17}/></span><strong>Patient outreach</strong><span className="story-campaign-state"><span/>{complete?'Replies arriving':'Campaign ready'}</span></div>
    <div className="story-outreach-title"><small>Stay in touch. Bring patients back.</small><h3>A little follow-up.<br/>A lasting connection.</h3></div>
    <div className="story-audience"><div className="story-avatar-stack">{['jasmine-brooks','marcus-johnson','ava-mitchell'].map(name=><img key={name} src={photos+name+'.jpg'} alt=""/>)}</div><div><strong>Due for a follow-up</strong><span>36 patients in your audience</span></div><Users size={15}/></div>
    <div className="story-message"><span>Follow-up message</span><p>Hi Ananya, it’s time for your follow-up.<br/>Would you like us to help you find a visit time?</p><div><span>Personalised for each patient</span><span><Send size={12}/> WhatsApp</span></div></div>
   </motion.div>
   <div className={`story-outreach-results ${complete?'is-complete':''}`}><div><span className="story-result-heading"><MessageCircle size={13}/>Conversations started</span><strong>12<small>patient replies</small></strong></div><span className="story-results-divider"/><div><span className="story-result-heading"><CalendarDays size={13}/>The next visit</span><strong>6<small>booking requests</small></strong></div><span className="story-result-arrow"><ArrowUpRight size={18}/></span></div>

  </>}
 </div>;
}
