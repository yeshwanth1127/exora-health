import SiteImage from "./site-image";
import {Image as ImageIcon} from 'lucide-react';
import {showcaseArtwork} from '../../lib/showcase-artwork';
import panels from './claude-asset-data.json';
import MarketingAsset from './marketing-asset';
import './showcase-pages.css';
/** Renders the coded mockup for a slot when one exists, otherwise local artwork or a reserved slot. */
export default function IllustrationSlot({name}:{name:string}) {
 if(name in panels)return <MarketingAsset name={name as keyof typeof panels}/>;
 const artwork=showcaseArtwork[name];
 if(!artwork)throw new Error('Unknown showcase artwork slot: '+name);
 return <figure className="showcase-artwork" data-artwork-slot={name}>
  {artwork.src ? <SiteImage src={artwork.src} alt={artwork.label} width={artwork.width} height={artwork.height} loading={name.endsWith("-hero") ? "eager" : "lazy"} fetchPriority={name.endsWith("-hero") ? "high" : undefined}/> : <div className="showcase-artwork-pending" role="img" aria-label={`${artwork.label}: illustration reserved`}>
   <ImageIcon aria-hidden="true" size={28} strokeWidth={1.25}/><span>{artwork.label}</span><small>Illustration to follow</small>
  </div>}
 </figure>;
}
