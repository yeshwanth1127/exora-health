"use client";
import { responsiveImage } from "../../../lib/responsive-image";
import SiteImage from "../../components/site-image";

import { BRAND_NAME } from "../../../lib/brand";
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Pause, Play } from 'lucide-react';
import ScheduleShowcase from '../../components/hero-dashboard/schedule-showcase';
import { LayoutDashboard, CalendarDays, Clock3, Users, Stethoscope, Video, MessageCircle, Headphones, ChartNoAxesCombined, Building2, UserRound, Settings2, HeartPulse, Search, Bell, MapPin } from 'lucide-react';
import { ArcSidebarLayout } from '../../components/hero-dashboard/arc/sidebar/sidebar';
import { KpiDrilldown } from '../../components/hero-dashboard/arc/kpi-drilldown/kpi-drilldown';
import { demoKpis, appointments } from '../../components/hero-dashboard/demo-data';
import '../../components/hero-dashboard/arc/demo-scope.css';
import './preview.css';

const sections = [
 {id:'clinic',heading:'Clinic',items:[{id:'overview',label:'Overview',icon:LayoutDashboard},{id:'appointments',label:'Appointments',icon:CalendarDays,children:[{id:'all',label:'All appointments'},{id:'waitlist',label:'Waitlist'},{id:'queue',label:'Queue'}],defaultOpen:false},{id:'schedules',label:'Schedules',icon:Clock3},{id:'patients',label:'Patients',icon:Users}]},
 {id:'care',heading:'Care',items:[{id:'consultations',label:'Consultations',icon:Stethoscope},{id:'teleconsultations',label:'Teleconsultations',icon:Video}]},
 {id:'messages',heading:'Messages',items:[{id:'whatsapp',label:'WhatsApp',icon:MessageCircle,children:[{id:'inbox',label:'Inbox'},{id:'campaigns',label:'Promotions'}],defaultOpen:false},{id:'voice',label:'Voice',icon:Headphones,children:[{id:'history',label:'Call history'},{id:'setup',label:'Call setup'}],defaultOpen:false}]},
 {id:'growth',heading:'Growth',items:[{id:'google',label:'Google Business',icon:MapPin},{id:'analytics',label:'Website analytics',icon:ChartNoAxesCombined}]},
 {id:'workspace',heading:'Workspace',items:[{id:'catalogue',label:'Hospital catalogue',icon:Building2},{id:'doctors',label:'Doctors',icon:UserRound}]},
];
export default function DemoOverview() {
 const [range,setRange]=useState<'7'|'30'|'90'>('30');
 const [view,setView]=useState<'overview'|'schedules'>('overview');
 const [selected,setSelected]=useState<string|null>(null);
 const [playing,setPlaying]=useState(true);
 const [visible,setVisible]=useState(false);
 const [tap,setTap]=useState(false);
 // Keep server and first client markup identical; apply the browser preference after hydration.
 const motionPreference=useReducedMotion();
 const [reduce,setReduce]=useState(false);
 useEffect(()=>setReduce(Boolean(motionPreference)),[motionPreference]);
 useEffect(()=>{
  if(window.parent===window){setVisible(true);return;}
  const handler=(event:MessageEvent)=>{if(event.source===window.parent&&event.origin===window.location.origin&&event.data?.type==='capture-preview-visible')setVisible(Boolean(event.data.visible));};
  window.addEventListener('message',handler);window.parent.postMessage({type:'capture-preview-ready'},window.location.origin);
  return()=>window.removeEventListener('message',handler);
 },[]);
 useEffect(()=>{
  if(!playing||!visible||reduce)return;
  let timers:ReturnType<typeof setTimeout>[]=[];
  const start=()=>{
   setView('overview');setSelected(null);setTap(false);
   timers.push(setTimeout(()=>setTap(true),800));
   timers.push(setTimeout(()=>{setTap(false);setSelected('bookings');},1100));
   timers.push(setTimeout(()=>setSelected(null),2800));
   timers.push(setTimeout(()=>setView('schedules'),3200));
   timers.push(setTimeout(start,7500));
  };start();
  return()=>{timers.forEach(clearTimeout);};
 },[playing,visible,reduce]);
 const navigate=(id:string,accepted:()=>void)=>{accepted();setPlaying(false);setSelected(null);if(id==='overview'||id==='schedules')setView(id);};
 return <div className="arc-demo-scope hero-admin-preview">
  <ArcSidebarLayout sections={sections} footer={[{id:'settings',label:'Workspace settings',icon:Settings2}]} active={view} togglePlacement="sidebar" hideBrand brand={{name:BRAND_NAME,detail:'Example Clinic · Bengaluru',icon:<HeartPulse />}} person={{name:'Priya Nair',role:'Clinic administrator',photo:responsiveImage('/assets/dashboard-people/emma-collins.jpg',{width:32})?.src}} onNavigate={navigate} renderHeader={()=> <header className="hero-admin-header"><span className="hero-admin-search"><Search size={16}/> Search <kbd>⌘ K</kbd></span><button className="hero-preview-play" onClick={()=>setPlaying(value=>!value)} aria-label={playing&&!reduce?"Pause dashboard animation":"Play dashboard animation"}>{playing&&!reduce?<Pause size={13}/>:<Play size={13}/>}</button><Bell size={17} aria-hidden="true"/></header>}>
   <div className="hero-admin-content">
    <div className="hero-admin-title"><h1>{view==='overview'?'Overview':'Schedules'}</h1><span>19 Oct 2026</span></div>
    {view==='overview'?<><div className="hero-admin-kpis">{tap&&<span className="hero-admin-tap" aria-hidden="true"/>}<KpiDrilldown embedded title="Clinic activity" caption={`Example clinic · Last ${range} days`} kpis={demoKpis} dimensions={[{value:'doctor',label:'Doctor'},{value:'channel',label:'Channel'}]} end="2026-10-19" range={range} onRangeChange={value=>{setPlaying(false);setRange(value);}} selected={selected} onSelectedChange={id=>{setPlaying(false);setSelected(id);}}/></div>
    <div className="hero-admin-report-note"><span>Compared with the previous {range} days</span><span>Tap a metric to explore</span></div>
    <section className="hero-admin-appointments" aria-label="Recent appointments">
     <header><h2>Recent appointments</h2><span>Today <span aria-hidden="true">↗</span></span></header>
     <table><thead><tr><th>Patient</th><th>Doctor</th><th>Time</th><th>Status</th><th>Source</th></tr></thead><tbody>{appointments.map(a=><tr key={a.name}><td><SiteImage className="hero-admin-avatar" width={27} height={27} sizes="27px" src={a.photo} alt=""/>{a.name}</td><td>{a.doctor}</td><td>{a.time}</td><td><span className={`hero-admin-status ${a.status==='Checked in'?'checked':''}`}>{a.status}</span></td><td><span className="hero-admin-source">{a.source==='AI reception'?<Headphones size={13}/>:a.source==='WhatsApp'?<MessageCircle size={13}/>:<CalendarDays size={13}/>} {a.source}</span></td></tr>)}</tbody></table>
    </section>
    </>:<ScheduleShowcase/>}
    <footer className="hero-admin-footer">Example data · All names and activity are fictional.</footer>
   </div>
  </ArcSidebarLayout>
 </div>;
}
