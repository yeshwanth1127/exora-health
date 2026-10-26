import {buildServer} from '../server.ts';
import {createVerifier} from '../auth/verify.ts';
import {DEV_SECRET_DEFAULT,DEV_ISSUER} from '../config.ts';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {startKit,type Kit,type Person} from './test-kit.ts';
import {tenantWebsiteProfile,websiteContent} from '../modules/booking/website-profile.ts';
let k:Kit,other:Kit,owner:Person,doctor:Person;
beforeAll(async()=>{k=await startKit('swastikaa-settings');other=await startKit('swastikaa-other');owner=await k.person('Owner','tenant_admin',null);doctor=await k.person('Doctor','doctor',k.tenant.facilityId,'doctor')});
afterAll(async()=>{await k?.close();await other?.close()});
it('retains demo content by default without inserting clinical sample records',async()=>{
 const r=await k.call(owner,'GET',`/v1/facilities/${k.tenant.facilityId}/website`);expect(r.status).toBe(200);expect(r.body).toMatchObject({version:null,demoEnabled:true,content:{photos:[],packages:[]}});
 const p=await tenantWebsiteProfile(k.db,k.tenant.tenantId,websiteContent(),k.tenant.facilityId,{template:'swastikaa',bookingSite:'any-hospital'});expect(p).toMatchObject({runtime:{template:'swastikaa',demoEnabled:true,bookingSite:'any-hospital'}});
});
it('saves bounded content with permission, tenant isolation and version conflict protection',async()=>{
 const path=`/v1/facilities/${k.tenant.facilityId}/website`,body={version:null,demoEnabled:false,content:{headline:'Care close to home',insurers:['Published insurer']}};
 expect((await k.call(doctor,'PUT',path,body,true)).status).toBe(403);
 expect((await k.call(owner,'PUT',`/v1/facilities/${other.tenant.facilityId}/website`,body,true)).status).toBe(404);
 expect((await k.call(owner,'PUT',path,{...body,content:{logoUrl:'javascript:alert(1)'}},true)).status).toBe(400);
 const result=await k.call(owner,'PUT',path,body,true);expect(result.status,JSON.stringify(result.body)).toBe(200);
 expect(result.body).toMatchObject({demoEnabled:false,content:{headline:body.content.headline,insurers:['Published insurer']}});
 expect((await k.call(owner,'PUT',path,body,true)).status).toBe(409);
 const p=await tenantWebsiteProfile(k.db,k.tenant.tenantId,websiteContent(),k.tenant.facilityId,{template:'swastikaa',bookingSite:'any-hospital'});expect(p).toMatchObject({runtime:{demoEnabled:false},content:{headline:body.content.headline}});expect(p.name).not.toBe('Swastikaa Hospital');
 const unaffected=await tenantWebsiteProfile(k.db,k.tenant.tenantId,websiteContent(),k.tenant.facilityId);expect(unaffected.content).toEqual({photos:[],packages:[]});expect(unaffected).not.toHaveProperty('runtime');
});

it('publishes the connected runtime and saved mode through the public website endpoint',async()=>{
 const previous=process.env.WEBSITE_TEMPLATE,facility=process.env.BOOTSTRAP_FACILITY_ID;
 process.env.WEBSITE_TEMPLATE='swastikaa';delete process.env.BOOTSTRAP_FACILITY_ID;
 const site={siteSlug:'river-hospital',tenantId:k.tenant.tenantId,facilityId:k.tenant.facilityId,identityIssuer:'test',identitySubject:'test',origins:['https://river.example'],doctorAliases:{},websiteBranchId:null};
 const booking={sites:[site],signingSecret:'test-only-signing-secret-123456789012345'};
 const app=buildServer({db:k.db,publicTenantId:k.tenant.tenantId,publicBooking:booking,managed:{encryptionKey:Buffer.alloc(32,9),publicOrigin:'https://river.example',whatsappSending:false,fetcher:fetch,booking},verifier:createVerifier({mode:'dev',secret:DEV_SECRET_DEFAULT,issuer:DEV_ISSUER})});
 try{const r=await app.inject('/public/v1/website');expect(r.statusCode,r.body).toBe(200);expect(r.json()).toMatchObject({runtime:{template:'swastikaa',demoEnabled:false,bookingSite:'river-hospital',facilityId:k.tenant.facilityId},content:{headline:'Care close to home'}});expect(r.json().name).not.toBe('Swastikaa Hospital');expect(r.headers['cache-control']).toBe('no-store')}
 finally{await app.close();if(previous===undefined)delete process.env.WEBSITE_TEMPLATE;else process.env.WEBSITE_TEMPLATE=previous;if(facility===undefined)delete process.env.BOOTSTRAP_FACILITY_ID;else process.env.BOOTSTRAP_FACILITY_ID=facility}
});

it.each(['hospital-pathway','hospital-atlas','hospital-grove'])('publishes %s using the same saved hospital content and explicit identity',async template=>{
 const profile=await tenantWebsiteProfile(k.db,k.tenant.tenantId,websiteContent(),k.tenant.facilityId,{template,bookingSite:'river-hospital'});
 expect(profile).toMatchObject({runtime:{template,demoEnabled:false,bookingSite:'river-hospital'},content:{headline:'Care close to home'}});
 expect(profile.name).not.toBe('Swastikaa Hospital');
});
