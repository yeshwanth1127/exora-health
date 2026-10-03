import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Check, MessageSquare, HeartHandshake, LayoutGrid, Layers, Image as ImageIcon, LayoutTemplate } from 'lucide-react';
import { PricingRailVariant } from '../sections/PricingRailSection';

export type ComponentVariantKey = 'header' | 'hero' | 'why' | 'services' | 'doctors' | 'locations' | 'insurance' | 'pricing' | 'articles' | 'footer' | 'doctor-profile' | 'search-results' | 'appointment';
export type ComponentVariants = Record<ComponentVariantKey, 'original' | 'light'>;

const componentOptions: { key: ComponentVariantKey; label: string }[] = [
  { key: 'header', label: 'Top navigation' },
  { key: 'hero', label: 'Homepage hero' },
  { key: 'why', label: 'Why choose us' },
  { key: 'services', label: 'Services' },
  { key: 'doctors', label: 'Doctor showcase' },
  { key: 'locations', label: 'Location section' },
  { key: 'insurance', label: 'Insurance section' },
  { key: 'pricing', label: 'Pricing section' },
  { key: 'articles', label: 'Articles section' },
  { key: 'footer', label: 'Footer' },
  { key: 'doctor-profile', label: 'Doctor profile screen' },
  { key: 'search-results', label: 'Doctor search screen' },
  { key: 'appointment', label: 'Appointment screen' },
];
const screenOptionKeys: ComponentVariantKey[] = ['doctor-profile', 'search-results', 'appointment'];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTestimonialOption: 'option1' | 'option2';
  onChangeTestimonialOption: (option: 'option1' | 'option2') => void;
  activeServicesOption?: 'option1' | 'option2';
  onChangeServicesOption?: (option: 'option1' | 'option2') => void;
  activeHeroBookingPosition?: 'top' | 'bottom';
  onChangeHeroBookingPosition?: (position: 'top' | 'bottom') => void;
  activePricingVariant?: PricingRailVariant;
  onChangePricingVariant?: (variant: PricingRailVariant) => void;
  activeHeroType?: 'centered-search' | 'classic-image';
  onChangeHeroType?: (type: 'centered-search' | 'classic-image') => void;
  componentVariants?: ComponentVariants;
  onChangeComponentVariant?: (key: ComponentVariantKey, value: 'original' | 'light') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeTestimonialOption,
  onChangeTestimonialOption,
  activeServicesOption = 'option1',
  onChangeServicesOption,
  activeHeroBookingPosition = 'top',
  onChangeHeroBookingPosition,
  activePricingVariant = 'visual',
  onChangePricingVariant,
  activeHeroType = 'centered-search',
  onChangeHeroType,
  componentVariants,
  onChangeComponentVariant,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-lg rounded-2xl bg-[#f6f4ef] border border-[#ded7cb] p-6 shadow-2xl z-10 [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_Arial,_sans-serif] max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#e5ded2]">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-full bg-[#121212] text-white flex items-center justify-center">
                  <Settings className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#121212] leading-none">
                    Display Settings
                  </h3>
                  <p className="text-xs text-[#6e6a65] mt-1">
                    Toggle design variations and options
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="size-8 rounded-full hover:bg-black/5 text-[#555] flex items-center justify-center transition cursor-pointer"
                aria-label="Close settings"
              >
                <X className="size-4" />
              </button>
            </div>

            {componentVariants && onChangeComponentVariant && (
              <div className="py-5 border-b border-[#e5ded2]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#555] mb-2">Component options</h4>
                <p className="text-xs leading-relaxed text-[#666] mb-4">Original homepage sections are the default. Compare the earlier and updated journey screens here; the earlier doctor profile still contains source reference copy.</p>
                <div className="space-y-2">
                  {componentOptions.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-[#ded7cb] bg-white px-3 py-2.5">
                      <span className="text-sm font-medium text-[#222]">{label}</span>
                      <div className="inline-flex shrink-0 rounded-md border border-[#ded7cb] p-0.5" role="group" aria-label={`${label} design`}>
                        {(['original', 'light'] as const).map(value => <button key={value} type="button" onClick={() => onChangeComponentVariant(key, value)} aria-pressed={componentVariants[key] === value} className={`rounded px-2.5 py-1.5 text-xs font-semibold capitalize transition-colors ${componentVariants[key] === value ? 'bg-[#17372b] text-white' : 'text-[#555] hover:bg-[#f1eee8]'}`}>{value === 'original' ? 'Original' : screenOptionKeys.includes(key) ? 'Updated' : 'Light'}</button>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 0. Hero Section Style Setting */}
            {onChangeHeroType && (
              <div className="py-4 border-b border-[#e5ded2]">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#555] mb-3">
                  Hero Style — Centered AI Search vs Image
                </label>

                <div className="space-y-2.5">
                  {/* Option 1: Centered Search with AI Assistant */}
                  <button
                    type="button"
                    onClick={() => onChangeHeroType('centered-search')}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      activeHeroType === 'centered-search'
                        ? 'bg-white border-[#121212] shadow-sm'
                        : 'bg-[#eee8dc] border-[#ded6c7] hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                          activeHeroType === 'centered-search'
                            ? 'bg-[#121212] text-white'
                            : 'bg-[#ded6c7] text-[#555]'
                        }`}
                      >
                        <LayoutTemplate className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#121212]">
                            Centered Hero with AI Care Assistant
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#fde047] text-neutral-900">
                            New
                          </span>
                        </div>
                        <p className="text-xs text-[#666] mt-0.5 leading-relaxed">
                          Clean centered headline with AI Care Assistant search toggle, insurance selector, and questionnaire triage.
                        </p>
                      </div>
                    </div>

                    {activeHeroType === 'centered-search' && (
                      <div className="size-5 rounded-full bg-[#121212] text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  {/* Option 2: Photorealistic Telehealth Hero */}
                  <button
                    type="button"
                    onClick={() => onChangeHeroType('classic-image')}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      activeHeroType === 'classic-image'
                        ? 'bg-white border-[#121212] shadow-sm'
                        : 'bg-[#eee8dc] border-[#ded6c7] hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                          activeHeroType === 'classic-image'
                            ? 'bg-[#121212] text-white'
                            : 'bg-[#ded6c7] text-[#555]'
                        }`}
                      >
                        <ImageIcon className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#121212]">
                            Photorealistic Telehealth Doctor Hero
                          </span>
                        </div>
                        <p className="text-xs text-[#666] mt-0.5 leading-relaxed">
                          Edge-to-edge doctor telemedicine portrait with frosted glass floating booking dock.
                        </p>
                      </div>
                    </div>

                    {activeHeroType === 'classic-image' && (
                      <div className="size-5 rounded-full bg-[#121212] text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 1. Services Section Setting */}
            {onChangeServicesOption && (
              <div className="py-4 border-b border-[#e5ded2]">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#555] mb-3">
                  Services We Offer — Layout Style
                </label>

                <div className="space-y-2.5">
                  {/* Option 1: Bento Grid */}
                  <button
                    type="button"
                    onClick={() => onChangeServicesOption('option1')}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      activeServicesOption === 'option1'
                        ? 'bg-white border-[#121212] shadow-sm'
                        : 'bg-[#eee8dc] border-[#ded6c7] hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                          activeServicesOption === 'option1'
                            ? 'bg-[#121212] text-white'
                            : 'bg-[#ded6c7] text-[#555]'
                        }`}
                      >
                        <LayoutGrid className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#121212]">
                            Option 1: 6-Grid Bento Cards
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-[#10b981]/15 text-[#059669]">
                            Default
                          </span>
                        </div>
                        <p className="text-xs text-[#666] mt-0.5 leading-relaxed">
                          Visual photographic tiles with pill badges, procedural tags, and clean hover elevation.
                        </p>
                      </div>
                    </div>

                    {activeServicesOption === 'option1' && (
                      <div className="size-5 rounded-full bg-[#121212] text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  {/* Option 2: Diverse Departments Grid */}
                  <button
                    type="button"
                    onClick={() => onChangeServicesOption('option2')}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      activeServicesOption === 'option2'
                        ? 'bg-white border-[#121212] shadow-sm'
                        : 'bg-[#eee8dc] border-[#ded6c7] hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                          activeServicesOption === 'option2'
                            ? 'bg-[#121212] text-white'
                            : 'bg-[#ded6c7] text-[#555]'
                        }`}
                      >
                        <Layers className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#121212]">
                            Option 2: Diverse Departments (Yellow Duo-Tone)
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-800">
                            New Variant
                          </span>
                        </div>
                        <p className="text-xs text-[#666] mt-0.5 leading-relaxed">
                          Streamlined 6-specialty asymmetric grid with custom yellow duo-tone icons (Primary Care, Dentist, OB-GYN, etc.).
                        </p>
                      </div>
                    </div>

                    {activeServicesOption === 'option2' && (
                      <div className="size-5 rounded-full bg-[#121212] text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 2. Testimonials Section Setting */}
            <div className="py-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#555] mb-3">
                Patients of Avocado — Testimonial Style
              </label>

              <div className="space-y-2.5">
                {/* Option 2 (Primary) */}
                <button
                  type="button"
                  onClick={() => onChangeTestimonialOption('option2')}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    activeTestimonialOption === 'option2'
                      ? 'bg-white border-[#121212] shadow-sm'
                      : 'bg-[#eee8dc] border-[#ded6c7] hover:bg-white/80'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                        activeTestimonialOption === 'option2'
                          ? 'bg-[#121212] text-white'
                          : 'bg-[#ded6c7] text-[#555]'
                      }`}
                    >
                      <HeartHandshake className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#121212]">
                          Option 2: Clinical Stories (Voice &amp; Cards)
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-[#10b981]/15 text-[#059669]">
                          Default
                        </span>
                      </div>
                      <p className="text-xs text-[#666] mt-0.5 leading-relaxed">
                        Continuous draggable carousel with generic portraits, Web Audio sound waveforms, and procedure badges.
                      </p>
                    </div>
                  </div>

                  {activeTestimonialOption === 'option2' && (
                    <div className="size-5 rounded-full bg-[#121212] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="size-3 stroke-[3]" />
                    </div>
                  )}
                </button>

                {/* Option 1 (Social X) */}
                <button
                  type="button"
                  onClick={() => onChangeTestimonialOption('option1')}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    activeTestimonialOption === 'option1'
                      ? 'bg-white border-[#121212] shadow-sm'
                      : 'bg-[#eee8dc] border-[#ded6c7] hover:bg-white/80'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                        activeTestimonialOption === 'option1'
                          ? 'bg-[#121212] text-white'
                          : 'bg-[#ded6c7] text-[#555]'
                      }`}
                    >
                      <MessageSquare className="size-4" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-[#121212]">
                        Option 1: Social Community (𝕏 Reviews)
                      </span>
                      <p className="text-xs text-[#666] mt-0.5 leading-relaxed">
                        Grid of Twitter/𝕏 patient reviews with verified profile avatars, handles, and short comments.
                      </p>
                    </div>
                  </div>

                  {activeTestimonialOption === 'option1' && (
                    <div className="size-5 rounded-full bg-[#121212] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="size-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* 3. Hero Booking Bar Placement Setting */}
            {onChangeHeroBookingPosition && (
              <div className="py-4 border-b border-[#e5ded2]">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#555] mb-3">
                  Hero Page — Quick Booking Flow Placement
                </label>

                <div className="space-y-2.5">
                  {/* Mode 1: Top Placement */}
                  <button
                    type="button"
                    onClick={() => onChangeHeroBookingPosition('top')}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      activeHeroBookingPosition === 'top'
                        ? 'bg-white border-[#121212] shadow-sm'
                        : 'bg-[#eee8dc] border-[#ded6c7] hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                          activeHeroBookingPosition === 'top'
                            ? 'bg-[#121212] text-white'
                            : 'bg-[#ded6c7] text-[#555]'
                        }`}
                      >
                        <Layers className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#121212]">
                            Mode 1: Floating on Top (Above Hero Details)
                          </span>
                        </div>
                        <p className="text-xs text-[#666] mt-0.5 leading-relaxed">
                          Positions the quick appointment search bar right below the navigation bar, above the headline.
                        </p>
                      </div>
                    </div>

                    {activeHeroBookingPosition === 'top' && (
                      <div className="size-5 rounded-full bg-[#121212] text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  {/* Mode 2: Bottom Placement */}
                  <button
                    type="button"
                    onClick={() => onChangeHeroBookingPosition('bottom')}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      activeHeroBookingPosition === 'bottom'
                        ? 'bg-white border-[#121212] shadow-sm'
                        : 'bg-[#eee8dc] border-[#ded6c7] hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                          activeHeroBookingPosition === 'bottom'
                            ? 'bg-[#121212] text-white'
                            : 'bg-[#ded6c7] text-[#555]'
                        }`}
                      >
                        <LayoutGrid className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#121212]">
                            Mode 2: Below &ldquo;Your Wellness...&rdquo; (Bottom)
                          </span>
                        </div>
                        <p className="text-xs text-[#666] mt-0.5 leading-relaxed">
                          Embeds the quick appointment search bar right beneath the main headline in place of the simple button.
                        </p>
                      </div>
                    </div>

                    {activeHeroBookingPosition === 'bottom' && (
                      <div className="size-5 rounded-full bg-[#121212] text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 4. Membership & Pricing Rail Style Setting */}
            {onChangePricingVariant && (
              <div className="py-4 border-b border-[#e5ded2]">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#555] mb-3">
                  Membership &amp; Pricing Rail — Layout Style
                </label>

                <div className="space-y-2.5 mb-4">
                  {/* Option 1: Visual Rail */}
                  <button
                    type="button"
                    onClick={() => onChangePricingVariant('visual')}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      activePricingVariant === 'visual'
                        ? 'bg-white border-[#121212] shadow-sm'
                        : 'bg-[#eee8dc] border-[#ded6c7] hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                          activePricingVariant === 'visual'
                            ? 'bg-[#121212] text-white'
                            : 'bg-[#ded6c7] text-[#555]'
                        }`}
                      >
                        <ImageIcon className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#121212]">
                            Variant 1: Wide Cards
                          </span>
                        </div>
                        <p className="text-xs text-[#666] mt-0.5 leading-relaxed">
                          Wide two-column cards — plan and price on the left, full feature ladder on the right.
                        </p>
                      </div>
                    </div>

                    {activePricingVariant === 'visual' && (
                      <div className="size-5 rounded-full bg-[#121212] text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  {/* Option 2: Tall Cards (No Photos) */}
                  <button
                    type="button"
                    onClick={() => onChangePricingVariant('tall')}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      activePricingVariant === 'tall'
                        ? 'bg-white border-[#121212] shadow-sm'
                        : 'bg-[#eee8dc] border-[#ded6c7] hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                          activePricingVariant === 'tall'
                            ? 'bg-[#121212] text-white'
                            : 'bg-[#ded6c7] text-[#555]'
                        }`}
                      >
                        <LayoutTemplate className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#121212]">
                            Variant 2: Tall Cards
                          </span>
                        </div>
                        <p className="text-xs text-[#666] mt-0.5 leading-relaxed">
                          Narrow vertical cards, several visible side-by-side, fully scrollable.
                        </p>
                      </div>
                    </div>

                    {activePricingVariant === 'tall' && (
                      <div className="size-5 rounded-full bg-[#121212] text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-3 border-t border-[#e5ded2] flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-full bg-[#121212] hover:bg-neutral-800 text-white text-xs font-semibold tracking-tight transition cursor-pointer"
              >
                Apply &amp; Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
