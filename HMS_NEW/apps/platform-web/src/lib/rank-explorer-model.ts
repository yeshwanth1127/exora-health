import type { RankPoint, RankScan } from './local-ranking';
export type ObservedSpot = { lat:number; lng:number; km:number; top:string[]; positions:Record<string,number>; area:string; where:string; status:RankPoint['status']; pointId:string; error?:string };
export function observedSpots(scan:RankScan):ObservedSpot[] {
  return scan.points.map(p=>({lat:p.latitude,lng:p.longitude,km:0,top:p.results.map(r=>r.id),positions:Object.fromEntries(p.results.map(r=>[r.id,r.position])),area:p.label,where:p.status==='checked'?'Live Places observation':p.status==='not_checked'?'Not checked yet':p.error?.message || 'Search unavailable',status:p.status,pointId:p.id,error:p.error?.message}));
}
/** Point in a projected region, including multipart boundaries and holes. */
export function regionContains(path:string,x:number,y:number) {
  let inside=false;
  for(const ring of path.split(/[Zz]/)) {
    const vertices=[...ring.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m=>[Number(m[1]),Number(m[2])]);
    for(let i=0,j=vertices.length-1;i<vertices.length;j=i++) {
      const [xi,yi]=vertices[i],[xj,yj]=vertices[j];
      if((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
    }
  }
  return inside;
}
/** Keep every observation at its geographic offset from the hospital's area. */
export function observationHexes(spots:ObservedSpot[],center?:{lat:number;lng:number},homeId?:string) {
  if(!spots.length)return {cells:[],home:0,spacing:1.5};
  const hospital=center || spots[0];
  const distance=(p:{lat:number;lng:number},q:{lat:number;lng:number})=>Math.hypot((p.lat-q.lat)*111.32,(p.lng-q.lng)*111.32*Math.cos(hospital.lat*Math.PI/180));
  const home=homeId && spots.some(p=>p.pointId===homeId) ? spots.findIndex(p=>p.pointId===homeId) : spots.reduce((best,p,i)=>distance(p,hospital)<distance(spots[best],hospital)?i:best,0);
  const origin=spots[home],kmPerLng=111.32*Math.cos(hospital.lat*Math.PI/180);
  const offsets=spots.map(p=>({x:(p.lng-origin.lng)*kmPerLng,z:(origin.lat-p.lat)*111.32}));
  let spacing=1.5;
  for(let i=0;i<offsets.length;i++)for(let j=i+1;j<offsets.length;j++) {
    const gap=Math.hypot(offsets[i].x-offsets[j].x,offsets[i].z-offsets[j].z);
    if(gap>0)spacing=Math.min(spacing,gap*.9);
  }
  const cells=spots.map((spot,i)=>{const {x,z}=offsets[i],r=z/(spacing*Math.sqrt(3)/2);return {...spot,x,z,r,q:x/spacing-r/2,km:distance(spot,hospital),where:i===home?'Your hospital is in this area':`${distance(spot,hospital).toFixed(1)} km from your hospital`};});
  return {cells,home,spacing};
}
export function observedRank(spot:ObservedSpot,id:string):number|null|undefined {
  return spot.status==='checked' ? spot.positions[id] ?? null : undefined;
}
export function mapWorld(lat:number,lng:number) {const sine=Math.sin(Math.max(-85,Math.min(85,lat))*Math.PI/180);return [(lng+180)/360,.5-Math.log((1+sine)/(1-sine))/(4*Math.PI)];}
