import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Sparkles } from 'lucide-react';

// Option 1: X (Twitter) Community Testimonials
interface PatientTestimonial {
  name: string;
  handle: string;
  avatar: string;
  text: string;
}

const patientTestimonials: PatientTestimonial[] = [
  {
    name: "Elena Vance",
    handle: "@elenavance",
    avatar: "/assets/cloned/images/688082b68697.jpeg",
    text: "After feeling breathless during morning runs, Dr. Jenkins diagnosed my mitral valve issue over a video consult and had me admitted two days later. The care and recovery follow-up via WhatsApp was unlike any hospital experience I've ever had."
  },
  {
    name: "Daniel Feodoroff",
    handle: "@mrdanielfeo",
    avatar: "/assets/cloned/images/3991dbcd8280.jpeg",
    text: "The Avocado Health app has some of the best patient UX I’ve ever seen. Booking my MRI, talking with the doctor, and having test results delivered within hours was so effortless."
  },
  {
    name: "Emma Thornton",
    handle: "@emmathornton",
    avatar: "/assets/cloned/images/6dace7097a3e.jpeg",
    text: "Got in on the Avocado virtual care triage and first impression is that THIS is the delightful healthcare experience we've all been missing. Immediate pharmacy prescription delivery too."
  },
  {
    name: "Sarah Miller",
    handle: "@sarahm_health",
    avatar: "/assets/cloned/images/98b86b931bf2.jpeg",
    text: "Dr. Vance performed robotic-assisted spine surgery that completely restored my mobility without heavy painkillers. 6 weeks post-op and hiking again! 🔥👏"
  },
  {
    name: "Ilya Komolkin",
    handle: "@ilyakomolkin",
    avatar: "/assets/cloned/images/8d22908ae989.png",
    text: "It is one of the best patient portals in modern healthcare. Onboarding, watching vitals, direct triage with nurses, and prescription renewals are on a whole another level 👏"
  },
  {
    name: "Adam Waterhouse",
    handle: "@AdamWaterhouse",
    avatar: "/assets/cloned/images/2cea4d9ff44d.jpeg",
    text: "The attention to detail on the Avocado telemedicine app is staggering. The instant video connection with an on-call physician made an emergency anxiety attack manageable."
  }
];

// Option 2: Clinical Stories (Generic high-res pictures, Audio waveforms, Quotes)
export type StoryType = 'photo' | 'quote' | 'audio';

export interface ClinicalStory {
  id: string;
  type: StoryType;
  patientName: string;
  procedure: string;
  quote: string;
  image?: string;
  audioDuration?: string;
  audioTotalSeconds?: number;
}

const CLINICAL_STORIES: ClinicalStory[] = [
  {
    id: 'adeeba-family',
    type: 'photo',
    patientName: 'ADEEBA IRSHAD',
    procedure: 'MATERNITY CARE',
    quote: '“Avocado never felt like a hospital. The team cared for me and my baby with so much warmth.”',
    image: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'paritosh-audio',
    type: 'audio',
    patientName: 'PARITOSH & FAMILY',
    procedure: 'FAMILY CARE PLAN',
    quote: '“Great doctors, kind people, and such a calm, cozy experience throughout.”',
    audioDuration: '0:41',
    audioTotalSeconds: 41,
  },
  {
    id: 'dr-raghu-quote',
    type: 'quote',
    patientName: 'DR. RAGHU & FAMILY',
    procedure: 'FAMILY CARE PLAN',
    quote: '“For the first time, our family of six’s healthcare feels organised, predictable and stress free.”',
  },
  {
    id: 'sangeetha-portrait',
    type: 'photo',
    patientName: 'SANGEETHA JAIN',
    procedure: 'SPINE SURGERY',
    quote: '“From physio to surgery. Everything was so seamless. Doctors here explain where I understood things.”',
    image: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'audio-ashwinipriya',
    type: 'audio',
    patientName: 'ASHWINIPRIYA AND\nCHANDRA MOHAN',
    procedure: 'MATERNITY CARE',
    quote: '“We had seen great healthcare in Sweden. Avocado gave us that same sense of confidence and comfort.”',
    audioDuration: '0:08',
    audioTotalSeconds: 8,
  },
  {
    id: 'shruthi-arjun-baby',
    type: 'photo',
    patientName: 'B. SHRUTHI & ARJUN',
    procedure: 'MATERNITY CARE',
    quote: '“From my appointments, giving birth and discharge, everything was planned, hassle free, and smooth.”',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'navya-photo',
    type: 'photo',
    patientName: 'NAVYA',
    procedure: 'RIGHT LEG SURGERY',
    quote: '“I went through two surgeries here, and I\'ve seen the difference in care and attention to details, that\'s what truly makes Avocado special.”',
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'sharuk-quote',
    type: 'quote',
    patientName: 'SHARUK',
    procedure: 'KIDNEY SURGERY',
    quote: '“After my surgery experience at Avocado, I honestly don’t see myself going to any other hospital.”',
  },
  {
    id: 'tapan-photo',
    type: 'photo',
    patientName: 'TAPAN KAR',
    procedure: 'HERNIA SURGERY',
    quote: '“Avocado made surgery feel easy. From reaching the hospital to going back home, everything was taken care of.”',
    image: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'shivaram-photo',
    type: 'photo',
    patientName: 'SHIVARAMAIAH & FAMILY',
    procedure: 'ORTHOPEDIC REHAB',
    quote: '“It seemed as if I walked into not a five star, but a world-class healing sanctuary. Everything was taken care of.”',
    image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=80',
  },
];

