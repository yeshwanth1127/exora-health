import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown, UserRound } from 'lucide-react';
import { NAV_ITEMS, useActiveSection, lockActiveSection, navItemForSection } from './navigation';
import { ClinicAnnouncement } from './ClinicAnnouncement';

export const EmergencyAmbulanceIcon: React.FC<{ className?: string }> = ({ className = "size-4.5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {/* 3 Radiating siren light rays */}
    <path d="M7 4L8.8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M12 2.5V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M17 4L15.2 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />

    {/* Siren Dome on roof */}
    <path d="M10.8 6.5C10.8 5.8 11.3 5.3 12 5.3C12.7 5.3 13.2 5.8 13.2 6.5V7.5H10.8V6.5Z" fill="currentColor" />

    {/* Vehicle Body */}
    <path
      d="M7 8.5C7 7.7 7.6 7 8.4 7H15.6C16.4 7 17 7.7 17 8.5L18.8 13.5C19 14.1 19 14.6 19 15.2V19C19 19.6 18.6 20 18 20H17C16.4 20 16 19.6 16 19V18.5H8V19C8 19.6 7.6 20 7 20H6C5.4 20 5 19.6 5 19V15.2C5 14.6 5 14.1 5.2 13.5L7 8.5Z"
      fill="currentColor"
    />

    {/* Front Windshield Cutout (White) */}
    <path
      d="M7.8 9.2H16.2C16.6 9.2 16.9 9.5 16.8 9.9L16.1 12.8C16 13.2 15.7 13.5 15.3 13.5H8.7C8.3 13.5 8 13.2 7.9 12.8L7.2 9.9C7.1 9.5 7.4 9.2 7.8 9.2Z"
      fill="white"
    />

    {/* Dual Round Headlights (White) */}
    <circle cx="7.5" cy="16.2" r="1.2" fill="white" />
    <circle cx="16.5" cy="16.2" r="1.2" fill="white" />

    {/* Wheels / Tires (Bottom corners) */}
    <rect x="5.2" y="19" width="2.4" height="2" rx="0.8" fill="currentColor" />
    <rect x="16.4" y="19" width="2.4" height="2" rx="0.8" fill="currentColor" />
  </svg>
);

export const EmergencyPill: React.FC<{
  phoneNumber?: string;
  className?: string;
  isScrolled?: boolean;
}> = ({ phoneNumber = '99017 11716', className = '', isScrolled = false }) => {
  return (
    <a
      href="tel:+919901711716"
      className={`group inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-3 sm:px-3.5 py-1.5 text-xs sm:text-[13px] font-semibold text-[#b91c1c] shadow-xs hover:shadow-md transition-all duration-200 active:scale-95 cursor-pointer select-none shrink-0 ${
        isScrolled
          ? 'bg-white border border-red-100/90 hover:bg-neutral-50'
          : 'bg-white/95 border border-white hover:bg-white'
      } ${className}`}
      title={`Call 24/7 Emergency Helpline: ${phoneNumber}`}
    >
      <EmergencyAmbulanceIcon className="size-4 sm:size-4.5 text-[#b91c1c] shrink-0 transition-transform duration-200 group-hover:scale-110" />
      <span className="whitespace-nowrap tracking-tight">
        {/* Full prompt only on extra-large screens to prevent collision on laptop viewports */}
        <span className="hidden xl:inline font-medium text-stone-700">For Emergency Call: </span>
        <span className="font-bold tracking-normal text-[#b91c1c]">{phoneNumber}</span>
      </span>
    </a>
  );
};

interface StickyEmergencyHeaderProps {
  onNavigate?: (section: string) => void;
  onOpenBooking?: () => void;
  onOpenLogin?: () => void;
  user?: { name: string; identifier: string } | null;
  showAnnouncement?: boolean;
  forceScrolledStyle?: boolean;
}

/**
 * Unified End-to-End Frosted Glass Top Navigation Bar.
 * Spans edge-to-edge (100% width) across the top in both normal and scrolled states,
 * eliminating all collision between floating islands.
 */
export const StickyEmergencyHeader: React.FC<StickyEmergencyHeaderProps> = ({
  onNavigate,
  onOpenBooking,
  onOpenLogin,
  user,
  showAnnouncement = true,
  forceScrolledStyle = false,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAnnouncementVisible, setIsAnnouncementVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('avocado_clinic_offer_dismissed') !== 'true';
    }
    return true;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const activeSection = useActiveSection();
  const activeItemId = navItemForSection(activeSection)?.id;

  const go = (id: string) => {
    if (id !== 'legal') lockActiveSection(id);
    onNavigate?.(id);
    setOpenGroupId(null);
    setIsMobileMenuOpen(false);
  };

  const effectiveScrolled = forceScrolledStyle || isScrolled;

  const handleDismissAnnouncement = () => {
    setIsAnnouncementVisible(false);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('avocado_clinic_offer_dismissed', 'true');
      } catch (e) {}
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      // Hysteresis scroll threshold: morph cleanly past 60px
      if (window.scrollY > 60) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 w-full z-50 transition-all duration-300 select-none flex flex-col">
      {/* Optional Top Announcement Bar (Integrated, non-colliding, auto-hides on scroll) */}
      <AnimatePresence>
        {showAnnouncement && isAnnouncementVisible && !effectiveScrolled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full overflow-hidden"
          >
            <ClinicAnnouncement
              onClaimOffer={onOpenBooking}
              onClose={handleDismissAnnouncement}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified End-to-End Frosted Glass Top Navigation Bar */}
      <div
        className={`w-full transition-all duration-300 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_Arial,_sans-serif] ${
          effectiveScrolled
            ? 'backdrop-blur-xl bg-white/85 supports-[backdrop-filter]:bg-white/75 border-b border-stone-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.06)] py-2 sm:py-2.5'
            : 'backdrop-blur-xl bg-slate-950/40 supports-[backdrop-filter]:bg-slate-950/30 border-b border-white/15 py-3 sm:py-3.5 shadow-xs'
        }`}
        aria-label="Sri Lakshmi Hospital navigation"
      >
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 flex items-center justify-between gap-3 lg:gap-4 xl:gap-6">
          {/* 1. Brand Logo (Left) */}
          <div
            onClick={() => {
              lockActiveSection('home');
              onNavigate?.('home');
            }}
            className="cursor-pointer group flex flex-col items-start shrink-0"
          >
            <span
              className={`font-serif-logo text-2xl sm:text-[28px] lg:text-[30px] font-bold tracking-tight lowercase leading-none transition-colors ${
                effectiveScrolled ? 'text-[#154734]' : 'text-white'
              }`}
            >
              avocado
            </span>
            <span
              className={`text-[9px] sm:text-[10px] tracking-[0.35em] uppercase font-sans font-bold mt-0.5 leading-none pl-0.5 transition-colors ${
                effectiveScrolled ? 'text-[#154734]/80' : 'text-white/90'
              }`}
            >
              HEALTH
            </span>
          </div>

        {/* 2. Frosted Glass Navigation Pill (only where every control fits) */}
        <nav
          aria-label="Section navigation"
          onMouseLeave={() => setOpenGroupId(null)}
          className={`hidden 2xl:flex items-center gap-0.5 p-1 rounded-full transition-all shrink-0 ${
            effectiveScrolled
              ? 'bg-stone-100/90 border border-stone-200/80 shadow-2xs'
              : 'backdrop-blur-md bg-white/20 border border-white/25 shadow-sm'
          }`}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeItemId === item.id;
            const isOpen = openGroupId === item.id;
            return (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => setOpenGroupId(item.children ? item.id : null)}
              >
                <button
                  onClick={() => go(item.id)}
                  aria-haspopup={item.children ? 'menu' : undefined}
                  aria-expanded={item.children ? isOpen : undefined}
                  className={`relative flex items-center gap-1 px-1.5 xl:px-3.5 py-1.5 text-xs xl:text-[13px] rounded-full transition-colors duration-150 cursor-pointer ${
                    effectiveScrolled
                      ? isActive
                        ? 'text-white font-semibold'
                        : 'text-stone-700 hover:text-stone-950 hover:bg-black/[0.04] font-medium'
                      : isActive
                        ? 'text-[#154734] font-semibold'
                        : 'text-white/90 hover:text-white hover:bg-white/10 font-medium'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="endToEndActivePill"
                      className={`absolute inset-0 rounded-full shadow-xs -z-10 ${
                        effectiveScrolled ? 'bg-[#154734]' : 'bg-white'
                      }`}
                      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                  {item.children && (
                    <ChevronDown
                      className={`relative z-10 size-3 opacity-70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  )}
                </button>

                {/* Dropdown */}
                <AnimatePresence>
                  {item.children && isOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      role="menu"
                      className="absolute left-0 top-full pt-3 z-50"
                    >
                      <div className="min-w-[220px] rounded-2xl bg-white/95 backdrop-blur-xl border border-stone-200/80 shadow-[0_16px_40px_rgba(0,0,0,0.12)] p-1.5">
                        {item.children.map((child) => (
                          <button
                            key={child.label}
                            role="menuitem"
                            onClick={() => go(child.id)}
                            className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-950 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* 3. Right Action Group (Responsive & Collision Proof) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Emergency Helpline Pill */}
          <EmergencyPill phoneNumber="99017 11716" isScrolled={effectiveScrolled} />

          {/* User Account / Login Button */}
          {user ? (
            <button
              onClick={onOpenLogin}
              className={`hidden sm:inline-flex items-center gap-2 text-xs sm:text-[13px] font-semibold px-3 py-1.5 rounded-full transition shadow-xs cursor-pointer ${
                effectiveScrolled
                  ? 'bg-stone-100 hover:bg-stone-200 text-[#154734]'
                  : 'bg-white/95 hover:bg-white text-[#154734]'
              }`}
            >
              <span className="size-5 rounded-full bg-[#154734] text-white text-[10px] font-bold flex items-center justify-center">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span>{user.name}</span>
            </button>
          ) : (
            <button
              onClick={onOpenLogin}
              aria-label="Log in"
              className={`hidden sm:inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold px-2.5 xl:px-3 py-1.5 rounded-full transition cursor-pointer ${
                effectiveScrolled
                  ? 'text-stone-700 hover:text-stone-950 hover:bg-stone-100'
                  : 'text-white/90 hover:text-white hover:bg-white/15'
              }`}
            >
              <UserRound className="size-4 lg:inline xl:hidden hidden" />
              {/* Icon-only between lg and xl so Book never gets pushed off the bar */}
              <span className="lg:hidden xl:inline">Log in</span>
            </button>
          )}

          {/* Book Appointment CTA */}
          <button
            onClick={onOpenBooking}
            className={`hidden sm:inline-flex text-xs sm:text-[13px] font-semibold px-4 sm:px-5 py-1.5 sm:py-2 rounded-full transition shadow-xs cursor-pointer active:scale-95 ${
              effectiveScrolled
                ? 'bg-[#154734] hover:bg-[#0f3426] text-white'
                : 'bg-white text-[#154734] hover:bg-white/95'
            }`}
          >
            Book
          </button>

          {/* Compact navigation */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className={`inline-flex 2xl:hidden p-1.5 rounded-full transition cursor-pointer ${
              effectiveScrolled
                ? 'text-stone-700 hover:text-stone-950 hover:bg-stone-100'
                : 'text-white hover:bg-white/15'
            }`}
          >
            {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
    </div>

      {/* Compact navigation drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-stone-200/50 bg-white/95 backdrop-blur-xl shadow-2xl 2xl:hidden"
          >
            <div className="max-w-[1440px] mx-auto px-4 py-3 flex flex-col gap-1 max-h-[calc(100dvh-72px)] overflow-y-auto overscroll-contain">
              {NAV_ITEMS.map((item) => {
                const isActive = activeItemId === item.id;
                return (
                  <div key={item.id}>
                    <button
                      onClick={() => go(item.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'bg-[#154734] text-white font-semibold'
                          : 'text-stone-700 hover:bg-stone-100 hover:text-stone-950'
                      }`}
                    >
                      <span>{item.label}</span>
                      {isActive && <span className="size-2 rounded-full bg-white/80" />}
                    </button>
                    {item.children && (
                      <div className="grid grid-cols-2 gap-x-2 px-2 pt-1 pb-2">
                        {item.children.map((child) => (
                          <button
                            key={child.label}
                            onClick={() => go(child.id)}
                            className="text-left px-3 py-1.5 rounded-lg text-[13px] text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="pt-2 mt-1 border-t border-stone-100 flex items-center gap-2">
                <button
                  onClick={() => {
                    onOpenLogin?.();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-stone-200 text-stone-800 font-semibold text-sm text-center transition cursor-pointer"
                >
                  Patient Portal
                </button>
                <button
                  onClick={() => {
                    onOpenBooking?.();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#154734] hover:bg-[#0f3426] text-white font-semibold text-sm text-center shadow-xs transition cursor-pointer"
                >
                  Book Appointment
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
