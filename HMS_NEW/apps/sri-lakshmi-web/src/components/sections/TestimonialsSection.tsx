import React, { useState, useRef, useEffect } from 'react';
import { Play, Star } from 'lucide-react';

// Option 1: X (Twitter) Community Testimonials
interface PatientTestimonial {
  name: string;
  handle: string;
  avatar: string;
  text: string;
}

const patientTestimonials: PatientTestimonial[] = [
  {
    "name": "Emergency care",
    "handle": "Hospital website information",
    "avatar": "/clients/sri-lakshmi/f8fcf782-emergency-care.png",
    "text": "The hospital lists emergency and trauma services as available 24/7."
  },
  {
    "name": "Dialysis unit",
    "handle": "Hospital website information",
    "avatar": "/clients/sri-lakshmi/c3c3d54f-1-8.png",
    "text": "The facilities page lists a 10-bed dialysis unit."
  },
  {
    "name": "Founded in 2002",
    "handle": "Hospital website information",
    "avatar": "/clients/sri-lakshmi/f22f9b39-1-1.png",
    "text": "Dr. Sambashiva founded the KR Puram hospital in 2002, according to its About Us page."
  },
  {
    "name": "Intensive care",
    "handle": "Hospital website information",
    "avatar": "/clients/sri-lakshmi/81a4ec5b-1-9.png",
    "text": "The facilities page lists a 10-bed intensive care unit."
  },
  {
    "name": "Hospital pharmacy",
    "handle": "Hospital website information",
    "avatar": "/clients/sri-lakshmi/13214f3a-6-6.png",
    "text": "The hospital lists a pharmacy open around the clock."
  },
  {
    "name": "Cardiac cathlab",
    "handle": "Hospital website information",
    "avatar": "/clients/sri-lakshmi/aada937b-1-3.png",
    "text": "The hospital describes its Philips FD10 cardiac cathlab."
  }
];

// Option 2: Real patient voices. Reviews are quoted as written (names shortened) from the
// hospital's Google listing and the Google review widget on slsshospitals.com, checked
// 4 Oct 2026. Videos are from the hospital's own YouTube channel (see data/clientMedia.ts).
export type StoryType = 'photo' | 'quote' | 'video';

export interface ClinicalStory {
  id: string;
  type: StoryType;
  patientName: string;
  procedure: string;
  quote: string;
  image?: string;
  videoId?: string;
}

const CLINICAL_STORIES: ClinicalStory[] = [
  {
    id: 'video-founder',
    type: 'video',
    patientName: 'Dr. Sambashiva AC',
    procedure: 'OUR STORY',
    quote: 'The founder introduces the Sri Lakshmi Group of Hospitals.',
    videoId: '3HTtj5NBA4w',
  },
  {
    id: 'review-cardiac',
    type: 'photo',
    patientName: 'Murthy D.',
    procedure: 'HEART CARE',
    quote: '“My brother was admitted for cardiac issues. All doctors and staff reacted immediately and today he is safe.”',
    image: '/clients/sri-lakshmi/aada937b-1-3.png',
  },
  {
    id: 'review-hysterectomy',
    type: 'quote',
    patientName: 'Ashok N.',
    procedure: 'LAP HYSTERECTOMY',
    quote: '“Doctors and staffs are well friendly. Cashless facility is hassle free. The team is very much supportive.”',
  },
  {
    id: 'video-kidney',
    type: 'video',
    patientName: 'Dr. Manjunath S',
    procedure: 'UROLOGY',
    quote: 'Understanding kidney stone treatment.',
    videoId: '4jvl0J9NKpY',
  },
  {
    id: 'review-surgery',
    type: 'photo',
    patientName: 'Manju S.',
    procedure: 'SURGERY',
    quote: '“Admitted my mother for Surgery. The hospital staff has supported us very friendly. The cashless team was very good.”',
    image: '/clients/sri-lakshmi/c3c3d54f-1-8.png',
  },
  {
    id: 'review-front-desk',
    type: 'quote',
    patientName: 'Prakruthi N.',
    procedure: 'PATIENT CARE',
    quote: '“From the moment I arrived, the front desk people are very friendly and they took initiative and explained very well.”',
  },
  {
    id: 'video-joints',
    type: 'video',
    patientName: 'Dr. G Krishna Naresh Goud',
    procedure: 'ORTHOPAEDICS',
    quote: 'Arthroscopy and joint replacement, explained.',
    videoId: 'uT4a9oMj8dU',
  },
  {
    id: 'review-team',
    type: 'quote',
    patientName: 'Suresh F.',
    procedure: 'INPATIENT CARE',
    quote: '“All the services was very gud in this hospital. All doctors and staff coordinated very well. Thank you for entire team.”',
  },
];

