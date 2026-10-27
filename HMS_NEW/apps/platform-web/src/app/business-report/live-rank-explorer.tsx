"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RankScan } from '../../lib/local-ranking';
import { rankLeaderboard } from '../../lib/local-ranking';
import type { PublicBusiness } from '../../lib/business-lookup';
import { businessLookup } from '../../lib/business-lookup';
import LocalRankMap, { type RankPreview } from './local-rank-map';
import { Popover, PopoverTrigger, PopoverContent } from '../components/arc-report/popover/popover';
import { CircleHelp } from 'lucide-react';

export default function LiveRankExplorer({scan:initialScan,profile}:{scan:RankScan;profile:PublicBusiness}) {
  const [scan,setScan]=useState(initialScan),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  const remaining=scan.points.filter(p=>p.status==='not_checked').sort((a,b)=>(a.distanceKm ?? Infinity)-(b.distanceKm ?? Infinity)||a.id.localeCompare(b.id));
  const nextBatch=remaining.slice(0,9);
  const preview=useMemo<RankPreview>(()=>{
    const businesses=new Map(scan.points.flatMap(p=>p.results.map(r=>[r.id,r] as const)));
    const location=profile.location || {latitude:0,longitude:0};
    return {query:scan.query || '',targetId:profile.id,hospitals:[{id:profile.id,name:profile.name,lat:location.latitude,lng:location.longitude,prominence:0},...Array.from(businesses.values()).filter(b=>b.id!==profile.id).map(b=>({id:b.id,name:b.name,lat:0,lng:0,prominence:0}))]};
  },[scan,profile]);
  async function checkAreas(ids:string[]) {
    if(busy || !ids.length || !scan.city || !scan.category)return;
    setBusy(true);setMessage('');const controller=new AbortController();request.current=controller;
    try {
      const result=await businessLookup({mode:'rank',city:scan.city,category:scan.category,areas:ids.join(',')},controller.signal);
      if(!result.points || controller.signal.aborted)return;
      const observed=new Map(result.points.map(p=>[p.id,p]));
      setScan(previous=>{const points=previous.points.map(p=>observed.has(p.id)?{...p,...observed.get(p.id)!}:p),checked=points.filter(p=>p.status==='checked').length;return {...previous,points,checkedPoints:checked,leaderboard:rankLeaderboard(points,previous.targetId,previous.depth),status:checked===points.length?'complete':'partial',checkedAt:new Date().toISOString()};});
      const failed=result.points.filter(p=>p.status==='unavailable');
      setMessage(failed.length?`${failed.length} searches unavailable. ${failed[0].error?.message || ''}`:`${result.points.length} neighbourhood ${result.points.length===1?'search':'searches'} completed.`);
    } catch(error) {if(!controller.signal.aborted)setMessage(error instanceof Error?error.message:'Search unavailable.');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  const safeAttribution=(url:string)=>{try{return new URL(url).protocol==='https:'?url:'';}catch{return '';}};
  const providers=[...new Map(scan.points.flatMap(p=>p.results.flatMap(r=>r.attributions || [])).filter(a=>a.provider).map(a=>[`${a.provider}|${a.providerUri}`,a])).values()];
  return <div className="live-rank-explorer">
    {scan.points.length ? <>
      <div className="rank-explorer-controls"><span>{scan.checkedPoints} of {scan.points.length} neighbourhoods checked</span><button disabled={busy || !remaining.length} onClick={()=>void checkAreas(nextBatch.map(p=>p.id))}>{busy?'Checking…':remaining.length?`Check next ${nextBatch.length} nearby areas`:'All areas checked'}</button><Popover><PopoverTrigger className="reach-help-trigger" aria-label="How area comparisons work"><CircleHelp size={16}/></PopoverTrigger><PopoverContent className="business-arc-scope reach-score-help"><h2>How area comparisons work</h2><p>{scan.methodology}</p><p>One Places request per neighbourhood. Daily and monthly free-tier guards apply. Unchecked and unavailable locations have no rank.</p></PopoverContent></Popover></div>
      <p className="rank-board-note">{scan.sampleDescription || "A sample of search origins, not a complete city scan."} {remaining.length} areas remain unchecked.</p><p role="status" className="rank-board-note">{message}</p>
      <LocalRankMap preview={preview} scan={scan} onCheck={ids=>void checkAreas(ids)} busy={busy}/>
    </> : <p className="reach-empty">{scan.message}</p>}
    {!!providers.length && <p className="rank-board-note">Data providers: {providers.map((a,i)=><span key={`${a.provider}|${a.providerUri}`}>{i>0 && ', '}{safeAttribution(a.providerUri || '')?<a href={safeAttribution(a.providerUri!)} target="_blank" rel="noreferrer">{a.provider}</a>:a.provider}</span>)}</p>}
  </div>;
}
