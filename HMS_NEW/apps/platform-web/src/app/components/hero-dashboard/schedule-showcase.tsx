"use client";
import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
type State='booked'|'available'|'held'|'blocked';
type Period={state:State;slots:number;patient?:string};
const doctors=[{name:'Dr Asha Rao',specialty:'General Medicine',photo:'emma-collins'},{name:'Dr Vikram Iyer',specialty:'Paediatrics',photo:'marcus-johnson'},{name:'Dr Meera Shah',specialty:'Dermatology',photo:'jasmine-brooks'},{name:'Dr Neha Patel',specialty:'Family Medicine',photo:'sofia-ramirez'}];
export const schedulePeriods:Period[][]=[
 [{state:'booked',slots:2,patient:'Ananya S.'},{state:'available',slots:1},{state:'booked',slots:1,patient:'Rohan M.'},{state:'held',slots:1},{state:'available',slots:2},{state:'blocked',slots:1},{state:'booked',slots:2,patient:'Kavya R.'},{state:'available',slots:2}],
 [{state:'available',slots:2},{state:'booked',slots:1,patient:'Sana A.'},{state:'booked',slots:2,patient:'Vivek N.'},{state:'available',slots:1},{state:'blocked',slots:2},{state:'held',slots:1},{state:'available',slots:1},{state:'booked',slots:2,patient:'Riya S.'}],
 [{state:'booked',slots:1,patient:'Megha P.'},{state:'available',slots:2},{state:'held',slots:1},{state:'booked',slots:2,patient:'Aman S.'},{state:'available',slots:2},{state:'booked',slots:1,patient:'Tara K.'},{state:'blocked',slots:1},{state:'available',slots:2}],
 [{state:'blocked',slots:1},{state:'available',slots:2},{state:'booked',slots:2,patient:'Diya M.'},{state:'available',slots:1},{state:'held',slots:1},{state:'booked',slots:1,patient:'Varun P.'},{state:'available',slots:2},{state:'booked',slots:2,patient:'Mira S.'}],
];
const labels:Record<State,string>={booked:'Booked',available:'Available',held:'On hold',blocked:'Blocked'};
const clock=(slot:number)=>{const hour=9+Math.floor(slot/2);return `${hour>12?hour-12:hour}:${slot%2?'30':'00'} ${hour>=12?'pm':'am'}`;};
export default function ScheduleShowcase(){
 const [selected,setSelected]=useState<{row:number;index:number}|null>(null);
 const bookingCount=schedulePeriods.flat().filter(p=>p.state==='booked').length;
 const openSlots=schedulePeriods.flat().filter(p=>p.state==='available').reduce((sum,p)=>sum+p.slots,0);
 const chosen=selected?schedulePeriods[selected.row][selected.index]:null;
 const chosenStart=selected?schedulePeriods[selected.row].slice(0,selected.index).reduce((sum,p)=>sum+p.slots,0):0;
 return <section className="hero-schedule" aria-label="Example clinic schedule with mixed availability">
  <div className="hero-schedule-toolbar"><span><CalendarDays size={15}/>19 Oct, 2026</span><ChevronLeft size={15}/><ChevronRight size={15}/><span>Today</span><div/><span><Search size={14}/>Find a doctor…</span></div>
  <div className="hero-schedule-board">
   <header><div><h2>Monday, 19 October</h2><p>4 doctors · {bookingCount} appointments · {openSlots} open slots</p></div><div className="hero-pipe-legend">{(['booked','available','held','blocked'] as State[]).map(state=><span key={state}><i className={state}/>{labels[state]}</span>)}</div></header>
   <div className="hero-schedule-axis"><span>Doctor / time · IST</span><div>{['9 am','10 am','11 am','12 pm','1 pm','2 pm'].map(t=><span key={t}>{t}</span>)}</div></div>
   {doctors.map((doctor,row)=>{let start=0;const periods=schedulePeriods[row];const nextIndex=periods.findIndex(p=>p.state==='available');const next=periods.slice(0,nextIndex).reduce((sum,p)=>sum+p.slots,0);return <div className="hero-schedule-row" key={doctor.name}>
    <div className="hero-schedule-doctor"><img src={`/assets/dashboard-people/${doctor.photo}.jpg`} alt=""/><h3>{doctor.name}</h3><p>{doctor.specialty}</p><small>{periods.filter(p=>p.state==='booked').length} booked · {periods.filter(p=>p.state==='available').reduce((sum,p)=>sum+p.slots,0)} open</small></div>
    <div className="hero-pipe-lane"><div className="hero-schedule-pipe" aria-label={`${doctor.name} availability`}>{periods.map((period,index)=>{const from=start;start+=period.slots;const text=`${labels[period.state]} · ${clock(from)}–${clock(start)}${period.patient?` · ${period.patient}`:''}`;return <button key={index} className={`hero-pipe-segment ${period.state}`} style={{flex:period.slots}} title={text} aria-label={`${doctor.name}: ${text}`} onClick={()=>setSelected({row,index})}/>})}</div><span className="hero-pipe-next">Next available · {clock(next)}</span></div>
   </div>})}
  </div>
  {selected&&chosen&&<aside className="hero-schedule-detail" role="dialog" aria-label="Sample schedule period"><button onClick={()=>setSelected(null)} aria-label="Close schedule details"><X size={16}/></button><small>Sample schedule</small><h3>{chosen.patient??labels[chosen.state]}</h3><p>{doctors[selected.row].name}</p><p>{clock(chosenStart)}–{clock(chosenStart+chosen.slots)} · {chosen.slots*30} minutes</p><span>{labels[chosen.state]}</span></aside>}
 </section>;
}
