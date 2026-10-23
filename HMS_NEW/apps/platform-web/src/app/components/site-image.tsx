import type { ComponentPropsWithRef } from 'react';
import { responsiveImage } from '../../lib/responsive-image';
/** Native img semantics with build-time WebP variants; no optimizer server or browser effects. */
export default function SiteImage({src,srcSet,sizes,width,height,loading,decoding,fetchPriority,...props}:ComponentPropsWithRef<'img'>) {
  const image=typeof src==='string' ? responsiveImage(src,{width,srcSet,sizes}) : undefined;
  const eager=fetchPriority==='high'||(Number(width)>0&&Number(width)<=96);
  return <img {...props} src={image?.src||src} srcSet={image?.srcSet||srcSet} sizes={image?.sizes||sizes} width={width||image?.width} height={height||image?.height} loading={loading||(eager?'eager':'lazy')} decoding={decoding||'async'} fetchPriority={fetchPriority} />;
}
