import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { StickyEmergencyHeader } from './components/common/StickyEmergencyHeader';
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
import { AvocadoHero } from './components/home/AvocadoHero';
import { AccreditationsSection } from './components/sections/AccreditationsSection';
import { WhyChooseUsSection } from './components/sections/WhyChooseUsSection';
import { ServicesBentoSection } from './components/sections/ServicesBentoSection';
import { ServicesGridVariant } from './components/sections/ServicesGridVariant';
import { PricingRailSection, PricingRailVariant } from './components/sections/PricingRailSection';
import { DoctorsGridSection } from './components/sections/DoctorsGridSection';
import { BangaloreLocationSection } from './components/sections/BangaloreLocationSection';
import { TestimonialsSection } from './components/sections/TestimonialsSection';
import { InsurancePartnersSection } from './components/sections/InsurancePartnersSection';
import { BlogReportsSection } from './components/sections/BlogReportsSection';
import { FAQSection } from './components/sections/FAQSection';
import { DoctorShowcaseSection } from './components/sections/DoctorShowcaseSection';
import { Footer } from './components/common/Footer';
import { WhatsAppFloatingWidget } from './components/contact/WhatsAppFloatingWidget';
import { SettingsModal, type ComponentVariants, type ComponentVariantKey } from './components/common/SettingsModal';
import { AaveLoginFlow } from './components/auth/AaveLoginFlow';
import { FamilyFaqPage } from './components/faq/FamilyFaqPage';
import { FamilyBlogListPage } from './components/blog/FamilyBlogListPage';
import { FamilyBlogPostPage } from './components/blog/FamilyBlogPostPage';
import { LegalHubPage } from './components/legal/LegalHubPage';
import { LegalDocumentPage } from './components/legal/LegalDocumentPage';
import { DepartmentPage } from './components/departments/DepartmentPage';
import { DepartmentsOverviewPage } from './components/departments/DepartmentsOverviewPage';
import { DoctorsDirectoryPage } from './components/doctor/DoctorsDirectoryPage';
import { LocationsPage } from './components/locations/LocationsPage';
import { ContactPage, HowCareWorksPage, InsurancePricingPage } from './components/info/PatientInfoPages';
import { InsuranceAccessPage } from './components/info/InsuranceAccessPage';
import { CareSearchHero } from './components/home/CareSearchHero';
import { AICareAssistantModal } from './components/ai/AICareAssistantModal';
import { doctors } from './data/doctors';
import { Doctor } from './types';
import { SearchResultsPage, DOCTOR_PROFILES } from './components/search/SearchResultsPage';
import { OriginalSearchResultsPage } from './components/search/OriginalSearchResultsPage';
import { ScheduleAppointmentPage } from './components/booking/ScheduleAppointmentPage';
import { OriginalScheduleAppointmentPage } from './components/booking/OriginalScheduleAppointmentPage';
import { DoctorDetailPage } from './components/doctor/DoctorDetailPage';
import { OriginalDoctorDetailPage } from './components/doctor/OriginalDoctorDetailPage';
import { VoiceAgentLauncher } from './components/voice/VoiceAgentLauncher';
import { authApi } from './lib/auth';

import { lockActiveSection } from './components/common/navigation';

type Page = 'home' | 'faq' | 'blog' | 'blog-post' | 'legal' | 'legal-doc' | 'departments' | 'department' | 'doctors' | 'search-results' | 'schedule-appointment' | 'doctor-detail' | 'locations' | 'location' | 'insurance' | 'insurance-pricing' | 'how-it-works' | 'contact-page';
const defaultComponentVariants: ComponentVariants = {
  header: 'original', hero: 'original', why: 'original', services: 'original',
  doctors: 'original', locations: 'original', insurance: 'original',
  pricing: 'original', articles: 'original', footer: 'original',
  'doctor-profile': 'light',
  'search-results': 'light', appointment: 'light',
};

