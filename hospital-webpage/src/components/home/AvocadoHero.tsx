import React from 'react';
import { ArrowDown } from 'lucide-react';
import { HeroBookingBar } from './HeroBookingBar';

interface AvocadoHeroProps {
  onGetStarted?: () => void;
  onOpenBooking?: () => void;
  onOpenLogin?: () => void;
  user?: { name: string; identifier: string } | null;
  onNavigate?: (section: string) => void;
  bookingBarPosition?: 'top' | 'bottom';
  onSearchBooking?: (details: {
    specialty: string;
    location: string;
    date: string;
    patientType: string;
  }) => void;
}

export const AvocadoHero: React.FC<AvocadoHeroProps> = ({
  onGetStarted,
  onOpenBooking,
  onNavigate,
  bookingBarPosition = 'top',
  onSearchBooking,
}) => {
  return (
    <section id="home" className="relative w-full min-h-screen flex flex-col justify-end p-6 sm:p-10 lg:p-14 pt-28 sm:pt-36 pb-12 sm:pb-16 overflow-hidden bg-slate-900 rounded-bl-[14px] rounded-br-[14px] shadow-lg select-none">
      
      {/* Edge-to-Edge Photorealistic Telehealth Doctor Background */}
      <img
        src="/images/avocado-hero-bg.jpg"
        alt="Avocado Health Telemedicine Doctor"
        className="absolute inset-0 w-full h-full object-cover object-[center_28%] pointer-events-none"
      />

      {/* Subtle Cinematic Vignette / Overlays for 100% crisp typography */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
      <div className="absolute inset-y-0 left-0 w-3/5 bg-gradient-to-r from-black/40 via-black/15 to-transparent pointer-events-none" />

      {/* --- Hero Content: Headline, CTA & Scroll Down Button --- */}
      <div className="relative z-20 w-full max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        
        {/* Left Column: Headline & Actions */}
        <div className="max-w-3xl lg:max-w-4xl w-full">
          {/* Mode 1: Right on top of the hero statement */}
          {bookingBarPosition === 'top' && (
            <div className="mb-5 sm:mb-6">
              <HeroBookingBar onSearch={onSearchBooking} />
            </div>
          )}

          <h1 className="text-white font-bold text-4xl sm:text-5xl md:text-[3.75rem] lg:text-[4.25rem] xl:text-[4.75rem] leading-[1.08] tracking-[-1.5px] drop-shadow-md">
            Avocado Health: Your<br />
            Wellness, Our Digital Care
          </h1>

          {/* Mode 2: Below "Your Wellness..." (Bottom Placement) */}
          {bookingBarPosition === 'bottom' ? (
            <div className="mt-6 sm:mt-7">
              <HeroBookingBar onSearch={onSearchBooking} />
            </div>
          ) : (
            <div className="mt-6 sm:mt-7">
              <button
                onClick={onGetStarted || onOpenBooking}
                className="bg-white text-[#154734] font-semibold text-sm sm:text-[15px] px-7 py-3 rounded-full shadow-lg hover:bg-white/95 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer inline-flex items-center gap-2"
              >
                Get started
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Circular Down Arrow Button */}
        <div className="self-end sm:self-auto flex items-center justify-end">
          <button
            onClick={() => onNavigate?.('services')}
            aria-label="Scroll to discover more"
            className="w-11 h-11 rounded-full bg-white text-[#154734] flex items-center justify-center shadow-lg hover:bg-white/95 hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            <ArrowDown className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

      </div>

    </section>
  );
};
