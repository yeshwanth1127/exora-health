import React, { useState } from 'react';
import {
  Check,
  X,
  Sparkles,
  ArrowRight,
  HeartHandshake,
} from 'lucide-react';

export type PricingRailVariant = 'visual' | 'tall';
export type BillingCycle = 'annual' | 'monthly';

interface PricingTierData {
  id: string;
  name: string;
  subtitle: string;
  badge?: string;
  isRecommended?: boolean;
  annualPrice: string;
  annualPriceMonthlyEquiv: string;
  monthlyPrice: string;
  originalAnnualPrice?: string;
  originalMonthlyPrice?: string;
  description: string;
  inclusions: string[];
  exclusions?: string[];
  ctaText: string;
}

const staticThreeTiers: PricingTierData[] = [
  {
    id: 'tier-signature',
    name: 'Avocado Signature',
    subtitle: 'Concierge Primary Care',
    badge: 'Active •',
    isRecommended: false,
    annualPrice: '₹4,999',
    annualPriceMonthlyEquiv: '₹416 / mo',
    monthlyPrice: '₹499',
    description:
      'Seamless primary, urgent, and telemedicine care for individuals and households who value continuous, unhurried physician access.',
    inclusions: [
      'Unlimited 24/7 virtual care with senior family physicians',
      'Zero wait-time priority access at our Indiranagar clinic',
      'Complimentary doorstep diagnostic sample collection',
      'Annual preventive baseline screen & digital health passport',
      'Direct WhatsApp standby with dedicated care team',
    ],
    exclusions: [
      'Full-body DEXA scan & cellular biomarker mapping',
      'Toxic heavy metals & full hormone matrix review',
    ],
    ctaText: 'Get Started with Signature',
  },
  {
    id: 'tier-longevity',
    name: 'Avocado Longevity 360',
    subtitle: 'Signature Diagnostic & Cellular Health',
    badge: 'Save 25% •',
    isRecommended: true,
    annualPrice: '₹14,999',
    annualPriceMonthlyEquiv: '₹1,250 / mo',
    monthlyPrice: '₹1,499',
    originalAnnualPrice: '₹19,999',
    originalMonthlyPrice: '₹1,800',
    description:
      'Our flagship comprehensive screening combining low-dose whole-body DEXA imaging, 96+ biomarker metabolic mapping, and cardiac ultrasound.',
    inclusions: [
      'Everything in Avocado Signature, plus:',
      'Full-body DEXA composition scan & abdominal sonography',
      '96+ advanced blood biomarkers (ApoB, hs-CRP, HbA1c, Homocysteine)',
      '1-on-1 longevity physician & senior cardiologist roadmap',
      'Personalized genetic health risk scoring & biological age review',
      'Comprehensive nutrition, sleep & cardiovascular protocol',
    ],
    exclusions: [
      'Continuous glucose monitor (CGM) sensor & private suite access',
    ],
    ctaText: 'Start with Longevity 360',
  },
  {
    id: 'tier-executive',
    name: 'Avocado Executive 360',
    subtitle: 'Leadership & Peak Performance',
    badge: 'Popular •',
    isRecommended: false,
    annualPrice: '₹24,999',
    annualPriceMonthlyEquiv: '₹2,083 / mo',
    monthlyPrice: '₹2,499',
    description:
      'Engineered for founders, executives, and high-performers demanding private physician oversight, toxicology screening, and vitality protection.',
    inclusions: [
      'Everything in Longevity 360, plus:',
      'Multi-specialty health board review (Cardiology & Endocrinology)',
      'Coronary calcium score & carotid intima-media Doppler study',
      'Toxic heavy metals screen (Lead, Mercury, Arsenic) & hormone matrix',
      'Dedicated executive health navigator & expedited hospital OPD admission',
      'Continuous glucose monitor (CGM) 14-day tracking sensor',
      'Private clinical lounge suite with zero waiting',
    ],
    ctaText: 'Get Started with Executive',
  },
];

interface PricingRailSectionProps {
  onBookPackage?: (packageName: string) => void;
  onExploreAll?: () => void;
  variant?: string;
  onVariantChange?: (variant: any) => void;
  tabPosition?: string;
  onTabPositionChange?: (position: any) => void;
}

