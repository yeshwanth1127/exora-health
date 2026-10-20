import React from 'react';
import { FileText } from 'lucide-react';
import { LEGAL_CATEGORIES, LEGAL_SUPPORT_ARTICLES } from './legalData';

interface LegalHubPageProps {
  onSelectDocument: (docId: string) => void;
  onBackToHome: () => void;
  onNavigateToFaq?: () => void;
}

export const LegalHubPage: React.FC<LegalHubPageProps> = ({
  onSelectDocument,
  onBackToHome,
  onNavigateToFaq,
}) => {
  const scrollToCategory = (categoryId: string) => {
    const el = document.getElementById(categoryId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-[#fcfbf9] text-[#121212] flex flex-col font-sans antialiased">

      {/* Main Content Area matching media_1790056080581.png */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 sm:px-8 pt-12 sm:pt-16 pb-24">
        {/* Title Block */}
        <div className="mb-12 sm:mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 leading-tight">
            Legal
          </h1>
          <p className="text-[15px] text-stone-400 mt-2 font-normal">
            Last updated 22 October 2024
          </p>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left Column: Categorized Policy Documents (8 cols) */}
          <div className="lg:col-span-8 space-y-12">
            {LEGAL_CATEGORIES.map((cat) => (
              <section key={cat.id} id={cat.id} className="scroll-mt-28">
                <h2 className="text-lg sm:text-xl font-bold text-stone-900 mb-2">
                  {cat.title}
                </h2>

                {/* Document List in Category */}
                <div className="divide-y divide-stone-200/80 border-b border-stone-200/80">
                  {cat.documents.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => onSelectDocument(doc.id)}
                      className="group py-4 flex items-center gap-3.5 cursor-pointer"
                    >
                      {/* Outline Document Icon */}
                      <FileText className="size-5 text-stone-400 group-hover:text-stone-900 transition-colors shrink-0 stroke-[1.5]" />

                      {/* Document Details */}
                      <div>
                        <h3 className="text-[15px] sm:text-base font-semibold text-stone-900 group-hover:text-[#154734] transition-colors leading-snug">
                          {doc.title}
                        </h3>
                        <p className="text-xs sm:text-[13px] text-stone-400 mt-0.5 font-normal">
                          Last updates on {doc.lastUpdated}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Right Column: Flat Links Sidebar (4 cols) */}
          <aside className="lg:col-span-4 space-y-10 lg:sticky lg:top-28">
            {/* SECTIONS */}
            <div>
              <h3 className="text-xs font-bold text-stone-900 tracking-wider uppercase mb-3">
                SECTIONS
              </h3>
              <ul className="space-y-2.5">
                {LEGAL_CATEGORIES.map((cat) => (
                  <li key={cat.id}>
                    <button
                      onClick={() => scrollToCategory(cat.id)}
                      className="text-[14px] sm:text-[15px] text-[#154734] hover:underline font-normal text-left cursor-pointer transition-colors block"
                    >
                      {cat.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* SUPPORT ARTICLES */}
            <div>
              <h3 className="text-xs font-bold text-stone-900 tracking-wider uppercase mb-3">
                SUPPORT ARTICLES
              </h3>
              <ul className="space-y-2.5">
                {LEGAL_SUPPORT_ARTICLES.map((article) => (
                  <li key={article.id}>
                    <button
                      onClick={() => {
                        if (onNavigateToFaq) onNavigateToFaq();
                        else onBackToHome();
                      }}
                      className="text-[14px] sm:text-[15px] text-[#154734] hover:underline font-normal text-left cursor-pointer transition-colors block"
                    >
                      {article.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};
