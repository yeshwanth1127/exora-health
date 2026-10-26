import { clientPackages } from '../../data/clientPackages';
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
    "id": "diabetic-check-up",
    "name": "Diabetic Check Up",
    "subtitle": "One-time health check-up",
    "badge": "Published",
    "isRecommended": false,
    "annualPrice": "\u20b9749",
    "annualPriceMonthlyEquiv": "Confirm inclusions with hospital",
    "monthlyPrice": "\u20b92,699",
    "originalAnnualPrice": "\u20b91,000",
    "originalMonthlyPrice": "\u20b93,955",
    "description": "A focused check-up for diabetes monitoring.",
    "inclusions": [
      "Hospital-based health screening",
      "Discuss preparation with the hospital",
      "Confirm the exact list of tests",
      "Contact the hospital for current pricing"
    ],
    "ctaText": "Ask about this package"
  },
  {
    "id": "fertility-health-check-up",
    "name": "Fertility Health Check Up",
    "subtitle": "One-time health check-up",
    "badge": "Published",
    "isRecommended": true,
    "annualPrice": "\u20b93,699",
    "annualPriceMonthlyEquiv": "Confirm inclusions with hospital",
    "monthlyPrice": "\u20b93,199",
    "originalAnnualPrice": "\u20b94,955",
    "originalMonthlyPrice": "\u20b94,955",
    "description": "A fertility health assessment package.",
    "inclusions": [
      "Hospital-based health screening",
      "Discuss preparation with the hospital",
      "Confirm the exact list of tests",
      "Contact the hospital for current pricing"
    ],
    "ctaText": "Ask about this package"
  },
  {
    "id": "general-diabetic-health-check-up",
    "name": "General Diabetic Health Check Up",
    "subtitle": "One-time health check-up",
    "badge": "Published",
    "isRecommended": false,
    "annualPrice": "\u20b92,399",
    "annualPriceMonthlyEquiv": "Confirm inclusions with hospital",
    "monthlyPrice": "\u20b93,999",
    "originalAnnualPrice": "\u20b93,955",
    "originalMonthlyPrice": "\u20b94,955",
    "description": "A broader diabetic health profile.",
    "inclusions": [
      "Hospital-based health screening",
      "Discuss preparation with the hospital",
      "Confirm the exact list of tests",
      "Contact the hospital for current pricing"
    ],
    "ctaText": "Ask about this package"
  }
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
              Health checks for you and your family.
            </h2>
            <p className="text-sm sm:text-base text-[#5c5850] leading-relaxed">
              Published one-time check-up prices from Sri Lakshmi Hospital. Confirm inclusions and current offers before booking.
            </p>
          </div>

          {/* Billing Switcher (Inspired by reference screenshot) */}
          <div className="inline-flex items-center self-start md:self-auto p-1.5 bg-[#ede6d9] rounded-full border border-[#ded5c6] shadow-xs">
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                billingCycle === 'annual'
                  ? 'bg-[#24553c] text-white shadow-xs'
                  : 'text-[#5c5850] hover:text-[#1c1a17]'
              }`}
            >
              <span>Essential checks</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#dcebd9] text-[#24553c]">
                One-time
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-[#24553c] text-white shadow-xs'
                  : 'text-[#5c5850] hover:text-[#1c1a17]'
              }`}
            >
              More checks
            </button>
          </div>
        </div>

        {/* Static 3-Tier Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {staticThreeTiers.map((baseTier, index) => {
            const selected = clientPackages[billingCycle === 'annual' ? index : index + 3];
            const tier = { ...baseTier, name: selected.name, description: selected.description };

            const isRec = tier.isRecommended;

            return (
              <div
                key={tier.id}
                className={`relative rounded-[28px] transition-all duration-300 flex flex-col justify-between ${
                  isRec
                    ? 'bg-[#e7f0e4] text-[#17372b] border-2 border-[#9ebda2] shadow-[0_20px_50px_rgba(31,80,47,0.09)] p-7 sm:p-8 lg:-translate-y-2'
                    : 'bg-white text-[#1c1a17] border border-[#ded7cb] shadow-[0_8px_30px_rgba(28,26,23,0.04)] hover:border-[#c5bba9] hover:shadow-md p-7 sm:p-8'
                }`}
              >
                {/* Recommended Badge */}
                {isRec && (
                  <div className="absolute -top-3.5 left-7 sm:left-8 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#24553c] text-white border border-[#24553c] shadow-sm text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="size-3.5 text-[#d9ecd5] fill-[#d9ecd5]" />
                    <span>Health check-up</span>
                  </div>
                )}

                {/* Top Half: Header, Pricing, Description */}
                <div>
                  {/* Title & Badge Row (Small pill indicator removed) */}
                  <div className="flex items-start justify-between gap-3 mb-4 pt-1">
                    <div>
                      <h3
                        className={`text-xl sm:text-2xl font-bold tracking-tight leading-snug ${
                          isRec ? 'text-[#17372b]' : 'text-[#1c1a17]'
                        }`}
                      >
                        {tier.name}
                      </h3>
                      <p
                        className={`text-xs font-medium mt-1 ${
                          isRec ? 'text-[#587462]' : 'text-[#787267]'
                        }`}
                      >
                        {tier.subtitle}
                      </p>
                    </div>

                    {tier.badge && (
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                          isRec
                            ? 'bg-[#d4e6d2] text-[#24553c] border border-[#a9c8ac]'
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
                            isRec ? 'text-[#829987]' : 'text-zinc-400'
                          }`}
                        >
                          {billingCycle === 'annual'
                            ? tier.originalAnnualPrice
                            : tier.originalMonthlyPrice}
                        </span>
                      )}

                      <span
                        className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                          isRec ? 'text-[#17372b]' : 'text-[#1c1a17]'
                        }`}
                      >
                        {billingCycle === 'annual' ? tier.annualPrice : tier.monthlyPrice}
                      </span>

                      <span
                        className={`text-xs sm:text-sm font-medium ${
                          isRec ? 'text-[#587462]' : 'text-[#736e65]'
                        }`}
                      >
                        {'/ check-up'}
                      </span>
                    </div>

                    <p
                      className={`text-xs font-medium mt-1.5 ${
                        isRec ? 'text-[#617766]' : 'text-[#787267]'
                      }`}
                    >
                      {billingCycle === 'annual'
                        ? 'Published website price · confirm before booking'
                        : 'Published website price · confirm before booking'}
                    </p>
                  </div>

                  {/* Description */}
                  <p
                    className={`text-xs sm:text-[13px] leading-relaxed font-normal mb-6 ${
                      isRec ? 'text-[#4f6756]' : 'text-[#5c5850]'
                    }`}
                  >
                    {tier.description}
                  </p>
                </div>

                {/* Middle Divider: Subtle Dashed Line */}
                <div
                  className={`border-t border-dashed my-2 ${
                    isRec ? 'border-[#a9c7ab]' : 'border-[#ded5c6]'
                  }`}
                />

                {/* Bottom Half: Features List & CTA Button */}
                <div className="pt-4 flex flex-col flex-1 justify-between">
                  <div>
                    <h4
                      className={`font-semibold text-xs tracking-tight uppercase mb-4 ${
                        isRec ? 'text-[#24553c]' : 'text-[#1c1a17]'
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
                                ? 'bg-[#c5ddc2] text-[#24553c]'
                                : 'bg-[#10b981]/15 text-[#059669]'
                            }`}
                          >
                            <Check className="size-2.5 stroke-[3]" />
                          </span>
                          <span
                            className={`text-xs sm:text-[12.5px] leading-snug font-normal ${
                              isRec ? 'text-[#324b39]' : 'text-[#3d3a35]'
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
                              isRec ? 'text-[#7d9381]' : 'text-[#736e65]'
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
                        ? 'bg-[#24553c] hover:bg-[#173f2d] text-white shadow-md hover:shadow-lg'
                        : 'border-2 border-[#24553c] text-[#24553c] hover:bg-[#24553c] hover:text-white'
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
                Looking for cardiac or complete health checks?
              </p>
              <p className="text-xs text-[#736e65] mt-0.5">
                Complete Health CheckUp: ₹8,599 · Cardiac Health Check Up: ₹2,500. Confirm the test list, preparation and current offers with the hospital.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onBookPackage?.('Health packages')}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-semibold bg-[#1c1a17] text-white hover:bg-black transition-all cursor-pointer shrink-0 shadow-xs active:scale-95"
          >
            <span>View all health packages</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
