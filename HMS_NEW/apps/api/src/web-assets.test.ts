import { afterEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { registerTenantWebAssets } from './web-assets.ts';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
async function fixture(template?: string, bookingSite?: string) {
  const root = await mkdtemp(path.join(tmpdir(), 'hms-website-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  for (const [app, content] of [['public-web', 'standard website'], ['sri-lakshmi-web', 'Sri Lakshmi website'], ['hospital-editorial-web','editorial hospital website'], ['hospital-community-web','Swastikaa website'], ['staff-web', 'staff dashboard']]) {
    const dir = path.join(root, 'apps', app!, 'dist');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), content!);
  }
  const app = Fastify();
  cleanups.push(() => app.close());
  app.get('/public/v1/booking/clinic-one/catalog', async () => ({ doctors: [] }));
  await registerTenantWebAssets(app, { root, template, bookingSite });
  return app;
}
describe('tenant website deployment', () => {
  it('keeps existing tenants on the standard website', async () => {
    const app = await fixture();
    expect((await app.inject('/')).body).toBe('standard website');
    expect((await app.inject('/staff/appointments')).body).toBe('staff dashboard');
  });
  it('serves Sri Lakshmi and its deep links alongside the same dashboard and booking API', async () => {
    const app = await fixture('sri-lakshmi', 'clinic-one');
    for (const url of ['/', '/doctors', '/doctors/doctor-one', '/schedule-appointment/doctor-one']) {
      expect((await app.inject(url)).body).toBe('Sri Lakshmi website');
    }
    expect((await app.inject('/staff/appointments')).body).toBe('staff dashboard');
    expect((await app.inject('/public/v1/booking/clinic-one/catalog')).json()).toEqual({ doctors: [] });
    const config = await app.inject('/website-config.js');
    expect(config.body).toBe('window.HMS_WEBSITE={"bookingSite":"clinic-one"};');
    expect(config.headers['cache-control']).toBe('no-store');
    for (const url of ['/public/v1/missing', '/api/missing', '/assets/missing.js', '/missing.png']) {
      expect((await app.inject(url)).statusCode).toBe(404);
    }
  });
  it('refuses unknown templates and an unbound Sri Lakshmi deployment', async () => {
    await expect(fixture('../../private', 'clinic-one')).rejects.toThrow('Unknown website template');
    await expect(fixture('sri-lakshmi')).rejects.toThrow('requires a tenant booking site');
  });
});

it('serves the editorial hospital template without changing Sri Lakshmi, staff or API paths',async()=>{
 const app=await fixture('hospital-editorial','ndr-hospital');
 for(const url of ['/','/doctors','/doctors/dr-one','/book/dr-one','/contact'])expect((await app.inject(url)).body).toBe('editorial hospital website');
 expect((await app.inject('/website-config.js')).body).toBe('window.HMS_WEBSITE={"bookingSite":"ndr-hospital"};');
 expect((await app.inject('/staff/appointments')).body).toBe('staff dashboard');
 expect((await app.inject('/assets/missing.js')).statusCode).toBe(404);
 await expect(fixture('hospital-editorial')).rejects.toThrow('requires a tenant booking site');
});

it('serves Swastikaa deep routes with the tenant binding and shared dashboard',async()=>{
 const app=await fixture('swastikaa','any-hospital');
 for(const url of ['/','/consultants/dr-one','/clinics/medicine','/treatments/example','/tests-scans/mri','/book','/contact'])expect((await app.inject(url)).body).toBe('Swastikaa website');
 expect((await app.inject('/website-config.js')).body).toContain('"bookingSite":"any-hospital"');
 expect((await app.inject('/staff/appointments')).body).toBe('staff dashboard');
 expect((await app.inject('/public/v1/missing')).statusCode).toBe(404);
 await expect(fixture('swastikaa')).rejects.toThrow('requires a tenant booking site');
});

it.each(['hospital-pathway','hospital-atlas','hospital-grove'])('serves %s using the shared hospital bundle and explicit runtime identity',async template=>{
 const app=await fixture(template,'river-hospital');
 for(const url of ['/','/consultants/dr-one','/clinics/medicine','/treatments/example','/tests-scans/mri','/book','/insurance','/plans','/visit'])expect((await app.inject(url)).body).toBe('Swastikaa website');
 expect((await app.inject('/website-config.js')).body).toBe('window.HMS_WEBSITE='+JSON.stringify({bookingSite:'river-hospital',template})+';');
 expect((await app.inject('/staff/appointments')).body).toBe('staff dashboard');
 await expect(fixture(template)).rejects.toThrow('requires a tenant booking site');
});
