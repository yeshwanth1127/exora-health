import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
  Sparkles,
  ArrowUpRight,
  ArrowRight,
} from 'lucide-react';
import { departments } from '../../data/departments';
import { doctors } from '../../data/doctors';
import { getDepartmentTiaContent } from '../../data/departmentTiaData';
import type { Doctor } from '../../types';
import { Breadcrumbs } from '../common/Breadcrumbs';

interface Props {
  departmentId: string;
  aiRecommendation?: { query: string; matchedDoctor: Doctor; clinicalReasoning: string } | null;
  onBackToHome: () => void;
  onBackToDepartments: () => void;
  onSelectDepartment: (id: string) => void;
  onViewDoctor: (id: string) => void;
  onBookDoctor: (id: string, reason?: string) => void;
  onOpenBooking: (placement?: string) => void;
}

export function DepartmentPage({
  departmentId,
  aiRecommendation,
  onBackToHome,
  onBackToDepartments,
  onSelectDepartment,
  onViewDoctor,
  onBookDoctor,
  onOpenBooking,
}: Props) {
  const department = departments.find((d) => d.id === departmentId) || departments[0] || {
    id: departmentId || 'general-medicine',
    name: 'Clinical Care',
    description: 'Comprehensive medical specialties and personalized patient care.',
  };
  const team = doctors.filter((d) => d.departmentId === department.id);
  const content = getDepartmentTiaContent(department.id);

  // Interactive Symptom Carousel State with defensive defaults
  const slides = Array.isArray(content?.symptoms?.slides) ? content.symptoms.slides : [];
  const totalSlides = slides.length;
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const activeSlide = slides[activeSlideIndex] || slides[0] || {
    title: department?.name || 'Comprehensive Care',
    description: 'Expert, compassionate care tailored to your specific clinical needs.',
    image: '',
    imageAlt: '',
  };

  useEffect(() => setActiveSlideIndex(0), [department.id]);

  const handlePrevSlide = () => {
    if (totalSlides <= 1) return;
    setActiveSlideIndex((prev) => (prev === 0 ? totalSlides - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    if (totalSlides <= 1) return;
    setActiveSlideIndex((prev) => (prev === totalSlides - 1 ? 0 : prev + 1));
  };

  const departmentIndex = Math.max(0, departments.findIndex((d) => d.id === department.id));
  const related = departments.length > 0
    ? Array.from({ length: Math.min(4, departments.length - 1) }, (_, offset) => departments[(departmentIndex + offset + 1) % departments.length])
    : [];

  return (
    <div className="min-h-screen bg-[#FBFAF6] text-[#17372B] selection:bg-[#24553C]/20 selection:text-[#24553C]">
      {/* ── BREADCRUMBS BAR ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-2">
        <Breadcrumbs
          items={[
            { label: 'Home', onClick: onBackToHome },
            { label: 'Specialties', onClick: onBackToDepartments },
            { label: department.name },
          ]}
        />
      </div>

      {/* ── AI RECOMMENDATION BANNER (If referred from AI search) ── */}
      {aiRecommendation && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white/90 border border-[#24553C]/30 rounded-2xl shadow-xs">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#24553C]">
                <Sparkles className="size-3.5" /> AI Recommended Care
              </span>
              <p className="text-sm font-semibold text-[#17372B]">
                Matched for "{aiRecommendation.query}": {aiRecommendation.clinicalReasoning}
              </p>
            </div>
            <button
              onClick={() => onViewDoctor(aiRecommendation.matchedDoctor.id)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#24553C] hover:underline shrink-0"
            >
              Meet {aiRecommendation.matchedDoctor.name} <ArrowUpRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── 1. HERO SECTION (1:1 with media_1790783755327.png) ── */}
      <section className="relative overflow-hidden pt-8 pb-16 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Column: Editorial Headline, 3 Checkmark Bullets, Dual CTAs */}
            <div className="lg:col-span-7 space-y-7">
              <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-medium tracking-tight text-[#17372B] leading-[1.14]">
                {content.hero.title}
              </h1>

              {/* Three care highlights */}
              <div className="space-y-3.5 pt-1">
                {content.hero.bullets.map((bullet, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-sm sm:text-base text-[#435B4A] leading-snug">
                    <div className="size-5 rounded-full bg-[#24553C] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Check className="size-3 stroke-[3]" />
                    </div>
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>

              {/* Action Buttons: Coral Pill & Outline Pill */}
              <div className="flex flex-wrap items-center gap-4 pt-3">
                <button
                  onClick={() => onOpenBooking('department_hero')}
                  className="px-7 py-3.5 rounded-full bg-[#24553C] hover:bg-[#173F2D] text-white font-semibold text-sm shadow-sm transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  Book an appointment
                </button>
                <a
                  href="#specialists-section"
                  className="px-7 py-3.5 rounded-full border border-[#24553C] hover:bg-[#E8F0E5] text-[#17372B] font-semibold text-sm transition-colors cursor-pointer"
                >
                  Meet the care team
                </a>
              </div>
            </div>

            {/* Right Column: Warm Lifestyle Consultation Photo */}
            <div className="lg:col-span-5">
              <div className="relative rounded-[32px] overflow-hidden shadow-sm aspect-[4/3] bg-[#E5EEE2] border border-[#DCE7DA]/50">
                <img
                  src={content.hero.image}
                  alt={content.hero.imageAlt}
                  className="w-full h-full object-cover object-center"
                  onError={(e) => {
                    const image = e.currentTarget;
                    if (!image.src.endsWith('/clients/sri-lakshmi/36f2a4cf-home-page-banner.png')) image.src = '/clients/sri-lakshmi/36f2a4cf-home-page-banner.png';
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Subtle Organic Background Wave Contour */}
        <div className="w-full overflow-hidden leading-none mt-12 pointer-events-none text-[#E8F0E5]" aria-hidden="true">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full h-8 sm:h-10 text-current" preserveAspectRatio="none">
            <path
              d="M0,20 C320,40 480,0 720,20 C960,40 1200,0 1440,20 L1440,40 L0,40 Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </section>

      {/* ── 2. SERVICES OFFERED 6-CARD GRID (1:1 with media_1790783755314.png) ── */}
      <section className="bg-[#E8F0E5] py-16 sm:py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-medium text-[#17372B] mb-10 text-left leading-tight">
            {content.services.heading}
          </h2>

          {/* 3-Column Grid of Clean White Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
            {content.services.items.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-7 sm:p-8 flex flex-col justify-between shadow-2xs hover:shadow-md transition-all duration-300 border border-[#E8EFE6]"
              >
                <div>
                  {/* Category Pill Tag (e.g. Primary Care, Gynecology) */}
                  <span className="inline-block bg-[#24553C] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-sm uppercase tracking-wider mb-4">
                    {item.category}
                  </span>

                  {/* Card Title */}
                  <h3 className="text-xl font-bold text-[#17372B] leading-snug mb-3">
                    {item.title}
                  </h3>

                  {/* Description Paragraph */}
                  <p className="text-sm leading-relaxed text-[#5D7163] mb-6">
                    {item.description}
                  </p>
                </div>

                {/* Booking action */}
                <div className="pt-2 border-t border-[#E8EFE6]/60 mt-auto">
                  <button
                    onClick={() => onOpenBooking('department_services_grid')}
                    className="font-bold text-sm text-[#17372B] underline underline-offset-4 hover:text-[#24553C] transition-colors cursor-pointer block text-left"
                  >
                    Book appointment
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Wave Divider to Next Section */}
        <div className="w-full overflow-hidden leading-none mt-16 pointer-events-none text-[#FBFAF6]" aria-hidden="true">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full h-8 sm:h-10 text-current" preserveAspectRatio="none">
            <path
              d="M0,20 C360,0 720,40 1080,10 C1260,-5 1380,25 1440,20 L1440,40 L0,40 Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </section>

      {/* ── 3. "SYMPTOMS WE CAN HELP WITH" CAROUSEL (1:1 with media_1790783755319.png) ── */}
      <section className="py-16 sm:py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-medium text-[#17372B] mb-8">
            {content.symptoms.heading}
          </h2>

          {/* Featured symptom card */}
          <div className="bg-[#24553C] rounded-3xl overflow-hidden shadow-lg grid grid-cols-1 lg:grid-cols-12 min-h-[380px]">
            {/* Left content area */}
            <div className="lg:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-between text-white">
              <div>
                <h3 className="text-3xl sm:text-4xl font-normal text-white mb-4 leading-snug">
                  {activeSlide.title}
                </h3>
                <p className="text-white/85 text-base sm:text-lg leading-relaxed max-w-xl mb-8">
                  {activeSlide.description}
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap items-center gap-4 mb-8">
                  <button
                    onClick={() => onOpenBooking('department_symptoms_slider')}
                    className="px-6 py-2.5 rounded-full bg-[#E8F0E5] hover:bg-white text-[#17372B] font-semibold text-sm shadow-sm transition-colors cursor-pointer"
                  >
                    Book appointment
                  </button>
                  <a
                    href="#specialists-section"
                    className="px-6 py-2.5 rounded-full border border-white/60 hover:bg-white/10 text-white font-semibold text-sm transition-colors cursor-pointer"
                  >
                    Learn more
                  </a>
                </div>
              </div>

              {/* Carousel Navigation: Arrow Left, Dots, Arrow Right */}
              <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handlePrevSlide}
                  aria-label="Previous symptom"
                  className="text-white hover:text-white/80 p-1.5 transition-transform active:scale-90 cursor-pointer"
                >
                  <ChevronLeft className="size-5" />
                </button>

                <div className="flex items-center gap-2">
                  {content.symptoms.slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveSlideIndex(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      className={`size-2 rounded-full transition-all cursor-pointer ${
                        i === activeSlideIndex
                          ? 'bg-white scale-125'
                          : 'bg-white/40 hover:bg-white/70'
                      }`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleNextSlide}
                  aria-label="Next symptom"
                  className="text-white hover:text-white/80 p-1.5 transition-transform active:scale-90 cursor-pointer"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
            </div>

            {/* Right Contextual Photograph */}
            <div className="lg:col-span-5 relative min-h-[320px] lg:min-h-full h-full bg-[#1D4833] overflow-hidden">
              <img
                src={activeSlide.image}
                alt={activeSlide.imageAlt}
                className="absolute inset-0 w-full h-full object-cover object-center"
                onError={(e) => {
                  const image = e.currentTarget;
                  if (!image.src.endsWith(content.hero.image)) image.src = content.hero.image;
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. "WHY [SPECIALTY] MATTERS" 3-CARD SECTION (1:1 with media_1790783755331.png) ── */}
      <section className="py-16 sm:py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-medium text-[#17372B] mb-10 text-left leading-tight">
            {content.whyMatters.heading}
          </h2>

          {/* 3 Value Cards with Signature Wavy Zigzag Divider Lines */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-7">
            {content.whyMatters.pillars.map((pillar, idx) => (
              <div
                key={idx}
                className="bg-[#F4F7F0] sm:bg-white/90 rounded-2xl p-7 sm:p-8 border border-[#DCE7DA]/60 shadow-2xs flex flex-col justify-start"
              >
                {/* Bold Heading */}
                <h3 className="text-xl font-bold text-[#17372B] leading-snug mb-3">
                  {pillar.title}
                </h3>

                {/* Signature Wavy Zigzag SVG Divider (media_1790783755331.png) */}
                <div className="w-full overflow-hidden my-3 text-[#17372B]" aria-hidden="true">
                  <svg viewBox="0 0 300 12" fill="none" className="w-full h-3">
                    <path
                      d="M0,6 Q 7.5,0 15,6 T 30,6 T 45,6 T 60,6 T 75,6 T 90,6 T 105,6 T 120,6 T 135,6 T 150,6 T 165,6 T 180,6 T 195,6 T 210,6 T 225,6 T 240,6 T 255,6 T 270,6 T 285,6 T 300,6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                    />
                  </svg>
                </div>

                {/* Empathetic Description */}
                <p className="text-[#435B4A] text-sm leading-relaxed mt-2">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. SPECIALISTS & CARE TEAM SECTION ── */}
      <section id="specialists-section" className="py-16 sm:py-20 bg-white/70 border-t border-[#DCE7DA]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#24553C]">
                Clinical Excellence
              </span>
              <h2 className="text-3xl sm:text-4xl font-medium text-[#17372B] mt-1">
                Meet the {department.name} care team
              </h2>
            </div>
            <button
              onClick={() => onOpenBooking('department_team_section')}
              className="text-sm font-semibold text-[#24553C] hover:underline self-start sm:self-auto cursor-pointer"
            >
              View all consultation slots &rarr;
            </button>
          </div>

          {team.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {team.map((doctor) => (
                <div
                  key={doctor.id}
                  className="bg-white rounded-2xl border border-[#DCE7DA]/70 p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="size-16 rounded-xl overflow-hidden bg-[#EDF3EC] shrink-0 border border-[#DCE7DA]">
                        <img
                          src={doctor.image}
                          alt={doctor.name}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg text-[#17372B] leading-snug">
                          {doctor.name}
                        </h3>
                        <p className="text-xs text-[#5D7163] line-clamp-1">{doctor.title}</p>
                        <p className="mt-1 text-xs font-medium text-[#587462]">{department.name}</p>
                      </div>
                    </div>

                    <p className="text-xs text-[#5D7163] line-clamp-3 leading-relaxed mb-4">
                      {doctor.bio}
                    </p>

                    <div className="text-xs text-[#6B7D70] flex items-center gap-1.5 mb-5">
                      <MapPin className="size-3.5 text-[#859889] shrink-0" />
                      <span className="truncate">{doctor.roomNumber}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-[#E8EFE6]">
                    <button
                      onClick={() => onViewDoctor(doctor.id)}
                      className="flex-1 py-2 px-3 rounded-full border border-[#24553C] text-[#17372B] hover:bg-[#E8F0E5] text-xs font-semibold text-center transition-colors cursor-pointer"
                    >
                      View profile
                    </button>
                    <button
                      onClick={() => onBookDoctor(doctor.id)}
                      className="flex-1 py-2 px-3 rounded-full bg-[#24553C] hover:bg-[#173F2D] text-white text-xs font-semibold text-center shadow-2xs transition-colors cursor-pointer"
                    >
                      Book visit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 border border-[#DCE7DA] text-center space-y-3">
              <p className="text-[#435B4A] font-medium">
                Our care coordinators can match you with the ideal specialist in {department.name}.
              </p>
              <button
                onClick={() => onOpenBooking('department_specialists_unmatched')}
                className="px-6 py-2.5 rounded-full bg-[#24553C] text-white font-semibold text-sm hover:bg-[#173F2D] transition-colors cursor-pointer"
              >
                Request an appointment
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── 6. BOOK AN APPOINTMENT ── */}
      <section className="py-16 sm:py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#1F5037] rounded-3xl p-8 sm:p-12 lg:p-14 text-white relative overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-center gap-8 shadow-xl">
            {/* Left Content */}
            <div className="lg:col-span-8 z-10 space-y-5">
              <h2 className="text-3xl sm:text-4xl font-normal text-white leading-snug">
                {content.cta.heading}
              </h2>
              <p className="text-white/85 text-sm sm:text-base leading-relaxed max-w-2xl">
                {content.cta.description}
              </p>

              {/* Dual Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => onOpenBooking('department_charcoal_banner')}
                  className="px-7 py-3 rounded-full bg-[#E8F0E5] hover:bg-white text-[#17372B] font-semibold text-sm shadow-sm transition-colors cursor-pointer"
                >
                  Book an appointment
                </button>
                <a
                  href="#specialists-section"
                  className="px-7 py-3 rounded-full border border-white/60 hover:bg-white/10 text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  Learn more about care
                </a>
              </div>
            </div>

            {/* Right contour line art */}
            <div className="lg:col-span-4 relative flex justify-center lg:justify-end items-center pointer-events-none select-none">
              <svg
                viewBox="0 0 200 240"
                fill="none"
                className="w-44 sm:w-56 h-auto stroke-[#A9C9AE] stroke-[2.5] stroke-linecap-round opacity-90"
              >
                <path d="M 120,10 C 95,45 85,65 112,95 C 138,125 156,145 120,190 C 88,230 100,238 126,240" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. ADDITIONAL RESOURCES (1:1 with media_1790783775609.png) ── */}
      {content.resources?.articles && content.resources.articles.length > 0 && (
        <section className="bg-[#E8F0E5] text-[#17372B] py-16 sm:py-20 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-medium text-[#17372B] mb-8">
              {content.resources.heading}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {content.resources.articles.map((article, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl overflow-hidden border border-[#DCE7DA] hover:border-[#9FBEA4] transition-all flex flex-col justify-between"
                >
                  <div className="p-7 sm:p-8 space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#24553C]">
                      {article.tag}
                    </span>
                    <h3 className="text-xl font-bold text-[#17372B] leading-snug">
                      {article.title}
                    </h3>
                    <p className="text-sm text-[#5D7163] leading-relaxed pt-1">
                      {article.snippet}
                    </p>
                  </div>
                  <div className="p-7 sm:p-8 pt-0">
                    <button
                      onClick={() => onOpenBooking('department_resources')}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#24553C] hover:text-[#17372B] transition-colors cursor-pointer"
                    >
                      Plan a visit <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 8. EXPLORE OTHER SPECIALTIES ── */}
      <section className="py-16 sm:py-20 bg-[#FBFAF6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-6 mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#24553C]">
                Comprehensive Hospital Network
              </span>
              <h2 className="text-2xl sm:text-3xl font-medium text-[#17372B] mt-1">
                Explore other specialties
              </h2>
            </div>
            <button
              onClick={onBackToDepartments}
              className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-[#17372B] hover:text-[#24553C] transition-colors cursor-pointer"
            >
              View all specialties &rarr;
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {related.map((dept) => (
              <button
                key={dept.id}
                onClick={() => onSelectDepartment(dept.id)}
                className="bg-white rounded-2xl p-5 text-left border border-[#DCE7DA]/60 hover:border-[#9FBEA4] shadow-2xs hover:shadow-sm transition-all group cursor-pointer flex flex-col justify-between h-32"
              >
                <span className="font-bold text-sm text-[#17372B] group-hover:text-[#24553C] transition-colors line-clamp-2">
                  {dept.name}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-[#6B7D70] font-semibold group-hover:text-[#24553C]">
                  Learn more <ArrowUpRight className="size-3" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
