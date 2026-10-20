import { HospitalLogo } from './HospitalLogo';
import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { ArrowRight, Phone, MessageCircle, MapPin, ShieldCheck } from 'lucide-react';
import { departments } from '../../data/departments';
import { branches } from '../../data/branches';

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const footerColumns = [
  {
    title: 'SPECIALTIES',
    links: departments.map((d) => ({ label: d.name, href: `/?page=department&id=${d.id}` })),
  },
  {
    title: 'BRANCHES',
    links: branches.map((b) => ({ label: b.name, href: `/?page=location&id=${b.id}` })),
  },
  {
    title: 'PATIENTS',
    links: [
      { label: 'Book an Appointment', href: '/?page=doctors' },
      { label: 'Insurance', href: '/?page=insurance' },
      { label: 'Pricing information', href: '/?page=insurance-pricing' },
      { label: 'How Care Works', href: '/?page=how-it-works' },
      { label: 'Contact Us', href: '/?page=contact' },
      { label: 'Our Medical Team', href: '/?page=doctors' },
      { label: 'Patient Reviews & Stories', href: '/#testimonials' },
      { label: 'Frequently Asked Questions', href: '/?page=faq' },
      { label: 'Articles & guides', href: '/?page=blog' },
    ],
  },
  {
    title: 'LEGAL & POLICIES',
    links: [
      { label: 'Terms of Service', legal: 'terms' },
      { label: 'Patient Privacy Notice (DPDP)', legal: 'privacy' },
      { label: 'Teleconsultation Consent', legal: 'telehealth' },
      { label: 'Health Data & ABHA Policy', legal: 'records' },
      { label: 'Cashless Insurance & Billing', legal: 'billing' },
      { label: 'Cancellation & Refund Policy', legal: 'refund' },
    ],
  },
];

const socialIcons = [
  { icon: TwitterIcon, label: 'Twitter / X', href: 'https://twitter.com' },
  { icon: InstagramIcon, label: 'Instagram', href: 'https://instagram.com' },
  { icon: LinkedinIcon, label: 'LinkedIn', href: 'https://linkedin.com' },
  { icon: MessageCircle, label: 'WhatsApp', href: 'https://wa.me/919901711716' },
];

const imageReveal: Variants = {
  hidden: { opacity: 0, scale: 1.03 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] },
  },
};

const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const riseUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 220, damping: 28, mass: 0.9 },
  },
};

const linkCascade: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.03, delayChildren: 0.03 },
  },
};

const linkTrickle: Variants = {
  hidden: { opacity: 0, x: -6 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 350, damping: 30, mass: 0.6 },
  },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
};

