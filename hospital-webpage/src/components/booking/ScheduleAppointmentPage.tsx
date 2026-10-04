import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  MapPin,
  Calendar,
  FileText,
  Check,
  CheckCircle2,
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
import { Breadcrumbs } from '../common/Breadcrumbs';
import { demoStartDate, initialDemoDate } from '../../data/demoAvailability';
import {
  trackBookingFlowStarted,
  trackBookingStepViewed,
  trackBookingStepCompleted,
  trackBookingValidationFailed,
  trackBookingPreviewCompleted,
  type BookingFieldGroup,
} from '../../lib/posthog';

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

interface ScheduleAppointmentPageProps {
  doctor: DoctorScheduleProfile;
  initialStep?: 1 | 2;
  initialDate?: string;
  initialSlot?: string;
  initialVisitType?: 'Office Visit' | 'Video Visit';
  onBackToSearch: () => void;
  onBackToHome: () => void;
  onOpenLogin?: () => void;
  onSelectSimilarDoctor?: (doctorId: string) => void;
  user: { name: string; identifier: string } | null;
}

export const ScheduleAppointmentPage: React.FC<ScheduleAppointmentPageProps> = ({
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

  // PostHog analytics tracking for booking funnel
  useEffect(() => {
    trackBookingFlowStarted('booking', initialStep);
  }, [initialStep]);

  useEffect(() => {
    trackBookingStepViewed(currentStep);
    if (currentStep === 3) {
      trackBookingPreviewCompleted('booking');
    }
  }, [currentStep]);

  // Step 1: Appointment Details State
  const [isNewPatient, setIsNewPatient] = useState<'new' | 'existing'>('new');
  const [visitType, setVisitType] = useState<'Office Visit' | 'Video Visit'>(initialVisitType);
  const [selectedLocation, setSelectedLocation] = useState(doctor.practiceName);

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => initialDemoDate(initialDate));
  const [selectedDate, setSelectedDate] = useState<string>(() => format(initialDemoDate(initialDate), 'yyyy-MM-dd'));
  const [selectedSlot, setSelectedSlot] = useState<string>(initialSlot || '');

  // Step 2: Patient Information State (styled using login modal components)
  const [appointmentFor, setAppointmentFor] = useState<'Myself' | 'Someone else'>('Myself');
  const [fullName, setFullName] = useState(user?.name || '');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [showMoreGender, setShowMoreGender] = useState(false);
  const [phone, setPhone] = useState(user?.identifier?.match(/^\d+$/) ? user.identifier : '');
  const [email, setEmail] = useState(''); // Optional!
  const [reason, setReason] = useState('');
  const [showSignInAccordion, setShowSignInAccordion] = useState(false);

  // OTP Verification State (adapted from AaveLoginFlow)
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [activeOtpIndex, setActiveOtpIndex] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Validation & Error state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 3 is a local walkthrough; no booking is submitted here.

  // Dynamic slot generation for any selected date (>3 slots per day supported!)
  const getSlotsForDate = useCallback((dateStr: string): string[] => {
    if (doctor.availableSlots && doctor.availableSlots[dateStr] && doctor.availableSlots[dateStr].length > 0) {
      return doctor.availableSlots[dateStr];
    }
    // Parse the date to determine day of week
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat

    // Sunday: weekend morning schedule
    if (dayOfWeek === 0) {
      return ['10:00 AM', '11:00 AM', '11:45 AM', '01:30 PM'];
    }
    // Saturday: morning and early afternoon
    if (dayOfWeek === 6) {
      return ['09:30 AM', '10:15 AM', '11:00 AM', '11:45 AM', '01:30 PM', '02:15 PM'];
    }
    // Weekdays (Mon-Fri): rich schedule with 4 to 6 slots
    if (day % 2 === 0) {
      return ['09:00 AM', '10:30 AM', '11:45 AM', '02:30 PM', '03:45 PM', '04:30 PM'];
    } else {
      return ['09:15 AM', '10:00 AM', '11:30 AM', '01:15 PM', '02:45 PM', '04:00 PM'];
    }
  }, [doctor.availableSlots]);

  // Current day slots list
  const currentDaySlots = useMemo(() => {
    return getSlotsForDate(selectedDate);
  }, [getSlotsForDate, selectedDate]);

  // Format selected date display
  const formattedSelectedDate = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return format(d, 'EEEE, MMMM d, yyyy');
    } catch {
      return 'Choose a date';
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
        hasSlots: true,
        isSelected: dStr === selectedDate,
      };
    });
  }, [calendarMonth, selectedDate]);

  // Handle advancing to Step 2 when slot is picked in Step 1
  const handleSelectSlotInStep1 = (slot: string) => {
    setSelectedSlot(slot);
    trackBookingStepCompleted(1);
    setCurrentStep(2);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // OTP Handlers (adapted from AaveLoginFlow)
  const handleSendOtp = () => {
    if (!phone.trim()) {
      setErrors((prev) => ({ ...prev, phone: 'Enter a sample mobile number to try the demo code' }));
      return;
    }
    setOtpSent(true);
    setOtpVerified(false);
    setOtpDigits(['', '', '', '', '', '']);
    setErrors((prev) => ({ ...prev, phone: '', otp: '' }));
    setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 100);
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleanVal = value.replace(/[^0-9]/g, '');
    const char = cleanVal.slice(-1);

    setOtpDigits((prev) => {
      const nextDigits = [...prev];
      nextDigits[index] = char;
      // Auto-verify if all 6 digits entered
      if (char && index === 5 && nextDigits.every((d) => d !== '')) {
        setOtpVerified(true);
        setErrors((prevErr) => ({ ...prevErr, otp: '' }));
      }
      return nextDigits;
    });

    if (char && index < 5) {
      setActiveOtpIndex(index + 1);
      otpInputRefs.current[index + 1]?.focus();
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
      setErrors((prev) => ({ ...prev, otp: 'Enter all 6 digits of the demo code' }));
    }
  };

  // Handle submitting Step 2 -> Step 3 (With strict validation & exact error reasons)
  const handleProceedToConfirmation = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    // 1. Legal full name (single field with first and last)
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      newErrors.fullName = 'Full name is required';
    } else if (trimmedName.split(/\s+/).length < 2) {
      newErrors.fullName = 'Please enter both your first and last name';
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
      newErrors.otp = 'Enter a six-digit demo code before continuing';
      if (!otpSent) {
        setOtpSent(true);
      }
    }

    // 5. Optional email address validation (only if provided)
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Enter a valid email address';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const fieldGroup: BookingFieldGroup = newErrors.fullName ? 'identity'
        : newErrors.dob ? 'date_of_birth'
        : newErrors.gender ? 'gender'
        : newErrors.phone || newErrors.otp ? 'contact_verification'
        : 'other';
      trackBookingValidationFailed(2, fieldGroup);

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
    trackBookingStepCompleted(2);
    setCurrentStep(3);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-[#fcfbf9] text-[#121212] flex flex-col font-sans">

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <Breadcrumbs
            items={[
              { label: 'Home', onClick: onBackToHome },
              { label: 'Find a Doctor', onClick: onBackToSearch },
              { label: doctor.name },
            ]}
          />
          <p role="status" className="rounded-xl border border-[#dce9df] bg-[#eef5eb] px-4 py-3 text-sm text-[#315943]">Sample walkthrough: dates, time slots, and verification are examples. No appointment is reserved or message sent.</p>
          <div className="max-w-2xl" aria-label={`Booking progress: step ${currentStep} of 3`}>
            <div className="mb-2 flex justify-between text-xs font-semibold text-[#315943]"><span>Step {currentStep} of 3</span><span>{currentStep === 1 ? 'Visit details' : currentStep === 2 ? 'Your details' : 'Review'}</span></div>
            <div role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={currentStep} aria-label="Booking progress" className="h-1.5 overflow-hidden rounded-full bg-[#dce9df]"><div className="h-full rounded-full bg-[#24553c] transition-[width]" style={{ width: `${currentStep / 3 * 100}%` }} /></div>
          </div>
          {/* ══════════════════════════════════════════════════════════════
              3-STEP PROGRESS STEPPER (Matching media_1790071475424.png & media_1790071408155.png)
              ══════════════════════════════════════════════════════════════ */}
          <div className="hidden sm:flex items-center max-w-2xl text-xs sm:text-sm font-semibold select-none">
            {/* Step 1 Item */}
            <div
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div
                className={`size-6 shrink-0 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                  currentStep === 1
                    ? 'bg-[#154734] text-white shadow-xs'
                    : 'bg-[#008080] text-white' // Teal check circle when completed
                }`}
              >
                {currentStep > 1 ? <Check className="size-3.5 stroke-[3]" /> : '1'}
              </div>
              <span
                className={`transition-colors ${
                  currentStep === 1 ? 'text-stone-950 font-bold' : 'text-stone-700 group-hover:text-stone-950'
                }`}
              >
                Appointment Details
              </span>
            </div>

            {/* Stepper Connector 1-2 */}
            <div className="flex-1 mx-3 sm:mx-5 h-0.5 bg-stone-200" />

            {/* Step 2 Item */}
            <div
              onClick={() => {
                if (currentStep > 1) setCurrentStep(2);
              }}
              className={`flex items-center gap-2.5 ${currentStep >= 2 ? 'cursor-pointer group' : 'opacity-60'}`}
            >
              <div
                className={`size-6 shrink-0 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                  currentStep === 2
                    ? 'bg-[#154734] text-white shadow-xs'
                    : currentStep > 2
                    ? 'bg-[#008080] text-white'
                    : 'bg-white border-2 border-stone-300 text-stone-500'
                }`}
              >
                {currentStep > 2 ? <Check className="size-3.5 stroke-[3]" /> : '2'}
              </div>
              <span
                className={`transition-colors ${
                  currentStep === 2 ? 'text-stone-950 font-bold' : 'text-stone-600'
                }`}
              >
                Patient Information
              </span>
            </div>

            {/* Stepper Connector 2-3 */}
            <div className="flex-1 mx-3 sm:mx-5 h-0.5 bg-stone-200" />

            {/* Step 3 Item */}
            <div className={`flex items-center gap-2.5 ${currentStep === 3 ? 'text-stone-950 font-bold' : 'opacity-60 text-stone-500'}`}>
              <div
                className={`size-6 shrink-0 rounded-full flex items-center justify-center font-bold text-xs ${
                  currentStep === 3 ? 'bg-[#154734] text-white shadow-xs' : 'bg-white border-2 border-stone-300 text-stone-500'
                }`}
              >
                3
              </div>
              <span>Review</span>
            </div>
          </div>

          {/* Page Title */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#12231b] tracking-tight">
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
                  <h3 className="font-bold text-base text-stone-900">
                    Are you new to this doctor?
                  </h3>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 pt-1">
                    <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-stone-800">
                      <input
                        type="radio"
                        name="isNewPatient"
                        checked={isNewPatient === 'new'}
                        onChange={() => setIsNewPatient('new')}
                        className="size-4.5 text-[#154734] focus:ring-[#154734] cursor-pointer accent-[#154734]"
                      />
                      <span>I&apos;m new to this doctor.</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-stone-800">
                      <input
                        type="radio"
                        name="isNewPatient"
                        checked={isNewPatient === 'existing'}
                        onChange={() => setIsNewPatient('existing')}
                        className="size-4.5 text-[#154734] focus:ring-[#154734] cursor-pointer accent-[#154734]"
                      />
                      <span>I&apos;ve seen this doctor in the past three years.</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-stone-200" />

                {/* Section 2: Type of Appointment */}
                <div className="space-y-3">
                  <h3 className="font-bold text-base text-stone-900">
                    Type of Appointment
                  </h3>
                  <div className="flex items-center gap-8 pt-1">
                    <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-stone-800">
                      <input
                        type="radio"
                        name="visitType"
                        checked={visitType === 'Office Visit'}
                        onChange={() => setVisitType('Office Visit')}
                        className="size-4.5 text-[#154734] focus:ring-[#154734] cursor-pointer accent-[#154734]"
                      />
                      <span>Office Visit</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-stone-800">
                      <input
                        type="radio"
                        name="visitType"
                        checked={visitType === 'Video Visit'}
                        onChange={() => setVisitType('Video Visit')}
                        className="size-4.5 text-[#154734] focus:ring-[#154734] cursor-pointer accent-[#154734]"
                      />
                      <span>Video Visit</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-stone-200" />

                {/* Section 3: Location for Your Visit (No weird green bar!) */}
                <div className="space-y-3">
                  <h3 className="font-bold text-base text-stone-900">
                    Location for Your Visit
                  </h3>

                  {/* Clean Location Card with standard purple highlight */}
                  <div
                    onClick={() => setSelectedLocation(doctor.practiceName)}
                    className="relative bg-white rounded-xl border-2 border-stone-200 hover:border-[#154734]/50 shadow-xs overflow-hidden p-5 sm:p-6 space-y-4 cursor-pointer transition-all"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="size-5 rounded-full border-2 border-[#154734] flex items-center justify-center shrink-0 mt-0.5">
                        <div className="size-2.5 rounded-full bg-[#154734]" />
                      </div>
                      <div className="space-y-1 text-sm">
                        <h4 className="font-bold text-base text-stone-900 leading-snug">
                          {selectedLocation}
                        </h4>
                        <div className="text-stone-600 text-xs sm:text-sm">
                          {doctor.addressLine1}, {doctor.addressLine2}
                        </div>
                        <div className="text-xs sm:text-sm text-stone-800 font-semibold pt-0.5">
                          📞 {doctor.phone}
                        </div>
                      </div>
                    </div>

                    {/* Next Available Pill */}
                    <div className="pt-1">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#eef7f2] text-[#154734] border border-[#154734]/20 text-xs font-bold">
                        <CalendarCheck className="size-4 text-[#1e6b4c]" />
                        <span>Sample times from {format(demoStartDate(), 'MMM d')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Doctor Portrait + Month Calendar + Slots (1:1 with media_1790071475424.png) */}
              <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-6">
                {/* Doctor Portrait & Summary */}
                <div className="flex items-center gap-3.5 pb-2">
                  <div className="size-16 rounded-xl overflow-hidden border border-stone-200 bg-stone-100 shrink-0">
                    <img
                      src={doctor.photo}
                      alt={doctor.name}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-base text-stone-900 leading-snug">
                      {doctor.name}
                    </h4>
                    <div className="text-xs text-stone-600 font-medium">
                      {doctor.specialty}
                    </div>
                    <div className="text-xs text-stone-500 flex items-center gap-1 pt-1">
                      <MapPin className="size-3 text-stone-400 shrink-0" />
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
                      disabled={startOfMonth(calendarMonth) <= startOfMonth(demoStartDate())}
                      className="text-xs font-semibold text-stone-700 hover:text-[#154734] inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <ChevronLeft className="size-4" />
                      <span>{format(subMonths(calendarMonth, 1), 'MMM')}</span>
                    </button>

                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-stone-300 text-xs font-bold text-stone-900 cursor-pointer hover:bg-stone-50">
                      <span>{format(calendarMonth, 'MMMM yyyy')}</span>
                      <ChevronDown className="size-3.5 text-stone-500" />
                    </div>

                    <button
                      type="button"
                      onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                      className="text-xs font-semibold text-stone-700 hover:text-[#154734] inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{format(addMonths(calendarMonth, 1), 'MMM')}</span>
                      <ChevronRight className="size-4" />
                    </button>
                  </div>

                  {/* Day of Week Headers */}
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-stone-500 pt-1">
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
                    {calendarDays.map((cell) => {
                      const isSelected = cell.isSelected;
                      return (
                        <div key={cell.dateStr} className="h-10 flex items-center justify-center">
                          <button
                            type="button"
                            disabled={cell.dateStr < format(demoStartDate(), 'yyyy-MM-dd')}
                            onClick={() => {
                              setSelectedDate(cell.dateStr);
                              if (!cell.isCurrentMonth) {
                                setCalendarMonth(cell.dateObj);
                              }
                            }}
                            className={`w-full h-10 sm:size-10 rounded-full text-[13px] flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 ${
                              isSelected
                                ? 'bg-[#154734] text-white font-bold shadow-xs ring-2 ring-[#154734]/20'
                                : cell.isCurrentMonth
                                ? 'text-stone-900 font-bold hover:bg-[#dcefe4] hover:text-[#154734] active:scale-95'
                                : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                            }`}
                          >
                            {cell.dayNum}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-stone-200" />

                {/* Available Slots for Selected Date (>3 Slots as requested!) */}
                <div className="space-y-3">
                  <div className="font-bold text-sm text-stone-900">
                    {formattedSelectedDate}
                  </div>
                  <div className="text-xs font-semibold text-stone-600">
                    Afternoon Slots:
                  </div>

                  {/* Slot buttons grid (More than 3 slots supported!) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {currentDaySlots.map((slot: string) => {
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => handleSelectSlotInStep1(slot)}
                          className={`py-2 px-2 rounded-md font-bold text-xs transition cursor-pointer text-center ${
                            isSelected
                              ? 'bg-[#0f3426] text-white ring-2 ring-[#4efcd3]'
                              : 'bg-[#154734] hover:bg-[#0f3426] active:scale-95 text-white'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-stone-200" />

                {/* Explore similar providers */}
                <div className="space-y-2 pt-1">
                  <h4 className="font-bold text-xs text-stone-900">
                    Explore similar providers
                  </h4>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    Browse providers similar to {doctor.name.split(',')[0]} in this walkthrough.
                  </p>
                  <button
                    type="button"
                    onClick={onBackToSearch}
                    className="w-full bg-[#154734] hover:bg-[#0f3426] active:scale-95 text-white font-bold text-xs py-2 px-4 rounded-full transition cursor-pointer"
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
                <div className="bg-white rounded-xl border border-stone-200 shadow-2xs p-5">
                  <div
                    onClick={() => setShowSignInAccordion(!showSignInAccordion)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="space-y-1">
                      <h3 className="font-bold text-base text-[#12231b]">
                        Sri Lakshmi appointment demo
                      </h3>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        Continue as a guest with sample details. This walkthrough does not create a patient account.
                      </p>
                    </div>
                    <div className="size-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0 ml-3">
                      <ChevronDown
                        className={`size-4 text-stone-600 transition-transform ${
                          showSignInAccordion ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {showSignInAccordion && onOpenLogin && (
                    <div className="mt-4 pt-4 border-t border-stone-200 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={onOpenLogin}
                        className="px-5 py-2.5 rounded-[12px] bg-[#154734] text-white text-xs font-bold hover:bg-[#0f3426] transition cursor-pointer"
                      >
                        Sign In Now
                      </button>
                      <span className="text-xs text-stone-500">Demo code only; no SMS is sent</span>
                    </div>
                  )}
                </div>

                {/* Divider: Or Continue without MyChart */}
                <div className="relative flex items-center justify-center my-6">
                  <div className="w-full border-t border-stone-200" />
                  <span className="absolute bg-white px-4 text-xs font-bold text-stone-800">
                    Or Continue as Guest
                  </span>
                </div>

                {/* Section Header: Tell us a bit about you (1:1 with media_1790072235537.png) */}
                <div className="space-y-1">
                  <h2 className="text-2xl font-extrabold text-stone-950">
                    Tell us a bit about you
                  </h2>
                  <p className="text-sm text-stone-600">
                    To book your appointment, we need to verify a few things for {doctor.name}&apos;s office
                  </p>
                </div>

                {/* Section: Who is this Appointment For? */}
                <div className="space-y-2 pt-1">
                  <h3 className="font-bold text-sm text-stone-900">
                    Who is this Appointment For?
                  </h3>
                  <div className="flex items-center gap-6 pt-0.5">
                    <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-stone-800">
                      <input
                        type="radio"
                        name="appointmentFor"
                        checked={appointmentFor === 'Myself'}
                        onChange={() => setAppointmentFor('Myself')}
                        className="size-4.5 text-[#154734] focus:ring-[#154734] cursor-pointer accent-[#154734]"
                      />
                      <span>Myself</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-stone-800">
                      <input
                        type="radio"
                        name="appointmentFor"
                        checked={appointmentFor === 'Someone else'}
                        onChange={() => setAppointmentFor('Someone else')}
                        className="size-4.5 text-[#154734] focus:ring-[#154734] cursor-pointer accent-[#154734]"
                      />
                      <span>Someone else</span>
                    </label>
                  </div>
                </div>

                {/* Patient Information Form (Single Name field, Optional Email, Inline OTP) */}
                <form onSubmit={handleProceedToConfirmation} className="space-y-5 pt-1" noValidate>
                  {/* 1. Legal Full Name (Single Field with First and Last) */}
                  <div id="field-fullName" className="space-y-1.5">
                    <label htmlFor="patient-full-name" className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-800">
                      <span>Legal full name</span>
                      <Info className="size-3.5 text-stone-400" />
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="patient-full-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                      }}
                      placeholder="First and last name"
                      className={`w-full h-[52px] px-4 rounded-[14px] text-[15px] font-normal transition-all outline-none text-[#121212] placeholder-[#9CA3AF] ${
                        errors.fullName
                          ? 'bg-red-50/25 border-2 border-red-500 focus:border-red-600'
                          : 'bg-[#f6f4ef] border-2 border-transparent focus:bg-[#fcfbf9] focus:border-[#154734] focus:shadow-[0_0_0_3px_rgba(61,17,122,0.12)]'
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
                      <label htmlFor="patient-dob" className="block text-[13px] font-semibold text-stone-800">
                        Date of birth <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="patient-dob"
                        type="date"
                        value={dob}
                        onChange={(e) => {
                          setDob(e.target.value);
                          if (errors.dob) setErrors((prev) => ({ ...prev, dob: '' }));
                        }}
                        className={`w-full h-[52px] px-4 rounded-[14px] text-[15px] font-normal transition-all outline-none text-[#121212] placeholder-[#9CA3AF] cursor-pointer ${
                          errors.dob
                            ? 'bg-red-50/25 border-2 border-red-500 focus:border-red-600'
                            : 'bg-[#f6f4ef] border-2 border-transparent focus:bg-[#fcfbf9] focus:border-[#154734] focus:shadow-[0_0_0_3px_rgba(61,17,122,0.12)]'
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
                      <label className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-800">
                        <span>Sex</span>
                        <Info className="size-3.5 text-stone-400" />
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-6 h-[52px] px-4 rounded-[14px] bg-[#f6f4ef]">
                        <label htmlFor="gender-male" className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-stone-800">
                          <input
                            id="gender-male"
                            type="radio"
                            name="gender"
                            checked={gender === 'Male'}
                            onChange={() => {
                              setGender('Male');
                              if (errors.gender) setErrors((prev) => ({ ...prev, gender: '' }));
                            }}
                            className="size-4.5 text-[#154734] focus:ring-[#154734] cursor-pointer accent-[#154734]"
                          />
                          <span>Male</span>
                        </label>
                        <label htmlFor="gender-female" className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-stone-800">
                          <input
                            id="gender-female"
                            type="radio"
                            name="gender"
                            checked={gender === 'Female'}
                            onChange={() => {
                              setGender('Female');
                              if (errors.gender) setErrors((prev) => ({ ...prev, gender: '' }));
                            }}
                            className="size-4.5 text-[#154734] focus:ring-[#154734] cursor-pointer accent-[#154734]"
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
                      className="text-xs font-semibold text-[#154734] hover:underline cursor-pointer"
                    >
                      Add more sex &amp; gender info (optional)
                    </button>
                    {showMoreGender && (
                      <div className="mt-2.5 p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-2">
                        <label className="block font-semibold text-stone-700">Gender Identity</label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg bg-white border border-stone-300 text-xs"
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
                    <label htmlFor="patient-phone" className="block text-[13px] font-semibold text-stone-800">
                      Mobile Phone Number <span className="text-red-500">*</span>
                    </label>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <input
                        id="patient-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                          if (otpVerified) setOtpVerified(false);
                        }}
                        placeholder="Mobile Number (e.g. 8217286695)"
                        className={`flex-1 h-[52px] px-4 rounded-[14px] text-[15px] font-normal transition-all outline-none text-[#121212] placeholder-[#9CA3AF] ${
                          errors.phone || (errors.otp && !otpVerified)
                            ? 'bg-red-50/25 border-2 border-red-500 focus:border-red-600'
                            : 'bg-[#f6f4ef] border-2 border-transparent focus:bg-[#fcfbf9] focus:border-[#154734] focus:shadow-[0_0_0_3px_rgba(61,17,122,0.12)]'
                        }`}
                      />

                      {!otpVerified && (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="h-[52px] px-5 bg-[#154734] hover:bg-[#0f3426] active:scale-95 text-white text-xs font-bold rounded-[14px] transition cursor-pointer shrink-0 shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <Smartphone className="size-4" />
                          <span>{otpSent ? 'Reset demo code' : 'Try demo code'}</span>
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
                        <span>Demo code accepted. Your phone number has not been verified.</span>
                      </div>
                    )}

                    {/* Inline OTP Code Verification Panel (from AaveLoginFlow) */}
                    {otpSent && !otpVerified && (
                      <div className="bg-[#eef7f2] border border-[#dcefe4] rounded-2xl p-4 sm:p-5 space-y-3.5 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-[#12231b] flex items-center gap-1.5">
                              <Smartphone className="size-4 text-[#154734]" />
                              <span>Enter any 6 digits to continue</span>
                            </h4>
                            <p className="text-xs text-stone-600 mt-0.5">
                              No code was sent to <strong className="text-stone-900">{phone || 'your mobile'}</strong>.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={handleAutoFillDemoOtp}
                            className="text-[11px] font-bold text-[#154734] bg-white border border-[#dcefe4] hover:bg-[#eef7f2] px-2.5 py-1 rounded-lg transition cursor-pointer shadow-2xs"
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
                              className={`min-w-0 flex-1 max-w-10 h-12 sm:w-11 sm:h-13 text-center text-lg sm:text-xl font-bold rounded-[12px] outline-none transition-all placeholder-stone-300 ${
                                activeOtpIndex === idx
                                  ? 'border-2 border-[#154734] bg-white text-stone-950 shadow-[0_0_0_3px_rgba(61,17,122,0.12)]'
                                  : 'border-2 border-transparent bg-white text-stone-900 shadow-2xs'
                              }`}
                            />
                          ))}

                          <span className="text-stone-400 font-bold px-0.5 select-none">-</span>

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
                              className={`min-w-0 flex-1 max-w-10 h-12 sm:w-11 sm:h-13 text-center text-lg sm:text-xl font-bold rounded-[12px] outline-none transition-all placeholder-stone-300 ${
                                activeOtpIndex === idx
                                  ? 'border-2 border-[#154734] bg-white text-stone-950 shadow-[0_0_0_3px_rgba(61,17,122,0.12)]'
                                  : 'border-2 border-transparent bg-white text-stone-900 shadow-2xs'
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
                            className="text-xs text-[#154734] font-semibold hover:underline cursor-pointer"
                          >
                            Reset demo code
                          </button>

                          <button
                            type="button"
                            onClick={handleVerifyOtp}
                            className="px-4 py-1.5 bg-[#154734] hover:bg-[#0f3426] active:scale-95 text-white text-xs font-bold rounded-full transition cursor-pointer shadow-xs"
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
                  <div id="field-email" className="space-y-1.5">
                    <label htmlFor="patient-email" className="block text-[13px] font-semibold text-stone-800">
                      Email Address <span className="text-stone-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      id="patient-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                      }}
                      placeholder="alex.mercer@example.com (optional)"
                      className={`w-full h-[52px] px-4 rounded-[14px] text-[15px] font-normal transition-all outline-none text-[#121212] placeholder-[#9CA3AF] ${
                        errors.email
                          ? 'bg-red-50/25 border-2 border-red-500 focus:border-red-600'
                          : 'bg-[#f6f4ef] border-2 border-transparent focus:bg-[#fcfbf9] focus:border-[#154734] focus:shadow-[0_0_0_3px_rgba(61,17,122,0.12)]'
                      }`}
                    />
                    {errors.email && (
                      <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium pt-0.5">
                        <AlertCircle className="size-3.5 text-red-600 shrink-0" />
                        <span>{errors.email}</span>
                      </div>
                    )}
                  </div>

                  {/* 5. Reason for Visit (Optional) */}
                  <div className="space-y-1.5">
                    <label htmlFor="patient-reason" className="block text-[13px] font-semibold text-stone-800">
                      Reason for Visit <span className="text-stone-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      id="patient-reason"
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Briefly describe your symptoms or concern for the doctor..."
                      className="w-full p-4 rounded-[14px] text-[15px] font-normal transition-all outline-none bg-[#f6f4ef] text-[#121212] border-2 border-transparent placeholder-[#9CA3AF] focus:bg-[#fcfbf9] focus:border-[#154734] focus:shadow-[0_0_0_3px_rgba(61,17,122,0.12)] resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-3">
                    <button
                      type="submit"
                      className="w-full h-[52px] bg-[#154734] hover:bg-[#0f3426] active:scale-[0.99] text-white font-bold text-base rounded-[14px] shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>Review visit details</span>
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Sticky Appointment Summary Card (1:1 with media_1790071408155.png) */}
              <div className="sticky top-24 bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                {/* Top Purple Accent Strip */}
                <div className="h-1.5 w-full bg-[#154734]" />

                <div className="p-6 space-y-5">
                  <h3 className="font-bold text-lg text-stone-950">
                    Appointment Details
                  </h3>

                  {/* Doctor Info */}
                  <div className="flex items-center gap-3.5">
                    <div className="size-16 rounded-lg overflow-hidden border border-stone-200 bg-stone-100 shrink-0">
                      <img
                        src={doctor.photo}
                        alt={doctor.name}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-stone-900 leading-snug">
                        {doctor.name}
                      </h4>
                      <div className="text-xs text-stone-600 font-medium">
                        {doctor.specialty}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-stone-200" />

                  {/* Date and Time with Change Action Button */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-[#154734]" />
                        <span>Date and Time</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="text-xs font-bold text-[#154734] hover:underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                    <div className="text-sm font-semibold text-stone-800 pt-0.5">
                      {formattedSelectedDate} at {selectedSlot}
                    </div>
                  </div>

                  <div className="border-t border-stone-200" />

                  {/* Location with Address */}
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-[#154734]" />
                      <span>Location</span>
                    </div>
                    <div className="text-sm font-semibold text-stone-900 pt-0.5">
                      {doctor.practiceName}
                    </div>
                    <div className="text-xs text-stone-600 leading-relaxed">
                      {doctor.addressLine1}, {doctor.addressLine2}
                    </div>
                    <div className="text-xs text-stone-600 font-medium">
                      📞 {doctor.phone}
                    </div>
                  </div>

                  <div className="border-t border-stone-200" />

                  {/* Visit Type */}
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="size-3.5 text-[#154734]" />
                      <span>Visit Type</span>
                    </div>
                    <div className="text-sm font-semibold text-stone-900 pt-0.5">
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
              <div className="bg-white rounded-2xl border border-stone-200 shadow-lg p-6 sm:p-10 text-center space-y-6">
                {/* Success Check Icon */}
                <div className="size-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="size-10" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-2xl font-extrabold text-stone-950">
                    Walkthrough complete
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600">
                    This was a sample walkthrough. No appointment has been reserved, and no SMS or calendar invitation has been sent. Contact the clinic to confirm availability before making plans.
                  </p>
                </div>

                {/* Appointment Breakdown Card */}
                <div className="bg-stone-50 rounded-xl p-5 text-left text-xs sm:text-sm space-y-3 border border-stone-200">
                  <div className="flex items-start gap-4 pb-3 border-b border-stone-200">
                    <img
                      src={doctor.photo}
                      alt={doctor.name}
                      className="size-14 rounded-lg object-cover object-top border border-stone-300 shrink-0"
                    />
                    <div>
                      <div className="font-bold text-base text-stone-900">{doctor.name}</div>
                      <div className="text-xs text-stone-600">{doctor.specialty}</div>
                      <div className="text-xs text-[#154734] font-semibold mt-0.5">New Patient {visitType}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-700">
                    <div>
                      <span className="font-bold text-stone-900 block">Date &amp; Time:</span>
                      <span>{formattedSelectedDate} at {selectedSlot}</span>
                    </div>
                    <div>
                      <span className="font-bold text-stone-900 block">Patient:</span>
                      <span>{fullName}</span>
                    </div>
                    <div>
                      <span className="font-bold text-stone-900 block">Clinic Location:</span>
                      <span>{doctor.practiceName}, {doctor.addressLine1}</span>
                    </div>
                    <div>
                      <span className="font-bold text-stone-900 block">Clinic Contact:</span>
                      <span>{doctor.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onBackToSearch}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-[12px] bg-[#154734] hover:bg-[#0f3426] active:scale-95 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Find Another Doctor</span>
                  </button>

                  <button
                    type="button"
                    onClick={onBackToHome}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-[12px] border border-[#154734]/20 bg-[#eef7f2] text-[#154734] text-xs font-bold hover:bg-[#dcefe4] transition cursor-pointer"
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
