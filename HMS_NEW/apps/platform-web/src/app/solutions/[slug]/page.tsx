import {notFound} from 'next/navigation';
import ResourceShell from '../../components/resource-shell';
import {solutions} from '../../../lib/solution-pages';
import {BRAND_NAME} from '../../../lib/brand';
import {SITE_ORIGIN} from '../../../lib/site';
import {pageMetadata,breadcrumbs,jsonLd} from '../../../lib/seo';
import '../solutions.css';
export function generateStaticParams(){return solutions.map(s=>({slug:s.slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return pageMetadata('/solutions/'+slug);}
export default async function Solution({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const item=solutions.find(s=>s.slug===slug);if(!item)notFound();
 return <ResourceShell><main className="solution-page">
  {SITE_ORIGIN&&<><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(breadcrumbs([{name:'Home',path:'/'},{name:'Product',path:'/product/features'},{name:item.label,path:'/solutions/'+slug}]))}}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@type':'SoftwareApplication',name:`${BRAND_NAME} ${item.label}`,applicationCategory:'BusinessApplication',operatingSystem:'Web',url:SITE_ORIGIN+'/solutions/'+slug,description:item.intro,provider:{'@id':SITE_ORIGIN+'/#organisation'}})}}/></>}
  <nav aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/product/features">Product</a><span>/</span><span>{item.label}</span></nav>
  <header className="solution-hero"><div><p className="solution-eyebrow">{item.label} for healthcare providers</p><h1>{item.title}</h1><p>{item.intro}</p><a className="brand-button-primary" href="/quote">Explore {BRAND_NAME} ↗</a></div><img src={item.image} alt="A healthcare workflow illustration" width="360" height="300"/></header>
  <div className="solution-sections">{item.sections.map((s,index)=><section key={s.title}><span>0{index+1}</span><div><h2>{s.title}</h2><p>{s.body}</p></div></section>)}</div>
  <section className="solution-faq"><h2>Before you get started.</h2>{item.faqs.map(f=><details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</section>
  <aside className="solution-related"><h2>Build a connected clinic workflow.</h2><p>Explore the product, compare <a href="/pricing">plans</a>, or use our <a href="/resources/clinic-front-desk-checklist">front-desk workflow checklist</a> to review your team’s next step.</p><div>{solutions.filter(s=>s.slug!==slug).map(s=><a href={'/solutions/'+s.slug} key={s.slug}>{s.label} →</a>)}</div></aside>
 </main></ResourceShell>;
}
