// Real HTTP + signed OIDC/JWKS + restricted Postgres. External business providers are controlled
// adapters: this proves the application's onboarding/permission path, not provider approval.
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDb } from '@hms/db';
import { adminPool, createTenant, type TenantFixture } from '../../../../db/tests/db.ts';
import { config } from '../../../../db/scripts/config.mjs';
import { ensureManagedBookingIdentity } from '../../../../db/scripts/managed-booking-identity.mjs';
import { createVerifier } from '../auth/verify.ts';
import { loadConfig } from '../config.ts';
import { bookingAuthority } from '../modules/comms/managed-booking-chat.ts';
import type { ManagedSettings } from '../modules/comms/managed-config.ts';
import { buildServer } from '../server.ts';

const previousEnv = { ...process.env };
const admin = adminPool(), db = createDb({ connectionString: config.testAppDatabaseUrl, maxConnections: 5 });
const keys = await generateKeyPair('RS256');
const jwk = { ...await exportJWK(keys.publicKey), kid: 'onboarding', alg: 'RS256', use: 'sig' };
const idp = createServer((_req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ keys: [jwk] })); });
let issuer: string, base: string, app: FastifyInstance, tenant: TenantFixture, otherFacility: string;
let owner: string, ownerStaff: string, desk: string, branch: string, outsider: string;
const token = (subject: string, email: string, verified = true, aud = 'hms-api') => new SignJWT({ email, email_verified: verified })
  .setProtectedHeader({ alg: 'RS256', kid: 'onboarding' }).setIssuer(issuer).setAudience(aud)
  .setSubject(subject).setIssuedAt().setExpirationTime('10m').sign(keys.privateKey);
