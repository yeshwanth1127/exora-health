import React from 'react';

interface DoctorItem {
  id: string;
  name: string;
  specialty: string;
  image: string;
}

const TOP_DOCTORS: DoctorItem[] = [
  {
    id: 'doc-1',
    name: 'Dr. Vikram Rao',
    specialty: 'Consultant - Interventional Cardiology & Heart Care',
    image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=85',
  },
  {
    id: 'doc-2',
    name: 'Dr. Ananya Sharma',
    specialty: 'Consultant - Internal Medicine & Preventative Care',
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=85',
  },
  {
    id: 'doc-3',
    name: 'Dr. Siddharth Mukherjee',
    specialty: 'Consultant - Minimally Invasive & Robotic Surgery',
    image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=800&q=85',
  },
  {
    id: 'doc-4',
    name: 'Dr. Radhika Iyer',
    specialty: 'Consultant - Obstetrics, Gynecology & Women\'s Health',
    image: 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&w=800&q=85',
  },
];

interface DoctorsGridSectionProps {
  onBookDoctor?: (doctorId?: string) => void;
  onViewAll?: () => void;
}

export const DoctorsGridSection: React.FC<DoctorsGridSectionProps> = ({
  onBookDoctor,
  onViewAll,
}) => {
  return (
    <section
      className="w-full bg-[#f6f4ef] py-16 sm:py-24 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif]"
      id="doctors"
      aria-label="Top Specialists at Avocado Health"
    >
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* ── Section Header matching media_1789993820491.png ── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12 sm:mb-16">
          <div className="max-w-2xl">
            {/* Main Heading */}
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-medium tracking-[-1.2px] leading-[1.15] text-[#121212]">
              Meet Our Top Specialists At The Forefront Of Modern Care
            </h2>
          </div>

          {/* Right Text & Yellow View All Button */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4 max-w-md">
            <p className="text-xs sm:text-sm text-[#555] leading-relaxed lg:text-right">
              Our Top Specialist Section features a handpicked selection of the most accomplished and renowned experts in their respective fields.
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

        {/* ── 4 Doctor Cards in a Row matching media_1789993820491.png ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {TOP_DOCTORS.map((doctor) => (
            <div
              key={doctor.id}
              className="group flex flex-col justify-between"
            >
              <div>
                {/* Doctor Portrait on clean light background */}
                <div className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden bg-[#e9e5dc] mb-4.5 shadow-sm transition-transform duration-300 group-hover:-translate-y-1">
                  <img
                    src={doctor.image}
                    alt={doctor.name}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {/* Subtle vignette for crisp clean studio feel */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />
                </div>

                {/* Doctor Name */}
                <h3 className="text-lg sm:text-xl font-medium tracking-tight text-[#121212] mb-1">
                  {doctor.name}
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
