import type { HospitalPhoto } from '../arc-pro';
export type HealthPackage={id:string;name:string;description:string;priceMinor:number;inclusions:string[]};
export type WebsiteProfile={name:string;organisation:string;slug:string;city:string;timezone:string;address:string;phone:string;content:{logoUrl?:string;heroImage?:string;storyImage?:string;headline?:string;introduction?:string;story?:string;photos:HospitalPhoto[];packages:HealthPackage[]}};
export async function loadWebsite(signal?:AbortSignal):Promise<WebsiteProfile>{
 const response=await fetch('/public/v1/website',{signal,credentials:'omit',cache:'no-store'});
 if(!response.ok)throw new Error('The hospital website could not be loaded. Please try again.');
 const data=await response.json();
 if(!data||typeof data.name!=='string'||!data.name.trim()||typeof data.city!=='string'||typeof data.phone!=='string'||!data.content||!Array.isArray(data.content.photos)||!Array.isArray(data.content.packages))throw new Error('The hospital website details could not be verified.');
 return data;
}
export function phoneLink(value:string){const phone=value.replace(/[\s()-]/g,'');return /^\+?[1-9]\d{6,14}$/.test(phone)?`tel:${phone}`:undefined;}
