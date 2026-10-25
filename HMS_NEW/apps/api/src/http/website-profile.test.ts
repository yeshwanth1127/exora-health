import {afterAll,beforeAll,expect,it} from 'vitest';
import {startKit,type Kit} from './test-kit.ts';
import {tenantWebsiteProfile,websiteContent} from '../modules/booking/website-profile.ts';
let one:Kit,two:Kit;
beforeAll(async()=>{
 one=await startKit('editorial-one',undefined,undefined,undefined,tenant=>({publicTenantId:tenant.tenantId}));
 two=await startKit('editorial-two');
 await one.admin.query("UPDATE platform.facility SET name='NDR Hospital',city='Chennai',address_line1='Hospital road',phone='+914412345678' WHERE id=$1",[one.tenant.facilityId]);
 await two.admin.query("UPDATE platform.facility SET name='Other Hospital',phone='+914499999999' WHERE id=$1",[two.tenant.facilityId]);
});
afterAll(async()=>{await one?.close();await two?.close();});
it('returns persisted public facility identity with no demo content, credentials or owner contact',async()=>{
 const response=await one.app.inject('/public/v1/website');expect(response.statusCode).toBe(200);
 expect(response.json()).toMatchObject({name:'NDR Hospital',city:'Chennai',address:'Hospital road, Chennai',phone:'+914412345678',content:{photos:[],packages:[]}});
 expect(Object.keys(response.json()).sort()).toEqual(['address','city','content','name','organisation','phone','slug','timezone']);
 expect(response.headers['cache-control']).toBe('no-store');
});
it('reflects name changes and does not select another tenant facility',async()=>{
 await one.admin.query("UPDATE platform.facility SET name='Renamed Medical Centre' WHERE id=$1",[one.tenant.facilityId]);
 const profile=await tenantWebsiteProfile(one.db,one.tenant.tenantId,websiteContent(),one.tenant.facilityId);
 expect(profile.name).toBe('Renamed Medical Centre');
 const wrong=await tenantWebsiteProfile(one.db,one.tenant.tenantId,websiteContent(),two.tenant.facilityId);
 expect(wrong.name).not.toBe('Other Hospital');expect(wrong.phone).not.toBe('+914499999999');
});
it('accepts only bounded public content and safe image URLs',()=>{
 expect(websiteContent().photos).toEqual([]);
 for(const src of ['javascript:alert(1)','//foreign.example/image.jpg','data:image/svg+xml,bad'])expect(()=>websiteContent(JSON.stringify({heroImage:src}))).toThrow();
 expect(websiteContent(JSON.stringify({heroImage:'/images/consultation.jpg'})).heroImage).toBe('/images/consultation.jpg');
 expect(()=>websiteContent('{bad')).toThrow();expect(()=>websiteContent(JSON.stringify({phone:'+91123456789'}))).toThrow();
});
