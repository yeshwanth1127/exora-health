import type { RankPoint, RankScan } from './local-ranking';
export type ObservedSpot = { lat:number; lng:number; km:number; top:string[]; positions:Record<string,number>; area:string; where:string; status:RankPoint['status']; pointId:string; error?:string };
export function observedSpots(scan:RankScan):ObservedSpot[] {
  return scan.points.map(p=>({lat:p.latitude,lng:p.longitude,km:0,top:p.results.map(r=>r.id),positions:Object.fromEntries(p.results.map(r=>[r.id,r.position])),area:p.label,where:p.status==='checked'?'Live Places observation':p.status==='not_checked'?'Not checked yet':p.error?.message || 'Search unavailable',status:p.status,pointId:p.id,error:p.error?.message}));
}
/** A categorical hex chart, deliberately independent of geographic coordinates. */
export function observationHexes(spots:ObservedSpot[],spacing=1.5) {
  let radius=0;while(1+3*radius*(radius+1)<spots.length)radius++;
  const slots:{q:number;r:number}[]=[];
  for(let q=-radius;q<=radius;q++)for(let r=-radius;r<=radius;r++)if(Math.abs(q+r)<=radius)slots.push({q,r});
  const chosen=slots.sort((a,b)=>(a.q*a.q+a.r*a.r+a.q*a.r)-(b.q*b.q+b.r*b.r+b.q*b.r)||a.r-b.r||a.q-b.q).slice(0,spots.length).sort((a,b)=>a.r-b.r||a.q-b.q);
  return spots.map((spot,i)=>({...spot,...chosen[i],x:spacing*(chosen[i].q+chosen[i].r/2),z:spacing*Math.sqrt(3)/2*chosen[i].r}));
}
export function observedRank(spot:ObservedSpot,id:string):number|null|undefined {
  return spot.status==='checked' ? spot.positions[id] ?? null : undefined;
}
export function mapWorld(lat:number,lng:number) {const sine=Math.sin(Math.max(-85,Math.min(85,lat))*Math.PI/180);return [(lng+180)/360,.5-Math.log((1+sine)/(1-sine))/(4*Math.PI)];}
