"use client";
import { BRAND_NAME } from "../../../lib/brand";
import { useEffect, useRef, useState } from 'react';
import './hero-dashboard.css';
export default function HeroDashboard() {
 const ref=useRef<HTMLDivElement>(null);const frame=useRef<HTMLIFrameElement>(null);const [scale,setScale]=useState(.8);
 useEffect(()=>{const el=ref.current;if(!el)return;const observer=new ResizeObserver(()=>setScale(el.clientWidth/1200));observer.observe(el);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  const el=ref.current;if(!el)return;
  let visible=false;
  const send=()=>frame.current?.contentWindow?.postMessage({type:'capture-preview-visible',visible:visible&&!document.hidden},window.location.origin);
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;send();},{threshold:.35});observer.observe(el);
  const ready=(event:MessageEvent)=>{if(event.origin===window.location.origin&&event.source===frame.current?.contentWindow&&event.data?.type==='capture-preview-ready')send();};
  window.addEventListener('message',ready);document.addEventListener('visibilitychange',send);return()=>{observer.disconnect();window.removeEventListener('message',ready);document.removeEventListener('visibilitychange',send);};
 },[]);
 return <div ref={ref} className="hero-dashboard-frame" id="hero-dashboard"><iframe ref={frame} title={("Interactive " + BRAND_NAME + " dashboard with fictional demo data")} src="/demo/overview" loading="lazy" style={{transform:`scale(${scale})`}}/></div>;
}
