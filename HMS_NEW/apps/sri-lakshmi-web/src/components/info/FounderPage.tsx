import { ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '../common/Breadcrumbs';
import { YouTubePlayer } from '../media/YouTubePlayer';
import { hospitalVideos } from '../../data/clientMedia';

interface FounderPageProps {
  onBackToHome: () => void;
  onExploreHospital: () => void;
}

const shell = 'mx-auto max-w-[1400px] px-5 sm:px-10 lg:px-16';

export function FounderPage({ onBackToHome, onExploreHospital }: FounderPageProps) {
  return <div className="bg-[#fbfaf6] text-[#17372b]">
    <div className={`${shell} pt-7`}><Breadcrumbs items={[{ label: 'Home', onClick: onBackToHome }, { label: 'From the founder' }]} /></div>
    <section className={`${shell} grid gap-12 py-16 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-24`}>
      <div>
        <p className="mb-5 text-xs font-bold tracking-[.18em] text-[#65816a]">DR. SAMBASHIVA · FOUNDER</p>
        <h1 className="text-[clamp(3.4rem,6vw,6.6rem)] font-medium leading-[.98] tracking-[-.055em]">From the founder.</h1>
        <p className="mt-7 max-w-xl text-lg leading-relaxed text-[#5c6e61]">A vision to bring advanced, affordable healthcare closer to families in KR Puram.</p>
        <p className="mt-8 text-xl font-medium">Dr. Sambashiva</p>
        <p className="mt-2 text-sm text-[#607466]">Founder, Physician &amp; Chairman<br />Sri Lakshmi Super Speciality Hospital</p>
        <button onClick={onExploreHospital} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#214f38] px-7 py-3.5 text-sm font-semibold text-white">Our hospital story <ArrowRight size={17} /></button>
      </div>
      <div className="mx-auto aspect-[.9] w-full max-w-lg overflow-hidden rounded-[1.8rem] bg-[#e5eee2]">
        <img src="/clients/sri-lakshmi/364a7d1e-Dr-Sambashiva-Chairman-Sri-Lakshmi-Hospitals.png" alt="Dr. Sambashiva, founder of Sri Lakshmi Super Speciality Hospital" className="h-full w-full object-cover" />
      </div>
    </section>
    <section className="bg-[#e8f0e5] py-16 sm:py-20">
      <div className={`${shell} grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-20`}>
        <div><p className="mb-4 text-xs font-bold tracking-[.18em] text-[#65816a]">THE FOUNDER’S MESSAGE</p><h2 className="text-4xl font-medium tracking-[-.04em] sm:text-5xl">Care within everyone’s reach.</h2></div>
        <div className="max-w-2xl">
          <YouTubePlayer key={hospitalVideos[0].id} video={hospitalVideos[0]} />
          <div className="mt-8 space-y-5 text-base leading-relaxed text-[#5c6e61]">
            <p>In his published message, Dr. Sambashiva describes how his early work at a government hospital revealed gaps in medical facilities and technology. That experience inspired him to establish Sri Lakshmi Super Speciality Hospital in 2002.</p>
            <p>His vision extends beyond treatment: affordable care for local families, community outreach across Karnataka, and greater awareness of health. It continues to guide the hospital’s commitment to accessible, compassionate care.</p>
          </div>
          <p className="mt-8 text-sm font-medium">Dr. Sambashiva</p>
          <p className="mt-1 text-sm text-[#607466]">Founder, Sri Lakshmi Super Speciality Hospital</p>
        </div>
      </div>
    </section>
  </div>;
}
