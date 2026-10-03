import React from 'react';

interface LightBlogReportsSectionProps {
  onOpenBlog?: () => void;
}

/** Latest From Avocado Health / Doctor Drafts section matching omw-website 1:1 layout with expanded page width. */
export const LightBlogReportsSection: React.FC<LightBlogReportsSectionProps> = ({ onOpenBlog }) => {
  return (
    <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16" id="blogs">
      <section className="block pt-31 max-lg:pt-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h1 className="block text-color-002 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif,_'Segoe_UI_Emoji',_'Segoe_UI_Symbol'] text-[2.75rem] font-medium leading-12 tracking-[-1.35px] [-webkit-text-stroke:0.001px_var(--clr-3)] max-md:text-[2rem] max-md:leading-[2.1875rem] max-md:tracking-[-0.69px]">
            The latest from our Physicians
          </h1>
          {onOpenBlog && (
            <button
              onClick={onOpenBlog}
              className="text-[#2d6545] hover:underline font-semibold text-sm sm:text-base inline-flex items-center gap-1.5 cursor-pointer pb-2 shrink-0"
            >
              <span>Explore Physician Articles & Guides</span>
              <span>&rarr;</span>
            </button>
          )}
        </div>
        <ul className="w-full grid relative pt-11 pb-19 gap-9 [list-style-type:none] list-outside max-md:py-7 max-md:gap-[initial] grid-cols-1 md:grid-cols-2">
          {/* Article 1 */}
          <li className="list-item">
            <div className="h-full block relative pb-9">
              <a className="h-full block relative rounded-xl font-medium cursor-pointer" href="#blogs">
                <div className="h-full flex flex-col justify-start items-start gap-5">
                  <div className="flex flex-col justify-start items-start gap-6 w-full">
                    <div className="w-full flex relative z-1 mb-[0.3125rem] rounded-xl justify-center items-center overflow-hidden bg-clr-23 aspect-[16/9]">
                      <img
                        className="w-full h-full block relative max-w-full overflow-clip object-cover"
                        alt="Cardiovascular Tele-Triage – Why Early At-Home Telemetry Saves Lives"
                        src="/images/cardiac_clinical_report.jpg"
                      />
                    </div>
                    <div className="w-full flex items-center gap-2.5 text-clr-24">
                      <p className="block text-[0.9375rem] font-normal leading-5.5 tracking-[-0.13px]">
                        Published 18 September, 2026
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-start items-start gap-2">
                    <h5 className="block text-color-002 text-[1.4375rem] leading-[1.5625rem] tracking-[-0.44px] [-webkit-text-stroke:0.001px_var(--clr-3)]">
                      Cardiovascular Tele-Triage – Why Early At-Home Telemetry Saves Lives
                    </h5>
                    <div className="overflow-hidden line-clamp-3">
                      <p className="block text-[1.0625rem] font-normal leading-6.5 tracking-[-0.22px] text-[#575554]">
                        Many cardiac emergencies show subtle resting rhythm anomalies weeks before acute symptoms. In this clinical report, our cardiologists evaluate ambulatory rhythm tracking, autonomic HRV trends, and how direct-to-physician digital telemetry reduces emergency admissions by 42%.
                      </p>
                    </div>
                  </div>
                </div>
              </a>
            </div>
          </li>

          {/* Article 2 */}
          <li className="list-item">
            <div className="block relative pb-9">
              <a className="block relative rounded-xl font-medium cursor-pointer" href="#blogs">
                <div className="flex flex-col justify-start items-start gap-5">
                  <div className="flex flex-col justify-start items-start gap-6 w-full">
                    <div className="w-full flex relative z-1 mb-[0.3125rem] rounded-xl justify-center items-center overflow-hidden bg-clr-23 aspect-[16/9]">
                      <img
                        className="w-full h-full block relative max-w-full overflow-clip object-cover"
                        alt="Robotic Navigation in Spinal Fusion – Micro-Incisions & Rapid Recovery"
                        src="/images/robotic_surgery_draft.jpg"
                      />
                    </div>
                    <div className="w-full flex items-center gap-2.5 text-clr-24">
                      <p className="block text-[0.9375rem] font-normal leading-5.5 tracking-[-0.13px]">
                        Published 2 September, 2026
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-start items-start gap-2">
                    <h5 className="block text-color-002 text-[1.4375rem] leading-[1.5625rem] tracking-[-0.44px] [-webkit-text-stroke:0.001px_var(--clr-3)]">
                      Robotic Navigation in Spinal Fusion – Micro-Incisions & Rapid Recovery
                    </h5>
                    <div className="overflow-hidden line-clamp-3">
                      <p className="block text-[1.0625rem] font-normal leading-6.5 tracking-[-0.22px] text-[#575554]">
                        Utilizing intraoperative 3D stereotactic guidance, robotic screw placement achieves sub-millimeter precision with minimal tissue dissection. This protocol enables same-day ambulation, preserves paraspinal musculature, and drastically curtails post-op recovery timelines.
                      </p>
                    </div>
                  </div>
                </div>
              </a>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
};
