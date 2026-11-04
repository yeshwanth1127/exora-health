'use client';
import {useRegion} from './region-provider';
import RegionSwitcher from './region-switcher';
import {countryCurrency} from '../../../lib/regional-pricing';
import {type Locale,localizedPath} from '../../../lib/i18n/config';
import {type Copy} from '../../../lib/i18n/en';
export default function LocalizedPricing({copy:c,locale}:{copy:Copy;locale:Locale}){
 const {country}=useRegion();
 const names=new Intl.DisplayNames([locale],{type:'region'});
 const plans=[{id:'preview',label:c.explorePlan,body:c.exploreDesc},{id:'booking',label:c.bookingPlan,body:c.bookingDesc},{id:'growth',label:c.growthPlan,body:c.growthDesc},{id:'connected',label:c.connectedPlan,body:c.connectedDesc}];
 return <><div className="localized-pricing-market"><strong>{names.of(country)} · {countryCurrency(country)}</strong><RegionSwitcher expanded/></div><p className="localized-price-note" role="status">{c.priceNote}</p><div className="localized-plan-grid">{plans.map(p=><article key={p.id}><h2>{p.label}</h2><strong className="localized-price">{p.id==='preview'?c.free:p.id==='connected'?c.customQuote:c.localQuote}</strong><p>{p.body}</p><a className="localized-button" href={localizedPath(locale,p.id==='preview'?'/product/features':'/contact-sales')}>{p.id==='preview'?c.explore:c.demo} ↗</a></article>)}</div><p className="localized-price-note">{c.scope} {c.usage}</p></>;
}
