import { ArrowRight, ArrowUpRight, MapPin, Sparkles } from 'lucide-react';
import { departments } from '../../data/departments';
import { departmentPresentation } from '../../data/departmentPresentation';
import { departmentEditorial } from '../../data/departmentEditorial';
import { doctors } from '../../data/doctors';
import type { Doctor } from '../../types';
import { Breadcrumbs } from '../common/Breadcrumbs';

interface Props {
  departmentId: string;
  aiRecommendation?: { query: string; matchedDoctor: Doctor; clinicalReasoning: string } | null;
  onBackToHome: () => void;
  onBackToDepartments: () => void;
  onSelectDepartment: (id: string) => void;
  onViewDoctor: (id: string) => void;
  onBookDoctor: (id: string, reason?: string) => void;
  onOpenBooking: () => void;
}

const shell = 'mx-auto max-w-[1320px] px-5 sm:px-10 lg:px-14';

export function DepartmentPage({ departmentId, aiRecommendation, onBackToHome, onBackToDepartments, onSelectDepartment, onViewDoctor, onBookDoctor, onOpenBooking }: Props) {
  const department = departments.find(d => d.id === departmentId) || departments[0];
  const presentation = departmentPresentation[department.id];
  const editorial = departmentEditorial[department.id];
  const team = doctors.filter(d => d.departmentId === department.id);
  const index = departments.findIndex(d => d.id === department.id) + 1;
  const related = departments.filter(d => d.id !== department.id).slice(0, 3);

  return <div className="bg-[#fbfaf6] text-[#203a2c]">
    <div className={`${shell} pt-7`}><Breadcrumbs items={[{ label: 'Home', onClick: onBackToHome }, { label: 'Specialties', onClick: onBackToDepartments }, { label: department.name }]} /></div>

    {aiRecommendation && <section className={`${shell} pt-7`}>
      <div className="flex flex-col gap-5 border-l-4 border-[#547761] bg-[#eaf0e8] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="max-w-3xl"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.13em] text-[#4b7458]"><Sparkles size={15} /> Your care search</p><h2 className="mt-2 text-xl font-semibold">A possible place to start for “{aiRecommendation.query}”</h2><p className="mt-2 text-sm leading-relaxed text-[#566e5d]">{aiRecommendation.clinicalReasoning}</p></div>
        <button onClick={() => onViewDoctor(aiRecommendation.matchedDoctor.id)} className="inline-flex shrink-0 items-center gap-2 self-start border-b border-[#1e4a34] pb-1 text-sm font-semibold hover:text-[#467559] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1e4a34]">Meet {aiRecommendation.matchedDoctor.name} <ArrowUpRight size={16} /></button>
      </div>
    </section>}

    <section className={`${shell} pb-16 pt-10 lg:pb-24 lg:pt-14`}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)] lg:gap-12">
        <div className="flex flex-col justify-between border-t border-[#bdcabd] pt-7 lg:pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#55735d]">Specialty {String(index).padStart(2, '0')} / {String(departments.length).padStart(2, '0')}</p>
            <h1 className="mt-8 max-w-[740px] text-[clamp(3.25rem,6.8vw,7rem)] font-medium leading-[.98] tracking-[-.065em] [text-wrap:balance]">{department.name}</h1>
            <p className="mt-7 max-w-[610px] text-lg leading-[1.65] text-[#536458] sm:text-xl">{editorial.intro}</p>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-5">
            <button onClick={onOpenBooking} className="inline-flex min-h-12 items-center gap-3 rounded-sm bg-[#1f5037] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#153d2a] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#1f5037]">Request an appointment <ArrowUpRight size={17} /></button>
            <a href="#care-team" className="inline-flex items-center gap-2 border-b border-[#376347] pb-1 text-sm font-semibold hover:text-[#4d8059] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1f5037]">Find a specialist <ArrowRight size={16} /></a>
          </div>
        </div>
        <figure className="relative min-h-[330px] overflow-hidden bg-[#e5ebe2] sm:min-h-[470px] lg:min-h-[560px]" style={{ backgroundColor: presentation.tint }}>
          <img src={presentation.image} alt={presentation.imageAlt} className="h-full w-full object-cover" />
          <figcaption className="absolute bottom-0 left-0 max-w-[85%] bg-[#fbfaf6] px-5 py-4 text-xs font-medium leading-relaxed text-[#4f6656] sm:px-7">{presentation.eyebrow} <span className="mx-2 text-[#a2b5a4]">/</span> Illustrative photo</figcaption>
        </figure>
      </div>
    </section>

    <nav aria-label={`${department.name} sections`} className="border-y border-[#d4ddd1] bg-[#f3f5ef]"><div className={`${shell} flex gap-7 overflow-x-auto whitespace-nowrap py-4 text-sm font-semibold text-[#496451] sm:gap-10`}><a href="#when-to-visit" className="hover:text-[#173f2b] focus-visible:outline-2">When to visit</a><a href="#specialty-services" className="hover:text-[#173f2b] focus-visible:outline-2">Services</a><a href="#care-team" className="hover:text-[#173f2b] focus-visible:outline-2">Care team</a><a href="#your-visit" className="hover:text-[#173f2b] focus-visible:outline-2">Your visit</a></div></nav>

    <section id="when-to-visit" className={`${shell} scroll-mt-28 grid gap-10 py-20 lg:grid-cols-[.7fr_1.3fr] lg:gap-24 lg:py-28`}>
      <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#6b8b70]">01 / When to visit</p><h2 className="mt-5 max-w-sm text-4xl font-medium leading-[1.08] tracking-[-.045em] sm:text-5xl">What brings people here</h2><p className="mt-6 max-w-sm leading-relaxed text-[#617164]">You do not need to have a diagnosis before you book. These are some reasons to begin with this team.</p></div>
      <div className="border-t border-[#aabcae]">{editorial.concerns.map((concern, i) => <div key={concern} className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-[#d1dcd0] py-5 sm:py-7"><span className="pt-1 text-xs font-semibold tabular-nums text-[#849d88]">0{i + 1}</span><p className="text-xl font-medium leading-snug tracking-[-.025em] sm:text-2xl">{concern}</p></div>)}</div>
    </section>

    <section id="specialty-services" className="scroll-mt-28 bg-[#eaf0e7] py-20 lg:py-28"><div className={`${shell} grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-24`}>
      <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#56785d]">02 / Care available</p><h2 className="mt-5 max-w-md text-4xl font-medium leading-[1.08] tracking-[-.045em] sm:text-5xl">Services in this specialty</h2><p className="mt-6 max-w-md leading-relaxed text-[#5e7162]">{department.description}</p><p className="mt-5 max-w-md text-sm leading-relaxed text-[#6e7d70]">Your clinician will discuss which services are appropriate for your situation.</p></div>
      <div className="border-t border-[#9db6a1]">{department.commonProcedures.map(service => <div key={service} className="flex items-center justify-between gap-5 border-b border-[#bfcfc0] py-5 sm:py-6"><h3 className="text-lg font-medium tracking-[-.02em] sm:text-xl">{service}</h3><span aria-hidden="true" className="text-[#6c9173]">↗</span></div>)}<button onClick={onOpenBooking} className="mt-8 inline-flex items-center gap-2 border-b border-[#28583b] pb-1 text-sm font-semibold hover:text-[#4a7b56] focus-visible:outline-2 focus-visible:outline-offset-4">Ask about a service <ArrowUpRight size={16} /></button></div>
    </div></section>

    <section id="care-team" className={`${shell} scroll-mt-28 py-20 lg:py-28`}>
      <div className="mb-11 flex flex-col justify-between gap-6 border-b border-[#ccd8ca] pb-8 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#6b8b70]">03 / Your care team</p><h2 className="mt-5 text-4xl font-medium tracking-[-.045em] sm:text-5xl">Meet the specialists</h2></div><p className="max-w-sm text-sm leading-relaxed text-[#647468]">Read about the clinicians and choose who you would like to see.</p></div>
      {team.length ? <div className="grid gap-7 md:grid-cols-2">{team.map(doctor => <article key={doctor.id} className="group grid overflow-hidden border border-[#d9e2d6] bg-white sm:grid-cols-[38%_1fr]"><div className="aspect-[4/3] overflow-hidden bg-[#e1e9e0] sm:aspect-auto"><img src={doctor.image} alt={doctor.name} loading="lazy" className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.025]" /></div><div className="flex flex-col p-6 sm:p-7"><p className="text-[11px] font-semibold uppercase tracking-[.15em] text-[#6b8b70]">{department.name}</p><h3 className="mt-3 text-2xl font-medium tracking-[-.035em] sm:text-3xl">{doctor.name}</h3><p className="mt-2 text-sm text-[#627467]">{doctor.title}</p><p className="mt-4 flex items-center gap-1.5 text-xs text-[#6d7d71]"><MapPin size={13} /> {doctor.roomNumber.split(', ').slice(1).join(', ') || doctor.roomNumber}</p><div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-7"><button onClick={() => onViewDoctor(doctor.id)} className="inline-flex items-center gap-1 border-b border-[#245c3c] pb-1 text-sm font-semibold hover:text-[#4f805c] focus-visible:outline-2 focus-visible:outline-offset-4">View profile <ArrowUpRight size={15} /></button><button onClick={() => onBookDoctor(doctor.id)} className="text-sm font-semibold text-[#55735c] hover:text-[#1f5037] focus-visible:outline-2">Book visit</button></div></div></article>)}</div> : <div className="border-l-4 border-[#b5ccb7] bg-[#f2f5ee] p-8"><p className="text-lg font-medium">We can help you find the right clinician.</p><button onClick={onOpenBooking} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4">Ask about an appointment <ArrowUpRight size={16} /></button></div>}
    </section>

    <section id="your-visit" className="scroll-mt-28 border-y border-[#d4e1d1] bg-[#f2f5ed] py-20 lg:py-28"><div className={shell}>
      <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:gap-20"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#6b8b70]">04 / Your visit</p><h2 className="mt-5 max-w-md text-4xl font-medium leading-[1.08] tracking-[-.045em] sm:text-5xl">What to expect</h2></div><ol className="border-t border-[#9fb6a2]">{editorial.visit.map((step, i) => <li key={step} className="flex gap-7 border-b border-[#c8d6c8] py-6"><span className="font-medium tabular-nums text-[#6d9275]">0{i + 1}</span><span className="text-lg leading-snug">{step}</span></li>)}</ol></div>
      <div className="mt-16 grid gap-5 border-t border-[#bccdbb] pt-9 lg:grid-cols-[.85fr_1.15fr] lg:gap-20"><h3 className="text-2xl font-medium tracking-[-.03em]">{editorial.question}</h3><p className="max-w-2xl leading-relaxed text-[#5c6d5f]">{editorial.answer}</p></div>
    </div></section>

    <section className={`${shell} py-20 lg:py-24`}><div className="flex flex-col gap-6 bg-[#204c36] p-8 text-white sm:p-12 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#b9d4bc]">Ready when you are</p><h2 className="mt-4 max-w-xl text-3xl font-medium leading-tight tracking-[-.035em] sm:text-4xl">Start with a conversation about your care.</h2></div><button onClick={onOpenBooking} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start bg-[#f7f5ed] px-5 text-sm font-semibold text-[#204c36] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Request an appointment <ArrowUpRight size={16} /></button></div>
      <div className="mt-16 flex items-end justify-between gap-6"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#6b8b70]">Explore care</p><h2 className="mt-3 text-3xl font-medium tracking-[-.035em]">Other specialties</h2></div><button onClick={onBackToDepartments} className="hidden border-b border-[#245c3c] pb-1 text-sm font-semibold sm:inline-flex">View all specialties</button></div>
      <div className="mt-7 grid border-t border-[#d2ded0] md:grid-cols-3">{related.map(d => <button key={d.id} onClick={() => onSelectDepartment(d.id)} className="flex min-h-28 items-end justify-between gap-4 border-b border-[#d2ded0] py-6 text-left text-xl font-medium tracking-[-.025em] hover:text-[#5f9068] focus-visible:outline-2 md:border-r md:px-5 md:first:pl-0 md:last:border-r-0"><span>{d.name}</span><ArrowUpRight size={18} className="shrink-0" /></button>)}</div>
    </section>
  </div>;
}
