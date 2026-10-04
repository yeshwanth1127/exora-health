import React, { useState } from 'react';
import { FAMILY_FAQS } from '../faq/faqData';

const HEALTHCARE_QUESTIONS = [
  {
    question: "How do virtual telehealth consultations work?",
    answer:
      "Video visits are listed for some doctors. Confirm whether they are available for your concern, how you will join, and what technology you need before planning a visit."
  },
  {
    question: "Can prescriptions be sent directly to my local pharmacy?",
    answer:
      "Prescriptions are not filled online. Ask the clinician or clinic how a prescription would be issued and where it can be filled."
  },
  {
    question: "How does the 24/7 WhatsApp consultation & emergency desk work?",
    answer:
      "Do not use the website or WhatsApp widget for urgent care. For a medical emergency, contact local emergency services or visit the nearest emergency department."
  },
  {
    question: "What health insurance plans and payment methods do you accept?",
    answer:
      "Coverage and payment options are not verified online. Confirm eligibility, expected charges, and payment methods directly with the clinic and insurer."
  }
];

interface FAQSectionProps {
  onOpenFullFaq?: () => void;
}

export const FAQSection: React.FC<FAQSectionProps> = ({ onOpenFullFaq }) => {
  const [activeTab, setActiveTab] = useState<'healthcare' | 'family'>('family');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const currentQuestions = activeTab === 'family' ? FAMILY_FAQS : HEALTHCARE_QUESTIONS;

  const toggleQuestion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16" id="faq">
      <section className="grid pt-24 pb-24 grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-12 lg:gap-20">
        <div>
          <h2 className="block text-color-002 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif,_'Segoe_UI_Emoji',_'Segoe_UI_Symbol'] text-[2.75rem] font-medium leading-12 tracking-[-1.35px] [-webkit-text-stroke:0.001px_var(--clr-3)] max-md:text-[2rem] max-md:leading-[2.1875rem] max-md:tracking-[-0.69px]">
            Frequently Asked Questions
          </h2>

          {/* Toggle between Sri Lakshmi Clinic FAQ and Hospital & Insurance FAQ */}
          <div className="flex items-center gap-2 mt-6 p-1 bg-stone-200/60 rounded-full w-fit">
            <button
              onClick={() => {
                setActiveTab('family');
                setOpenIndex(0);
              }}
              className={`px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                activeTab === 'family'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-950'
              }`}
            >
              Sri Lakshmi Clinic FAQ
            </button>
            <button
              onClick={() => {
                setActiveTab('healthcare');
                setOpenIndex(0);
              }}
              className={`px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                activeTab === 'healthcare'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-950'
              }`}
            >
              Hospital & Insurance FAQ
            </button>
          </div>

          {onOpenFullFaq && (
            <button
              onClick={onOpenFullFaq}
              className="mt-6 text-sm text-[#24553c] hover:underline font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              Open dedicated full-screen FAQ guide &rarr;
            </button>
          )}
        </div>
        
        <div className="flex flex-col items-start w-full">
          <div className="block w-full">
            {currentQuestions.map((item, index) => {
              const answerId = `hospital-faq-answer-${index}`;
              const isOpen = openIndex === index;

              return (
                <div
                  key={`${activeTab}-${index}`}
                  className="border-b border-solid border-[#e5e2dc] flex mb-7 pb-7 justify-start items-start gap-5 w-full"
                >
                  <button
                    type="button"
                    className="relative w-3.5 h-3.5 flex mt-[0.375rem] items-center justify-center shrink-0 text-[#24553c] cursor-pointer"
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    aria-label={`${isOpen ? "Close" : "Open"} ${item.question}`}
                    onClick={() => toggleQuestion(index)}
                  >
                    <div className="w-3.5 h-[2px] block absolute rounded-xs bg-[#24553c]" />
                    <div
                      className={`w-[2px] h-3.5 block absolute rounded-xs bg-[#24553c] origin-center transition-transform duration-200 ${
                        isOpen ? 'scale-y-0' : 'scale-y-100'
                      }`}
                    />
                  </button>

                  <div className="block flex-1">
                    <button
                      type="button"
                      className="block text-clr-1 cursor-pointer text-left w-full group"
                      aria-expanded={isOpen}
                      aria-controls={answerId}
                      onClick={() => toggleQuestion(index)}
                    >
                      <h4 className="block text-color-002 text-[1.1875rem] font-medium leading-[1.6875rem] tracking-[-0.3px] group-hover:text-black transition">
                        {item.question}
                      </h4>
                    </button>
                    <div
                      id={answerId}
                      aria-hidden={!isOpen}
                      className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
                        isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="block pt-3 text-[#575554]">
                        <p className="block text-[1.0625rem] leading-6.5 tracking-[-0.22px]">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-2">
            {onOpenFullFaq && (
              <button
                type="button"
                onClick={onOpenFullFaq}
                className="h-9 inline-flex items-center gap-2 text-[#24553c] text-[1.0625rem] font-medium tracking-[-0.44px] hover:translate-x-1 transition-transform cursor-pointer"
              >
                <span>View All 8 Clinic FAQs</span>
                <svg className="w-auto h-[0.9375rem] block max-w-full ml-0.5 overflow-hidden" fill="none" height="15" viewBox="0 0 18 15" width="18" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M9.94417 0.373474L17.2534 7.49997L9.94417 14.6265L8.7225 13.3735L13.8492 8.37497H0L0 6.62497L13.8492 6.62497L8.7225 1.62647L9.94417 0.373474Z" fill="currentColor" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