export function App() {
  const [currentView, setCurrentView] = useState<Page>('home');
  const [selectedDoctorDetailId, setSelectedDoctorDetailId] = useState<string>('doc-1');
  const [doctorReturnView, setDoctorReturnView] = useState<'doctors' | 'department' | 'search-results' | 'location'>('doctors');
  const [scheduleDoctorId, setScheduleDoctorId] = useState<string>('doc-1');
  const [scheduleInitialStep, setScheduleInitialStep] = useState<1 | 2>(1);
  const [schedulePrefillDate, setSchedulePrefillDate] = useState<string | undefined>('2026-10-30');
  const [schedulePrefillSlot, setSchedulePrefillSlot] = useState<string | undefined>('12:45 PM');
  const [scheduleReturnView, setScheduleReturnView] = useState<Page>('search-results');
  const [searchResultsFilter, setSearchResultsFilter] = useState<{ careType: string; specialtyId?: string; dateTime?: string }>({
    careType: 'Annual physical / checkup',
    specialtyId: 'general-medicine',
    dateTime: 'Anytime',
  });
  const [selectedDateTime, setSelectedDateTime] = useState<string>('Anytime');
  const [selectedPostId, setSelectedPostId] = useState<string>('fragmented-healthcare-problem');
  const [selectedLegalDocId, setSelectedLegalDocId] = useState<string>('terms');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('ent');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('indiranagar');
  const [aiRecommendation, setAiRecommendation] = useState<{
    query: string;
    matchedDoctor: Doctor;
    clinicalReasoning: string;
  } | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; identifier: string } | null>(null);
  useEffect(() => {
    authApi.me().then((actor) => {
      if (actor.role === 'patient') setUser({ name: actor.display_name, identifier: actor.user_id });
    }).catch(() => undefined);
  }, []);
  const [activeTestimonialOption, setActiveTestimonialOption] = useState<'option1' | 'option2'>('option2');
  const [activeServicesOption, setActiveServicesOption] = useState<'option1' | 'option2'>('option1');
  const [heroBookingPosition, setHeroBookingPosition] = useState<'top' | 'bottom'>('top');
  const [pricingRailVariant, setPricingRailVariant] = useState<PricingRailVariant>('tall');
  const [heroVariant, setHeroVariant] = useState<'centered-search' | 'classic-image'>('centered-search');
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [aiSpecialtyId, setAiSpecialtyId] = useState<string | undefined>();
  const [aiQuery, setAiQuery] = useState<string | undefined>();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [componentVariants, setComponentVariants] = useState<ComponentVariants>(() => {
    try {
      const current = localStorage.getItem('avocado_component_options_v3');
      const saved = JSON.parse(current || localStorage.getItem('avocado_component_options_v2') || '{}');
      return Object.fromEntries(Object.entries(defaultComponentVariants).map(([key, fallback]) => [key, saved[key] === 'light' || saved[key] === 'original' ? saved[key] : fallback])) as ComponentVariants;
    } catch {
      return { ...defaultComponentVariants };
    }
  });
  useEffect(() => {
    try { localStorage.setItem('avocado_component_options_v3', JSON.stringify(componentVariants)); } catch { /* Storage is optional for this UI preview. */ }
  }, [componentVariants]);
  const changeComponentVariant = (key: ComponentVariantKey, value: 'original' | 'light') => {
    setComponentVariants(current => ({ ...current, [key]: value }));
  };

  // Sync URL parameters on initial load and browser back/forward
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUrlSync = () => {
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get('page');
      if (pageParam === 'faq') {
        setCurrentView('faq');
      } else if (pageParam === 'blog' || pageParam === 'blogs') {
        setCurrentView('blog');
      } else if (pageParam === 'blog-post' || pageParam === 'post') {
        setCurrentView('blog-post');
        const idParam = params.get('id');
        if (idParam) setSelectedPostId(idParam);
      } else if (pageParam === 'legal') {
        const docParam = params.get('doc');
        if (docParam) {
          setCurrentView('legal-doc');
          setSelectedLegalDocId(docParam);
        } else {
          setCurrentView('legal');
        }
      } else if (pageParam === 'terms' || pageParam === 'tos') {
        setCurrentView('legal-doc');
        setSelectedLegalDocId('terms');
      } else if (pageParam === 'privacy') {
        setCurrentView('legal-doc');
        setSelectedLegalDocId('privacy');
      } else if (pageParam === 'telehealth' || pageParam === 'telemedicine') {
        setCurrentView('legal-doc');
        setSelectedLegalDocId('telehealth');
      } else if (pageParam === 'departments') {
        setCurrentView('departments');
      } else if (pageParam === 'doctors') {
        setCurrentView('doctors');
      } else if (pageParam === 'locations') {
        setCurrentView('locations');
      } else if (pageParam === 'location') {
        setCurrentView('location');
        setSelectedBranchId(params.get('id') || 'indiranagar');
      } else if (pageParam === 'insurance') {
        setCurrentView('insurance');
        setIsLoginOpen(true);
      } else if (pageParam === 'insurance-pricing') {
        setCurrentView('insurance-pricing');
      } else if (pageParam === 'how-it-works') {
        setCurrentView('how-it-works');
      } else if (pageParam === 'contact') {
        setCurrentView('contact-page');
      } else if (pageParam === 'department' || pageParam === 'dept') {
        setCurrentView('department');
        const idParam = params.get('id') || params.get('dept');
        if (idParam) setSelectedDepartmentId(idParam);
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
      } else if (pageParam === 'schedule' || pageParam === 'schedule-appointment') {
        setCurrentView('schedule-appointment');
        const docParam = params.get('doctor') || params.get('id');
        if (docParam) setScheduleDoctorId(docParam);
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
        const docParam = params.get('doctor') || params.get('id');
        if (docParam) setSelectedDoctorDetailId(docParam);
      } else {
        setCurrentView('home');
      }

      if (params.get('login') === 'true' || window.location.hash === '#login') {
        setIsLoginOpen(true);
      }
    };

    handleUrlSync();
    window.addEventListener('popstate', handleUrlSync);
    return () => window.removeEventListener('popstate', handleUrlSync);
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
      } else if (page === 'departments' || page === 'doctors' || page === 'locations' || page === 'insurance' || page === 'insurance-pricing' || page === 'how-it-works') {
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
        if (extraId) url.searchParams.set('doctor', extraId);
        if (extraStep) url.searchParams.set('step', String(extraStep));
        if (extraDate) url.searchParams.set('date', extraDate);
        if (extraSlot) url.searchParams.set('slot', extraSlot);
      }
      window.history.pushState({}, '', url.toString());
      window.scrollTo(0, 0); // instant: a smooth scroll here would cancel handleNavigate's section scroll
    }
  };

  // Booking actions use the dedicated appointment screen after a clinician is selected.
  const startBooking = (doctorId?: string, date?: string, slot?: string) => {
    if (!doctorId || !DOCTOR_PROFILES.some(profile => profile.id === doctorId)) {
      navigateToPage('doctors');
      return;
    }
    setScheduleReturnView(currentView);
    navigateToPage('schedule-appointment', doctorId, 1, date, slot);
  };

  const handleNavigate = (section: string) => {
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
    if (section === 'insurance') { navigateToPage('insurance'); setIsLoginOpen(true); return; }
    if (section === 'insurance-pricing' || section === 'packages') { navigateToPage('insurance-pricing'); return; }
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
      // the closure above still sees the old view, so scroll directly once home has rendered
      setTimeout(() => scrollToSection(section), 50);
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
      startBooking();
    }
  };

  const handleHeroBookingSearch = (details: {
    specialty: string;
    location: string;
    date: string;
    patientType: string;
  }) => {
    const specialtyId = ({ general: 'general-medicine', pediatric: 'pediatrics', dentist: 'dental', ent: 'ent', cardiology: 'cardiology' } as Record<string, string>)[details.specialty];
    setSearchResultsFilter({ careType: 'Specialist Consultation', specialtyId, dateTime: details.date });
    navigateToPage('search-results', specialtyId);
  };

  const handleOpenQuestionnaire = (specialtyId?: string, query?: string, dateTime?: string) => {
    setAiSpecialtyId(specialtyId);
    setAiQuery(query);
    if (dateTime) setSelectedDateTime(dateTime);
    setIsAIAssistantOpen(true);
  };

  // Distinct AI Search Flow: Directly takes patient to the Department page with recommended specialist (No questionnaire!)
  const handleAISearch = (queryText: string) => {
    const lower = queryText.toLowerCase();
    let detectedDept = 'general-medicine';
    let docId = 'doc-2';
    let reasoning =
      'Based on your symptoms, our clinical triage recommends consulting with a Primary Care physician.';

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
      docId = 'doc-9';
      reasoning =
        'Your symptoms indicate an Ear, Nose, or Throat concern. We recommend consulting Senior Consultant Dr. Priya Nair for diagnostic endoscopy and targeted therapy.';
    } else if (
      lower.includes('tooth') ||
      lower.includes('teeth') ||
      lower.includes('dental') ||
      lower.includes('gum') ||
      lower.includes('cavity') ||
      lower.includes('root canal')
    ) {
      detectedDept = 'dental';
      docId = 'doc-10';
      reasoning =
        'Dental and oral symptoms should be evaluated promptly to avoid nerve inflammation. Dr. Rajesh Kulkarni is available for painless consultation.';
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
      docId = 'doc-6';
      reasoning =
        'Your symptoms relate to clinical dermatology. We recommend an evaluation by Dr. Arjun Nair for targeted skin and allergy care.';
    } else if (
      lower.includes('chest') ||
      lower.includes('heart') ||
      lower.includes('palpitation') ||
      lower.includes('bp') ||
      lower.includes('cholesterol') ||
      lower.includes('cardio')
    ) {
      detectedDept = 'cardiology';
      docId = 'doc-1';
      reasoning =
        'Cardiovascular signs should be reviewed carefully. We recommend a priority evaluation with Senior Consultant Dr. Vikram Rao.';
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
      docId = 'doc-3';
      reasoning =
        'Orthopedic discomfort is best assessed with mobility testing and imaging. Dr. Siddharth Mukherjee is recommended.';
    } else if (
      lower.includes('child') ||
      lower.includes('baby') ||
      lower.includes('pediatric') ||
      lower.includes('vaccine') ||
      lower.includes('infant')
    ) {
      detectedDept = 'pediatrics';
      docId = 'doc-8';
      reasoning =
        'For pediatric symptoms, Dr. Rohan Desai provides comprehensive adolescent and child healthcare.';
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
      docId = 'doc-7';
      reasoning =
        'We recommend a compassionate assessment with Dr. Kavya Reddy covering neurological and psychiatric wellbeing.';
    }

    const matchedDoctor = doctors.find((d) => d.id === docId) || doctors[0];
    setAiRecommendation({
      query: queryText,
      matchedDoctor,
      clinicalReasoning: reasoning,
    });
    setSelectedDepartmentId(detectedDept);
    navigateToPage('department', detectedDept);
  };

  // Non-home views share the site header, footer and modals below; this picks the page body.
  const renderInnerPage = () => {
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
            onViewDoctor={(id) => { setDoctorReturnView('department'); navigateToPage('doctor-detail', id); }}
            onSelectDepartment={(deptId) => {
              setSelectedDepartmentId(deptId);
              setAiRecommendation(null);
              navigateToPage('department', deptId);
            }}
            onBookDoctor={(doctorId) => startBooking(doctorId)}
            onOpenBooking={() => startBooking(doctors.find(doctor => doctor.departmentId === selectedDepartmentId)?.id)}
          />
        );
      }
      case 'doctors': {
        return <DoctorsDirectoryPage
          onBackToHome={() => navigateToPage('home')}
          onSelectDoctor={(id) => { setDoctorReturnView('doctors'); navigateToPage('doctor-detail', id); }}
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
          onSelectDoctor={(id) => { setDoctorReturnView('location'); navigateToPage('doctor-detail', id); }}
          onExploreDepartments={() => navigateToPage('departments')}
          onOpenBooking={() => startBooking()}
        />;
      }
      case 'insurance-pricing':
      case 'how-it-works':
      case 'contact-page': {
        const props = {
          onBackToHome: () => navigateToPage('home'),
          onExploreDepartments: () => navigateToPage('departments'),
          onExploreDoctors: () => navigateToPage('doctors'),
          onExploreLocations: () => navigateToPage('locations'),
          onSelectLocation: (id: string) => navigateToPage('location', id),
          onOpenBooking: () => startBooking(),
        };
        if (currentView === 'insurance-pricing') return <InsurancePricingPage {...props} />;
        if (currentView === 'how-it-works') return <HowCareWorksPage {...props} />;
        return <ContactPage {...props} />;
      }
      case 'insurance':
        return <InsuranceAccessPage user={user} onBackToHome={() => navigateToPage('home')} onOpenLogin={() => setIsLoginOpen(true)} onViewPricing={() => navigateToPage('insurance-pricing')} />;
      // Render dedicated Doctor Search Results Page
      case 'search-results': {
        const ResultsPage = componentVariants['search-results'] === 'original' ? OriginalSearchResultsPage : SearchResultsPage;
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
            onBookDoctor={(doctorId, _prefillReason, prefillDate, prefillSlot) => startBooking(doctorId, prefillDate, prefillSlot)}
            onScheduleDoctor={(doctorId, step, prefillDate, prefillSlot) => {
              setScheduleReturnView('search-results');
              navigateToPage('schedule-appointment', doctorId, step, prefillDate, prefillSlot);
            }}
            onSelectDoctorDetail={(doctorId) => {
              setSelectedDoctorDetailId(doctorId);
              setDoctorReturnView('search-results');
              navigateToPage('doctor-detail', doctorId);
            }}
            onOpenBooking={() => startBooking()}
            onOpenLogin={() => setIsLoginOpen(true)}
            user={user}
          />
        );
      }
      // Render dedicated Doctor Profile Page (matching reference screenshots media_1790073472687.png etc)
      case 'doctor-detail': {
        const ProfilePage = componentVariants['doctor-profile'] === 'original' ? OriginalDoctorDetailPage : DoctorDetailPage;
        return (
          <ProfilePage
            doctorId={selectedDoctorDetailId}
            onBackToSearch={() => navigateToPage(doctorReturnView, doctorReturnView === 'department' ? selectedDepartmentId : doctorReturnView === 'search-results' ? searchResultsFilter.specialtyId : doctorReturnView === 'location' ? selectedBranchId : undefined)}
            onBackToHome={() => navigateToPage('home')}
            onScheduleAppointment={(docId, step = 1) => {
              setScheduleReturnView('doctor-detail');
              navigateToPage('schedule-appointment', docId, step);
            }}
            onOpenLogin={() => setIsLoginOpen(true)}
            user={user}
          />
        );
      }
      // Render dedicated 1:1 Schedule Appointment Flow (Steps 1, 2, 3 matching reference screenshots)
      case 'schedule-appointment': {
        const matchedProfile = DOCTOR_PROFILES.find((p) => p.id === scheduleDoctorId) || DOCTOR_PROFILES[0];
        const AppointmentPage = componentVariants.appointment === 'original' ? OriginalScheduleAppointmentPage : ScheduleAppointmentPage;
        return (
          <AppointmentPage
            doctor={matchedProfile}
            initialStep={scheduleInitialStep}
            initialDate={schedulePrefillDate}
            initialSlot={schedulePrefillSlot}
            onBackToSearch={() => navigateToPage(scheduleReturnView, scheduleReturnView === 'department' ? selectedDepartmentId : scheduleReturnView === 'doctor-detail' ? scheduleDoctorId : scheduleReturnView === 'location' ? selectedBranchId : undefined)}
            onBackToHome={() => navigateToPage('home')}
            onOpenLogin={() => setIsLoginOpen(true)}
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
  const embeddedHeader =
    (currentView === 'doctor-detail' && componentVariants['doctor-profile'] === 'original') ||
    (currentView === 'search-results' && componentVariants['search-results'] === 'original') ||
    (currentView === 'schedule-appointment' && componentVariants.appointment === 'original');
  const embeddedFooter =
    (currentView === 'doctor-detail' && componentVariants['doctor-profile'] === 'original') ||
    (currentView === 'search-results' && componentVariants['search-results'] === 'original');
  const WhySection = componentVariants.why === 'light' ? LightWhyChooseUsSection : WhyChooseUsSection;
  const DoctorSection = componentVariants.doctors === 'light' ? LightDoctorsGridSection : DoctorsGridSection;
  const LocationSection = componentVariants.locations === 'light' ? LightBangaloreLocationSection : BangaloreLocationSection;
  const PricingSection = componentVariants.pricing === 'light' ? LightPricingRailSection : PricingRailSection;

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-[#121212] flex flex-col">
      <div
        role="status"
        className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-xs font-semibold tracking-wide text-emerald-800 shadow-lg shadow-emerald-900/10"
      >
        CI/CD test · deployed from my local machine
      </div>
      {/* Sticky Top Header with Emergency Pill (Always On during scroll) */}
      {!embeddedHeader && (componentVariants.header === 'light' ? <TiaInspiredHeader
        onNavigate={handleNavigate}
        onOpenBooking={() => startBooking()}
        onOpenLogin={() => { window.location.href = '/portal'; }}
        user={user}
      /> : <StickyEmergencyHeader
        onNavigate={handleNavigate}
        onOpenBooking={() => startBooking()}
        onOpenLogin={() => { window.location.href = '/portal'; }}
        user={user}
        showAnnouncement={!innerPage}
        forceScrolledStyle={!!innerPage}
      />)}

      {innerPage ? (
        <main className={`flex-1 ${embeddedHeader ? '' : componentVariants.header === 'light' ? 'pt-[96px] lg:pt-[108px]' : 'pt-[72px]'}`}>{innerPage}</main>
      ) : (
      <>
      {/* Hero Section: Centered AI/Classic Search (Default) or Avocado Image Hero */}
      <main className="flex-1">
        {componentVariants.hero === 'light' ? (
          <LightCareSearchHero onOpenQuestionnaire={handleOpenQuestionnaire} onAISearch={handleAISearch} />
        ) : heroVariant === 'centered-search' ? (
          <CareSearchHero
            onOpenQuestionnaire={handleOpenQuestionnaire}
            onAISearch={handleAISearch}
          />
        ) : (
          <AvocadoHero
            onGetStarted={() => startBooking()}
            onOpenBooking={() => startBooking()}
            onOpenLogin={() => setIsLoginOpen(true)}
            user={user}
            onNavigate={handleNavigate}
            bookingBarPosition={heroBookingPosition}
            onSearchBooking={handleHeroBookingSearch}
          />
        )}

        {/* Monotone Indian Accreditations & Medical Badges below Hero */}
        <AccreditationsSection />

        {/* Why Choose Us Section (Dual Care Cards + Big Bold Numbers) */}
        <WhySection
          onBookInPerson={() => startBooking()}
          onBookVirtual={() => startBooking()}
        />

        {/* 1. Services Section (Toggleable between Option 1 Bento & Option 2 Diverse Departments) */}
        {componentVariants.services === 'light' ? (
          <LightServicesBentoSection onBookAppointment={handleBookService} onViewAll={() => navigateToPage('departments')} />
        ) : activeServicesOption === 'option1' ? (
          <ServicesBentoSection onBookAppointment={handleBookService} />
        ) : (
          <ServicesGridVariant onBookAppointment={handleBookService} />
        )}

        {/* 2. Top Specialists Doctor Showcase (media_1789993820491.png) */}
        <DoctorSection
          onBookDoctor={(doctorId) => startBooking(doctorId)}
          onViewAll={() => navigateToPage('doctors')}
        />

        {/* 3. Bangalore Minimal Line Map Location Strip ("Find an Avocado clinic near you") */}
        <LocationSection
          onBookVirtual={() => startBooking()}
          onOpenBooking={() => startBooking()}
        />

        {/* 4. Testimonials Section ("Patients of Avocado") */}
        <TestimonialsSection
          viewMode={activeTestimonialOption}
          onConsultDoctor={() => startBooking()}
        />

        {/* 5. Cashless Insurance Partners with GSAP 3D Rotating Logo Wave */}
        {componentVariants.insurance === 'light' ? <LightInsurancePartnersSection onOpenVerification={() => handleNavigate('insurance')} /> : <InsurancePartnersSection onOpenVerification={() => handleNavigate('insurance')} />}

        {/* 6. Strategic Placement: Personalized Health Packages & Pricing Rail (Directly below Insurance Coverage) */}
        <PricingSection
          variant={pricingRailVariant}
          onVariantChange={setPricingRailVariant}
          onBookPackage={() => startBooking()}
          onExploreAll={() => startBooking()}
        />

        {/* 7. Doctor Drafts Section ("The latest from our Physicians") */}
        {componentVariants.articles === 'light' ? <LightBlogReportsSection onOpenBlog={() => navigateToPage('blog')} /> : <BlogReportsSection onOpenBlog={() => navigateToPage('blog')} />}

        {/* 6. Frequently Asked Questions Section (4 Questions) */}
        <FAQSection onOpenFullFaq={() => navigateToPage('faq')} />

        {/* 7. Doctor Candid Marketing Showcase (GSAP Style with Coming Soon Video) */}
        <DoctorShowcaseSection onBookAppointment={() => startBooking()} />
      </main>
      </>
      )}

      {/* Footer */}
      {!embeddedFooter && (componentVariants.footer === 'light' ? <LightFooter
        onOpenBooking={() => startBooking()}
        onOpenLegal={(docId) => docId ? navigateToPage('legal-doc', docId) : navigateToPage('legal')}
      /> : <Footer
        onOpenBooking={() => startBooking()}
        onOpenLegal={(docId) => docId ? navigateToPage('legal-doc', docId) : navigateToPage('legal')}
      />)}

      {/* Questionnaire Modal matching media_1790064883413.png 1:1 */}
      <AICareAssistantModal
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        initialSpecialtyId={aiSpecialtyId}
        initialQuery={aiQuery}
        dateTime={selectedDateTime}
        onNavigateToResults={({ careType, specialtyId, dateTime }) => {
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
      <WhatsAppFloatingWidget onOpenBooking={() => startBooking()} />
      <VoiceAgentLauncher user={user} />

      {/* Discreet Display Settings Floating Button */}
      {(
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        title="Website Display Settings"
        aria-label="Website Display Settings"
        className="fixed bottom-6 left-6 z-40 size-10 sm:size-11 rounded-full bg-[#f6f4ef]/90 hover:bg-white text-[#555] hover:text-[#121212] shadow-md hover:shadow-lg border border-[#ded7cb] flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xs"
      >
        <Settings className="size-4.5" />
      </button>
      )}

      {/* Display Settings Modal (Toggle Option 1 vs Option 2 away from main UI) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeTestimonialOption={activeTestimonialOption}
        onChangeTestimonialOption={setActiveTestimonialOption}
        activeServicesOption={activeServicesOption}
        onChangeServicesOption={setActiveServicesOption}
        activeHeroBookingPosition={heroBookingPosition}
        onChangeHeroBookingPosition={setHeroBookingPosition}
        activePricingVariant={pricingRailVariant}
        onChangePricingVariant={setPricingRailVariant}
        activeHeroType={heroVariant}
        onChangeHeroType={setHeroVariant}
        componentVariants={componentVariants}
        onChangeComponentVariant={changeComponentVariant}
      />

      {/* Patient portal login & onboarding flow */}
      <AaveLoginFlow
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        brandTitle={currentView === 'insurance' ? 'Avocado Insurance' : undefined}
        welcomeDescription={currentView === 'insurance' ? 'Log in to continue to the insurance area.' : undefined}
        welcomeNote={currentView === 'insurance' ? 'Online eligibility is not connected in this preview.' : undefined}
        onLoginSuccess={(userData) => {
          setUser(userData);
        }}
      />
    </div>
  );
}

export default App;
