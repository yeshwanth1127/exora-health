import { useState, useEffect, useRef } from 'react';
import {
  Menu,
  ChevronRight,
  Search,
  Sparkles,
  Award,
  GraduationCap,
  Building2,
  ExternalLink,
  Play,
  X,
  Star,
  CheckCircle2,
  Share2,
  Printer,
  Languages,
  BookOpen,
  Microscope,
  Video,
  ThumbsUp,
  ShieldCheck,
  Stethoscope,
  Globe,
} from 'lucide-react';
import { DoctorScheduleProfile } from '../booking/ScheduleAppointmentPage';
import { DOCTOR_PROFILES } from '../search/SearchResultsPage';
import { Footer } from '../common/Footer';

interface OriginalDoctorDetailPageProps {
  doctorId?: string;
  onBackToSearch: () => void;
  onBackToHome: () => void;
  onScheduleAppointment: (doctorId: string, step?: 1 | 2) => void;
  onOpenLogin: () => void;
  user?: { name: string; identifier: string } | null;
}

interface NavSectionItem {
  id: string;
  label: string;
  shortLabel: string;
}

const PROFILE_SECTIONS: NavSectionItem[] = [
  { id: 'overview', label: 'About Me', shortLabel: 'Overview' },
  { id: 'field-of-expertise', label: 'Field of Expertise', shortLabel: 'Expertise' },
  { id: 'credentials', label: 'Credentials', shortLabel: 'Credentials' },
  { id: 'languages-spoken', label: 'Languages Spoken', shortLabel: 'Languages' },
  { id: 'talks-publications', label: 'Talks & Publications', shortLabel: 'Publications' },
  { id: 'reviews', label: 'Patient Reviews', shortLabel: 'Reviews' },
];

