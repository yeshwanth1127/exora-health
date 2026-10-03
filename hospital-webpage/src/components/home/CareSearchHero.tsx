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

interface CareSearchHeroProps {
  onOpenQuestionnaire: (specialtyId?: string, query?: string, dateTime?: string) => void;
  onAISearch?: (query: string) => void;
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
}) => {
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

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-[#eef7f2]/40 via-[#fcfbf9] to-white pt-40 sm:pt-36 pb-16 sm:pb-20 px-4 sm:px-6 lg:px-8 border-b border-neutral-100">
      {/* Background Soft Avocado Green Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[340px] bg-[#154734]/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
        {/* Centered Hero Headline */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-bold tracking-tight text-neutral-900 text-center max-w-3xl leading-[1.12]">
          Book top-rated doctors <br className="hidden sm:inline" />
          on your schedule
        </h1>
        <p className="text-sm sm:text-base text-neutral-600 text-center mt-3 mb-8 font-normal">
          Immediate OPD appointments, verified specialists, and hospital care in Bangalore
        </p>

        {/* ── ADAPTED DARK FROSTED GLASS SEARCH COMPONENT (Exact look from HeroBookingBar) ── */}
        <div className="w-full max-w-4xl backdrop-blur-xl bg-black/75 sm:bg-black/70 border border-white/20 shadow-2xl rounded-2xl sm:rounded-3xl p-3 sm:p-4 text-white [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_Arial,_sans-serif]">
          <form onSubmit={handleSearchSubmit}>
            {/* Note: Top row with "Book Appointment Now" and integrated pills removed as requested */}

            {/* Bottom Row of Glass Inputs + Search CTA */}
            <div className="grid grid-cols-1 sm:grid-cols-[1.8fr_1.1fr_0.9fr_auto] gap-2 sm:gap-2.5 items-center">
              
              {/* 1. Search Symptoms / Department / Doctor (Made Bigger) */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 focus-within:border-white/40 focus-within:bg-white/20 transition">
                <Search className="size-4 text-white/80 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] uppercase font-semibold tracking-wider text-white/60 leading-none mb-1">
                    Search
                  </div>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Symptoms, department, doctor..."
                    className="w-full bg-transparent text-xs sm:text-sm font-medium text-white placeholder-white/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* 2. Location Selector */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 focus-within:border-white/40 focus-within:bg-white/20 transition">
                <MapPin className="size-3.5 text-white/80 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] uppercase font-semibold tracking-wider text-white/60 leading-none mb-0.5">
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
                  <div className="text-[9px] uppercase font-semibold tracking-wider text-white/60 leading-none mb-0.5">
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

        {/* ── POPULAR SPECIALTY PILLS ROW (Kept Below Search Bar as Requested) ── */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 max-w-4xl">
          {POPULAR_SPECIALTIES.map((spec) => {
            const Icon = SPECIALTY_ICON_MAP[spec.id] || Stethoscope;
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => onOpenQuestionnaire(spec.id)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white hover:bg-[#eef7f2] border border-neutral-200/90 text-xs sm:text-[13px] font-semibold text-neutral-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer hover:border-[#154734]/30 hover:text-[#154734] active:scale-95"
              >
                <Icon className="size-3.5 text-[#154734] stroke-[2]" />
                <span>{spec.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
