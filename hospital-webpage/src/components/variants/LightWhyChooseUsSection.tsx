import { ArrowRight, Phone } from 'lucide-react';
import { hospitalPhoto, reasons } from '../sections/WhyChooseUsSection';

interface Props {
  onBookInPerson?: () => void;
}

export function LightWhyChooseUsSection({ onBookInPerson }: Props) {
  return <section id="why-choose-us" className="border-b border-[#e0e9dc] bg-[#f2f6ee] py-20 sm:py-28">
    <div className="mx-auto grid max-w-[1360px] items-center gap-10 px-5 sm:px-8 lg:grid-cols-[5fr_7fr] lg:gap-16 lg:px-12">
      <img src={hospitalPhoto} alt="Nurse talking with a smiling senior patient in a hospital corridor" loading="lazy" className="aspect-[4/3] w-full rounded-[1.6rem] object-cover lg:aspect-square" />
      <div>
        <p className="mb-4 text-xs font-bold tracking-[.2em] text-[#5f8065]">WHY SRI LAKSHMI</p>
        <h2 className="font-medium text-5xl sm:text-6xl tracking-[-.05em] leading-[1.04] text-[#17372b]">Care your family can count on.</h2>
        <dl className="mt-10 divide-y divide-[#cfdfce] border-y border-[#cfdfce]">
          {reasons.map(reason => <div key={reason.title} className="grid gap-1 py-5 sm:grid-cols-[13rem_1fr] sm:items-baseline sm:gap-6">
            <dt className="font-medium text-4xl sm:text-5xl tracking-[-.04em] leading-none text-[#2b6242]">{reason.value}</dt>
            <dd><p className="text-base sm:text-lg font-semibold text-[#17372b]">{reason.title}</p><p className="mt-1 text-sm leading-relaxed text-[#667b6b]">{reason.body}</p></dd>
          </div>)}
        </dl>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <button type="button" onClick={onBookInPerson} className="group inline-flex items-center gap-2 rounded-full bg-[#2b6242] px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1f4a31]">Book a visit <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></button>
          <a href="tel:+919901711716" className="inline-flex items-center gap-2 text-sm font-semibold text-[#17372b] hover:text-[#2b6242]"><Phone size={16} className="text-[#2b6242]" />24/7 emergency: 99017 11716</a>
        </div>
      </div>
    </div>
  </section>;
}
