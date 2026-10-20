import { ArrowUpRight } from 'lucide-react';

// Facility photographs published in the hospital's gallery.
const photographs = [
  { src: '/clients/sri-lakshmi/f22f9b39-1-1.png', label: 'Sri Lakshmi, KR Puram', alt: 'Exterior of Sri Lakshmi Super Speciality Hospital', large: true },
  { src: '/clients/sri-lakshmi/81a4ec5b-1-9.png', label: 'Care spaces', alt: 'Beds in a hospital room' },
  { src: '/clients/sri-lakshmi/7e3a0245-1-6.png', label: 'Laboratory', alt: 'Hospital laboratory staff working with diagnostic equipment' },
  { src: '/clients/sri-lakshmi/13214f3a-6-6.png', label: 'Pharmacy', alt: 'The hospital pharmacy counter' },
  { src: '/clients/sri-lakshmi/c3c3d54f-1-8.png', label: 'Inside the hospital', alt: 'Hospital ward with beds and care equipment' },
];

export function HospitalGallerySection({ onExploreHospital }: { onExploreHospital: () => void }) {
  return <section id="hospital-gallery" aria-labelledby="hospital-gallery-title" className="w-full bg-[#f6f4ef] py-16 sm:py-20">
    <div className="mx-auto max-w-[1400px] px-6 sm:px-10 lg:px-16">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h2 id="hospital-gallery-title" className="text-4xl font-medium leading-tight tracking-[-1.1px] text-[#17372b] sm:text-5xl">A look inside Sri Lakshmi.</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[#607466]">Our hospital, care spaces and facilities in KR Puram.</p>
        </div>
        <button onClick={onExploreHospital} className="inline-flex items-center gap-2 self-start text-sm font-semibold text-[#24553c] hover:underline sm:self-auto">Photos, films & community <ArrowUpRight size={17} /></button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:auto-rows-[220px]">
        {photographs.map(photo => <figure key={photo.src} className={`relative m-0 overflow-hidden rounded-2xl bg-[#e5eee2] ${photo.large ? 'aspect-[4/3] sm:col-span-2 lg:col-span-6 lg:row-span-2 lg:aspect-auto' : 'aspect-[4/3] lg:col-span-3 lg:aspect-auto'}`}>
          <button type="button" onClick={onExploreHospital} aria-label={`Explore photos and videos: ${photo.label}`} className="group h-full w-full text-left focus-visible:outline-4 focus-visible:outline-offset-[-5px] focus-visible:outline-white"><img src={photo.src} alt={photo.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.035]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />
          <span className="absolute inset-x-0 bottom-0 p-5 text-base font-medium text-white sm:p-6">{photo.label}<ArrowUpRight size={17} className="float-right mt-1" /></span></button><figcaption className="sr-only">{photo.label}</figcaption>
        </figure>)}
      </div>
    </div>
  </section>;
}