export function OriginalDoctorDetailPage({
  doctorId = 'doc-seth-orlow',
  onBackToSearch,
  onBackToHome,
  onScheduleAppointment,
  onOpenLogin,
  user,
}: OriginalDoctorDetailPageProps) {
  // Find matched doctor or fallback to Dr. Seth Orlow
  const doctor: DoctorScheduleProfile =
    DOCTOR_PROFILES.find((p) => p.id === doctorId) || DOCTOR_PROFILES[0];

  const [activeSection, setActiveSection] = useState<string>('overview');
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const [itemOffsets, setItemOffsets] = useState<{ [key: string]: { top: number; height: number } }>({});

  // Scroll listener for Section Spy
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;

      // Detect active section
      const triggerPoint = scrollY + 220; // viewport offset
      let currentActive = PROFILE_SECTIONS[0].id;

      for (const sec of PROFILE_SECTIONS) {
        const el = document.getElementById(sec.id);
        if (el) {
          const top = el.offsetTop;
          if (triggerPoint >= top) {
            currentActive = sec.id;
          }
        }
      }
      setActiveSection(currentActive);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Measure Nav Button offsets for the lateral pin
  useEffect(() => {
    if (!navContainerRef.current) return;
    const offsets: { [key: string]: { top: number; height: number } } = {};
    PROFILE_SECTIONS.forEach((sec) => {
      const btn = document.getElementById(`nav-btn-${sec.id}`);
      if (btn && navContainerRef.current) {
        const btnRect = btn.getBoundingClientRect();
        const containerRect = navContainerRef.current.getBoundingClientRect();
        offsets[sec.id] = {
          top: btnRect.top - containerRect.top,
          height: btnRect.height,
        };
      }
    });
    setItemOffsets(offsets);
  }, [activeSection]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const headerOffset = 90;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const activeIndex = PROFILE_SECTIONS.findIndex((s) => s.id === activeSection);
  const activeOffset = itemOffsets[activeSection] || { top: activeIndex * 52, height: 44 };

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans flex flex-col selection:bg-purple-100 selection:text-purple-900">
      {/* 1. TOP HEADER & BREADCRUMBS BAR (NYU Langone Style: media_1790073472687.png) */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200 shadow-2xs backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Left: Menu & Breadcrumbs */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={onBackToHome}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-neutral-800 hover:text-purple-700 transition-colors py-1.5 px-2 rounded-md hover:bg-neutral-100"
            >
              <Menu className="size-4 text-neutral-700" />
              <span className="hidden sm:inline">Menu</span>
            </button>

            <div className="h-4 w-px bg-neutral-200 hidden sm:block" />

            {/* Breadcrumb Hierarchy */}
            <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-neutral-500 overflow-hidden whitespace-nowrap text-ellipsis">
              <button
                onClick={onBackToHome}
                className="hover:text-purple-700 hover:underline transition-colors shrink-0"
              >
                Home
              </button>
              <ChevronRight className="size-3 text-neutral-400 shrink-0" />
              <button
                onClick={onBackToSearch}
                className="hover:text-purple-700 hover:underline transition-colors shrink-0"
              >
                Find a Doctor
              </button>
              <ChevronRight className="size-3 text-neutral-400 shrink-0" />
              <span className="font-semibold text-purple-900 truncate">
                {doctor.name}
              </span>
            </nav>
          </div>

          {/* Right: Search, Ask AI, Login & Accessibility */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onBackToSearch}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <Search className="size-3.5 text-neutral-500" />
              <span>Search</span>
            </button>

            <button
              onClick={onBackToSearch}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-full transition-colors"
            >
              <Sparkles className="size-3.5 text-purple-600" />
              <span>Ask AI</span>
            </button>

            {user ? (
              <span className="text-xs font-medium text-neutral-700 hidden sm:inline px-2 py-0.5 bg-neutral-100 rounded-full">
                {user.name}
              </span>
            ) : (
              <button
                onClick={onOpenLogin}
                className="text-xs font-semibold text-neutral-700 hover:text-neutral-900 px-2.5 py-1 rounded-md hover:bg-neutral-100 transition-colors"
              >
                Sign In
              </button>
            )}

            {/* Accessibility badge */}
            <div
              title="Accessibility Tools"
              className="size-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs cursor-pointer hover:bg-purple-700 transition-transform active:scale-95"
            >
              <span className="text-[11px]">♿</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. HERO BANNER (1:1 with media_1790073472687.png - End-to-End Bleed) */}
      <section className="bg-[#384249] text-white relative overflow-hidden min-h-[440px] lg:min-h-[480px] flex flex-col justify-center">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-radial from-neutral-700/20 to-transparent pointer-events-none" />

        {/* End-to-End Doctor Portrait (Spans flush top-to-bottom and right-edge on desktop) */}
        <div className="relative w-full h-80 sm:h-96 lg:h-full lg:absolute lg:right-0 lg:top-0 lg:bottom-0 lg:w-[56%] xl:w-[52%] 2xl:w-[48%] z-0 overflow-hidden flex items-end justify-center lg:justify-end">
          <img
            src={
              doctor.id === 'doc-seth-orlow'
                ? '/images/doctors/dr_seth_orlow_full_portrait.jpg'
                : doctor.photo
            }
            alt={doctor.name}
            className="w-full h-full object-cover object-[center_28%] lg:object-[55%_25%] scale-105 lg:scale-115 origin-bottom pointer-events-none select-none"
            onError={(e) => {
              (e.target as HTMLImageElement).src = doctor.photo;
            }}
          />
          {/* Seamless gradient mask on the left edge blending into hero background */}
          <div className="hidden lg:block absolute inset-y-0 left-0 w-36 xl:w-52 bg-gradient-to-r from-[#384249] via-[#384249]/70 to-transparent pointer-events-none" />
          {/* Mobile bottom fade into dark hero background */}
          <div className="lg:hidden absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#384249] to-transparent pointer-events-none" />
        </div>

        {/* Content Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 relative z-10 w-full">
          <div className="max-w-xl lg:max-w-lg xl:max-w-xl space-y-5">
            {/* Provider Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800/80 border border-neutral-600/60 text-xs font-medium text-neutral-200 shadow-2xs backdrop-blur-xs">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              <span>NYU Langone Provider</span>
            </div>

            {/* Doctor Name */}
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                {doctor.name.includes(',') ? (
                  <>
                    <span>{doctor.name.split(',')[0]},</span>{' '}
                    <span className="font-semibold text-neutral-200 text-2xl sm:text-3xl lg:text-4xl">
                      {doctor.name.split(',').slice(1).join(',')}
                    </span>
                  </>
                ) : (
                  doctor.name
                )}
              </h1>
            </div>

            {/* Clinical Quick Specs (Specialties, Treats, Language, Phone) */}
            <div className="space-y-1.5 text-sm sm:text-base text-neutral-200 pt-1">
              <div>
                <span className="font-bold text-white">Specialties:</span>{' '}
                <span className="text-neutral-200 font-normal">{doctor.specialty}</span>
              </div>
              <div>
                <span className="font-bold text-white">Treats:</span>{' '}
                <span className="text-neutral-200 font-normal">Children</span>
              </div>
              <div>
                <span className="font-bold text-white">Language:</span>{' '}
                <span className="text-neutral-200 font-normal">English</span>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="font-bold text-white">Phone:</span>{' '}
                <a
                  href={`tel:${doctor.phone}`}
                  className="text-white hover:text-purple-300 font-normal underline underline-offset-4 decoration-neutral-500 transition-colors"
                >
                  {doctor.phone}
                </a>
              </div>
            </div>

            {/* Primary Schedule Appointment Button */}
            <div className="pt-3 flex flex-wrap items-center gap-4">
              <button
                onClick={() => onScheduleAppointment(doctor.id, 1)}
                className="px-6 py-2.5 rounded-sm bg-[#5b1b8b] hover:bg-[#4c1475] text-white font-bold text-sm shadow-md transition-all duration-200 cursor-pointer"
              >
                Schedule Appointment
              </button>
            </div>
          </div>
        </div>

        {/* Floating Action Rail (Facebook, X, Print, Share) as seen in media_1790073472687.png */}
        <div className="absolute right-3 sm:right-6 top-8 sm:top-12 lg:top-16 flex flex-col gap-2.5 z-20">
          <button
            onClick={handleShare}
            title="Share on Facebook / Web"
            className="size-8 rounded-full bg-[#283238]/80 hover:bg-neutral-700 text-neutral-200 hover:text-white flex items-center justify-center transition-colors shadow-md backdrop-blur-xs border border-neutral-600/50 cursor-pointer"
          >
            <span className="text-xs font-bold">f</span>
          </button>
          <button
            onClick={handleShare}
            title="Share on X (Twitter)"
            className="size-8 rounded-full bg-[#283238]/80 hover:bg-neutral-700 text-neutral-200 hover:text-white flex items-center justify-center transition-colors shadow-md backdrop-blur-xs border border-neutral-600/50 cursor-pointer"
          >
            <span className="text-[11px] font-bold">𝕏</span>
          </button>

          {/* Thin divider line as in media_1790073472687.png */}
          <div className="w-4 h-px bg-neutral-500/50 mx-auto my-0.5" />

          <button
            onClick={handlePrint}
            title="Print Profile"
            className="size-8 rounded-full bg-[#283238]/80 hover:bg-neutral-700 text-neutral-200 hover:text-white flex items-center justify-center transition-colors shadow-md backdrop-blur-xs border border-neutral-600/50 cursor-pointer"
          >
            <Printer className="size-3.5" />
          </button>
          <button
            onClick={handleShare}
            title="Copy link"
            className="size-8 rounded-full bg-[#283238]/80 hover:bg-neutral-700 text-neutral-200 hover:text-white flex items-center justify-center transition-colors shadow-md backdrop-blur-xs border border-neutral-600/50 cursor-pointer"
          >
            <Share2 className="size-3.5" />
          </button>

          {/* Toast for copied link */}
          {copiedLink && (
            <div className="absolute -bottom-8 right-0 bg-neutral-900 text-white text-xs px-3 py-1 rounded-md shadow-lg border border-neutral-700 whitespace-nowrap animate-fade-in">
              Profile link copied!
            </div>
          )}
        </div>
      </section>

      {/* MOBILE STICKY NAVIGATION BAR (Clean minimal tabs) */}
      <div className="lg:hidden sticky top-14 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-100 overflow-x-auto scrollbar-none py-2.5 px-4">
        <div className="flex items-center gap-5 min-w-max text-xs">
          {PROFILE_SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className={`py-1 transition-all cursor-pointer ${
                  isActive
                    ? 'text-[#1c0840] font-bold border-b-2 border-[#1c0840]'
                    : 'text-neutral-400 hover:text-neutral-700 font-medium'
                }`}
              >
                {sec.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. MAIN CONTENT CONTAINER WITH RIGHT LATERAL PIN INDICATOR */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* LEFT & CENTER COLUMN (Content Sections) */}
          <main className="lg:col-span-8 xl:col-span-9 space-y-16">
            {/* SECTION 1: ABOUT ME / OVERVIEW (1:1 with media_1790073643666.png) */}
            <section id="overview" className="scroll-mt-28 space-y-6">
              <div>
                <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
                  About Me
                </h2>
              </div>

              <div className="prose prose-neutral max-w-none text-base sm:text-lg text-neutral-700 leading-relaxed space-y-4">
                <p>
                  I was born in Brooklyn, and although I lived elsewhere during college and
                  residency training, I consider myself a lifelong New Yorker. While getting my MD
                  and PhD in molecular pharmacology from Albert Einstein College of Medicine in the
                  Bronx, I realized I was especially fascinated by the field of dermatology. I loved
                  taking care of children when I rotated through pediatrics as a medical student, so
                  I chose to combine these interests and specialize in pediatric and adolescent
                  dermatology.
                </p>
                <p>
                  Over the past three decades, my clinical philosophy has remained centered on
                  compassionate, family-centered communication. Skin conditions in infants and
                  children don't just affect the patient—they affect the sleep, comfort, and peace of
                  mind of the entire family. I take time to explain causes, provide clear visual
                  guides, and partner with parents every step of the way.
                </p>
              </div>

              {/* Video Consultation & Interview Card (Matching media_1790073643666.png) */}
              <div className="pt-2 w-full">
                <div
                  onClick={() => setIsVideoModalOpen(true)}
                  className="relative group rounded-2xl overflow-hidden border border-neutral-200 shadow-md bg-neutral-900 cursor-pointer aspect-[16/9] w-full"
                >
                  <img
                    src="/images/doctors/dr_seth_orlow_video_thumb.png"
                    alt={`Interview with ${doctor.name}`}
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=1200';
                    }}
                  />

                  {/* Dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/70 via-transparent to-neutral-950/20" />

                  {/* Play Button Overlay (Exact circle with purple triangle from screenshot) */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="size-16 sm:size-20 rounded-full bg-white text-[#5b21b6] flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300 pl-1">
                      <Play className="size-7 sm:size-8 fill-[#5b21b6]" />
                    </div>
                  </div>

                  {/* Bottom Video Caption */}
                  <div className="absolute bottom-4 left-4 right-4 text-white flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-purple-200 font-bold">
                        Video Profile
                      </div>
                      <div className="text-sm sm:text-base font-semibold">
                        Meet Dr. Seth J. Orlow: Compassionate Pediatric Care
                      </div>
                    </div>
                    <span className="text-xs bg-neutral-900/80 px-2.5 py-1 rounded-md font-mono text-neutral-300">
                      2:45
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 2: FIELD OF EXPERTISE */}
            <section id="field-of-expertise" className="scroll-mt-28 space-y-6 pt-6 border-t border-neutral-200">
              <div>
                <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
                  Field of Expertise
                </h2>
                <p className="text-neutral-600 text-sm sm:text-base mt-2">
                  Specialized clinical domains, treatment philosophies, and pediatric skin therapies.
                </p>
              </div>

              {/* Grid of Key Clinical Specializations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-[#faf9fc] border border-[#e8e4f3] space-y-2 hover:border-purple-300 transition-colors">
                  <div className="flex items-center gap-2 text-[#5b21b6] font-bold text-base">
                    <Stethoscope className="size-5" />
                    <span>Pediatric Eczema &amp; Atopic Dermatitis</span>
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    Custom steroid-sparing topicals, barrier restoration regimens, biologic therapies
                    for severe pediatric flares, and allergy trigger minimization.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-[#faf9fc] border border-[#e8e4f3] space-y-2 hover:border-purple-300 transition-colors">
                  <div className="flex items-center gap-2 text-[#5b21b6] font-bold text-base">
                    <Microscope className="size-5" />
                    <span>Childhood Alopecia &amp; Hair Loss</span>
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    Evaluation of alopecia areata, trichotillomania, tinea capitis, and genetic hair shaft
                    anomalies with state-of-the-art non-invasive trichoscopy.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-[#faf9fc] border border-[#e8e4f3] space-y-2 hover:border-purple-300 transition-colors">
                  <div className="flex items-center gap-2 text-[#5b21b6] font-bold text-base">
                    <ShieldCheck className="size-5" />
                    <span>Vascular Birthmarks &amp; Hemangiomas</span>
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    Multidisciplinary surveillance and early medical management for infantile hemangiomas,
                    port-wine stains, and capillary malformations.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-[#faf9fc] border border-[#e8e4f3] space-y-2 hover:border-purple-300 transition-colors">
                  <div className="flex items-center gap-2 text-[#5b21b6] font-bold text-base">
                    <Award className="size-5" />
                    <span>Genetic &amp; Rare Cutaneous Disorders</span>
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    Diagnostic molecular testing and management for neurofibromatosis, tuberous sclerosis,
                    ichthyosis, and inherited epidermolysis bullosa.
                  </p>
                </div>
              </div>

              {/* Conditions Treated Tag Cloud */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider">
                  Conditions Routinely Evaluated &amp; Treated:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Atopic Dermatitis (Eczema)',
                    'Infantile Hemangiomas',
                    'Alopecia Areata',
                    'Psoriasis (Pediatric & Teen)',
                    'Warts & Molluscum Contagiosum',
                    'Acne Vulgaris',
                    'Contact Dermatitis',
                    'Congenital Melanocytic Nevi',
                    'Port-Wine Stains',
                    'Seborrheic Dermatitis',
                    'Vitiligo',
                    'Genetic Skin Syndromes',
                  ].map((condition, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-800 text-xs font-medium border border-neutral-200/80 hover:bg-purple-50 hover:border-purple-200 transition-colors"
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* SECTION 3: CREDENTIALS (1:1 with media_1790073643617.png) */}
            <section id="credentials" className="scroll-mt-28 space-y-8 pt-6 border-t border-neutral-200">
              <div>
                <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
                  Credentials
                </h2>
              </div>

              {/* Positions Subheading */}
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                  <Building2 className="size-5 text-[#5b21b6]" />
                  <span>Positions</span>
                </h3>
                <div className="space-y-2.5 text-sm sm:text-base text-neutral-800">
                  <p className="leading-snug">
                    Samuel Weinberg Professor of Pediatric Dermatology,{' '}
                    <span className="text-purple-800 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer">
                      Ronald O. Perelman Department of Dermatology at NYU Grossman School of Medicine
                      <ExternalLink className="size-3.5 text-purple-600 inline" />
                    </span>
                  </p>
                  <p className="leading-snug">
                    Professor,{' '}
                    <span className="text-purple-800 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer">
                      Department of Cell Biology at NYU Grossman School of Medicine
                      <ExternalLink className="size-3.5 text-purple-600 inline" />
                    </span>
                  </p>
                  <p className="leading-snug">
                    Professor,{' '}
                    <span className="text-purple-800 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer">
                      Department of Pediatrics at NYU Grossman School of Medicine
                      <ExternalLink className="size-3.5 text-purple-600 inline" />
                    </span>
                  </p>
                  <p className="leading-snug font-medium text-neutral-700">
                    Chair, Ronald O. Perelman Department of Dermatology
                  </p>
                  <p className="leading-snug font-medium text-neutral-700">
                    Director, Program in Cutaneous Biology
                  </p>
                </div>
              </div>

              {/* Board Certifications Subheading */}
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                  <Award className="size-5 text-[#5b21b6]" />
                  <span>Board Certifications</span>
                </h3>
                <ul className="space-y-1.5 text-sm sm:text-base text-neutral-700 pl-6 list-disc marker:text-[#5b21b6]">
                  <li>American Board of Dermatology (Pediatric Dermatology), 2004</li>
                  <li>American Board of Dermatology - Dermatology, 1990</li>
                </ul>
              </div>

              {/* Education and Training Subheading */}
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                  <GraduationCap className="size-5 text-[#5b21b6]" />
                  <span>Education and Training</span>
                </h3>
                <ul className="space-y-1.5 text-sm sm:text-base text-neutral-700 pl-6 list-disc marker:text-[#5b21b6]">
                  <li>Fellowship, Yale - New Haven Medical Center, Pediatric Dermatology, 1990</li>
                  <li>Residency, Yale - New Haven Medical Center, Dermatology, 1989</li>
                  <li>MD from Albert Einstein College of Medicine, 1986</li>
                  <li>PhD from Albert Einstein College of Medicine, 1986</li>
                </ul>
              </div>
            </section>

            {/* PULL-QUOTE BREAKOUT BANNER (1:1 with media_1790073631830.png) */}
            <div className="rounded-2xl bg-[#384249] text-white p-8 sm:p-12 shadow-xl relative overflow-hidden my-10">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Doctor Thumbnail */}
                <div className="md:col-span-4 flex justify-center md:justify-start">
                  <div className="size-36 sm:size-44 rounded-full overflow-hidden border-4 border-white/20 shadow-lg shrink-0">
                    <img
                      src="/images/doctors/dr_seth_orlow_full_portrait.jpg"
                      alt={doctor.name}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                </div>

                {/* Quote Typography */}
                <div className="md:col-span-8 space-y-4 text-center md:text-left">
                  <blockquote className="text-2xl sm:text-3xl lg:text-4xl font-serif italic text-white leading-snug tracking-wide">
                    “My research has improved treatments for eczema and psoriasis in children and
                    teenagers.”
                  </blockquote>
                  <div className="pt-2">
                    <div className="text-lg font-bold text-white">{doctor.name}</div>
                    <div className="text-xs sm:text-sm text-neutral-300 uppercase tracking-wider font-semibold">
                      Pediatric Dermatologist &amp; Clinical Researcher
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: LANGUAGES SPOKEN (Strictly no insurance!) */}
            <section id="languages-spoken" className="scroll-mt-28 space-y-6 pt-6 border-t border-neutral-200">
              <div>
                <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
                  Languages Spoken
                </h2>
                <p className="text-neutral-600 text-sm sm:text-base mt-2">
                  Direct physician fluency and hospital-certified interpretation support.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
                  <div className="flex items-center gap-2 text-neutral-900 font-bold text-base">
                    <Languages className="size-5 text-[#5b21b6]" />
                    <span>English</span>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                    Primary / Native Fluency
                  </span>
                  <p className="text-xs text-neutral-600 pt-1">
                    Direct bedside dialogue, diagnostic consultations, and clinical summaries.
                  </p>
                </div>

                <div className="p-5 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
                  <div className="flex items-center gap-2 text-neutral-900 font-bold text-base">
                    <Languages className="size-5 text-[#5b21b6]" />
                    <span>Spanish</span>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                    Clinical Conversational
                  </span>
                  <p className="text-xs text-neutral-600 pt-1">
                    Medical history taking and routine parent treatment guidance.
                  </p>
                </div>

                <div className="p-5 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
                  <div className="flex items-center gap-2 text-neutral-900 font-bold text-base">
                    <Globe className="size-5 text-[#5b21b6]" />
                    <span>40+ Interpreter Services</span>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                    On-Demand Support
                  </span>
                  <p className="text-xs text-neutral-600 pt-1">
                    Free live certified video &amp; in-person medical interpreters for any preferred language.
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 5: TALKS & PUBLICATIONS */}
            <section id="talks-publications" className="scroll-mt-28 space-y-6 pt-6 border-t border-neutral-200">
              <div>
                <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
                  Talks &amp; Publications
                </h2>
                <p className="text-neutral-600 text-sm sm:text-base mt-2">
                  Selected peer-reviewed research, textbooks, and invited symposium lectures.
                </p>
              </div>

              {/* Research & Publications List */}
              <div className="space-y-4">
                {[
                  {
                    title: 'Targeted Biologic Therapies for Severe Pediatric Atopic Dermatitis: Long-Term Safety and Efficacy Outcomes',
                    journal: 'Journal of the American Academy of Dermatology (JAAD)',
                    year: '2025',
                    type: 'Original Research Paper',
                    authors: 'Orlow SJ, Patel M, Vance E, et al.',
                  },
                  {
                    title: 'Molecular Genetics of Cutaneous Melanin Synthesis and Pigmentary Disorders in Infancy',
                    journal: 'Nature Reviews Molecular Cell Biology',
                    year: '2024',
                    type: 'Review Article',
                    authors: 'Orlow SJ, Greenfield B',
                  },
                  {
                    title: 'Pediatric Dermatology: A Comprehensive Clinical Atlas (5th Edition)',
                    journal: 'McGraw-Hill Medical Publishing',
                    year: '2023',
                    type: 'Textbook & Clinical Guide',
                    authors: 'Orlow SJ, Senior Editor',
                  },
                  {
                    title: 'Oral Propranolol vs Topical Timolol in Infantile Hemangiomas: A Multicenter Randomized Controlled Trial',
                    journal: 'New England Journal of Medicine (NEJM)',
                    year: '2022',
                    type: 'Clinical Trial Findings',
                    authors: 'Orlow SJ, Siegel LJ, Melnick LE, et al.',
                  },
                ].map((pub, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-xl border border-neutral-200 bg-white hover:border-purple-300 hover:shadow-xs transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#5b21b6] uppercase tracking-wider">
                        {pub.type}
                      </span>
                      <span className="text-xs font-mono text-neutral-500">{pub.year}</span>
                    </div>
                    <h4 className="text-base font-bold text-neutral-900 leading-snug">
                      {pub.title}
                    </h4>
                    <div className="text-xs text-neutral-600">
                      <span className="font-semibold text-neutral-800">{pub.journal}</span> • Authors:{' '}
                      {pub.authors}
                    </div>
                  </div>
                ))}
              </div>

              {/* Keynote Lectures Card */}
              <div className="p-5 rounded-xl bg-purple-50/60 border border-purple-200/80 space-y-3">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-sm uppercase tracking-wider">
                  <BookOpen className="size-4 text-[#5b21b6]" />
                  <span>Recent Keynote Addresses &amp; Symposia</span>
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-neutral-700 pl-5 list-disc marker:text-[#5b21b6]">
                  <li>
                    <strong>World Congress of Pediatric Dermatology:</strong> Presidential Plenary on
                    Advances in Childhood Alopecia Diagnostics (Munich, Germany).
                  </li>
                  <li>
                    <strong>American Academy of Dermatology (AAD) Annual Meeting:</strong> Course
                    Director, "Translational Frontiers in Pediatric Dermatology" (San Diego, CA).
                  </li>
                  <li>
                    <strong>Society for Pediatric Dermatology (SPD):</strong> Invited Keynote:
                    "Eczema Management from Infancy to Adolescence".
                  </li>
                </ul>
              </div>
            </section>

            {/* SECTION 6: PATIENT REVIEWS & TESTIMONIALS (Adapted from TestimonialsSection) */}
            <section id="reviews" className="scroll-mt-28 space-y-8 pt-6 border-t border-neutral-200">
              <div>
                <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
                  Patient Reviews &amp; Ratings
                </h2>
                <p className="text-neutral-600 text-sm sm:text-base mt-2">
                  Verified feedback from families and patients treated under Dr. Orlow's care.
                </p>
              </div>

              {/* Rating Summary Card */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[#faf9fc] border border-[#e8e4f3] grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Overall Score */}
                <div className="md:col-span-4 text-center md:text-left space-y-1">
                  <div className="text-5xl sm:text-6xl font-black text-neutral-900">4.9</div>
                  <div className="flex items-center justify-center md:justify-start gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="size-5 fill-amber-400" />
                    ))}
                  </div>
                  <div className="text-xs text-neutral-500 font-medium">
                    Based on 284 verified patient surveys
                  </div>
                </div>

                {/* Metric Breakdown Bars */}
                <div className="md:col-span-8 space-y-2.5">
                  {[
                    { label: 'Bedside Manner & Empathy', score: '99%', val: '4.95' },
                    { label: 'Clear Explanation of Conditions & Plans', score: '98%', val: '4.92' },
                    { label: 'Un-hurried Consultation Time', score: '97%', val: '4.88' },
                    { label: 'Minimal Wait Time (< 10 min)', score: '95%', val: '4.82' },
                  ].map((metric, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-neutral-700">
                        <span>{metric.label}</span>
                        <span className="font-mono text-purple-900">{metric.val} / 5.0</span>
                      </div>
                      <div className="h-2 w-full bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#5b21b6] rounded-full transition-all duration-700"
                          style={{ width: metric.score }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verified Patient Review Cards (Reusing High-End Testimonial Cards) */}
              <div className="space-y-4">
                {[
                  {
                    author: 'Jessica L., Mother of 4-year-old Ethan',
                    date: 'September 14, 2026',
                    verified: true,
                    condition: 'Severe Pediatric Eczema',
                    rating: 5,
                    quote:
                      'Dr. Orlow literally saved our family from sleepless nights. My four-year-old had raging atopic dermatitis that three other doctors couldn’t calm without heavy oral steroids. Dr. Orlow sat with us for 40 unhurried minutes, showed us how to do wet wraps gently, and tailored a barrier cream plan. In two weeks, Ethan’s skin was completely clear.',
                  },
                  {
                    author: 'Marcus & Elena Vance',
                    date: 'August 28, 2026',
                    verified: true,
                    condition: 'Facial Infantile Hemangioma',
                    rating: 5,
                    quote:
                      'We were terrified when our newborn developed a rapidly growing vascular mark near her eye. Dr. Orlow’s calm reassurance and expert guidance through oral propranolol was extraordinary. His staff even followed up via WhatsApp to verify progress between visits.',
                  },
                  {
                    author: 'Rachel K., 17-year-old Patient',
                    date: 'July 19, 2026',
                    verified: true,
                    condition: 'Alopecia Areata',
                    rating: 5,
                    quote:
                      'Being a teenager losing hair in patches was devastating. Dr. Orlow treated me with dignity, never talked down to me, and explained the immune biology so clearly. Six months later, my hair has fully regrown. I cannot thank him enough.',
                  },
                ].map((rev, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-xl border border-neutral-200 bg-white hover:border-purple-300 hover:shadow-xs transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-900 text-sm sm:text-base">
                            {rev.author}
                          </span>
                          {rev.verified && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="size-3 text-emerald-600" />
                              <span>Verified Patient</span>
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-neutral-500 font-medium">
                          Treated for: <strong className="text-neutral-700">{rev.condition}</strong> •{' '}
                          {rev.date}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-amber-400">
                        {[...Array(rev.rating)].map((_, i) => (
                          <Star key={i} className="size-4 fill-amber-400" />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed italic">
                      "{rev.quote}"
                    </p>

                    <div className="flex items-center gap-4 text-xs text-neutral-400 pt-1">
                      <button className="flex items-center gap-1 hover:text-neutral-600 transition-colors">
                        <ThumbsUp className="size-3" />
                        <span>Helpful (18)</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </main>

          {/* RIGHT COLUMN: "I" INDICATOR ON PALE LINE */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-28 select-none">
            <nav ref={navContainerRef} className="relative pl-6 space-y-4" aria-label="Page sections">
              {/* THE PALE LINE */}
              <div className="absolute left-1.5 -translate-x-1/2 top-1.5 bottom-1.5 w-[1.5px] bg-neutral-200 rounded-full" />

              {/* THE "I" INDICATOR (Vertical capsule bar that glides on the pale line) */}
              <div
                className="absolute left-1.5 -translate-x-1/2 w-[3px] h-6 rounded-full bg-[#1c0840] transition-all duration-300 ease-out pointer-events-none shadow-xs"
                style={{
                  top: `${activeOffset.top + activeOffset.height / 2 - 12}px`,
                }}
              />

              {/* Navigation Topics */}
              {PROFILE_SECTIONS.map((sec) => {
                const isActive = activeSection === sec.id;
                return (
                  <button
                    id={`nav-btn-${sec.id}`}
                    key={sec.id}
                    onClick={() => scrollToSection(sec.id)}
                    className={`block text-left text-sm sm:text-[15px] transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'text-[#1c0840] font-bold translate-x-1'
                        : 'text-neutral-400 hover:text-neutral-800 font-medium'
                    }`}
                  >
                    {sec.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      </div>

      {/* VIDEO MODAL (Interactive consult playback) */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-neutral-900 rounded-2xl overflow-hidden max-w-3xl w-full border border-neutral-700 shadow-2xl relative">
            <button
              onClick={() => setIsVideoModalOpen(false)}
              className="absolute top-4 right-4 z-10 size-9 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>

            {/* Video Player Header */}
            <div className="p-4 border-b border-neutral-800 text-white">
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <Video className="size-4 text-purple-400" />
                <span>Clinical Profile: {doctor.name}</span>
              </h3>
            </div>

            {/* Video Player Display */}
            <div className="relative aspect-[16/9] bg-black flex items-center justify-center">
              <img
                src="/images/doctors/dr_seth_orlow_video_thumb.png"
                alt="Video presentation"
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-neutral-950/40 flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
                <div className="size-16 rounded-full bg-white/20 border-2 border-white flex items-center justify-center animate-pulse">
                  <Play className="size-8 fill-white text-white pl-1" />
                </div>
                <div className="text-sm font-semibold max-w-md">
                  "Listening to young patients and partnering with their families is the essence of
                  effective pediatric dermatology."
                </div>
                <span className="text-xs text-neutral-300 font-mono">
                  Runtime: 2:45 • NYU Langone Health Broadcast
                </span>
              </div>
            </div>

            {/* Video Footer CTA */}
            <div className="p-4 bg-neutral-950 flex items-center justify-between text-white text-xs">
              <span className="text-neutral-400">Ready to consult with Dr. Orlow?</span>
              <button
                onClick={() => {
                  setIsVideoModalOpen(false);
                  onScheduleAppointment(doctor.id, 1);
                }}
                className="px-4 py-2 rounded-md bg-[#5b21b6] hover:bg-[#4c1d95] font-bold text-white transition-colors cursor-pointer"
              >
                Schedule Appointment Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <Footer onOpenBooking={() => onScheduleAppointment(doctor.id, 1)} />
    </div>
  );
}
