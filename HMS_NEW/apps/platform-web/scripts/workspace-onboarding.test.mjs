import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, fromIntake, workspacePayload, restoreActive, persistActive, requestWorkspace, readWorkspace, safeWorkspaceUrl } from '../src/lib/workspace-onboarding.ts';
const input={...emptyWorkspace,organisation:'Example Clinic',slug:'example-clinic',ownerName:'Test Owner',email:'owner@example.test',facilityName:'Example Clinic',city:'Bengaluru',websiteTemplate:'sri-lakshmi'};
test('real payload requires consent and matches the provisioning contract',()=>{
 assert.throws(()=>workspacePayload(input,false),/Confirm/);
 assert.throws(()=>workspacePayload({...input,plan:'launch',voice:true},true),/requires/);
 assert.throws(()=>workspacePayload({...input,websiteTemplate:'clinic-1'},true),/supported/);
 assert.equal(workspacePayload(input,true).websiteTemplate,'sri-lakshmi');
 assert.equal(workspacePayload({...input,email:' owner@example.test '},true).email,'owner@example.test');
});
test('quote data maps to owner/facility with supported template only',()=>{
 const intake={profile:{name:'Owner',email:'a@example.test',phone:'123'},facility:{name:'Care Hospital',city:'Pune',size:'hospital'},preferences:{template:'sri-lakshmi'}};
 assert.equal(fromIntake(intake).slug,'care-hospital');assert.equal(fromIntake(intake).websiteTemplate,'sri-lakshmi');
 assert.equal(fromIntake({...intake,preferences:{template:'clinic-1'}}).websiteTemplate,'standard');
});
test('status storage never persists passwords or stale deployment links',()=>{
 let saved;persistActive({setItem:(_,value)=>{saved=value;}},{onboardingId:'12345678-1234-1234-1234-123456789012',accessToken:'x'.repeat(40),status:'ready',temporary_password:'secret',public_url:'https://clinic.example'});
 assert.ok(!saved.includes('secret'));assert.ok(!saved.includes('clinic.example'));assert.equal(restoreActive(JSON.parse(saved)).status,'ready');assert.equal(restoreActive({status:'ready'}),null);
 assert.equal(safeWorkspaceUrl('javascript:alert(1)'),undefined);assert.equal(safeWorkspaceUrl('https://clinic.example/'),'https://clinic.example/');
});
test('lost responses retry the exact keys and payload; polling normalizes GET id',async()=>{
 const original=globalThis.fetch,calls=[];const pending={key:'k'.repeat(36),access:'a'.repeat(64),payload:workspacePayload(input,true)};
 globalThis.fetch=async(url,init)=>{calls.push({url,init});if(calls.length===1)throw new Error('network');return new Response(JSON.stringify(url.endsWith('/onboarding')?{onboardingId:'12345678-1234-1234-1234-123456789012',status:'queued',accessToken:pending.access}:{id:'12345678-1234-1234-1234-123456789012',status:'ready',staff_url:'https://clinic.example/staff',temporary_password:'one-time'}),{status:url.endsWith('/onboarding')?202:200});};
 try{
  await assert.rejects(requestWorkspace(pending),/network/);const active=await requestWorkspace(pending);assert.deepEqual(calls[0],calls[1]);
  const ready=await readWorkspace(active);assert.equal(ready.status,'ready');assert.equal(ready.temporary_password,'one-time');assert.equal(calls[2].init.headers.authorization,`Bearer ${pending.access}`);
 }finally{globalThis.fetch=original;}
});

test('editorial template survives quote handoff, validation, and draft recovery without fixing a hospital name',()=>{
 const intake={profile:{name:'Owner',email:'a@example.test',phone:''},facility:{name:'NDR Hospital',city:'Chennai',size:'hospital'},preferences:{template:'hospital-editorial'}};
 const draft=fromIntake(intake);
 assert.equal(draft.websiteTemplate,'hospital-editorial');assert.equal(draft.facilityName,'NDR Hospital');
 assert.equal(workspacePayload(draft,true).websiteTemplate,'hospital-editorial');
 assert.equal(workspacePayload({...draft,facilityName:'Riverbend Hospital'},true).facilityName,'Riverbend Hospital');
});
