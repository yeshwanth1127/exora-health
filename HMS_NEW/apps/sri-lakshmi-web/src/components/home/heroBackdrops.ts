export type HeroBackdrop = 'plain' | 'visit' | 'family' | 'consultation' | 'cardiology' | 'telehealth';
export type HeroPlacement = 'fullbleed' | 'split' | 'banner' | 'card';

export const HERO_BACKDROPS: Record<Exclude<HeroBackdrop, 'plain'>, { label: string; image: string; position: string }> = {
  visit: {
    label: 'Care team visit',
    image: '/clients/sri-lakshmi/c2a98e00-Sri-Lakshmi-Hospitals-Services-Facilities.png',
    position: 'center 12%',
  },
  family: {
    label: 'Three generations',
    image: '/clients/sri-lakshmi/09f4de5d-SLSS-banner-1.png',
    position: 'right center',
  },
  consultation: {
    label: 'Care conversation',
    image: '/clients/sri-lakshmi/36f2a4cf-home-page-banner.png',
    position: 'center 28%',
  },
  cardiology: {
    label: 'Doctor consultation',
    image: '/clients/sri-lakshmi/0b3cc897-cardiology.png',
    position: 'center 30%',
  },
  telehealth: {
    label: 'KR Puram hospital',
    image: '/clients/sri-lakshmi/f22f9b39-1-1.png',
    position: 'center 38%',
  },
};

export const HERO_PLACEMENTS: { id: HeroPlacement; name: string; description: string }[] = [
  { id: 'fullbleed', name: 'Full-bleed', description: 'Photo fills the screen, text on top.' },
  { id: 'split', name: 'Split', description: 'Text left, tall photo right.' },
  { id: 'banner', name: 'Banner', description: 'Wide photo fading into the headline.' },
  { id: 'card', name: 'Framed card', description: 'Photo in a rounded frame.' },
];

export function getHeroBackdrop(backdrop: HeroBackdrop) {
  return backdrop === 'plain' ? null : HERO_BACKDROPS[backdrop];
}
