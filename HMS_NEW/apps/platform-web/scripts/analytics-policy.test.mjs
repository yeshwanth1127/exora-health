import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyticsPath,analyticsHost,cleanAnalyticsProperties,referrerType,sanitisePosthogEvent} from '../src/lib/analytics-policy.ts';
import {trackWebsite,setAnalyticsSender} from '../src/lib/website-analytics.ts';
test('analytics accepts fixed routes only and strips query/hash and all personal input',()=>{
 const clean=cleanAnalyticsProperties({path:'/onboarding?email=private@example.test#token',stage:'account',plan:'connect',template:'sri-lakshmi',email:'private@example.test',temporary_password:'secret',onboardingId:'sensitive',clinic:'My Clinic',$current_url:'https://host/?phone=123',target_path:'/staff/patients/123',status:'ready'});
 assert.deepEqual(clean,{path:'/onboarding',stage:'account',plan:'connect',template:'sri-lakshmi',status:'ready'});
 for(const path of ['/staff/patients/123','/admin','/control/v1/onboarding/id','/demo/overview','/unknown-user-name'])assert.equal(analyticsPath(path),undefined);
});
test('analytics is inert before a sender is enabled, and never forwards extra properties',()=>{
 const calls=[];setAnalyticsSender(undefined);assert.equal(trackWebsite('workspace_request_submitted',{email:'private@example.test'}),false);assert.equal(calls.length,0);
 setAnalyticsSender((event,props)=>calls.push({event,props}));trackWebsite('workspace_request_submitted',{path:'/onboarding',outcome:'accepted',phone:'123'});
 assert.deepEqual(calls,[{event:'workspace_request_submitted',props:{path:'/onboarding',outcome:'accepted'}}]);
 trackWebsite('unapproved',{path:'/onboarding'});assert.equal(calls.length,1);setAnalyticsSender(undefined);
});
test('referrals are fixed categories, cloud region configuration rejects unintended endpoints',()=>{
 assert.equal(referrerType('https://chatgpt.com/?email=private'),'chatgpt');assert.equal(referrerType('https://www.google.co.in/search?q=private'),'google');assert.equal(referrerType('https://patient.example/name'),'other');
 assert.equal(analyticsHost('https://eu.i.posthog.com'),'https://eu.i.posthog.com');for(const host of ['http://us.i.posthog.com','https://attacker.example','https://us.i.posthog.com/?private=yes'])assert.equal(analyticsHost(host),undefined);
});

test('PostHog before_send removes automatic URLs, identifiers, person data and unapproved events',()=>{
 const result=sanitisePosthogEvent({event:'$pageview',properties:{distinct_id:'random-browser-id',path:'/pricing?email=private',email:'private',token:'secret',$current_url:'https://bad.example/?password=secret',$set:{email:'private'},$referrer:'https://search/?q=private',$initial_person_info:{clinic:'private'}}},'https://health.exora.solutions');
 assert.deepEqual(result.properties,{path:'/pricing',$current_url:'https://health.exora.solutions/pricing',$pathname:'/pricing',distinct_id:'random-browser-id',$process_person_profile:false,$geoip_disable:true});
 assert.equal(sanitisePosthogEvent({event:'$exception',properties:{message:'private'}},'https://health.exora.solutions'),null);
});
