import { trackContactIntent } from '../../lib/posthog';

interface ClinicAnnouncementProps {
  onClaimOffer?: () => void;
  onClose?: () => void;
}

/** Sample-content disclosure and clinic phone above the main navigation. */
export const ClinicAnnouncement: React.FC<ClinicAnnouncementProps> = () => (
  <div className="border-b border-[#e1e8db] bg-[#eef3e9] text-[#304b39]">
    <div className="mx-auto flex min-h-9 max-w-[1360px] items-center justify-between gap-3 px-5 py-1.5 sm:px-8 lg:px-12">
      <p className="min-w-0 text-[10px] leading-tight sm:text-xs">
        <strong className="font-semibold">Client demo:</strong>{' '}
        <span className="sm:hidden">Sri Lakshmi Hospital</span>
        <span className="hidden sm:inline">Sri Lakshmi Hospital · KR Puram · published website information.</span>
      </p>
      <a
        href="tel:+919901711716"
        onClick={() => trackContactIntent('home', 'phone')}
        className="shrink-0 text-[10px] font-semibold hover:underline underline-offset-2 sm:text-xs"
      >
        <span className="hidden sm:inline">24/7 emergency&nbsp; </span>
        <span className="sm:hidden">Emergency&nbsp; </span>
        99017 11716
      </a>
    </div>
  </div>
);
