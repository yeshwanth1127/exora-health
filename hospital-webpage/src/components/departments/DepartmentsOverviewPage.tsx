import { ArrowRight, ArrowUpRight, Check, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Breadcrumbs } from '../common/Breadcrumbs';
import { departments } from '../../data/departments';
import { departmentPresentation } from '../../data/departmentPresentation';

interface Props {
  onBackToHome: () => void;
  onSelectDepartment: (id: string) => void;
  onViewDoctors: () => void;
}

export function DepartmentsOverviewPage({ onBackToHome, onSelectDepartment, onViewDoctors }: Props) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => departments.filter((department) =>
    `${department.name} ${department.tagline} ${department.commonProcedures.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [query]);
  const featured = departments[0];
  const presentation = departmentPresentation[featured.id];

  return <div className="bg-[#f8f7f2] text-[#17372b]">
    <div className="max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-16 pt-7"><Breadcrumbs items={[{ label: 'Home', onClick: onBackToHome }, { label: 'Departments' }]} /></div>
    <section className="max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-16 pt-16 pb-20 lg:pt-24 lg:pb-28 grid lg:grid-cols-[1.05fr_.95fr] gap-10 lg:gap-16 items-center">
      <div>
        <p className="text-xs font-bold tracking-[.22em] text-[#4d7657] mb-7">AVOCADO CARE</p>
        <h1 className="max-w-[780px] font-medium text-[clamp(3.5rem,7vw,7.5rem)] leading-[.97] tracking-[-.055em]">Care for all the ways you live.</h1>
        <p className="max-w-xl text-lg sm:text-xl leading-relaxed text-[#53645a] mt-8">From your first question to more specialised support, explore care that meets you where you are.</p>
        <a href="#explore-departments" className="inline-flex items-center gap-3 mt-9 rounded-full bg-[#194d38] px-7 py-4 text-sm font-semibold text-white hover:bg-[#123c2c] transition-colors">Explore departments <ArrowRight size={18} /></a>
      </div>
      <div className="relative min-h-[380px] sm:min-h-[520px] overflow-hidden rounded-[2rem] bg-[#e8eee4]">
        <img src={presentation.image} alt="Clinician meeting with a patient" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-5 bottom-5 sm:inset-x-8 sm:bottom-8 rounded-2xl bg-[#fcfbf7]/95 backdrop-blur p-5 sm:p-7 max-w-[430px] shadow-lg">
          <span className="text-[11px] font-bold tracking-[.18em] text-[#56705d]">A GOOD PLACE TO START</span>
          <h2 className="font-medium text-3xl sm:text-4xl leading-tight mt-2">Primary care, made personal.</h2>
          <button onClick={() => onSelectDepartment(featured.id)} className="inline-flex items-center gap-2 mt-4 font-semibold text-sm underline underline-offset-4">Explore primary care <ArrowUpRight size={16} /></button>
        </div>
      </div>
    </section>
    <section id="explore-departments" className="bg-[#fffefa] py-20 lg:py-28 scroll-mt-20">
      <div className="max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-16">
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end mb-10">
          <div><p className="text-xs font-bold tracking-[.2em] text-[#5c795f] mb-4">FIND YOUR CARE</p><h2 className="font-medium text-5xl sm:text-6xl tracking-[-.045em]">Explore our departments</h2><p className="text-[#64736a] mt-4 max-w-xl">Find the right starting point. Each specialty page explains what the team can help with and who you can see.</p></div>
          <label className="flex items-center gap-3 border-b border-[#87988a] pb-3 w-full lg:w-80 text-[#536f5a]"><Search size={20} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search care or treatment" aria-label="Search departments" className="w-full bg-transparent outline-none text-[#17372b] placeholder:text-[#89978d]" /></label>
        </div>
        {filtered.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{filtered.map(department => {
          const detail = departmentPresentation[department.id];
          return <button key={department.id} onClick={() => onSelectDepartment(department.id)} className="group text-left overflow-hidden rounded-[1.4rem] bg-[#f6f7f1] border border-[#e7ebe3] hover:border-[#a9c2ae] hover:-translate-y-1 transition-all focus-visible:outline-2 focus-visible:outline-[#194d38]">
            <div className="h-52 overflow-hidden" style={{ backgroundColor: detail.tint }}><img src={detail.image} alt="" loading="lazy" className="h-full w-full object-cover group-hover:scale-[1.04] transition-transform duration-500" /></div>
            <div className="p-6 sm:p-7 min-h-[235px] flex flex-col"><span className="text-[10px] font-bold tracking-[.2em] text-[#5c795f]">{detail.eyebrow}</span><h3 className="font-medium text-3xl leading-tight mt-3">{department.name}</h3><p className="text-sm leading-relaxed text-[#65746a] mt-3">{department.tagline}</p><span className="mt-auto pt-6 text-sm font-semibold flex items-center gap-2">Explore care <ArrowUpRight size={16} /></span></div>
          </button>;
        })}</div> : <div className="rounded-2xl bg-[#f6f7f1] p-12 text-center"><p className="font-medium text-3xl">No departments found</p><p className="text-[#65746a] mt-2">Try another specialty or treatment name.</p><button onClick={() => setQuery('')} className="underline underline-offset-4 mt-5 font-semibold">Clear search</button></div>}
      </div>
    </section>
    <section className="bg-[#dcead8] py-20 lg:py-24"><div className="max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-16 grid lg:grid-cols-2 gap-10 items-center"><div><p className="text-xs font-bold tracking-[.2em] text-[#4a7657] mb-5">HERE FOR YOU</p><h2 className="font-medium text-5xl sm:text-6xl tracking-[-.045em] leading-[1.05]">Need help choosing where to start?</h2></div><div className="lg:pl-14"><p className="text-[#53695a] text-lg leading-relaxed mb-6">You can begin with primary care, or browse our team to find a doctor by specialty and location.</p><div className="flex flex-col sm:flex-row gap-3"><button onClick={() => onSelectDepartment('general-medicine')} className="rounded-full bg-[#194d38] px-6 py-3.5 text-white font-semibold inline-flex justify-center gap-2 items-center">Start with primary care <ArrowRight size={17} /></button><button onClick={onViewDoctors} className="rounded-full border border-[#194d38] px-6 py-3.5 font-semibold inline-flex justify-center gap-2 items-center">Meet our doctors <Check size={17} /></button></div></div></div></section>
  </div>;
}
