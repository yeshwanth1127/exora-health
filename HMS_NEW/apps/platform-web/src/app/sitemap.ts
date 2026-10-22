import type {MetadataRoute} from 'next';
import {posts} from './blog/posts';
import {publicPages} from '../lib/seo';
import {SEARCH_ENABLED,SITE_ORIGIN} from '../lib/site';
export const dynamic='force-static';
export default function sitemap():MetadataRoute.Sitemap {
 if(!SEARCH_ENABLED)return [];
 return [...publicPages.map(page=>({url:SITE_ORIGIN+page.path})),...posts.map(post=>({url:SITE_ORIGIN+'/blog/'+post.slug}))];
}
