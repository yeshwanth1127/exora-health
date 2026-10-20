import { describe,it,expect,vi,afterEach } from 'vitest';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { HmsDoctorDirectory } from '../components/doctor/HmsDoctorDirectory';
import { HmsDoctorProfile } from '../components/doctor/HmsDoctorProfile';
import { App } from '../App';
import type { PublicDoctor } from '../lib/publicBookingApi';
const doctor:PublicDoctor={slug:'dr-backend',name:'Dr Backend Value',specialty:'Cardiology',acceptsVirtual:false,websiteIds:['doc-1'],qualifications:['Hospital qualification'],bio:'Current biography from HMS.',experienceYears:12,languages:['Kannada'],photoUrl:null,departments:['Cardiology']};
const handlers={onBackToHome:vi.fn(),onSelectDoctor:vi.fn(),onBookDoctor:vi.fn(),onExploreDepartments:vi.fn()};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();window.history.replaceState({},'','/');});
describe('HMS public roster owns website doctor values',()=>{
  it('directory renders changed backend values and never fills an empty roster with archived doctors',()=>{
    const {rerender}=render(<HmsDoctorDirectory roster={[doctor]} clinicName="Sri Lakshmi Hospital" {...handlers}/>);
    expect(screen.getByText(doctor.name)).toBeInTheDocument();expect(screen.queryByText(/Dr\. Ananditha/)).not.toBeInTheDocument();
    rerender(<HmsDoctorDirectory roster={[{...doctor,name:'Dr Updated Name'}]} clinicName="Sri Lakshmi Hospital" {...handlers}/>);
    expect(screen.queryByText(doctor.name)).not.toBeInTheDocument();expect(screen.getByText('Dr Updated Name')).toBeInTheDocument();
    rerender(<HmsDoctorDirectory roster={[]} clinicName="Sri Lakshmi Hospital" {...handlers}/>);
    expect(screen.queryByText('Dr Updated Name')).not.toBeInTheDocument();
  });
  it('profile uses only supplied qualification, language, bio and experience; missing fields are omitted',()=>{
    const {rerender}=render(<HmsDoctorProfile doctor={doctor} clinicName="Sri Lakshmi Hospital" onBackToSearch={vi.fn()} onBackToHome={vi.fn()} onScheduleAppointment={vi.fn()}/>);
    expect(screen.getByText(doctor.bio!)).toBeInTheDocument();expect(screen.getByText('Hospital qualification')).toBeInTheDocument();expect(screen.getByText('Kannada')).toBeInTheDocument();
    rerender(<HmsDoctorProfile doctor={{...doctor,qualifications:[],bio:null,experienceYears:null,languages:[]}} clinicName="Sri Lakshmi Hospital" onBackToSearch={vi.fn()} onBackToHome={vi.fn()} onScheduleAppointment={vi.fn()}/>);
    expect(screen.queryByText('Hospital qualification')).not.toBeInTheDocument();expect(screen.queryByText(/12 years/)).not.toBeInTheDocument();expect(screen.queryByText(/board certified/i)).not.toBeInTheDocument();
  });
  it('doctor route and metadata resolve an archived ID through the backend roster',async()=>{
    vi.stubEnv('VITE_BOOKING_MODE','hms');
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({siteSlug:'sri-lakshmi',clinicName:'Sri Lakshmi Hospital',timezone:'Asia/Kolkata',today:'2026-10-13',bookingUntil:'2026-11-13',doctors:[doctor]})));
    window.history.replaceState({},'','/doctors/doc-1');render(<App/>);
    expect(await screen.findByRole('heading',{name:doctor.name})).toBeInTheDocument();
    await waitFor(()=>expect(document.title).toBe(`${doctor.name} | Sri Lakshmi Hospital`));
    expect(screen.queryByText(/Dr\. Ananditha/)).not.toBeInTheDocument();
  });
  it('directory filter derives choices from current departments',()=>{
    render(<HmsDoctorDirectory roster={[doctor]} clinicName="Sri Lakshmi Hospital" {...handlers}/>);
    fireEvent.change(screen.getByLabelText('Search doctors'),{target:{value:'not present'}});
    expect(screen.queryByText(doctor.name)).not.toBeInTheDocument();
  });
});
