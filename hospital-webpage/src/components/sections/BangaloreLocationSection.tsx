import React from 'react';
import { branchAreaList } from '../../data/branches';

interface BangaloreLocationSectionProps {
  onBookVirtual?: () => void;
  onOpenBooking?: () => void;
}

export const BangaloreLocationSection: React.FC<BangaloreLocationSectionProps> = ({
  onBookVirtual,
  onOpenBooking
}) => {
  return (
    <section className="w-full py-12 sm:py-14 bg-[#e8ded0] border-y border-[#ddd2c0]" id="locations">
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] items-center gap-12 lg:gap-20">
          
          {/* Left Column: Real Bangalore Map with Thin Lines, Shaded Hubs & Teardrop Pins */}
          <div className="relative flex items-center justify-center p-2 sm:p-6">
            <img
              src="/images/bangalore_real_map.svg"
              alt="Real Map of Bangalore Clinics"
              className="w-full max-w-[520px] h-auto drop-shadow-sm select-none"
            />
          </div>

          {/* Right Column: Clean Content matching Tia Reference with Unified Font */}
          <div className="flex flex-col items-start max-w-xl">
            <h2 className="block text-color-002 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif,_'Segoe_UI_Emoji',_'Segoe_UI_Symbol'] text-[2.75rem] font-medium leading-12 tracking-[-1.35px] [-webkit-text-stroke:0.001px_var(--clr-3)] max-md:text-[2rem] max-md:leading-[2.1875rem] max-md:tracking-[-0.69px] mb-4">
              Find an Avocado clinic near you
            </h2>

            <p className="block text-[#343433] text-[1.1875rem] leading-[1.6875rem] tracking-[-0.3px] mb-3">
              We offer in-person appointments in {branchAreaList}.
            </p>

            <p className="block text-[#6a6866] text-[0.9375rem] font-normal leading-5.5 tracking-[-0.13px] mb-9">
              Virtual visits available across Karnataka and pan-India.
            </p>

            {/* Action Buttons matching Tia reference */}
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={onOpenBooking}
                className="bg-[#f05a46] hover:bg-[#e04a36] text-white font-medium text-sm sm:text-base px-8 py-3.5 rounded-full shadow-sm hover:shadow transition-all cursor-pointer"
              >
                Find a clinic near you
              </button>
              <button
                onClick={onBookVirtual || onOpenBooking}
                className="bg-[#fbfaf9] hover:bg-white text-[#121212] border border-black/10 font-medium text-sm sm:text-base px-8 py-3.5 rounded-full shadow-sm hover:shadow transition-all cursor-pointer"
              >
                Book a virtual visit
              </button>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};
