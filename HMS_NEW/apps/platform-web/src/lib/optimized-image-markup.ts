import { responsiveImage } from './responsive-image';
/** Saved HTML panels retain their geometry while their image sources get display variants. */
export function optimizedImageMarkup(html:string) {
 return html.replace(/<img\b[^>]*>/g,tag=>{
  const src=tag.match(/\bsrc="([^"]+)"/)?.[1];if(!src)return tag;
  const width=tag.match(/\bwidth="(\d+)"/)?.[1]||tag.match(/(?:^|[;"\s])width:\s*(\d+)px/)?.[1];
  const image=responsiveImage(src,{width});if(!image)return tag;
  const clean=tag.replace(/\s(?:src|srcset|sizes|loading|decoding)="[^"]*"/g,'');
  return clean.replace(/\/?>(\s*)$/,` src="${image.src}" srcset="${image.srcSet}" sizes="${image.sizes}" loading="lazy" decoding="async">$1`);
 });
}
