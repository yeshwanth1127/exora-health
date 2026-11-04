import {locales,localizedPath,supportsTranslation,translatedPaths} from '../lib/i18n/config';
import type {MetadataRoute} from 'next';
import {posts} from './blog/posts';
import {publicPages} from '../lib/seo';
import {SEARCH_ENABLED,SITE_ORIGIN} from '../lib/site';
export const dynamic='force-static';
export default function sitemap():MetadataRoute.Sitemap {
 if(!SEARCH_ENABLED)return [];
 const languageLinks=(path:string)=>Object.fromEntries([...locales.map(locale=>[locale.tag,SITE_ORIGIN+localizedPath(locale.code,path)]),['x-default',SITE_ORIGIN+path]]);
 return [...publicPages.map(page=>({url:SITE_ORIGIN+page.path,...(supportsTranslation(page.path)?{alternates:{languages:languageLinks(page.path)}}:{})})),...locales.filter(l=>l.code!=='en').flatMap(locale=>translatedPaths.map(path=>({url:SITE_ORIGIN+localizedPath(locale.code,path),alternates:{languages:languageLinks(path)}}))),...posts.map(post=>({url:SITE_ORIGIN+'/blog/'+post.slug}))];
}
