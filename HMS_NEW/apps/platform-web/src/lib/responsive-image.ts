import images from './optimized-images.json';
type Options = {width?:number|string;srcSet?:string;sizes?:string};
type Image = {src:string;srcSet:string;width:number;height:number};
const variants=images as Record<string,Image>;
export function responsiveImage(src:string,{width,srcSet,sizes}:Options={}) {
  const image=variants[src];
  if(!image)return undefined;
  // Retain intentionally different crops supplied through an explicit srcset.
  if(srcSet&&srcSet.split(',').some(candidate=>candidate.trim().split(/\s+/)[0]!==src))return undefined;
  const fixed=Number(width);
  const fallback=fixed>0&&fixed<=320 ? image.srcSet.split(', ').map(candidate=>{const [src,width]=candidate.split(' ');return {src,width:Number(width.slice(0,-1))};}).find(candidate=>candidate.width>=fixed*2)?.src : undefined;
  return {...image,src:fallback||image.src,sizes:sizes||(fixed>0&&fixed<=320?`${fixed}px`:'(max-width: 640px) 90vw, (max-width: 1024px) 50vw, 640px')};
}
