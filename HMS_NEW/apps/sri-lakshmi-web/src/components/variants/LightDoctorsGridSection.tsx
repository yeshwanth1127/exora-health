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

interface LightDoctorsGridSectionProps {
  roster?: HmsRosterDoctor[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onBookDoctor?: (doctorId?: string) => void;
  onViewDoctor?: (doctorId: string) => void;
  onViewAll?: () => void;
}

export const LightDoctorsGridSection: React.FC<LightDoctorsGridSectionProps> = ({
  roster, loading, error, onRetry,
  onBookDoctor,
  onViewDoctor,
  onViewAll,
}) => {
  const displayed = roster === undefined ? TOP_DOCTORS : roster.slice(0, 4).map(doctor => ({ id: doctor.slug, name: doctor.name, specialty: doctor.roleTitle ?? doctor.specialty ?? doctor.departments.join(' · '), image: doctor.photoUrl }));
  return (
    <section
      className="w-full bg-[#f2f6ee] py-20 sm:py-28 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif]"
      id="doctors"
      aria-label="Top Specialists at Sri Lakshmi Hospital"
    >
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        {roster !== undefined && (loading ? <p role="status" className="mb-6">Loading hospital doctors…</p> : error ? <div role="alert" className="mb-6"><p>{error}</p><button onClick={onRetry} className="mt-3 rounded-full border border-[#9ab29e] px-5 py-2">Try again</button></div> : roster.length === 0 ? <p className="mb-6">No doctor profiles are currently published.</p> : null)}
        {/* ── Section Header matching media_1789993820491.png ── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12 sm:mb-16">
          <div className="max-w-2xl">
            {/* Main Heading */}
            <h2 className="font-medium text-5xl sm:text-6xl tracking-[-.05em] leading-[1.04] text-[#17372b]">
              The people behind your care.
            </h2>
          </div>

          {/* Right Text & Yellow View All Button */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4 max-w-md">
            <p className="text-sm sm:text-base text-[#5b7061] leading-relaxed lg:text-right">
              Meet the doctors who listen closely, explain clearly, and help you make your next move with confidence.
            </p>

            {/* Bright Yellow Button matching screenshot */}
            <button
              type="button"
              onClick={onViewAll || (() => onBookDoctor?.())}
              className="inline-flex items-center justify-center px-7 py-3 bg-[#24553c] hover:bg-[#173f2d] text-white text-xs sm:text-sm font-semibold rounded-full transition-colors cursor-pointer"
            >
              Meet all doctors
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
                <button type="button" onClick={() => onViewDoctor?.(doctor.id)} aria-label={`View ${doctor.name}'s profile`} className="relative block w-full aspect-[4/5] rounded-2xl overflow-hidden bg-[#e2e9de] mb-4.5 transition-transform duration-300 group-hover:-translate-y-1 cursor-pointer">
                  <HmsDoctorPhoto
                    name={doctor.name}
                    url={doctor.image}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {/* Subtle vignette for crisp clean studio feel */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />
                </button>

                {/* Doctor Name */}
                <h3 className="text-lg sm:text-xl font-medium tracking-tight text-[#17372b] mb-1">
                  <button type="button" onClick={() => onViewDoctor?.(doctor.id)} className="text-left hover:text-[#24553c]">{doctor.name}</button>
                </h3>

                {/* Specialty */}
                <p className="text-xs text-[#65756a] leading-relaxed min-h-[34px]">
                  {doctor.specialty}
                </p>
              </div>

              {/* Outline "Book An Appointment" Button matching screenshot */}
              <button
                type="button"
                onClick={() => onBookDoctor?.(doctor.id)}
                className="mt-4 w-full py-3 px-4 rounded-full border border-[#8eac95] hover:border-[#24553c] hover:bg-[#24553c] text-[#24553c] hover:text-white text-xs sm:text-[13px] font-medium transition-colors cursor-pointer text-center"
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
