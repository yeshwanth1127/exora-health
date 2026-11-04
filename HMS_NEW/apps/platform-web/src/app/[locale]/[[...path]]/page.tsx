import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import SiteImage from '../../components/site-image';
import CaptureBrand from '../../components/brand';
import RegionSwitcher from '../../components/regional/region-switcher';
import LocalizedPricing from '../../components/regional/localized-pricing';
import {FaqList} from '../../components/faq';
import {getCopy} from '../../../lib/i18n/messages';
import {isLocale,locales,translatedPaths,supportsTranslation,localizedPath,type Locale} from '../../../lib/i18n/config';
import {BRAND_NAME} from '../../../lib/brand';
import {SITE_ORIGIN,SEARCH_ENABLED} from '../../../lib/site';
import './localized.css';
type Params={locale:string;path?:string[]};
export function generateStaticParams(){return locales.filter(l=>l.code!=='en').flatMap(l=>translatedPaths.map(path=>({locale:l.code,path:path==='/'?[]:path.slice(1).split('/')})));}
function routeInfo(p:Params){const path='/'+(p.path||[]).join('/');if(!isLocale(p.locale)||p.locale==='en'||!supportsTranslation(path))notFound();return {locale:p.locale as Locale,path};}
function details(locale:Locale,path:string){const c=getCopy(locale);const map:Record<string,{title:string;body:string;image:string}>={
 '/':{title:c.hero,body:c.intro,image:'/assets/capture-onboarding/doctor-welcome.webp'},
 '/product/features':{title:c.product,body:c.intro,image:'/assets/capture-illustrations/care-coordination.webp'},
 '/pricing':{title:c.plansTitle,body:c.plansIntro,image:''},
 '/teams':{title:c.clinics,body:c.clinicsBody,image:'/assets/capture-navigation/clinic.webp'},
 '/enterprise':{title:c.hospitals,body:c.hospitalsBody,image:'/assets/capture-navigation/hospital.webp'},
 '/labs-diagnostics':{title:c.labs,body:c.labsBody,image:'/assets/showcases/heroes-v1/labs.webp'},
 '/specialties/dental':{title:c.dental,body:c.dentalBody,image:'/assets/showcases/heroes-v1/dental.webp'},
 '/specialties/physiotherapy':{title:c.physio,body:c.physioBody,image:'/assets/showcases/heroes-v1/physiotherapy.webp'},
 '/solutions/ai-receptionist':{title:c.ai,body:c.aiBody,image:'/assets/capture-illustrations/care-coordination.webp'},
 '/solutions/whatsapp-outreach':{title:c.whatsapp,body:c.whatsappBody,image:'/assets/capture-illustrations/care-messaging-coral.webp'},
 '/solutions/google-business-management':{title:c.google,body:c.googleBody,image:'/assets/capture-product-art/google-business.webp'},
 '/solutions/clinic-analytics':{title:c.analytics,body:c.analyticsBody,image:'/assets/capture-product-art/clinic-analytics.webp'},
 '/solutions/teleconsultations':{title:c.tele,body:c.teleBody,image:'/assets/showcases/heroes-v1/teleconsultations.webp'},
 '/help':{title:c.helpTitle,body:c.helpBody,image:'/assets/capture-onboarding/doctor-planning.webp'},
 '/blog':{title:c.blogTitle,body:c.blogBody,image:''},
 '/releases':{title:c.releaseTitle,body:c.releaseBody,image:'/assets/capture-onboarding/doctor-ready.webp'},
 '/contact-sales':{title:c.contactTitle,body:c.contactBody,image:'/assets/capture-onboarding/doctor-welcome.webp'},
 '/resources/clinic-front-desk-checklist':{title:c.checklist,body:c.checklistBody,image:''},
 '/privacy':{title:c.privacyTitle,body:c.privacyBody,image:''},
 };return map[path];}
