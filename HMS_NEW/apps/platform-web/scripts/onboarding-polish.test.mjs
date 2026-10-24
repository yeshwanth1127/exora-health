import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,workspacePayload,restoreDraft,restoreQuoteDraft,stepErrors,provisioningProgress,readWorkspace} from '../src/lib/workspace-onboarding.ts';
import {parseClinicModules,toggleClinicModule,entitledModules} from '../../../packages/platform/onboarding-modules.mjs';
const valid={...emptyWorkspace,ownerName:'Test Owner',organisation:'Test Clinic',email:'owner@example.test',slug:'test-clinic',city:'Pune',facilityName:'Test Clinic'};
test('module selection handles dependencies and permits core-only access',()=>{
 assert.deepEqual(parseClinicModules([]),[]);
 const selected=toggleClinicModule([], 'inpatient',true);assert.deepEqual(selected,['inpatient','billing']);
 assert.deepEqual(toggleClinicModule(selected,'billing',false),[]);
 assert.deepEqual(toggleClinicModule([],'pharmacy',true),['inventory','pharmacy']);
 assert.throws(()=>parseClinicModules(['inpatient']),/Billing/);assert.throws(()=>parseClinicModules(['pharmacy']),/Inventory/);
 assert.throws(()=>parseClinicModules(['billing','billing']),/once/);assert.throws(()=>parseClinicModules(['unknown']),/supported/);
 assert.ok(!entitledModules('launch',[]).includes('comms'));assert.ok(!entitledModules('connect',[]).includes('billing'));assert.ok(entitledModules('connect',['billing']).includes('billing'));
});
test('saved module choices survive restore, payload and safe legacy recovery',()=>{
 const draft={...valid,clinicModules:['inpatient','billing']};assert.deepEqual(restoreDraft(draft,valid).clinicModules,draft.clinicModules);assert.deepEqual(workspacePayload(draft,true).clinicModules,draft.clinicModules);
 const legacy={...valid};delete legacy.clinicModules;assert.equal('clinicModules' in workspacePayload(legacy,true),false);assert.equal(parseClinicModules(undefined).length,5);
 assert.deepEqual(restoreDraft({...valid,clinicModules:['unknown']},valid).clinicModules,[]);
});
test('each form step validates inline before advancing',()=>{
 assert.deepEqual(Object.keys(stepErrors(emptyWorkspace,0)),['ownerName','email']);assert.deepEqual(stepErrors(valid,0),{});
 assert.ok(stepErrors({...valid,slug:'x'},1).slug);assert.ok(stepErrors({...valid,timezone:'Mars/Olympus'},2).timezone);
 assert.ok(stepErrors({...valid,clinicModules:['inpatient']},3).clinicModules);assert.ok(stepErrors({...valid,plan:'launch',voice:true},3).plan);
});
test('queued and working states never claim site creation is complete',()=>{
 assert.equal(provisioningProgress('ready',false).current,0);assert.equal(provisioningProgress('queued',true).current,1);assert.equal(provisioningProgress('provisioning',true).current,1);assert.equal(provisioningProgress('failed',true).current,1);assert.equal(provisioningProgress('ready',true).current,3);
});
test('status carries server-assigned destination without promoting it to ready',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({id:'12345678-1234-1234-1234-123456789012',status:'provisioning',target_url:'https://test.example/',slug:'test-clinic',updated_at:'2026-10-22T12:00:00.000Z'}));
 try{const next=await readWorkspace({onboardingId:'12345678-1234-1234-1234-123456789012',accessToken:'a'.repeat(64),status:'queued'});assert.equal(next.target_url,'https://test.example/');assert.equal(next.status,'provisioning');assert.equal(next.slug,'test-clinic');}finally{globalThis.fetch=original;}
});

test('quote template wins over stale draft once, then onboarding edits survive reloads',()=>{
 const values=new Map();const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const intake={expiresAt:1234,profile:{name:'Quote Owner',email:'',phone:''},facility:{name:'Quote Clinic',city:'Pune',size:'hospital'},preferences:{template:'sri-lakshmi'}};
 const applied=restoreQuoteDraft({...valid,websiteTemplate:'standard'},intake,storage);
 assert.equal(applied.websiteTemplate,'sri-lakshmi');assert.equal(applied.email,valid.email);
 assert.equal(JSON.parse(values.get('exora-onboarding')).websiteTemplate,'sri-lakshmi');
 assert.equal(restoreQuoteDraft({...applied,websiteTemplate:'standard'},intake,storage).websiteTemplate,'standard');
 assert.equal(restoreQuoteDraft(applied,{...intake,expiresAt:1235,preferences:{template:'standard'}},storage).websiteTemplate,'standard');
 assert.equal(restoreQuoteDraft(applied,null,storage).websiteTemplate,'sri-lakshmi');
});
test('website validation follows the consolidated modules and launch step',()=>{
 assert.equal(stepErrors({...valid,websiteTemplate:'unknown'},3).websiteTemplate,undefined);
 assert.ok(stepErrors({...valid,websiteTemplate:'unknown'},4).websiteTemplate);
 assert.equal(stepErrors({...valid,plan:'launch',voice:true},4).plan,undefined);
});

test('blocked browser storage does not prevent applying a valid quote preference',()=>{
 const unavailable={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 const intake={expiresAt:1,profile:{name:'Owner',email:'',phone:''},facility:{name:'Clinic',city:'Pune',size:'clinic'},preferences:{template:'sri-lakshmi'}};
 assert.equal(restoreQuoteDraft(valid,intake,unavailable).websiteTemplate,'sri-lakshmi');
});
