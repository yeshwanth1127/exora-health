import {analyticsEvents,cleanAnalyticsProperties,type AnalyticsEvent} from './analytics-policy.ts';
let sender:((event:AnalyticsEvent,properties:Record<string,string>)=>void)|undefined;
export function setAnalyticsSender(next:typeof sender){sender=next;}
export function trackWebsite(event:AnalyticsEvent,properties:Record<string,unknown>={}){if(!sender||!analyticsEvents.includes(event))return false;sender(event,cleanAnalyticsProperties(properties));return true;}
