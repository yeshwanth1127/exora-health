import { AnimatePresence, motion } from 'framer-motion';
import { Check, Settings, X } from 'lucide-react';
import { HERO_BACKDROPS, HERO_PLACEMENTS, type HeroBackdrop, type HeroPlacement } from '../home/heroBackdrops';
import { getAnalyticsConsent, setAnalyticsConsent, trackModeSwitched } from '../../lib/posthog';

export type DesignMode = 'original' | 'light';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: DesignMode;
  onChangeMode: (mode: DesignMode) => void;
  heroBackdrop: HeroBackdrop;
  onChangeHeroBackdrop: (backdrop: HeroBackdrop) => void;
  heroPlacement: HeroPlacement;
  onChangeHeroPlacement: (placement: HeroPlacement) => void;
}

const modes: { id: DesignMode; name: string; description: string; swatch: string }[] = [
  {
    id: 'original',
    name: 'Original',
    description: 'The original Sri Lakshmi homepage, care search, and appointment layouts.',
    swatch: 'bg-[#f2f4f6] border-[#d5d9da]',
  },
  {
    id: 'light',
    name: 'Light Green',
    description: 'The lighter homepage, care search, and appointment layouts.',
    swatch: 'bg-[#eaf0e7] border-[#b9cfbd]',
  },
];

const heroOptions: { id: HeroBackdrop; name: string; description: string; image?: string }[] = [
  { id: 'plain', name: 'Clean canvas', description: 'No photo, just the search.' },
  { id: 'visit', name: HERO_BACKDROPS.visit.label, description: 'Doctor, nurse and family together.', image: HERO_BACKDROPS.visit.image },
  { id: 'family', name: HERO_BACKDROPS.family.label, description: 'Whole-family care. Best as a banner.', image: HERO_BACKDROPS.family.image },
  { id: 'consultation', name: HERO_BACKDROPS.consultation.label, description: 'Warm, personal care.', image: HERO_BACKDROPS.consultation.image },
  { id: 'cardiology', name: HERO_BACKDROPS.cardiology.label, description: 'A closer clinical moment.', image: HERO_BACKDROPS.cardiology.image },
  { id: 'telehealth', name: HERO_BACKDROPS.telehealth.label, description: 'A wider care setting.', image: HERO_BACKDROPS.telehealth.image },
];

export function SettingsModal({ isOpen, onClose, mode, onChangeMode, heroBackdrop, onChangeHeroBackdrop, heroPlacement, onChangeHeroPlacement }: SettingsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="display-settings-title"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-lg max-h-[min(90vh,820px)] overflow-y-auto rounded-2xl border border-[#ded7cb] bg-[#f6f4ef] p-6 shadow-2xl [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_Arial,_sans-serif]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#e5ded2] pb-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-[#17372b] text-white"><Settings size={17} /></span>
                <div>
                  <h2 id="display-settings-title" className="text-lg font-semibold text-[#17372b]">Website design</h2>
                  <p className="mt-0.5 text-sm text-[#647066]">Choose one style for the whole site.</p>
                </div>
              </div>
              <button type="button" onClick={onClose} aria-label="Close settings" className="rounded-full p-2 text-[#555] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"><X size={17} /></button>
            </div>

            <div className="space-y-3 py-5" role="group" aria-label="Website design mode">
              {modes.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    if (mode !== option.id) {
                      trackModeSwitched(mode, option.id);
                    }
                    onChangeMode(option.id);
                  }}
                  aria-pressed={mode === option.id}
                  className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5037] ${mode === option.id ? 'border-[#245b3e] bg-white' : 'border-[#ddd9d0] bg-[#faf9f6] hover:border-[#7b9c82]'}`}
                >
                  <span aria-hidden="true" className={`mt-0.5 size-12 shrink-0 rounded-lg border ${option.swatch}`} />
                  <span className="flex-1">
                    <span className="block text-base font-semibold text-[#17372b]">{option.name}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-[#657167]">{option.description}</span>
                  </span>
                  {mode === option.id && <Check aria-hidden="true" className="mt-1 shrink-0 text-[#245b3e]" size={18} />}
                </button>
              ))}
            </div>
            <div className="border-t border-[#e5ded2] py-5">
              <h3 className="text-sm font-semibold text-[#17372b]">Home hero backdrop</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#647066]">Try photo directions behind the booking search. Your choice is saved in this browser.</p>
              <div className="mt-4 grid grid-cols-2 gap-2.5" role="group" aria-label="Home hero backdrop">
                {heroOptions.map(option => (
                  <button key={option.id} type="button" onClick={() => onChangeHeroBackdrop(option.id)} aria-pressed={heroBackdrop === option.id} className={`overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5037] ${heroBackdrop === option.id ? 'border-[#245b3e] bg-white ring-1 ring-[#245b3e]' : 'border-[#ddd9d0] bg-[#faf9f6] hover:border-[#7b9c82]'}`}>
                    <span className="block h-16 overflow-hidden bg-gradient-to-br from-[#eef4eb] to-[#f9faf6]">{option.image && <img src={option.image} alt="" className="h-full w-full object-cover" loading="lazy" />}</span>
                    <span className="block p-2.5"><span className="flex items-center justify-between gap-1 text-xs font-semibold text-[#17372b]">{option.name}{heroBackdrop === option.id && <Check size={14} aria-hidden="true" />}</span><span className="mt-0.5 block text-[11px] leading-snug text-[#657167]">{option.description}</span></span>
                  </button>
                ))}
              </div>
              {mode === 'original' && heroBackdrop !== 'plain' && <>
                <h3 className="mt-6 text-sm font-semibold text-[#17372b]">Hero image placement</h3>
                <div className="mt-3 grid grid-cols-2 gap-2.5" role="group" aria-label="Hero image placement">
                  {HERO_PLACEMENTS.map(option => (
                    <button key={option.id} type="button" onClick={() => onChangeHeroPlacement(option.id)} aria-pressed={heroPlacement === option.id} className={`rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5037] ${heroPlacement === option.id ? 'border-[#245b3e] bg-white ring-1 ring-[#245b3e]' : 'border-[#ddd9d0] bg-[#faf9f6] hover:border-[#7b9c82]'}`}>
                      <span className="flex items-center justify-between gap-1 text-xs font-semibold text-[#17372b]">{option.name}{heroPlacement === option.id && <Check size={14} aria-hidden="true" />}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-[#657167]">{option.description}</span>
                    </button>
                  ))}
                </div>
              </>}
            </div>
            <div className="border-t border-[#e5ded2] py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#17372b]">Product analytics</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#647066] max-w-sm">
                    Anonymous telemetry to improve page journeys. Zero patient names, phone numbers, symptoms, or health topics are collected.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    getAnalyticsConsent() === 'granted'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {getAnalyticsConsent() === 'granted' ? 'Enabled' : 'Disabled'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = getAnalyticsConsent() !== 'granted';
                      setAnalyticsConsent(next);
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#c4ccc2] bg-white hover:bg-[#f0f4ee] transition-colors"
                  >
                    {getAnalyticsConsent() === 'granted' ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>

            <p className="border-t border-[#e5ded2] pt-4 text-xs leading-relaxed text-[#6c746d]">
              Navigation, departments, doctors, announcement, and footer are shared in both modes.
            </p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={onClose} className="rounded-full bg-[#17372b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#245b3e] focus-visible:outline-2 focus-visible:outline-offset-2">Done</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
