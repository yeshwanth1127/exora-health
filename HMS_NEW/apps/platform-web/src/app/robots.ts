import type {MetadataRoute} from 'next';
import {SEARCH_ENABLED,SITE_ORIGIN} from '../lib/site';
export const dynamic='force-static';
export default function robots():MetadataRoute.Robots {
 if(!SEARCH_ENABLED)return {rules:{userAgent:'*',disallow:'/'}};
 const disallow=['/admin/','/control/','/staff/'];
 // Setup/preview pages remain crawlable so their noindex tags can be read.
 return {rules:[{userAgent:'*',allow:'/',disallow},{userAgent:['OAI-SearchBot','PerplexityBot','Claude-SearchBot'],allow:'/',disallow}],sitemap:SITE_ORIGIN+'/sitemap.xml',host:SITE_ORIGIN};
}
