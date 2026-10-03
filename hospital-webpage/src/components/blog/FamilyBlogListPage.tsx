import React, { useState } from 'react';
import { BLOG_POSTS, BlogPost } from './blogData';
import { ArrowLeft } from 'lucide-react';

interface FamilyBlogListPageProps {
  onSelectPost: (postId: string) => void;
  onBackToHome?: () => void;
}

export const FamilyBlogListPage: React.FC<FamilyBlogListPageProps> = ({
  onSelectPost,
  onBackToHome,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('All');

  // Extract all unique tags
  const allTags = ['All', 'Clinical Care', 'Preventive Health', 'Diagnostics'];

  const filteredPosts = BLOG_POSTS.filter((post) => {
    if (activeFilter === 'All') return true;
    return post.tags.includes(activeFilter);
  });

  return (
    <div className="bg-[#fcfbf9] text-[#121212] [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif]">

      {/* Main Blog List matching layout 1:1 */}
      <main className="max-w-[1100px] mx-auto px-6 py-14 sm:py-20">
        {/* Header with Title & Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-12">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-950">
              Clinical Blog & Insights
            </h1>
            <p className="text-stone-500 mt-2 text-[15px]">
              The latest medical research, physician drafts, and wellness guides from Avocado Health
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {allTags.map((filter) => {
              const isSelected = activeFilter === filter;
              return (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#E5E7EB] text-stone-900 font-semibold shadow-2xs'
                      : 'bg-[#f6f4ef] text-stone-600 hover:bg-[#ECECF0] hover:text-stone-900'
                  }`}
                >
                  {filter}
                </button>
              );
            })}
          </div>
        </div>

        {/* 1:1 Blog Rows List */}
        <div className="w-full flex flex-col">
          {filteredPosts.map((post: BlogPost, index: number) => (
            <article
              key={post.id}
              onClick={() => onSelectPost(post.id)}
              className={`w-full py-10 sm:py-14 grid grid-cols-1 md:grid-cols-[140px_1fr_1.3fr] gap-4 md:gap-8 items-start cursor-pointer group transition-colors ${
                index !== filteredPosts.length - 1 ? 'border-b border-stone-200/80' : ''
              }`}
            >
              {/* Column 1: Date */}
              <div className="text-[14px] text-stone-500 font-normal select-none pt-0.5">
                {post.date}
              </div>

              {/* Column 2: Title & Tags */}
              <div className="flex flex-col pr-4">
                <h2 className="text-[19px] sm:text-[20px] font-bold text-stone-900 group-hover:text-black group-hover:underline leading-snug tracking-tight">
                  {post.title}
                </h2>
                <div className="text-[13px] text-stone-500 mt-2 font-normal">
                  {post.tags.join(', ')}
                </div>
              </div>

              {/* Column 3: Excerpt preview */}
              <div className="text-[14px] sm:text-[15px] text-stone-600 leading-relaxed font-normal">
                {post.excerpt}
              </div>
            </article>
          ))}
        </div>

        {/* Footer link to Hospital Home */}
        <div className="mt-16 pt-8 border-t border-stone-100 flex items-center justify-between text-stone-500 text-sm">
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
