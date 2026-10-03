import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Menu,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  Sparkles,
  MapPin,
  Calendar,
  FileText,
  Check,
  CheckCircle2,
  Printer,
  ArrowRight,
  CalendarCheck,
  AlertCircle,
  Info,
  Smartphone,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  startOfWeek,
  isSameMonth,
  addMonths,
  subMonths,
  addDays,
} from 'date-fns';

export interface DoctorScheduleProfile {
  id: string;
  name: string;
  credentials?: string;
  specialty: string;
  photo: string;
  rating: number;
  reviewCount: number;
  boardCertified: string;
  pedigree?: string;
  bedsideManner?: string;
  decisionChips?: string[];
  nicheExpertise?: string;
  hospitalAffiliation?: string;
  practiceName: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  offersVideo?: boolean;
  nextVisitText?: string;
  availableSlots?: Record<string, string[]>;
  bio?: string;
  education?: string[];
  clinicalInterests?: string[];
  facilityPhotos?: Array<{ url: string; title: string }>;
}

interface OriginalScheduleAppointmentPageProps {
  doctor: DoctorScheduleProfile;
  initialStep?: 1 | 2;
  initialDate?: string;
  initialSlot?: string;
  initialVisitType?: 'Office Visit' | 'Video Visit';
  onBackToSearch: () => void;
  onBackToHome: () => void;
  onOpenLogin: () => void;
  onSelectSimilarDoctor?: (doctorId: string) => void;
  user: { name: string; identifier: string } | null;
}

