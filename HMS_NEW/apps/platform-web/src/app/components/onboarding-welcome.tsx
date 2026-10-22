"use client";
import {useEffect} from 'react';
export default function OnboardingWelcome({workspace=false}:{workspace?:boolean}){
  useEffect(()=>{window.location.replace('/onboarding');},[workspace]);
  return <main className="capture-welcome"><p role="status">Opening your saved workspace setup…</p><a href="/onboarding">Continue setup</a></main>;
}