interface FooterProps {
  onOpenBooking?: () => void;
  onOpenLegal?: (docId?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenBooking, onOpenLegal }) => {
  return (
    <footer
      className="relative w-full overflow-hidden bg-[#121212] text-white [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif] antialiased selection:bg-white selection:text-black rounded-t-[16px] sm:rounded-t-[20px] border-t border-x border-[#262626]/80 shadow-[0_-8px_30px_rgba(0,0,0,0.1)]"
      aria-label="Site footer"
      id="contact"
    >
      {/* ── Top Atmospheric Banner (End-to-End, Refined Scale) ── */}
      <div className="relative w-full overflow-hidden rounded-t-[16px] sm:rounded-t-[20px]">
        <motion.div
          variants={imageReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="relative h-[220px] sm:h-[260px] md:h-[300px] w-full"
        >
          {/* Clean modern clinic architectural interior with soft ambient light */}
          <img
            src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=2400&q=85"
            alt="Sri Lakshmi Hospital Healing Environment"
            className="h-full w-full object-cover object-center filter brightness-[0.65] contrast-[1.05]"
          />
        </motion.div>

        {/* Gradient overlay: smooth blend into solid dark footer */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(18,18,18,0.15) 0%, rgba(18,18,18,0.65) 60%, #121212 100%)',
          }}
        />

        {/* Banner Content Overlay (End to End) */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          className="absolute inset-0 flex flex-col justify-center w-full px-6 sm:px-12 lg:px-20"
        >
          <motion.h2
            variants={riseUp}
            className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-medium leading-[1.15] tracking-[-1.2px] text-white [font-family:Family,_-apple-system,_'system-ui',_'Segoe_UI',_Helvetica,_'Apple_Color_Emoji',_Arial,_sans-serif]"
          >
            The future of care is
            <br />
            <span className="text-[#e8ded0]">compassionate &amp; adaptive.</span>
          </motion.h2>

          <motion.div variants={riseUp} className="mt-5 flex flex-wrap items-center gap-4">
            <button
              onClick={onOpenBooking}
              type="button"
              className="group inline-flex items-center gap-2.5 rounded-full bg-white hover:bg-neutral-100 py-2.5 pl-5 pr-2 text-sm font-medium text-black shadow-lg transition-all active:scale-[0.97] cursor-pointer"
            >
              <span>Book a consultation</span>
              <span className="flex size-6 items-center justify-center rounded-full bg-black/10 transition-transform duration-200 group-hover:translate-x-1">
                <ArrowRight className="size-3.5" />
              </span>
            </button>

            <a
              href="tel:+919901711716"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-normal text-neutral-300 hover:text-white px-4 py-2 rounded-full border border-white/15 hover:border-white/40 transition"
            >
              <Phone className="size-3.5 text-[#e04a36]" />
              <span>24/7 Helpline: +91 99017 11716</span>
            </a>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Main Footer Grid (End to End across full viewport width) ── */}
      <div className="w-full px-6 sm:px-12 lg:px-20 pt-12 pb-0">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8"
        >
          {/* Brand Block — 3 Columns */}
          <motion.div
            variants={riseUp}
            className="flex flex-col gap-4 sm:col-span-2 lg:col-span-3"
          >
            {/* Sri Lakshmi Hospital Brand Mark in Family Typography */}
            <div className="flex items-center gap-2.5">
              <HospitalLogo className="size-8" />
              <span className="text-xl font-medium tracking-[-0.5px] text-white">
                Sri Lakshmi Hospital
              </span>
            </div>

            <p className="max-w-[260px] text-xs sm:text-[13px] leading-relaxed text-neutral-400 tracking-[-0.1px]">
              Crafting high-touch hospital care, preventative medicine, and trusted clinical excellence across Bengaluru.
            </p>

            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
              <span>NABH &amp; NABL Accredited Center</span>
            </div>

            <button
              onClick={onOpenBooking}
              type="button"
              className="inline-flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-white shadow-[0_0_0_1px_rgba(255,255,255,0.2)] transition-[background-color,box-shadow,transform] duration-200 hover:bg-white/10 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.35)] cursor-pointer mt-1"
            >
              <span>Get in touch</span>
              <ArrowRight className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </motion.div>

          {/* Navigation Columns — 6 Columns (4 sub-columns) in Family Typography */}
          <motion.nav
            variants={staggerContainer}
            aria-label="Footer navigation"
            className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4 lg:col-span-6 lg:ml-2"
          >
            {footerColumns.map((col) => (
              <motion.div key={col.title} variants={riseUp} className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold tracking-wider text-neutral-200 uppercase">
                  {col.title}
                </h3>

                <motion.ul variants={linkCascade} className="flex flex-col gap-2">
                  {col.links.map((link) => (
                    <motion.li key={link.label} variants={linkTrickle}>
                      {'legal' in link ? (
                        <button
                          type="button"
                          onClick={() => onOpenLegal?.(link.legal)}
                          className="inline-block text-left text-xs sm:text-[13px] leading-snug text-neutral-400 transition-colors duration-150 hover:text-white cursor-pointer"
                        >
                          {link.label}
                        </button>
                      ) : (
                        <a
                          href={link.href}
                          className="inline-block text-xs sm:text-[13px] leading-snug text-neutral-400 transition-colors duration-150 hover:text-white"
                        >
                          {link.label}
                        </a>
                      )}
                    </motion.li>
                  ))}
                </motion.ul>
              </motion.div>
            ))}
          </motion.nav>

          {/* Connect & Address Block — 3 Columns in Family Typography */}
          <motion.div variants={riseUp} className="flex flex-col gap-3 sm:col-span-2 lg:col-span-3">
            <h3 className="text-xs font-semibold tracking-wider text-neutral-200 uppercase">
              Stay Connected
            </h3>
            
            <p className="text-xs sm:text-[13px] leading-relaxed text-neutral-400">
              Follow our clinical updates, wellness research, and preventative health releases.
            </p>

            {/* Social Icons row */}
            <div className="flex items-center gap-2 pt-1">
              {socialIcons.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex size-8 items-center justify-center rounded-full bg-white/5 text-neutral-400 shadow-[0_0_0_1px_rgba(255,255,255,0.1)] transition-[background-color,color,box-shadow,transform] duration-150 hover:bg-white/15 hover:text-white hover:scale-105"
                >
                  <Icon className="size-3.5" />
                </a>
              ))}
            </div>

            {/* Clinic Address snippet */}
            <div className="mt-2 pt-3 border-t border-white/10 flex items-start gap-2 text-xs text-neutral-400">
              <MapPin className="size-4 text-[#e04a36] shrink-0 mt-0.5" />
              <span>#301, Old Extension, KR Puram, Bengaluru 560036</span>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Sub-Footer Legal & Copyright Bar (Clean Bottom) ── */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/[0.08] pt-6 pb-8 text-xs text-neutral-500 sm:flex-row sm:items-center"
        >
          <p className="leading-none tabular-nums">
            &copy; 2026 Sri Lakshmi Super Speciality Hospital. All rights reserved. KPME Reg. #BLR-2024-889.
          </p>

          <div className="flex flex-wrap items-center gap-5 leading-none">
            <button
              onClick={() => onOpenLegal ? onOpenLegal('privacy') : window.location.assign('/?page=legal&doc=privacy')}
              className="transition-colors duration-150 hover:text-neutral-200 cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => onOpenLegal ? onOpenLegal('terms') : window.location.assign('/?page=legal&doc=terms')}
              className="transition-colors duration-150 hover:text-neutral-200 cursor-pointer"
            >
              Terms of Service
            </button>
            <button
              onClick={() => onOpenLegal ? onOpenLegal('telehealth') : window.location.assign('/?page=legal&doc=telehealth')}
              className="transition-colors duration-150 hover:text-neutral-200 cursor-pointer"
            >
              Teleconsultation Consent
            </button>
            <button
              onClick={() => onOpenLegal ? onOpenLegal() : window.location.assign('/?page=legal')}
              className="transition-colors duration-150 hover:text-neutral-200 cursor-pointer"
            >
              Hospital Legal Hub
            </button>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};
