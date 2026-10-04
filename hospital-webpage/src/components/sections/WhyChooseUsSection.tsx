import React from 'react';
import { ArrowRight, Phone } from 'lucide-react';
import { departments } from '../../data/departments';
import { doctors } from '../../data/doctors';

// Patient and experience figures supplied for the client demo, not taken from the hospital
// website; confirm them with the hospital before this goes live.
export const reasons = [
  {
    value: '50,000+',
    title: 'Patients cared for',
    body: 'Families across KR Puram and East Bengaluru have trusted Sri Lakshmi with their care.',
  },
  {
    value: '50+',
    title: 'Years of combined experience',
    body: 'Senior specialists who have spent decades treating patients in Bengaluru.',
  },
  {
    value: String(doctors.length),
    title: `Specialists across ${departments.length} departments`,
    body: 'Cardiology, urology, orthopaedics, gynaecology, nephrology and more, under one roof.',
  },
];

export const hospitalPhoto = '/clients/sri-lakshmi/339b1070-asian-female-doctor-talking-to-smiling-diverse-senior-female-patient-in-hospital-corridor-e1699179241527.jpg';

interface WhyChooseUsSectionProps {
  onBookInPerson?: () => void;
}

export const WhyChooseUsSection: React.FC<WhyChooseUsSectionProps> = ({ onBookInPerson }) => (
  <section id="why-choose-us" className="w-full border-b border-[#ebe4d8] bg-white py-16 sm:py-24">
    <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 sm:px-8 lg:grid-cols-[5fr_7fr] lg:gap-16 lg:px-12">
      <img
        src={hospitalPhoto}
        alt="Nurse talking with a smiling senior patient in a hospital corridor"
        loading="lazy"
        className="aspect-[4/3] w-full rounded-[28px] object-cover lg:aspect-square"
      />

      <div>
        <h2 className="text-3xl font-bold leading-tight tracking-tight text-[#1c1a17] sm:text-4xl lg:text-[40px]">
          Why families choose Sri Lakshmi
        </h2>
        <p className="mt-3.5 max-w-xl text-sm leading-relaxed text-[#5c5850] sm:text-base">
          Specialists, diagnostics and cashless insurance in one KR Puram hospital, so your family&rsquo;s care stays in one place.
        </p>

        <dl className="mt-8 divide-y divide-[#ebe4d8] border-y border-[#ebe4d8]">
          {reasons.map(reason => (
            <div key={reason.title} className="grid gap-1 py-5 sm:grid-cols-[13rem_1fr] sm:items-baseline sm:gap-6">
              <dt className="text-4xl font-black leading-none tracking-tight text-[#24553c] sm:text-5xl">{reason.value}</dt>
              <dd>
                <p className="text-base font-bold text-[#1c1a17] sm:text-lg">{reason.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#5c5850]">{reason.body}</p>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <button
            type="button"
            onClick={onBookInPerson}
            className="group inline-flex items-center gap-2 rounded-full bg-[#24553c] px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#173f2d]"
          >
            Book a visit
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </button>
          <a href="tel:+919901711716" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1c1a17] hover:text-[#24553c]">
            <Phone className="size-4 text-[#24553c]" />
            24/7 emergency: 99017 11716
          </a>
        </div>
      </div>
    </div>
  </section>
);
