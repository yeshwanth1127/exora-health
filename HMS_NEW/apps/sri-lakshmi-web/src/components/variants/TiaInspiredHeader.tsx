import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Menu, X } from 'lucide-react';
import { lockActiveSection, type NavItem } from '../common/navigation';
import { ClinicAnnouncement } from '../common/ClinicAnnouncement';
import { departments } from '../../data/departments';
import { branches } from '../../data/branches';
import { HospitalLogo } from '../common/HospitalLogo';

const TIA_NAV_ITEMS: NavItem[] = [
  { id: 'services', label: 'Services & Symptoms', children: departments.map(department => ({ id: `department-${department.id}`, label: department.name })) },
  { id: 'locations', label: 'Locations', children: branches.map(branch => ({ id: `location-${branch.id}`, label: branch.name })) },
  { id: 'insurance', label: 'Insurance', children: [{ id: 'insurance-pricing', label: 'Coverage & pricing' }, { id: 'packages', label: 'Care packages' }] },
  { id: 'about', label: 'About Us', children: [{ id: 'about', label: 'Our hospital' }, { id: 'founder', label: 'From the founder' }, { id: 'facilities', label: 'Facilities & technology' }, { id: 'doctors', label: 'Meet our doctors' }] },
  { id: 'blog', label: 'Resources', children: [{ id: 'community', label: 'Community & media' }, { id: 'blog', label: 'Articles & guides' }, { id: 'faq', label: 'FAQs' }, { id: 'contact-page', label: 'Contact' }] },
];

interface TiaInspiredHeaderProps {
  onNavigate?: (section: string) => void;
  onOpenBooking?: () => void;
  onOpenLogin?: () => void;
  onOpenSettings?: () => void;
  user?: { name: string; identifier: string } | null;
  showAnnouncement?: boolean;
  forceScrolledStyle?: boolean;
}

export function TiaInspiredHeader({ onNavigate, onOpenBooking, onOpenLogin, onOpenSettings, user }: TiaInspiredHeaderProps) {
  const menuRef = useRef<HTMLDialogElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) return;
    const menu = menuRef.current;
    const previousOverflow = document.body.style.overflow;
    menu?.showModal();
    document.body.style.overflow = 'hidden';
    const desktop = window.matchMedia('(min-width: 1280px)');
    const closeOnDesktop = () => { if (desktop.matches) setIsMenuOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      const restoreFocus = menu?.contains(document.activeElement) || document.activeElement === document.body;
      menu?.close();
      if (restoreFocus && !desktop.matches) menuTriggerRef.current?.focus();
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, [isMenuOpen]);

  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const go = (id: string) => {
    if (id !== 'legal') lockActiveSection(id);
    setIsMenuOpen(false);
    onNavigate?.(id);
    setOpenGroupId(null);
  };

  return <header className="fixed inset-x-0 top-0 z-50 border-t-[3px] border-[#17372b] bg-[#fffaf4] text-[#24382c] shadow-[0_3px_20px_rgba(25,56,38,.06)]">
    <ClinicAnnouncement />
    <div className="mx-auto flex h-[66px] xl:h-[78px] w-full max-w-[1360px] items-center justify-between gap-2 sm:gap-4 px-5 sm:px-8 lg:px-12">
      <button type="button" onClick={() => go('home')} aria-label="Sri Lakshmi Hospital home" className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 text-left leading-none">
        <HospitalLogo className="size-7 sm:size-10 lg:size-11" />
        <span>
        <span className="block font-serif-logo text-[23px] sm:text-[30px] lg:text-[36px] font-bold lowercase tracking-[-.06em] text-[#17372b]">sri lakshmi</span>
        <span className="block pl-0.5 mt-0.5 text-[9px] lg:text-[10px] font-bold tracking-[.37em] text-[#315b41]">HOSPITAL</span>
        </span>
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
        <button type="button" onClick={() => { setIsMenuOpen(false); onOpenBooking?.(); }} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#24553c] px-3.5 sm:min-h-11 sm:px-5 lg:px-6 text-xs sm:text-sm font-semibold text-white hover:bg-[#173f2d] transition-colors">Book now</button>
        {onOpenLogin && <button type="button" onClick={onOpenLogin} className="hidden sm:inline-flex min-h-11 items-center justify-center rounded-xl border border-[#95a69a] px-5 lg:px-6 text-sm font-medium text-[#24382c] hover:border-[#24553c] hover:bg-[#f0f4ec] transition-colors">{user ? user.name : 'Log in'}</button>}
        <button ref={menuTriggerRef} type="button" onClick={() => setIsMenuOpen(true)} aria-label="Open navigation menu" aria-haspopup="dialog" aria-expanded={isMenuOpen} className="xl:hidden grid size-11 place-items-center rounded-xl border border-[#c8d5c8] hover:bg-[#edf3e9]"><Menu size={22} /></button>
      </div>
    </div>
    <dialog ref={menuRef} aria-labelledby="mobile-menu-title" onCancel={() => setIsMenuOpen(false)} onClose={() => setIsMenuOpen(false)} className="mobile-navigation m-0 h-dvh max-h-dvh w-full max-w-none bg-[#fffaf4] text-[#24382c]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#dce6d8] bg-[#fffaf4] px-5 py-4">
        <h2 id="mobile-menu-title" className="flex items-center gap-2 text-xl font-semibold"><HospitalLogo className="size-8" />Explore Sri Lakshmi</h2>
        <button type="button" autoFocus onClick={() => setIsMenuOpen(false)} aria-label="Close navigation menu" className="grid size-11 place-items-center rounded-xl border border-[#c8d5c8]"><X size={22} /></button>
      </div>
      <nav aria-label="Mobile navigation" className="px-5 py-4">
        <button type="button" onClick={() => go('home')} className="mobile-nav-link">Home</button>
        <button type="button" onClick={() => go('doctors')} className="mobile-nav-link">Find a doctor</button>
        {TIA_NAV_ITEMS.map(item => <details key={item.id} className="border-b border-[#dce6d8]">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold">{item.label}<ChevronDown size={18} /></summary>
          <div className="pb-3 pl-3">
            <button type="button" onClick={() => go(item.id)} className="mobile-nav-link text-[#24553c]">Explore {item.label}</button>
            {item.children?.map(child => <button key={child.id} type="button" onClick={() => go(child.id)} className="mobile-nav-link font-normal">{child.label}</button>)}
          </div>
        </details>)}
        {onOpenLogin && <button type="button" onClick={() => { setIsMenuOpen(false); onOpenLogin(); }} className="mobile-nav-link">{user ? user.name : 'Log in'}</button>}
        {onOpenSettings && <button type="button" onClick={() => { setIsMenuOpen(false); onOpenSettings(); }} className="mobile-nav-link">Display settings</button>}
        <button type="button" onClick={() => { setIsMenuOpen(false); onOpenBooking?.(); }} className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#24553c] text-base font-semibold text-white">Book an appointment</button>
      </nav>
    </dialog>
  </header>;
}
