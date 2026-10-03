import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { TRIAGE_DATA } from './aiTriageData';

interface CareQuestionnaireModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSpecialtyId?: string;
  initialQuery?: string;
  dateTime?: string;
  onNavigateToResults: (params: { careType: string; specialtyId?: string; dateTime?: string }) => void;
}

export const AICareAssistantModal: React.FC<CareQuestionnaireModalProps> = ({
  isOpen,
  onClose,
  initialSpecialtyId,
  dateTime,
  onNavigateToResults,
}) => {
  // Step 1 = "What type of care are you looking for?"
  // Step 2 = Specific condition / concern questions for that care need
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>('ent');

  // Prevent background scrolling while questionnaire is open, and handle Escape
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (initialSpecialtyId) {
        setSelectedSpecialtyId(initialSpecialtyId);
        setStep(2);
      } else {
        setStep(1);
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, initialSpecialtyId, onClose]);

  if (!isOpen) return null;

  const currentTriage = TRIAGE_DATA[selectedSpecialtyId] || TRIAGE_DATA.ent;

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto flex flex-col justify-between select-none">
      <div className="relative w-full min-h-screen bg-white flex flex-col justify-between">
        {/* ── Top Header matching media_1790064883413.png EXACTLY ── */}
        <header className="w-full max-w-5xl mx-auto px-6 py-6 sm:py-8 flex items-center justify-between">
          {/* Left: Back button on step 2, empty spacer on step 1 */}
          <div className="w-24">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-stone-900 transition cursor-pointer"
              >
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </button>
            )}
          </div>

          {/* Center: Thin Progress Bar */}
          <div className="flex-1 max-w-md mx-auto px-4">
            <div className="w-full h-1 bg-[#eef7f2] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#154734] transition-all duration-300 rounded-full"
                style={{ width: step === 1 ? '50%' : '100%' }}
              />
            </div>
          </div>

          {/* Right: Skip to search results link */}
          <div className="w-36 text-right">
            <button
              type="button"
              onClick={() =>
                onNavigateToResults({
                  careType: 'General Healthcare',
                  specialtyId: undefined,
                  dateTime,
                })
              }
              className="text-sm font-medium text-stone-700 hover:text-stone-900 transition cursor-pointer whitespace-nowrap"
            >
              Skip to search results
            </button>
          </div>
        </header>

        {/* ── MAIN QUESTIONNAIRE BODY matching media_1790064883413.png ── */}
        <main className="flex-1 w-full max-w-xl mx-auto px-6 pt-8 sm:pt-14 pb-20 flex flex-col justify-start">
          {/* ════════════════════════════════════════════════════════════════
              STEP 1: EXACT REPLICA OF media_1790064883413.png
             ════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-8 sm:space-y-10">
              <h1 className="text-2xl sm:text-[28px] font-bold text-stone-900 text-center tracking-tight leading-snug">
                What type of care are you looking for?
              </h1>

              <div className="space-y-4">
                {/* Option 1: Annual physical / checkup */}
                <button
                  type="button"
                  onClick={() =>
                    onNavigateToResults({
                      careType: 'Annual physical / checkup',
                      specialtyId: 'general-medicine',
                      dateTime,
                    })
                  }
                  className="w-full text-left p-5 sm:p-6 rounded-2xl border border-stone-200 bg-white hover:border-stone-400 hover:shadow-xs transition-all cursor-pointer group"
                >
                  <h2 className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-[#154734] transition-colors">
                    Annual physical / checkup
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-500 mt-1 font-normal leading-relaxed">
                    Comprehensive preventative examination to assess overall health
                  </p>
                </button>

                {/* Option 2: I need care for an issue, condition or problem */}
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full text-left p-5 sm:p-6 rounded-2xl border border-stone-200 bg-white hover:border-stone-400 hover:shadow-xs transition-all cursor-pointer group"
                >
                  <h2 className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-[#154734] transition-colors">
                    I need care for an issue, condition or problem
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-500 mt-1 font-normal leading-relaxed">
                    Find treatment for a new issue or ongoing care for a diagnosed condition
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              STEP 2: CONDITION / SPECIALTY SPECIFIC CARDS
             ════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-8 sm:space-y-10 animate-fadeIn">
              <h1 className="text-2xl sm:text-[28px] font-bold text-stone-900 text-center tracking-tight leading-snug">
                Why are you looking for an {currentTriage.name.toLowerCase()} doctor?
              </h1>

              <div className="space-y-3">
                {currentTriage.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      onNavigateToResults({
                        careType: opt.title,
                        specialtyId: selectedSpecialtyId,
                        dateTime,
                      })
                    }
                    className="w-full text-left p-5 rounded-2xl border border-stone-200 bg-white hover:border-stone-400 hover:shadow-xs transition-all cursor-pointer group"
                  >
                    <h2 className="text-base font-bold text-stone-900 group-hover:text-[#154734] transition-colors">
                      {opt.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-500 mt-1 font-normal leading-relaxed">
                      {opt.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export const CareQuestionnaireModal = AICareAssistantModal;