const providerCalls: string[] = [];
const providerRequests: { url: string; init: RequestInit }[] = [];
const settings: ManagedSettings = {
  encryptionKey: Buffer.alloc(32, 5), publicOrigin: 'https://onboarding.example.com',
  google: { clientId: 'public-client-id', clientSecret: 'private-google-secret' },
  meta: { appId: '111111', configId: '222222', appSecret: 'private-meta-secret', graphVersion: 'v23.0' },
  umami: { origin: 'https://analytics.example.com', key: 'private-umami-key' },
  whatsappSending: true, webhookVerifyToken: 'private-verify-token',
  fetcher: async (url, init = {}) => {
    const u = new URL(String(url)); providerRequests.push({url:String(url),init}); providerCalls.push(u.host + u.pathname);
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    if (u.host === 'analytics.example.com' && u.pathname === '/api/websites') return json(JSON.parse(String(init.body)));
    if (u.host === 'oauth2.googleapis.com') return json({ access_token: 'private-access-token', refresh_token: 'private-refresh-token', expires_in: 3600, scope: 'https://www.googleapis.com/auth/business.manage' });
    if (u.host === 'mybusinessaccountmanagement.googleapis.com') return json({ accounts: [{ name: 'accounts/333', accountName: 'Owner business' }] });
    if (u.host === 'mybusinessbusinessinformation.googleapis.com') return json({ locations: [{ name: 'locations/444', title: 'Owner clinic' }] });
    if (u.host === 'graph.facebook.com' && u.pathname.endsWith('/oauth/access_token')) return json({ access_token: 'private-meta-token' });
    if (u.pathname.endsWith('/subscribed_apps') && !init.method) return json({data:[{whatsapp_business_api_data:{id:'111111'},override_callback_uri:'https://existing.exora.example/webhook'}]});
    if (u.host === 'graph.facebook.com' && u.pathname.endsWith('/phone_numbers')) return json({ data: [{ id: '888888888', display_phone_number: '+919876543210', verified_name: 'Owner clinic', code_verification_status: 'VERIFIED', is_on_biz_app: true }] });
    if (u.searchParams.get('fields') === 'webhook_configuration') return json({webhook_configuration:{phone_number:settings.publicOrigin + '/v1/integrations/whatsapp/webhook'}});
    if (u.pathname.endsWith('/smb_app_data')) return json({ request_id: 'sync-request' });
    if (u.host === 'graph.facebook.com') return json({ success: true });
    return new Response('{}', { status: 404 });
  },
};
async function call(who: string, method: string, path: string, body?: unknown, extra: Record<string,string> = {}) {
  const response = await fetch(base + path, { method, redirect: 'manual', headers: { authorization: `Bearer ${who}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }), 'idempotency-key': randomUUID(), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  // No browser-visible body may contain company secrets or exchanged tokens.
  expect(text).not.toMatch(/private-(google|meta|umami|access|refresh)/);
  return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
}
async function invite(name: string, role: string, scope: string | null) {
  const email = `${name}@example.test`, subject = randomUUID();
  const { rows: [r] } = await admin.query("SELECT id FROM platform.role WHERE tenant_id IS NULL AND code=$1", [role]);
  const result = await call(owner, 'POST', '/v1/staff-accounts', { displayName: name, employeeNo: name, staffType: 'admin', email, roleId: r.id, facilityId: scope });
  expect(result.status, JSON.stringify(result.body)).toBe(201);
  expect(result.body.accountStatus).toBe('invited');
  return { email, subject, token: await token(subject, email) };
}
beforeAll(async () => {
  process.env.WA_APP_SECRET = settings.meta!.appSecret;
  process.env.WA_VERIFY_TOKEN = settings.webhookVerifyToken;
  await new Promise<void>(resolve => idp.listen(0, '127.0.0.1', resolve));
  issuer = `http://127.0.0.1:${(idp.address() as {port:number}).port}`;
  tenant = await createTenant(admin, 'onboarding');
  const { rows: [f] } = await admin.query("INSERT INTO platform.facility(tenant_id,organization_id,code,name,facility_type,state_code) VALUES($1,$2,'BRANCH','Other branch','clinic','29') RETURNING id", [tenant.tenantId, tenant.organizationId]);
  otherFacility = f.id;
  const { rows: [s] } = await admin.query("INSERT INTO platform.staff(tenant_id,employee_no,given_name,display_name,staff_type,email) VALUES($1,'OWNER','Clinic','Clinic owner','admin','owner@example.test') RETURNING id", [tenant.tenantId]);
  ownerStaff = s.id;
  await admin.query("INSERT INTO platform.user_account(tenant_id,staff_id,email,status,invite_expires_at) VALUES($1,$2,'owner@example.test','invited',now()+interval '14 days')", [tenant.tenantId, s.id]);
  await admin.query("INSERT INTO platform.role_grant(tenant_id,staff_id,role_id) SELECT $1,$2,id FROM platform.role WHERE tenant_id IS NULL AND code='tenant_admin'", [tenant.tenantId,s.id]);
  app = buildServer({ db, publicTenantId: tenant.tenantId, managed: settings,
    verifier: createVerifier({ mode: 'oidc', issuer, audience: 'hms-api', jwksUrl: issuer + '/jwks' }) });
  base = await app.listen({ port: 0, host: '127.0.0.1' });
  owner = await token('owner-subject', 'owner@example.test');
});
afterAll(async () => { for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key]; Object.assign(process.env, previousEnv); await app?.close(); await new Promise<void>(resolve => idp.close(() => resolve())); await db.destroy(); await admin.end(); });

describe('customer onboarding with verified identity and facility permissions', () => {
  it('refuses development auth in production, invalid audience and unverified owner email', async () => {
    expect(() => loadConfig({ NODE_ENV: 'production', AUTH_MODE: 'dev' })).toThrow('not allowed');
    expect((await call(await token('owner-subject', 'owner@example.test', false), 'GET', '/v1/me')).status).toBe(403);
    expect((await call(await token('owner-subject', 'owner@example.test', true, 'wrong-api'), 'GET', '/v1/me')).status).toBe(401);
    const { rows: [account] } = await admin.query('SELECT status,identity_subject FROM platform.user_account WHERE staff_id=$1', [ownerStaff]);
    expect(account).toMatchObject({ status: 'invited', identity_subject: null });
  });
  it('links the invited owner once after verified sign-in and lets them invite clinic staff', async () => {
    expect((await call(owner, 'GET', '/v1/me')).status).toBe(200);
    const { rows: [account] } = await admin.query('SELECT status,identity_issuer,identity_subject FROM platform.user_account WHERE staff_id=$1', [ownerStaff]);
    expect(account).toMatchObject({ status: 'active', identity_issuer: issuer, identity_subject: 'owner-subject' });
    desk = (await invite('Receptionist', 'front_desk', tenant.facilityId)).token;
    branch = (await invite('BranchOwner', 'tenant_admin', tenant.facilityId)).token;
    const visitor = await createTenant(admin, 'onboarding-outsider');
    const { rows: [s] } = await admin.query("INSERT INTO platform.staff(tenant_id,employee_no,given_name,display_name,staff_type) VALUES($1,'OUT','Other','Other','admin') RETURNING id",[visitor.tenantId]);
    await admin.query("INSERT INTO platform.user_account(tenant_id,staff_id,identity_issuer,identity_subject,status) VALUES($1,$2,$3,'outsider','active')", [visitor.tenantId,s.id,issuer]);
    await admin.query("INSERT INTO platform.role_grant(tenant_id,staff_id,role_id) SELECT $1,$2,id FROM platform.role WHERE tenant_id IS NULL AND code='tenant_admin'",[visitor.tenantId,s.id]);
    outsider = await token('outsider', 'other@example.test');
  });
  it('lets a newly invited clinic administrator connect Google, WhatsApp and their website', async () => {
    expect((await call(branch, 'GET', '/v1/me')).status).toBe(200);
    const site = await call(branch, 'POST', '/v1/website-analytics/sites', { facilityId: tenant.facilityId, url: settings.publicOrigin });
    expect(site.status, JSON.stringify(site.body)).toBe(200);
    const google = await call(branch, 'POST', '/v1/google-business/connect', { facilityId: tenant.facilityId });
    expect(google.status).toBe(200);
    const state = new URL(google.body.authorizationUrl).searchParams.get('state')!;
    const callback = await fetch(`${base}/integrations/google/callback?state=${state}&code=approved-code`, { redirect: 'manual', headers: { cookie: `hms_google_state=${state}` } });
    expect(callback.headers.get('location')).toContain('google=choose');
    const locations = await call(branch, 'GET', `/v1/google-business/locations?facilityId=${tenant.facilityId}`);
    const selected = await call(branch, 'POST', '/v1/google-business/location', { facilityId: tenant.facilityId, locationId: locations.body.items[0].id });
    expect(selected.status, JSON.stringify(selected.body)).toBe(200);
    const wa = await call(branch, 'POST', '/v1/whatsapp-workspace/connect', { facilityId: tenant.facilityId });
    expect(wa.status).toBe(200);
    const complete = await call(branch, 'POST', '/v1/whatsapp-workspace/connect/complete', { facilityId: tenant.facilityId, attemptId: wa.body.attemptId, nonce: wa.body.nonce, code: 'approved-code', businessAccountId: '999999999', phoneNumberId: '888888888', path: 'coexistence' });
    expect(complete.status, JSON.stringify(complete.body)).toBe(200);
    const { rows } = await admin.query('SELECT provider,credential FROM comms.managed_connection WHERE tenant_id=$1 AND enabled', [tenant.tenantId]);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.credential).not.toContain('private-');
    expect(providerCalls).toContain('graph.facebook.com/v23.0/888888888/smb_app_data');
    expect(providerRequests.filter(r => r.url.endsWith('/subscribed_apps') && r.init.method === 'POST')).toHaveLength(0);
    const override = providerRequests.find(r => r.url.endsWith('/888888888') && r.init.method === 'POST')!;
    expect(JSON.parse(String(override.init.body))).toMatchObject({webhook_configuration:{override_callback_uri:settings.publicOrigin + '/v1/integrations/whatsapp/webhook'}});
    expect(providerRequests.filter(r => r.url.endsWith('/smb_app_data'))).toHaveLength(2);
    const workspace = await call(branch, 'GET', `/v1/whatsapp-workspace?facilityId=${tenant.facilityId}`);
    expect(workspace.body.connected).toBe(true);
    expect(workspace.body.setup.live).toBe(false); // Connecting alone cannot claim a published booking service.
  });
  it('renews the same Business app connection without requesting historical sync again', async()=>{
    const start=await call(branch,'POST','/v1/whatsapp-workspace/connect',{facilityId:tenant.facilityId});
    const result=await call(branch,'POST','/v1/whatsapp-workspace/connect/complete',{facilityId:tenant.facilityId,attemptId:start.body.attemptId,nonce:start.body.nonce,code:'renewed-code',businessAccountId:'999999999',path:'coexistence'});
    expect(result.status,JSON.stringify(result.body)).toBe(200);
    expect(providerRequests.filter(r=>r.url.endsWith('/smb_app_data'))).toHaveLength(2);
  });
  it('blocks reception setup, another branch and another tenant before touching providers', async () => {
    expect((await call(desk, 'GET', `/v1/whatsapp-workspace?facilityId=${tenant.facilityId}`)).status).toBe(200);
    const before = providerCalls.length;
    for (const who of [desk, outsider]) {
      for (const path of ['/v1/google-business/connect','/v1/whatsapp-workspace/connect'])
        expect((await call(who,'POST',path,{facilityId:tenant.facilityId})).status).toBe(who === desk ? 403 : 404);
      expect((await call(who,'POST','/v1/website-analytics/sites',{facilityId:tenant.facilityId,url:'https://forbidden.example.com'})).status).toBe(who === desk ? 403 : 404);
    }
    for (const path of ['/v1/google-business/connect','/v1/whatsapp-workspace/connect'])
      expect((await call(branch,'POST',path,{facilityId:otherFacility})).status).toBe(403);
    expect(providerCalls).toHaveLength(before);
  });
  it('acknowledges signed Business app sync without importing past chats, contacts or consent', async () => {
    const count = async () => (await admin.query('SELECT count(*)::int AS n FROM comms.contact_point WHERE tenant_id=$1',[tenant.tenantId])).rows[0].n;
    const before = await count();
    const send = async (waba:string, signed=true) => {
      const raw = JSON.stringify({object:'whatsapp_business_account',entry:[{id:waba,changes:[{field:'history',value:{pastPatient:'must not be stored'}},{field:'smb_app_state_sync',value:{contacts:[{name:'private-contact'}]}}]}]});
      return fetch(base + '/v1/integrations/whatsapp/webhook',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':'sha256=' + (signed?createHmac('sha256',settings.meta!.appSecret).update(raw).digest('hex'):'0'.repeat(64))},body:raw});
    };
    expect((await send('999999999')).status).toBe(200);
    expect((await send('666666666')).status).toBe(403);
    expect((await send('999999999',false)).status).toBe(403);
    expect(await count()).toBe(before);
  });
  it('revoking a user during provider consent prevents them from completing setup', async () => {
    const user = await invite('TemporaryAdmin','tenant_admin',tenant.facilityId);
    const started = await call(user.token,'POST','/v1/whatsapp-workspace/connect',{facilityId:tenant.facilityId});
    expect(started.status).toBe(200);
    const { rows:[account] } = await admin.query('SELECT staff_id FROM platform.user_account WHERE identity_subject=$1',[user.subject]);
    expect((await call(owner,'POST',`/v1/staff/${account.staff_id}/status`,{status:'inactive',reason:'Setup access withdrawn'})).status).toBe(200);
    const before = providerCalls.length;
    const complete = await call(user.token,'POST','/v1/whatsapp-workspace/connect/complete',{facilityId:tenant.facilityId,attemptId:started.body.attemptId,nonce:started.body.nonce,code:'approved-code',businessAccountId:'999999999',phoneNumberId:'888888888',path:'coexistence'});
    expect(complete.status).toBe(403); expect(providerCalls).toHaveLength(before);
  });
  it('automatically exposes only the hosted site identifier, and removal disables collection', async () => {
    const publicResult = await fetch(base + '/public/v1/bootstrap', { headers: { host: 'spoofed.example.com' } });
    const body: any = await publicResult.json();
    expect(body.analytics).toMatchObject({ siteId: expect.any(String), script: '/a.js' });
    expect(JSON.stringify(body.analytics)).not.toMatch(/umami|private-|key|credential/);
    const removed = await call(owner,'DELETE',`/v1/website-analytics/sites/${body.analytics.siteId}?facilityId=${tenant.facilityId}`);
    expect(removed.status).toBe(200);
    expect(((await (await fetch(base + '/public/v1/bootstrap')).json()) as any).analytics).toBeNull();
  });
  it('provisions a fresh OIDC owner invite and booking identity through the real bootstrap', async () => {
    const tenantId = randomUUID(), facilityId = randomUUID(), staffId = randomUUID();
    const result = spawnSync(process.execPath, ['db/scripts/bootstrap-runtime.mjs'], { encoding:'utf8', env: {
      ...process.env, ADMIN_DATABASE_URL:config.adminUrl, DATABASE_URL:config.testDatabaseUrl, APP_DATABASE_URL:config.testAppDatabaseUrl,
      TENANT_BOOTSTRAP:'custom', TENANT_SLUG:'acceptance-' + tenantId.slice(0,8), TENANT_PLAN:'connect', VOICE_REQUESTED:'0', AUTH_MODE:'oidc',
      BOOTSTRAP_TENANT_ID:tenantId, BOOTSTRAP_FACILITY_ID:facilityId, BOOTSTRAP_TENANT_NAME:'Acceptance Clinic',
      BOOTSTRAP_OWNER_NAME:'Acceptance Owner', BOOTSTRAP_OWNER_EMAIL:'acceptance@example.test', BOOTSTRAP_FACILITY_NAME:'Main Clinic', BOOTSTRAP_CITY:'Bengaluru', MANAGED_BOOKING_STAFF_ID:staffId,
    }});
    expect(result.status, result.stderr).toBe(0);
    const { rows:[owner] } = await admin.query("SELECT status,identity_subject,invite_expires_at FROM platform.user_account WHERE tenant_id=$1 AND email='acceptance@example.test'",[tenantId]);
    expect(owner.status).toBe('invited'); expect(owner.identity_subject).toBeNull(); expect(owner.invite_expires_at).not.toBeNull();
    const { rows:[booking] } = await admin.query("SELECT identity_issuer,status FROM platform.user_account WHERE tenant_id=$1 AND staff_id=$2",[tenantId,staffId]);
    expect(booking).toEqual({identity_issuer:'hms-managed-booking',status:'active'});
  });
  it('reconciles the dedicated booking identity idempotently with access only to its clinic', async () => {
    const staffId = randomUUID(), client = await admin.connect();
    try {
      for (let i=0;i<2;i++) await ensureManagedBookingIdentity(client,{tenantId:tenant.tenantId,facilityId:tenant.facilityId,staffId});
    } finally { client.release(); }
    const caller = await bookingAuthority(db,{siteSlug:'test-clinic',tenantId:tenant.tenantId,facilityId:tenant.facilityId,identityIssuer:'hms-managed-booking',identitySubject:tenant.tenantId,origins:[settings.publicOrigin!],websiteBranchId:null,doctorAliases:{}});
    expect(caller.actor).toMatchObject({staffId});
    await expect(bookingAuthority(db,{siteSlug:'test-clinic',tenantId:tenant.tenantId,facilityId:otherFacility,identityIssuer:'hms-managed-booking',identitySubject:tenant.tenantId,origins:[settings.publicOrigin!],websiteBranchId:null,doctorAliases:{}})).rejects.toThrow('missing permission');
    const { rows } = await admin.query('SELECT id FROM platform.role_grant WHERE staff_id=$1 AND revoked_at IS NULL',[staffId]);
    expect(rows).toHaveLength(1);
  });
});
