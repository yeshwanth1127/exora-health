import React, { useState } from 'react';
import { BLOG_POSTS, BlogPost } from './blogData';
import { ArrowLeft, Check, Link2, Mail } from 'lucide-react';

interface FamilyBlogPostPageProps {
  postId?: string;
  onBackToBlog: () => void;
  onBackToHome?: () => void;
}

export const FamilyBlogPostPage: React.FC<FamilyBlogPostPageProps> = ({
  postId = 'fragmented-healthcare-problem',
  onBackToBlog,
  onBackToHome,
}) => {
  const [copied, setCopied] = useState(false);
  const [textCopied, setTextCopied] = useState(false);

  const post: BlogPost =
    BLOG_POSTS.find((p) => p.id === postId) || BLOG_POSTS[0];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyText = () => {
    const allText = `${post.title}\n\n${post.sections
      .map((s) => `${s.heading ? `${s.heading}\n` : ''}${s.paragraphs.join('\n\n')}`)
      .join('\n\n')}`;
    navigator.clipboard.writeText(allText);
    setTextCopied(true);
    setTimeout(() => setTextCopied(false), 2000);
  };

  return (
    <div className="bg-[#fcfbf9] text-[#121212] [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif]">

      {/* Article Container matching layout 1:1 */}
      <main className="max-w-[820px] mx-auto px-6 pt-14 pb-24">
        {/* Back link */}
        <button
          onClick={onBackToBlog}
          className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-950 text-sm font-medium mb-8 transition cursor-pointer"
        >
          <ArrowLeft className="size-4" /> Back to Articles
        </button>

        {/* Article Meta Header */}
        <div className="text-[14px] text-stone-500 font-normal mb-4 select-none">
          {post.date} by <span className="text-stone-900 font-medium">{post.author}</span> / {post.tags.join(', ')}
        </div>
        <p className="mb-7 border-l-2 border-[#6b9876] pl-4 text-sm text-[#4f6756]">Draft article. This article has not been medically reviewed yet.</p>

        {/* Main H1 Title */}
        <h1 className="text-3xl sm:text-[42px] font-bold text-stone-950 leading-[1.18] tracking-tight mb-12">
          {post.title}
        </h1>

        {/* Article Body Content */}
        <article className="prose prose-stone max-w-none text-[#27272A]">
          {post.sections.map((sec, idx) => (
            <div key={idx} className="mb-10">
              {sec.heading && (
                <h2 className="text-[22px] sm:text-[24px] font-bold text-stone-950 leading-snug tracking-tight mb-5">
                  {sec.heading}
                </h2>
              )}
              {sec.paragraphs.map((p, pIdx) => (
                <p
                  key={pIdx}
                  className="text-[16px] sm:text-[17px] leading-[1.68] text-stone-700 mb-6 font-normal"
                >
                  {p}
                </p>
              ))}
            </div>
          ))}
        </article>

        {/* Divider */}
        <hr className="my-14 border-stone-200" />

        {/* Share & About Sections (Matching layout 1:1 with authentic clinic info) */}
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-10 sm:gap-14 pt-2">
          {/* Left Column: Share Article & Resources */}
          <div className="flex flex-col gap-8">
            {/* Share Article */}
            <div>
              <h4 className="text-[14px] font-bold text-stone-900 mb-3 select-none">
                Share Article
              </h4>
              <div className="flex items-center gap-3 text-stone-600">
                {/* Facebook */}
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-stone-950 transition"
                  aria-label="Share on Facebook"
                >
                  <svg className="size-4.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95C18.05 21.45 22 17.19 22 12Z" />
                  </svg>
                </a>

                {/* X */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-stone-950 transition"
                  aria-label="Share on X"
                >
                  <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>

                {/* Mail */}
                <a
                  href={`mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(window.location.href)}`}
                  className="hover:text-stone-950 transition"
                  aria-label="Share by Email"
                >
                  <Mail className="size-4.5" />
                </a>

                {/* Copy Link */}
                <button
                  onClick={handleCopyLink}
                  className="hover:text-stone-950 transition cursor-pointer relative"
                  aria-label="Copy link"
                >
                  {copied ? <Check className="size-4.5 text-emerald-600" /> : <Link2 className="size-4.5" />}
                  {copied && (
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black text-white text-[11px] px-2 py-0.5 rounded shadow whitespace-nowrap">
                      Copied!
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Resources: Aa Copy Text */}
            <div>
              <h4 className="text-[14px] font-bold text-stone-900 mb-3 select-none">
                Resources
              </h4>
              <button
                onClick={handleCopyText}
                className="inline-flex items-center gap-2 text-[14px] text-stone-700 hover:text-stone-950 transition cursor-pointer"
              >
                <span className="font-serif font-bold text-base">Aa</span>
                <span>{textCopied ? 'Text Copied!' : 'Copy Text'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: About Avocado Health & About Clinical Network */}
          <div className="flex flex-col gap-6">
            <div>
              <h4 className="text-[14px] font-bold text-stone-900 mb-2">
                About Avocado Health
              </h4>
              <p className="text-[14px] text-stone-600 leading-relaxed">
                Avocado Health is Bengaluru’s premier multispecialty clinical network, combining state-of-the-art diagnostic laboratories, day-surgery suites, and proactive family physician memberships across Indiranagar, Koramangala, Whitefield, and HSR Layout.
              </p>
            </div>

            <div>
              <h4 className="text-[14px] font-bold text-stone-900 mb-2">
                About Avocado Care Network
              </h4>
              <p className="text-[14px] text-stone-600 leading-relaxed">
                Founded by leading cardiologists and health technologists, Avocado Care Network operates NABH-accredited outpatient centers, automated pathology processing, and emergency pediatric rapid-response units. Our mission is patient-centered healthcare delivered with transparency and dignity.
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <hr className="my-14 border-stone-200" />

        {/* Bottom Banner: "Want to stay updated? Stay Updated >" */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 py-4">
          <div className="max-w-[480px]">
            <h3 className="text-xl sm:text-2xl font-bold text-stone-950 mb-2">
              Want to stay updated on family health?
            </h3>
            <p className="text-[14px] sm:text-[15px] text-stone-600 leading-relaxed">
              Medical science and wellness guidelines are constantly evolving. Subscribe to our monthly clinical health dispatch and preventative care research.
            </p>
          </div>

          <button
            onClick={() => alert('Thank you for subscribing to Avocado Health Medical Dispatch!')}
            className="inline-flex items-center gap-2 bg-black hover:bg-stone-800 text-white font-medium text-[14px] px-5 py-2.5 rounded-full transition shadow-xs shrink-0 cursor-pointer"
          >
            <span>Subscribe to Dispatch</span>
            <span className="text-xs">&gt;</span>
          </button>
        </div>

        {/* Return to hospital link */}
        <div className="mt-16 pt-6 border-t border-stone-100 flex items-center justify-between text-stone-500 text-sm">
          <button
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-stone-900 hover:underline font-medium cursor-pointer"
          >
            <ArrowLeft className="size-4" /> Back to Hospital Home
          </button>
          <span>&copy; {new Date().getFullYear()} Avocado Health, Inc. Bengaluru, Karnataka.</span>
        </div>
      </main>
    </div>
  );
};
