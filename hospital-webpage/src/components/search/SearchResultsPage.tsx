import React, { useState, useMemo } from 'react';
import { Breadcrumbs } from '../common/Breadcrumbs';
import {
  ChevronRight,
  Search,
  Sparkles,
  Shield,
  MapPin,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  Calendar,
  Map,
  Video,
  X,
  CheckCircle2,
  Star,
  Award,
  GraduationCap,
  Building2,
  ZoomIn,
} from 'lucide-react';
import { doctors } from '../../data/doctors';
import { branches, physicalBranches } from '../../data/branches';
import { hospitalInfo } from '../../data/hospitalInfo';
import { Doctor } from '../../types';
import { INSURANCE_PROVIDERS, CLINIC_LOCATIONS } from '../ai/aiTriageData';
import { format, addDays } from 'date-fns';
import { DoctorScheduleProfile } from '../booking/ScheduleAppointmentPage';

// Booking profiles are derived from the shared roster (data/doctors.ts) so search, profile and schedule
// always show the same doctor as the homepage. Hand-written copy per doctor lives in PROFILE_EXTRAS.
const DEMO_DATES = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'];

const FACILITY_PHOTOS = [
  { url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=800', title: 'Clinic Reception & Check-in' },
  { url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=800', title: 'Consultation & Examination Room' },
  { url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800', title: 'Diagnostics & Procedure Suite' },
];

const PROFILE_EXTRAS: Record<string, Partial<DoctorScheduleProfile>> = {
  'doc-1': {
    bedsideManner: 'Calm, reassuring communicator who takes time to diagram cardiac anatomy and demystify surgical and non-surgical options for patients and their families.',
    decisionChips: ['< 15 min wait time', 'Advanced cath lab on-site', 'Emergency direct team access', 'Speaks English, Hindi & Telugu'],
    nicheExpertise: 'Complex coronary angioplasty, radial catheterization, preventive cardiology & heart failure surveillance',
    clinicalInterests: ['Interventional Cardiology', 'Coronary Angioplasty', 'Structural Heart Health'],
  },
  'doc-2': {
    bedsideManner: 'Warm and attentive clinician focused on whole-person preventive health and sustainable lifestyle changes rather than quick prescription fixes.',
    decisionChips: ['< 10 min wait time', 'Metabolic & heart focus', 'Direct patient messaging portal', 'Speaks English & Hindi'],
    nicheExpertise: 'Cardiometabolic risk assessments, hypertension management, preventive executive wellness exams',
    clinicalInterests: ['Preventive Care', 'Metabolic Health', 'Executive Health Exams'],
  },
  'doc-4': {
    bedsideManner: 'Highly compassionate, attentive practitioner who builds lifelong trust with patients. Takes ample time during prenatal consults to explain each phase of maternity care.',
    decisionChips: ['< 10 min wait time', 'Private birth suites', 'High-risk OB certified', 'Speaks English, Hindi & Marathi'],
    nicheExpertise: 'High-risk pregnancy surveillance, complex PCOS management, minimally invasive laparoscopy',
    clinicalInterests: ["Women's Health", 'Prenatal Care', 'Minimally Invasive Gynecologic Surgery'],
  },
  'doc-6': {
    bedsideManner: 'Unhurried and judgment-free — patients note he explains the cause of every flare and leaves them with a clear, simple routine.',
    decisionChips: ['< 10 min wait time', 'Laser suite on-site', 'Comprehensive patch testing', 'Speaks English, Malayalam & Kannada'],
    nicheExpertise: 'Stubborn acne & acne scarring, eczema and psoriasis flares, pigmentation & contact allergy patch panels',
    clinicalInterests: ['Acne & Scarring', 'Eczema & Psoriasis', 'Pigmentation', 'Laser Dermatology'],
  },
  'doc-8': {
    bedsideManner: 'Beloved by toddlers and adolescents alike for his fun, gentle exam style. Parents appreciate his prompt follow-ups and patient answers to new-parent concerns.',
    decisionChips: ['< 5 min wait time', 'Same-day sick child visits', 'Direct pediatrician SMS', 'Speaks English & Gujarati'],
    nicheExpertise: 'Childhood asthma action plans, infant developmental milestones, pediatric allergy care',
    clinicalInterests: ['General Pediatrics', 'Childhood Asthma', 'Developmental Milestones'],
  },
};

function toProfile(d: Doctor): DoctorScheduleProfile {
  const branch = branches.find((b) => d.roomNumber.includes(b.name));
  // demo calendar: the doctor's usual slots on the days they consult
  const availableSlots = Object.fromEntries(
    DEMO_DATES.map((iso) => {
      const day = format(new Date(`${iso}T00:00:00`), 'EEE');
      return [iso, d.availableDays.includes(day) ? d.timeSlots : []];
    })
  );
  const firstOpen = DEMO_DATES.find((iso) => availableSlots[iso].length > 0);
  return {
    id: d.id,
    name: d.name,
    credentials: d.qualifications[0].replace(/\s*\(.*?\)/g, ''),
    specialty: d.title,
    photo: d.image.replace('w=600', 'w=800'),
    rating: d.rating,
    reviewCount: d.reviewCount,
    boardCertified: d.qualifications.slice(1).join(' • ') || d.qualifications[0],
    pedigree: `${d.qualifications[0]} • ${d.experienceYears}+ Yrs Clinical Practice`,
    hospitalAffiliation: `${hospitalInfo.shortName} • ${d.departmentName}`,
    practiceName: branch?.name ?? hospitalInfo.shortName,
    addressLine1: d.roomNumber.split(',')[0],
    addressLine2: `${branch?.area ?? 'Indiranagar'}, Bengaluru`,
    phone: hospitalInfo.phone,
    offersVideo: d.acceptsVirtual,
    nextVisitText: firstOpen ? format(new Date(`${firstOpen}T00:00:00`), 'EEE MMM d') : undefined,
    availableSlots,
    bio: d.bio,
    education: d.qualifications,
    clinicalInterests: [d.departmentName],
    facilityPhotos: FACILITY_PHOTOS,
    ...PROFILE_EXTRAS[d.id],
  };
}

export const DOCTOR_PROFILES: DoctorScheduleProfile[] = doctors.map(toProfile);

export interface SearchResultsPageProps {
  careType: string;
  specialtyId?: string;
  dateTime?: string;
  initialQuery?: string;
  onBackToHome: () => void;
  onRetakeQuestionnaire: () => void;
  onBookDoctor: (doctorId: string, prefillReason?: string, prefillDate?: string, prefillSlot?: string) => void;
  onScheduleDoctor?: (doctorId: string, step: 1 | 2, prefillDate?: string, prefillSlot?: string) => void;
  onSelectDoctorDetail?: (doctorId: string) => void;
  onOpenBooking: () => void;
  onOpenLogin: () => void;
  user: { name: string; identifier: string } | null;
}

export const SearchResultsPage: React.FC<SearchResultsPageProps> = ({
  careType,
  specialtyId,
  initialQuery = '',
  onBackToHome,
  onRetakeQuestionnaire,
  onBookDoctor,
  onScheduleDoctor,
  onSelectDoctorDetail,
  onOpenBooking,
}) => {
  // Search header state matching 1:1 reference
  const [searchQuery, setSearchQuery] = useState(initialQuery || careType || 'Pediatric Dermatology');
  const [selectedInsurance, setSelectedInsurance] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(CLINIC_LOCATIONS[0]);

  // Filter dropdown state
  const [selectedDistance, setSelectedDistance] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [selectedTreatment, setSelectedTreatment] = useState('All');
  const [selectedAge, setSelectedAge] = useState('All Ages');
  const [selectedGender, setSelectedGender] = useState('No preference');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [sortBy, setSortBy] = useState<'next-available' | 'highest-rated' | 'experience'>('next-available');

  // Toggles
  const [showMap, setShowMap] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);

  // 5-day appointment date window (starts Fri Oct 30 - Tue Nov 03 matching reference 1:1)
  const [dateOffset, setDateOffset] = useState(0);

  const baseDate = useMemo(() => {
    // 2026-10-30 = Fri Oct 30
    const initialRefDate = new Date(2026, 9, 30);
    return addDays(initialRefDate, dateOffset);
  }, [dateOffset]);

  const fiveDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = addDays(baseDate, i);
      return {
        dateObj: d,
        dayName: format(d, 'EEE'),
        monthDay: format(d, 'MMM dd'),
        formatted: format(d, 'yyyy-MM-dd'),
      };
    });
  }, [baseDate]);

  const dateRangeDisplay = useMemo(() => {
    if (fiveDays.length === 0) return '';
    return `${fiveDays[0].dayName} ${fiveDays[0].monthDay} - ${fiveDays[4].dayName} ${fiveDays[4].monthDay}`;
  }, [fiveDays]);

  // Selected doctor for detailed photo/profile modal
  const [selectedDoctorDetail, setSelectedDoctorDetail] = useState<typeof DOCTOR_PROFILES[0] | null>(null);

  // 7 Providers matching the 1:1 reference
  const matchedDoctors = useMemo(() => {
    let list = [...doctors];
    const q = searchQuery.toLowerCase().trim();

    if (q && q !== 'all' && q !== 'pediatric dermatology') {
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.departmentName.toLowerCase().includes(q) ||
          d.bio.toLowerCase().includes(q)
      );
    }

    if (specialtyId && (!q || q.length < 3)) {
      const direct = doctors.filter((d) => d.departmentId === specialtyId);
      if (direct.length > 0) list = direct;
    }

    // Gender filter
    if (selectedGender !== 'No preference') {
      if (selectedGender === 'Female') {
        list = list.filter((d) => d.name.includes('Dr. Ananya') || d.name.includes('Dr. Priya') || d.name.includes('Dr. Kavya') || d.name.includes('Dr. Meera'));
      } else if (selectedGender === 'Male') {
        list = list.filter((d) => !d.name.includes('Dr. Ananya') && !d.name.includes('Dr. Priya') && !d.name.includes('Dr. Kavya') && !d.name.includes('Dr. Meera'));
      }
    }

    // Sort order
    if (sortBy === 'highest-rated') {
      list.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'experience') {
      list.sort((a, b) => b.experienceYears - a.experienceYears);
    }

    return list.length > 0 ? list : doctors;
  }, [searchQuery, specialtyId, selectedGender, sortBy]);

  return (
    <div className="bg-[#fcfbf9] text-[#121212] flex flex-col font-sans">

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <Breadcrumbs items={[{ label: 'Home', onClick: onBackToHome }, { label: 'Find a Doctor' }]}>
          <button
            type="button"
            onClick={onRetakeQuestionnaire}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#154734]/25 bg-white hover:bg-[#eef7f2] text-[#154734] text-xs sm:text-sm font-semibold transition cursor-pointer active:scale-95"
          >
            <Sparkles className="size-3.5" />
            <span>Ask AI</span>
          </button>
        </Breadcrumbs>
      </div>

      {/* ── HERO SEARCH & FILTER BANNER (1:1 Indigo-Blue / Purple Theme) ── */}
      <section className="relative bg-gradient-to-r from-[#12231b] via-[#0f3426] to-[#12231b] text-white pt-8 sm:pt-9 pb-6 sm:pb-7 px-4 sm:px-6 lg:px-8 shadow-md">
        <div className="relative z-10 w-full max-w-7xl mx-auto space-y-4">
          {/* Main Title */}
          <h1 className="text-3xl sm:text-[34px] font-bold tracking-tight text-white">
            Find a Doctor
          </h1>

          {/* 3-Column Search Bar + Turquoise Button (Matching media_1790069031583.png 1:1) */}
          <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3">
            {/* Unified 3-Input Container */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[1.3fr_1.1fr_1.1fr] bg-white rounded-md divide-y md:divide-y-0 md:divide-x divide-stone-200 shadow-sm border border-white/20 overflow-hidden">
              
              {/* Field 1: Provider, specialty, condition */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white min-w-0">
                <Search className="size-4 text-[#154734] shrink-0 pointer-events-none" />
                <input
                  id="doctor-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pediatric Dermatology"
                  className="w-full bg-transparent text-sm text-stone-900 font-medium placeholder-stone-400 focus:outline-none min-w-0"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-stone-400 hover:text-stone-700 p-0.5 rounded-full hover:bg-stone-100 transition cursor-pointer shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Field 2: Insurance company & plan */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white min-w-0">
                <Shield className="size-4 text-[#154734] fill-[#154734] shrink-0 pointer-events-none" />
                <select
                  value={selectedInsurance}
                  onChange={(e) => setSelectedInsurance(e.target.value)}
                  className="w-full bg-transparent text-sm text-stone-900 font-medium focus:outline-none cursor-pointer truncate min-w-0"
                >
                  <option value="">Insurance company &amp; plan</option>
                  {INSURANCE_PROVIDERS.map((ins) => (
                    <option key={ins} value={ins}>
                      {ins}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 3: Branch */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white min-w-0">
                <MapPin className="size-4 text-[#154734] fill-[#154734] shrink-0 pointer-events-none" />
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full bg-transparent text-sm text-stone-900 font-medium focus:outline-none cursor-pointer truncate min-w-0"
                >
                  {CLINIC_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Glowing Turquoise Search Button (1:1 match) */}
            <button
              type="button"
              onClick={() => {}}
              className="h-[44px] bg-[#4efcd3] hover:bg-[#3af0c4] active:scale-95 text-stone-950 font-bold text-sm sm:text-base px-9 rounded-md shadow-sm transition-all cursor-pointer flex items-center justify-center shrink-0"
            >
              Search
            </button>
          </div>

          {/* Filters Row with Dark Indigo Glass Dropdown Pills */}
          <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-white flex items-center gap-1.5 mr-1 text-sm">
              <SlidersHorizontal className="size-4 stroke-[2.5]" />
              <span>Filters</span>
            </span>

            {/* Distance */}
            <div className="relative">
              <select
                value={selectedDistance}
                onChange={(e) => setSelectedDistance(e.target.value)}
                className="appearance-none bg-[#12231b]/60 hover:bg-[#12231b]/90 border border-white/30 rounded-full pl-3.5 pr-7 py-1.5 text-white font-medium cursor-pointer focus:outline-none transition"
              >
                <option value="All" className="bg-[#12231b] text-white">Distance: Any</option>
                <option value="5" className="bg-[#12231b] text-white">Distance: 5 miles</option>
                <option value="10" className="bg-[#12231b] text-white">Distance: 10 miles</option>
                <option value="25" className="bg-[#12231b] text-white">Distance: 25 miles</option>
              </select>
              <ChevronDown className="size-3 text-white/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Condition */}
            <div className="relative">
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="appearance-none bg-[#12231b]/60 hover:bg-[#12231b]/90 border border-white/30 rounded-full pl-3.5 pr-7 py-1.5 text-white font-medium cursor-pointer focus:outline-none transition"
              >
                <option value="All" className="bg-[#12231b] text-white">Condition: Any</option>
                <option value="skin" className="bg-[#12231b] text-white">Condition: Pediatric Dermatology</option>
                <option value="hair" className="bg-[#12231b] text-white">Condition: Hair Loss</option>
                <option value="acne" className="bg-[#12231b] text-white">Condition: Eczema &amp; Acne</option>
              </select>
              <ChevronDown className="size-3 text-white/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Treatment */}
            <div className="relative">
              <select
                value={selectedTreatment}
                onChange={(e) => setSelectedTreatment(e.target.value)}
                className="appearance-none bg-[#12231b]/60 hover:bg-[#12231b]/90 border border-white/30 rounded-full pl-3.5 pr-7 py-1.5 text-white font-medium cursor-pointer focus:outline-none transition"
              >
                <option value="All" className="bg-[#12231b] text-white">Treatment: Any</option>
                <option value="consult" className="bg-[#12231b] text-white">Treatment: Consultation</option>
                <option value="procedure" className="bg-[#12231b] text-white">Treatment: Laser Therapy</option>
                <option value="biopsy" className="bg-[#12231b] text-white">Treatment: Skin Biopsy</option>
              </select>
              <ChevronDown className="size-3 text-white/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Treats ages */}
            <div className="relative">
              <select
                value={selectedAge}
                onChange={(e) => setSelectedAge(e.target.value)}
                className="appearance-none bg-[#12231b]/60 hover:bg-[#12231b]/90 border border-white/30 rounded-full pl-3.5 pr-7 py-1.5 text-white font-medium cursor-pointer focus:outline-none transition"
              >
                <option value="All Ages" className="bg-[#12231b] text-white">Treats ages: All Ages</option>
                <option value="Pediatrics" className="bg-[#12231b] text-white">Treats ages: Pediatrics (0-17)</option>
                <option value="Adults" className="bg-[#12231b] text-white">Treats ages: Adults (18+)</option>
                <option value="Seniors" className="bg-[#12231b] text-white">Treats ages: Seniors (65+)</option>
              </select>
              <ChevronDown className="size-3 text-white/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Provider Gender */}
            <div className="relative">
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="appearance-none bg-[#12231b]/60 hover:bg-[#12231b]/90 border border-white/30 rounded-full pl-3.5 pr-7 py-1.5 text-white font-medium cursor-pointer focus:outline-none transition"
              >
                <option value="No preference" className="bg-[#12231b] text-white">Provider Gender: No preference</option>
                <option value="Female" className="bg-[#12231b] text-white">Female Providers</option>
                <option value="Male" className="bg-[#12231b] text-white">Male Providers</option>
              </select>
              <ChevronDown className="size-3 text-white/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Provider Language */}
            <div className="relative">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="appearance-none bg-[#12231b]/60 hover:bg-[#12231b]/90 border border-white/30 rounded-full pl-3.5 pr-7 py-1.5 text-white font-medium cursor-pointer focus:outline-none transition"
              >
                <option value="English" className="bg-[#12231b] text-white">Provider Language: English</option>
                <option value="Spanish" className="bg-[#12231b] text-white">Provider Language: Spanish</option>
                <option value="Hindi" className="bg-[#12231b] text-white">Provider Language: Hindi</option>
                <option value="Kannada" className="bg-[#12231b] text-white">Provider Language: Kannada</option>
              </select>
              <ChevronDown className="size-3 text-white/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* ── RESULTS SUB-HEADER / CONTROL BAR (1:1 with media_1790069031583.png) ── */}
      <section className="bg-white border-b border-stone-200 py-3 px-4 sm:px-6 lg:px-8 sticky top-16 z-30">
        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
          {/* Left: provider count & Sort By Pill Dropdown */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <span className="font-semibold text-stone-800">
              1–{matchedDoctors.length} of <strong className="font-bold text-stone-950">{matchedDoctors.length} Providers</strong>
            </span>

            <div className="h-4 w-px bg-stone-200" />

            {/* Sort By Pill Dropdown  */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-white hover:bg-stone-50 border border-[#154734] text-[#154734] font-bold rounded-full pl-3.5 pr-7 py-1 text-xs cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="next-available">Sort By: Next available</option>
                <option value="highest-rated">Sort By: Highest rated</option>
                <option value="experience">Sort By: Experience</option>
              </select>
              <ChevronDown className="size-3 text-[#154734] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Right: Date navigation + Show Month + Show Map */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
            {/* Date range header with < and > circular purple buttons */}
            <div className="flex items-center gap-1.5 font-medium text-stone-700">
              <span>Show visits on:</span>
              <strong className="text-stone-950 font-bold">{dateRangeDisplay}</strong>
              <div className="flex items-center gap-1 ml-1">
                <button
                  type="button"
                  onClick={() => setDateOffset((prev) => prev - 5)}
                  className="size-6 rounded-full bg-[#154734] hover:bg-[#0f3426] text-white flex items-center justify-center transition cursor-pointer shadow-xs"
                  title="Previous 5 days"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDateOffset((prev) => prev + 5)}
                  className="size-6 rounded-full bg-[#154734] hover:bg-[#0f3426] text-white flex items-center justify-center transition cursor-pointer shadow-xs"
                  title="Next 5 days"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Show Month Button (Purple Border) */}
            <button
              type="button"
              onClick={() => setShowMonthModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[#154734] bg-white hover:bg-[#154734]/5 text-[#154734] font-bold text-xs transition cursor-pointer shadow-2xs"
            >
              <Calendar className="size-3.5 text-[#154734]" />
              <span>Show month</span>
            </button>

            {/* Show Map Button (Purple Border) */}
            <button
              type="button"
              onClick={() => setShowMap(!showMap)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[#154734] text-xs font-bold shadow-2xs transition cursor-pointer ${
                showMap
                  ? 'bg-[#154734] text-white'
                  : 'bg-white hover:bg-[#154734]/5 text-[#154734]'
              }`}
            >
              <Map className={`size-3.5 ${showMap ? 'text-white' : 'text-[#154734]'}`} />
              <span>{showMap ? 'Hide map' : 'Show map'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── EXPANDABLE MAP DRAWER ── */}
      {showMap && (
        <section className="bg-stone-50 border-b border-stone-300 py-6 px-4 sm:px-6 lg:px-8 animate-fadeIn">
          <div className="w-full max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <MapPin className="size-4 text-[#154734]" />
                <span>Avocado Health Clinics</span>
              </h3>
              <span className="text-xs text-stone-500">Bengaluru branches &amp; virtual care</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {physicalBranches.map((b) => (
                <div key={b.id} className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-1.5">
                  <div className="font-bold text-sm text-stone-900">{b.name}</div>
                  <div className="text-xs text-stone-500 leading-relaxed">{b.area}, Bengaluru</div>
                  <div className="text-[11px] font-semibold text-[#154734] pt-1">
                    OPD: 8:00 AM - 6:00 PM
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── DOCTOR LISTINGS (Matching media_1790069042700.png 1:1) ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-10">
          {matchedDoctors.map((doc, index) => {
            const isFirst = index === 0;
            const profile = DOCTOR_PROFILES.find((p) => p.id === doc.id) ?? DOCTOR_PROFILES[0];
            const docName = profile.name;
            const docSpecialty = profile.specialty;
            const nextVisitText = profile.nextVisitText;
            // Most doctors will have direct slots in the 5-day grid; doctor index 4 displays the "Check for availability" button
            const hasDirectSlots = Boolean(
              profile.availableSlots &&
              Object.values(profile.availableSlots).some((arr) => arr.length > 0) &&
              index !== 4
            );

            // Reusable Doctor Info Card (Matching 1:1 Reference media_1790069042700.png)
            const doctorInfoCard = (
              <div className="flex items-start gap-5 flex-1 min-w-0">
                {/* Large Doctor Image Container with Badges */}
                <div
                  onClick={() =>
                    onSelectDoctorDetail
                      ? onSelectDoctorDetail(profile.id)
                      : setSelectedDoctorDetail(profile)
                  }
                  className="relative w-32 sm:w-36 md:w-40 aspect-[3/4] rounded-xl overflow-hidden shadow-sm border border-stone-200 bg-stone-100 group/img cursor-pointer shrink-0"
                  title="Click to view full doctor profile"
                >
                  <img
                    src={profile.photo}
                    alt={profile.name}
                    onError={(e) => {
                      e.currentTarget.src =
                        'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=800';
                    }}
                    className="w-full h-full object-cover object-top group-hover/img:scale-105 transition-transform duration-300"
                  />

                  {/* Top Rating Overlay */}
                  <div className="absolute top-2 right-2 bg-stone-900/80 backdrop-blur-xs text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5 shadow-xs z-10">
                    <Star className="size-2.5 fill-amber-400 text-amber-400" />
                    <span>{profile.rating}</span>
                  </div>

                  {/* Bottom Board Certified Gradient Banner */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#12231b] via-[#12231b]/80 to-transparent pt-4 pb-1.5 px-1 text-center z-10">
                    <span className="text-[10px] font-bold tracking-wider text-white uppercase line-clamp-1">
                      Board Certified
                    </span>
                  </div>

                  {/* Hover Zoom Prompt */}
                  <div className="absolute inset-0 bg-[#12231b]/35 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center z-20">
                    <span className="bg-white text-[#154734] text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                      <ZoomIn className="size-3" />
                      <span>View Profile</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 min-w-0 flex-1">
                  {/* Name with arrow */}
                  <button
                    type="button"
                    onClick={() =>
                      onSelectDoctorDetail
                        ? onSelectDoctorDetail(profile.id)
                        : setSelectedDoctorDetail(profile)
                    }
                    className="group text-left cursor-pointer"
                  >
                    <h2 className="text-xl font-bold text-stone-950 group-hover:text-[#154734] transition-colors inline-flex items-center gap-1.5">
                      <span>{docName}</span>
                      <span className="text-[#154734] group-hover:translate-x-1 transition-transform">→</span>
                    </h2>
                  </button>

                  {/* Specialty & Pedigree Banner */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
                    <span className="font-bold text-[#12231b]">{docSpecialty}</span>
                    <span className="text-stone-300">•</span>
                    <span className="text-stone-600 font-medium">{profile.pedigree}</span>
                  </div>


                  {/* Clinical Focus / Niche Expertise */}
                  <div className="text-xs text-stone-600 pt-0.5 leading-normal">
                    <span className="font-bold text-stone-900">Clinical Focus: </span>
                    <span>{profile.nicheExpertise}</span>
                  </div>

                  {/* Offers Video Visits */}
                  {profile.offersVideo && (
                    <div className="pt-0.5 flex items-center gap-1.5 text-xs font-semibold text-[#154734]">
                      <Video className="size-3.5 text-[#154734] shrink-0" />
                      <span>Offers Video Visits &amp; Remote Follow-ups</span>
                    </div>
                  )}
                </div>
              </div>
            );

            // 5-Day Interactive Appointment Slot Matrix (4 rows of level, pixel-perfect rectangles)
            const fiveDaySlotMatrix = (
              <div className="w-full lg:w-[320px] xl:w-[340px] shrink-0">
                <div className="bg-[#f4f3f8] text-stone-700 text-xs font-semibold px-3 py-1 rounded inline-block mb-2.5">
                  New Patient Office Visit
                </div>

                {/* 5 Column Date Headers */}
                <div className="grid grid-cols-5 gap-1 text-center mb-2.5">
                  {fiveDays.map((col) => (
                    <div key={col.formatted} className="space-y-0.5">
                      <div className="text-xs font-bold text-stone-950">{col.dayName}</div>
                      <div className="text-[10px] text-stone-500 font-normal">{col.monthDay}</div>
                    </div>
                  ))}
                </div>

                {/* 5 Column Slots Matrix - Level, Perfectly Aligned Rectangles (>3 slots supported!) */}
                <div className="grid grid-cols-5 gap-1.5">
                  {fiveDays.map((col) => {
                    const slots = profile.availableSlots?.[col.formatted] || [];
                    return (
                      <div key={col.formatted} className="space-y-1.5">
                        {[0, 1, 2, 3].map((rowIndex) => {
                          const slot = slots[rowIndex];
                          if (slot) {
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => {
                                  if (onScheduleDoctor) {
                                    onScheduleDoctor(profile.id, 2, col.formatted, slot);
                                  } else {
                                    onBookDoctor(profile.id, 'New Patient Office Visit', col.formatted, slot);
                                  }
                                }}
                                className="h-8 w-full bg-[#154734] hover:bg-[#0f3426] active:scale-95 text-white font-semibold text-[11px] rounded-[3px] transition cursor-pointer flex items-center justify-center leading-none shadow-2xs"
                              >
                                {slot}
                              </button>
                            );
                          }
                          return (
                            <div key={`empty-${rowIndex}`} className="h-8 w-full bg-[#eef7f2] rounded-[3px]" />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* View all availability link -> lands at Step 1 */}
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (onScheduleDoctor) {
                        onScheduleDoctor(profile.id, 1, fiveDays[0].formatted);
                      } else {
                        onBookDoctor(profile.id, `Consultation with ${docName}`);
                      }
                    }}
                    className="font-bold text-xs text-[#154734] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View all availability</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            );

            return (
              <div key={doc.id} className="border-b border-stone-200 pb-10 last:border-b-0">
                {isFirst ? (
                  /* ══════════════════════════════════════════════════════════════
                     DOCTOR 1: 3-COLUMN LAYOUT WITH INLINE SLOTS & VIDEO CARD
                     ══════════════════════════════════════════════════════════════ */
                  <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_auto_280px] gap-6 xl:gap-8 items-start">
                    {doctorInfoCard}
                    {fiveDaySlotMatrix}

                    {/* Column 3: Video Visits are Available Card */}
                    <div className="w-full bg-white rounded-md border border-stone-200 shadow-2xs overflow-hidden">
                      <div className="h-1 w-full bg-gradient-to-r from-[#8b5cf6] via-[#6366f1] to-[#06b6d4]" />
                      <div className="p-4 sm:p-5 space-y-3">
                        <div className="text-[#154734]">
                          <Video className="size-7 stroke-[2.2]" />
                        </div>
                        <h3 className="font-bold text-base text-stone-900 leading-snug">
                          Video Visits are Available
                        </h3>
                        <p className="text-xs text-stone-600 leading-relaxed font-normal">
                          Many of our doctors offer video visits. Select the doctor&apos;s name to schedule an appointment online.
                        </p>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={onOpenBooking}
                            className="w-full bg-[#154734] hover:bg-[#0f3426] active:scale-95 text-white font-bold text-xs py-2.5 px-3 rounded-full transition shadow-xs flex items-center justify-center gap-1"
                          >
                            <span>Learn more about video visits</span>
                            <span>→</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : hasDirectSlots ? (
                  /* ══════════════════════════════════════════════════════════════
                     DOCTORS WITH AVAILABILITY: 2-COLUMN LAYOUT WITH 5-DAY MATRIX
                     ══════════════════════════════════════════════════════════════ */
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 xl:gap-8 items-start">
                    {doctorInfoCard}
                    {fiveDaySlotMatrix}
                  </div>
                ) : (
                  /* ══════════════════════════════════════════════════════════════
                     DOCTOR WITHOUT IMMEDIATE SLOTS: CHECK FOR AVAILABILITY CTA
                     ══════════════════════════════════════════════════════════════ */
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    {doctorInfoCard}

                    {/* Right: Next New Patient Visit + Check for availability Button -> lands at Step 1 */}
                    <div className="flex flex-col items-start lg:items-end justify-center space-y-2.5 min-w-[240px]">
                      <div className="text-xs sm:text-sm text-stone-700">
                        Next New Patient Office Visit:{' '}
                        <strong className="text-stone-950 font-bold">{nextVisitText}</strong>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (onScheduleDoctor) {
                            onScheduleDoctor(profile.id, 1);
                          } else {
                            onBookDoctor(profile.id, `Consultation with ${docName}`);
                          }
                        }}
                        className="w-full sm:w-auto bg-[#154734] hover:bg-[#0f3426] active:scale-95 text-white font-bold text-xs sm:text-sm px-8 py-3 rounded-full shadow-xs transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                      >
                        <span>Check for availability</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* ── DETAILED DOCTOR PROFILE & CLINIC FACILITY GALLERY MODAL ── */}
      {selectedDoctorDetail && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-stone-200 flex items-center justify-between z-20">
              <div>
                <span className="text-[11px] font-bold tracking-wider text-[#154734] uppercase">
                  Doctor Profile &amp; Clinical Information
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-stone-900 leading-snug">
                  {selectedDoctorDetail.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoctorDetail(null)}
                className="p-1.5 rounded-full hover:bg-stone-100 transition cursor-pointer text-stone-500 hover:text-stone-800"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Doctor Headshot + Quick Stats */}
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                {/* Large Crisp High-Res Image */}
                <div className="w-full sm:w-48 aspect-[3/4] rounded-xl overflow-hidden border border-stone-200 shadow-md shrink-0 relative bg-stone-100">
                  <img
                    src={selectedDoctorDetail.photo}
                    alt={selectedDoctorDetail.name}
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute top-2 right-2 bg-stone-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    <span>{selectedDoctorDetail.rating}</span>
                  </div>
                </div>

                {/* Doctor Bio & Key Credentials */}
                <div className="space-y-3 flex-1 min-w-0">
                  <div>
                    <div className="text-sm font-semibold text-stone-500">
                      {selectedDoctorDetail.specialty}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#154734] mt-1">
                      <CheckCircle2 className="size-4 fill-[#154734] text-white" />
                      <span>{selectedDoctorDetail.hospitalAffiliation}</span>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eef7f2] border border-[#154734]/20 text-[#154734] text-xs font-semibold">
                    <Award className="size-3.5 text-[#154734]" />
                    <span>{selectedDoctorDetail.boardCertified}</span>
                  </div>


                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed pt-1">
                    {selectedDoctorDetail.bio}
                  </p>

                  {/* Clinical Interests Tags */}
                  <div className="pt-1">
                    <div className="text-xs font-bold text-stone-800 mb-1.5">Clinical Specializations &amp; Focus:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDoctorDetail.clinicalInterests?.map((interest, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-700 text-xs font-medium"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Education & Training */}
              <div className="border-t border-stone-200 pt-5 space-y-2">
                <h4 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <GraduationCap className="size-4 text-[#154734]" />
                  <span>Education, Residencies &amp; Fellowships</span>
                </h4>
                <ul className="space-y-1.5 pl-6 list-disc text-xs text-stone-600">
                  {selectedDoctorDetail.education?.map((edu, idx) => (
                    <li key={idx} className="leading-normal">{edu}</li>
                  ))}
                </ul>
              </div>

              {/* Facility & Clinic Photos Gallery */}
              {selectedDoctorDetail.facilityPhotos && selectedDoctorDetail.facilityPhotos.length > 0 && (
                <div className="border-t border-stone-200 pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                      <Building2 className="size-4 text-[#154734]" />
                      <span>Practice Location &amp; Clinical Facility</span>
                    </h4>
                    <span className="text-xs text-stone-500 font-medium">
                      {selectedDoctorDetail.practiceName}
                    </span>
                  </div>

                  <div className="text-xs text-stone-600">
                    {selectedDoctorDetail.addressLine1}, {selectedDoctorDetail.addressLine2} • Tel: {selectedDoctorDetail.phone}
                  </div>

                  {/* Facility Photos Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                    {selectedDoctorDetail.facilityPhotos.map((fp, idx) => (
                      <div key={idx} className="space-y-1 group">
                        <div className="aspect-[4/3] rounded-lg overflow-hidden border border-stone-200 bg-stone-100 shadow-2xs">
                          <img
                            src={fp.url}
                            alt={fp.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="text-[11px] font-medium text-stone-700 leading-tight">
                          {fp.title}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Action Footer */}
            <div className="sticky bottom-0 bg-stone-50 px-6 py-4 border-t border-stone-200 flex items-center justify-between gap-3">
              <div className="text-xs text-stone-600 hidden sm:block">
                Next available: <strong>{selectedDoctorDetail.nextVisitText}</strong>
              </div>
              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={() => setSelectedDoctorDetail(null)}
                  className="px-4 py-2 rounded-md border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-100 transition cursor-pointer"
                >
                  Close
                </button>
                {onSelectDoctorDetail && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedDoctorDetail.id;
                      setSelectedDoctorDetail(null);
                      onSelectDoctorDetail(id);
                    }}
                    className="px-4 py-2 rounded-md border border-[#154734]/20 text-[#154734] bg-[#eef7f2] hover:bg-[#dcefe4] text-xs font-bold transition cursor-pointer"
                  >
                    View Full Profile →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const docId = selectedDoctorDetail.id;
                    const docName = selectedDoctorDetail.name;
                    setSelectedDoctorDetail(null);
                    onBookDoctor(docId, `Consultation with ${docName}`);
                  }}
                  className="px-6 py-2 rounded-full bg-[#154734] hover:bg-[#0f3426] active:scale-95 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  Book with {selectedDoctorDetail.name.split(',')[0]}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SHOW MONTH MODAL ── */}
      {showMonthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                <Calendar className="size-5 text-[#154734]" />
                <span>Monthly Doctor Availability</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowMonthModal(false)}
                className="p-1 rounded-full hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="size-5 text-stone-500" />
              </button>
            </div>
            <p className="text-xs text-stone-600">
              Select any day in <strong>October &amp; November 2026</strong> to view instant consultation availability.
            </p>
            <div className="grid grid-cols-5 gap-2 pt-2">
              {Array.from({ length: 15 }, (_, i) => {
                const d = addDays(new Date(2026, 9, 30), i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setDateOffset(i);
                      setShowMonthModal(false);
                    }}
                    className="p-2.5 rounded-md border border-stone-200 hover:border-[#154734] hover:bg-[#154734]/5 text-center transition cursor-pointer"
                  >
                    <div className="text-[11px] font-semibold text-stone-400">{format(d, 'EEE')}</div>
                    <div className="text-sm font-bold text-stone-900">{format(d, 'd')}</div>
                  </button>
                );
              })}
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMonthModal(false)}
                className="bg-[#154734] text-white text-xs font-bold px-6 py-2 rounded-full hover:bg-[#0f3426] transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
