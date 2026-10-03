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
    id: 'star-health',
    name: 'Star Health and Allied Insurance',
    src: '/images/star_health.svg',
    className: 'max-h-14 sm:max-h-18 md:max-h-20 max-w-[200px] sm:max-w-[250px]',
  },
  {
    id: 'hdfc-ergo',
    name: 'HDFC ERGO General Insurance',
    src: '/images/hdfc_ergo.svg',
    className: 'max-h-16 sm:max-h-20 md:max-h-22 max-w-[180px] sm:max-w-[220px]',
  },
  {
    id: 'icici-lombard',
    name: 'ICICI Lombard General Insurance',
    src: '/images/icici_lombard.svg',
    className: 'max-h-12 sm:max-h-15 md:max-h-18 max-w-[210px] sm:max-w-[260px]',
  },
  {
    id: 'bajaj-allianz',
    name: 'Bajaj Allianz Insurance',
    src: '/images/bajaj_allianz.svg',
    className: 'max-h-12 sm:max-h-15 md:max-h-18 max-w-[210px] sm:max-w-[260px]',
  },
  {
    id: 'niva-bupa',
    name: 'Niva Bupa Health Insurance',
    src: '/images/niva_bupa.svg',
    className: 'max-h-14 sm:max-h-18 md:max-h-20 max-w-[200px] sm:max-w-[240px]',
  },
  {
    id: 'digit',
    name: 'Digit Health Insurance',
    src: '/images/digit.svg',
    className: 'max-h-12 sm:max-h-15 md:max-h-18 max-w-[180px] sm:max-w-[220px]',
  },
  {
    id: 'care-health',
    name: 'Care Health Insurance',
    src: '/images/care_health.png',
    className: 'max-h-14 sm:max-h-18 md:max-h-20 max-w-[200px] sm:max-w-[240px]',
  },
  {
    id: 'tata-aig',
    name: 'TATA AIG General Insurance',
    src: '/images/tata_aig.png',
    className: 'max-h-14 sm:max-h-18 md:max-h-20 max-w-[200px] sm:max-w-[240px]',
  },
  {
    id: 'sbi-general',
    name: 'SBI General Insurance',
    src: '/images/sbi.svg',
    className: 'max-h-14 sm:max-h-18 md:max-h-20 max-w-[190px] sm:max-w-[230px]',
  },
];

interface InsurancePartnersSectionProps {
  onOpenVerification?: () => void;
}

export const InsurancePartnersSection: React.FC<InsurancePartnersSectionProps> = ({
  onOpenVerification,
}) => {
  // 6 visible logo slots across the row
  const [activeIndices, setActiveIndices] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nextPoolIndexRef = useRef<number>(6);
  const currentSlotToFlipRef = useRef<number>(5);
  const isHoveredRef = useRef<boolean>(false);

  useEffect(() => {
    // GSAP Showcase animation: every 3.2s, one slot flips 3D and reveals another authentic logo
    let interval: NodeJS.Timeout;
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
            currentSlotToFlipRef.current = (slotIdx + 1) % 6;
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
      className="w-full py-16 sm:py-20 bg-[#f6f4ef] border-b border-[#e7ded3] overflow-hidden"
      id="insurance"
      aria-label="Indian Insurance Providers"
    >
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 text-center">
        
        {/* Section Heading matching Family typography */}
        <h2 className="text-[#121212] [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif] text-3xl sm:text-4xl md:text-[2.65rem] font-medium tracking-[-1.2px] leading-tight mb-14 sm:mb-16">
          Cashless with most major Indian insurers.
        </h2>

        {/* 
          GSAP Way: Clean naked monochrome logos in a row directly on the cream background 
          No pill boxes, no backgrounds, made BIG and clearly recognizable
        */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 items-center justify-items-center gap-y-12 gap-x-8 sm:gap-x-12 mb-14 sm:mb-16"
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
                  className={`w-auto object-contain select-none transition-all duration-200 opacity-90 group-hover:opacity-100 group-hover:scale-105 filter grayscale ${provider.className || 'max-h-14 sm:max-h-18 max-w-[200px]'}`}
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
            className="inline-flex items-center justify-center rounded-full bg-[#ff5310] hover:bg-[#e04a36] text-white px-8 sm:px-10 py-3 sm:py-3.5 text-sm sm:text-[15px] font-semibold tracking-[-0.2px] shadow-sm hover:shadow-md transition-all active:scale-[0.97] cursor-pointer"
          >
            Check your cashless coverage
          </button>
        </div>

      </div>
    </section>
  );
};
