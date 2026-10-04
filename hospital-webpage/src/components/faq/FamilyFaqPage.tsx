import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { CLINIC_FAQS } from './faqData';

interface FamilyFaqPageProps {
  onBackToHome?: () => void;
}

export const FamilyFaqPage: React.FC<FamilyFaqPageProps> = ({
  onBackToHome,
}) => {
  const [openIndices, setOpenIndices] = useState<number[]>([]);

  const toggleIndex = (index: number) => {
    setOpenIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="bg-[#fcfbf9] text-[#121212] [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif]">

      {/* Main FAQ Content matching layout 1:1 */}
      <main className="max-w-[760px] mx-auto px-6 py-14 sm:py-20">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-950">
              Frequently Asked Questions
            </h1>
            <p className="text-stone-500 mt-2 text-[15px]">
              Everything you need to know about our clinics, physician appointments, insurance, and patient care.
            </p>
          </div>
        </div>

        {/* 1:1 Accordion List */}
        <div className="w-full flex flex-col">
          {CLINIC_FAQS.map((item, idx) => {
            const isOpen = openIndices.includes(idx);
            return (
              <div
                key={idx}
                className="border-b border-stone-200/80 transition-colors"
              >
                <button
                  onClick={() => toggleIndex(idx)}
                  className="w-full py-5 sm:py-6 flex items-start gap-4 text-left group cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="relative size-4 mt-0.5 shrink-0 flex items-center justify-center text-[#24553c]">
                    {/* Horizontal bar */}
                    <span className="w-3.5 h-[2px] bg-[#24553c] rounded-full absolute" />
                    {/* Vertical bar (transitions to minus on open) */}
                    <motion.span
                      initial={false}
                      animate={{ scaleY: isOpen ? 0 : 1, opacity: isOpen ? 0 : 1 }}
                      transition={{ duration: 0.18 }}
                      className="w-[2px] h-3.5 bg-[#24553c] rounded-full absolute origin-center"
                    />
                  </span>

                  {/* Question text */}
                  <span className="text-[16px] sm:text-[17px] font-semibold text-stone-900 group-hover:text-black leading-snug tracking-tight">
                    {item.question}
                  </span>
                </button>

                {/* Animated Answer */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="pl-8 pb-6 pr-4 text-[15px] leading-relaxed text-stone-600 font-normal">
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Back navigation & Contact help */}
        <div className="mt-14 pt-8 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-stone-500 text-sm">
          <button
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-stone-900 hover:underline font-medium cursor-pointer"
          >
            <ArrowLeft className="size-4" /> Back to Hospital Home
          </button>
          <span>
            Still have questions?{' '}
            <a
              href="mailto:lakshmihospital@yahoo.co.in"
              className="text-stone-900 font-medium hover:underline inline-flex items-center gap-1"
            >
              Contact Patient Concierge <ExternalLink className="size-3" />
            </a>
          </span>
        </div>
      </main>
    </div>
  );
};
