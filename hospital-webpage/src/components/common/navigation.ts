import { useState, useEffect } from 'react';
import { departments } from '../../data/departments';
import { branches } from '../../data/branches';

export interface NavChild {
  id: string; // section id (or 'legal' → legal hub page)
  label: string;
}

export interface NavItem {
  id: string;
  label: string;
  children?: NavChild[];
}

// Grouped so the bar holds every section without collapsing the right-hand actions.
// Children are section anchors today; they become routes once the inner flows exist.
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'services',
    label: 'Departments',
    children: departments.map((d) => ({ id: `department-${d.id}`, label: d.name })),
  },
  { id: 'doctors', label: 'Doctors' },
  {
    id: 'locations',
    label: 'Branches',
    children: branches.map((b) => ({ id: 'locations', label: b.name })),
  },
  {
    id: 'packages',
    label: 'Packages',
    children: [
      { id: 'packages', label: 'Signature Care' },
      { id: 'packages', label: 'Longevity 360' },
      { id: 'packages', label: 'Executive 360' },
      { id: 'packages', label: 'Pediatrics Care' },
    ],
  },
  { id: 'insurance', label: 'Insurance' },
  {
    id: 'why-choose-us',
    label: 'About',
    children: [
      { id: 'why-choose-us', label: 'Why Sri Lakshmi' },
      { id: 'testimonials', label: 'Patient Stories' },
      { id: 'blogs', label: 'Blog & Guides' },
      { id: 'faq', label: 'FAQ' },
      { id: 'legal', label: 'Legal & Policies' },
    ],
  },
  { id: 'contact', label: 'Contact' },
];

// DOM order matters: the scrollspy takes the last section whose top passed the focal line.
export const TRACKED_SECTION_IDS = [
  'home',
  'why-choose-us',
  'services',
  'doctors',
  'locations',
  'testimonials',
  'insurance',
  'packages',
  'blogs',
  'faq',
  'contact',
];

/** Top-level nav item that owns a section id (itself or via a child). */
export function navItemForSection(section: string): NavItem | undefined {
  return NAV_ITEMS.find((i) => i.id === section || i.children?.some((c) => c.id === section));
}

// Shared subscriber store to keep Hero header and Sticky header 100% in sync
type Listener = (section: string) => void;
const listeners = new Set<Listener>();
let currentActiveSection = 'home';
let lockTimer: ReturnType<typeof setTimeout> | null = null;
let isScrollLocked = false;

function notifyListeners(section: string) {
  if (currentActiveSection === section) return;
  currentActiveSection = section;
  listeners.forEach((listener) => listener(section));
}

/**
 * Calculates current active section based on viewport position.
 */
export function calculateActiveSection() {
  if (isScrollLocked || typeof window === 'undefined') return;

  const scrollY = window.scrollY;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;

  // 1. Extreme Top: definitely 'home'
  if (scrollY < 80) {
    notifyListeners('home');
    return;
  }

  // 2. Extreme Bottom: definitely 'contact'
  if (scrollY + windowHeight >= documentHeight - 60) {
    notifyListeners('contact');
    return;
  }

  // 3. Focal line: 35% of viewport height from top
  // Natural human reading focal line while scrolling down or up.
  const focalOffset = windowHeight * 0.35;

  // Scan through tracked sections monotonically:
  // The active section is the last tracked section whose top is at or above the focal line.
  let matchedSection = 'home';

  for (const id of TRACKED_SECTION_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;

    const rect = el.getBoundingClientRect();
    if (rect.top <= focalOffset) {
      matchedSection = id;
    }
  }

  notifyListeners(matchedSection);
}

/**
 * Instantly locks active section to target during programmatic smooth scroll
 * to prevent flickering across intermediate passing sections.
 * Automatically releases on scrollend, user touch/wheel interaction, or fallback timeout.
 */
export function lockActiveSection(sectionId: string, maxDurationMs = 1400) {
  if (typeof window === 'undefined') return;

  isScrollLocked = true;
  notifyListeners(sectionId);

  if (lockTimer) clearTimeout(lockTimer);

  const unlock = () => {
    isScrollLocked = false;
    window.removeEventListener('scrollend', unlock);
    window.removeEventListener('wheel', unlock);
    window.removeEventListener('touchstart', unlock);
    if (lockTimer) {
      clearTimeout(lockTimer);
      lockTimer = null;
    }
    // Re-verify actual final position once settled
    calculateActiveSection();
  };

  window.addEventListener('scrollend', unlock, { once: true });
  window.addEventListener('wheel', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
  lockTimer = setTimeout(unlock, maxDurationMs);
}

// Single global rAF scroll coordinator
let ticking = false;
function handleGlobalScroll() {
  if (!ticking && !isScrollLocked) {
    window.requestAnimationFrame(() => {
      calculateActiveSection();
      ticking = false;
    });
    ticking = true;
  }
}

let isGlobalListenerAttached = false;
function ensureGlobalScrollListener() {
  if (isGlobalListenerAttached || typeof window === 'undefined') return;
  window.addEventListener('scroll', handleGlobalScroll, { passive: true });
  window.addEventListener('resize', handleGlobalScroll, { passive: true });
  isGlobalListenerAttached = true;
}

/**
 * Custom scrollspy hook to detect the currently visible section
 * with high accuracy, zero dead zones, zero jitter, and smooth responsiveness.
 */
export function useActiveSection(defaultSection: string = 'home'): string {
  const [activeSection, setActiveSection] = useState<string>(currentActiveSection || defaultSection);

  useEffect(() => {
    ensureGlobalScrollListener();

    const listener: Listener = (section) => {
      setActiveSection(section);
    };
    listeners.add(listener);

    // Initial calculation on mount
    calculateActiveSection();

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return activeSection;
}
