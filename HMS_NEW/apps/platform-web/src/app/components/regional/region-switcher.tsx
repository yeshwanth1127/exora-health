'use client';
import * as Dialog from '@radix-ui/react-dialog';
import {Globe2,X} from 'lucide-react';
import {useState,useEffect,useId} from 'react';
import {usePathname} from 'next/navigation';
import {useRegion} from './region-provider';
import {countries,isCountry} from '../../../lib/regional-pricing';
import {locales,isLocale,splitLocale,languageDestination} from '../../../lib/i18n/config';
import regionCopy from '../../../lib/i18n/region-copy.json';
import './regional.css';
export default function RegionSwitcher({expanded=false}:{expanded?:boolean}){
 const path=usePathname()||'/';const {locale}=splitLocale(path);const copy=regionCopy[locale];
 const {country,setCountry}=useRegion();const [open,setOpen]=useState(false),[chosenCountry,chooseCountry]=useState(country),[language,chooseLanguage]=useState(locale);const id=useId();
 useEffect(()=>{if(open){chooseCountry(country);chooseLanguage(locale);}},[open,country,locale]);
 useEffect(()=>{document.documentElement.lang=locale;},[locale]);
 const names=new Intl.DisplayNames([locale],{type:'region'});
 return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger asChild><button type="button" className={`region-trigger ${expanded?'is-expanded':''}`} aria-label={`${copy.region}: ${locales.find(l=>l.code===locale)?.name}, ${names.of(country)}`}><Globe2 size={18} aria-hidden="true"/><span>{expanded?`${locales.find(l=>l.code===locale)?.name} · ${names.of(country)}`:country}</span></button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="region-overlay"/><Dialog.Content className="region-dialog"><Dialog.Title>{copy.region}</Dialog.Title><Dialog.Description>{copy.marketNote}</Dialog.Description><Dialog.Close className="region-close" aria-label={copy.close}><X size={20}/></Dialog.Close><label htmlFor={`${id}-language`}>{copy.language}</label><select id={`${id}-language`} value={language} onChange={e=>{if(isLocale(e.target.value))chooseLanguage(e.target.value);}}>{locales.map(l=><option value={l.code} key={l.code} lang={l.tag}>{l.name}</option>)}</select><label htmlFor={`${id}-country`}>{copy.country}</label><select id={`${id}-country`} value={chosenCountry} onChange={e=>{if(isCountry(e.target.value))chooseCountry(e.target.value);}}>{countries.map(([code,currency])=><option value={code} key={code}>{names.of(code)} · {currency}</option>)}</select><button className="region-apply" type="button" onClick={()=>{setCountry(chosenCountry);document.cookie=`capture-language=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;setOpen(false);if(language!==locale)location.assign(languageDestination(language,path));}}>{copy.apply}</button></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
