import React, { useState } from 'react';
import {
  Search,
  MapPin,
  User,
  Stethoscope,
  Sparkle,
  Smile,
  Headphones,
  Eye,
  Brain,
  Bone,
} from 'lucide-react';
import { POPULAR_SPECIALTIES, CLINIC_LOCATIONS } from '../ai/aiTriageData';
import { getHeroBackdrop, type HeroBackdrop, type HeroPlacement } from './heroBackdrops';

interface CareSearchHeroProps {
  onOpenQuestionnaire: (specialtyId?: string, query?: string, dateTime?: string) => void;
  onAISearch?: (query: string) => void;
  backdrop?: HeroBackdrop;
  placement?: HeroPlacement;
}

const SPECIALTY_ICON_MAP: Record<string, React.ElementType> = {
  'general-medicine': Stethoscope,
  obgyn: User,
  dermatology: Sparkle,
  dental: Smile,
  ent: Headphones,
  ophthalmology: Eye,
  neurology: Brain,
  orthopedics: Bone,
};

export const CareSearchHero: React.FC<CareSearchHeroProps> = ({
  onOpenQuestionnaire,
  backdrop = 'plain',
  placement = 'fullbleed',
}) => {
  const photo = getHeroBackdrop(backdrop);
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(CLINIC_LOCATIONS[0]);
  const [patientType, setPatientType] = useState('1 Adult');
  // Date selector hidden for now as requested
  const [_date, _setDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  void _date;
  void _setDate;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenQuestionnaire(undefined, query, 'Anytime');
  };

  // Dark frosted search card (exact look from HeroBookingBar), shared by every placement.
  const searchCard = (
    <div className="w-full max-w-4xl backdrop-blur-xl bg-[#17372b]/90 sm:bg-[#17372b]/86 border border-white/20 shadow-2xl rounded-2xl sm:rounded-3xl p-3 sm:p-4 text-white [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_Arial,_sans-serif]">
      <form onSubmit={handleSearchSubmit}>
        {/* Note: Top row with "Book Appointment Now" and integrated pills removed as requested */}

        {/* Bottom Row of Glass Inputs + Search CTA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.8fr_1.1fr_0.9fr_auto] gap-2 sm:gap-2.5 items-center">
        
          {/* 1. Search Symptoms / Department / Doctor (Made Bigger) */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 focus-within:border-white/40 focus-within:bg-white/20 transition">
            <Search className="size-4 text-white/80 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase font-semibold tracking-wider text-white/60 leading-none mb-1">
                Search
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search symptoms, department, or doctor"
                placeholder="Symptoms, department, doctor..."
                className="w-full bg-transparent text-xs sm:text-sm font-medium text-white placeholder-white/50 focus:outline-none"
              />
            </div>
          </div>

          {/* 2. Location Selector */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 focus-within:border-white/40 focus-within:bg-white/20 transition">
            <MapPin className="size-3.5 text-white/80 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase font-semibold tracking-wider text-white/60 leading-none mb-0.5">
                Location
              </div>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                aria-label="Clinic Location"
                className="w-full bg-transparent text-xs font-medium text-white focus:outline-none cursor-pointer truncate [color-scheme:dark]"
              >
                {CLINIC_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc} className="bg-[#12231b] text-white">
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Who / Patient Selector */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 focus-within:border-white/40 focus-within:bg-white/20 transition">
            <User className="size-3.5 text-white/80 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase font-semibold tracking-wider text-white/60 leading-none mb-0.5">
                Who
              </div>
              <select
                value={patientType}
                onChange={(e) => setPatientType(e.target.value)}
                aria-label="Patient Count"
                className="w-full bg-transparent text-xs font-medium text-white focus:outline-none cursor-pointer [color-scheme:dark]"
              >
                <option value="1 Adult" className="bg-[#12231b] text-white">1 Adult</option>
                <option value="2 Adults" className="bg-[#12231b] text-white">2 Adults</option>
                <option value="1 Child" className="bg-[#12231b] text-white">1 Child</option>
                <option value="Family (3+)" className="bg-[#12231b] text-white">Family (3+)</option>
              </select>
            </div>
          </div>

          {/* 4. Search CTA Button: Clean White on Glass with Emerald Text */}
          <button
            type="submit"
            className="w-full sm:w-auto h-full min-h-[44px] bg-white hover:bg-white/90 active:scale-95 text-[#154734] font-semibold text-xs sm:text-[13px] px-6 py-2.5 rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <Search className="size-3.5 text-[#154734]" />
            <span>Search</span>
          </button>

        </div>
      </form>
    </div>
  );

  const pills = (
    <div className="mt-7 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 max-w-4xl">
      {POPULAR_SPECIALTIES.map((spec) => {
        const Icon = SPECIALTY_ICON_MAP[spec.id] || Stethoscope;
        return (
          <button
            key={spec.id}
            type="button"
            onClick={() => onOpenQuestionnaire(spec.id)}
            className="inline-flex items-center gap-2 min-h-11 px-3.5 py-2 rounded-full bg-white hover:bg-[#eef7f2] border border-neutral-200/90 text-xs sm:text-[13px] font-semibold text-neutral-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer hover:border-[#154734]/30 hover:text-[#154734] active:scale-95"
          >
            <Icon className="size-3.5 text-[#154734] stroke-[2]" />
            <span>{spec.name}</span>
          </button>
        );
      })}
    </div>
  );

  const headline = 'Find your hospital specialists in KR Puram';
  const subline = 'Specialty consultations, health checks and hospital care in Bengaluru';

  if (photo && placement === 'fullbleed') {
    return (
      <section className="relative flex min-h-[100svh] w-full items-end overflow-hidden bg-neutral-900 px-4 pt-[180px] pb-12 sm:px-6 sm:pb-16 lg:px-8">
        {/* Starts below the fixed header so the top of the photo is never hidden behind it. */}
        <img src={photo.image} alt="" aria-hidden="true" className="absolute inset-x-0 bottom-0 top-[var(--site-header-offset)] h-[calc(100%-var(--site-header-offset))] w-full object-cover" style={{ objectPosition: photo.position }} />
        {/* Neutral scrim, only where the text sits, so the photo keeps its own colour. */}
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-black/30 to-transparent" />
        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-[72px]">{headline}</h1>
          <p className="mt-4 mb-8 max-w-xl text-base text-white/85 sm:text-lg">{subline}</p>
          {searchCard}
          <div className="[&>div]:justify-start">{pills}</div>
        </div>
      </section>
    );
  }

  if (photo && placement === 'split') {
    return (
      <section className="relative w-full border-b border-[#dce8da] bg-[#f8f7f2] px-4 pt-[140px] pb-16 sm:px-6 sm:pt-[150px] lg:px-8">
        <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1fr_.9fr] lg:gap-14">
          <div>
            <h1 className="text-4xl font-bold leading-[1.06] tracking-tight text-[#17372b] sm:text-5xl lg:text-[64px]">{headline}</h1>
            <p className="mt-4 max-w-md text-base text-neutral-600 sm:text-lg">{subline}</p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-[#dfe9dc] lg:aspect-[4/5] lg:max-h-[560px]">
            <img src={photo.image} alt="" aria-hidden="true" className="h-full w-full object-cover" style={{ objectPosition: photo.position }} />
          </div>
        </div>
        <div className="relative z-10 mx-auto mt-8 max-w-6xl lg:-mt-24 lg:pr-[20%]">
          {searchCard}
          <div className="[&>div]:justify-start">{pills}</div>
        </div>
      </section>
    );
  }

  if (photo && placement === 'banner') {
    return (
      <section className="relative w-full border-b border-[#dce8da] bg-[#f8f7f2] pt-[110px] pb-14 sm:pb-20">
        {/* A wide strip at roughly the banner's own ratio; below lg the headline drops under it. */}
        <div className="relative">
          <img src={photo.image} alt="" aria-hidden="true" className="h-56 w-full object-cover sm:h-72 lg:h-auto lg:aspect-[16/6] lg:max-h-[620px]" style={{ objectPosition: photo.position }} />
          <div className="absolute inset-y-0 left-0 hidden w-[65%] bg-gradient-to-r from-[#f8f7f2] from-40% to-transparent lg:block" />
          <div className="lg:absolute lg:inset-0 lg:flex lg:items-center">
            <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 lg:px-8 lg:pt-0 lg:pb-12">
              <h1 className="max-w-xl text-4xl font-bold leading-[1.06] tracking-tight text-[#17372b] sm:text-5xl lg:text-[60px]">{headline}</h1>
              <p className="mt-4 max-w-md text-base text-neutral-600 sm:text-lg">{subline}</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 mx-auto mt-8 max-w-6xl px-4 sm:px-6 lg:-mt-12 lg:px-8">
          {searchCard}
          <div className="[&>div]:justify-start">{pills}</div>
        </div>
      </section>
    );
  }

  return (
    <section className={`relative w-full overflow-hidden px-4 sm:px-6 lg:px-8 border-b border-[#dce8da] ${photo ? 'bg-[#f8f7f2] pt-[250px] sm:pt-[270px] lg:pt-[290px] pb-24 sm:pb-28' : 'bg-gradient-to-b from-[#eef7f2]/40 via-[#fcfbf9] to-white pt-[140px] sm:pt-36 pb-16 sm:pb-20'}`}>
      {photo ? (
        <div className="absolute inset-x-4 top-[160px] bottom-10 overflow-hidden rounded-[1.75rem] bg-[#17372b] sm:inset-x-7 lg:inset-x-10 pointer-events-none">
          <img src={photo.image} alt="" aria-hidden="true" className="h-full w-full object-cover" style={{ objectPosition: photo.position }} />
          <div className="absolute inset-0 bg-gradient-to-b from-[#102c20]/10 via-[#102c20]/25 to-[#102c20]/65" />
        </div>
      ) : (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[340px] bg-[#154734]/5 blur-[100px] rounded-full pointer-events-none" />
      )}

      <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
        {/* Centered Hero Headline */}
        <h1 className={`text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-bold tracking-tight text-center max-w-3xl leading-[1.12] ${photo ? 'text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.45)]' : 'text-neutral-900'}`}>
          Find your hospital specialists <br className="hidden sm:inline" />
          in KR Puram
        </h1>
        <p className={`text-sm sm:text-base text-center mt-3 mb-8 font-normal ${photo ? 'text-white drop-shadow-[0_1px_7px_rgba(0,0,0,.7)]' : 'text-neutral-600'}`}>
          Specialty consultations, health checks and hospital care in Bengaluru
        </p>

        {searchCard}

        {pills}
      </div>
    </section>
  );
};
