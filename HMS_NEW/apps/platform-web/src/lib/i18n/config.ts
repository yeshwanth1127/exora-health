export const locales = [
 {code:'en',name:'English',tag:'en'}, {code:'hi',name:'हिन्दी',tag:'hi'},
 {code:'ta',name:'தமிழ்',tag:'ta'}, {code:'te',name:'తెలుగు',tag:'te'}, {code:'bn',name:'বাংলা',tag:'bn'},
 {code:'id',name:'Bahasa Indonesia',tag:'id'}, {code:'ms',name:'Bahasa Melayu',tag:'ms'},
 {code:'th',name:'ไทย',tag:'th'}, {code:'vi',name:'Tiếng Việt',tag:'vi'},
 {code:'fr',name:'Français',tag:'fr'}, {code:'de',name:'Deutsch',tag:'de'}, {code:'es',name:'Español',tag:'es'},
] as const;
export type Locale=typeof locales[number]['code'];
export function isLocale(value:string):value is Locale{return locales.some(l=>l.code===value);}
export function splitLocale(path:string):{locale:Locale;path:string}{const parts=path.split('/').filter(Boolean);const first=parts[0];if(first&&isLocale(first))return {locale:first,path:'/'+parts.slice(1).join('/')};return {locale:'en',path:path==='/'?'/':path.replace(/\/$/,'')};}
export const translatedPaths=['/','/pricing','/product/features','/teams','/enterprise','/labs-diagnostics','/specialties/dental','/specialties/physiotherapy','/solutions/ai-receptionist','/solutions/whatsapp-outreach','/solutions/google-business-management','/solutions/clinic-analytics','/solutions/teleconsultations','/contact-sales','/help','/blog','/releases','/resources/clinic-front-desk-checklist','/privacy'] as const;
export function supportsTranslation(path:string){return (translatedPaths as readonly string[]).includes(path);}
export function localizedPath(locale:Locale,path:string){return locale==='en'?path:`/${locale}${path==='/'?'':path}`;}
export function languageDestination(locale:Locale,path:string){const clean=splitLocale(path).path;return localizedPath(locale,supportsTranslation(clean)?clean:clean.startsWith('/blog/')?'/blog':'/');}
