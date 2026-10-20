import { doctors } from '../../data/doctors';
import React from 'react';
import { HmsDoctorPhoto } from '../doctor/HmsDoctorPhoto';
import type { HmsRosterDoctor } from '../doctor/hmsRoster';

interface DoctorItem {
  id: string;
  name: string;
  specialty: string;
  image: string | null;
}

const TOP_DOCTORS: DoctorItem[] = ['doc-2', 'doc-6', 'doc-3', 'doc-4'].map(id => {
  const doctor = doctors.find(item => item.id === id)!;
  return { id: doctor.id, name: doctor.name, specialty: doctor.title, image: doctor.image };
});

interface DoctorsGridSectionProps {
  roster?: HmsRosterDoctor[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onBookDoctor?: (doctorId?: string) => void;
  onViewDoctor?: (doctorId: string) => void;
  onViewAll?: () => void;
}

export const DoctorsGridSection: React.FC<DoctorsGridSectionProps> = ({
  roster, loading, error, onRetry,
  onBookDoctor,
  onViewDoctor,
  onViewAll,
}) => {
  const displayed = roster === undefined ? TOP_DOCTORS : roster.slice(0, 4).map(doctor => ({ id: doctor.slug, name: doctor.name, specialty: doctor.roleTitle ?? doctor.specialty ?? doctor.departments.join(' · '), image: doctor.photoUrl }));
  return (
    <section
      className="w-full bg-[#f6f4ef] py-16 sm:py-24 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif]"
      id="doctors"
      aria-label="Top Specialists at Sri Lakshmi Hospital"
    >
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        {roster !== undefined && (loading ? <p role="status" className="mb-6">Loading hospital doctors…</p> : error ? <div role="alert" className="mb-6"><p>{error}</p><button onClick={onRetry} className="mt-3 rounded-full border border-[#9ab29e] px-5 py-2">Try again</button></div> : roster.length === 0 ? <p className="mb-6">No doctor profiles are currently published.</p> : null)}
        {/* ── Section Header matching media_1789993820491.png ── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12 sm:mb-16">
          <div className="max-w-2xl">
            {/* Main Heading */}
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-medium tracking-[-1.2px] leading-[1.15] text-[#121212]">
              {roster === undefined ? 'Meet Our Top Specialists At The Forefront Of Modern Care' : 'Meet the people behind your care'}
            </h2>
          </div>

          {/* Right Text & Yellow View All Button */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4 max-w-md">
            <p className="text-xs sm:text-sm text-[#555] leading-relaxed lg:text-right">
              {roster === undefined ? 'Our Top Specialist Section features a handpicked selection of the most accomplished and renowned experts in their respective fields.' : 'Browse our current medical team and choose a published appointment time.'}
            </p>

            {/* Bright Yellow Button matching screenshot */}
            <button
              type="button"
              onClick={onViewAll || (() => onBookDoctor?.())}
              className="inline-flex items-center justify-center px-7 py-2.5 bg-[#fdec38] hover:bg-[#fae223] text-[#121212] text-xs sm:text-sm font-semibold rounded-[2px] transition-all duration-150 shadow-xs active:scale-[0.98] cursor-pointer"
            >
              View All
            </button>
          </div>
        </div>

        {roster !== undefined && displayed.length === 0 && <p className="rounded-2xl border border-[#dce6dc] bg-white p-6 text-[#617268]">Doctor profiles are not currently available. Please contact hospital reception for help booking.</p>}
        {/* ── 4 Doctor Cards in a Row matching media_1789993820491.png ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {displayed.map((doctor) => (
            <div
              key={doctor.id}
              className="group flex flex-col justify-between"
            >
              <div>
                {/* Doctor Portrait on clean light background */}
                <button type="button" onClick={() => onViewDoctor?.(doctor.id)} aria-label={`View ${doctor.name}'s profile`} className="relative block w-full aspect-[4/5] rounded-2xl overflow-hidden bg-[#e9e5dc] mb-4.5 shadow-sm transition-transform duration-300 group-hover:-translate-y-1 cursor-pointer">
                  <HmsDoctorPhoto
                    name={doctor.name}
                    url={doctor.image}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {/* Subtle vignette for crisp clean studio feel */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />
                </button>

                {/* Doctor Name */}
                <h3 className="text-lg sm:text-xl font-medium tracking-tight text-[#121212] mb-1">
                  <button type="button" onClick={() => onViewDoctor?.(doctor.id)} className="text-left hover:text-[#154734]">{doctor.name}</button>
                </h3>

                {/* Specialty */}
                <p className="text-xs text-[#666] leading-relaxed min-h-[34px]">
                  {doctor.specialty}
                </p>
              </div>

              {/* Outline "Book An Appointment" Button matching screenshot */}
              <button
                type="button"
                onClick={() => onBookDoctor?.(doctor.id)}
                className="mt-4 w-full py-2.5 px-4 rounded-[4px] border border-[#777] hover:border-[#121212] hover:bg-[#121212] text-[#121212] hover:text-white text-xs sm:text-[13px] font-medium transition-all duration-200 cursor-pointer text-center"
              >
                Book An Appointment
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
