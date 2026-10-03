import React from 'react';

interface AccreditationLogo {
  id: string;
  name: string;
  src: string;
  className?: string;
}

// 5 Genuine, Official India-Specific Healthcare Accreditation & Council Logos (Slightly Bigger Scale)
const ACCREDITATION_LOGOS: AccreditationLogo[] = [
  {
    id: 'nabh',
    name: 'National Accreditation Board for Hospitals & Healthcare Providers (NABH)',
    src: '/images/accreditations/nabh_real.png',
    className: 'max-h-20 sm:max-h-24 md:max-h-28 max-w-[210px]',
  },
  {
    id: 'nabl',
    name: 'National Accreditation Board for Testing and Calibration Laboratories (NABL)',
    src: '/images/accreditations/nabl_real.png',
    className: 'max-h-20 sm:max-h-24 md:max-h-28 max-w-[210px]',
  },
  {
    id: 'qci',
    name: 'Quality Council of India (QCI)',
    src: '/images/accreditations/qci_real.png',
    className: 'max-h-16 sm:max-h-20 md:max-h-24 max-w-[260px]',
  },
  {
    id: 'icmr',
    name: 'Indian Council of Medical Research (ICMR)',
    src: '/images/accreditations/icmr_real.svg',
    className: 'max-h-16 sm:max-h-20 md:max-h-24 max-w-[250px]',
  },
  {
    id: 'ahpi',
    name: 'Association of Healthcare Providers India (AHPI)',
    src: '/images/accreditations/ahpi_real.png',
    className: 'max-h-16 sm:max-h-20 md:max-h-24 max-w-[260px]',
  },
];

export const AccreditationsSection: React.FC = () => {
  return (
    <section
      className="w-full bg-[#f6f4ef] py-12 sm:py-16 border-b border-[#e5dfd5] [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif]"
      aria-label="Medical Accreditations"
    >
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* Exact format as Insurance Companies: Clean naked monotone logos directly on cream background */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 items-center justify-items-center gap-y-12 gap-x-8 sm:gap-x-12">
          {ACCREDITATION_LOGOS.map((item) => (
            <div
              key={item.id}
              title={item.name}
              className="group flex items-center justify-center h-24 sm:h-28 md:h-32 w-full cursor-default"
            >
              <img
                src={item.src}
                alt={item.name}
                className={`w-auto object-contain select-none transition-all duration-200 opacity-85 group-hover:opacity-100 group-hover:scale-105 filter grayscale mix-blend-multiply ${item.className || 'max-h-20 sm:max-h-24 max-w-[220px]'}`}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
