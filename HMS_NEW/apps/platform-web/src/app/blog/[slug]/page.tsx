import SiteImage from "../../components/site-image";
import {pageMetadata,jsonLd,breadcrumbs} from "../../../lib/seo";
import {SITE_ORIGIN} from "../../../lib/site";
import { BRAND_NAME } from "../../../lib/brand";
import {notFound} from 'next/navigation';
import ResourceShell from '../../components/resource-shell';
import {posts} from '../posts';
import '../blog.css';
export function generateStaticParams(){return posts.map(p=>({slug:p.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const p=posts.find(p=>p.slug===slug);return p?pageMetadata(`/blog/${slug}`,`${p.title} | ${BRAND_NAME}`,p.excerpt):{robots:{index:false}}}
export default async function BlogArticle({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const p=posts.find(p=>p.slug===slug);if(!p)notFound();return <ResourceShell><article className="capture-blog-article">{SITE_ORIGIN&&<><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@type':'Article',headline:p.title,description:p.excerpt,image:SITE_ORIGIN+p.image,mainEntityOfPage:SITE_ORIGIN+'/blog/'+p.slug,author:{'@type':'Organization',name:BRAND_NAME,url:SITE_ORIGIN},publisher:{'@id':SITE_ORIGIN+'/#organisation'}})}}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(breadcrumbs([{name:'Home',path:'/'},{name:'Guides',path:'/blog'},{name:p.title,path:'/blog/'+p.slug}]))}}/></>}<a className="blog-back" href="/blog">← All guides</a><header><p className="blog-eyebrow">{p.category} · Workflow guide</p><h1>{p.title}</h1><p>{p.excerpt}</p></header><figure><SiteImage loading="eager" fetchPriority="high" src={p.image} alt={p.alt} width="700" height="500"/></figure><div className="blog-prose">{p.sections.map(s=><section key={s.title}><h2>{s.title}</h2><p>{s.body}</p></section>)}<aside><h2>See the workflow in {BRAND_NAME}.</h2><p>Explore an illustrative product preview, then discuss the setup your clinic needs.</p><a href="/product/features">Explore the product →</a></aside></div></article></ResourceShell>}
