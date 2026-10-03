import { ArrowRight, HeartHandshake, MessageCircleHeart, Video } from 'lucide-react';

interface Props {
  onBookInPerson?: () => void;
  onBookVirtual?: () => void;
}

export function LightWhyChooseUsSection({ onBookInPerson, onBookVirtual }: Props) {
  return <section id="why-choose-us" className="border-b border-[#e0e9dc] bg-[#f2f6ee] py-20 sm:py-28">
    <div className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12">
      <div className="mb-10 grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
        <div><p className="mb-4 text-xs font-bold tracking-[.2em] text-[#5f8065]">HOW AVOCADO WORKS</p><h2 className="font-medium text-5xl sm:text-6xl tracking-[-.05em] leading-[1.04] text-[#17372b]">Care that fits your life.</h2></div>
        <p className="max-w-xl text-base sm:text-lg leading-relaxed text-[#5b7061]">Start with the kind of visit that works for you. We’ll help you understand your options and choose your next step.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <button onClick={onBookInPerson} className="group flex min-h-[280px] flex-col items-start justify-between rounded-[1.6rem] border border-[#d5e3d2] bg-[#fffefa] p-7 text-left transition-all hover:-translate-y-1 hover:shadow-[0_16px_35px_rgba(31,75,41,.08)] sm:p-9">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-[#e0ede0] text-[#316a47]"><HeartHandshake size={28} strokeWidth={1.5} /></span>
          <div><p className="mb-2 text-[11px] font-bold tracking-[.16em] text-[#729077]">VISIT A CLINIC</p><h3 className="font-medium text-3xl sm:text-4xl tracking-[-.04em] text-[#17372b]">In-person care</h3><p className="mt-3 max-w-md text-sm leading-relaxed text-[#617467]">Meet your doctor face to face at an Avocado clinic for an unhurried conversation and a clear care plan.</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#2b6242]">Book an in-person visit <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></span></div>
        </button>
        <button onClick={onBookVirtual} className="group flex min-h-[280px] flex-col items-start justify-between rounded-[1.6rem] border border-[#cfe0d0] bg-[#e0ede0] p-7 text-left transition-all hover:-translate-y-1 hover:shadow-[0_16px_35px_rgba(31,75,41,.08)] sm:p-9">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-[#fffefa] text-[#316a47]"><Video size={28} strokeWidth={1.5} /></span>
          <div><p className="mb-2 text-[11px] font-bold tracking-[.16em] text-[#648a6b]">CARE FROM WHERE YOU ARE</p><h3 className="font-medium text-3xl sm:text-4xl tracking-[-.04em] text-[#17372b]">Virtual care</h3><p className="mt-3 max-w-md text-sm leading-relaxed text-[#536d5a]">Connect with a doctor remotely when a virtual conversation is the right place to begin.</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#2b6242]">Explore virtual visits <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></span></div>
        </button>
      </div>
      <div className="mt-10 grid gap-5 border-t border-[#cfdfce] pt-10 md:grid-cols-3">
        {[
          { icon: MessageCircleHeart, title: 'Start with a conversation', copy: 'Tell us what is going on, in your own words.' },
          { icon: HeartHandshake, title: 'Find your people', copy: 'Browse care teams by specialty and location.' },
          { icon: ArrowRight, title: 'Move forward clearly', copy: 'See available paths to appointments and follow-up.' },
        ].map(item => <div key={item.title} className="flex gap-4"><item.icon size={22} strokeWidth={1.6} className="mt-0.5 shrink-0 text-[#4f805c]" /><div><h3 className="text-base font-semibold text-[#17372b]">{item.title}</h3><p className="mt-1 text-sm leading-relaxed text-[#667b6b]">{item.copy}</p></div></div>)}
      </div>
    </div>
  </section>;
}
