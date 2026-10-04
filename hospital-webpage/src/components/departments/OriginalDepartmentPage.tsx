import React from 'react';
import {
  Sparkles,
  Star,
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Building2,
  Award,
  PhoneCall,
  Activity,
  UserCheck,
} from 'lucide-react';
import { departments } from '../../data/departments';
import { doctors } from '../../data/doctors';
import { Doctor } from '../../types';
import { StickyEmergencyHeader } from '../common/StickyEmergencyHeader';
import { Footer } from '../common/Footer';

interface OriginalDepartmentPageProps {
  departmentId: string;
  aiRecommendation?: {
    query: string;
    matchedDoctor: Doctor;
    clinicalReasoning: string;
  } | null;
  onBackToHome: () => void;
  onNavigate?: (section: string) => void;
  onSelectDepartment: (deptId: string) => void;
  onBookDoctor: (doctorId: string, prefillReason?: string) => void;
  onOpenBooking: () => void;
  onOpenLogin?: () => void;
  onOpenLegal?: (docId?: string) => void;
  user: { name: string; identifier: string } | null;
}

export const OriginalDepartmentPage: React.FC<OriginalDepartmentPageProps> = ({
  departmentId,
  aiRecommendation,
  onBackToHome,
  onNavigate,
  onSelectDepartment,
  onBookDoctor,
  onOpenBooking,
  onOpenLogin,
  onOpenLegal,
  user,
}) => {
  const currentDept =
    departments.find((d) => d.id === departmentId) || departments[0];
  const deptDoctors = doctors.filter((d) => d.departmentId === currentDept.id);

  // If no doctors directly match this departmentId, show doctors from related departments
  const displayDoctors =
    deptDoctors.length > 0
      ? deptDoctors
      : doctors.slice(0, 2);

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-[#121212] flex flex-col">
      {/* Sticky Top Header with Emergency Pill */}
      <StickyEmergencyHeader
        onNavigate={onNavigate || onBackToHome}
        onOpenBooking={onOpenBooking}
        onOpenLogin={onOpenLogin}
        user={user}
      />

      <main className="flex-1 pt-52 sm:pt-44 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
          {/* Breadcrumbs & Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-xs sm:text-sm text-neutral-500">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBackToHome}
                className="hover:text-[#154734] font-medium transition cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="size-3.5" />
                <span>Home</span>
              </button>
              <ChevronRight className="size-3 text-neutral-400" />
              <span>Departments</span>
              <ChevronRight className="size-3 text-neutral-400" />
              <span className="font-semibold text-neutral-900">
                {currentDept.name}
              </span>
            </div>

            {/* Quick Switch Department Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Switch Department:
              </span>
              <select
                value={currentDept.id}
                onChange={(e) => onSelectDepartment(e.target.value)}
                className="bg-white border border-neutral-200/90 rounded-lg px-2.5 py-1 text-xs sm:text-sm font-semibold text-neutral-800 focus:outline-none focus:border-[#154734] cursor-pointer"
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              ✦ AI CLINICAL RECOMMENDATION BANNER (Prompt to Doctor Match)
             ════════════════════════════════════════════════════════════════ */}
          {aiRecommendation && (
            <div className="relative overflow-hidden bg-gradient-to-br from-[#eef7f2] via-[#f4faf6] to-white border-2 border-[#154734]/25 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#154734] text-white text-xs font-bold tracking-wide uppercase shadow-2xs">
                    <Sparkles className="size-3.5 text-emerald-300" />
                    <span>AI Clinical Specialist Recommendation</span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                    Matched for your symptoms: &ldquo;{aiRecommendation.query}&rdquo;
                  </h2>

                  <p className="text-sm sm:text-base text-neutral-700 leading-relaxed font-normal">
                    {aiRecommendation.clinicalReasoning}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-neutral-600 pt-1">
                    <span className="flex items-center gap-1.5 text-[#154734]">
                      <CheckCircle2 className="size-4" />
                      Contact the hospital for consultation times
                    </span>
                    <span className="flex items-center gap-1.5 text-[#154734]">
                      <ShieldCheck className="size-4" />
                      Cashless insurance pre-authorized
                    </span>
                  </div>
                </div>

                {/* Highlighted Doctor Action Card */}
                <div className="bg-white rounded-2xl p-5 border border-[#154734]/20 shadow-md min-w-[300px] sm:min-w-[340px] flex flex-col justify-between space-y-4">
                  <div className="flex items-start gap-3.5">
                    <img
                      src={aiRecommendation.matchedDoctor.image}
                      alt={aiRecommendation.matchedDoctor.name}
                      className="size-16 rounded-xl object-cover object-top border border-neutral-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-500 mb-0.5">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        <span>{aiRecommendation.matchedDoctor.rating}</span>
                        <span className="text-neutral-400 font-normal">
                          ({aiRecommendation.matchedDoctor.reviewCount} reviews)
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-neutral-900 truncate">
                        {aiRecommendation.matchedDoctor.name}
                      </h3>
                      <p className="text-xs text-neutral-600 line-clamp-1">
                        {aiRecommendation.matchedDoctor.title}
                      </p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        {aiRecommendation.matchedDoctor.experienceYears} yrs exp •{' '}
                        {aiRecommendation.matchedDoctor.roomNumber}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] text-neutral-400 block">
                        Consultation
                      </span>
                      <span className="text-sm font-bold text-neutral-900">
                        ₹{aiRecommendation.matchedDoctor.consultationFee}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onBookDoctor(
                          aiRecommendation.matchedDoctor.id,
                          `AI Care Triage: ${aiRecommendation.query}`
                        )
                      }
                      className="px-4 py-2.5 rounded-xl bg-[#154734] hover:bg-[#1e6b4c] text-white font-bold text-xs sm:text-sm transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <Calendar className="size-3.5" />
                      <span>Book Consultation</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              DEPARTMENT HERO HEADER
             ════════════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-3xl p-8 sm:p-10 border border-neutral-200/90 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-4 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eef7f2] text-[#154734] border border-[#154734]/20 text-xs font-bold uppercase tracking-wider">
                  <Award className="size-3.5" />
                  <span>NABH Center of Clinical Excellence</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 leading-[1.15]">
                  Department of {currentDept.name}
                </h1>

                <p className="text-base sm:text-lg text-neutral-700 font-medium leading-snug">
                  {currentDept.tagline}
                </p>

                <p className="text-sm sm:text-base text-neutral-600 font-normal leading-relaxed">
                  {currentDept.description}
                </p>

                {/* Key Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-neutral-100">
                  <div>
                    <span className="block text-2xl font-bold text-[#154734]">
                      {currentDept.doctorCount}+
                    </span>
                    <span className="text-xs text-neutral-500 font-normal">
                      Senior Specialists
                    </span>
                  </div>
                  <div>
                    <span className="block text-2xl font-bold text-[#154734]">
                      4.92 / 5
                    </span>
                    <span className="text-xs text-neutral-500 font-normal">
                      Patient Rating
                    </span>
                  </div>
                  <div>
                    <span className="block text-2xl font-bold text-[#154734]">
                      15+ Mins
                    </span>
                    <span className="text-xs text-neutral-500 font-normal">
                      Dedicated Consult
                    </span>
                  </div>
                  <div>
                    <span className="block text-2xl font-bold text-[#154734]">
                      100%
                    </span>
                    <span className="text-xs text-neutral-500 font-normal">
                      Cashless Insurance
                    </span>
                  </div>
                </div>
              </div>

              {/* Department Action Box */}
              <div className="bg-[#fcfbf9] rounded-2xl p-6 border border-neutral-200/90 lg:max-w-xs w-full space-y-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-xl bg-[#154734] text-white flex items-center justify-center shrink-0">
                    <Building2 className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900">
                      OPD Consultations
                    </h4>
                    <p className="text-xs text-neutral-500">
                      Available Mon &ndash; Sat
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-neutral-600">
                  <div className="flex items-center gap-2">
                    <Clock className="size-3.5 text-neutral-400" />
                    <span>08:00 AM &ndash; 08:00 PM Daily</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="size-3.5 text-neutral-400" />
                    <span>KR Puram • Kaggadasapura • Koramangala</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <PhoneCall className="size-3.5 text-neutral-400" />
                    <span>Emergency Hotline: 99017 11716</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenBooking}
                  className="w-full py-3 px-4 rounded-xl bg-[#154734] hover:bg-[#1e6b4c] text-white font-bold text-sm transition shadow-xs active:scale-95 cursor-pointer text-center block"
                >
                  Book Department Visit
                </button>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              DEPARTMENT SPECIALIST DOCTORS ROSTER
             ════════════════════════════════════════════════════════════════ */}
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-neutral-200 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
                  Consulting Specialists in {currentDept.name}
                </h2>
                <p className="text-sm text-neutral-500 font-normal mt-1">
                  Full-time hospital consultants with verified credentials and fellowship certifications
                </p>
              </div>
              <span className="text-xs font-semibold text-neutral-400">
                {displayDoctors.length} Specialists Available
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayDoctors.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-2xl p-6 border border-neutral-200/90 shadow-xs hover:shadow-sm hover:border-[#154734]/40 transition-all flex flex-col justify-between space-y-5"
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={doc.image}
                      alt={doc.name}
                      className="size-20 sm:size-24 rounded-2xl object-cover object-top border border-neutral-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 mb-1">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        <span>{doc.rating}</span>
                        <span className="text-neutral-400 font-normal">
                          ({doc.reviewCount} verified reviews)
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-neutral-900 leading-snug">
                        {doc.name}
                      </h3>
                      <p className="text-xs text-[#154734] font-semibold mt-0.5 line-clamp-1">
                        {doc.title}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1 font-normal line-clamp-2">
                        {doc.bio}
                      </p>
                    </div>
                  </div>

                  {/* Qualifications & Availability Strip */}
                  <div className="space-y-2 pt-3 border-t border-neutral-100 text-xs text-neutral-600">
                    <div className="flex items-center gap-2">
                      <UserCheck className="size-3.5 text-[#154734] shrink-0" />
                      <span className="truncate">{doc.qualifications.join(' • ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="size-3.5 text-[#154734] shrink-0" />
                      <span>
                        Available: {doc.availableDays.join(', ')} ({doc.timeSlots[0]} &ndash; {doc.timeSlots[doc.timeSlots.length - 1]})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-[#154734] shrink-0" />
                      <span>{doc.roomNumber}</span>
                    </div>
                  </div>

                  {/* Pricing and Booking Action */}
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] text-neutral-400 block">
                        OPD Consultation Fee
                      </span>
                      <span className="text-base font-bold text-neutral-900">
                        ₹{doc.consultationFee}{' '}
                        <span className="text-xs font-normal text-neutral-500">
                          (7-day follow-up)
                        </span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onBookDoctor(doc.id, `Department of ${currentDept.name}`)}
                      className="px-5 py-2.5 rounded-xl bg-[#154734] hover:bg-[#1e6b4c] text-white font-bold text-xs sm:text-sm transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <Calendar className="size-4" />
                      <span>Book Slot</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              COMMON CLINICAL PROCEDURES & SERVICES
             ════════════════════════════════════════════════════════════════ */}
          <section className="bg-white rounded-3xl p-8 sm:p-10 border border-neutral-200/90 shadow-xs space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
                Core Procedures & Clinical Services
              </h2>
              <p className="text-sm text-neutral-500 font-normal mt-1">
                State-of-the-art diagnostic equipment and evidence-based clinical protocols in {currentDept.name}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {currentDept.commonProcedures.map((proc, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-[#fcfbf9] border border-neutral-200/80 space-y-2 hover:border-[#154734]/30 transition"
                >
                  <div className="size-8 rounded-lg bg-[#eef7f2] text-[#154734] flex items-center justify-center font-bold text-xs">
                    0{idx + 1}
                  </div>
                  <h4 className="text-sm font-bold text-neutral-900 leading-snug">
                    {proc}
                  </h4>
                  <p className="text-xs text-neutral-500 font-normal">
                    Performed by senior faculty with standardized pre- and post-procedure protocols.
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              EXPLORE ALL OTHER DEPARTMENTS
             ════════════════════════════════════════════════════════════════ */}
          <section className="space-y-4 pt-6">
            <h3 className="text-lg font-bold text-neutral-900">
              Other Specialized Departments at Sri Lakshmi
            </h3>
            <div className="flex flex-wrap gap-2">
              {departments
                .filter((d) => d.id !== currentDept.id)
                .map((dept) => (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => {
                      onSelectDepartment(dept.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-[#eef7f2] border border-neutral-200/90 hover:border-[#154734]/40 text-xs sm:text-sm font-semibold text-neutral-700 hover:text-[#154734] transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Activity className="size-3.5" />
                    <span>{dept.name}</span>
                  </button>
                ))}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <Footer
        onOpenBooking={onOpenBooking}
        onOpenLegal={onOpenLegal}
      />
    </div>
  );
};
