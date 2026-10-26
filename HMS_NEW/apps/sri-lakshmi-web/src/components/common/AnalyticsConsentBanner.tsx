import { useState, useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { getAnalyticsConsent, setAnalyticsConsent, type AnalyticsConsent } from '../../lib/posthog';

export function AnalyticsConsentBanner() {
  const [consent, setConsent] = useState<AnalyticsConsent>('granted'); // default to granted or check on mount
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setConsent(getAnalyticsConsent());

    const handleConsentChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ consent: AnalyticsConsent }>;
      if (customEvent.detail?.consent) {
        setConsent(customEvent.detail.consent);
      }
    };

    window.addEventListener('avocado_consent_changed', handleConsentChanged);
    return () => window.removeEventListener('avocado_consent_changed', handleConsentChanged);
  }, []);

  if (!isClient || consent !== 'pending') {
    return null;
  }

  const handleAccept = () => {
    setAnalyticsConsent(true);
    setConsent('granted');
  };

  const handleDecline = () => {
    setAnalyticsConsent(false);
    setConsent('denied');
  };

  return (
    <aside
      role="region"
      aria-label="Privacy and product analytics preferences"
      className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-5 pointer-events-none"
    >
      <div className="max-w-4xl mx-auto bg-[#17372b] text-white p-4 sm:p-5 rounded-2xl shadow-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 pointer-events-auto backdrop-blur-md">
        <div className="flex items-start gap-3.5">
          <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-[#9fe1b9] mt-0.5">
            <ShieldCheck className="size-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold tracking-tight text-white">Privacy & Product Analytics</h4>
            <p className="text-sm text-white/80 leading-relaxed max-w-2xl">
              We use anonymous product analytics to understand navigation flows and improve the care experience.
              We <strong>never</strong> collect names, phone numbers, email, symptoms, or health data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
          <button
            type="button"
            onClick={handleDecline}
            className="min-h-11 px-4 py-2 rounded-xl text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="min-h-11 px-5 py-2 rounded-xl text-xs font-semibold bg-[#2e6d4c] hover:bg-[#38855c] text-white shadow-xs transition-colors cursor-pointer"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={handleDecline}
            aria-label="Close analytics banner and decline"
            className="size-11 grid place-items-center rounded-lg text-white/50 hover:text-white transition-colors cursor-pointer ml-1"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
