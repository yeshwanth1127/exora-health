import { ArrowUpRight } from 'lucide-react';
import { HospitalLogo } from '../common/HospitalLogo';

interface LightFooterProps {
  onOpenBooking?: () => void;
  onOpenLegal?: (docId?: string) => void;
}

const exploreLinks = [
  { label: 'Departments', href: '/?page=departments' },
  { label: 'Doctors', href: '/?page=doctors' },
  { label: 'Locations', href: '/?page=locations' },
  { label: 'Insurance & pricing', href: '/?page=insurance-pricing' },
];

const helpLinks = [
  { label: 'About us', href: '/about/' },
  { label: 'From the founder', href: '/founder/' },
  { label: 'Facilities & technology', href: '/facilities/' },
  { label: 'Community & media', href: '/community/' },
  { label: 'Cashless care', href: '/insurance/' },
  { label: 'Frequently asked questions', href: '/?page=faq' },
  { label: 'Articles & guides', href: '/?page=blog' },
  { label: 'Contact', href: '/?page=contact' },
];

export function LightFooter({ onOpenBooking, onOpenLegal }: LightFooterProps) {
  return <footer id="contact" className="border-t border-[#dce6d9] bg-[#f5f7f1] text-[#17372b]">
    <div className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12">
      <div className="grid gap-8 py-8 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-10 lg:py-10">
        <div>
          <a href="/" className="inline-flex items-center gap-2.5 leading-none" aria-label="Sri Lakshmi Hospital home">
            <HospitalLogo className="size-11" />
            <span>
            <span className="block font-serif-logo text-[34px] font-bold tracking-[-.06em]">sri lakshmi</span>
            <span className="mt-1 block pl-0.5 text-[9px] font-bold tracking-[.38em] text-[#476b4f]">HOSPITAL</span>
            </span>
          </a>
          <p className="mt-4 max-w-[230px] text-sm leading-relaxed text-[#5b7061]">Care for people and families across Bengaluru.</p>
          <button type="button" onClick={onOpenBooking} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#24553c] hover:underline underline-offset-3">Book a visit <ArrowUpRight size={15} /></button>
        </div>
        <div>
          <h3 className="mb-3 text-xs font-bold tracking-[.14em] text-[#416a4b]">EXPLORE</h3>
          <ul className="space-y-2">{exploreLinks.map(link => <li key={link.label}><a href={link.href} className="text-sm text-[#5c7061] hover:text-[#1b5b39] hover:underline underline-offset-3">{link.label}</a></li>)}</ul>
        </div>
        <div>
          <h3 className="mb-3 text-xs font-bold tracking-[.14em] text-[#416a4b]">HELP</h3>
          <ul className="space-y-2">{helpLinks.map(link => <li key={link.label}><a href={link.href} className="text-sm text-[#5c7061] hover:text-[#1b5b39] hover:underline underline-offset-3">{link.label}</a></li>)}</ul>
        </div>
        <div>
          <h3 className="mb-3 text-xs font-bold tracking-[.14em] text-[#416a4b]">LEGAL</h3>
          <ul className="space-y-2">
            <li><button type="button" onClick={() => onOpenLegal?.('terms')} className="text-left text-sm text-[#5c7061] hover:text-[#1b5b39] hover:underline underline-offset-3">Terms of service</button></li>
            <li><button type="button" onClick={() => onOpenLegal?.('privacy')} className="text-left text-sm text-[#5c7061] hover:text-[#1b5b39] hover:underline underline-offset-3">Privacy notice</button></li>
            <li><button type="button" onClick={() => onOpenLegal?.()} className="text-left text-sm text-[#5c7061] hover:text-[#1b5b39] hover:underline underline-offset-3">All policies</button></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#d8e4d6] py-4 text-xs text-[#7a8c7e]">© 2026 Sri Lakshmi Hospital. All rights reserved.</div>
    </div>
  </footer>;
}
