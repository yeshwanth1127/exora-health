import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ScheduleAppointmentPage } from '../components/booking/ScheduleAppointmentPage';
import { OriginalScheduleAppointmentPage } from '../components/booking/OriginalScheduleAppointmentPage';
import { OriginalSearchResultsPage } from '../components/search/OriginalSearchResultsPage';
import { SearchResultsPage } from '../components/search/SearchResultsPage';
import { scheduleProfile } from '../lib/hmsAvailability';
import type { PublicCatalog, PublicDoctor } from '../lib/publicBookingApi';

let serial=0;
const doctor:PublicDoctor={slug:'dr-current',name:'Dr Current Physician',roleTitle:'Physician & Diabetologist',specialty:null,qualifications:[],languages:[],bio:null,experienceYears:null,photoUrl:null,departments:['General Medicine'],acceptsVirtual:false,websiteIds:['doc-1']};
const slot={startsAt:'2026-10-14T04:30:00.000Z',endsAt:'2026-10-14T05:00:00.000Z',feeMinor:100000,slotToken:'signed-original-time'};
function fixture(unpriced=false,uncertain=false){
  const catalog:PublicCatalog={siteSlug:`restore-${++serial}`,clinicName:'Sri Lakshmi Hospital',timezone:'Asia/Kolkata',today:'2026-10-13',bookingUntil:'2026-10-30',doctors:[doctor]};
  const posts:{body:unknown;key:string|null}[]=[];
  vi.stubGlobal('fetch',vi.fn(async(_url,options)=>{
    if(options?.method==='POST'){
      posts.push({body:JSON.parse(options.body),key:new Headers(options.headers).get('idempotency-key')});
      if(uncertain && posts.length===1)return Response.json({},{status:503});
      return Response.json({appointmentId:'00000000-0000-4000-8000-000000000001',confirmationCode:'SLH123',status:'confirmed',startsAt:slot.startsAt,endsAt:slot.endsAt,feeMinor:slot.feeMinor,clinicName:catalog.clinicName,doctorName:doctor.name,visitMode:'in_person',timezone:catalog.timezone});
    }
    const url=new URL(String(_url),'http://localhost');
    const inWindow=url.searchParams.get('from')!<='2026-10-14' && url.searchParams.get('to')!>='2026-10-14';
    return Response.json({timezone:catalog.timezone,slots:inWindow&&!unpriced?[slot]:[],unpricedSlots:inWindow&&unpriced?[{startsAt:slot.startsAt,endsAt:slot.endsAt,serviceName:'Diabetology consultation'}]:[]});
  }));
  return {catalog,posts};
}
afterEach(()=>{sessionStorage.clear();vi.unstubAllGlobals();});
async function patientToReview(){
  await waitFor(()=>expect(screen.getByRole('button',{name:'14'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'14'}));
  fireEvent.click(await screen.findByRole('button',{name:'10:00 AM'}));
  fireEvent.change(screen.getByLabelText(/Legal full name/),{target:{value:'Example Patient'}});
  fireEvent.change(screen.getByLabelText(/Mobile Phone Number/),{target:{value:'9988776655'}});
  expect(screen.queryByRole('button',{name:'Try demo code'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Review visit details'}));
  expect(screen.getByRole('heading',{name:'Review your appointment'})).toBeInTheDocument();
}
describe('original layouts with HMS availability and persistence',()=>{
  for(const [theme,Page] of [['light',ScheduleAppointmentPage],['original',OriginalScheduleAppointmentPage]] as const)it(`${theme}: preserves calendar, guest form and review; confirms only after the saved receipt`,async()=>{
    const {catalog,posts}=fixture();render(<Page catalog={catalog} doctor={scheduleProfile(doctor,catalog)} user={null} onBackToHome={vi.fn()} onBackToSearch={vi.fn()}/>);
    expect(screen.queryByText(/Sample walkthrough/)).not.toBeInTheDocument();
    await patientToReview();expect(posts).toHaveLength(0);
    fireEvent.click(screen.getByRole('button',{name:'Confirm appointment'}));
    await screen.findByRole('heading',{name:'Appointment confirmed'});
    expect(posts[0].body).toEqual({slotToken:slot.slotToken,name:'Example Patient',phone:'+919988776655'});
    expect(screen.getByText('Booking reference: SLH123')).toBeInTheDocument();
  });
  it('a lost booking response freezes changes and recovers the same request and key',async()=>{
    const {catalog,posts}=fixture(false,true);render(<ScheduleAppointmentPage catalog={catalog} doctor={scheduleProfile(doctor,catalog)} user={null} onBackToHome={vi.fn()} onBackToSearch={vi.fn()}/>);
    await patientToReview();fireEvent.click(screen.getByRole('button',{name:'Confirm appointment'}));
    const recover=await screen.findByRole('button',{name:'Recover original booking'});
    expect(screen.getByRole('button',{name:'Confirm appointment'})).toBeDisabled();
    fireEvent.click(recover);await screen.findByRole('heading',{name:'Appointment confirmed'});
    expect(posts).toHaveLength(2);expect(posts[0]).toEqual(posts[1]);
  });
  it('published but unpriced times remain visible without creating a fake quote or fee',async()=>{
    const {catalog,posts}=fixture(true);render(<ScheduleAppointmentPage catalog={catalog} doctor={scheduleProfile(doctor,catalog)} user={null} onBackToHome={vi.fn()} onBackToSearch={vi.fn()}/>);
    await waitFor(()=>expect(screen.getByRole('button',{name:'14'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'14'}));
    expect(await screen.findByRole('button',{name:'10:00 AM'})).toBeDisabled();
    expect(screen.getByText(/fee for Diabetology consultation has not been configured/)).toBeInTheDocument();expect(posts).toHaveLength(0);
  });
  for(const Page of [SearchResultsPage,OriginalSearchResultsPage])it('symptom results preserve the five-day doctor slot matrix and carry the exact selected date/time into booking',async()=>{
    const {catalog}=fixture();catalog.doctors.push({...doctor,slug:'dr-cardiac',name:'Dr Cardiac',departments:['Cardiology']});
    const schedule=vi.fn();render(<Page catalog={catalog} careType="In-person" initialQuery="fever" user={null} onBackToHome={vi.fn()} onRetakeQuestionnaire={vi.fn()} onBookDoctor={vi.fn()} onScheduleDoctor={schedule} onOpenBooking={vi.fn()}/>);
    const time=await screen.findByRole('button',{name:'10:00 AM'});fireEvent.click(time);
    expect(schedule).toHaveBeenCalledWith(doctor.slug,2,'2026-10-14','10:00 AM');
    expect(screen.queryByRole('heading',{name:/Dr Cardiac/})).not.toBeInTheDocument();
    expect(screen.getByText('1 Providers')).toBeInTheDocument();
    expect(screen.queryByText('Video Visits are Available')).not.toBeInTheDocument();
  });
});
