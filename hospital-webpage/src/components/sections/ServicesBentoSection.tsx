import React from 'react';

interface ServiceBentoItem {
  id: string;
  title: string;
  image: string;
  departmentId: string;
}

const servicesList: ServiceBentoItem[] = [
  {
    id: "primary-care",
    title: "Primary Care",
    image: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=800",
    departmentId: "general-medicine"
  },
  {
    id: "cardiology",
    title: "Cardiology & Heart Health",
    image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=800",
    departmentId: "cardiology"
  },
  {
    id: "metabolic",
    title: "Weight Management & Metabolic Health",
    image: "https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&q=80&w=800",
    departmentId: "metabolic"
  },
  {
    id: "orthopedics",
    title: "Orthopedics & Joint Care",
    image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800",
    departmentId: "orthopedics"
  },
  {
    id: "skin-care",
    title: "Skin Care",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800",
    departmentId: "dermatology"
  },
  {
    id: "mental-health",
    title: "Mental Health & Neurology",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=800",
    departmentId: "neurology"
  }
];

interface ServicesBentoSectionProps {
  onBookAppointment?: (departmentId?: string) => void;
}

export const ServicesBentoSection: React.FC<ServicesBentoSectionProps> = ({
  onBookAppointment
}) => {
  return (
    <section className="w-full pt-28 pb-20" id="services">
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        
        {/* Section Header matching exact typography from Patients of Avocado */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="block text-color-002 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif,_'Segoe_UI_Emoji',_'Segoe_UI_Symbol'] text-[2.75rem] font-medium leading-12 tracking-[-1.35px] [-webkit-text-stroke:0.001px_var(--clr-3)] max-md:text-[2rem] max-md:leading-[2.1875rem] max-md:tracking-[-0.69px] mb-3.5">
            Services we offer
          </h2>
          <p className="block text-[1.1875rem] leading-[1.6875rem] tracking-[-0.3px] text-[#575554]">
            From everyday care to specialized support, we&apos;re here for every stage of your health.
          </p>
        </div>

        {/* 6-Grid Bento Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
          {servicesList.map((service) => (
            <div
              key={service.id}
              onClick={() => onBookAppointment?.(service.departmentId)}
              className="relative rounded-[22px] overflow-hidden aspect-[1.2/1] group cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 select-none"
            >
              {/* Background Photo */}
              <img
                src={service.image}
                alt={service.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                loading="lazy"
              />

              {/* Gradient Scrim for crisp typography */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />

              {/* Card Label & Action matching Family font system */}
              <div className="absolute bottom-0 inset-x-0 p-6 sm:p-7 flex flex-col items-start gap-2 z-10">
                <h3 className="block text-white [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif,_'Segoe_UI_Emoji',_'Segoe_UI_Symbol'] text-[1.4375rem] font-medium leading-[1.5625rem] tracking-[-0.44px] [-webkit-text-stroke:0.001px_var(--clr-3)] drop-shadow-sm">
                  {service.title}
                </h3>
                <div className="text-white/90 text-[0.9375rem] font-normal leading-5.5 tracking-[-0.13px] inline-flex items-center gap-1.5 group-hover:text-white transition">
                  <span>Book appointment</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
