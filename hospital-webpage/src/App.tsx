import { LiveBookingEntry } from "./components/booking/LiveBookingEntry";
import { demoBookingEnabled } from './data/clientBrand';
import { lazy, Suspense, useState, useEffect, useLayoutEffect } from 'react';
import { Settings } from 'lucide-react';
import { TiaInspiredHeader } from './components/variants/TiaInspiredHeader';
import { LightCareSearchHero } from './components/variants/LightCareSearchHero';
import { LightWhyChooseUsSection } from './components/variants/LightWhyChooseUsSection';
import { LightServicesBentoSection } from './components/variants/LightServicesBentoSection';
import { LightDoctorsGridSection } from './components/variants/LightDoctorsGridSection';
import { LightBangaloreLocationSection } from './components/variants/LightBangaloreLocationSection';
import { LightInsurancePartnersSection } from './components/variants/LightInsurancePartnersSection';
import { LightPricingRailSection } from './components/variants/LightPricingRailSection';
import { LightBlogReportsSection } from './components/variants/LightBlogReportsSection';
import { LightFooter } from './components/variants/LightFooter';
import { HospitalGallerySection } from './components/sections/HospitalGallerySection';
import { AccreditationsSection } from './components/sections/AccreditationsSection';
import { WhyChooseUsSection } from './components/sections/WhyChooseUsSection';
import { ServicesBentoSection } from './components/sections/ServicesBentoSection';
import { PricingRailSection, PricingRailVariant } from './components/sections/PricingRailSection';
import { DoctorsGridSection } from './components/sections/DoctorsGridSection';
import { BangaloreLocationSection } from './components/sections/BangaloreLocationSection';
import { TestimonialsSection } from './components/sections/TestimonialsSection';
import { InsurancePartnersSection } from './components/sections/InsurancePartnersSection';
import { BlogReportsSection } from './components/sections/BlogReportsSection';
import { FAQSection } from './components/sections/FAQSection';
import { DoctorShowcaseSection } from './components/sections/DoctorShowcaseSection';
import { WhatsAppFloatingWidget } from './components/contact/WhatsAppFloatingWidget';
import { SettingsModal, type DesignMode } from './components/common/SettingsModal';
import { BLOG_POSTS } from './components/blog/blogData';
import { ALL_LEGAL_DOCS } from './components/legal/legalData';
import { branches } from './data/branches';
import { departments } from './data/departments';
import { PageErrorBoundary, PageLoading, PageNotFound } from './components/common/PageStates';
import { CareSearchHero } from './components/home/CareSearchHero';
import { HERO_BACKDROPS, HERO_PLACEMENTS, type HeroBackdrop, type HeroPlacement } from './components/home/heroBackdrops';
import { AICareAssistantModal } from './components/ai/AICareAssistantModal';
import { doctors } from './data/doctors';
import { Doctor } from './types';
import { DOCTOR_PROFILES } from './data/doctorProfiles';
import { VoiceAgentLauncher } from './components/voice/VoiceAgentLauncher';
import { authApi } from './lib/auth';

import { lockActiveSection } from './components/common/navigation';
import { updateSeo } from './seo';
import { AnalyticsConsentBanner } from './components/common/AnalyticsConsentBanner';
import {
  trackPageView,
  updateAnalyticsContext,
  trackNavigation,
  trackDoctorProfileOpened,
  trackBookingIntent,
  trackSearchUsed,
  type PageFamily,
} from './lib/posthog';

const FamilyFaqPage = lazy(() => import('./components/faq/FamilyFaqPage').then(module => ({ default: module.FamilyFaqPage })));
const FamilyBlogListPage = lazy(() => import('./components/blog/FamilyBlogListPage').then(module => ({ default: module.FamilyBlogListPage })));
const FamilyBlogPostPage = lazy(() => import('./components/blog/FamilyBlogPostPage').then(module => ({ default: module.FamilyBlogPostPage })));
const LegalHubPage = lazy(() => import('./components/legal/LegalHubPage').then(module => ({ default: module.LegalHubPage })));
const LegalDocumentPage = lazy(() => import('./components/legal/LegalDocumentPage').then(module => ({ default: module.LegalDocumentPage })));
const DepartmentPage = lazy(() => import('./components/departments/DepartmentPage').then(module => ({ default: module.DepartmentPage })));
const DepartmentsOverviewPage = lazy(() => import('./components/departments/DepartmentsOverviewPage').then(module => ({ default: module.DepartmentsOverviewPage })));
const DoctorsDirectoryPage = lazy(() => import('./components/doctor/DoctorsDirectoryPage').then(module => ({ default: module.DoctorsDirectoryPage })));
const LocationsPage = lazy(() => import('./components/locations/LocationsPage').then(module => ({ default: module.LocationsPage })));
const InsurancePricingPage = lazy(() => import('./components/info/PatientInfoPages').then(module => ({ default: module.InsurancePricingPage })));
const CommunityMediaPage = lazy(() => import('./components/info/CommunityMediaPage').then(module => ({ default: module.CommunityMediaPage })));
const FacilitiesPage = lazy(() => import('./components/info/FacilitiesPage').then(module => ({ default: module.FacilitiesPage })));
const FounderPage = lazy(() => import('./components/info/FounderPage').then(module => ({ default: module.FounderPage })));
const AboutUsPage = lazy(() => import('./components/info/PatientInfoPages').then(module => ({ default: module.AboutUsPage })));
const HowCareWorksPage = lazy(() => import('./components/info/PatientInfoPages').then(module => ({ default: module.HowCareWorksPage })));
const ContactPage = lazy(() => import('./components/info/PatientInfoPages').then(module => ({ default: module.ContactPage })));
const InsuranceAccessPage = lazy(() => import('./components/info/InsuranceAccessPage').then(module => ({ default: module.InsuranceAccessPage })));
const SearchResultsPage = lazy(() => import('./components/search/SearchResultsPage').then(module => ({ default: module.SearchResultsPage })));
const OriginalSearchResultsPage = lazy(() => import('./components/search/OriginalSearchResultsPage').then(module => ({ default: module.OriginalSearchResultsPage })));
const ScheduleAppointmentPage = lazy(() => import('./components/booking/ScheduleAppointmentPage').then(module => ({ default: module.ScheduleAppointmentPage })));
const OriginalScheduleAppointmentPage = lazy(() => import('./components/booking/OriginalScheduleAppointmentPage').then(module => ({ default: module.OriginalScheduleAppointmentPage })));
const DoctorDetailPage = lazy(() => import('./components/doctor/DoctorDetailPage').then(module => ({ default: module.DoctorDetailPage })));

