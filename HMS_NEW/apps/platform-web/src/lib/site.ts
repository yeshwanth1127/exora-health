/** Public build configuration. An unset/invalid origin keeps local builds out of search. */
export function publicOrigin(value = ''): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || /(^localhost$|\.localhost$|\.(test|example|invalid|local|internal)$|^\d{1,3}(\.\d{1,3}){3}$|:)/i.test(url.hostname)) return '';
    return url.origin;
  } catch { return ''; }
}
export const SITE_ORIGIN = publicOrigin(process.env.NEXT_PUBLIC_SITE_ORIGIN);
export const SEARCH_ENABLED = process.env.NEXT_PUBLIC_SEARCH_INDEXING === 'true' && Boolean(SITE_ORIGIN);
