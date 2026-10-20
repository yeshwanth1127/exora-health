import { useEffect, useState } from 'react';
import { addBookingDays, bookingDay, createPublicBookingApi, type PublicCatalog, type PublicDoctor, type PublicSlot, type UnpricedSlot, type VisitMode } from './publicBookingApi';
import type { DoctorScheduleProfile } from '../components/booking/ScheduleAppointmentPage';
import { departments } from '../data/departments';
import { departmentMatches } from '../components/doctor/hmsRoster';

export function slotLabel(slot: Pick<PublicSlot,'startsAt'>, timezone: string) {
  return new Intl.DateTimeFormat('en-US',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(slot.startsAt));
}
export function scheduleProfile(doctor: PublicDoctor, catalog: PublicCatalog, slots: Pick<PublicSlot,'startsAt'|'endsAt'>[]=[]): DoctorScheduleProfile {
  const availableSlots:Record<string,string[]>={};
  for(const slot of slots) (availableSlots[bookingDay(slot.startsAt,catalog.timezone)]??=[]).push(slotLabel(slot,catalog.timezone));
  return {id:doctor.slug,name:doctor.name,credentials:doctor.qualifications.join(', '),specialty:doctor.roleTitle??doctor.specialty??doctor.departments.join(' · '),photo:doctor.photoUrl??'',rating:0,reviewCount:0,boardCertified:'',practiceName:catalog.clinicName,addressLine1:catalog.addressLine1??'',addressLine2:catalog.addressLine2??'',phone:catalog.phone??'',offersVideo:doctor.acceptsVirtual,availableSlots,bio:doctor.bio??'',education:doctor.qualifications,pedigree:doctor.qualifications.join(', '),nicheExpertise:doctor.roleTitle??doctor.specialty??doctor.departments.join(' · '),hospitalAffiliation:catalog.clinicName};
}
export function doctorDepartment(doctor: PublicDoctor) {
  return departments.find(d=>departmentMatches(doctor,d.id,d.name))?.id??'';
}
export function matchesDoctorDepartment(doctor:PublicDoctor,id:string) {
  return departmentMatches(doctor,id,departments.find(d=>d.id===id)?.name??id);
}
// Existing symptom navigation selects a specialty; it does not diagnose the patient.
export function symptomDepartment(query:string) {
  const q=query.toLowerCase();
  const rules:[string,RegExp][]=[['ent',/\b(ear|hearing|nose|sinus|throat|tonsil|snoring|vertigo)\b/],['dental',/\b(tooth|teeth|dental|gum|cavity)\b/],['dermatology',/\b(skin|acne|rash|hair|eczema|mole|itching)\b/],['cardiology',/\b(chest|heart|palpitation|bp|cholesterol|cardiology)\b/],['orthopedics',/\b(knee|bone|joint|back|spine|fracture|ligament|orthopedics)\b/],['pediatrics',/\b(child|baby|pediatric|vaccine|infant)\b/],['neurology',/\b(migraine|headache|neurology)\b/],['metabolic',/\b(diabetes|diabetic|blood sugar)\b/],['general-medicine',/\b(fever|cold|cough|checkup|check-up|general medicine)\b/]];
  return rules.find(([,pattern])=>pattern.test(q))?.[0];
}
// Read sharing prevents the original results matrix and calendar from repeating identical requests.
const reads=new Map<string,{expires:number;promise:Promise<{slots:PublicSlot[];unpricedSlots:UnpricedSlot[]}>}>();
export async function loadAvailability(catalog: PublicCatalog, slug:string, mode:VisitMode, from:string, to:string) {
  const api=createPublicBookingApi(catalog.siteSlug),key=JSON.stringify([catalog.siteSlug,slug,mode,from,to]);
  const existing=reads.get(key);if(existing && existing.expires>Date.now())return existing.promise;
  const promise=(async()=>{
    const result:PublicSlot[]=[],unpricedSlots:UnpricedSlot[]=[];
    for(let day=from;day<=to;day=addBookingDays(day,14)) {
      const end=[addBookingDays(day,13),to].sort()[0];
      const window=await api.slots(slug,mode,day,end,catalog.timezone);result.push(...window.slots);unpricedSlots.push(...(window.unpricedSlots??[]));
    }
    return {slots:result,unpricedSlots};
  })();
  reads.set(key,{expires:Date.now()+30000,promise});
  if(reads.size>200)reads.delete(reads.keys().next().value!);
  promise.catch(()=>{if(reads.get(key)?.promise===promise)reads.delete(key);});
  return promise;
}
export function usePublicAvailability(catalog:PublicCatalog|undefined, slugs:string[], mode:VisitMode, from:string,to:string,reload=0) {
  const key=JSON.stringify([catalog?.siteSlug,slugs,mode,from,to,reload]);
  const [state,setState]=useState<{key:string;byDoctor:Record<string,PublicSlot[]>;unpricedByDoctor:Record<string,UnpricedSlot[]>;loading:boolean;error:string}>({key:'',byDoctor:{},unpricedByDoctor:{},loading:false,error:''});
  useEffect(()=>{
    if(!catalog || !slugs.length)return;
    let active=true;
    const start=[from,catalog.today].sort().at(-1)!,end=[to,catalog.bookingUntil].sort()[0];
    setState({key,byDoctor:{},unpricedByDoctor:{},loading:start<=end,error:''});
    if(start>end)return;
    if(reload)for(const slug of slugs)reads.delete(JSON.stringify([catalog.siteSlug,slug,mode,start,end]));
    Promise.all(slugs.map(async slug=>[slug,await loadAvailability(catalog,slug,mode,start,end)] as const))
      .then(entries=>{if(active)setState({key,byDoctor:Object.fromEntries(entries.map(([slug,result])=>[slug,result.slots])),unpricedByDoctor:Object.fromEntries(entries.map(([slug,result])=>[slug,result.unpricedSlots])),loading:false,error:''});})
      .catch(error=>{if(active)setState({key,byDoctor:{},unpricedByDoctor:{},loading:false,error:error instanceof Error?error.message:'Could not load available times.'});});
    return()=>{active=false;};
  },[key,catalog]);
  return state.key===key?state:{key,byDoctor:{},unpricedByDoctor:{},loading:!!catalog,error:''};
}
