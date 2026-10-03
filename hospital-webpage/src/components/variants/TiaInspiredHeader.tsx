import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Menu, X } from 'lucide-react';
import { lockActiveSection, type NavItem } from '../common/navigation';
import { departments } from '../../data/departments';
import { branches } from '../../data/branches';

const TIA_NAV_ITEMS: NavItem[] = [
  { id: 'services', label: 'Services & Symptoms', children: departments.map(department => ({ id: `department-${department.id}`, label: department.name })) },
  { id: 'locations', label: 'Locations', children: branches.map(branch => ({ id: `location-${branch.id}`, label: branch.name })) },
  { id: 'insurance', label: 'Insurance', children: [{ id: 'insurance-pricing', label: 'Coverage & pricing' }, { id: 'packages', label: 'Care packages' }] },
  { id: 'how-it-works', label: 'How It Works', children: [{ id: 'how-it-works', label: 'Your care journey' }, { id: 'doctors', label: 'Meet our doctors' }] },
  { id: 'blog', label: 'Resources', children: [{ id: 'blog', label: 'Articles & guides' }, { id: 'faq', label: 'FAQs' }, { id: 'contact-page', label: 'Contact' }] },
];

interface TiaInspiredHeaderProps {
  onNavigate?: (section: string) => void;
  onOpenBooking?: () => void;
  onOpenLogin?: () => void;
  user?: { name: string; identifier: string } | null;
  showAnnouncement?: boolean;
  forceScrolledStyle?: boolean;
}

