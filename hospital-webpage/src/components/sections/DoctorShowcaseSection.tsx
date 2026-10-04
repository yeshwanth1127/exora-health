import React, { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { hospitalVideos } from '../../data/clientMedia';
import { YouTubePlayer } from '../media/YouTubePlayer';

interface DoctorShowcaseSectionProps { onBookAppointment?: () => void; }
const showcases = hospitalVideos.slice(0, 3);
export const DoctorShowcaseSection: React.FC<DoctorShowcaseSectionProps> = ({ onBookAppointment }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = showcases[currentIndex];
  return <section className="w-full bg-[#f6f4ef] pt-8 pb-20 sm:pb-28 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif]" id="showcase" aria-label="Doctor Video Showcase">
    <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
      <div className="mb-8 sm:mb-10"><h2 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-medium tracking-[-1.5px] leading-[1.1] text-[#121212]">Meet our doctors</h2><p className="mt-2 text-sm sm:text-base text-[#666] tracking-[-0.2px]">Conversations with our founder and doctors, from the hospital’s official YouTube channel.</p></div>
      <div className="relative w-full text-[#17372b]"><YouTubePlayer key={current.id} video={current} autoPlay frameClassName="sm:rounded-3xl shadow-2xl border border-[#ded7cb]" /></div>
      <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col items-start gap-4 max-w-xl"><div><h3 className="text-xl sm:text-2xl font-medium tracking-tight text-[#121212]">{current.title}</h3><p className="mt-1 text-xs sm:text-sm text-[#666]">{current.description}</p></div><button type="button" onClick={onBookAppointment} className="inline-flex items-center justify-center rounded-full border border-[#121212] hover:bg-[#121212] text-[#121212] hover:text-white px-6 py-2.5 text-sm font-medium tracking-[-0.2px] transition-colors cursor-pointer">Book an In-Person Consultation</button></div>
        <div className="flex items-center gap-3 self-end md:self-auto"><span className="text-xs font-mono text-[#777] mr-1 tabular-nums">0{currentIndex + 1} / 0{showcases.length}</span><button type="button" onClick={() => setCurrentIndex(index => (index + showcases.length - 1) % showcases.length)} aria-label="Previous showcase reel" className="size-11 sm:size-12 rounded-full border border-[#ccc] hover:border-[#121212] text-[#121212] flex items-center justify-center transition-colors hover:bg-black/5"><ArrowLeft size={19} /></button><button type="button" onClick={() => setCurrentIndex(index => (index + 1) % showcases.length)} aria-label="Next showcase reel" className="size-11 sm:size-12 rounded-full border border-[#ccc] hover:border-[#121212] text-[#121212] flex items-center justify-center transition-colors hover:bg-black/5"><ArrowRight size={19} /></button></div>
      </div>
    </div>
  </section>;
};
