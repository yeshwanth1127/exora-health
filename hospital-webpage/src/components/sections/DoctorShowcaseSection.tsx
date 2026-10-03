import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Play, Clock, Volume2 } from 'lucide-react';

interface DoctorShowcaseSectionProps {
  onBookAppointment?: () => void;
}

interface ShowcaseItem {
  id: string;
  doctorName: string;
  doctorRole: string;
  videoTitle: string;
  subtitle: string;
  quote: string;
  location: string;
  duration: string;
  image: string;
}

const showcases: ShowcaseItem[] = [
  {
    id: 'vikram-rao',
    doctorName: 'Dr. Vikram Rao, MD',
    doctorRole: 'Chief Medical Director & Senior Cardiologist',
    videoTitle: 'Dr. Vikram Rao: Why We Built Avocado Health',
    subtitle: 'A candid conversation on modern hospital care in Bengaluru',
    quote:
      'Healthcare shouldn’t feel like navigating an airport terminal. We built Avocado so your physician actually listens, insurance claims clear before you arrive, and families are treated with dignity.',
    location: 'Indiranagar Flagship Clinic • 100 Feet Rd',
    duration: '02:15',
    image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=2000&q=85',
  },
  {
    id: 'ananya-sharma',
    doctorName: 'Dr. Ananya Sharma, MD',
    doctorRole: 'Head of Inpatient & Preventative Care',
    videoTitle: 'Dr. Ananya Sharma: The Zero-Paperwork Hospital',
    subtitle: 'Inside our automated intake & cashless claim process',
    quote:
      'When someone is unwell, filling out 14-page admission binders is archaic. At Avocado, our digital concierge verifies cashless claims in 90 seconds so families focus solely on healing.',
    location: 'Koramangala Care Center • 80 Feet Rd',
    duration: '01:48',
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=2000&q=85',
  },
  {
    id: 'siddharth-mukherjee',
    doctorName: 'Dr. Siddharth Mukherjee, MS, MCh',
    doctorRole: 'Senior Surgical Director & Robotic Care Lead',
    videoTitle: 'Dr. Siddharth Mukherjee: Precision & Empathy',
    subtitle: 'Minimally invasive surgery with same-day recovery',
    quote:
      'Robotic precision allows microscopic millimeter incisions and rapid recovery. But the most important instrument is the time we spend explaining every step to the patient beforehand.',
    location: 'Whitefield Technology Hub • EPIP Zone',
    duration: '02:40',
    image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=2000&q=85',
  },
];