export const PricingRailSection: React.FC<PricingRailSectionProps> = ({
  onBookPackage,
}) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');

  return (
    <section
      id="packages"
      className="relative w-full py-16 sm:py-20 bg-[#faf7f2] border-t border-[#ebe4d8] select-none"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Block: Title, Subtitle, and Annual/Monthly Toggle */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 sm:mb-16">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1c1a17] tracking-tight leading-tight mb-3">
              Health care designed around your life, not the system.
            </h2>
            <p className="text-sm sm:text-base text-[#5c5850] leading-relaxed">
              Transparent membership tiers with unhurried doctor consultations, zero co-pays, and proactive cellular diagnostics.
            </p>
          </div>

          {/* Billing Switcher (Inspired by reference screenshot) */}
          <div className="inline-flex items-center self-start md:self-auto p-1.5 bg-[#ede6d9] rounded-full border border-[#ded5c6] shadow-xs">
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                billingCycle === 'annual'
                  ? 'bg-[#1c1a17] text-white shadow-xs'
                  : 'text-[#5c5850] hover:text-[#1c1a17]'
              }`}
            >
              <span>Annual</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#ede9fe] text-[#5b21b6]">
                Save 25%
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-[#1c1a17] text-white shadow-xs'
                  : 'text-[#5c5850] hover:text-[#1c1a17]'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Static 3-Tier Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {staticThreeTiers.map((tier) => {
            const isRec = tier.isRecommended;

            return (
              <div
                key={tier.id}
                className={`relative rounded-[28px] transition-all duration-300 flex flex-col justify-between ${
                  isRec
                    ? 'bg-[#1c1a17] text-white border-2 border-[#8b5cf6]/40 shadow-[0_20px_50px_rgba(139,92,246,0.12)] p-7 sm:p-8 lg:-translate-y-2'
                    : 'bg-white text-[#1c1a17] border border-[#ded7cb] shadow-[0_8px_30px_rgba(28,26,23,0.04)] hover:border-[#c5bba9] hover:shadow-md p-7 sm:p-8'
                }`}
              >
                {/* Recommended Badge with Normal Curve & Soothing Lavender */}
                {isRec && (
                  <div className="absolute -top-3.5 left-7 sm:left-8 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#ede9fe] text-[#5b21b6] border border-[#c4b5fd] shadow-sm text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="size-3.5 text-[#7c3aed] fill-[#7c3aed]" />
                    <span>Recommended</span>
                  </div>
                )}

                {/* Top Half: Header, Pricing, Description */}
                <div>
                  {/* Title & Badge Row (Small pill indicator removed) */}
                  <div className="flex items-start justify-between gap-3 mb-4 pt-1">
                    <div>
                      <h3
                        className={`text-xl sm:text-2xl font-bold tracking-tight leading-snug ${
                          isRec ? 'text-white' : 'text-[#1c1a17]'
                        }`}
                      >
                        {tier.name}
                      </h3>
                      <p
                        className={`text-xs font-medium mt-1 ${
                          isRec ? 'text-[#c4b5fd]' : 'text-[#787267]'
                        }`}
                      >
                        {tier.subtitle}
                      </p>
                    </div>

                    {tier.badge && (
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                          isRec
                            ? 'bg-[#ede9fe]/15 text-[#ddd6fe] border border-[#a78bfa]/30'
                            : 'bg-[#f4efe6] text-[#736e65] border border-[#ded5c6]'
                        }`}
                      >
                        {tier.badge}
                      </span>
                    )}
                  </div>

                  {/* Price Row */}
                  <div className="mb-4">
                    <div className="flex items-baseline gap-2">
                      {isRec && (
                        <span
                          className={`text-base sm:text-lg line-through font-medium ${
                            isRec ? 'text-zinc-500' : 'text-zinc-400'
                          }`}
                        >
                          {billingCycle === 'annual'
                            ? tier.originalAnnualPrice
                            : tier.originalMonthlyPrice}
                        </span>
                      )}

                      <span
                        className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                          isRec ? 'text-[#f5f3ff]' : 'text-[#1c1a17]'
                        }`}
                      >
                        {billingCycle === 'annual' ? tier.annualPrice : tier.monthlyPrice}
                      </span>

                      <span
                        className={`text-xs sm:text-sm font-medium ${
                          isRec ? 'text-[#c4b5fd]' : 'text-[#736e65]'
                        }`}
                      >
                        {billingCycle === 'annual' ? '/ year' : '/ month'}
                      </span>
                    </div>

                    <p
                      className={`text-xs font-medium mt-1.5 ${
                        isRec ? 'text-zinc-400' : 'text-[#787267]'
                      }`}
                    >
                      {billingCycle === 'annual'
                        ? `Equivalent to ${tier.annualPriceMonthlyEquiv} billed annually`
                        : 'Billed monthly • Cancel or adjust anytime'}
                    </p>
                  </div>

                  {/* Description */}
                  <p
                    className={`text-xs sm:text-[13px] leading-relaxed font-normal mb-6 ${
                      isRec ? 'text-zinc-300' : 'text-[#5c5850]'
                    }`}
                  >
                    {tier.description}
                  </p>
                </div>

                {/* Middle Divider: Subtle Dashed Line */}
                <div
                  className={`border-t border-dashed my-2 ${
                    isRec ? 'border-white/15' : 'border-[#ded5c6]'
                  }`}
                />

                {/* Bottom Half: Features List & CTA Button */}
                <div className="pt-4 flex flex-col flex-1 justify-between">
                  <div>
                    <h4
                      className={`font-semibold text-xs tracking-tight uppercase mb-4 ${
                        isRec ? 'text-[#ede9fe]' : 'text-[#1c1a17]'
                      }`}
                    >
                      What&apos;s Included
                    </h4>

                    {/* Features List */}
                    <ul className="space-y-3 mb-6">
                      {tier.inclusions.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span
                            className={`size-4.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${
                              isRec
                                ? 'bg-[#7c3aed]/25 text-[#ddd6fe]'
                                : 'bg-[#10b981]/15 text-[#059669]'
                            }`}
                          >
                            <Check className="size-2.5 stroke-[3]" />
                          </span>
                          <span
                            className={`text-xs sm:text-[12.5px] leading-snug font-normal ${
                              isRec ? 'text-zinc-200' : 'text-[#3d3a35]'
                            }`}
                          >
                            {item}
                          </span>
                        </li>
                      ))}

                      {/* Exclusions with subtle gray cross */}
                      {tier.exclusions?.map((exItem, idx) => (
                        <li key={`ex-${idx}`} className="flex items-start gap-2.5 opacity-40">
                          <span className="size-4.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-black/5 text-[#736e65]">
                            <X className="size-2.5 stroke-[2.5]" />
                          </span>
                          <span
                            className={`text-xs sm:text-[12.5px] leading-snug font-normal line-through ${
                              isRec ? 'text-zinc-400' : 'text-[#736e65]'
                            }`}
                          >
                            {exItem}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Clean CTA Button with Normal Curves */}
                  <button
                    type="button"
                    onClick={() => onBookPackage?.(tier.name)}
                    className={`w-full py-3.5 px-6 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 active:scale-95 cursor-pointer flex items-center justify-center gap-2 mt-auto shadow-xs ${
                      isRec
                        ? 'bg-[#ede9fe] hover:bg-white text-[#3b0764] shadow-md hover:shadow-lg'
                        : 'border-2 border-[#1c1a17] text-[#1c1a17] hover:bg-[#1c1a17] hover:text-white'
                    }`}
                  >
                    <span>{tier.ctaText}</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reassuring Footer Banner: Pediatrics & Flexible Coverage */}
        <div className="mt-12 p-6 rounded-[22px] bg-white border border-[#ded7cb] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-left">
            <div className="size-10 rounded-full bg-[#f4efe6] text-[#0f442c] flex items-center justify-center shrink-0">
              <HeartHandshake className="size-5 text-[#0f442c]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1c1a17]">
                Looking for dedicated Pediatric Care or Corporate Family Plans?
              </p>
              <p className="text-xs text-[#736e65] mt-0.5">
                Avocado Pediatrics provides 24/7 on-demand doctor WhatsApp standby, emergency house calls, and routine developmental checks for ₹8,999/year.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onBookPackage?.('Avocado Pediatrics Care')}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-semibold bg-[#1c1a17] text-white hover:bg-black transition-all cursor-pointer shrink-0 shadow-xs active:scale-95"
          >
            <span>Explore Pediatrics</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
