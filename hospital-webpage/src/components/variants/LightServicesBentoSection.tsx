import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { departments } from '../../data/departments';
import { departmentPresentation } from '../../data/departmentPresentation';

interface Props {
  onBookAppointment?: (departmentId?: string) => void;
  onViewAll?: () => void;
}

const featuredIds = ['general-medicine', 'cardiology', 'metabolic', 'orthopedics', 'dermatology', 'neurology'];

export function LightServicesBentoSection({ onBookAppointment, onViewAll }: Props) {
  const featured = featuredIds.map(id => departments.find(d => d.id === id)).filter((d): d is NonNullable<typeof d> => Boolean(d));
  return <section id="services" className="bg-[#fffefa] py-20 sm:py-28 scroll-mt-28">
    <div className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12">
      <div className="mb-11 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="mb-4 text-xs font-bold tracking-[.2em] text-[#5e8064]">EXPLORE SRI LAKSHMI CARE</p>
          <h2 className="font-medium text-5xl sm:text-6xl tracking-[-.05em] leading-[1.04] text-[#17372b]">Care for every chapter.</h2>
          <p className="mt-4 text-base sm:text-lg leading-relaxed text-[#627369]">From everyday questions to specialist support, find a good place to begin.</p>
        </div>
        <button onClick={onViewAll} className="inline-flex items-center gap-2 rounded-full border border-[#94b49a] px-6 py-3 text-sm font-semibold text-[#24553c] hover:bg-[#eaf2e7] transition-colors">All departments <ArrowRight size={16} /></button>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {featured.map(department => {
          const detail = departmentPresentation[department.id];
          return <button key={department.id} type="button" onClick={() => onBookAppointment?.(department.id)} className="group overflow-hidden rounded-[1.35rem] border border-[#e1e9df] bg-[#f5f8f1] text-left hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(28,63,39,.08)] transition-all focus-visible:outline-2 focus-visible:outline-[#24553c]">
            <div className="h-56 sm:h-64 overflow-hidden" style={{ backgroundColor: detail.tint }}><img src={detail.image} alt="" loading="lazy" className="h-full w-full object-cover group-hover:scale-[1.04] transition-transform duration-500" /></div>
            <div className="flex min-h-[185px] flex-col p-6 sm:p-7">
              <span className="text-[10px] font-bold tracking-[.18em] text-[#65866b]">{detail.eyebrow}</span>
              <h3 className="mt-3 font-medium text-[1.9rem] leading-tight tracking-[-.035em] text-[#17372b]">{department.name}</h3>
              <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-semibold text-[#2d6545]">Explore care <ArrowUpRight size={17} /></span>
            </div>
          </button>;
        })}
      </div>
    </div>
  </section>;
}
