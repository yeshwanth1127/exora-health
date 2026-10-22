const specs = [
  ['bookings', 'New bookings', 'Appointments created during this period.', 6, false],
  ['visits', 'Visits due', 'Appointments scheduled to take place during this period.', 5, false],
  ['checkIns', 'Check-ins', 'Patient arrivals recorded during this period.', 4.5, false],
  ['completed', 'Completed visits', 'Visits marked complete during this period.', 4, false],
  ['cancelled', 'Cancellations', 'Appointments cancelled during this period.', .42, true],
  ['noShows', 'No-shows', 'Appointments marked as no-shows during this period.', .18, true],
] as const;

// Deterministic fictional counts. No API requests, patient records or provider state.
export const demoKpis = specs.map(([id,label,description,base,lowerIsBetter],metric) => {
  const series = Array.from({length:180},(_,day) => lowerIsBetter ? (day % (day < 90 ? (metric === 4 ? 2 : 3) : day < 150 ? (metric === 4 ? 3 : 4) : day < 173 ? (metric === 4 ? 5 : 8) : 12) === 0 ? 1 : 0) : Math.max(0,Math.round(base * (.65+day/160) + Math.sin(day*Math.PI*2/7+metric)*base*.3 + (day%7===5 ? -base*.35 : 0))));
  const periods = Object.fromEntries([7,30,90].map(days => {
    const current=series.slice(-days).reduce((a,b)=>a+b,0);
    const previous=series.slice(-days*2,-days).reduce((a,b)=>a+b,0);
    const breakdown=(labels:string[],weights:number[]) => labels.map((name,index) => {
      const start=weights.slice(0,index).reduce((a,b)=>a+b,0),end=start+weights[index];
      return {id:name,name,value:Math.round(current*end)-Math.round(current*start),previous:Math.round(previous*end)-Math.round(previous*start)};
    });
    return [String(days),{current,previous,complete:true,breakdowns:{doctor:breakdown(['Dr Asha Rao','Dr Vikram Iyer','Dr Meera Shah'],[.45,.35,.2]),channel:breakdown(['AI reception','WhatsApp','Front desk','Website'],[.42,.28,.2,.1])}}];
  }));
  return {id,label,description,lowerIsBetter,series,periods,kind:'total' as const,format:{decimals:0}};
});
export const appointments = [
  {name:'Ananya Sharma',initials:'AS',photo:'/assets/dashboard-people/sofia-ramirez.jpg',doctor:'Dr Asha Rao',time:'10:30 am',source:'AI reception',status:'Confirmed'},
  {name:'Rohan Mehta',initials:'RM',photo:'/assets/dashboard-people/marcus-johnson.jpg',doctor:'Dr Vikram Iyer',time:'10:45 am',source:'WhatsApp',status:'Checked in'},
  {name:'Kavya Rao',initials:'KR',photo:'/assets/dashboard-people/jasmine-brooks.jpg',doctor:'Dr Meera Shah',time:'11:00 am',source:'Website',status:'Confirmed'},
  {name:'Arjun Kumar',initials:'AK',photo:'/assets/dashboard-people/ava-mitchell.jpg',doctor:'Dr Asha Rao',time:'11:15 am',source:'AI reception',status:'Confirmed'},
];
