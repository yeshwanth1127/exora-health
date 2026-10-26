import type { PublicDoctor } from '../../lib/publicBookingApi';
import React, { Suspense, useState } from 'react';
import { ArcTeamShowcase } from '../../arc-pro';

interface DoctorItem {
  id: string;
  name: string;
  specialty: string;
  image: string;
  bio: string;
}

interface DoctorsGridSectionProps {
  roster: PublicDoctor[];
  clinicName: string;
  city: string;
  onBookDoctor?: (doctorId?: string) => void;
  onViewDoctor?: (doctorId: string) => void;
  onViewAll?: () => void;
}

export const DoctorsGridSection: React.FC<DoctorsGridSectionProps> = ({
  roster, clinicName, city,
  onBookDoctor,
  onViewDoctor,
  onViewAll,
}) => {
  const TOP_DOCTORS:DoctorItem[] = roster.slice(0,4).map(doctor=>({id:doctor.slug,name:doctor.name,specialty:doctor.roleTitle||doctor.specialty||doctor.departments.join(' · '),image:doctor.photoUrl||'/images/doctor-placeholder.svg',bio:doctor.bio||''}));
  const [selectedId, setSelectedId] = useState(TOP_DOCTORS[0]?.id);
  const selectedDoctor=TOP_DOCTORS.find(doctor=>doctor.id===selectedId)||TOP_DOCTORS[0];
  if(!selectedDoctor)return null;
  return (
    <section
      className="w-full bg-[#fefbf6] py-16 sm:py-24 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif]"
      id="doctors"
      aria-label={`Specialists at ${clinicName}`}
    >
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* ── Section Header matching media_1789993820491.png ── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12 sm:mb-16">
          <div className="max-w-2xl">
            {/* Main Heading */}
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-medium tracking-[-1.2px] leading-[1.15] text-[#121212]">
              Meet the people behind your care.
            </h2>
          </div>

          {/* Right Text & Yellow Meet all our doctors Button */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4 max-w-md">
            <p className="text-xs sm:text-sm text-[#555] leading-relaxed lg:text-right">
              Get to know our specialists, explore their clinical interests and speak with reception about your consultation.
            </p>

            {/* Bright Yellow Button matching screenshot */}
            <button
              type="button"
              onClick={onViewAll || (() => onBookDoctor?.())}
              className="inline-flex items-center justify-center px-7 py-2.5 bg-[#afd1f2] hover:bg-[#96bfeb] text-[#121212] text-xs sm:text-sm font-semibold rounded-[2px] transition-all duration-150 shadow-xs active:scale-[0.98] cursor-pointer"
            >
              Meet all our doctors
            </button>
          </div>
        </div>

        <div className="arc-hospital hospital-doctor-browser" data-arc-pro="team-showcase">
          <Suspense fallback={<>        {/* ── 4 Doctor Cards in a Row matching media_1789993820491.png ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {TOP_DOCTORS.map((doctor) => (
            <div
              key={doctor.id}
              className="group flex flex-col justify-between"
            >
              <div>
                {/* Doctor Portrait on clean light background */}
                <button type="button" onClick={() => onViewDoctor?.(doctor.id)} aria-label={`View ${doctor.name}'s profile`} className="relative block w-full aspect-[4/5] rounded-2xl overflow-hidden bg-[#e9e5dc] mb-4.5 shadow-sm transition-transform duration-300 group-hover:-translate-y-1 cursor-pointer">
                  <img
                    src={doctor.image}
                    alt=""
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {/* Subtle vignette for crisp clean studio feel */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />
                </button>

                {/* Doctor Name */}
                <h3 className="text-lg sm:text-xl font-medium tracking-tight text-[#121212] mb-1">
                  <button type="button" onClick={() => onViewDoctor?.(doctor.id)} className="text-left hover:text-[#08404f]">{doctor.name}</button>
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
        </div></>}>
            <ArcTeamShowcase
              title="Explore our specialists"
              variant="gallery"
              people={TOP_DOCTORS.map(doctor => ({ id:doctor.id, name:doctor.name, role:doctor.specialty, image:doctor.image, introduction:doctor.bio, location:city }))}
              onPersonSelect={person => setSelectedId(person.id)}
            />
            <div className="hospital-doctor-actions">
              <a href={'/doctors/'+selectedDoctor.id}>View full profile <span aria-hidden="true">↗</span></a>
              <button type="button" onClick={() => onBookDoctor?.(selectedDoctor.id)}>Arrange a visit with {selectedDoctor.name} <span aria-hidden="true">↗</span></button>
            </div>
          </Suspense>
        </div>
      </div>
    </section>
  );
};
