import { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { Breadcrumbs } from '../common/Breadcrumbs';
import { doctors } from '../../data/doctors';
import { departments } from '../../data/departments';
import { physicalBranches } from '../../data/branches';

interface Props {
  onBackToHome: () => void;
  onSelectDoctor: (id: string) => void;
  onExploreDepartments: () => void;
}

export function DoctorsDirectoryPage({ onBackToHome, onSelectDoctor, onExploreDepartments }: Props) {
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('all');
  const [location, setLocation] = useState('all');
  const [careType, setCareType] = useState('all');
  const filtered = useMemo(() => doctors.filter(doctor => {
    const matchesQuery = `${doctor.name} ${doctor.title} ${doctor.departmentName} ${doctor.bio}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesSpecialty = specialty === 'all' || doctor.departmentId === specialty;
    const matchesLocation = location === 'all' || doctor.roomNumber.toLowerCase().includes(location.toLowerCase());
    const matchesCare = careType !== 'virtual' || doctor.acceptsVirtual;
    return matchesQuery && matchesSpecialty && matchesLocation && matchesCare;
  }), [query, specialty, location, careType]);
  const activeFilters = query || specialty !== 'all' || location !== 'all' || careType !== 'all';
  const resetFilters = () => { setQuery(''); setSpecialty('all'); setLocation('all'); setCareType('all'); };

  return <div className="bg-[#f8f7f2] text-[#17372b]">
    <div className="max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-16 pt-7"><Breadcrumbs items={[{ label: 'Home', onClick: onBackToHome }, { label: 'Doctors' }]} /></div>
    <section className="max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-16 py-20 lg:py-28 grid lg:grid-cols-[1fr_.72fr] gap-12 items-end">
      <div><p className="text-xs font-bold tracking-[.22em] text-[#547859] mb-6">THE PEOPLE BEHIND YOUR CARE</p><h1 className="font-medium text-[clamp(4rem,8vw,8rem)] tracking-[-.06em] leading-[.94]">Meet your care team.</h1></div>
      <div className="max-w-lg lg:pb-3"><p className="text-xl text-[#5c6e61] leading-relaxed">Good care starts with a good connection. Get to know the doctors who will listen, explain, and help you take the next step.</p><a href="#meet-providers" className="inline-flex items-center gap-2 mt-7 text-sm font-semibold border-b border-[#17372b] pb-1">Find your doctor <ArrowRight size={17} /></a></div>
    </section>
    <div className="relative h-56 sm:h-80 lg:h-[400px] overflow-hidden bg-[#dce8de]"><img src="/images/primary-care-consultation.jpg" alt="Doctor talking with a patient" className="h-full w-full object-cover object-[center_42%]" /><div className="absolute inset-0 bg-[#17372b]/10" /></div>
    <section id="meet-providers" className="bg-[#fffefa] py-20 lg:py-28 scroll-mt-20"><div className="max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-16">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8"><div><p className="text-xs font-bold tracking-[.22em] text-[#547859] mb-4">FIND YOUR PERSON</p><h2 className="font-medium text-5xl sm:text-6xl tracking-[-.045em]">Meet our doctors</h2><p className="text-[#617268] mt-3">Browse our team by name, specialty, or clinic.</p></div><span className="text-sm text-[#63766a]">{filtered.length} {filtered.length === 1 ? 'doctor' : 'doctors'} found</span></div>
      <div className="bg-[#f5f7f1] border border-[#e2e9df] rounded-2xl p-4 sm:p-5 mb-9"><div className="flex items-center gap-2 text-[11px] font-bold tracking-[.17em] text-[#547859] mb-4"><SlidersHorizontal size={15} /> FILTER THE TEAM</div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex items-center gap-2 bg-white rounded-lg border border-[#dce6dc] px-4 h-12"><Search size={17} className="text-[#62806a] shrink-0" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or keyword" aria-label="Search doctors" className="bg-transparent outline-none min-w-0 w-full text-sm placeholder:text-[#89988d]" /></label>
        <label className="sr-only" htmlFor="doctor-specialty">Specialty</label><select id="doctor-specialty" value={specialty} onChange={e => setSpecialty(e.target.value)} className="bg-white rounded-lg border border-[#dce6dc] px-4 h-12 text-sm text-[#17372b] cursor-pointer"><option value="all">All specialties</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <label className="sr-only" htmlFor="doctor-location">Location</label><select id="doctor-location" value={location} onChange={e => setLocation(e.target.value)} className="bg-white rounded-lg border border-[#dce6dc] px-4 h-12 text-sm text-[#17372b] cursor-pointer"><option value="all">All locations</option>{physicalBranches.map(b => <option key={b.id} value={b.area}>{b.area}</option>)}</select>
        <label className="sr-only" htmlFor="doctor-care">Visit type</label><select id="doctor-care" value={careType} onChange={e => setCareType(e.target.value)} className="bg-white rounded-lg border border-[#dce6dc] px-4 h-12 text-sm text-[#17372b] cursor-pointer"><option value="all">All visit types</option><option value="virtual">Virtual available</option><option value="in-person">In person</option></select>
      </div>{activeFilters && <button onClick={resetFilters} className="inline-flex items-center gap-1 text-xs font-semibold mt-4 text-[#486c51] hover:underline"><X size={14} /> Clear filters</button>}</div>
      {filtered.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6">{filtered.map((doctor, index) => <article key={doctor.id} className="group flex flex-col bg-[#f7f7f2] rounded-[1.2rem] border border-[#e8ebe3] overflow-hidden hover:shadow-[0_14px_35px_rgba(29,69,44,.1)] transition-shadow">
        <div className="relative aspect-[1.05] overflow-hidden flex items-end justify-center" style={{ backgroundColor: ['#dfebdf','#e8e4d9','#dce9e9','#e8e7df'][index % 4] }}><div className="absolute size-[78%] rounded-full bg-white/45 bottom-[-22%]" /><img src={doctor.image} alt={doctor.name} loading="lazy" className="relative z-10 h-[95%] w-[90%] object-cover object-top mix-blend-multiply group-hover:scale-[1.025] transition-transform duration-500" /></div>
        <div className="p-5 sm:p-6 flex flex-col flex-1"><div className="flex flex-wrap gap-1.5 mb-4"><span className="rounded-full bg-[#e6eee4] text-[#42644a] px-2.5 py-1 text-[10px] font-semibold leading-none">{doctor.departmentName}</span>{doctor.acceptsVirtual && <span className="rounded-full bg-white text-[#5b7162] px-2.5 py-1 text-[10px] font-semibold leading-none">Virtual</span>}</div><h3 className="font-medium text-[1.65rem] leading-tight tracking-[-.03em]">{doctor.name}</h3><p className="text-sm text-[#637369] leading-relaxed mt-2 min-h-[60px]">{doctor.title}</p><p className="text-xs text-[#6e7d72] mt-2">{doctor.experienceYears} years of experience</p><button onClick={() => onSelectDoctor(doctor.id)} className="mt-6 rounded-full border border-[#2c5940] text-[#17372b] py-3 px-4 w-full text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#194d38] hover:text-white transition-colors">View profile <ArrowUpRight size={16} /></button></div>
      </article>)}</div> : <div className="rounded-2xl bg-[#f5f7f1] text-center py-16 px-5"><h3 className="font-medium text-3xl">No doctors match those filters</h3><p className="text-[#617268] mt-2">Try another specialty, location, or name.</p><button onClick={resetFilters} className="rounded-full bg-[#194d38] text-white px-6 py-3 mt-6 font-semibold">Show all doctors</button></div>}
    </div></section>
    <section className="bg-[#dcead8] py-20"><div className="max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-16 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8"><div><p className="text-xs font-bold tracking-[.2em] text-[#4a7657] mb-4">EXPLORE MORE</p><h2 className="font-medium text-4xl sm:text-5xl tracking-[-.04em]">Know the care you need?</h2><p className="text-[#5a6e60] mt-3">Explore services, then meet the team behind them.</p></div><button onClick={onExploreDepartments} className="rounded-full bg-[#194d38] text-white px-7 py-4 text-sm font-semibold inline-flex items-center justify-center gap-3 self-start lg:self-auto">Explore departments <ArrowRight size={17} /></button></div></section>
  </div>;
}