const ReviewSource: React.FC = () => (
  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#121212]/60">
    <span className="flex text-[#e3a008]" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }, (_, i) => <Star key={i} className="size-3.5 fill-current" aria-hidden="true" />)}
    </span>
    Google review
  </div>
);

// Sub-component for Photo Story Card (Clean, crisp, no shadow or murky gradient)
const PhotoStoryCard: React.FC<{ story: ClinicalStory }> = ({ story }) => {
  return (
    <div className="group relative w-[310px] sm:w-[350px] md:w-[370px] h-[460px] sm:h-[490px] shrink-0 rounded-[26px] bg-[#f4eee3] border border-[#ded6c7] overflow-hidden flex flex-col justify-between select-none">
      {/* Hospital photo (not the reviewer) */}
      <div className="relative h-[220px] sm:h-[240px] w-full overflow-hidden bg-[#ebe4d6]">
        <img
          src={story.image}
          alt=""
          className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-103"
          loading="lazy"
        />
      </div>

      <div className="p-6 sm:p-7 flex flex-col justify-between flex-1">
        <ReviewSource />
        <blockquote className="mt-3 text-[1.02rem] sm:text-[1.08rem] leading-[1.4] font-normal text-[#121212] [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_Arial,_sans-serif] tracking-[-0.3px] mb-4 line-clamp-4">
          {story.quote}
        </blockquote>

        <div className="flex items-end justify-between pt-3 border-t border-[#121212]/10 mt-auto">
          <div className="text-[11px] sm:text-xs font-semibold tracking-wider text-[#121212] uppercase leading-tight">
            {story.patientName}
          </div>
          <div className="text-[11px] sm:text-xs font-bold tracking-wider text-[#121212] uppercase">
            {story.procedure}
          </div>
        </div>
      </div>
    </div>
  );
};