export async function generateMetadata({params}:{params:Promise<Params>}):Promise<Metadata>{const {locale,path}=routeInfo(await params);const item=details(locale,path);const languages=SITE_ORIGIN?Object.fromEntries([...locales.map(l=>[l.tag,SITE_ORIGIN+localizedPath(l.code,path)]),['x-default',SITE_ORIGIN+path]]):undefined;return {title:`${item.title} | ${BRAND_NAME}`,description:item.body,alternates:SITE_ORIGIN?{canonical:SITE_ORIGIN+localizedPath(locale,path),languages}:undefined,robots:{index:SEARCH_ENABLED,follow:true},openGraph:{title:item.title,description:item.body,locale,url:SITE_ORIGIN?SITE_ORIGIN+localizedPath(locale,path):undefined}};}
export default async function LocalizedPage({params}:{params:Promise<Params>}){
 const {locale,path}=routeInfo(await params);const c=getCopy(locale),item=details(locale,path);const link=(p:string)=>localizedPath(locale,p);
 const features=[{title:c.ai,body:c.aiBody,path:'/solutions/ai-receptionist',image:'/assets/capture-product-art/ai-reception.webp'},{title:c.appointments,body:c.appointmentsBody,path:'/product/features',image:'/assets/capture-illustrations/appointments-blue.webp'},{title:c.whatsapp,body:c.whatsappBody,path:'/solutions/whatsapp-outreach',image:'/assets/capture-product-art/whatsapp-outreach.webp'},{title:c.google,body:c.googleBody,path:'/solutions/google-business-management',image:'/assets/capture-product-art/google-business.webp'},{title:c.analytics,body:c.analyticsBody,path:'/solutions/clinic-analytics',image:'/assets/capture-product-art/clinic-analytics.webp'},{title:c.tele,body:c.teleBody,path:'/solutions/teleconsultations',image:'/assets/capture-illustrations/care-coordination.webp'}];
 const organisations=[{title:c.clinics,path:'/teams'},{title:c.hospitals,path:'/enterprise'},{title:c.labs,path:'/labs-diagnostics'},{title:c.dental,path:'/specialties/dental'},{title:c.physio,path:'/specialties/physiotherapy'}];
 const isResource=['/blog','/releases','/privacy','/resources/clinic-front-desk-checklist','/contact-sales'].includes(path);
 const chosen=path==='/'?features.slice(0,3):path==='/product/features'||path==='/help'?features:path.startsWith('/solutions/')?features.filter(f=>f.path===path).concat(features.filter(f=>f.path!==path).slice(0,1)):features.slice(0,2);
 return <div className="localized-site" lang={locale}><header className="localized-nav"><a href={link('/')} aria-label={BRAND_NAME}><CaptureBrand/></a><nav aria-label={c.product}><a href={link('/product/features')}>{c.product}</a><a href={link('/pricing')}>{c.pricing}</a><a href={link('/contact-sales')}>{c.demo}</a></nav><RegionSwitcher/><details className="localized-menu"><summary>{c.product}</summary><nav>{[...organisations,{title:c.product,path:'/product/features'},{title:c.pricing,path:'/pricing'},{title:c.demo,path:'/contact-sales'},{title:c.help,path:'/help'}].map(v=><a key={v.path} href={link(v.path)}>{v.title}</a>)}</nav></details></header>
 <main className="localized-main"><nav className="localized-breadcrumb" aria-label={c.home}><a href={link('/')}>{c.home}</a>{path!=='/'&&<><span aria-hidden="true">/</span><span>{item.title}</span></>}</nav><section className={`localized-hero ${item.image?'has-art':''}`}><div><p className="localized-kicker">{BRAND_NAME}</p><h1>{item.title}</h1><p>{item.body}</p>{!isResource&&path!=='/pricing'&&<div className="localized-actions"><a className="localized-button" href={link('/contact-sales')}>{c.demo} ↗</a><a href={link('/product/features')}>{c.explore} →</a></div>}</div>{item.image&&<SiteImage src={item.image} width="480" height="400" alt="" loading="eager" fetchPriority="high"/>}</section>
 {path==='/pricing'?<LocalizedPricing locale={locale} copy={c}/>:<>
 {!isResource&&<section className="localized-features" aria-label={c.product}>{chosen.map(f=><article key={f.path+f.title}><SiteImage src={f.image} width="300" height="240" alt=""/><h2>{f.title}</h2><p>{f.body}</p><a href={link(f.path)}>{c.readMore} →</a></article>)}</section>}
 {path==='/blog'&&<div className="localized-features">{[{title:c.article1,slug:'a-clearer-front-desk',image:'/assets/capture-illustrations/appointments-blue.webp'},{title:c.article2,slug:'a-shared-clinic-day',image:'/assets/capture-illustrations/clinic-team-lime.webp'},{title:c.article3,slug:'follow-ups-with-a-clear-next-step',image:'/assets/capture-illustrations/care-messaging-coral.webp'}].map(p=><article key={p.slug}><SiteImage src={p.image} width="300" height="240" alt=""/><h2>{p.title}</h2><a href={`/blog/${p.slug}`} lang="en">{c.englishArticle} ↗</a></article>)}</div>}
 {path==='/releases'&&<section className="localized-note"><strong>1.0.0</strong><h2>{c.product}</h2><ul>{features.map(f=><li key={f.title}><a href={link(f.path)}>{f.title} →</a></li>)}</ul><p>{c.teamBody}</p></section>}
 {path==='/contact-sales'&&<section className="localized-note"><h2>{c.demo}</h2><p role="status">{c.contactOffline}</p><a href={link('/product/features')}>{c.explore} →</a></section>}
 {path==='/resources/clinic-front-desk-checklist'&&<ol className="localized-checklist">{[c.check1,c.check2,c.check3,c.check4].map(v=><li key={v}>{v}</li>)}</ol>}
 {!isResource&&<section className="localized-workflow"><div><h2>{c.workflow}</h2><p>{c.workflowBody}</p></div><div><h2>{c.team}</h2><p>{c.teamBody}</p></div></section>}
 </>}
 {!isResource&&<section className="localized-faq"><h2>{c.faq}</h2><FaqList items={[{q:c.faqQ1,a:c.faqA1},{q:c.faqQ2,a:c.faqA2}]}/></section>}
 {!isResource&&<aside className="localized-closing"><h2>{c.closing}</h2><p>{c.closingBody}</p><a className="localized-button" href={link('/contact-sales')}>{c.demo} ↗</a></aside>}
 <p className="localized-summary">{c.summary} <a href={path==='/'?'/?lang=en':path} lang="en">{c.original} ↗</a></p></main>
 <footer className="localized-footer"><div><a href={link('/')}><CaptureBrand/></a><RegionSwitcher expanded/></div><nav aria-label={c.solutions}><h2>{c.solutions}</h2>{organisations.map(v=><a key={v.path} href={link(v.path)}>{v.title}</a>)}</nav><nav aria-label={c.resources}><h2>{c.resources}</h2>{[{title:c.pricing,path:'/pricing'},{title:c.blog,path:'/blog'},{title:c.help,path:'/help'},{title:c.releases,path:'/releases'},{title:c.privacy,path:'/privacy'}].map(v=><a key={v.path} href={link(v.path)}>{v.title}</a>)}</nav><small>© 2026 {BRAND_NAME}</small></footer>
 </div>;
}
