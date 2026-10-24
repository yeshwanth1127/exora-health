import {organisationLinks,specialtyLinks,supportingModules,resourceLinks} from './site-navigation';
import { BRAND_NAME } from './brand';
import {audienceIcons} from './audience-icons';
type Menu={trigger:string;html:string;hoverOpen:boolean;gap:number;align:'left'|'right'};
function icon(name:string){return `<img src="${audienceIcons[name]}" alt="" width="48" height="48">`;}
function item(link:{label:string;href:string;description:string;icon:string}){return `<a href="${link.href}"><span class="capture-solution-icon capture-solution-${link.icon}" aria-hidden="true">${icon(link.icon)}</span><span><strong>${link.label}</strong><small>${link.description}</small></span><span aria-hidden="true">→</span></a>`;}
const resourceDescriptions:Record<string,string>={'/blog':'Ideas for a calmer clinic day.','/help':'Answers for you and your team.','/releases':`The latest improvements to ${BRAND_NAME}.`};
const resourceIcons:Record<string,string>={'/blog':'<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4zM20 4h-4a3 3 0 0 0-3 3M20 4v15h-3"/>','/help':'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2M12 16h.01"/>','/releases':'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>'};
function groups(){return `<div class="capture-solutions-primary"><span class="capture-menu-kicker">By organisation</span>${organisationLinks.map(item).join('')}</div><div class="capture-solutions-specialties"><span class="capture-menu-kicker">By specialty</span>${specialtyLinks.map(item).join('')}</div><nav class="capture-solutions-resources" aria-label="Help and updates"><span class="capture-menu-kicker">Help &amp; updates</span>${resourceLinks.map(link=>`<a href="${link.href}"><span class="capture-resource-icon" aria-hidden="true"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${resourceIcons[link.href]}</svg></span><span><strong>${link.label}</strong><small>${resourceDescriptions[link.href]}</small></span><span aria-hidden="true">→</span></a>`).join('')}</nav>`;}

export function navigationMenus(menus:Menu[]):Menu[]{return menus.map(menu=>{
 if(menu.trigger==='label:Solutions')return {...menu,html:`<div id="capture-solutions-menu" class="capture-solutions-menu" aria-label="Healthcare solutions">${groups()}</div>`};
 if(menu.trigger==='capture-mobile-nav')return {...menu,html:`<div id="capture-mobile-menu" class="capture-solutions-menu capture-mobile-menu"><nav class="capture-mobile-primary" aria-label="Main"><a href="/product/features">Product</a><a href="/solutions/teleconsultations">Teleconsultations</a><a href="/pricing">Pricing</a><a href="/contact-sales">Talk to us</a></nav>${groups()}</div>`};
 if(menu.trigger==='label:Product')return {...menu,html:menu.html.replace('<div class="capture-showcase-footer">',`<nav class="capture-supporting-modules" aria-label="More product workflows">${supportingModules.map(link=>`<a href="${link.href}">${link.label} <span aria-hidden="true">→</span></a>`).join('')}</nav><div class="capture-showcase-footer">`)};
 return menu;
});}