export function TiaInspiredHeader({ onNavigate, onOpenBooking, onOpenLogin, user }: TiaInspiredHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const go = (id: string) => {
    if (id !== 'legal') lockActiveSection(id);
    onNavigate?.(id);
    setOpenGroupId(null);
    setIsMobileMenuOpen(false);
  };

  return <header className="fixed inset-x-0 top-0 z-50 border-t-[3px] border-[#17372b] bg-[#fffaf4] text-[#24382c] shadow-[0_3px_20px_rgba(25,56,38,.06)]">
    <div className="h-7 border-b border-[#e9e6db] bg-[#f2f4eb]">
      <div className="mx-auto flex h-full max-w-[1360px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <span className="hidden sm:block text-[11px] font-medium tracking-[.08em] text-[#647768]">CARE ACROSS BENGALURU</span>
        <a href="tel:+918049682800" className="ml-auto text-[11px] sm:text-xs font-semibold text-[#315c40] hover:underline underline-offset-2">
          <span className="font-normal text-[#63786a]">24/7 emergency&nbsp; </span>080 4968 2800
        </a>
      </div>
    </div>
    <div className="mx-auto flex h-[66px] lg:h-[78px] max-w-[1360px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
      <button type="button" onClick={() => go('home')} aria-label="Avocado Health home" className="shrink-0 text-left leading-none">
        <span className="block font-serif-logo text-[30px] lg:text-[36px] font-bold lowercase tracking-[-.06em] text-[#17372b]">avocado</span>
        <span className="block pl-0.5 mt-0.5 text-[9px] lg:text-[10px] font-bold tracking-[.37em] text-[#315b41]">HEALTH</span>
      </button>

      <nav aria-label="Main navigation" className="hidden xl:flex items-center gap-4 2xl:gap-6 h-full">
        {TIA_NAV_ITEMS.map(item => <div
          key={item.id}
          className="relative flex h-full items-center"
          onMouseEnter={() => setOpenGroupId(item.children ? item.id : null)}
          onMouseLeave={() => setOpenGroupId(null)}
        >
          <button type="button" onClick={() => go(item.id)} className="whitespace-nowrap text-[14px] font-medium text-[#2d3d32] hover:text-[#1e6946] transition-colors">
            {item.label}
          </button>
          {item.children && <button type="button" aria-label={`Show ${item.label} menu`} aria-haspopup="menu" aria-expanded={openGroupId === item.id} onClick={() => setOpenGroupId(openGroupId === item.id ? null : item.id)} className="ml-1 p-1 text-[#53695a] hover:text-[#1e6946]"><ChevronDown size={15} className={`transition-transform ${openGroupId === item.id ? 'rotate-180' : ''}`} /></button>}
          <AnimatePresence>
            {item.children && openGroupId === item.id && <motion.div role="menu" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: .16 }} className="absolute left-0 top-[calc(100%-8px)] w-[270px] max-h-[65vh] overflow-y-auto rounded-2xl border border-[#dbe6da] bg-[#fffefa] p-2 shadow-[0_18px_45px_rgba(23,55,43,.12)]">
              <button role="menuitem" onClick={() => go(item.id)} className="w-full rounded-xl bg-[#e9f0e5] px-4 py-3 text-left text-sm font-semibold text-[#24533a] hover:bg-[#dcead8]">Explore {item.label}</button>
              {item.children.map(child => <button key={child.label} role="menuitem" onClick={() => go(child.id)} className="block w-full rounded-xl px-4 py-2.5 text-left text-[13px] text-[#4c5f51] hover:bg-[#f1f5ed] hover:text-[#17372b]">{child.label}</button>)}
            </motion.div>}
          </AnimatePresence>
        </div>)}
      </nav>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button type="button" onClick={onOpenBooking} className="hidden sm:inline-flex min-h-11 items-center justify-center rounded-xl bg-[#24553c] px-5 lg:px-6 text-sm font-semibold text-white hover:bg-[#173f2d] transition-colors">Book now</button>
        <button type="button" onClick={onOpenLogin} className="hidden sm:inline-flex min-h-11 items-center justify-center rounded-xl border border-[#95a69a] px-5 lg:px-6 text-sm font-medium text-[#24382c] hover:border-[#24553c] hover:bg-[#f0f4ec] transition-colors">{user ? user.name : 'Portal login'}</button>
        <button type="button" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={isMobileMenuOpen} aria-controls="mobile-navigation" className="inline-flex xl:hidden size-11 items-center justify-center rounded-xl border border-[#d9e2d7] text-[#24382c] hover:bg-[#f1f5ed]">{isMobileMenuOpen ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
    </div>
    <AnimatePresence>
      {isMobileMenuOpen && <motion.nav id="mobile-navigation" aria-label="Mobile navigation" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .2 }} className="xl:hidden overflow-hidden border-t border-[#e4e9dd] bg-[#fffefa] shadow-xl">
        <div className="mx-auto max-h-[calc(100dvh-100px)] max-w-[1360px] overflow-y-auto px-5 sm:px-8 py-4">
          {TIA_NAV_ITEMS.map(item => <div key={item.id} className="border-b border-[#e8ede4]">
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => go(item.id)} className="flex-1 py-3.5 text-left text-base font-medium text-[#24382c]">{item.label}</button>
              {item.children && <button aria-label={`Show ${item.label} links`} aria-expanded={openGroupId === item.id} onClick={() => setOpenGroupId(openGroupId === item.id ? null : item.id)} className="size-10 flex items-center justify-center text-[#53695a]"><ChevronDown size={18} className={`transition-transform ${openGroupId === item.id ? 'rotate-180' : ''}`} /></button>}
            </div>
            {item.children && openGroupId === item.id && <div className="grid sm:grid-cols-2 gap-1 pb-3">{item.children.map(child => <button key={child.label} onClick={() => go(child.id)} className="rounded-lg px-3 py-2 text-left text-sm text-[#526858] hover:bg-[#f1f5ed]">{child.label}</button>)}</div>}
          </div>)}
          <div className="flex gap-3 pt-5 sm:hidden"><button onClick={() => { onOpenBooking?.(); setIsMobileMenuOpen(false); }} className="flex-1 rounded-xl bg-[#24553c] py-3 text-sm font-semibold text-white">Book now</button><button onClick={() => { onOpenLogin?.(); setIsMobileMenuOpen(false); }} className="flex-1 rounded-xl border border-[#95a69a] py-3 text-sm font-medium">Portal login</button></div>
        </div>
      </motion.nav>}
    </AnimatePresence>
  </header>;
}
