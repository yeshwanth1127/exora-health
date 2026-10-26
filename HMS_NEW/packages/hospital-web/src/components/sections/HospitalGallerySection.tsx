import { ArrowUpRight } from 'lucide-react';
import { Suspense, useRef, useState } from 'react';
import { ArcLightboxViewer, type PhotoBounds } from '../../arc-pro';

import type { HospitalPhoto } from '../../arc-pro';
export function HospitalGallerySection({ onExploreHospital, name, photos, preview }: { onExploreHospital: () => void; name:string;photos:HospitalPhoto[];preview?:boolean }) {
  const photographs=photos.map((photo,index)=>({...photo,label:photo.title||photo.alt,large:index===0}));
  const thumbnails = useRef<Array<HTMLButtonElement|null>>([]);
  const [viewer, setViewer] = useState<{start:number;from:PhotoBounds|null}|null>(null);
  const images = photographs.map(photo => ({...photo, title:photo.label}));
  return <section id="hospital-gallery" aria-labelledby="hospital-gallery-title" className="w-full bg-[#fefbf6] py-16 sm:py-20">
    <div className="mx-auto max-w-[1400px] px-6 sm:px-10 lg:px-16">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h2 id="hospital-gallery-title" className="text-4xl font-medium leading-tight tracking-[-1.1px] text-[#08404f] sm:text-5xl">{preview?'A sense of the care experience.':`A look inside ${name}.`}</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[#607466]">{preview?'Illustrative photography. Actual hospital photographs await verification.':'Our hospital, care spaces and facilities.'}</p>
        </div>
        <button onClick={onExploreHospital} className="inline-flex items-center gap-2 self-start text-sm font-semibold text-[#08404f] hover:underline sm:self-auto">Explore our hospital <ArrowUpRight size={17} /></button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:auto-rows-[220px]">
        {photographs.map((photo, index) => <figure key={photo.src} className={`relative m-0 overflow-hidden rounded-2xl bg-[#e5eee2] ${photo.large ? 'aspect-[4/3] sm:col-span-2 lg:col-span-6 lg:row-span-2 lg:aspect-auto' : 'aspect-[4/3] lg:col-span-3 lg:aspect-auto'}`}>
          <button type="button" ref={node => { thumbnails.current[index] = node; }} onClick={event => {
            const bounds=event.currentTarget.getBoundingClientRect();
            setViewer({start:index,from:{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height}});
          }} aria-label={`Open ${photo.label}, photo ${index+1} of ${photographs.length}`} className="group h-full w-full text-left focus-visible:outline-4 focus-visible:outline-offset-[-5px] focus-visible:outline-white"><img src={photo.src} alt={photo.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.035]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />
          <span className="absolute inset-x-0 bottom-0 p-5 text-base font-medium text-white sm:p-6">{photo.label}<ArrowUpRight size={17} className="float-right mt-1" /></span></button><figcaption className="sr-only">{photo.label}</figcaption>
        </figure>)}
      </div>
    </div>
    {viewer && <Suspense fallback={<p role="status" className="hospital-gallery-loading">Opening photographs…</p>}>
      <ArcLightboxViewer images={images} start={viewer.start} from={viewer.from} label={preview?'Illustrative care gallery':`Inside ${name}`} getThumb={index=>thumbnails.current[index]} onIndexChange={()=>{}} onClosed={index=>{
        setViewer(null);
        requestAnimationFrame(()=>thumbnails.current[index]?.focus({preventScroll:true}));
      }}/>
    </Suspense>}
  </section>;
}
