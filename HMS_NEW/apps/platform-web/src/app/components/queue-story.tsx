"use client";
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Check, ChevronDown, Circle, Clock3, Ellipsis, LayoutGrid, ListFilter, Megaphone, Plus, Users } from 'lucide-react';
import './queue-story.css';
const people='/assets/dashboard-people/';
const patients=[
 {name:'Ananya Sharma',photo:'sofia-ramirez',doctor:'Dr Asha Rao',token:'024',time:'10:30 am'},
 {name:'Rohan Mehta',photo:'marcus-johnson',doctor:'Dr Vikram Iyer',token:'025',time:'10:45 am'},
 {name:'Kavya Rao',photo:'jasmine-brooks',doctor:'Dr Meera Shah',token:'023',time:'10:15 am'},
 {name:'Arjun Kumar',photo:'emma-collins',doctor:'Dr Asha Rao',token:'022',time:'10:00 am'},
];
function PatientCard({index,active=false}:{index:number;active?:boolean}){const reduce=useReducedMotion();const p=patients[index];return <motion.div layout className={`queue-patient ${active?'queue-patient-active':''}`} transition={{duration:reduce?0:.45}}><div className="queue-token"><span>Token {p.token}</span><Ellipsis size={13}/></div><div className="queue-person"><img src={people+p.photo+'.jpg'} alt=""/><strong>{p.name}</strong></div><p>{p.doctor}</p><div className="queue-card-bottom"><span><Clock3 size={10}/>{p.time}</span><span>{active?'Called':'In-person'}</span></div></motion.div>;}
export default function QueueStory(){
 const ref=useRef<HTMLDivElement>(null),visible=useInView(ref,{amount:.35}),reduce=useReducedMotion();const [called,setCalled]=useState(false);const [active,setActive]=useState(true);
 useEffect(()=>{const update=()=>setActive(!document.hidden);update();document.addEventListener("visibilitychange",update);return()=>document.removeEventListener("visibilitychange",update);},[]);
 useEffect(()=>{if(!visible||reduce||!active){setCalled(true);return;}setCalled(false);const timer=setInterval(()=>setCalled(v=>!v),3800);return()=>clearInterval(timer);},[visible,reduce,active]);
 return <div ref={ref} className="queue-story" id="feature-story-queue" role="img" aria-label="Patient queue. A front-desk team calls the next patient, moving their card from Waiting to Called while tracking patients with their doctor.">
  <div className="queue-board-sheet">
   <div className="queue-board-heading"><span className="queue-board-symbol"><LayoutGrid size={19}/></span><h3>Patient queue</h3><span className="queue-today">Today<ChevronDown size={11}/></span></div>
   <div className="queue-board-toolbar"><span><Users size={12}/>All doctors<ChevronDown size={10}/></span><span><ListFilter size={11}/>Filter</span><span className="queue-total">4 patients</span></div>
   <div className="queue-board-columns">
    <div className="queue-column queue-column-waiting"><div className="queue-column-title"><span><i/>Waiting</span><small>{called?1:2}</small><Plus size={11}/></div><AnimatePresence initial={false}>{!called&&<motion.div key="waiting-ananya" initial={reduce?false:{opacity:0,y:5}} animate={{opacity:1,y:0}} exit={{opacity:0,height:0,marginBottom:0}} transition={{duration:reduce?0:.35}}><PatientCard index={0}/></motion.div>}</AnimatePresence><PatientCard index={1}/></div>
    <div className="queue-column queue-column-called"><div className="queue-column-title"><span><i/>Called</span><small>{called?1:0}</small><Plus size={11}/></div><AnimatePresence initial={false}>{called?<motion.div key="called-ananya" initial={reduce?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:reduce?0:.45}}><PatientCard index={0} active/></motion.div>:<motion.div key="empty" className="queue-next-placeholder" initial={false} exit={{opacity:0}}><Megaphone size={19}/><span>Ready for the<br/>next patient</span></motion.div>}</AnimatePresence></div>
    <div className="queue-column queue-column-doctor"><div className="queue-column-title"><span><i/>With doctor</span><small>2</small><Plus size={11}/></div><PatientCard index={2}/><PatientCard index={3}/></div>
   </div>
  </div>
  <div className="queue-handoff-sheet">
   <div className="queue-handoff-banner"><span><Megaphone size={22}/></span><small>ONE CONNECTED FRONT DESK</small></div>
   <div className="queue-handoff-body"><span className="queue-panel-eyebrow">The next step, made clear.</span><h3>Less chasing.<br/>More caring.</h3><div className="queue-current-patient"><img src={people+'sofia-ramirez.jpg'} alt=""/><div><strong>Ananya Sharma</strong><span>Token 024 · Dr Asha Rao</span></div></div><div className={`queue-next-action ${called?'is-called':''}`}><Megaphone size={14}/><span>{called?'Patient called':'Call next patient'}</span>{called?<Check size={15}/>:<ArrowUpRight size={15}/>}</div><div className="queue-activity"><div><span className="queue-activity-dot"><Check size={10}/></span><p>Checked in at reception<small>10:24 am</small></p></div><div><span className={`queue-activity-dot ${called?'':'is-pending'}`}>{called?<Check size={10}/>:<Circle size={8}/>}</span><p>{called?'Called by the front desk':'Waiting for the front desk'}<small>{called?'Ready to see Dr Asha Rao':'Next in the queue'}</small></p></div></div></div>
  </div>

 </div>;
}
