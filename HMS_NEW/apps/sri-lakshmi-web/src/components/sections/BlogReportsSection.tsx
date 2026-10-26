import React from 'react';
import { BLOG_POSTS } from '../blog/blogData';

interface BlogReportsSectionProps {
  onOpenBlog?: () => void;
}

/** Latest From Sri Lakshmi Hospital / Doctor Drafts section matching omw-website 1:1 layout with expanded page width. */
export const BlogReportsSection: React.FC<BlogReportsSectionProps> = ({ onOpenBlog }) => {
  return (
    <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16" id="blogs">
      <section className="block pt-16 sm:pt-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h2 className="block text-color-002 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif,_'Segoe_UI_Emoji',_'Segoe_UI_Symbol'] text-[2.375rem] font-medium leading-tight tracking-[-1.1px] max-md:text-[2rem] max-md:tracking-[-0.69px]">
            Guides for the next step
          </h2>
          {onOpenBlog && (
            <button
              onClick={onOpenBlog}
              className="text-[#24553c] hover:underline font-semibold text-sm sm:text-base inline-flex items-center gap-1.5 cursor-pointer pb-2 shrink-0"
            >
              <span>Explore articles & guides</span>
              <span>&rarr;</span>
            </button>
          )}
        </div>
        <ul className="w-full grid relative pt-8 pb-14 gap-6 [list-style-type:none] list-outside grid-cols-1 md:grid-cols-2">
          {/* Article 1 */}
          <li className="list-item">
            <div className="h-full block relative">
              <a className="h-full block relative rounded-xl font-medium cursor-pointer" href={`/?page=blog-post&id=${BLOG_POSTS[0].id}`}>
                <div className="h-full flex flex-col justify-start items-start gap-5">
                  <div className="flex flex-col justify-start items-start gap-6 w-full">
                    <div className="w-full flex relative z-1 mb-[0.3125rem] rounded-xl justify-center items-center overflow-hidden bg-clr-23 aspect-[1.9]">
                      <img
                        className="w-full h-full block relative max-w-full overflow-clip object-cover"
                        alt="Doctor and patient discussing an appointment"
                        src="/clients/sri-lakshmi/0b3cc897-cardiology.png"
                      />
                    </div>
                    <div className="w-full flex items-center gap-2.5 text-clr-24">
                      <p className="block text-[0.9375rem] font-normal leading-5.5 tracking-[-0.13px]">
                        Editorial draft · {BLOG_POSTS[0].readingMinutes} min read
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-start items-start gap-2">
                    <h5 className="block text-color-002 text-[1.25rem] leading-[1.35] tracking-[-0.44px] [-webkit-text-stroke:0.001px_var(--clr-3)]">
                      {BLOG_POSTS[0].title}
                    </h5>
                    <div className="overflow-hidden line-clamp-2">
                      <p className="block text-[0.9375rem] font-normal leading-6 tracking-[-0.22px] text-[#575554]">
                        {BLOG_POSTS[0].excerpt}
                      </p>
                    </div>
                  </div>
                </div>
              </a>
            </div>
          </li>

          {/* Article 2 */}
          <li className="list-item">
            <div className="block relative">
              <a className="block relative rounded-xl font-medium cursor-pointer" href={`/?page=blog-post&id=${BLOG_POSTS[1].id}`}>
                <div className="flex flex-col justify-start items-start gap-5">
                  <div className="flex flex-col justify-start items-start gap-6 w-full">
                    <div className="w-full flex relative z-1 mb-[0.3125rem] rounded-xl justify-center items-center overflow-hidden bg-clr-23 aspect-[1.9]">
                      <img
                        className="w-full h-full block relative max-w-full overflow-clip object-cover"
                        alt="Clinician and patient reviewing care information"
                        src="/clients/sri-lakshmi/36f2a4cf-home-page-banner.png"
                      />
                    </div>
                    <div className="w-full flex items-center gap-2.5 text-clr-24">
                      <p className="block text-[0.9375rem] font-normal leading-5.5 tracking-[-0.13px]">
                        Editorial draft · {BLOG_POSTS[1].readingMinutes} min read
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-start items-start gap-2">
                    <h5 className="block text-color-002 text-[1.25rem] leading-[1.35] tracking-[-0.44px] [-webkit-text-stroke:0.001px_var(--clr-3)]">
                      {BLOG_POSTS[1].title}
                    </h5>
                    <div className="overflow-hidden line-clamp-2">
                      <p className="block text-[0.9375rem] font-normal leading-6 tracking-[-0.22px] text-[#575554]">
                        {BLOG_POSTS[1].excerpt}
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
