import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface IndianInsuranceProvider {
  id: string;
  name: string;
  src: string;
  className?: string;
}

// Authentic major Indian insurance providers with real corporate logos
const INDIAN_INSURANCE_LOGOS: IndianInsuranceProvider[] = [
  {
    "id": "star-health",
    "name": "Star Health Insurance",
    "src": "/images/star_health.svg",
    "className": "max-h-14 sm:max-h-18 md:max-h-20 max-w-[200px] sm:max-w-[250px]"
  },
  {
    "id": "hdfc-ergo",
    "name": "HDFC ERGO",
    "src": "/images/hdfc_ergo.svg",
    "className": "max-h-14 sm:max-h-18 md:max-h-20 max-w-[200px] sm:max-w-[250px]"
  },
  {
    "id": "icici-lombard",
    "name": "ICICI Lombard",
    "src": "/images/icici_lombard.svg",
    "className": "max-h-14 sm:max-h-18 md:max-h-20 max-w-[200px] sm:max-w-[250px]"
  },
  {
    "id": "bajaj-allianz",
    "name": "Bajaj Allianz",
    "src": "/images/bajaj_allianz.svg",
    "className": "max-h-14 sm:max-h-18 md:max-h-20 max-w-[200px] sm:max-w-[250px]"
  },
  {
    "id": "max-bupa",
    "name": "Max Bupa (name used on hospital site)",
    "src": "/images/niva_bupa.svg",
    "className": "max-h-14 sm:max-h-18 md:max-h-20 max-w-[200px] sm:max-w-[250px]"
  }
];

const SLOTS = Math.min(6, INDIAN_INSURANCE_LOGOS.length);

interface LightInsurancePartnersSectionProps {
  onOpenVerification?: () => void;
}

export const LightInsurancePartnersSection: React.FC<LightInsurancePartnersSectionProps> = ({
  onOpenVerification,
}) => {
  // Up to 6 visible logo slots; never more slots than logos.
  const [activeIndices, setActiveIndices] = useState<number[]>(() => Array.from({ length: SLOTS }, (_, i) => i));
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nextPoolIndexRef = useRef<number>(SLOTS);
  const currentSlotToFlipRef = useRef<number>(SLOTS - 1);
  const isHoveredRef = useRef<boolean>(false);

  useEffect(() => {
    // GSAP Showcase animation: every 3.2s, one slot flips 3D and reveals another authentic logo
    // Nothing to flip in when every logo is already showing.
    if (INDIAN_INSURANCE_LOGOS.length <= SLOTS) return;
    let interval: ReturnType<typeof setInterval>;
    const initialTimeout = setTimeout(() => {
      interval = setInterval(() => {
        if (isHoveredRef.current) return;

        const slotIdx = currentSlotToFlipRef.current;
        const targetEl = slotRefs.current[slotIdx];
        if (!targetEl) return;

        // GSAP 3D flip animation
        const tl = gsap.timeline();

        tl.to(targetEl, {
          rotateX: 90,
          opacity: 0,
          duration: 0.35,
          ease: 'power2.in',
          onComplete: () => {
            // Swap to next authentic Indian insurance logo from pool
            const nextIdx = nextPoolIndexRef.current % INDIAN_INSURANCE_LOGOS.length;
            nextPoolIndexRef.current += 1;

            setActiveIndices((prev) => {
              const updated = [...prev];
              updated[slotIdx] = nextIdx;
              return updated;
            });

            // Cycle which slot flips next
            currentSlotToFlipRef.current = (slotIdx + 1) % SLOTS;
          },
        });

        tl.fromTo(
          targetEl,
          { rotateX: -90, opacity: 0 },
          {
            rotateX: 0,
            opacity: 1,
            duration: 0.45,
            ease: 'back.out(1.4)',
          }
        );
      }, 3200);
    }, 2500);

    return () => {
      clearTimeout(initialTimeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <section
      className="w-full py-20 sm:py-24 bg-[#fffefa] border-b border-[#e1e9df] overflow-hidden"
      id="insurance"
      aria-label="Indian Insurance Providers"
    >
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 text-center">

        {/* Section Heading matching Family typography */}
        <h2 className="text-[#17372b] font-medium text-5xl sm:text-6xl tracking-[-.05em] leading-[1.04] mb-14 sm:mb-16">
          Cashless with most major Indian insurers.
        </h2>

        {/*
          GSAP Way: Clean naked monochrome logos in a row directly on the cream background
          No pill boxes, no backgrounds, made BIG and clearly recognizable
        */}
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 ${SLOTS === 6 ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} items-center justify-items-center gap-y-12 gap-x-5 sm:gap-x-12 mb-14 sm:mb-16`}
          style={{ perspective: '1000px' }}
          onMouseEnter={() => {
            isHoveredRef.current = true;
          }}
          onMouseLeave={() => {
            isHoveredRef.current = false;
          }}
        >
          {activeIndices.map((providerIdx, slotIdx) => {
            const provider = INDIAN_INSURANCE_LOGOS[providerIdx];
            return (
              <div
                key={`slot-${slotIdx}`}
                ref={(el) => {
                  slotRefs.current[slotIdx] = el;
                }}
                style={{
                  transformStyle: 'preserve-3d',
                  willChange: 'transform, opacity',
                }}
                onClick={onOpenVerification}
                title={`${provider.name} - Click to verify coverage`}
                className="group flex items-center justify-center h-20 sm:h-24 md:h-28 w-full cursor-pointer"
              >
                <img
                  src={provider.src}
                  alt={provider.name}
                  className={`w-auto !max-w-full object-contain select-none transition-all duration-200 opacity-90 group-hover:opacity-100 group-hover:scale-105 filter grayscale ${provider.className || 'max-h-14 sm:max-h-18 max-w-[200px]'}`}
                />
              </div>
            );
          })}
        </div>

        {/* Coral Pill Button */}
        <div className="flex items-center justify-center">
          <button
            onClick={onOpenVerification}
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-[#24553c] hover:bg-[#173f2d] text-white px-8 sm:px-10 py-3 sm:py-3.5 text-sm sm:text-[15px] font-semibold tracking-[-0.2px] transition-colors cursor-pointer"
          >
            Ask about cashless coverage
          </button>
        </div>

      </div>
    </section>
  );
};