type Page = 'community' | 'facilities' | 'founder' | 'about' | 'home' | 'faq' | 'blog' | 'blog-post' | 'legal' | 'legal-doc' | 'departments' | 'department' | 'doctors' | 'search-results' | 'schedule-appointment' | 'doctor-detail' | 'locations' | 'location' | 'insurance' | 'insurance-pricing' | 'how-it-works' | 'contact-page' | 'not-found';
const pagesWithBothDesigns: Page[] = ['home', 'search-results', 'schedule-appointment'];

const pageFamilyMap: Record<Page, PageFamily> = {
  'home': 'home',
  'about': 'info',
  'founder': 'info',
  'community': 'info',
  'facilities': 'info',
  'faq': 'faq',
  'blog': 'blog_list',
  'blog-post': 'blog_post',
  'legal': 'legal_hub',
  'legal-doc': 'legal_doc',
  'departments': 'departments',
  'department': 'department_detail',
  'doctors': 'doctors',
  'doctor-detail': 'doctor_detail',
  'locations': 'locations',
  'location': 'location_detail',
  'search-results': 'search',
  'schedule-appointment': 'booking',
  'insurance': 'info',
  'insurance-pricing': 'info',
  'how-it-works': 'info',
  'contact-page': 'info',
  'not-found': 'not_found',
};

function scrollToPageTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

