import { ArrowRight, ArrowUpRight, MapPin, Phone } from 'lucide-react';
import { departments } from '../../data/departments';
import { branches } from '../../data/branches';

interface LightFooterProps {
  onOpenBooking?: () => void;
  onOpenLegal?: (docId?: string) => void;
}

const patientLinks = [
  { label: 'Our doctors', href: '/?page=doctors' },
  { label: 'Care departments', href: '/?page=departments' },
  { label: 'Insurance', href: '/?page=insurance' },
  { label: 'Pricing information', href: '/?page=insurance-pricing' },
  { label: 'How care works', href: '/?page=how-it-works' },
  { label: 'Contact', href: '/?page=contact' },
  { label: 'Patient stories', href: '/#testimonials' },
  { label: 'Frequently asked questions', href: '/?page=faq' },
  { label: 'Articles & guides', href: '/?page=blog' },
];
const legalLinks = [
  { label: 'Terms of service', id: 'terms' },
  { label: 'Privacy notice', id: 'privacy' },
  { label: 'Teleconsultation consent', id: 'telehealth' },
  { label: 'Health data & ABHA policy', id: 'records' },
  { label: 'Insurance & billing', id: 'billing' },
  { label: 'Cancellation & refunds', id: 'refund' },
];

export function LightFooter({ onOpenBooking, onOpenLegal }: LightFooterProps) {
  return <footer id="contact" className="bg-[#f5f7f1] text-[#17372b]">
    <section className="bg-[#dcead8] py-20 sm:py-24">
      <div className="mx-auto grid max-w-[1360px] gap-9 px-5 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end lg:px-12">
        <div>
          <p className="mb-5 text-xs font-bold tracking-[.2em] text-[#567b5d]">HERE WHEN YOU NEED US</p>
          <h2 className="max-w-3xl font-medium text-5xl sm:text-6xl tracking-[-.05em] leading-[1.05]">Let’s take the next step together.</h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-[#526a59]">Find a doctor, ask a question, or plan your first visit. We’re ready to help you get started.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={onOpenBooking} className="inline-flex items-center gap-2 rounded-full bg-[#24553c] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#173f2d] transition-colors">Book a visit <ArrowRight size={17} /></button>
          <a href="tel:+918049682800" className="inline-flex items-center gap-2 rounded-full border border-[#96b69b] px-6 py-3.5 text-sm font-semibold text-[#24553c] hover:bg-[#eaf2e7] transition-colors"><Phone size={16} /> Call us</a>
        </div>
      </div>
    </section>
    <div className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12">
      <div className="grid gap-10 border-b border-[#d8e4d6] py-16 sm:grid-cols-2 lg:grid-cols-[1.3fr_1.1fr_1fr_1fr_1fr]">
        <div className="sm:col-span-2 lg:col-span-1">
          <a href="/" className="inline-block leading-none" aria-label="Avocado Health home"><span className="block font-serif-logo text-[37px] font-bold tracking-[-.06em]">avocado</span><span className="mt-1 block pl-0.5 text-[10px] font-bold tracking-[.38em] text-[#476b4f]">HEALTH</span></a>
          <p className="mt-6 max-w-[260px] text-sm leading-relaxed text-[#5b7061]">Thoughtful care for people and families across Bengaluru.</p>
          <p className="mt-6 flex items-start gap-2 text-sm leading-relaxed text-[#52695a]"><MapPin size={17} className="mt-0.5 shrink-0 text-[#4e7958]" />100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038</p>
        </div>
        <div>
          <h3 className="mb-5 text-xs font-bold tracking-[.16em] text-[#416a4b]">SPECIALTIES</h3>
          <ul className="space-y-2.5">{departments.map(department => <li key={department.id}><a href={`/?page=department&id=${department.id}`} className="text-sm leading-relaxed text-[#5c7061] hover:text-[#1b5b39] hover:underline underline-offset-3">{department.name}</a></li>)}</ul>
        </div>
        <div>
          <h3 className="mb-5 text-xs font-bold tracking-[.16em] text-[#416a4b]">LOCATIONS</h3>
          <ul className="space-y-2.5">{branches.map(branch => <li key={branch.id}><a href={`/?page=location&id=${branch.id}`} className="text-sm leading-relaxed text-[#5c7061] hover:text-[#1b5b39] hover:underline underline-offset-3">{branch.name}</a></li>)}</ul>
          <a href="tel:+918049682800" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#24553c]">24/7 emergency <ArrowUpRight size={15} /></a>
        </div>
        <div>
          <h3 className="mb-5 text-xs font-bold tracking-[.16em] text-[#416a4b]">PATIENTS</h3>
          <ul className="space-y-2.5">{patientLinks.map(link => <li key={link.label}><a href={link.href} className="text-sm leading-relaxed text-[#5c7061] hover:text-[#1b5b39] hover:underline underline-offset-3">{link.label}</a></li>)}</ul>
        </div>
        <div>
          <h3 className="mb-5 text-xs font-bold tracking-[.16em] text-[#416a4b]">LEGAL</h3>
          <ul className="space-y-2.5">{legalLinks.map(link => <li key={link.id}><button onClick={() => onOpenLegal?.(link.id)} className="text-left text-sm leading-relaxed text-[#5c7061] hover:text-[#1b5b39] hover:underline underline-offset-3">{link.label}</button></li>)}</ul>
        </div>
      </div>
      <div className="flex flex-col gap-4 py-6 text-xs text-[#7a8c7e] sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Avocado Health. All rights reserved.</p>
        <button onClick={() => onOpenLegal?.()} className="self-start font-medium text-[#416a4b] hover:underline underline-offset-3">View all policies</button>
      </div>
    </div>
  </footer>;
}