export const DoctorShowcaseSection: React.FC<DoctorShowcaseSectionProps> = ({ onBookAppointment }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const current = showcases[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? showcases.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === showcases.length - 1 ? 0 : prev + 1));
  };

  const handlePlay = () => {
    setToastMessage(`Video coming soon — ${current.doctorName}'s marketing keynote is currently in post-production.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <section
      className="w-full bg-[#f6f4ef] pt-8 pb-20 sm:pb-28 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif]"
      id="showcase"
      aria-label="Doctor Video Showcase"
    >
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* ── Section Title (1:1 GSAP Style on Cream Background) ── */}
        <div className="mb-8 sm:mb-10">
          <h2 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-medium tracking-[-1.5px] leading-[1.1] text-[#121212]">
            Showcase
          </h2>
          <p className="mt-2 text-sm sm:text-base text-[#666] tracking-[-0.2px]">
            A candid invitation from our physicians to Bengaluru families.
          </p>
        </div>

        {/* ── ONE Clean Video Rectangle (Standard 16:9 Widescreen for Video Content) ── */}
        <div className="relative w-full max-w-5xl mx-auto rounded-2xl sm:rounded-3xl overflow-hidden bg-[#121212] aspect-video shadow-2xl border border-[#ded7cb]">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 w-full h-full"
            >
              {/* Clean Physician Visual */}
              <img
                src={current.image}
                alt={current.doctorName}
                className="w-full h-full object-cover object-center filter brightness-[0.55] contrast-[1.05]"
              />

              {/* Clean gradient for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/40 pointer-events-none" />

              {/* Top Meta inside video: Location and "Coming Soon" Pill */}
              <div className="absolute top-4 sm:top-6 inset-x-4 sm:inset-x-8 flex items-center justify-between z-10">
                <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-white/90 bg-black/40 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-white/15">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  {current.doctorName}
                </span>

                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 bg-black/60 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-amber-400/30">
                  <Clock className="size-3.5 text-amber-400" />
                  Coming Soon
                </span>
              </div>

              {/* Center Play Button & Quote */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 sm:px-14 lg:px-24 z-10">
                <button
                  type="button"
                  onClick={handlePlay}
                  aria-label={`Play ${current.videoTitle} (Coming soon)`}
                  className="group size-16 sm:size-20 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer mb-5"
                >
                  <Play className="size-6 sm:size-7 fill-black translate-x-0.5 text-black" />
                </button>

                <p className="max-w-2xl text-base sm:text-lg lg:text-xl font-normal text-white/95 leading-relaxed italic tracking-[-0.2px]">
                  &ldquo;{current.quote}&rdquo;
                </p>
              </div>

              {/* Bottom Video Progress Bar (00:00 / Duration) */}
              <div className="absolute bottom-4 sm:bottom-6 inset-x-4 sm:inset-x-8 flex items-center justify-between text-xs text-neutral-300 z-10">
                <div className="flex items-center gap-3">
                  <span className="font-mono">{current.duration}</span>
                  <div className="w-24 sm:w-44 h-1 rounded-full bg-white/25 overflow-hidden">
                    <div className="w-1/3 h-full bg-white rounded-full" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline text-neutral-400">Marketing Video</span>
                  <Volume2 className="size-4 text-neutral-400" />
                </div>
              </div>

              {/* Toast Message when Play is clicked */}
              <AnimatePresence>
                {toastMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="absolute inset-x-6 top-1/2 -translate-y-1/2 z-20 mx-auto max-w-md bg-neutral-900/95 text-white rounded-xl p-4 border border-white/20 text-center shadow-2xl backdrop-blur-md"
                  >
                    <p className="text-xs sm:text-sm leading-relaxed">{toastMessage}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Bottom Controls (1:1 GSAP Reference Layout on Cream Background) ── */}
        <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left: Video Meta & Pill Button */}
          <div className="flex flex-col items-start gap-4 max-w-xl">
            <div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                >
                  <h3 className="text-xl sm:text-2xl font-medium tracking-tight text-[#121212]">
                    {current.videoTitle}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-[#666]">
                    {current.doctorRole} • {current.location}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* GSAP 1:1 Pill Button */}
            <button
              type="button"
              onClick={onBookAppointment}
              className="inline-flex items-center justify-center rounded-full border border-[#121212] hover:bg-[#121212] text-[#121212] hover:text-white px-6 py-2.5 text-sm font-medium tracking-[-0.2px] transition-all duration-200 cursor-pointer shadow-xs active:scale-[0.98]"
            >
              Book an In-Person Consultation
            </button>
          </div>

          {/* Right: Circular Navigation Arrow Buttons */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            <span className="text-xs font-mono text-[#777] mr-1 tabular-nums">
              0{currentIndex + 1} / 0{showcases.length}
            </span>

            {/* Left Arrow Button */}
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous showcase reel"
              className="size-11 sm:size-12 rounded-full border border-[#ccc] hover:border-[#121212] text-[#121212] flex items-center justify-center transition-all duration-150 hover:bg-black/5 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="size-4.5 sm:size-5" />
            </button>

            {/* Right Arrow Button */}
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next showcase reel"
              className="size-11 sm:size-12 rounded-full border border-[#ccc] hover:border-[#121212] text-[#121212] flex items-center justify-center transition-all duration-150 hover:bg-black/5 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <ArrowRight className="size-4.5 sm:size-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
