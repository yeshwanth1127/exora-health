"use client";
import { useEffect } from 'react';
/** One observer, compositor-only entrances, no scroll listeners or hidden content. */
export default function MarketingMotion() {
 useEffect(()=>{
  if(location.hash==='#onboarding'){location.replace('/onboarding');return;}

  if(document.querySelector('.arc-demo-scope'))return;
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const animations=new Set<Animation>();
  const anchor=location.hash?document.getElementById(decodeURIComponent(location.hash.slice(1))):null;
  const anchorFrame=anchor?requestAnimationFrame(()=>anchor.scrollIntoView({behavior:'instant',block:'start'})):0;
  const keyboard=()=>{document.documentElement.dataset.keyboardNavigation='true';};
  const pointer=()=>{delete document.documentElement.dataset.keyboardNavigation;};
  document.addEventListener('keydown',keyboard);document.addEventListener('pointerdown',pointer);
  const targets=document.querySelectorAll<HTMLElement>('main h1, main h2, .marketing-asset, .blog-card, .help-topic, .pricing-plan-group, .release-heading-doctors, .release-features>section, .blog-prose>section, .care-team-page [data-audience-row], .home-enquiries-copy, .closing-care-copy');
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries){
    if(!entry.isIntersecting)continue;
    observer.unobserve(entry.target);
    if(preference.matches||document.hidden||location.hash)continue;
    const animation=entry.target.animate([{opacity:.35,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,easing:'cubic-bezier(.22,1,.36,1)'});
    animations.add(animation);animation.onfinish=()=>animations.delete(animation);
   }
  },{threshold:.12,rootMargin:'0px 0px -24px 0px'});
  targets.forEach(target=>observer.observe(target));
  const stop=()=>{if(preference.matches||document.hidden){animations.forEach(a=>a.cancel());animations.clear();}document.documentElement.dataset.pageHidden=String(document.hidden);};
  preference.addEventListener('change',stop);document.addEventListener('visibilitychange',stop);
  document.querySelectorAll<HTMLImageElement>('main img').forEach(image=>{image.decoding='async';if(image.getBoundingClientRect().top>innerHeight*1.25&&!image.hasAttribute('loading'))image.loading='lazy';});
  return()=>{cancelAnimationFrame(anchorFrame);document.removeEventListener('keydown',keyboard);document.removeEventListener('pointerdown',pointer);observer.disconnect();animations.forEach(a=>a.cancel());preference.removeEventListener('change',stop);document.removeEventListener('visibilitychange',stop);};
 },[]);
 return null;
}
