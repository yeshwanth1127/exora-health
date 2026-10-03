import React from 'react';
import { branchAreaList } from '../../data/branches';

interface LightBangaloreLocationSectionProps {
  onBookVirtual?: () => void;
  onOpenBooking?: () => void;
}

export const LightBangaloreLocationSection: React.FC<LightBangaloreLocationSectionProps> = ({
  onBookVirtual,
  onOpenBooking
}) => {
  return (
    <section className="w-full py-16 sm:py-24 bg-[#e5efe2] border-y border-[#d8e6d5]" id="locations">
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
            <h2 className="font-medium text-5xl sm:text-6xl tracking-[-.05em] leading-[1.05] text-[#17372b] mb-5">
              Find an Avocado clinic near you
            </h2>

            <p className="block text-[#3d5a45] text-lg leading-relaxed mb-3">
              We offer in-person appointments in {branchAreaList}.
            </p>

            <p className="block text-[#607466] text-base leading-relaxed mb-9">
              Virtual visits available across Karnataka and pan-India.
            </p>

            {/* Action Buttons matching Tia reference */}
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={onOpenBooking}
                className="bg-[#24553c] hover:bg-[#173f2d] text-white font-semibold text-sm sm:text-base px-8 py-3.5 rounded-full transition-colors cursor-pointer"
              >
                Find a clinic near you
              </button>
              <button
                onClick={onBookVirtual || onOpenBooking}
                className="bg-[#fffefa] hover:bg-white text-[#24553c] border border-[#aac4ae] font-semibold text-sm sm:text-base px-8 py-3.5 rounded-full transition-colors cursor-pointer"
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
