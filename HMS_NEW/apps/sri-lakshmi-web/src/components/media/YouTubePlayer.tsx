import { useEffect, useRef, useState } from 'react';
import { Play, ArrowUpRight } from 'lucide-react';
import type { HospitalVideo } from '../../data/clientMedia';

// Mount by video id so changing the selection stops the previous recording.
// autoPlay starts it muted (browsers block autoplay with sound) once half of it is on screen,
// so the YouTube player only loads for visitors who reach it.
export function YouTubePlayer({ video, frameClassName = '', autoPlay = false }: { video: HospitalVideo; frameClassName?: string; autoPlay?: boolean }) {
  const [playing, setPlaying] = useState<false | 'muted' | 'sound'>(false);
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autoPlay || !frameRef.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setPlaying(current => current || 'muted'); observer.disconnect(); }
    }, { threshold: 0.5 });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [autoPlay]);
  return <div>
    <div ref={frameRef} className={`relative aspect-video overflow-hidden rounded-2xl bg-[#122b23] ${frameClassName}`}>
      {playing ? <iframe className="absolute inset-0 h-full w-full border-0" src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0${playing === 'muted' ? '&mute=1&playsinline=1' : ''}`} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
        : <button type="button" onClick={() => setPlaying('sound')} aria-label={`Play ${video.title}`} className="group absolute inset-0 h-full w-full focus-visible:outline-4 focus-visible:outline-offset-[-6px] focus-visible:outline-white">
          <img src={video.poster} alt="" className="h-full w-full object-cover object-[center_25%] opacity-55 transition-opacity duration-300 group-hover:opacity-70" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute inset-0 flex items-center justify-center"><span className="flex size-16 items-center justify-center rounded-full bg-white text-[#17372b] shadow-lg transition-transform group-hover:scale-110 sm:size-20"><Play className="ml-1 size-6 fill-current sm:size-7" /></span></span>
          <span className="absolute bottom-4 left-5 text-left text-xs font-medium text-white sm:bottom-6 sm:left-7 sm:text-sm">{video.category} <span className="mx-2 opacity-50">/</span> Play on YouTube</span>
        </button>}
    </div>
    <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-4 opacity-80 hover:opacity-100">Watch on YouTube <ArrowUpRight size={14} /></a>
  </div>;
}
