import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { Breadcrumbs } from '../common/Breadcrumbs';

interface Props {
  user: { name: string; identifier: string } | null;
  onBackToHome: () => void;
  onOpenLogin: () => void;
  onViewPricing: () => void;
}

export function InsuranceAccessPage({ user, onBackToHome, onOpenLogin, onViewPricing }: Props) {
  return <div className="min-h-[75dvh] bg-[#f7f7f2] text-[#203a2c]">
    <div className="mx-auto max-w-[1240px] px-5 pt-7 sm:px-10 lg:px-14"><Breadcrumbs items={[{ label: 'Home', onClick: onBackToHome }, { label: 'Insurance' }]} /></div>
    <section className="mx-auto grid max-w-[1240px] gap-12 px-5 pb-20 pt-14 sm:px-10 lg:grid-cols-[1fr_.82fr] lg:items-center lg:gap-20 lg:px-14 lg:pb-28 lg:pt-20">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#67846a]">Insurance & care</p>
        <h1 className="mt-6 max-w-[670px] text-[clamp(3.5rem,6.3vw,6.4rem)] font-medium leading-[.99] tracking-[-.06em]">Start with your account.</h1>
        <p className="mt-7 max-w-xl text-lg leading-relaxed text-[#5c6e60]">Log in to continue to the insurance area. You can also review general pricing information before you book.</p>
        <div className="mt-9 flex flex-wrap items-center gap-6">
          <button onClick={onOpenLogin} className="inline-flex min-h-12 items-center gap-3 bg-[#1f5037] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#153d2a] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#1f5037]">{user ? 'Open account login' : 'Log in to continue'} <ArrowRight size={17} /></button>
          <button onClick={onViewPricing} className="border-b border-[#315b40] pb-1 text-sm font-semibold hover:text-[#5c8663] focus-visible:outline-2 focus-visible:outline-offset-4">View pricing information</button>
        </div>
      </div>
      <aside className="border-t-4 border-[#2a6142] bg-white p-7 shadow-[0_18px_55px_rgba(32,58,44,.06)] sm:p-10">
        <ShieldCheck size={28} strokeWidth={1.5} className="text-[#3d7550]" />
        <h2 className="mt-8 text-2xl font-medium tracking-[-.035em]">Before your visit</h2>
        <p className="mt-3 leading-relaxed text-[#66766a]">Coverage can vary by insurer, policy, service, and location. Confirm your benefits and any expected payment with the care team before your appointment.</p>
        <div className="mt-8 border-t border-[#dce5da] pt-6"><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#748c78]">Have these ready</p><ul className="mt-4 space-y-3 text-sm text-[#496050]"><li>Insurer and policy information</li><li>The service or consultation you need</li><li>Any referral or prior report you have</li></ul></div>
      </aside>
    </section>
    <div className="border-t border-[#dce5da] bg-[#eef3eb]"><div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-5 py-7 text-sm text-[#5a705f] sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-14"><p>Online insurance eligibility is not connected in this preview.</p><button onClick={onBackToHome} className="inline-flex items-center gap-2 self-start font-semibold text-[#29573b] hover:underline"><ArrowLeft size={16} /> Back to home</button></div></div>
  </div>;
}
