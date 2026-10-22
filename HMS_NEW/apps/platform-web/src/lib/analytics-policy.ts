// Only fixed route/event identifiers cross the analytics boundary. Never pass form values.
export const ANALYTICS_CONSENT_KEY='website.analytics-consent.v1';
export const analyticsPaths=['/','/product/features','/pricing','/teams','/enterprise','/contact-sales','/help','/releases','/blog','/blog/a-clearer-front-desk','/blog/a-shared-clinic-day','/blog/follow-ups-with-a-clear-next-step','/quote','/onboarding','/privacy','/resources/clinic-front-desk-checklist','/solutions/ai-receptionist','/solutions/whatsapp-outreach','/solutions/google-business-management','/solutions/clinic-analytics'];
export function analyticsPath(value:string):string|undefined {
 try{const path=new URL(value,'https://analytics.invalid').pathname.replace(/\/$/,'')||'/';return analyticsPaths.includes(path)?path:undefined;}catch{return undefined;}
}
export const analyticsEvents=['$pageview','website_cta_clicked','quote_step_viewed','onboarding_step_viewed','workspace_request_submitted','workspace_request_failed','workspace_status_changed'] as const;
export type AnalyticsEvent=typeof analyticsEvents[number];
const allowedValues:Record<string,readonly string[]>={
 stage:['facility','volume','target','marketing','business','website','contact','offer','account','workspace','launch','review'],
 plan:['launch','connect','scale'],template:['standard','sri-lakshmi'],status:['queued','provisioning','ready','failed'],
 outcome:['accepted','unavailable'],referrer_type:['direct','google','bing','chatgpt','perplexity','claude','other'],
};
export function cleanAnalyticsProperties(input:Record<string,unknown>):Record<string,string>{
 const output:Record<string,string>={};
 for(const key of ['path','target_path']){const value=input[key];if(typeof value==='string'){const path=analyticsPath(value);if(path)output[key]=path;}}
 for(const [key,values]of Object.entries(allowedValues)){const value=input[key];if(typeof value==='string'&&values.includes(value))output[key]=value;}
 return output;
}
export function referrerType(value:string):string {
 if(!value)return 'direct';
 try{const host=new URL(value).hostname;
  if(/(^|\.)google\.[a-z.]+$/.test(host))return 'google';
  if(/(^|\.)bing\.com$/.test(host))return 'bing';
  if(/(^|\.)(chatgpt\.com|chat\.openai\.com)$/.test(host))return 'chatgpt';
  if(/(^|\.)perplexity\.ai$/.test(host))return 'perplexity';
  if(host==='claude.ai')return 'claude';
 }catch{}return 'other';
}
export function analyticsHost(value:string):string|undefined {try{const url=new URL(value);return url.protocol==='https:'&&['us.i.posthog.com','eu.i.posthog.com'].includes(url.hostname)&&url.pathname==='/'&&!url.search&&!url.hash&&!url.username&&!url.password?url.origin:undefined;}catch{return undefined;}}

export function sanitisePosthogEvent<T extends {event:string;properties?:Record<string,unknown>}>(event:T|null,origin:string):T|null {
 if(!event||!analyticsEvents.includes(event.event as AnalyticsEvent))return null;
 const properties=event.properties||{};const safe=cleanAnalyticsProperties(properties);
 return {...event,properties:{...safe,...(safe.path&&origin?{$current_url:origin+safe.path,$pathname:safe.path}:{}),distinct_id:properties.distinct_id,$process_person_profile:false,$geoip_disable:true}};
}
