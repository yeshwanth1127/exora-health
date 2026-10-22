const guides: Record<string, { pose: string }> = {
  facility: { pose: "welcome" },
  volume: { pose: "planning" },
  target: { pose: "planning" },
  marketing: { pose: "planning" },
  business: { pose: "planning" },
  website: { pose: "choosing" },
  contact: { pose: "welcome" },
  offer: { pose: "ready" },
  phone: { pose: "welcome" },
  otp: { pose: "planning" },
  profile: { pose: "ready" },
};

export default function OnboardingMascot({ stage, compact = false, account = false }: { stage: string; compact?: boolean; account?: boolean }) {
  const guide = guides[stage] || guides.facility;
  const asset = account ? `account-${stage === "otp" ? "verification" : stage === "phone" ? "phone" : "profile"}` : `doctor-${guide.pose}`;
  return <aside className={`onboarding-mascot${compact ? " is-compact" : ""}`} aria-hidden="true">
    <div className="onboarding-mascot-art"><img key={asset} src={`/assets/capture-onboarding/${asset}.webp`} width="320" height="320" alt="" /></div>
  </aside>;
}
