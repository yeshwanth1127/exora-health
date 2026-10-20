import { useState } from 'react';
import { ArrowRight, Bone, Brain, Headphones, MapPin, Search, Smile, Sparkles, Stethoscope, User, Eye } from 'lucide-react';
import { POPULAR_SPECIALTIES, CLINIC_LOCATIONS } from '../ai/aiTriageData';
import { getHeroBackdrop, type HeroBackdrop } from '../home/heroBackdrops';

interface LightCareSearchHeroProps {
  onOpenQuestionnaire: (specialtyId?: string, query?: string, dateTime?: string) => void;
  onAISearch?: (query: string) => void;
  backdrop?: HeroBackdrop;
}

const specialtyIcons: Record<string, typeof Stethoscope> = {
  'general-medicine': Stethoscope, obgyn: User, dermatology: Sparkles,
  dental: Smile, ent: Headphones, ophthalmology: Eye, neurology: Brain, orthopedics: Bone,
};

export function LightCareSearchHero({ onOpenQuestionnaire, backdrop = 'plain' }: LightCareSearchHeroProps) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(CLINIC_LOCATIONS[0]);
  const [patientType, setPatientType] = useState('1 Adult');
  const photo = getHeroBackdrop(backdrop);

  return <section className={`bg-[#f8f7f2] border-b border-[#e2e9df] pb-16 lg:pb-24 ${photo ? 'pt-[180px] lg:pt-[205px]' : 'pt-[150px] lg:pt-[164px]'}`}>
    <div className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12">
      <div className={`grid items-center gap-7 sm:gap-10 lg:gap-16 ${photo ? 'grid-cols-1' : 'lg:grid-cols-[1.05fr_.95fr]'}`}>
        <div className={photo ? 'max-w-[900px]' : 'max-w-[700px]'}>
          <p className="mb-4 sm:mb-6 text-xs font-bold tracking-[.22em] text-[#547b5a]">WELCOME TO SRI LAKSHMI HOSPITAL</p>
          <h1 className="font-medium text-[clamp(2.5rem,9vw,3.5rem)] sm:text-[clamp(3.7rem,6.5vw,6.8rem)] leading-[.98] tracking-[-.055em] text-[#17372b]">Your health is personal. Your care should be too.</h1>
          <p className="mt-5 sm:mt-7 max-w-xl text-base sm:text-xl leading-relaxed text-[#5a6d60]">Find a doctor, explore specialties, and plan a visit with Sri Lakshmi Hospital in Bengaluru.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#find-care" className="inline-flex items-center gap-2 rounded-full bg-[#24553c] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#173f2d] transition-colors">Find your care <ArrowRight size={16} /></a>
            <a href="#services" className="inline-flex items-center gap-2 rounded-full border border-[#9bb7a1] px-6 py-3.5 text-sm font-semibold text-[#24553c] hover:bg-[#e8f0e5] transition-colors">Explore services</a>
          </div>
        </div>
        {!photo && <div className="relative aspect-[1.35] sm:aspect-[1.05] min-h-[240px] sm:min-h-[400px] overflow-hidden rounded-[2rem] bg-[#e1eee1] hidden sm:block">
          <img src="/clients/sri-lakshmi/36f2a4cf-home-page-banner.png" alt="Doctor speaking with a patient in a consultation room" className="h-full w-full object-cover" />
          <div className="absolute bottom-5 left-5 right-5 sm:bottom-8 sm:left-8 sm:right-auto max-w-[310px] rounded-2xl bg-[#fffefa]/95 p-5 shadow-lg backdrop-blur">
            <span className="text-[10px] font-bold tracking-[.18em] text-[#608269]">CARE STARTS WITH A CONVERSATION</span>
            <p className="mt-2 font-medium text-2xl leading-tight text-[#17372b]">We’re here to listen first.</p>
          </div>
        </div>}
      </div>

      {photo && <div className="relative mt-12 h-[clamp(360px,46vw,580px)] overflow-hidden rounded-[2rem] bg-[#dfe9dc]">
        <img src={photo.image} alt="" aria-hidden="true" className="h-full w-full object-cover" style={{ objectPosition: photo.position }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#17372b]/35 via-transparent to-transparent" />
      </div>}

      <div id="find-care" className={`relative z-10 scroll-mt-32 rounded-[1.4rem] border border-[#dfe9dc] bg-[#fffefa] p-5 sm:p-6 shadow-[0_20px_55px_rgba(28,63,39,.09)] ${photo ? '-mt-20 mx-3 sm:-mt-24 sm:mx-8 lg:mx-14' : 'mt-7 sm:mt-10'}`}>
        <div className="relative">
        <div className="mb-4 flex items-center gap-2"><Search size={17} className="text-[#57815f]" /><p className="text-[11px] font-bold tracking-[.17em] text-[#557a5c]">FIND THE RIGHT CARE FOR YOU</p></div>
        <form onSubmit={e => { e.preventDefault(); onOpenQuestionnaire(undefined, query, 'Anytime'); }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_auto]">
          <label className="flex h-[60px] items-center gap-3 rounded-xl border border-[#dbe6da] bg-[#f8faf5] px-4 focus-within:border-[#7aa587]">
            <Search size={18} className="shrink-0 text-[#5c7e63]" />
            <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold tracking-[.13em] text-[#65806a]">WHAT BRINGS YOU IN?</span><input value={query} onChange={e => setQuery(e.target.value)} aria-label="Search symptoms, department, or doctor" placeholder="Symptoms, specialty, or doctor" className="mt-0.5 w-full bg-transparent text-sm text-[#17372b] placeholder:text-[#8a998e] outline-none" /></span>
          </label>
          <label className="flex h-[60px] items-center gap-3 rounded-xl border border-[#dbe6da] bg-[#f8faf5] px-4 focus-within:border-[#7aa587]">
            <MapPin size={18} className="shrink-0 text-[#5c7e63]" />
            <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold tracking-[.13em] text-[#65806a]">LOCATION</span><select value={location} onChange={e => setLocation(e.target.value)} aria-label="Clinic location" className="mt-0.5 w-full bg-transparent text-sm text-[#17372b] outline-none cursor-pointer">{CLINIC_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}</select></span>
          </label>
          <label className="flex h-[60px] items-center gap-3 rounded-xl border border-[#dbe6da] bg-[#f8faf5] px-4 focus-within:border-[#7aa587]">
            <User size={18} className="shrink-0 text-[#5c7e63]" />
            <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold tracking-[.13em] text-[#65806a]">WHO IS VISITING?</span><select value={patientType} onChange={e => setPatientType(e.target.value)} aria-label="Patient count" className="mt-0.5 w-full bg-transparent text-sm text-[#17372b] outline-none cursor-pointer">{['1 Adult','2 Adults','1 Child','Family (3+)'].map(value => <option key={value}>{value}</option>)}</select></span>
          </label>
          <button type="submit" className="flex h-[60px] items-center justify-center gap-2 rounded-xl bg-[#24553c] px-7 text-sm font-semibold text-white hover:bg-[#173f2d] transition-colors">Search care <ArrowRight size={17} /></button>
        </form>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <span className="mr-1 text-xs font-semibold text-[#7a8a7e]">POPULAR:</span>
        {POPULAR_SPECIALTIES.map(spec => {
          const Icon = specialtyIcons[spec.id] || Stethoscope;
          return <button key={spec.id} type="button" onClick={() => onOpenQuestionnaire(spec.id)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d9e7d8] bg-[#f1f6ee] px-3.5 py-2 text-xs font-medium text-[#375942] hover:border-[#9dbfa2] hover:bg-[#e6f0e3] transition-colors"><Icon size={14} />{spec.name}</button>;
        })}
      </div>
    </div>
  </section>;
}
