import React, { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';

interface ClinicAnnouncementProps {
  onClaimOffer?: () => void;
  onClose?: () => void;
}

/** Announcement-5 component from watermelon registry customized for clinic offer */
export const ClinicAnnouncement: React.FC<ClinicAnnouncementProps> = ({ onClaimOffer, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="relative isolate flex w-full items-center justify-center overflow-hidden border-b border-[#ddd4c5] px-8 sm:px-12 py-2.5 backdrop-blur bg-[#eee6d9]/95 z-50 transition-all">
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#efe8dd] via-[#f7f2eb] to-[#ebdccb] opacity-90" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white/40 via-white/10 to-transparent opacity-40" />

      <div className="flex w-full max-w-5xl min-w-0 flex-row flex-wrap items-center justify-center gap-2 sm:gap-3 text-center">
        <p className="text-xs sm:text-sm leading-snug font-medium text-[#121212] tracking-[-0.15px]">
          <span className="inline-block mr-1.5 font-semibold text-[#e04a36]">✨ Bengaluru Clinic Offer:</span>
          Flat 50% off full-body preventative health screenings &amp; zero consultation fees for first-time visitors.
        </p>

        <div className="group flex items-center shrink-0">
          <button
            onClick={onClaimOffer}
            className="rounded-full bg-[#121212] hover:bg-[#252525] px-3.5 py-1 text-xs sm:text-[13px] font-medium text-white transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm"
          >
            <span>Claim offer</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      <button
        onClick={() => {
          setIsVisible(false);
          onClose?.();
        }}
        aria-label="Dismiss announcement"
        className="absolute right-2 sm:right-4 p-1 rounded-lg text-zinc-600 hover:text-black hover:bg-black/5 transition cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
