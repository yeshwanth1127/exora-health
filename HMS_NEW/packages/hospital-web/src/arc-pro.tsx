import { lazy, type ComponentType } from 'react';
export interface HospitalPerson { id:string; name:string; role:string; location:string; image:string; introduction:string; focus?:string; email?:string; phone?:string; }
export interface HospitalPhoto { src:string; alt:string; width:number; height:number; title?:string; caption?:string; }
export interface PhotoBounds { left:number; top:number; width:number; height:number; }
export const ArcTeamShowcase = lazy(async () => {
  const component = await import('./vendor/pro/team-showcase/dist/app.js');
  return { default: component.TeamShowcase };
}) as ComponentType<{people:HospitalPerson[];variant:'gallery';title:string;onPersonSelect:(person:HospitalPerson)=>void}>;
export const ArcLightboxViewer = lazy(async () => {
  const component = await import('./vendor/pro/lightbox-gallery/dist/app.js');
  return { default: component.HospitalLightboxViewer };
}) as ComponentType<{images:HospitalPhoto[];start:number;from:PhotoBounds|null;label:string;getThumb:(index:number)=>HTMLButtonElement|null;onIndexChange:(index:number)=>void;onClosed:(index:number)=>void}>;
export const ArcDateReel = lazy(async () => {
  const component = await import('./vendor/pro/date-reel/dist/app.js');
  return { default: component.DateReel };
}) as ComponentType<{mode:'date';value:Date;today:Date;minDate:Date;maxDate:Date;onChange:(value:Date)=>void;title?:string;label:string;presets:false;intro:false;locale:string}>;