export function App() {
  const [currentView, setCurrentView] = useState<Page>('home');
  const [selectedDoctorDetailId, setSelectedDoctorDetailId] = useState<string>('doc-1');
  const [doctorReturnView, setDoctorReturnView] = useState<'home' | 'doctors' | 'department' | 'search-results' | 'location'>('doctors');
  const [scheduleDoctorId, setScheduleDoctorId] = useState<string>('doc-1');
  const [scheduleInitialStep, setScheduleInitialStep] = useState<1 | 2>(1);
  const [schedulePrefillDate, setSchedulePrefillDate] = useState<string | undefined>();
  const [schedulePrefillSlot, setSchedulePrefillSlot] = useState<string | undefined>();
  const [scheduleReturnView, setScheduleReturnView] = useState<Page>('search-results');
  const [searchResultsFilter, setSearchResultsFilter] = useState<{ careType: string; specialtyId?: string; dateTime?: string }>({
    careType: 'Annual physical / checkup',
    specialtyId: 'general-medicine',
    dateTime: 'Anytime',
  });
  const [selectedDateTime, setSelectedDateTime] = useState<string>('Anytime');
  const [selectedPostId, setSelectedPostId] = useState<string>('before-your-first-specialist-visit');
  const [selectedLegalDocId, setSelectedLegalDocId] = useState<string>('terms');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('ent');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('kr-puram');
  const [aiRecommendation, setAiRecommendation] = useState<{
    query: string;
    matchedDoctor: Doctor;
    clinicalReasoning: string;
  } | null>(null);
  const [user, setUser] = useState<{ name: string; identifier: string } | null>(null);
  useEffect(() => {
    authApi.me().then((actor) => {
      if (actor.role === 'patient') setUser({ name: actor.display_name, identifier: actor.user_id });
    }).catch(() => undefined);
  }, []);
  const openPatientPortal = () => {
    window.location.href = '/portal';
  };
  const openLogin = openPatientPortal;
  const activeTestimonialOption = 'option2' as const;
  const [pricingRailVariant, setPricingRailVariant] = useState<PricingRailVariant>('tall');
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [aiSpecialtyId, setAiSpecialtyId] = useState<string | undefined>();
  const [aiQuery, setAiQuery] = useState<string | undefined>();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [designMode, setDesignMode] = useState<DesignMode>(() => {
    try {
      const saved = localStorage.getItem('avocado_design_mode_v1');
      if (saved === 'original' || saved === 'light') return saved;
      // A mixed set of old component choices is intentionally reset to one coherent mode.
      const legacy = JSON.parse(localStorage.getItem('avocado_component_options_v3') || localStorage.getItem('avocado_component_options_v2') || '{}');
      const homepageKeys = ['header', 'hero', 'why', 'services', 'doctors', 'locations', 'insurance', 'pricing', 'articles', 'footer'];
      return homepageKeys.every(key => legacy[key] === 'light') ? 'light' : 'original';
    } catch {
      return 'original';
    }
  });
  // v2: the default moved from the plain hero to a photo, so earlier saved choices are not carried over.
  const [heroBackdrop, setHeroBackdrop] = useState<HeroBackdrop>(() => {
    try {
      const saved = localStorage.getItem('avocado_hero_backdrop_v2');
      return saved === 'plain' || (saved && saved in HERO_BACKDROPS) ? saved as HeroBackdrop : 'visit';
    } catch {
      return 'visit';
    }
  });
  const [heroPlacement, setHeroPlacement] = useState<HeroPlacement>(() => {
    try {
      const saved = localStorage.getItem('avocado_hero_placement_v1');
      return HERO_PLACEMENTS.find(option => option.id === saved)?.id ?? 'fullbleed';
    } catch {
      return 'fullbleed';
    }
  });
  useEffect(() => {
    try { localStorage.setItem('avocado_design_mode_v1', designMode); } catch { /* Storage is optional. */ }
  }, [designMode]);
  useEffect(() => {
    try { localStorage.setItem('avocado_hero_backdrop_v2', heroBackdrop); } catch { /* Storage is optional. */ }
  }, [heroBackdrop]);
  useEffect(() => {
    try { localStorage.setItem('avocado_hero_placement_v1', heroPlacement); } catch { /* Storage is optional. */ }
  }, [heroPlacement]);
  useEffect(() => {
    updateSeo(currentView, {
      post: selectedPostId,
      department: selectedDepartmentId,
      doctor: selectedDoctorDetailId,
      branch: selectedBranchId,
      legal: selectedLegalDocId,
    });
  }, [currentView, selectedPostId, selectedDepartmentId, selectedDoctorDetailId, selectedBranchId, selectedLegalDocId]);

  const routeDetailId = currentView === 'department' ? selectedDepartmentId
    : currentView === 'doctor-detail' ? selectedDoctorDetailId
    : currentView === 'blog-post' ? selectedPostId
    : currentView === 'legal-doc' ? selectedLegalDocId
    : currentView === 'location' ? selectedBranchId
    : currentView === 'schedule-appointment' ? scheduleDoctorId
    : '';

  // Settled route analytics observer adhering to POSTHOG_ANALYTICS_PLAN.md
  useEffect(() => {
    const effectiveMode = designMode === 'original' && pagesWithBothDesigns.includes(currentView) ? 'original' : 'light';
    updateAnalyticsContext({
      selectedMode: designMode,
      effectiveMode,
    });

    const family = pageFamilyMap[currentView] || 'unknown';
    trackPageView(family);
  }, [currentView, routeDetailId, designMode]);

  // Reset after React commits the destination, including browser back/forward
  // and navigation between two records that share the same page component.
  useLayoutEffect(() => {
    scrollToPageTop();
  }, [currentView, routeDetailId]);

  // Resolve direct links before paint, then keep browser back/forward in sync.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    const handleUrlSync = () => {
      const rawPath = window.location.pathname.replace(/\/+$/, '') || '/';
      const params = new URLSearchParams(window.location.search);
      let pageParam = params.get('page');

      // If no query ?page= was provided, parse clean pathnames:
      let pathEntityId: string | null = null;

      if (!pageParam && rawPath !== '/' && rawPath !== '/index.html') {
        const segments = rawPath.split('/').filter(Boolean);
        const [first, second] = segments;

        if (first === 'departments' || first === 'department' || first === 'dept') {
          if (second) {
            pageParam = 'department';
            pathEntityId = second;
          } else {
            pageParam = 'departments';
          }
        } else if (first === 'doctors' || first === 'doctor' || first === 'doctor-detail') {
          if (second) {
            pageParam = 'doctor-detail';
            pathEntityId = second;
          } else {
            pageParam = 'doctors';
          }
        } else if (first === 'locations' || first === 'location') {
          if (second) {
            pageParam = 'location';
            pathEntityId = second;
          } else {
            pageParam = 'locations';
          }
        } else if (first === 'blog' || first === 'blogs' || first === 'articles') {
          if (second) {
            pageParam = 'blog-post';
            pathEntityId = second;
          } else {
            pageParam = 'blog';
          }
        } else if (first === 'legal' || first === 'policies') {
          if (second) {
            pageParam = 'legal-doc';
            pathEntityId = second;
          } else {
            pageParam = 'legal';
          }
        } else if (first === 'terms' || first === 'tos') {
          pageParam = 'terms';
        } else if (first === 'privacy') {
          pageParam = 'privacy';
        } else if (first === 'telehealth' || first === 'telemedicine') {
          pageParam = 'telehealth';
        } else if (first === 'records') {
          pageParam = 'records';
        } else if (first === 'billing') {
          pageParam = 'billing';
        } else if (first === 'refund') {
          pageParam = 'refund';
        } else if (first === 'faq') {
          pageParam = 'faq';
        } else if (first === 'insurance') {
          pageParam = 'insurance';
        } else if (first === 'pricing' || first === 'insurance-pricing' || first === 'packages') {
          pageParam = 'insurance-pricing';
        } else if (first === 'community' || first === 'community-events' || first === 'media') {
          pageParam = 'community';
        } else if (first === 'facilities' || first === 'technology') {
          pageParam = 'facilities';
        } else if (first === 'founder' || first === 'from-the-founder') {
          pageParam = 'founder';
        } else if (first === 'about' || first === 'about-us') {
          pageParam = 'about';
        } else if (first === 'how-it-works') {
          pageParam = 'how-it-works';
        } else if (first === 'contact' || first === 'contact-us') {
          pageParam = 'contact';
        } else if (first === 'schedule' || first === 'schedule-appointment' || first === 'book') {
          pageParam = 'schedule';
          if (second) pathEntityId = second;
        } else if (first === 'search' || first === 'results' || first === 'search-results') {
          pageParam = 'search-results';
        } else if (first === 'home') {
          pageParam = 'home';
        } else {
          setCurrentView('not-found');
          return;
        }
      }

      if (!pageParam || pageParam === 'home') {
        setCurrentView('home');
      } else if (pageParam === 'faq') {
        setCurrentView('faq');
      } else if (pageParam === 'blog' || pageParam === 'blogs') {
        setCurrentView('blog');
      } else if (pageParam === 'blog-post' || pageParam === 'post') {
        setCurrentView('blog-post');
        setSelectedPostId(params.get('id') || pathEntityId || 'before-your-first-specialist-visit');
      } else if (pageParam === 'legal') {
        const docParam = params.get('doc') || params.get('id') || pathEntityId;
        if (docParam) {
          setCurrentView('legal-doc');
          setSelectedLegalDocId(docParam);
        } else {
          setCurrentView('legal');
        }
      } else if (pageParam === 'legal-doc') {
        setCurrentView('legal-doc');
        setSelectedLegalDocId(params.get('doc') || params.get('id') || pathEntityId || 'terms');
      } else if (pageParam === 'terms' || pageParam === 'tos') {
        setCurrentView('legal-doc');
        setSelectedLegalDocId('terms');
      } else if (pageParam === 'privacy') {
        setCurrentView('legal-doc');
        setSelectedLegalDocId('privacy');
      } else if (pageParam === 'telehealth' || pageParam === 'telemedicine') {
        setCurrentView('legal-doc');
        setSelectedLegalDocId('telehealth');
      } else if (pageParam === 'records') {
        setCurrentView('legal-doc');
        setSelectedLegalDocId('records');
      } else if (pageParam === 'billing') {
        setCurrentView('legal-doc');
        setSelectedLegalDocId('billing');
      } else if (pageParam === 'refund') {
        setCurrentView('legal-doc');
        setSelectedLegalDocId('refund');
      } else if (pageParam === 'departments') {
        setCurrentView('departments');
      } else if (pageParam === 'doctors') {
        setCurrentView('doctors');
      } else if (pageParam === 'locations') {
        setCurrentView('locations');
      } else if (pageParam === 'location') {
        setCurrentView('location');
        setSelectedBranchId(params.get('id') || pathEntityId || 'kr-puram');
      } else if (pageParam === 'insurance') {
        setCurrentView('insurance');
      } else if (pageParam === 'insurance-pricing' || pageParam === 'pricing' || pageParam === 'packages') {
        setCurrentView('insurance-pricing');
      } else if (pageParam === 'community' || pageParam === 'community-events' || pageParam === 'media') {
        setCurrentView('community');
      } else if (pageParam === 'facilities' || pageParam === 'technology') {
        setCurrentView('facilities');
      } else if (pageParam === 'founder' || pageParam === 'from-the-founder') {
        setCurrentView('founder');
      } else if (pageParam === 'about' || pageParam === 'about-us') {
        setCurrentView('about');
      } else if (pageParam === 'how-it-works') {
        setCurrentView('how-it-works');
      } else if (pageParam === 'contact' || pageParam === 'contact-us') {
        setCurrentView('contact-page');
      } else if (pageParam === 'department' || pageParam === 'dept') {
        setCurrentView('department');
        setSelectedDepartmentId(params.get('id') || params.get('dept') || pathEntityId || 'gynecology');
      } else if (pageParam === 'search' || pageParam === 'results' || pageParam === 'search-results') {
        setCurrentView('search-results');
        const careParam = params.get('care');
        const specParam = params.get('specialty') || params.get('dept');
        if (careParam || specParam) {
          setSearchResultsFilter({
            careType: careParam || 'Specialist Consultation',
            specialtyId: specParam || undefined,
          });
        }
      } else if (pageParam === 'schedule' || pageParam === 'schedule-appointment' || pageParam === 'book') {
        setCurrentView('schedule-appointment');
        const requestedName = params.get('doctor_name')?.trim().toLowerCase();
        const nameMatches = requestedName ? DOCTOR_PROFILES.filter(doctor => doctor.name.toLowerCase() === requestedName) : [];
        const rawDoctor = params.get('doctor') || params.get('id') || pathEntityId || (nameMatches.length === 1 ? nameMatches[0].id : undefined);
        const validDoctor = DOCTOR_PROFILES.some(d => d.id === rawDoctor) ? rawDoctor : (DOCTOR_PROFILES[0]?.id || 'doc-1');
        setScheduleDoctorId(validDoctor!);
        const stepParam = params.get('step');
        if (stepParam === '2') {
          setScheduleInitialStep(2);
        } else {
          setScheduleInitialStep(1);
        }
        const dateParam = params.get('date');
        if (dateParam) setSchedulePrefillDate(dateParam);
        const slotParam = params.get('slot');
        if (slotParam) setSchedulePrefillSlot(slotParam);
      } else if (pageParam === 'doctor' || pageParam === 'doctor-detail') {
        setCurrentView('doctor-detail');
        setSelectedDoctorDetailId(params.get('doctor') || params.get('id') || pathEntityId || 'doc-1');
      } else {
        setCurrentView('not-found');
      }

      if (params.get('login') === 'true' || window.location.hash === '#login') {
        openPatientPortal();
      }
    };

    handleUrlSync();
    window.addEventListener('popstate', handleUrlSync);
    return () => {
      window.removeEventListener('popstate', handleUrlSync);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  const navigateToPage = (
    page: Page,
    extraId?: string,
    extraStep?: 1 | 2,
    extraDate?: string,
    extraSlot?: string
  ) => {
    setCurrentView(page);
    if (page === 'blog-post' && extraId) setSelectedPostId(extraId);
    if (page === 'legal-doc' && extraId) setSelectedLegalDocId(extraId);
    if (page === 'department' && extraId) setSelectedDepartmentId(extraId);
    if (page === 'location' && extraId) setSelectedBranchId(extraId);
    if (page === 'doctor-detail') {
      if (extraId) setSelectedDoctorDetailId(extraId);
    }
    if (page === 'schedule-appointment') {
      if (extraId) setScheduleDoctorId(extraId);
      if (extraStep) setScheduleInitialStep(extraStep);
      setSchedulePrefillDate(extraDate);
      setSchedulePrefillSlot(extraSlot);
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.pathname = '/';
      url.hash = '';
      url.searchParams.delete('page');
      url.searchParams.delete('id');
      url.searchParams.delete('doc');
      url.searchParams.delete('doctor');
      url.searchParams.delete('step');
      url.searchParams.delete('date');
      url.searchParams.delete('slot');
      url.searchParams.delete('care');
      url.searchParams.delete('specialty');

      if (page === 'faq') {
        url.searchParams.set('page', 'faq');
      } else if (page === 'blog') {
        url.searchParams.set('page', 'blog');
      } else if (page === 'blog-post') {
        url.searchParams.set('page', 'blog-post');
        url.searchParams.set('id', extraId || selectedPostId);
      } else if (page === 'legal') {
        url.searchParams.set('page', 'legal');
      } else if (page === 'legal-doc') {
        url.searchParams.set('page', 'legal');
        url.searchParams.set('doc', extraId || selectedLegalDocId);
      } else if (page === 'department') {
        url.searchParams.set('page', 'department');
        url.searchParams.set('id', extraId || selectedDepartmentId);
      } else if (page === 'departments' || page === 'doctors' || page === 'locations' || page === 'insurance' || page === 'insurance-pricing' || page === 'about' || page === 'founder' || page === 'community' || page === 'facilities' || page === 'how-it-works') {
        url.searchParams.set('page', page);
      } else if (page === 'location') {
        url.searchParams.set('page', 'location');
        url.searchParams.set('id', extraId || selectedBranchId);
      } else if (page === 'contact-page') {
        url.searchParams.set('page', 'contact');
      } else if (page === 'doctor-detail') {
        url.searchParams.set('page', 'doctor');
        if (extraId) url.searchParams.set('id', extraId);
      } else if (page === 'search-results') {
        url.searchParams.set('page', 'results');
        if (searchResultsFilter.careType) url.searchParams.set('care', searchResultsFilter.careType);
        if (extraId) url.searchParams.set('specialty', extraId);
      } else if (page === 'schedule-appointment') {
        url.searchParams.set('page', 'schedule');
        if (demoBookingEnabled()) url.searchParams.set('booking_preview', 'true');
        if (extraId) url.searchParams.set('doctor', extraId);
        if (extraStep) url.searchParams.set('step', String(extraStep));
        if (extraDate) url.searchParams.set('date', extraDate);
        if (extraSlot) url.searchParams.set('slot', extraSlot);
      }
      window.history.pushState({}, '', url.toString());
      scrollToPageTop();
    }
  };

  // Booking actions use the dedicated appointment screen after a clinician is selected.
  const startBooking = (
    doctorId?: string,
    date?: string,
    slot?: string,
    ctaPlacement: string = 'general_cta'
  ) => {
    const currentFamily = pageFamilyMap[currentView] || 'home';
    trackBookingIntent(currentFamily, ctaPlacement);
    if (!doctorId || !DOCTOR_PROFILES.some(profile => profile.id === doctorId)) {
      navigateToPage('doctors');
      return;
    }
    setScheduleReturnView(currentView);
    navigateToPage('schedule-appointment', doctorId, 1, date, slot);
  };

  const handleNavigate = (section: string) => {
    let destFamily: PageFamily = 'home';
    if (section === 'services' || section === 'departments') destFamily = 'departments';
    else if (section === 'doctors') destFamily = 'doctors';
    else if (section === 'locations') destFamily = 'locations';
    else if (section.startsWith('location-')) destFamily = 'location_detail';
    else if (section.startsWith('department-')) destFamily = 'department_detail';
    else if (section === 'faq') destFamily = 'faq';
    else if (section === 'blog' || section === 'blogs') destFamily = 'blog_list';
    else if (section === 'legal') destFamily = 'legal_hub';
    else if (section === 'insurance' || section === 'insurance-pricing' || section === 'packages' || section === 'how-it-works' || section === 'about' || section === 'founder' || section === 'community' || section === 'facilities' || section === 'contact' || section === 'contact-page') destFamily = 'info';

    trackNavigation('header', destFamily);

    if (section === 'services') {
      navigateToPage('departments');
      return;
    }
    if (section === 'doctors') {
      navigateToPage('doctors');
      return;
    }
    if (section === 'locations') { navigateToPage('locations'); return; }
    if (section.startsWith('location-')) { navigateToPage('location', section.replace('location-', '')); return; }
    if (section === 'insurance') { navigateToPage('insurance'); return; }
    if (section === 'insurance-pricing' || section === 'packages') { navigateToPage('insurance-pricing'); return; }
    if (section === 'community') { navigateToPage('community'); return; }
    if (section === 'facilities') { navigateToPage('facilities'); return; }
    if (section === 'founder') { navigateToPage('founder'); return; }
    if (section === 'about') { navigateToPage('about'); return; }
    if (section === 'how-it-works') { navigateToPage('how-it-works'); return; }
    if (section === 'contact' || section === 'contact-page') { navigateToPage('contact-page'); return; }
    if (section === 'blog' || section === 'faq') {
      navigateToPage(section);
      return;
    }
    if (section.startsWith('department-')) {
      const deptId = section.replace('department-', '');
      setSelectedDepartmentId(deptId);
      setAiRecommendation(null);
      navigateToPage('department', deptId);
      return;
    }
    if (section === 'legal') {
      navigateToPage('legal');
      return;
    }
    if (currentView !== 'home') {
      navigateToPage('home');
      return;
    }
    scrollToSection(section);
  };

  const scrollToSection = (section: string) => {
    if (section === 'home') {
      lockActiveSection('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (section === 'why-choose-us' || section === 'about') {
      lockActiveSection('why-choose-us');
      document.getElementById('why-choose-us')?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'services') {
      lockActiveSection('services');
      document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'doctors') {
      lockActiveSection('doctors');
      document.getElementById('doctors')?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'testimonials' || section === 'patients') {
      lockActiveSection('testimonials');
      document.getElementById('testimonials')?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'packages' || section === 'pricing') {
      lockActiveSection('packages');
      document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'locations') {
      lockActiveSection('locations');
      document.getElementById('locations')?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'insurance') {
      lockActiveSection('insurance');
      document.getElementById('insurance')?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'blogs') {
      lockActiveSection('blogs');
      document.getElementById('blogs')?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'faq') {
      lockActiveSection('faq');
      document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'contact') {
      lockActiveSection('contact');
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      lockActiveSection('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBookService = (departmentId?: string) => {
    if (departmentId) {
      setSelectedDepartmentId(departmentId);
      setAiRecommendation(null);
      navigateToPage('department', departmentId);
    } else {
      startBooking(undefined, undefined, undefined, 'services_bento');
    }
  };

  const handleOpenQuestionnaire = (specialtyId?: string, query?: string, dateTime?: string) => {
    setAiSpecialtyId(specialtyId);
    setAiQuery(query);
    if (dateTime) setSelectedDateTime(dateTime);
    setIsAIAssistantOpen(true);
  };

  // Keyword navigation uses only doctors listed in the selected department.
  const handleAISearch = (queryText: string) => {
    trackSearchUsed('hero', '1-5');
    const lower = queryText.toLowerCase();
    let detectedDept = 'general-medicine';

    if (
      lower.includes('ear') ||
      lower.includes('hearing') ||
      lower.includes('nose') ||
      lower.includes('sinus') ||
      lower.includes('throat') ||
      lower.includes('tonsil') ||
      lower.includes('snoring') ||
      lower.includes('vertigo')
    ) {
      detectedDept = 'ent';
    } else if (
      lower.includes('tooth') ||
      lower.includes('teeth') ||
      lower.includes('dental') ||
      lower.includes('gum') ||
      lower.includes('cavity') ||
      lower.includes('root canal')
    ) {
      detectedDept = 'dental';
    } else if (
      lower.includes('skin') ||
      lower.includes('acne') ||
      lower.includes('rash') ||
      lower.includes('hair') ||
      lower.includes('eczema') ||
      lower.includes('mole') ||
      lower.includes('itching')
    ) {
      detectedDept = 'dermatology';
    } else if (
      lower.includes('chest') ||
      lower.includes('heart') ||
      lower.includes('palpitation') ||
      lower.includes('bp') ||
      lower.includes('cholesterol') ||
      lower.includes('cardio')
    ) {
      detectedDept = 'cardiology';
    } else if (
      lower.includes('knee') ||
      lower.includes('bone') ||
      lower.includes('joint') ||
      lower.includes('back') ||
      lower.includes('spine') ||
      lower.includes('fracture') ||
      lower.includes('ligament') ||
      lower.includes('ortho')
    ) {
      detectedDept = 'orthopedics';
    } else if (
      lower.includes('child') ||
      lower.includes('baby') ||
      lower.includes('pediatric') ||
      lower.includes('vaccine') ||
      lower.includes('infant')
    ) {
      detectedDept = 'pediatrics';
    } else if (
      lower.includes('anxiety') ||
      lower.includes('depression') ||
      lower.includes('sleep') ||
      lower.includes('insomnia') ||
      lower.includes('migraine') ||
      lower.includes('headache') ||
      lower.includes('stress') ||
      lower.includes('neuro')
    ) {
      detectedDept = 'neurology';
    }

    const matchedDoctor = doctors.find(doctor => doctor.departmentId === detectedDept);
    setAiRecommendation(matchedDoctor ? {
      query: queryText,
      matchedDoctor,
      clinicalReasoning: `${matchedDoctor.name} is listed by the hospital under ${matchedDoctor.departmentName}. Contact reception to confirm the right specialist and availability.`,
    } : null);
    setSelectedDepartmentId(detectedDept);
    navigateToPage('department', detectedDept);
  };

  // Non-home views share the site header, footer and modals below; this picks the page body.
  const renderInnerPage = () => {
    const missingDetail = (currentView === 'blog-post' && !BLOG_POSTS.some(post => post.id === selectedPostId))
      || (currentView === 'legal-doc' && !ALL_LEGAL_DOCS[selectedLegalDocId])
      || (currentView === 'department' && !departments.some(department => department.id === selectedDepartmentId))
      || (currentView === 'doctor-detail' && !DOCTOR_PROFILES.some(doctor => doctor.id === selectedDoctorDetailId))
      || (currentView === 'schedule-appointment' && !DOCTOR_PROFILES.some(doctor => doctor.id === scheduleDoctorId))
      || (currentView === 'location' && !branches.some(branch => branch.id === selectedBranchId));
    if (missingDetail || currentView === 'not-found') {
      return <PageNotFound onGoHome={() => navigateToPage('home')} />;
    }
    switch (currentView) {
      // Render dedicated 1:1 Clinic FAQ Page
      case 'faq': {
        return (
          <FamilyFaqPage
            onBackToHome={() => navigateToPage('home')}
          />
        );
      }
      // Render dedicated 1:1 Physician Blog List Page
      case 'blog': {
        return (
          <FamilyBlogListPage
            onSelectPost={(id) => navigateToPage('blog-post', id)}
            onBackToHome={() => navigateToPage('home')}
          />
        );
      }
      // Render dedicated 1:1 Single Physician Article Page
      case 'blog-post': {
        return (
          <FamilyBlogPostPage
            postId={selectedPostId}
            onBackToBlog={() => navigateToPage('blog')}
            onBackToHome={() => navigateToPage('home')}
          />
        );
      }
      // Render dedicated 1:1 Hospital Legal Hub Overview Page (media_1790056080581.png)
      case 'legal': {
        return (
          <LegalHubPage
            onSelectDocument={(docId) => navigateToPage('legal-doc', docId)}
            onBackToHome={() => navigateToPage('home')}
            onNavigateToFaq={() => navigateToPage('faq')}
          />
        );
      }
      // Render dedicated 1:1 Terms of Service & Legal Policy Reader (media_1790056075025.png)
      case 'legal-doc': {
        return (
          <LegalDocumentPage
            documentId={selectedLegalDocId}
            onBackToLegalHub={() => navigateToPage('legal')}
          />
        );
      }
      // Render dedicated Hospital Department Page with AI Clinical Specialist Recommendation
      case 'departments': {
        return <DepartmentsOverviewPage
          onBackToHome={() => navigateToPage('home')}
          onSelectDepartment={(id) => { setAiRecommendation(null); navigateToPage('department', id); }}
          onViewDoctors={() => navigateToPage('doctors')}
        />;
      }
      case 'department': {
        return (
          <DepartmentPage
            departmentId={selectedDepartmentId}
            aiRecommendation={aiRecommendation}
            onBackToHome={() => navigateToPage('home')}
            onBackToDepartments={() => navigateToPage('departments')}
            onViewDoctor={(id) => {
              trackDoctorProfileOpened('department_detail');
              setDoctorReturnView('department');
              navigateToPage('doctor-detail', id);
            }}
            onSelectDepartment={(deptId) => {
              setSelectedDepartmentId(deptId);
              setAiRecommendation(null);
              navigateToPage('department', deptId);
            }}
            onBookDoctor={(doctorId) => startBooking(doctorId, undefined, undefined, 'department_doctor_card')}
            onOpenBooking={(placement) => startBooking(doctors.find(doctor => doctor.departmentId === selectedDepartmentId)?.id, undefined, undefined, placement || 'department_hero')}
          />
        );
      }
      case 'doctors': {
        return <DoctorsDirectoryPage
          onBackToHome={() => navigateToPage('home')}
          onSelectDoctor={(id) => {
            trackDoctorProfileOpened('doctors');
            setDoctorReturnView('doctors');
            navigateToPage('doctor-detail', id);
          }}
          onBookDoctor={(id) => startBooking(id, undefined, undefined, 'doctors_directory_card')}
          onExploreDepartments={() => navigateToPage('departments')}
        />;
      }
      case 'locations':
      case 'location': {
        return <LocationsPage
          selectedBranchId={currentView === 'location' ? selectedBranchId : undefined}
          onBackToHome={() => navigateToPage('home')}
          onBackToLocations={() => navigateToPage('locations')}
          onSelectBranch={(id) => navigateToPage('location', id)}
          onSelectDoctor={(id) => {
            trackDoctorProfileOpened('location_detail');
            setDoctorReturnView('location');
            navigateToPage('doctor-detail', id);
          }}
          onBookDoctor={(id) => startBooking(id, undefined, undefined, 'location_doctor_card')}
          onExploreDepartments={() => navigateToPage('departments')}
          onOpenBooking={() => startBooking(undefined, undefined, undefined, 'location_general_cta')}
        />;
      }
      case 'community':
        return <CommunityMediaPage onBackToHome={() => navigateToPage('home')} onExploreFacilities={() => navigateToPage('facilities')} />;
      case 'facilities':
        return <FacilitiesPage onBackToHome={() => navigateToPage('home')} onExploreCommunity={() => navigateToPage('community')} onSelectDepartment={(id) => navigateToPage('department', id)} />;
      case 'founder':
        return <FounderPage onBackToHome={() => navigateToPage('home')} onExploreHospital={() => navigateToPage('about')} />;
      case 'about':
      case 'insurance-pricing':
      case 'how-it-works':
      case 'contact-page': {
        const props = {
          onBackToHome: () => navigateToPage('home'),
          onExploreFounder: () => navigateToPage('founder'),
          onExploreInsurance: () => navigateToPage('insurance'),
          onExploreDepartments: () => navigateToPage('departments'),
          onExploreDoctors: () => navigateToPage('doctors'),
          onExploreLocations: () => navigateToPage('locations'),
          onSelectLocation: (id: string) => navigateToPage('location', id),
          onOpenBooking: () => startBooking(undefined, undefined, undefined, 'patient_info_cta'),
        };
        if (currentView === 'about') return <AboutUsPage {...props} />;
        if (currentView === 'insurance-pricing') return <InsurancePricingPage {...props} />;
        if (currentView === 'how-it-works') return <HowCareWorksPage {...props} />;
        return <ContactPage {...props} />;
      }
      case 'insurance':
        return <InsuranceAccessPage user={user} onBackToHome={() => navigateToPage('home')} onOpenLogin={openLogin} onViewPricing={() => navigateToPage('insurance-pricing')} />;
      // Render dedicated Doctor Search Results Page
      case 'search-results': {
        const ResultsPage = designMode === 'original' ? OriginalSearchResultsPage : SearchResultsPage;
        return (
          <ResultsPage
            careType={searchResultsFilter.careType}
            specialtyId={searchResultsFilter.specialtyId}
            dateTime={searchResultsFilter.dateTime}
            initialQuery={aiQuery}
            onBackToHome={() => navigateToPage('home')}
            onRetakeQuestionnaire={() => {
              setIsAIAssistantOpen(true);
            }}
            onBookDoctor={(doctorId, _prefillReason, prefillDate, prefillSlot) => startBooking(doctorId, prefillDate, prefillSlot, 'search_results_instant_book')}
            onScheduleDoctor={(doctorId, step, prefillDate, prefillSlot) => {
              trackBookingIntent('search', 'search_results_schedule');
              setScheduleReturnView('search-results');
              navigateToPage('schedule-appointment', doctorId, step, prefillDate, prefillSlot);
            }}
            onSelectDoctorDetail={(doctorId) => {
              trackDoctorProfileOpened('search');
              setSelectedDoctorDetailId(doctorId);
              setDoctorReturnView('search-results');
              navigateToPage('doctor-detail', doctorId);
            }}
            onOpenBooking={() => startBooking(undefined, undefined, undefined, 'search_results_general_cta')}
            onOpenLogin={openLogin}
            user={user}
          />
        );
      }
      // Render dedicated Doctor Profile Page (matching reference screenshots media_1790073472687.png etc)
      case 'doctor-detail': {
        return (
          <DoctorDetailPage
            doctorId={selectedDoctorDetailId}
            onBackToSearch={() => navigateToPage(doctorReturnView, doctorReturnView === 'department' ? selectedDepartmentId : doctorReturnView === 'search-results' ? searchResultsFilter.specialtyId : doctorReturnView === 'location' ? selectedBranchId : undefined)}
            onBackToHome={() => navigateToPage('home')}
            onScheduleAppointment={(docId, step = 1) => {
              trackBookingIntent('doctor_detail', 'doctor_profile_schedule');
              setScheduleReturnView('doctor-detail');
              navigateToPage('schedule-appointment', docId, step);
            }}
          />
        );
      }
      // Render dedicated 1:1 Schedule Appointment Flow (Steps 1, 2, 3 matching reference screenshots)
      case 'schedule-appointment': {
        const matchedProfile = DOCTOR_PROFILES.find((p) => p.id === scheduleDoctorId) || DOCTOR_PROFILES[0];
        if (!demoBookingEnabled() && new URLSearchParams(window.location.search).get('booking_preview') !== 'true') {
          const requestedDoctor = new URLSearchParams(window.location.search).get('doctor') ?? window.location.pathname.split('/')[2];
          return <LiveBookingEntry doctorName={DOCTOR_PROFILES.find(p => p.id === requestedDoctor)?.name} />;
        }
        const AppointmentPage = designMode === 'original' ? OriginalScheduleAppointmentPage : ScheduleAppointmentPage;
        return (
          <AppointmentPage
            doctor={matchedProfile}
            initialStep={scheduleInitialStep}
            initialDate={schedulePrefillDate}
            initialSlot={schedulePrefillSlot}
            onBackToSearch={() => navigateToPage(scheduleReturnView, scheduleReturnView === 'department' ? selectedDepartmentId : scheduleReturnView === 'doctor-detail' ? scheduleDoctorId : scheduleReturnView === 'location' ? selectedBranchId : undefined)}
            onBackToHome={() => navigateToPage('home')}
            onOpenLogin={openLogin}
            onSelectSimilarDoctor={(similarId) => {
              setScheduleDoctorId(similarId);
              setScheduleInitialStep(1);
              navigateToPage('schedule-appointment', similarId, 1);
            }}
            user={user}
          />
        );
      }
      default:
        return null;
    }
  };
  const innerPage = renderInnerPage();
  // Single-design pages use their light green shell in either mode, rather than
  // mixing an original header/footer with a light green screen.
  const pageMode: DesignMode = designMode === 'original' && !pagesWithBothDesigns.includes(currentView) ? 'light' : designMode;
  const WhySection = designMode === 'light' ? LightWhyChooseUsSection : WhyChooseUsSection;
  const DoctorSection = designMode === 'light' ? LightDoctorsGridSection : DoctorsGridSection;
  const LocationSection = designMode === 'light' ? LightBangaloreLocationSection : BangaloreLocationSection;
  const PricingSection = designMode === 'light' ? LightPricingRailSection : PricingRailSection;

  return (
    <div data-design-mode={pageMode} className={`min-h-screen text-[#121212] flex flex-col ${pageMode === 'light' ? 'bg-[#fbfaf6]' : 'bg-[#f6f4ef]'}`}>
      <TiaInspiredHeader
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNavigate={handleNavigate}
        onOpenBooking={() => startBooking(currentView === 'doctor-detail' ? selectedDoctorDetailId : currentView === 'schedule-appointment' ? scheduleDoctorId : undefined, undefined, undefined, 'header_nav')}
        onOpenLogin={openLogin}
        user={user}
      />

      {innerPage ? (
        <main className="flex-1 pt-[var(--site-header-offset)]">
          <PageErrorBoundary key={`${currentView}:${routeDetailId}`} onGoHome={() => navigateToPage('home')}>
            <Suspense fallback={<PageLoading />}>{innerPage}</Suspense>
          </PageErrorBoundary>
        </main>
      ) : (
      <>
      {/* Hero Section: Centered AI/Classic Search (Default) or Sri Lakshmi Image Hero */}
      <main className="flex-1">
        {designMode === 'light' ? (
          <LightCareSearchHero onOpenQuestionnaire={handleOpenQuestionnaire} onAISearch={handleAISearch} backdrop={heroBackdrop} />
        ) : (
          <CareSearchHero
            onOpenQuestionnaire={handleOpenQuestionnaire}
            onAISearch={handleAISearch}
            backdrop={heroBackdrop}
            placement={heroPlacement}
          />
        )}

        {/* Monotone Indian Accreditations & Medical Badges below Hero */}
        {designMode === 'original' && <AccreditationsSection />}

        {/* Why Choose Us Section (Dual Care Cards + Big Bold Numbers) */}
        <WhySection
          onBookInPerson={() => startBooking(undefined, undefined, undefined, 'why_choose_us_in_person')}
        />

        {/* Services in the selected design mode */}
        {designMode === 'light' ? (
          <LightServicesBentoSection onBookAppointment={handleBookService} onViewAll={() => navigateToPage('departments')} />
        ) : (
          <ServicesBentoSection onBookAppointment={handleBookService} />
        )}

        {/* 2. Top Specialists Doctor Showcase (media_1789993820491.png) */}
        <DoctorSection
          onBookDoctor={(doctorId) => startBooking(doctorId, undefined, undefined, 'home_doctor_card')}
          onViewDoctor={(id) => {
            trackDoctorProfileOpened('home');
            setDoctorReturnView('home');
            navigateToPage('doctor-detail', id);
          }}
          onViewAll={() => navigateToPage('doctors')}
        />

        {/* 3. Bangalore Minimal Line Map Location Strip ("Find an Sri Lakshmi clinic near you") */}
        <LocationSection
          onBookVirtual={() => navigateToPage('contact-page')}
          onOpenBooking={() => navigateToPage('locations')}
        />

        {/* 4. Testimonials Section ("Patients of Sri Lakshmi") */}
        {designMode === 'original' && <TestimonialsSection
          viewMode={activeTestimonialOption}
          onConsultDoctor={() => startBooking(undefined, undefined, undefined, 'home_testimonials')}
        />}

        {/* 5. Cashless Insurance Partners with GSAP 3D Rotating Logo Wave */}
        {designMode === 'light' ? <LightInsurancePartnersSection onOpenVerification={() => handleNavigate('insurance')} /> : <InsurancePartnersSection onOpenVerification={() => handleNavigate('insurance')} />}

        {/* 6. Strategic Placement: Personalized Health Packages & Pricing Rail (Directly below Insurance Coverage) */}
        <PricingSection
          variant={pricingRailVariant}
          onVariantChange={setPricingRailVariant}
          onBookPackage={() => startBooking(undefined, undefined, undefined, 'home_pricing_package')}
          onExploreAll={() => navigateToPage('insurance-pricing')}
        />

        <HospitalGallerySection onExploreHospital={() => navigateToPage('community')} />

        {/* 7. Doctor Drafts Section ("The latest from our Physicians") */}
        {designMode === 'light' ? <LightBlogReportsSection onOpenBlog={() => navigateToPage('blog')} /> : <BlogReportsSection onOpenBlog={() => navigateToPage('blog')} />}

        {/* 6. Frequently Asked Questions Section (4 Questions) */}
        {designMode === 'original' && <FAQSection onOpenFullFaq={() => navigateToPage('faq')} />}

        {/* 7. Doctor Candid Marketing Showcase (GSAP Style with Coming Soon Video) */}
        {designMode === 'original' && <DoctorShowcaseSection onBookAppointment={() => startBooking(undefined, undefined, undefined, 'home_doctor_showcase')} />}
      </main>
      </>
      )}

      {/* Footer */}
      <LightFooter
        onOpenBooking={() => startBooking(undefined, undefined, undefined, 'footer_nav')}
        onOpenLegal={(docId) => docId ? navigateToPage('legal-doc', docId) : navigateToPage('legal')}
      />

      {/* Questionnaire Modal matching media_1790064883413.png 1:1 */}
      <AICareAssistantModal
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        initialSpecialtyId={aiSpecialtyId}
        initialQuery={aiQuery}
        dateTime={selectedDateTime}
        onNavigateToResults={({ careType, specialtyId, dateTime }) => {
          trackSearchUsed('care_search', '6-20');
          setIsAIAssistantOpen(false);
          setSearchResultsFilter({
            careType,
            specialtyId,
            dateTime: dateTime || selectedDateTime,
          });
          navigateToPage('search-results', specialtyId);
        }}
      />

      {/* WhatsApp Bot & Emergency Calls Floating Widget */}
      <WhatsAppFloatingWidget onOpenBooking={() => startBooking(undefined, undefined, undefined, 'whatsapp_widget')} />
      <VoiceAgentLauncher user={user} />

      {/* Discreet Display Settings Floating Button */}
      {(
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        title="Website Display Settings"
        aria-label="Website Display Settings"
        className="hidden sm:flex fixed bottom-6 left-6 z-40 size-11 rounded-full bg-[#f6f4ef]/90 hover:bg-white text-[#555] hover:text-[#121212] shadow-md hover:shadow-lg border border-[#ded7cb] items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xs"
      >
        <Settings className="size-4.5" />
      </button>
      )}

      {/* Display Settings Modal (Toggle Option 1 vs Option 2 away from main UI) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        mode={designMode}
        onChangeMode={setDesignMode}
        heroBackdrop={heroBackdrop}
        onChangeHeroBackdrop={setHeroBackdrop}
        heroPlacement={heroPlacement}
        onChangeHeroPlacement={setHeroPlacement}
      />

      {/* PostHog Privacy & Analytics Consent Banner */}
      <AnalyticsConsentBanner />
    </div>
  );
}

export default App;
