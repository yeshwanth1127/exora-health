import React, { useState, useEffect } from 'react';
import { ALL_LEGAL_DOCS, TERMS_OF_SERVICE_DOC } from './legalData';

interface LegalDocumentPageProps {
  documentId?: string;
  onBackToLegalHub: () => void;
}

export const LegalDocumentPage: React.FC<LegalDocumentPageProps> = ({
  documentId = 'terms',
  onBackToLegalHub,
}) => {
  const doc = ALL_LEGAL_DOCS[documentId] || TERMS_OF_SERVICE_DOC;
  const [activeSectionId, setActiveSectionId] = useState<string>(doc.sections[0]?.id || '');

  // Scrollspy to highlight active Table of Contents item matching reference
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 160;
      for (let i = doc.sections.length - 1; i >= 0; i--) {
        const section = doc.sections[i];
        const el = document.getElementById(section.id);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSectionId(section.id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [doc]);

  const scrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      const headerOffset = 90;
      const elementPosition = el.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - headerOffset,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="bg-[#fcfbf9] text-[#121212] flex flex-col font-sans antialiased">

      {/* Main Document Content Area matching media_1790056075025.png & media_1790056080585.png */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 sm:px-8 pt-12 sm:pt-16 pb-28">
        {/* Document Header */}
        <div className="mb-10 sm:mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 leading-tight">
            {doc.title}
          </h1>
          <p className="text-[15px] text-stone-400 mt-2 font-normal">
            Last Updated {doc.lastUpdated}
          </p>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left Column: Document Body (8 cols) */}
          <div className="lg:col-span-8 space-y-6 text-[15px] sm:text-base text-stone-600 leading-relaxed font-normal">
            {/* Intro Paragraphs */}
            {doc.introParagraphs.map((para, idx) => (
              <p key={idx} className="leading-relaxed">
                {para}
              </p>
            ))}

            {/* Notice block matching media_1790056075025.png */}
            {doc.emergencyNotice && (
              <p className="text-[13px] sm:text-sm font-bold text-stone-700 tracking-wide uppercase leading-relaxed pt-2">
                {doc.emergencyNotice}
              </p>
            )}

            {/* Document Sections */}
            <div className="space-y-12 pt-6">
              {doc.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-28 space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight leading-snug">
                    {section.title}
                  </h2>

                  <div className="space-y-4 text-stone-600">
                    {section.content.map((paragraph, pIdx) => (
                      <p key={pIdx} className="leading-relaxed whitespace-pre-line">
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  {/* Subsections matching media_1790056080585.png */}
                  {section.subsections && section.subsections.length > 0 && (
                    <div className="mt-8 space-y-6">
                      {section.subsections.map((sub, sIdx) => (
                        <div key={sIdx} className="space-y-2">
                          <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
                            {sub.subtitle}
                          </h3>
                          <p className="text-[15px] text-stone-600 leading-relaxed">
                            {sub.text}
                          </p>
                          {sub.bulletPoints && (
                            <ul className="list-disc list-inside space-y-1 text-[14px] text-stone-600 pt-1">
                              {sub.bulletPoints.map((point, ptIdx) => (
                                <li key={ptIdx}>{point}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* Back to Legal Hub link */}
            <div className="pt-12 mt-12 border-t border-stone-100 flex items-center justify-between text-sm">
              <button
                onClick={onBackToLegalHub}
                className="text-[#154734] hover:underline font-normal cursor-pointer flex items-center gap-1.5"
              >
                <span>&larr; Back to Legal</span>
              </button>
              <span className="text-stone-400 text-xs font-normal">
                Avocado Health Clinics Pvt. Ltd. &copy; 2025
              </span>
            </div>
          </div>

          {/* Right Column: Sticky Table of Contents (4 cols) matching media_1790056075025.png */}
          <aside className="lg:col-span-4 lg:sticky lg:top-28">
            <nav aria-label="Table of contents">
              <ul className="space-y-2.5 max-h-[calc(100vh-140px)] overflow-y-auto pr-2">
                {doc.sections.map((section) => {
                  const isActive = activeSectionId === section.id;
                  const label = section.shortTitle || `${section.title}.`;
                  return (
                    <li key={section.id}>
                      <button
                        onClick={() => scrollToSection(section.id)}
                        className={`w-full text-left text-[14px] leading-snug transition-colors cursor-pointer block ${
                          isActive
                            ? 'font-bold text-stone-900'
                            : 'font-normal text-stone-400 hover:text-stone-700'
                        }`}
                      >
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>
        </div>
      </main>
    </div>
  );
};
