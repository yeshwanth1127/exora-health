import React from 'react';

interface DepartmentCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  departmentId: string;
}

const DEPARTMENTS: DepartmentCard[] = [
  {
    id: 'primary-care',
    title: 'Primary care',
    description: 'Providing Quality Virtual Primary Care Services',
    departmentId: 'general-medicine',
    icon: (
      <svg className="size-10 text-[#121212]" viewBox="0 0 40 40" fill="none">
        <path
          d="M20 10C17.5 7 13 7.5 11 10.5C9 13.5 10 17 13 20L20 27L27 20C30 17 31 13.5 29 10.5C27 7.5 22.5 7 20 10Z"
          fill="#B8D5B9"
          stroke="#121212"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M8 26L14 26C16 26 18 28 20 28H25" stroke="#121212" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M6 29L11 29L16 34H26" stroke="#121212" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'dentist',
    title: 'Dentist',
    description: 'Enhancing Your Smile from the Comfort of Home',
    departmentId: 'dental',
    icon: (
      <svg className="size-10 text-[#121212]" viewBox="0 0 40 40" fill="none">
        <path
          d="M13 14C13 9 17 6 20 6C23 6 27 9 27 14V17H13V14Z"
          fill="#B8D5B9"
          stroke="#121212"
          strokeWidth="2.2"
        />
        <path
          d="M13 17V26C13 31 16 34 18 34C20 34 20 29 20 25C20 29 20 34 22 34C24 34 27 31 27 26V17"
          stroke="#121212"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="10" y1="17" x2="30" y2="17" stroke="#121212" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'ob-gyn',
    title: 'OB – GYN',
    description: 'Our Dedicated Gynecology Department Provides Compassionate Care',
    departmentId: 'gynecology',
    icon: (
      <svg className="size-10 text-[#121212]" viewBox="0 0 40 40" fill="none">
        <circle cx="11" cy="18" r="3.5" fill="#B8D5B9" stroke="#121212" strokeWidth="2" />
        <circle cx="29" cy="18" r="3.5" fill="#B8D5B9" stroke="#121212" strokeWidth="2" />
        <path
          d="M14.5 18C16.5 15 17.5 12 20 12C22.5 12 23.5 15 25.5 18C27 20 26 26 23 29L20 33L17 29C14 26 13 20 14.5 18Z"
          stroke="#121212"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="20" r="2.5" fill="#B8D5B9" stroke="#121212" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: 'dermatologist',
    title: 'Dermatologist',
    description: 'Connect with Experienced Dermatologists Online for Personalized Consultations',
    departmentId: 'dermatology',
    icon: (
      <svg className="size-10 text-[#121212]" viewBox="0 0 40 40" fill="none">
        <path
          d="M14 20V12C14 10.5 15.5 9 17 9C18.5 9 20 10.5 20 12V18M20 12C20 10.5 21.5 9 23 9C24.5 9 26 10.5 26 12V18M26 13C26 11.5 27.5 10 29 10C30.5 10 32 11.5 32 13V24C32 29 28 34 22 34C17 34 12 30 12 25V17C12 15.5 13.5 14 14 14"
          stroke="#121212"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="17" cy="24" r="1.5" fill="#B8D5B9" />
        <circle cx="22" cy="22" r="1.5" fill="#B8D5B9" />
        <circle cx="20" cy="27" r="1.5" fill="#B8D5B9" />
        <circle cx="26" cy="25" r="1.5" fill="#B8D5B9" />
      </svg>
    ),
  },
  {
    id: 'psychiatrist',
    title: 'Psychiatrist',
    description: 'Our Psychiatrist Department is committed to providing comprehensive support',
    departmentId: 'mental-health',
    icon: (
      <svg className="size-10 text-[#121212]" viewBox="0 0 40 40" fill="none">
        <path
          d="M13 14C11 16 11 20 13 23C11 26 13 30 16 31C18 32 20 31 20 29C20 31 22 32 24 31C27 30 29 26 27 23C29 20 29 16 27 14C25 12 23 13 20 11C17 13 15 12 13 14Z"
          stroke="#121212"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="18" r="3" fill="#B8D5B9" stroke="#121212" strokeWidth="1.5" />
        <circle cx="24" cy="18" r="3" fill="#B8D5B9" stroke="#121212" strokeWidth="1.5" />
        <circle cx="20" cy="25" r="3" fill="#B8D5B9" stroke="#121212" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: 'eye-doctor',
    title: 'Eye Doctor',
    description: 'Crystal Clear Vision, Virtually: Experience Unmatched Ophthalmic Care',
    departmentId: 'ophthalmology',
    icon: (
      <svg className="size-10 text-[#121212]" viewBox="0 0 40 40" fill="none">
        <path d="M13 11C17 8 23 8 27 11" stroke="#121212" strokeWidth="2.5" strokeLinecap="round" />
        <path
          d="M8 21C12 15 28 15 32 21C28 27 12 27 8 21Z"
          stroke="#121212"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="21" r="4.5" fill="#B8D5B9" stroke="#121212" strokeWidth="2" />
        <circle cx="20" cy="21" r="2" fill="#121212" />
      </svg>
    ),
  },
];

interface ServicesGridVariantProps {
  onBookAppointment?: (departmentId?: string) => void;
}

export const ServicesGridVariant: React.FC<ServicesGridVariantProps> = ({
  onBookAppointment,
}) => {
  return (
    <section
      className="w-full bg-[#f6f4ef] py-16 sm:py-24 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif]"
      id="services"
      aria-label="Explore Diverse Departments"
    >
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* ── Top Row: Header (Left) & Top 2 Department Cards (Right) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mb-6 lg:mb-8 items-stretch">
          {/* Header Block (6 Columns) matching media_1789993820468.png */}
          <div className="lg:col-span-6 flex flex-col justify-center pr-0 lg:pr-8 mb-4 lg:mb-0">
            {/* Top black horizontal line accent */}
            <div className="w-12 h-[3px] bg-[#121212] mb-3.5" />

            {/* Eyebrow */}
            <span className="block text-xs font-bold uppercase tracking-[0.2em] text-[#333] mb-2.5">
              Top Streamlined Specialties
            </span>

            {/* Main Heading */}
            <h2 className="text-3xl sm:text-4xl lg:text-[2.85rem] font-medium tracking-[-1.3px] leading-[1.12] text-[#121212] mb-4">
              Explore The Diverse Departments Of Our Platform
            </h2>

            {/* Subtitle */}
            <p className="text-xs sm:text-sm text-[#666] leading-relaxed max-w-lg">
              Bringing Specialized Expertise to Your Screen - Find the Right Department for Your Health Concerns
            </p>
          </div>

          {/* Top 2 Cards: Primary Care & Dentist (3 Columns each) */}
          {DEPARTMENTS.slice(0, 2).map((dept) => (
            <div
              key={dept.id}
              onClick={() => onBookAppointment?.(dept.departmentId)}
              className="lg:col-span-3 group bg-white hover:bg-neutral-50 rounded-2xl p-7 sm:p-8 border border-[#eae5dc] hover:border-[#ccc] shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div className="mb-6 group-hover:scale-105 transition-transform duration-200 origin-left">
                {dept.icon}
              </div>
              <div>
                <h3 className="text-xl font-medium tracking-tight text-[#121212] mb-2">
                  {dept.title}
                </h3>
                <p className="text-xs sm:text-[13px] text-[#666] leading-relaxed">
                  {dept.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Bottom Row: 4 Department Cards (3 Columns each) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {DEPARTMENTS.slice(2).map((dept) => (
            <div
              key={dept.id}
              onClick={() => onBookAppointment?.(dept.departmentId)}
              className="group bg-white hover:bg-neutral-50 rounded-2xl p-7 sm:p-8 border border-[#eae5dc] hover:border-[#ccc] shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div className="mb-6 group-hover:scale-105 transition-transform duration-200 origin-left">
                {dept.icon}
              </div>
              <div>
                <h3 className="text-xl font-medium tracking-tight text-[#121212] mb-2">
                  {dept.title}
                </h3>
                <p className="text-xs sm:text-[13px] text-[#666] leading-relaxed">
                  {dept.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