// Video card: poster until played, then a privacy-enhanced YouTube embed in place.
const VideoStoryCard: React.FC<{ story: ClinicalStory; playing: boolean; onPlay: () => void }> = ({ story, playing, onPlay }) => {
  return (
    <div className="relative w-[310px] sm:w-[350px] md:w-[370px] h-[460px] sm:h-[490px] shrink-0 rounded-[26px] bg-[#17372b] overflow-hidden flex flex-col select-none text-white">
      <div className="relative flex-1 bg-black">
        {playing ? (
          <iframe
            className="absolute inset-0 h-full w-full border-0"
            src={`https://www.youtube-nocookie.com/embed/${story.videoId}?autoplay=1&rel=0`}
            title={`${story.patientName}: ${story.quote}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button type="button" onClick={onPlay} aria-label={`Play video: ${story.quote}`} className="group absolute inset-0 h-full w-full cursor-pointer focus-visible:outline-4 focus-visible:outline-offset-[-6px] focus-visible:outline-white">
            <img src={`/clients/sri-lakshmi/videos/${story.videoId}.jpg`} alt="" className="h-full w-full object-cover opacity-80 transition-opacity duration-300 group-hover:opacity-95" loading="lazy" />
            <span className="absolute inset-0 bg-gradient-to-t from-[#17372b] via-transparent to-transparent" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-white text-[#17372b] shadow-lg transition-transform group-hover:scale-110">
                <Play className="ml-1 size-6 fill-current" />
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="p-6 sm:p-7">
        <p className="text-[1.15rem] sm:text-[1.25rem] leading-[1.35] tracking-[-0.4px]">{story.quote}</p>
        <div className="flex items-end justify-between pt-4 mt-4 border-t border-white/15">
          <div className="text-[11px] sm:text-xs font-semibold tracking-wider uppercase leading-tight">{story.patientName}</div>
          <div className="text-[11px] sm:text-xs font-bold tracking-wider uppercase">{story.procedure}</div>
        </div>
      </div>
    </div>
  );
};

interface TestimonialsSectionProps {
  viewMode?: 'option1' | 'option2';
  onConsultDoctor?: () => void;
}

export const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({
  viewMode = 'option2',
  onConsultDoctor,
}) => {
  // Carousel Ref & Dragging state for Option 2
  const carouselRef = useRef<HTMLDivElement>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const isHoveringRef = useRef(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playingRef = useRef(false);
  playingRef.current = playingId !== null;

  // 1. Drag to scroll logic ("movable by my hand by dragging")
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!carouselRef.current) return;
    isDownRef.current = true;
    startXRef.current = e.pageX - carouselRef.current.offsetLeft;
    scrollLeftRef.current = carouselRef.current.scrollLeft;
    carouselRef.current.style.cursor = 'grabbing';
    carouselRef.current.style.userSelect = 'none';
  };

  const handleMouseLeaveOrUp = () => {
    isDownRef.current = false;
    if (carouselRef.current) {
      carouselRef.current.style.cursor = 'grab';
      carouselRef.current.style.removeProperty('user-select');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDownRef.current || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    carouselRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  // 2. Auto-scroll one-by-one smoothly ("make it go one by one automatically")
  useEffect(() => {
    if (viewMode !== 'option2') return;

    const interval = setInterval(() => {
      if (isDownRef.current || isHoveringRef.current || playingRef.current || !carouselRef.current) return;

      const el = carouselRef.current;
      const cardWidth = 350 + 24; // card width + gap
      const maxScroll = el.scrollWidth - el.clientWidth;

      if (el.scrollLeft >= maxScroll - 30) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    }, 3800);

    return () => clearInterval(interval);
  }, [viewMode]);

  return (
    <section
      className="block pt-24 sm:pt-28 pb-20 sm:pb-24 border-b border-[#e7ded3] overflow-hidden"
      id="testimonials"
      aria-label="Patient reviews and doctor videos"
    >
      {/* ── Section Header (Clean, no pills or switcher clutter) ── */}
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 pb-12">
        <div className="flex flex-col gap-2.5 max-w-2xl">
          <h2 className="text-[#121212] [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif] text-[2.5rem] sm:text-[2.85rem] font-medium leading-[1.15] tracking-[-1.35px]">
            What our patients say
          </h2>
          <p className="text-[1.125rem] leading-[1.6] tracking-[-0.3px] text-[#575554]">
            {viewMode === 'option2'
              ? 'Reviews from our Google listing (4.1★ from 792 reviews) and videos from our doctors.'
              : 'Hospital information from the published website.'}
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          OPTION 2: End-to-End Draggable Auto-Scrolling Carousel
         ════════════════════════════════════════════════════════════════ */}
      {viewMode === 'option2' && (
        <div className="w-full">
          {/* End-to-End Draggable Container */}
          <div
            ref={carouselRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={() => {
              isHoveringRef.current = false;
              handleMouseLeaveOrUp();
            }}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => {
              isHoveringRef.current = true;
            }}
            className="flex items-stretch gap-6 overflow-x-auto pb-4 pt-2 scrollbar-none snap-x snap-mandatory cursor-grab active:cursor-grabbing px-6 sm:px-10 lg:px-16"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              scrollBehavior: 'smooth',
            }}
          >
            {CLINICAL_STORIES.map((story) => {
              // A. Generic Photo Card (Clean, crisp, no shadow or muddy gradient)
              if (story.type === 'photo') {
                return <PhotoStoryCard key={story.id} story={story} />;
              }

              // B. Video Story Card
              if (story.type === 'video') {
                return <VideoStoryCard key={story.id} story={story} playing={playingId === story.id} onPlay={() => setPlayingId(story.id)} />;
              }

              // C. Pure Quote Card (Clean, crisp, no weird shadow)
              return (
                <div
                  key={story.id}
                  className="w-[310px] sm:w-[350px] md:w-[370px] h-[460px] sm:h-[490px] shrink-0 rounded-[26px] bg-[#f4eee3] border border-[#ded6c7] p-7 sm:p-8 flex flex-col justify-between select-none"
                >
                  <ReviewSource />

                  <div className="my-auto py-4">
                    <blockquote className="text-[1.35rem] sm:text-[1.5rem] leading-[1.35] font-normal text-[#121212] [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_Arial,_sans-serif] tracking-[-0.6px]">
                      {story.quote}
                    </blockquote>
                  </div>

                  <div className="flex items-end justify-between pt-4 border-t border-[#121212]/10 mt-auto">
                    <div className="text-xs font-semibold tracking-wider text-[#121212] uppercase">
                      {story.patientName}
                    </div>
                    <div className="text-xs sm:text-[13px] font-bold tracking-wider text-[#121212] uppercase">
                      {story.procedure}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Centered Pill Button: "Consult our Doctor" */}
          <div className="flex items-center justify-center pt-10 sm:pt-12">
            <button
              type="button"
              onClick={onConsultDoctor}
              className="inline-flex items-center justify-center px-9 py-3.5 rounded-full bg-[#121212] hover:bg-neutral-800 text-white text-sm sm:text-[15px] font-semibold tracking-[-0.2px] shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
            >
              Consult our Doctor
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          OPTION 1: Social Reviews (𝕏 Community Posts)
         ════════════════════════════════════════════════════════════════ */}
      {viewMode === 'option1' && (
        <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
            {patientTestimonials.map((item, index) => (
              <div
                key={index}
                className="flex p-7 sm:p-8 rounded-[14px] items-start bg-[#f5f1e8] border border-[#e8dfd2] shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex flex-col gap-2.5 w-full">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex justify-start items-center gap-[0.7rem]">
                      <div className="w-10 block min-w-10">
                        <span className="block relative">
                          <img
                            className="w-10 h-10 block max-w-full rounded-full overflow-clip object-cover"
                            src={item.avatar}
                            alt={item.name}
                            width="40"
                            height="40"
                          />
                        </span>
                      </div>
                      <div className="block">
                        <div className="block text-[0.9375rem] font-semibold leading-5 tracking-[-0.13px] text-[#121212]">
                          {item.name}
                        </div>
                        <div className="block text-neutral-500 text-[0.875rem] tracking-[-0.09px]">
                          {item.handle}
                        </div>
                      </div>
                    </div>
                    <div className="block pt-1 text-[#121212]">
                      <svg
                        className="h-4 w-4 block overflow-hidden"
                        fill="none"
                        viewBox="0 0 18 19"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M10.4898 7.62738L17.0515 0H15.4966L9.79908 6.62275L5.24853 0H0L6.88133 10.0148L0 18.0132H1.55499L7.57167 11.0194L12.3774 18.0132H17.6259L10.4894 7.62738H10.4898ZM8.36005 10.103L7.66282 9.10575L2.11527 1.17057H4.50364L8.98058 7.57452L9.6778 8.57176L15.4973 16.8959H13.1089L8.36005 10.1034V10.103Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="block pt-3">
                    <p className="block text-[1.05rem] leading-relaxed tracking-[-0.22px] text-[#333]">
                      {item.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