// Sub-component for Photo Story Card (Clean, crisp, no shadow or murky gradient)
const PhotoStoryCard: React.FC<{ story: ClinicalStory }> = ({ story }) => {
  return (
    <div className="group relative w-[310px] sm:w-[350px] md:w-[370px] h-[460px] sm:h-[490px] shrink-0 rounded-[26px] bg-[#f4eee3] border border-[#ded6c7] overflow-hidden flex flex-col justify-between select-none">
      {/* Top Patient Photo (Crisp, clean rectangle) */}
      <div className="relative h-[240px] sm:h-[260px] w-full overflow-hidden bg-[#ebe4d6]">
        <img
          src={story.image}
          alt={story.patientName}
          className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-103"
          loading="lazy"
        />
      </div>

      {/* Bottom Quote & Info (Clean cream card body, NO gradient) */}
      <div className="p-6 sm:p-7 flex flex-col justify-between flex-1">
        <blockquote className="text-[1.02rem] sm:text-[1.08rem] leading-[1.4] font-normal text-[#121212] [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_Arial,_sans-serif] tracking-[-0.3px] mb-4 line-clamp-3">
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

// Sub-component for Audio card with interactive waveform
const AudioStoryCard: React.FC<{ story: ClinicalStory }> = ({ story }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const total = story.audioTotalSeconds || 8;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setSeconds((prev) => {
          if (prev >= total) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, total]);

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isPlaying ? 360 : 540, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // AudioContext fallback
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-[310px] sm:w-[350px] md:w-[370px] h-[460px] sm:h-[490px] shrink-0 rounded-[26px] bg-[#f4eee3] border border-[#ded6c7] p-7 sm:p-8 flex flex-col justify-between select-none">
      {/* Audio Player Pill Widget */}
      <div className="w-full bg-white rounded-full p-2 pl-2 pr-4.5 flex items-center justify-between border border-[#ece4d6]">
        <button
          type="button"
          onClick={toggleAudio}
          className="size-11 rounded-full bg-[#121212] hover:bg-neutral-800 text-white flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95"
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
        >
          {isPlaying ? (
            <Pause className="size-4 fill-white text-white" />
          ) : (
            <Play className="size-4 fill-white text-white ml-0.5" />
          )}
        </button>

        {/* Purple Stylized Soundwave */}
        <div className="flex-1 mx-3 flex items-center justify-center gap-[3px] h-6 overflow-hidden">
          {[30, 45, 75, 95, 60, 85, 100, 70, 90, 50, 40, 65, 80, 55, 35].map((h, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-gradient-to-b from-[#8b5cf6] to-[#6366f1] transition-all duration-200"
              style={{
                height: isPlaying
                  ? `${Math.max(20, h * (0.6 + Math.sin(Date.now() / 200 + i) * 0.4))}%`
                  : `${Math.max(25, h * 0.4)}%`,
                opacity: isPlaying ? 0.95 : 0.65,
              }}
            />
          ))}
        </div>

        {/* Timestamp duration */}
        <span className="text-xs sm:text-[13px] font-semibold tracking-tight text-[#121212] tabular-nums font-mono">
          {isPlaying ? formatTime(seconds) : story.audioDuration || '0:08'}
        </span>
      </div>

      {/* Main Quote */}
      <div className="my-auto py-4">
        <blockquote className="text-[1.25rem] sm:text-[1.38rem] leading-[1.38] font-normal text-[#121212] [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_Arial,_sans-serif] tracking-[-0.5px]">
          {story.quote}
        </blockquote>
      </div>

      {/* Bottom Patient Info & Procedure */}
      <div className="flex items-end justify-between pt-4 border-t border-[#121212]/10 mt-auto">
        <div className="text-[11px] sm:text-xs font-semibold tracking-wider text-[#121212] uppercase leading-tight whitespace-pre-line">
          {story.patientName}
        </div>
        <div className="text-xs sm:text-[13px] font-bold tracking-wider text-[#121212] uppercase">
          {story.procedure}
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
      if (isDownRef.current || isHoveringRef.current || !carouselRef.current) return;

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
      aria-label="Patients of Avocado Testimonials"
    >
      {/* ── Section Header (Clean, no pills or switcher clutter) ── */}
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 pb-12">
        <div className="flex flex-col gap-2.5 max-w-2xl">
          <h2 className="text-[#121212] [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif] text-[2.5rem] sm:text-[2.85rem] font-medium leading-[1.15] tracking-[-1.35px]">
            Patients of Avocado
          </h2>
          <p className="text-[1.125rem] leading-[1.6] tracking-[-0.3px] text-[#575554]">
            {viewMode === 'option2'
              ? 'Clinical stories, voice recoveries, and patient experiences across Bengaluru.'
              : 'See what verified patients are saying on community channels.'}
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

              // B. Audio Story Card
              if (story.type === 'audio') {
                return <AudioStoryCard key={story.id} story={story} />;
              }

              // C. Pure Quote Card (Clean, crisp, no weird shadow)
              return (
                <div
                  key={story.id}
                  className="w-[310px] sm:w-[350px] md:w-[370px] h-[460px] sm:h-[490px] shrink-0 rounded-[26px] bg-[#f4eee3] border border-[#ded6c7] p-7 sm:p-8 flex flex-col justify-between select-none"
                >
                  <div className="size-10 rounded-full bg-[#121212]/5 flex items-center justify-center text-[#121212]/40">
                    <Sparkles className="size-4.5" />
                  </div>

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
