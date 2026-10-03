import { useState, useEffect, useRef } from 'react';
import {
  Award,
  GraduationCap,
  Building2,
  Star,
  CheckCircle2,
  Languages,
  Microscope,
  ShieldCheck,
  Stethoscope,
  Globe,
} from 'lucide-react';
import { DoctorScheduleProfile } from '../booking/ScheduleAppointmentPage';
import { DOCTOR_PROFILES } from '../search/SearchResultsPage';
import { Breadcrumbs } from '../common/Breadcrumbs';
import { doctors } from '../../data/doctors';
import { departments } from '../../data/departments';
import { hospitalInfo } from '../../data/hospitalInfo';

const EXPERTISE_ICONS = [Stethoscope, Microscope, ShieldCheck, Award];

interface DoctorDetailPageProps {
  doctorId?: string;
  onBackToSearch: () => void;
  onBackToHome: () => void;
  onScheduleAppointment: (doctorId: string, step?: 1 | 2) => void;
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
  { id: 'reviews', label: 'Patient Reviews', shortLabel: 'Reviews' },
];

export function DoctorDetailPage({
  doctorId = 'doc-1',
  onBackToSearch,
  onBackToHome,
  onScheduleAppointment,
}: DoctorDetailPageProps) {
  const doctor: DoctorScheduleProfile =
    DOCTOR_PROFILES.find((p) => p.id === doctorId) || DOCTOR_PROFILES[0];
  const dept = departments.find((d) => d.id === doctors.find((x) => x.id === doctor.id)?.departmentId);
  const languages =
    doctor.decisionChips?.find((c) => c.startsWith('Speaks '))?.slice(7).split(/, | & /) ?? ['English', 'Hindi'];
  const surname = doctor.name.split(' ').pop();
  const interests = [...(doctor.nicheExpertise?.split(/,\s*/) ?? []), ...(doctor.clinicalInterests ?? [])];

  const [activeSection, setActiveSection] = useState<string>('overview');
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
          const top = el.getBoundingClientRect().top + scrollY;
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
      const headerOffset = 120; // fixed site header + mobile section tabs
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const activeIndex = PROFILE_SECTIONS.findIndex((s) => s.id === activeSection);
  const activeOffset = itemOffsets[activeSection] || { top: activeIndex * 52, height: 44 };

  return (
    <div className="bg-[#fcfbf9] text-[#121212] font-sans flex flex-col selection:bg-[#eef7f2] selection:text-[#12231b]">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <Breadcrumbs
          items={[
            { label: 'Home', onClick: onBackToHome },
            { label: 'Find a Doctor', onClick: onBackToSearch },
            { label: doctor.name },
          ]}
        />
      </div>

      {/* 2. HERO BANNER */}
      <section className="bg-[#12231b] text-white relative overflow-hidden min-h-[440px] lg:min-h-[480px] flex flex-col justify-center">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-radial from-stone-700/20 to-transparent pointer-events-none" />

        {/* End-to-End Doctor Portrait (Spans flush top-to-bottom and right-edge on desktop) */}
        <div className="relative w-full h-80 sm:h-96 lg:h-full lg:absolute lg:right-0 lg:top-0 lg:bottom-0 lg:w-[56%] xl:w-[52%] 2xl:w-[48%] z-0 overflow-hidden flex items-end justify-center lg:justify-end">
          <img
            src={doctor.photo}
            alt={doctor.name}
            className="w-full h-full object-cover object-top pointer-events-none select-none"
          />
          {/* Seamless gradient mask on the left edge blending into hero background */}
          <div className="hidden lg:block absolute inset-y-0 left-0 w-36 xl:w-52 bg-gradient-to-r from-[#12231b] via-[#12231b]/70 to-transparent pointer-events-none" />
          {/* Mobile bottom fade into dark hero background */}
          <div className="lg:hidden absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#12231b] to-transparent pointer-events-none" />
        </div>

        {/* Content Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 relative z-10 w-full">
          <div className="max-w-xl lg:max-w-lg xl:max-w-xl space-y-5">
            {/* Provider Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-stone-200 shadow-2xs backdrop-blur-xs">
              <ShieldCheck className="size-3.5 text-[#b7d9c6]" />
              <span>{hospitalInfo.shortName} Provider</span>
            </div>

            {/* Doctor Name */}
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
                {doctor.name.includes(',') ? (
                  <>
                    <span>{doctor.name.split(',')[0]},</span>{' '}
                    <span className="font-semibold text-stone-200 text-2xl sm:text-3xl lg:text-4xl">
                      {doctor.name.split(',').slice(1).join(',')}
                    </span>
                  </>
                ) : (
                  doctor.name
                )}
              </h1>
            </div>

            {/* Clinical Quick Specs (Specialties, Treats, Language, Phone) */}
            <div className="space-y-1.5 text-sm sm:text-base text-stone-200 pt-1">
              <div>
                <span className="font-bold text-white">Specialties:</span>{' '}
                <span className="text-stone-200 font-normal">{doctor.specialty}</span>
              </div>
              <div>
                <span className="font-bold text-white">Practice:</span>{' '}
                <span className="text-stone-200 font-normal">{doctor.practiceName}</span>
              </div>
              <div>
                <span className="font-bold text-white">Language:</span>{' '}
                <span className="text-stone-200 font-normal">{languages.join(', ')}</span>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="font-bold text-white">Phone:</span>{' '}
                <a
                  href={`tel:${doctor.phone}`}
                  className="text-white hover:text-[#b7d9c6] font-normal underline underline-offset-4 decoration-stone-500 transition-colors"
                >
                  {doctor.phone}
                </a>
              </div>
            </div>

            {/* Primary Schedule Appointment Button */}
            <div className="pt-3 flex flex-wrap items-center gap-4">
              <button
                onClick={() => onScheduleAppointment(doctor.id, 1)}
                className="px-6 py-2.5 rounded-full bg-white text-[#154734] hover:bg-white/95 font-semibold text-sm shadow-md transition-all duration-200 cursor-pointer"
              >
                Schedule Appointment
              </button>
            </div>
          </div>
        </div>

      </section>

      {/* MOBILE STICKY NAVIGATION BAR (Clean minimal tabs) */}
      <div className="lg:hidden sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-stone-100 overflow-x-auto scrollbar-none py-2.5 px-4">
        <div className="flex items-center gap-5 min-w-max text-xs">
          {PROFILE_SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className={`py-1 transition-all cursor-pointer ${
                  isActive
                    ? 'text-[#12231b] font-bold border-b-2 border-[#12231b]'
                    : 'text-stone-400 hover:text-stone-700 font-medium'
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
            {/* SECTION 1: ABOUT ME / OVERVIEW */}
            <section id="overview" className="scroll-mt-28 space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                  About Me
                </h2>
              </div>

              <div className="prose prose-neutral max-w-none text-base sm:text-lg text-stone-700 leading-relaxed space-y-4">
                <p>{doctor.bio}</p>
                {doctor.bedsideManner && <p>{doctor.bedsideManner}</p>}
              </div>

            </section>

            {/* SECTION 2: FIELD OF EXPERTISE */}
            <section id="field-of-expertise" className="scroll-mt-28 space-y-6 pt-6 border-t border-stone-200">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                  Field of Expertise
                </h2>
                <p className="text-stone-600 text-sm sm:text-base mt-2">
                  {dept?.tagline}
                </p>
              </div>

              {/* Grid of Key Clinical Specializations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dept?.commonProcedures.map((proc, idx) => {
                  const Icon = EXPERTISE_ICONS[idx % EXPERTISE_ICONS.length];
                  return (
                    <div key={proc} className="p-5 rounded-xl bg-[#fcfbf9] border border-[#e5e2dc] hover:border-[#154734]/40 transition-colors">
                      <div className="flex items-center gap-2 text-[#1e6b4c] font-bold text-base">
                        <Icon className="size-5" />
                        <span>{proc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Conditions Treated Tag Cloud */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider">
                  Clinical Interests
                </h3>
                <div className="flex flex-wrap gap-2">
                  {interests.map((condition, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-800 text-xs font-medium border border-stone-200/80 hover:bg-[#eef7f2] hover:border-[#154734]/20 transition-colors"
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* SECTION 3: CREDENTIALS */}
            <section id="credentials" className="scroll-mt-28 space-y-8 pt-6 border-t border-stone-200">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                  Credentials
                </h2>
              </div>

              {/* Positions Subheading */}
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  <Building2 className="size-5 text-[#1e6b4c]" />
                  <span>Positions</span>
                </h3>
                <div className="space-y-2.5 text-sm sm:text-base text-stone-800">
                  <p className="leading-snug">
                    {doctor.specialty},{' '}
                    <span className="text-[#154734] font-semibold">{doctor.hospitalAffiliation}</span>
                  </p>
                  <p className="leading-snug font-medium text-stone-700">
                    {doctor.practiceName} • {doctor.addressLine2}
                  </p>
                </div>
              </div>

              {/* Board Certifications Subheading */}
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  <Award className="size-5 text-[#1e6b4c]" />
                  <span>Board Certifications</span>
                </h3>
                <ul className="space-y-1.5 text-sm sm:text-base text-stone-700 pl-6 list-disc marker:text-[#1e6b4c]">
                  {doctor.boardCertified.split(' • ').map((cert) => (
                    <li key={cert}>{cert}</li>
                  ))}
                </ul>
              </div>

              {/* Education and Training Subheading */}
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  <GraduationCap className="size-5 text-[#1e6b4c]" />
                  <span>Education and Training</span>
                </h3>
                <ul className="space-y-1.5 text-sm sm:text-base text-stone-700 pl-6 list-disc marker:text-[#1e6b4c]">
                  {doctor.education?.map((edu) => (
                    <li key={edu}>{edu}</li>
                  ))}
                </ul>
              </div>
            </section>

            {/* SECTION 4: LANGUAGES SPOKEN (Strictly no insurance!) */}
            <section id="languages-spoken" className="scroll-mt-28 space-y-6 pt-6 border-t border-stone-200">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                  Languages Spoken
                </h2>
                <p className="text-stone-600 text-sm sm:text-base mt-2">
                  Direct physician fluency and hospital-certified interpretation support.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {languages.map((lang, idx) => (
                  <div key={lang} className="p-5 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
                    <div className="flex items-center gap-2 text-stone-900 font-bold text-base">
                      <Languages className="size-5 text-[#1e6b4c]" />
                      <span>{lang}</span>
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-[#dcefe4] text-[#154734]">
                      {idx === 0 ? 'Primary' : 'Fluent'}
                    </span>
                  </div>
                ))}

                <div className="p-5 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-base">
                    <Globe className="size-5 text-[#1e6b4c]" />
                    <span>Interpreter Support</span>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-[#eef7f2] text-[#154734]">
                    On Request
                  </span>
                  <p className="text-xs text-stone-600 pt-1">
                    Let the front desk know when booking and we'll arrange an interpreter for other languages.
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 6: PATIENT REVIEWS & TESTIMONIALS (Adapted from TestimonialsSection) */}
            <section id="reviews" className="scroll-mt-28 space-y-8 pt-6 border-t border-stone-200">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                  Patient Reviews &amp; Ratings
                </h2>
                <p className="text-stone-600 text-sm sm:text-base mt-2">
                  Verified feedback from patients treated under {doctor.name}'s care.
                </p>
              </div>

              {/* Rating Summary Card */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[#fcfbf9] border border-[#e5e2dc] grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Overall Score */}
                <div className="md:col-span-4 text-center md:text-left space-y-1">
                  <div className="text-5xl sm:text-6xl font-black text-stone-900">{doctor.rating.toFixed(1)}</div>
                  <div className="flex items-center justify-center md:justify-start gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="size-5 fill-amber-400" />
                    ))}
                  </div>
                  <div className="text-xs text-stone-500 font-medium">
                    Based on {doctor.reviewCount} verified patient surveys
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
                      <div className="flex justify-between text-xs font-semibold text-stone-700">
                        <span>{metric.label}</span>
                        <span className="font-mono text-[#12231b]">{metric.val} / 5.0</span>
                      </div>
                      <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1e6b4c] rounded-full transition-all duration-700"
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
                    author: 'Priya S., Koramangala',
                    date: 'September 14, 2026',
                    verified: true,
                    condition: dept?.commonProcedures[0] ?? doctor.specialty,
                    rating: 5,
                    quote: `Dr. ${surname} took the time to explain every result in plain language and never rushed the consultation. The follow-up plan was simple to stick to.`,
                  },
                  {
                    author: 'Arun & Meera K.',
                    date: 'August 28, 2026',
                    verified: true,
                    condition: dept?.commonProcedures[1] ?? doctor.specialty,
                    rating: 5,
                    quote: `We came in anxious and left with a clear plan. Dr. ${surname}'s team followed up on WhatsApp between visits to check on progress.`,
                  },
                  {
                    author: 'Rahul M., Whitefield',
                    date: 'July 19, 2026',
                    verified: true,
                    condition: dept?.commonProcedures[2] ?? doctor.specialty,
                    rating: 5,
                    quote: `Booking was easy, the wait was short, and Dr. ${surname} listened properly. I'd recommend the clinic to family without hesitation.`,
                  },
                ].map((rev, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-xl border border-stone-200 bg-white hover:border-[#154734]/40 hover:shadow-xs transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-sm sm:text-base">
                            {rev.author}
                          </span>
                          {rev.verified && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#154734] bg-[#eef7f2] px-2 py-0.5 rounded-full border border-[#dcefe4]">
                              <CheckCircle2 className="size-3 text-[#154734]" />
                              <span>Verified Patient</span>
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-stone-500 font-medium">
                          Treated for: <strong className="text-stone-700">{rev.condition}</strong> •{' '}
                          {rev.date}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-amber-400">
                        {[...Array(rev.rating)].map((_, i) => (
                          <Star key={i} className="size-4 fill-amber-400" />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-stone-700 leading-relaxed italic">
                      "{rev.quote}"
                    </p>

                  </div>
                ))}
              </div>
            </section>
          </main>

          {/* RIGHT COLUMN: "I" INDICATOR ON PALE LINE */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-28 select-none">
            <nav ref={navContainerRef} className="relative pl-6 space-y-4" aria-label="Page sections">
              {/* THE PALE LINE */}
              <div className="absolute left-1.5 -translate-x-1/2 top-1.5 bottom-1.5 w-[1.5px] bg-stone-200 rounded-full" />

              {/* THE "I" INDICATOR (Vertical capsule bar that glides on the pale line) */}
              <div
                className="absolute left-1.5 -translate-x-1/2 w-[3px] h-6 rounded-full bg-[#12231b] transition-all duration-300 ease-out pointer-events-none shadow-xs"
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
                        ? 'text-[#12231b] font-bold translate-x-1'
                        : 'text-stone-400 hover:text-stone-800 font-medium'
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

    </div>
  );
}
