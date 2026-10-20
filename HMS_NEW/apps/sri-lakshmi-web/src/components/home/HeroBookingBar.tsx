import React, { useState } from 'react';
import { branches } from '../../data/branches';
import { MapPin, Calendar, User, Search, Stethoscope, Baby, Smile, Heart, Activity } from 'lucide-react';

interface HeroBookingBarProps {
  onSearch?: (details: {
    specialty: string;
    location: string;
    date: string;
    patientType: string;
  }) => void;
  className?: string;
}

const specialties = [
  { id: 'general', label: 'General', icon: Activity },
  { id: 'pediatric', label: 'Pediatric', icon: Baby },
  { id: 'dentist', label: 'Dentist', icon: Smile },
  { id: 'ent', label: 'ENT Specialist', icon: Stethoscope },
  { id: 'cardiology', label: 'Cardiology', icon: Heart },
];

export const HeroBookingBar: React.FC<HeroBookingBarProps> = ({ onSearch, className = '' }) => {
  const [selectedSpecialty, setSelectedSpecialty] = useState('general');
  const [location, setLocation] = useState('KR Puram, Bengaluru');
  const [date, setDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [patientType, setPatientType] = useState('1 Adult');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.({
      specialty: selectedSpecialty,
      location,
      date,
      patientType,
    });
  };

  return (
    <div
      className={`w-full max-w-[760px] backdrop-blur-xl bg-black/35 border border-white/20 shadow-2xl rounded-2xl p-3 sm:p-4 text-white [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_Arial,_sans-serif] ${className}`}
    >
      <form onSubmit={handleSearchSubmit}>
        {/* ── Top Row: Title + Clean Monochrome Tabs ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-white/10">
          {/* Title in clean white */}
          <span className="font-semibold text-xs sm:text-[13px] text-white/90 tracking-tight flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Book Appointment Now
          </span>

          {/* Specialty Tabs (Clean white glass styling) */}
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5">
            {specialties.map((spec) => {
              const Icon = spec.icon;
              const isActive = selectedSpecialty === spec.id;
              return (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => setSelectedSpecialty(spec.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-white text-[#154734] font-semibold shadow-xs'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className={`size-3 ${isActive ? 'text-[#154734]' : 'text-white/60'}`} />
                  <span>{spec.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Bottom Row: 3 Glass Inputs + Search CTA ── */}
        <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_1fr_auto] gap-2 pt-2.5 items-center">
          
          {/* 1. Location Selector (Plain White Icon on Glass) */}
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
                {branches.map((b) => {
                  const label = b.virtual ? 'Online Video (Telehealth)' : `${b.area}, Bengaluru`;
                  return (
                    <option key={b.id} value={label} className="bg-[#12231b] text-white">{label}</option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* 2. Appointment Date Picker */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 focus-within:border-white/40 focus-within:bg-white/20 transition">
            <Calendar className="size-3.5 text-white/80 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] uppercase font-semibold tracking-wider text-white/60 leading-none mb-0.5">
                Date
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Appointment Date"
                className="w-full bg-transparent text-xs font-medium text-white focus:outline-none cursor-pointer [color-scheme:dark]"
              />
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
            className="w-full sm:w-auto h-full min-h-[40px] bg-white hover:bg-white/90 active:scale-95 text-[#154734] font-semibold text-xs sm:text-[13px] px-5 py-2.5 rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <Search className="size-3.5 text-[#154734]" />
            <span>Search</span>
          </button>

        </div>
      </form>
    </div>
  );
};
