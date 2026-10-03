import React from 'react';
import { ArrowRight } from 'lucide-react';

interface WhyChooseUsSectionProps {
  onBookInPerson?: () => void;
  onBookVirtual?: () => void;
}

export const WhyChooseUsSection: React.FC<WhyChooseUsSectionProps> = ({
  onBookInPerson,
  onBookVirtual,
}) => {
  return (
    <section
      id="why-choose-us"
      className="relative w-full py-16 sm:py-24 bg-[#ffffff] border-b border-[#ebe4d8] select-none"
    >
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12">
        {/* --- 1. UPPER ROW: DUAL CARE CARDS (In-Person vs Virtual) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mb-16 sm:mb-20">
          {/* Card 1: In-Person Care (Warm Blush Peach Tone) */}
          <div
            onClick={onBookInPerson}
            className="group relative rounded-[26px] sm:rounded-[30px] bg-[#faf0eb] border border-[#f2ded5] p-6 sm:p-8 lg:p-9 flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-md transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-4 sm:gap-6">
              <div className="flex-1 min-w-0 z-10">
                <h3 className="text-2xl sm:text-[26px] font-bold text-[#1c1a17] tracking-tight leading-snug">
                  In-Person Care
                </h3>
                <p className="text-xs sm:text-[13.5px] text-[#5c5850] leading-relaxed mt-2 font-normal">
                  Step into our unhurried clinic sanctuary in Indiranagar. Experience zero waiting, private doctor suites, and comprehensive on-site diagnostics.
                </p>
                <div className="mt-5 sm:mt-6 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#987224] group-hover:text-[#7a5814] transition-colors">
                  <span>Book In-Person Visit</span>
                  <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
              </div>

              {/* Stylized Lotus Sanctuary Vector Illustration (Exact match to reference design) */}
              <div className="shrink-0 w-24 sm:w-32 md:w-40 aspect-square flex items-center justify-center pointer-events-none select-none">
                <svg
                  viewBox="0 0 140 100"
                  fill="none"
                  className="w-full h-auto drop-shadow-xs transition-transform duration-500 group-hover:scale-105"
                  aria-hidden="true"
                >
                  {/* Outer Left Petal */}
                  <path
                    d="M70 82 C44 72 16 50 24 28 C42 28 60 56 70 82 Z"
                    fill="#98c9bf"
                    stroke="#44362b"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  {/* Outer Right Petal */}
                  <path
                    d="M70 82 C96 72 124 50 116 28 C98 28 80 56 70 82 Z"
                    fill="#98c9bf"
                    stroke="#44362b"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  {/* Mid Left Petal */}
                  <path
                    d="M70 82 C53 66 38 30 52 16 C68 22 70 56 70 82 Z"
                    fill="#98c9bf"
                    stroke="#44362b"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  {/* Mid Right Petal */}
                  <path
                    d="M70 82 C87 66 102 30 88 16 C72 22 70 56 70 82 Z"
                    fill="#98c9bf"
                    stroke="#44362b"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  {/* Center Petal */}
                  <path
                    d="M70 84 C58 56 60 20 70 6 C80 20 82 56 70 84 Z"
                    fill="#98c9bf"
                    stroke="#44362b"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  {/* Bottom Cup Calyx / Base Crescent */}
                  <path
                    d="M44 84 C58 91 82 91 96 84 C86 90 54 90 44 84 Z"
                    fill="#44362b"
                    stroke="#44362b"
                    strokeWidth="1"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Card 2: Virtual Care (Warm Pastel Cream Tone) */}
          <div
            onClick={onBookVirtual}
            className="group relative rounded-[26px] sm:rounded-[30px] bg-[#f8f6ea] border border-[#eee9cf] p-6 sm:p-8 lg:p-9 flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-md transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-4 sm:gap-6">
              <div className="flex-1 min-w-0 z-10">
                <h3 className="text-2xl sm:text-[26px] font-bold text-[#1c1a17] tracking-tight leading-snug">
                  Virtual Care
                </h3>
                <p className="text-xs sm:text-[13.5px] text-[#5c5850] leading-relaxed mt-2 font-normal">
                  Connect instantly via HD video from your home or while traveling. Direct doctor WhatsApp follow-ups and instant prescription delivery.
                </p>
                <div className="mt-5 sm:mt-6 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#987224] group-hover:text-[#7a5814] transition-colors">
                  <span>Start Virtual Consultation</span>
                  <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
              </div>

              {/* Stylized Telemedicine / Rolled Mat Vector Illustration (Exact match to reference design) */}
              <div className="shrink-0 w-24 sm:w-32 md:w-40 aspect-square flex items-center justify-center pointer-events-none select-none">
                <svg
                  viewBox="0 0 140 100"
                  fill="none"
                  className="w-full h-auto drop-shadow-xs transition-transform duration-500 group-hover:scale-105"
                  aria-hidden="true"
                >
                  {/* Unrolled Mat Bottom Layer (spreads underneath to the right with wave) */}
                  <path
                    d="M48 64 C65 60 92 48 116 38 C126 34 130 38 126 48 C120 62 108 72 82 76 C65 78 50 78 40 76"
                    fill="#98c9bf"
                    stroke="#44362b"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  {/* Rolled Cylinder Body */}
                  <path
                    d="M34 32 C58 30 88 42 108 54 C112 58 112 64 104 68 C88 74 62 76 34 68 Z"
                    fill="#98c9bf"
                    stroke="#44362b"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  {/* Rolled Cylinder Outer End Ellipse */}
                  <ellipse
                    cx="34"
                    cy="50"
                    rx="15"
                    ry="20"
                    fill="#98c9bf"
                    stroke="#44362b"
                    strokeWidth="2.2"
                  />
                  {/* Concentric Spiral Lines */}
                  <ellipse
                    cx="34"
                    cy="50"
                    rx="9"
                    ry="12"
                    fill="none"
                    stroke="#44362b"
                    strokeWidth="2"
                  />
                  <ellipse
                    cx="34"
                    cy="50"
                    rx="4"
                    ry="5"
                    fill="none"
                    stroke="#44362b"
                    strokeWidth="2"
                  />
                  {/* Subtle Unrolled Corner Fold Accent */}
                  <path
                    d="M110 52 C118 48 126 50 128 54 C124 58 118 60 114 58"
                    fill="#7ea89f"
                    stroke="#44362b"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* --- 2. MIDDLE ROW: HEADLINE & MISSION STATEMENT (Consistent Sans Font) --- */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-18">
          <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-bold text-[#1c1a17] tracking-tight leading-tight">
            Why Choose Us?
          </h2>
          <p className="text-sm sm:text-base text-[#5c5850] leading-relaxed mt-3.5 font-normal max-w-2xl mx-auto">
            We are offering Bengaluru a sanctuary from rushed, transactional healthcare—fostering longevity, proactive cellular wellness, and continuous doctor relationships for sustained well-being.
          </p>
        </div>

        {/* --- 3. LOWER ROW: 3 IMPACTFUL STATS / PERCENTAGES (No Dashes, Consistent Sans Font) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 text-left">
          {/* Stat 1: Patients Treated */}
          <div className="flex flex-col group">
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-5xl sm:text-6xl font-black text-[#1c1a17] tracking-tight font-sans leading-none">
                25,000+
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-[#1c1a17] tracking-tight mb-2">
              Patients &amp; Families Treated
            </h3>
            <p className="text-xs sm:text-sm text-[#5c5850] leading-relaxed font-normal">
              Over 25,000 individuals and families across Bengaluru trust Avocado for unhurried primary consultations, house calls, and 24/7 pediatric standby.
            </p>
          </div>

          {/* Stat 2: Patient Satisfaction */}
          <div className="flex flex-col group">
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-5xl sm:text-6xl font-black text-[#1c1a17] tracking-tight font-sans leading-none">
                98.4%
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-[#1c1a17] tracking-tight mb-2">
              Patient Satisfaction
            </h3>
            <p className="text-xs sm:text-sm text-[#5c5850] leading-relaxed font-normal">
              Consistently rated 4.9/5 stars for compassionate physician listening, zero-wait clinical appointments, and seamless post-visit digital follow-ups.
            </p>
          </div>

          {/* Stat 3: Early Risk Interception */}
          <div className="flex flex-col group">
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-5xl sm:text-6xl font-black text-[#1c1a17] tracking-tight font-sans leading-none">
                92%
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-[#1c1a17] tracking-tight mb-2">
              Early Risk Interception
            </h3>
            <p className="text-xs sm:text-sm text-[#5c5850] leading-relaxed font-normal">
              Of preventable cardiovascular, metabolic, and cellular health risks detected in early, reversible stages through comprehensive longevity screening.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
