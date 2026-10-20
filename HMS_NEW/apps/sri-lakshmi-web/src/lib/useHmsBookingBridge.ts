import { useEffect, useMemo, useState } from 'react';
import { createPublicBookingApi, PublicBookingIntent, type BookingPayload, type PublicCatalog, type VisitMode } from './publicBookingApi';
import { usePublicAvailability } from './hmsAvailability';

export function useHmsBookingBridge(catalog:PublicCatalog|undefined,doctorId:string,mode:VisitMode,dirty:boolean) {
  const machine=useMemo(()=>catalog?new PublicBookingIntent(createPublicBookingApi(catalog.siteSlug)):null,[catalog?.siteSlug]);
  const [,change]=useState(0),[reload,setReload]=useState(0),[localError,setLocalError]=useState('');
  const availability=usePublicAvailability(catalog,[doctorId],mode,catalog?.today??'',catalog?.bookingUntil??'',reload);
  const frozen=!!machine&&(machine.busy||machine.unknown);
  useEffect(()=>{
    if(!catalog || machine?.receipt || !(dirty||frozen))return;
    const before=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    const leave=(e:Event)=>{if(frozen||!window.confirm('Leave this booking? Your unsaved details will be discarded.'))e.preventDefault();};
    window.addEventListener('beforeunload',before);window.addEventListener('hms-booking-leave',leave);
    return()=>{window.removeEventListener('beforeunload',before);window.removeEventListener('hms-booking-leave',leave);};
  },[catalog,machine,dirty,frozen]);
  async function submit(body?:BookingPayload,slot?:typeof availability.byDoctor[string][number]) {
    if(!machine || !catalog)return;
    setLocalError('');
    try {
      const task=body&&slot?machine.execute(body,{slot,clinicName:catalog.clinicName,doctorName:catalog.doctors.find(d=>d.slug===doctorId)!.name,timezone:catalog.timezone,mode}):machine.recover();
      change(n=>n+1);await task;
    }catch(error) {setLocalError(error instanceof Error?error.message:'Could not complete the booking.');if(!machine.unknown)setReload(n=>n+1);}finally{change(n=>n+1);}
  }
  return {availability,slots:availability.byDoctor[doctorId]??[],unpricedSlots:availability.unpricedByDoctor[doctorId]??[],frozen,busy:machine?.busy??false,unknown:machine?.unknown??false,receipt:machine?.receipt,error:machine?.error||localError,submit,refresh:()=>setReload(n=>n+1),reset:()=>machine?.reset()};
}