export const OriginalScheduleAppointmentPage: React.FC<OriginalScheduleAppointmentPageProps> = ({
  doctor,
  initialStep = 1,
  initialDate,
  initialSlot,
  initialVisitType = 'Office Visit',
  onBackToSearch,
  onBackToHome,
  onOpenLogin,
  user,
}) => {
  // Stepper state (1: Appointment Details, 2: Patient Information, 3: Confirmation)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(initialStep);

  // Step 1: Appointment Details State
  const [isNewPatient, setIsNewPatient] = useState<'new' | 'existing'>('new');
  const [visitType, setVisitType] = useState<'Office Visit' | 'Video Visit'>(initialVisitType);
  const [selectedLocation, setSelectedLocation] = useState(doctor.practiceName || 'Avocado Health');

  // Calendar month state (starts in October 2026 matching screenshots)
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date(2026, 9, 1)); // Oct 2026
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || '2026-10-30');
  const [selectedSlot, setSelectedSlot] = useState<string>(initialSlot || '12:45 PM');

  // Step 2: Patient Information State (styled using login modal components)
  const [appointmentFor, setAppointmentFor] = useState<'Myself' | 'Someone else'>('Myself');
  const [fullName, setFullName] = useState(user?.name || 'Alex Mercer');
  const [dob, setDob] = useState('1994-06-15');
  const [gender, setGender] = useState('Female');
  const [showMoreGender, setShowMoreGender] = useState(false);
  const [phone, setPhone] = useState(user?.identifier || '8217286695');
  const [email, setEmail] = useState(''); // Optional!
  const [reason, setReason] = useState('New consultation for sensitive skin condition');
  const [showSignInAccordion, setShowSignInAccordion] = useState(false);

  // OTP Verification State (adapted from AaveLoginFlow)
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [activeOtpIndex, setActiveOtpIndex] = useState(0);
  const [resendCountdown, setResendCountdown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Validation & Error state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 3: Confirmation state
  const [confirmationCode] = useState('BM-8649-5748');

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Available slots for doctor (with variable >3 slots per day)
  const doctorSlots = useMemo(() => {
    if (doctor.availableSlots && Object.keys(doctor.availableSlots).length > 0) {
      return doctor.availableSlots;
    }
    // High-availability default schedule with >3 slots per day
    return {
      '2026-10-30': ['12:45 PM', '1:15 PM', '1:45 PM', '2:15 PM'],
      '2026-10-31': ['9:30 AM', '10:00 AM', '10:30 AM', '11:15 AM'],
      '2026-11-01': [],
      '2026-11-02': ['9:00 AM', '10:00 AM', '2:00 PM', '2:30 PM'],
      '2026-11-03': ['11:30 AM', '1:00 PM', '2:30 PM', '3:15 PM'],
      '2026-11-04': ['9:15 AM', '10:45 AM', '1:30 PM', '2:15 PM'],
    };
  }, [doctor]);

  // Current day slots list
  const currentDaySlots = useMemo(() => {
    return doctorSlots[selectedDate] || ['12:45 PM', '1:15 PM', '1:45 PM', '2:15 PM'];
  }, [doctorSlots, selectedDate]);

  // Format selected date display
  const formattedSelectedDate = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return format(d, 'EEEE, MMMM d, yyyy');
    } catch {
      return 'Monday, November 2, 2026';
    }
  }, [selectedDate]);

  // 42-day uniform grid for the calendar month view (Zero warping!)
  const calendarDays = useMemo(() => {
    const mStart = startOfMonth(calendarMonth);
    const cStart = startOfWeek(mStart, { weekStartsOn: 0 }); // Sunday start
    return Array.from({ length: 42 }, (_, i) => {
      const day = addDays(cStart, i);
      const dStr = format(day, 'yyyy-MM-dd');
      return {
        dateObj: day,
        dayNum: format(day, 'd'),
        dateStr: dStr,
        isCurrentMonth: isSameMonth(day, calendarMonth),
        hasSlots: Boolean(doctorSlots[dStr] && doctorSlots[dStr].length > 0),
        isSelected: dStr === selectedDate,
      };
    });
  }, [calendarMonth, doctorSlots, selectedDate]);

  // Handle advancing to Step 2 when slot is picked in Step 1
  const handleSelectSlotInStep1 = (slot: string) => {
    setSelectedSlot(slot);
    setCurrentStep(2);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // OTP Handlers (adapted from AaveLoginFlow)
  const handleSendOtp = () => {
    if (!phone.trim()) {
      setErrors((prev) => ({ ...prev, phone: 'Mobile phone number is required to send OTP' }));
      return;
    }
    setOtpSent(true);
    setResendCountdown(30);
    setErrors((prev) => ({ ...prev, phone: '', otp: '' }));
    setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 100);
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleanVal = value.replace(/[^0-9]/g, '');
    const char = cleanVal.slice(-1);

    const nextDigits = [...otpDigits];
    nextDigits[index] = char;
    setOtpDigits(nextDigits);

    if (char && index < 5) {
      setActiveOtpIndex(index + 1);
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all 6 digits entered
    if (char && index === 5 && nextDigits.every((d) => d !== '')) {
      setOtpVerified(true);
      setErrors((prev) => ({ ...prev, otp: '' }));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const nextDigits = [...otpDigits];
        nextDigits[index - 1] = '';
        setOtpDigits(nextDigits);
        setActiveOtpIndex(index - 1);
        otpInputRefs.current[index - 1]?.focus();
      } else {
        const nextDigits = [...otpDigits];
        nextDigits[index] = '';
        setOtpDigits(nextDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      setActiveOtpIndex(index - 1);
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      setActiveOtpIndex(index + 1);
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pastedData) return;

    const nextDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      nextDigits[i] = pastedData[i] || '';
    }
    setOtpDigits(nextDigits);

    const nextFocusIndex = Math.min(pastedData.length, 5);
    setActiveOtpIndex(nextFocusIndex);
    otpInputRefs.current[nextFocusIndex]?.focus();

    if (pastedData.length === 6) {
      setOtpVerified(true);
      setErrors((prev) => ({ ...prev, otp: '' }));
    }
  };

  const handleAutoFillDemoOtp = () => {
    setOtpDigits(['8', '8', '4', '9', '2', '2']);
    setOtpVerified(true);
    setErrors((prev) => ({ ...prev, otp: '' }));
  };

  const handleVerifyOtp = () => {
    if (otpDigits.every((d) => d !== '')) {
      setOtpVerified(true);
      setErrors((prev) => ({ ...prev, otp: '' }));
    } else {
      setErrors((prev) => ({ ...prev, otp: 'Please enter all 6 digits of the verification code' }));
    }
  };

  // Handle submitting Step 2 -> Step 3 (With strict validation & exact error reasons)
  const handleProceedToConfirmation = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    // 1. Legal full name (a single field; naming conventions vary)
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      newErrors.fullName = 'Full name is required';
    } else if (trimmedName.length < 2) {
      newErrors.fullName = 'Please enter the patient’s full name';
    }

    // 2. Date of birth
    if (!dob.trim()) {
      newErrors.dob = 'A valid date is required';
    }

    // 3. Sex
    if (!gender) {
      newErrors.gender = 'This field is required';
    }

    // 4. Mobile phone number
    if (!phone.trim()) {
      newErrors.phone = 'Mobile phone number is required';
    } else if (!otpVerified) {
      newErrors.otp = 'Please verify your phone number with the OTP code before continuing';
      if (!otpSent) {
        setOtpSent(true);
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Stop and scroll smoothly to the first error
      const firstKey = Object.keys(newErrors)[0];
      const el = document.getElementById(`field-${firstKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // All requirements satisfied -> advance to Step 3
    setErrors({});
    setCurrentStep(3);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col font-sans">
      {/* ── TOP UTILITY & BREADCRUMB NAVIGATION (1:1 with media_1790071475424.png) ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600 overflow-x-auto no-scrollbar py-1">
            <button
              type="button"
              onClick={onBackToHome}
              className="hover:text-neutral-950 font-medium inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Menu className="size-4" />
              <span>Menu</span>
            </button>
            <span className="text-neutral-300">|</span>
            <button
              type="button"
              onClick={onBackToHome}
              className="hover:text-neutral-950 font-medium shrink-0 cursor-pointer"
            >
              Home
            </button>
            <ChevronRight className="size-3.5 text-neutral-400 shrink-0" />
            <button
              type="button"
              onClick={onBackToSearch}
              className="hover:text-neutral-950 font-medium shrink-0 cursor-pointer"
            >
              Find a Doctor
            </button>
            <ChevronRight className="size-3.5 text-neutral-400 shrink-0" />
            <span className="text-neutral-700 font-medium truncate max-w-[140px] sm:max-w-none">
              {doctor.name}
            </span>
            <ChevronRight className="size-3.5 text-neutral-400 shrink-0" />
            <span className="text-neutral-950 font-bold shrink-0">Schedule an Appointment</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToSearch}
              className="text-neutral-700 hover:text-neutral-950 p-1.5 rounded-full hover:bg-neutral-100 transition cursor-pointer"
              title="Search Doctors"
            >
              <Search className="size-4.5" />
            </button>
            <button
              type="button"
              onClick={onBackToSearch}
              className="text-xs font-bold text-[#3d117a] border border-[#3d117a]/30 px-3 py-1.5 rounded-full hover:bg-[#3d117a]/5 transition cursor-pointer inline-flex items-center gap-1"
            >
              <Sparkles className="size-3.5 text-[#3d117a]" />
              <span>Ask AI</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* ══════════════════════════════════════════════════════════════
              3-STEP PROGRESS STEPPER (Matching media_1790071475424.png & media_1790071408155.png)
              ══════════════════════════════════════════════════════════════ */}
          <div className="flex items-center max-w-2xl text-xs sm:text-sm font-semibold select-none">
            {/* Step 1 Item */}
            <div
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div
                className={`size-6 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                  currentStep === 1
                    ? 'bg-[#3d117a] text-white shadow-xs'
                    : 'bg-[#008080] text-white' // Teal check circle when completed
                }`}
              >
                {currentStep > 1 ? <Check className="size-3.5 stroke-[3]" /> : '1'}
              </div>
              <span
                className={`transition-colors ${
                  currentStep === 1 ? 'text-neutral-950 font-bold' : 'text-neutral-700 group-hover:text-neutral-950'
                }`}
              >
                Appointment Details
              </span>
            </div>

            {/* Stepper Connector 1-2 */}
            <div className="flex-1 mx-3 sm:mx-5 h-0.5 bg-neutral-200" />

            {/* Step 2 Item */}
            <div
              onClick={() => {
                if (currentStep > 1) setCurrentStep(2);
              }}
              className={`flex items-center gap-2.5 ${currentStep >= 2 ? 'cursor-pointer group' : 'opacity-60'}`}
            >
              <div
                className={`size-6 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                  currentStep === 2
                    ? 'bg-[#3d117a] text-white shadow-xs'
                    : currentStep > 2
                    ? 'bg-[#008080] text-white'
                    : 'bg-white border-2 border-neutral-300 text-neutral-500'
                }`}
              >
                {currentStep > 2 ? <Check className="size-3.5 stroke-[3]" /> : '2'}
              </div>
              <span
                className={`transition-colors ${
                  currentStep === 2 ? 'text-neutral-950 font-bold' : 'text-neutral-600'
                }`}
              >
                Patient Information
              </span>
            </div>

            {/* Stepper Connector 2-3 */}
            <div className="flex-1 mx-3 sm:mx-5 h-0.5 bg-neutral-200" />

            {/* Step 3 Item */}
            <div className={`flex items-center gap-2.5 ${currentStep === 3 ? 'text-neutral-950 font-bold' : 'opacity-60 text-neutral-500'}`}>
              <div
                className={`size-6 rounded-full flex items-center justify-center font-bold text-xs ${
                  currentStep === 3 ? 'bg-[#3d117a] text-white shadow-xs' : 'bg-white border-2 border-neutral-300 text-neutral-500'
                }`}
              >
                3
              </div>
              <span>Confirmation</span>
            </div>
          </div>

          {/* Page Title */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1c0840] tracking-tight">
            Schedule an Appointment
          </h1>

          {/* ══════════════════════════════════════════════════════════════
              STEP 1: APPOINTMENT DETAILS (1:1 with media_1790071475424.png)
              ══════════════════════════════════════════════════════════════ */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_390px] gap-8 xl:gap-12 items-start animate-fadeIn">
              {/* Left Column: Questionnaire & Location Card */}
              <div className="space-y-8">
                {/* Section 1: Are you new to this doctor? */}
                <div className="space-y-3">
                  <h3 className="font-bold text-base text-neutral-900">
                    Are you new to this doctor?
                  </h3>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 pt-1">
                    <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-neutral-800">
                      <input
                        type="radio"
                        name="isNewPatient"
                        checked={isNewPatient === 'new'}
                        onChange={() => setIsNewPatient('new')}
                        className="size-4.5 text-[#3d117a] focus:ring-[#3d117a] cursor-pointer accent-[#3d117a]"
                      />
                      <span>I&apos;m new to this doctor.</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-neutral-800">
                      <input
                        type="radio"
                        name="isNewPatient"
                        checked={isNewPatient === 'existing'}
                        onChange={() => setIsNewPatient('existing')}
                        className="size-4.5 text-[#3d117a] focus:ring-[#3d117a] cursor-pointer accent-[#3d117a]"
                      />
                      <span>I&apos;ve seen this doctor in the past three years.</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-neutral-200" />

                {/* Section 2: Type of Appointment */}
                <div className="space-y-3">
                  <h3 className="font-bold text-base text-neutral-900">
                    Type of Appointment
                  </h3>
                  <div className="flex items-center gap-8 pt-1">
                    <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-neutral-800">
                      <input
                        type="radio"
                        name="visitType"
                        checked={visitType === 'Office Visit'}
                        onChange={() => setVisitType('Office Visit')}
                        className="size-4.5 text-[#3d117a] focus:ring-[#3d117a] cursor-pointer accent-[#3d117a]"
                      />
                      <span>Office Visit</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-neutral-800">
                      <input
                        type="radio"
                        name="visitType"
                        checked={visitType === 'Video Visit'}
                        onChange={() => setVisitType('Video Visit')}
                        className="size-4.5 text-[#3d117a] focus:ring-[#3d117a] cursor-pointer accent-[#3d117a]"
                      />
                      <span>Video Visit</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-neutral-200" />

                {/* Section 3: Location for Your Visit (No weird green bar!) */}
                <div className="space-y-3">
                  <h3 className="font-bold text-base text-neutral-900">
                    Location for Your Visit
                  </h3>

                  {/* Clean Location Card with standard purple highlight */}
                  <div
                    onClick={() => setSelectedLocation(doctor.practiceName || 'Avocado Health')}
                    className="relative bg-white rounded-xl border-2 border-neutral-200 hover:border-[#3d117a]/50 shadow-xs overflow-hidden p-5 sm:p-6 space-y-4 cursor-pointer transition-all"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="size-5 rounded-full border-2 border-[#3d117a] flex items-center justify-center shrink-0 mt-0.5">
                        <div className="size-2.5 rounded-full bg-[#3d117a]" />
                      </div>
                      <div className="space-y-1 text-sm">
                        <h4 className="font-bold text-base text-neutral-900 leading-snug">
                          {selectedLocation}
                        </h4>
                        <div className="text-neutral-600 text-xs sm:text-sm">
                          {doctor.addressLine1 || 'Clinic details to be confirmed'}, {doctor.addressLine2 || 'Bengaluru'}
                        </div>
                        <div className="text-xs sm:text-sm text-neutral-800 font-semibold pt-0.5">
                          📞 {doctor.phone || '080 4968 2800'}
                        </div>
                      </div>
                    </div>

                    {/* Stylized Interactive Mini Map Graphic */}
                    <div className="relative w-full sm:w-[340px] h-40 rounded-lg overflow-hidden border border-neutral-200 bg-[#e5e3df] shadow-2xs">
                      {/* Stylized Google Map Canvas Simulation with Murray Hill Pin */}
                      <svg viewBox="0 0 400 200" className="w-full h-full object-cover">
                        <rect width="400" height="200" fill="#e8ece9" />
                        {/* Street grid */}
                        <path d="M0,40 L400,40 M0,90 L400,90 M0,140 L400,140 M0,180 L400,180" stroke="#ffffff" strokeWidth="6" />
                        <path d="M60,0 L60,200 M130,0 L130,200 M200,0 L200,200 M280,0 L280,200 M350,0 L350,200" stroke="#ffffff" strokeWidth="6" />
                        {/* Diagonal Avenue */}
                        <path d="M0,170 L260,0" stroke="#fbd986" strokeWidth="8" />
                        {/* Parks */}
                        <rect x="210" y="50" width="60" height="35" rx="3" fill="#cbe6a3" />
                        {/* Location Pin */}
                        <g transform="translate(195, 75)">
                          <circle cx="10" cy="10" r="14" fill="#ef4444" opacity="0.25" />
                          <path
                            d="M10,0 C4.48,0 0,4.48 0,10 C0,17.5 10,28 10,28 C10,28 20,17.5 20,10 C20,4.48 15.52,0 10,0 Z"
                            fill="#dc2626"
                          />
                          <circle cx="10" cy="10" r="4" fill="#ffffff" />
                        </g>
                        {/* Neighborhood Label */}
                        <rect x="155" y="115" width="90" height="18" rx="2" fill="#ffffff" opacity="0.9" />
                        <text x="200" y="128" fontSize="10" fontWeight="bold" fill="#374151" textAnchor="middle">
                          MURRAY HILL
                        </text>
                      </svg>

                      {/* Map Attribution Watermark */}
                      <div className="absolute bottom-1 left-2 text-[9px] text-neutral-500 bg-white/70 px-1 rounded">
                        Google Map Preview
                      </div>
                    </div>

                    {/* Next Available Pill */}
                    <div className="pt-1">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 text-xs font-bold">
                        <CalendarCheck className="size-4 text-sky-600" />
                        <span>Next Available: Friday, October 30</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Doctor Portrait + Month Calendar + Slots (1:1 with media_1790071475424.png) */}
              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 space-y-6">
                {/* Doctor Portrait & Summary */}
                <div className="flex items-center gap-3.5 pb-2">
                  <div className="size-16 rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 shrink-0">
                    <img
                      src={doctor.photo}
                      alt={doctor.name}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-base text-neutral-900 leading-snug">
                      {doctor.name}
                    </h4>
                    <div className="text-xs text-neutral-600 font-medium">
                      {doctor.specialty}
                    </div>
                    <div className="text-xs text-neutral-500 flex items-center gap-1 pt-1">
                      <MapPin className="size-3 text-neutral-400 shrink-0" />
                      <span className="truncate">{doctor.practiceName}</span>
                    </div>
                  </div>
                </div>

                {/* ── UNIFORM, NON-WARPED CALENDAR MONTH VIEW (1:1 with media_1790072791346.png) ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
                      className="text-xs font-semibold text-neutral-700 hover:text-[#3d117a] inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <ChevronLeft className="size-4" />
                      <span>{format(subMonths(calendarMonth, 1), 'MMM')}</span>
                    </button>

                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-neutral-300 text-xs font-bold text-neutral-900 cursor-pointer hover:bg-neutral-50">
                      <span>{format(calendarMonth, 'MMMM yyyy')}</span>
                      <ChevronDown className="size-3.5 text-neutral-500" />
                    </div>

                    <button
                      type="button"
                      onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                      className="text-xs font-semibold text-neutral-700 hover:text-[#3d117a] inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{format(addMonths(calendarMonth, 1), 'MMM')}</span>
                      <ChevronRight className="size-4" />
                    </button>
                  </div>

                  {/* Day of Week Headers */}
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-neutral-500 pt-1">
                    <div>Sun</div>
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                    <div>Sat</div>
                  </div>

                  {/* 42-day uniform grid (Zero warping, pixel-perfect alignment) */}
                  <div className="grid grid-cols-7 gap-y-1.5 gap-x-1 text-center pt-1">
                    {calendarDays.map((cell) => (
                      <div key={cell.dateStr} className="h-9 flex items-center justify-center">
                        {!cell.isCurrentMonth ? (
                          <span className="text-[13px] text-neutral-400 select-none">
                            {cell.dayNum}
                          </span>
                        ) : cell.isSelected ? (
                          <button
                            type="button"
                            onClick={() => setSelectedDate(cell.dateStr)}
                            className="size-8 rounded-full bg-[#3d117a] text-white font-bold text-[13px] flex items-center justify-center shadow-xs cursor-pointer ring-2 ring-[#3d117a]/20"
                          >
                            {cell.dayNum}
                          </button>
                        ) : cell.hasSlots ? (
                          <button
                            type="button"
                            onClick={() => setSelectedDate(cell.dateStr)}
                            className="size-8 rounded-full text-neutral-900 font-bold text-[13px] hover:bg-purple-100 flex items-center justify-center transition cursor-pointer"
                          >
                            {cell.dayNum}
                          </button>
                        ) : (
                          <span className="text-[13px] text-neutral-600 select-none">
                            {cell.dayNum}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-neutral-200" />

                {/* Available Slots for Selected Date (>3 Slots as requested!) */}
                <div className="space-y-3">
                  <div className="font-bold text-sm text-neutral-900">
                    {formattedSelectedDate}
                  </div>
                  <div className="text-xs font-semibold text-neutral-600">
                    Afternoon Slots:
                  </div>

                  {/* Slot buttons grid (More than 3 slots supported!) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {currentDaySlots.map((slot) => {
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => handleSelectSlotInStep1(slot)}
                          className={`py-2 px-2 rounded-md font-bold text-xs transition cursor-pointer text-center ${
                            isSelected
                              ? 'bg-[#2a0c58] text-white ring-2 ring-[#4efcd3]'
                              : 'bg-[#3d117a] hover:bg-[#2d0960] active:scale-95 text-white'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-neutral-200" />

                {/* Similar Providers with Online Scheduling */}
                <div className="space-y-2 pt-1">
                  <h4 className="font-bold text-xs text-neutral-900">
                    Similar Providers with Online Scheduling
                  </h4>
                  <p className="text-[11px] text-neutral-600 leading-relaxed">
                    Browse providers similar to {doctor.name.split(',')[0]} that have online appointments available.
                  </p>
                  <button
                    type="button"
                    onClick={onBackToSearch}
                    className="w-full bg-[#3d117a] hover:bg-[#2d0960] active:scale-95 text-white font-bold text-xs py-2 px-4 rounded-md transition cursor-pointer"
                  >
                    View Similar Providers
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 2: PATIENT INFORMATION (Matching media_1790072235537.png)
              ══════════════════════════════════════════════════════════════ */}
          {currentStep === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_390px] gap-8 xl:gap-12 items-start animate-fadeIn">
              {/* Left Column: Patient Form (Exact match to media_1790072235537.png) */}
              <div className="space-y-6">
                {/* Sign-in prompt accordion card */}
                <div className="bg-white rounded-xl border border-neutral-200 shadow-2xs p-5">
                  <div
                    onClick={() => setShowSignInAccordion(!showSignInAccordion)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="space-y-1">
                      <h3 className="font-bold text-base text-[#1c0840]">
                        Sign Into Brave Mendel Health Account
                      </h3>
                      <p className="text-xs text-neutral-600 leading-relaxed">
                        You can save time by signing into your account, and we&apos;ll automatically fill out your personal information.
                      </p>
                    </div>
                    <div className="size-8 rounded-full bg-neutral-100 flex items-center justify-center shrink-0 ml-3">
                      <ChevronDown
                        className={`size-4 text-neutral-600 transition-transform ${
                          showSignInAccordion ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {showSignInAccordion && (
                    <div className="mt-4 pt-4 border-t border-neutral-200 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={onOpenLogin}
                        className="px-5 py-2.5 rounded-[12px] bg-[#3d117a] text-white text-xs font-bold hover:bg-[#2d0960] transition cursor-pointer"
                      >
                        Sign In Now
                      </button>
                      <span className="text-xs text-neutral-500">Instant OTP verification via mobile</span>
                    </div>
                  )}
                </div>

                {/* Divider: Or Continue without MyChart */}
                <div className="relative flex items-center justify-center my-6">
                  <div className="w-full border-t border-neutral-200" />
                  <span className="absolute bg-white px-4 text-xs font-bold text-neutral-800">
                    Or Continue as Guest
                  </span>
                </div>

                {/* Section Header: Tell us a bit about you (1:1 with media_1790072235537.png) */}
                <div className="space-y-1">
                  <h2 className="text-2xl font-extrabold text-neutral-950">
                    Tell us a bit about you
                  </h2>
                  <p className="text-sm text-neutral-600">
                    To book your appointment, we need to verify a few things for {doctor.name}&apos;s office
                  </p>
                </div>

                {/* Section: Who is this Appointment For? */}
                <div className="space-y-2 pt-1">
                  <h3 className="font-bold text-sm text-neutral-900">
                    Who is this Appointment For?
                  </h3>
                  <div className="flex items-center gap-6 pt-0.5">
                    <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-neutral-800">
                      <input
                        type="radio"
                        name="appointmentFor"
                        checked={appointmentFor === 'Myself'}
                        onChange={() => setAppointmentFor('Myself')}
                        className="size-4.5 text-[#3d117a] focus:ring-[#3d117a] cursor-pointer accent-[#3d117a]"
                      />
                      <span>Myself</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-neutral-800">
                      <input
                        type="radio"
                        name="appointmentFor"
                        checked={appointmentFor === 'Someone else'}
                        onChange={() => setAppointmentFor('Someone else')}
                        className="size-4.5 text-[#3d117a] focus:ring-[#3d117a] cursor-pointer accent-[#3d117a]"
                      />
                      <span>Someone else</span>
                    </label>
                  </div>
                </div>

                {/* Patient Information Form (Single Name field, Optional Email, Inline OTP) */}
                <form onSubmit={handleProceedToConfirmation} className="space-y-5 pt-1" noValidate>
                  {/* 1. Legal Full Name */}
                  <div id="field-fullName" className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-800">
                      <span>Legal full name</span>
                      <Info className="size-3.5 text-neutral-400" />
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                      }}
                      placeholder="Full name"
                      className={`w-full h-[52px] px-4 rounded-[14px] text-[15px] font-normal transition-all outline-none text-[#111827] placeholder-[#9CA3AF] ${
                        errors.fullName
                          ? 'bg-red-50/25 border-2 border-red-500 focus:border-red-600'
                          : 'bg-[#F4F4F6] border-2 border-transparent focus:bg-[#FCFCFE] focus:border-[#3d117a] focus:shadow-[0_0_0_3px_rgba(61,17,122,0.12)]'
                      }`}
                    />
                    {errors.fullName && (
                      <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium pt-0.5">
                        <AlertCircle className="size-3.5 text-red-600 shrink-0" />
                        <span>{errors.fullName}</span>
                      </div>
                    )}
                  </div>

                  {/* 2. Date of Birth & Sex */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Date of Birth */}
                    <div id="field-dob" className="space-y-1.5">
                      <label className="block text-[13px] font-semibold text-neutral-800">
                        Date of birth <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => {
                          setDob(e.target.value);
                          if (errors.dob) setErrors((prev) => ({ ...prev, dob: '' }));
                        }}
                        className={`w-full h-[52px] px-4 rounded-[14px] text-[15px] font-normal transition-all outline-none text-[#111827] placeholder-[#9CA3AF] cursor-pointer ${
                          errors.dob
                            ? 'bg-red-50/25 border-2 border-red-500 focus:border-red-600'
                            : 'bg-[#F4F4F6] border-2 border-transparent focus:bg-[#FCFCFE] focus:border-[#3d117a] focus:shadow-[0_0_0_3px_rgba(61,17,122,0.12)]'
                        }`}
                      />
                      {errors.dob && (
                        <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium pt-0.5">
                          <AlertCircle className="size-3.5 text-red-600 shrink-0" />
                          <span>{errors.dob}</span>
                        </div>
                      )}
                    </div>

                    {/* Sex */}
                    <div id="field-gender" className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-800">
                        <span>Sex</span>
                        <Info className="size-3.5 text-neutral-400" />
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-6 h-[52px] px-4 rounded-[14px] bg-[#F4F4F6]">
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-neutral-800">
                          <input
                            type="radio"
                            name="gender"
                            checked={gender === 'Male'}
                            onChange={() => {
                              setGender('Male');
                              if (errors.gender) setErrors((prev) => ({ ...prev, gender: '' }));
                            }}
                            className="size-4.5 text-[#3d117a] focus:ring-[#3d117a] cursor-pointer accent-[#3d117a]"
                          />
                          <span>Male</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-neutral-800">
                          <input
                            type="radio"
                            name="gender"
                            checked={gender === 'Female'}
                            onChange={() => {
                              setGender('Female');
                              if (errors.gender) setErrors((prev) => ({ ...prev, gender: '' }));
                            }}
                            className="size-4.5 text-[#3d117a] focus:ring-[#3d117a] cursor-pointer accent-[#3d117a]"
                          />
                          <span>Female</span>
                        </label>
                      </div>
                      {errors.gender && (
                        <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium pt-0.5">
                          <AlertCircle className="size-3.5 text-red-600 shrink-0" />
                          <span>{errors.gender}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Optional Sex & Gender link */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowMoreGender(!showMoreGender)}
                      className="text-xs font-semibold text-[#3d117a] hover:underline cursor-pointer"
                    >
                      Add more sex &amp; gender info (optional)
                    </button>
                    {showMoreGender && (
                      <div className="mt-2.5 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-2">
                        <label className="block font-semibold text-neutral-700">Gender Identity</label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg bg-white border border-neutral-300 text-xs"
                        >
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                          <option value="Non-binary">Non-binary</option>
                          <option value="Transgender">Transgender</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* 3. Mobile Phone Number & Inline OTP Verification */}
                  <div id="field-phone" className="space-y-2">
                    <label className="block text-[13px] font-semibold text-neutral-800">
                      Mobile Phone Number <span className="text-red-500">*</span>
                    </label>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                          if (otpVerified) setOtpVerified(false);
                        }}
                        placeholder="Mobile Number (e.g. 8217286695)"
                        className={`flex-1 h-[52px] px-4 rounded-[14px] text-[15px] font-normal transition-all outline-none text-[#111827] placeholder-[#9CA3AF] ${
                          errors.phone || (errors.otp && !otpVerified)
                            ? 'bg-red-50/25 border-2 border-red-500 focus:border-red-600'
                            : 'bg-[#F4F4F6] border-2 border-transparent focus:bg-[#FCFCFE] focus:border-[#3d117a] focus:shadow-[0_0_0_3px_rgba(61,17,122,0.12)]'
                        }`}
                      />

                      {!otpVerified && (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="h-[52px] px-5 bg-[#3d117a] hover:bg-[#2d0960] active:scale-95 text-white text-xs font-bold rounded-[14px] transition cursor-pointer shrink-0 shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <Smartphone className="size-4" />
                          <span>{otpSent ? (resendCountdown > 0 ? `Resend (${resendCountdown}s)` : 'Resend Code') : 'Send OTP'}</span>
                        </button>
                      )}
                    </div>

                    {errors.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium pt-0.5">
                        <AlertCircle className="size-3.5 text-red-600 shrink-0" />
                        <span>{errors.phone}</span>
                      </div>
                    )}

                    {/* Verified Status Banner */}
                    {otpVerified && (
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-[14px] text-xs font-semibold">
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                        <span>Phone number verified via SMS code (+1 {phone})</span>
                      </div>
                    )}

                    {/* Inline OTP Code Verification Panel (from AaveLoginFlow) */}
                    {otpSent && !otpVerified && (
                      <div className="bg-[#f7f5fc] border border-[#ddd6fe] rounded-2xl p-4 sm:p-5 space-y-3.5 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-[#1c0840] flex items-center gap-1.5">
                              <Smartphone className="size-4 text-[#3d117a]" />
                              <span>Enter 6-Digit SMS Verification Code</span>
                            </h4>
                            <p className="text-xs text-neutral-600 mt-0.5">
                              We texted a code to <strong className="text-neutral-900">{phone || 'your mobile'}</strong>
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={handleAutoFillDemoOtp}
                            className="text-[11px] font-bold text-[#3d117a] bg-white border border-[#ddd6fe] hover:bg-purple-50 px-2.5 py-1 rounded-lg transition cursor-pointer shadow-2xs"
                            title="Click to instantly auto-fill verified code for testing"
                          >
                            Quick Auto-fill (884922)
                          </button>
                        </div>

                        {/* 6 Digit Input Group: [0][0][0] - [0][0][0] */}
                        <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                          {[0, 1, 2].map((idx) => (
                            <input
                              key={idx}
                              ref={(el) => {
                                otpInputRefs.current[idx] = el;
                              }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={otpDigits[idx]}
                              placeholder="•"
                              onFocus={() => setActiveOtpIndex(idx)}
                              onChange={(e) => handleOtpChange(idx, e.target.value)}
                              onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                              onPaste={handleOtpPaste}
                              className={`w-10 h-12 sm:w-11 sm:h-13 text-center text-lg sm:text-xl font-bold rounded-[12px] outline-none transition-all placeholder-neutral-300 ${
                                activeOtpIndex === idx
                                  ? 'border-2 border-[#3d117a] bg-white text-neutral-950 shadow-[0_0_0_3px_rgba(61,17,122,0.12)]'
                                  : 'border-2 border-transparent bg-white text-neutral-900 shadow-2xs'
                              }`}
                            />
                          ))}

                          <span className="text-neutral-400 font-bold px-0.5 select-none">-</span>

                          {[3, 4, 5].map((idx) => (
                            <input
                              key={idx}
                              ref={(el) => {
                                otpInputRefs.current[idx] = el;
                              }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={otpDigits[idx]}
                              placeholder="•"
                              onFocus={() => setActiveOtpIndex(idx)}
                              onChange={(e) => handleOtpChange(idx, e.target.value)}
                              onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                              onPaste={handleOtpPaste}
                              className={`w-10 h-12 sm:w-11 sm:h-13 text-center text-lg sm:text-xl font-bold rounded-[12px] outline-none transition-all placeholder-neutral-300 ${
                                activeOtpIndex === idx
                                  ? 'border-2 border-[#3d117a] bg-white text-neutral-950 shadow-[0_0_0_3px_rgba(61,17,122,0.12)]'
                                  : 'border-2 border-transparent bg-white text-neutral-900 shadow-2xs'
                              }`}
                            />
                          ))}
                        </div>

                        {errors.otp && (
                          <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                            <AlertCircle className="size-3.5 text-red-600 shrink-0" />
                            <span>{errors.otp}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={resendCountdown > 0}
                            className="text-xs text-[#3d117a] font-semibold hover:underline disabled:opacity-50 cursor-pointer"
                          >
                            {resendCountdown > 0 ? `Resend code (${resendCountdown}s)` : 'Resend code'}
                          </button>

                          <button
                            type="button"
                            onClick={handleVerifyOtp}
                            className="px-4 py-1.5 bg-[#3d117a] hover:bg-[#2d0960] active:scale-95 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-xs"
                          >
                            Verify Code
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Unverified submission attempt alert */}
                    {!otpSent && errors.otp && (
                      <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium pt-0.5">
                        <AlertCircle className="size-3.5 text-red-600 shrink-0" />
                        <span>{errors.otp}</span>
                      </div>
                    )}
                  </div>

                  {/* 4. Email Address (Optional as requested!) */}
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-semibold text-neutral-800">
                      Email Address <span className="text-neutral-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex.mercer@example.com (optional)"
                      className="w-full h-[52px] px-4 rounded-[14px] text-[15px] font-normal transition-all outline-none bg-[#F4F4F6] text-[#111827] border-2 border-transparent placeholder-[#9CA3AF] focus:bg-[#FCFCFE] focus:border-[#3d117a] focus:shadow-[0_0_0_3px_rgba(61,17,122,0.12)]"
                    />
                  </div>

                  {/* 5. Reason for Visit (Optional) */}
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-semibold text-neutral-800">
                      Reason for Visit <span className="text-neutral-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Briefly describe your symptoms or concern for the doctor..."
                      className="w-full p-4 rounded-[14px] text-[15px] font-normal transition-all outline-none bg-[#F4F4F6] text-[#111827] border-2 border-transparent placeholder-[#9CA3AF] focus:bg-[#FCFCFE] focus:border-[#3d117a] focus:shadow-[0_0_0_3px_rgba(61,17,122,0.12)] resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-3">
                    <button
                      type="submit"
                      className="w-full h-[52px] bg-[#3d117a] hover:bg-[#2d0960] active:scale-[0.99] text-white font-bold text-base rounded-[14px] shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>Continue to Confirmation</span>
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Sticky Appointment Summary Card (1:1 with media_1790071408155.png) */}
              <div className="sticky top-20 bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
                {/* Top Purple Accent Strip */}
                <div className="h-1.5 w-full bg-[#3d117a]" />

                <div className="p-6 space-y-5">
                  <h3 className="font-bold text-lg text-neutral-950">
                    Appointment Details
                  </h3>

                  {/* Doctor Info */}
                  <div className="flex items-center gap-3.5">
                    <div className="size-16 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100 shrink-0">
                      <img
                        src={doctor.photo}
                        alt={doctor.name}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-neutral-900 leading-snug">
                        {doctor.name}
                      </h4>
                      <div className="text-xs text-neutral-600 font-medium">
                        {doctor.specialty}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-neutral-200" />

                  {/* Date and Time with Change Action Button */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-[#3d117a]" />
                        <span>Date and Time</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="text-xs font-bold text-[#3d117a] hover:underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                    <div className="text-sm font-semibold text-neutral-800 pt-0.5">
                      {formattedSelectedDate} at {selectedSlot}
                    </div>
                  </div>

                  <div className="border-t border-neutral-200" />

                  {/* Location with Address */}
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-[#3d117a]" />
                      <span>Location</span>
                    </div>
                    <div className="text-sm font-semibold text-neutral-900 pt-0.5">
                      {doctor.practiceName}
                    </div>
                    <div className="text-xs text-neutral-600 leading-relaxed">
                      {doctor.addressLine1}, {doctor.addressLine2}
                    </div>
                    <div className="text-xs text-neutral-600 font-medium">
                      📞 {doctor.phone}
                    </div>
                  </div>

                  <div className="border-t border-neutral-200" />

                  {/* Visit Type */}
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="size-3.5 text-[#3d117a]" />
                      <span>Visit Type</span>
                    </div>
                    <div className="text-sm font-semibold text-neutral-900 pt-0.5">
                      New Patient {visitType}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 3: APPOINTMENT CONFIRMATION
              ══════════════════════════════════════════════════════════════ */}
          {currentStep === 3 && (
            <div className="max-w-2xl mx-auto py-6 animate-fadeIn">
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-lg p-6 sm:p-10 text-center space-y-6">
                {/* Success Check Icon */}
                <div className="size-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="size-10" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-2xl font-extrabold text-neutral-950">
                    Appointment Successfully Scheduled!
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-600">
                    A confirmation SMS and calendar invitation have been sent to <strong>{phone}</strong>
                    {email ? (
                      <>
                        {' '}
                        and <strong>{email}</strong>
                      </>
                    ) : null}
                    .
                  </p>
                </div>

                {/* Confirmation Code Pill */}
                <div className="inline-block bg-[#f4f3f8] px-5 py-2.5 rounded-xl border border-purple-200">
                  <span className="text-xs text-neutral-500 block font-medium">Confirmation Code</span>
                  <span className="text-xl font-mono font-extrabold text-[#3d117a]">{confirmationCode}</span>
                </div>

                {/* Appointment Breakdown Card */}
                <div className="bg-neutral-50 rounded-xl p-5 text-left text-xs sm:text-sm space-y-3 border border-neutral-200">
                  <div className="flex items-start gap-4 pb-3 border-b border-neutral-200">
                    <img
                      src={doctor.photo}
                      alt={doctor.name}
                      className="size-14 rounded-lg object-cover object-top border border-neutral-300 shrink-0"
                    />
                    <div>
                      <div className="font-bold text-base text-neutral-900">{doctor.name}</div>
                      <div className="text-xs text-neutral-600">{doctor.specialty}</div>
                      <div className="text-xs text-[#3d117a] font-semibold mt-0.5">New Patient {visitType}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-700">
                    <div>
                      <span className="font-bold text-neutral-900 block">Date &amp; Time:</span>
                      <span>{formattedSelectedDate} at {selectedSlot}</span>
                    </div>
                    <div>
                      <span className="font-bold text-neutral-900 block">Patient:</span>
                      <span>{fullName}</span>
                    </div>
                    <div>
                      <span className="font-bold text-neutral-900 block">Clinic Location:</span>
                      <span>{doctor.practiceName}, {doctor.addressLine1}</span>
                    </div>
                    <div>
                      <span className="font-bold text-neutral-900 block">Clinic Contact:</span>
                      <span>{doctor.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') window.print();
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-[12px] border border-neutral-300 text-neutral-700 text-xs font-bold hover:bg-neutral-100 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Printer className="size-4" />
                    <span>Print Confirmation</span>
                  </button>

                  <button
                    type="button"
                    onClick={onBackToSearch}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-[12px] bg-[#3d117a] hover:bg-[#2d0960] active:scale-95 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Find Another Doctor</span>
                  </button>

                  <button
                    type="button"
                    onClick={onBackToHome}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-[12px] border border-purple-200 bg-purple-50 text-[#3d117a] text-xs font-bold hover:bg-purple-100 transition cursor-pointer"
                  >
                    Return to Home
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
