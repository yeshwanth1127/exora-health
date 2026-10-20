import { GraduationCap, ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '../common/Breadcrumbs';
import { HmsDoctorPhoto } from './HmsDoctorPhoto';
import type { HmsRosterDoctor } from './hmsRoster';

interface Props {
  doctor?: HmsRosterDoctor;
  clinicName: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onBackToSearch: () => void;
  onBackToHome: () => void;
  onScheduleAppointment: (doctorId: string, step?: 1 | 2) => void;
}
export function HmsDoctorProfile({ doctor, clinicName, loading, error, onRetry, onBackToSearch, onBackToHome, onScheduleAppointment }: Props) {
  if (!doctor) return <div className="bg-[#fcfbf9] text-[#17372b] py-16 px-6"><div className="max-w-7xl mx-auto space-y-6"><button onClick={onBackToSearch} className="underline">Back to doctors</button><h1 className="text-4xl font-medium">Doctor profile</h1><p role={error ? 'alert' : 'status'}>{loading ? 'Loading hospital doctor…' : error || 'This doctor is not currently published for online booking. Choose a doctor from the hospital’s current team.'}</p>{error && <button onClick={onRetry} className="rounded-full bg-[#194d38] px-6 py-3 text-white">Try again</button>}</div></div>;
  const sections = [{ id: 'overview', label: 'About the doctor', show: !!doctor.bio }, { id: 'credentials', label: 'Qualifications', show: !!doctor.qualifications.length }, { id: 'languages-spoken', label: 'Languages', show: !!doctor.languages.length }].filter(section => section.show);
  return <div className="bg-[#fcfbf9] text-[#121212] font-sans">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3"><Breadcrumbs items={[{ label: 'Home', onClick: onBackToHome }, { label: 'Find a Doctor', onClick: onBackToSearch }, { label: doctor.name }]} /></div>
    <section className="bg-[#12231b] text-white relative overflow-hidden min-h-[440px] lg:min-h-[480px] flex flex-col justify-center">
      <div className="relative w-full h-80 sm:h-96 lg:h-full lg:absolute lg:right-0 lg:top-0 lg:bottom-0 lg:w-[52%] overflow-hidden"><HmsDoctorPhoto key={doctor.slug} name={doctor.name} url={doctor.photoUrl} className="w-full h-full object-cover object-top" /><div className="hidden lg:block absolute inset-y-0 left-0 w-36 bg-gradient-to-r from-[#12231b] to-transparent" /></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10 w-full"><div className="max-w-xl space-y-5"><p className="inline-block rounded-full bg-white/10 border border-white/15 px-3 py-1 text-sm">{clinicName}</p><h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">{doctor.name}</h1>{(doctor.roleTitle || doctor.specialty) && <p className="text-lg text-stone-200">{doctor.roleTitle || doctor.specialty}</p>}{doctor.departments.some(name=>name!==doctor.specialty) && <p className="text-stone-200">{doctor.departments.filter(name=>name!==doctor.specialty).join(' · ')}</p>}{doctor.experienceYears !== null && <p className="text-stone-200">{doctor.experienceYears} {doctor.experienceYears === 1 ? 'year' : 'years'} of experience</p>}<button onClick={() => onScheduleAppointment(doctor.slug, 1)} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#154734] hover:bg-white/95 font-semibold">Schedule appointment <ArrowRight size={17} /></button><p className="text-stone-200">Choose a published time for {doctor.acceptsVirtual ? 'an in-person visit or teleconsultation' : 'an in-person visit'}.</p></div></div>
    </section>
    {sections.length > 0 && <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid lg:grid-cols-12 gap-14"><main className="lg:col-span-9 space-y-14">
      {doctor.bio && <section id="overview" className="scroll-mt-28 space-y-6"><h2 className="text-3xl font-bold tracking-tight">About the doctor</h2><p className="text-lg text-stone-700 leading-relaxed whitespace-pre-line">{doctor.bio}</p></section>}
      {doctor.qualifications.length > 0 && <section id="credentials" className="scroll-mt-28 space-y-6 pt-6 border-t border-stone-200"><h2 className="text-3xl font-bold tracking-tight flex items-center gap-3"><GraduationCap className="text-[#1e6b4c]" />Qualifications</h2><ul className="space-y-3 list-disc pl-6 text-lg text-stone-700">{doctor.qualifications.map((qualification, index) => <li key={`${qualification}-${index}`}>{qualification}</li>)}</ul></section>}
      {doctor.languages.length > 0 && <section id="languages-spoken" className="scroll-mt-28 space-y-6 pt-6 border-t border-stone-200"><h2 className="text-3xl font-bold tracking-tight">Languages</h2><p className="text-lg text-stone-700">{doctor.languages.join(' · ')}</p></section>}
    </main><aside className="hidden lg:block lg:col-span-3"><nav className="sticky top-28 border-l border-stone-200 pl-6 space-y-5" aria-label="Doctor profile sections">{sections.map(section => <a key={section.id} href={`#${section.id}`} className="block text-[#24553c] font-medium hover:underline">{section.label}</a>)}</nav></aside></div>}
  </div>;
}
