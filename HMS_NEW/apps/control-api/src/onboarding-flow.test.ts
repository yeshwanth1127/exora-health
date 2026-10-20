import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import pg from 'pg';
import { config } from '../../../db/scripts/config.mjs';

const pool = new pg.Pool({ connectionString: config.testDatabaseUrl });
const provisionerToken = randomUUID();
const ids: string[] = [];
let child: ChildProcess, origin: string;
const input = { organisation: 'Sri Lakshmi Hospital', slug: 'clinic-one', ownerName: 'Test owner', email: 'owner@example.test', city: 'Bengaluru', timezone: 'Asia/Kolkata', facilityName: 'Sri Lakshmi Hospital', facilityType: 'hospital', plan: 'launch', voice: false, whatsapp: false, termsAccepted: true };
beforeAll(async () => {
  const root = path.resolve(import.meta.dirname, '../../..');
  origin = await new Promise<string>((resolve, reject) => {
    child = spawn(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'apps/control-api/src/main.ts'], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CONTROL_DATABASE_URL: config.testDatabaseUrl, HOST: '127.0.0.1', PORT: '0', AUTO_PROVISION: '0', AUTO_VOICE_PROVISION: '0', SERVE_PLATFORM_ASSETS: '0', PROVISIONER_TOKEN: provisionerToken },
    });
    const timer = setTimeout(() => reject(new Error('Local control API did not start')), 20000);
    child.stdout!.on('data', chunk => {
      const address = String(chunk).match(/Server listening at (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
      if (address) { clearTimeout(timer); resolve(address); }
    });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Local control API exited before startup')); });
  });
});
afterEach(async () => {
  for (const id of ids.splice(0)) await pool.query('DELETE FROM control.onboarding_request WHERE id=$1', [id]);
});
afterAll(async () => { child?.kill('SIGTERM'); await pool.end(); });
async function submit(extra: object = {}) {
  const response = await fetch(`${origin}/control/v1/onboarding`, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: JSON.stringify({ ...input, slug: `test-${randomUUID()}`, ...extra }) });
  const body = await response.json() as { onboardingId?: string };
  if (body.onboardingId) ids.push(body.onboardingId);
  return { response, body };
}
describe('website choice through the real control API and provisioning queue', () => {
  it('defaults existing onboarding callers to the standard website', async () => {
    const { response, body } = await submit();
    expect(response.status).toBe(202);
    const row = await pool.query('SELECT payload FROM control.onboarding_request WHERE id=$1', [body.onboardingId]);
    expect(row.rows[0].payload.websiteTemplate).toBe('standard');
  });
  it('persists Sri Lakshmi and passes that exact choice to the authenticated host provisioner', async () => {
    const { response, body } = await submit({ websiteTemplate: 'sri-lakshmi' });
    expect(response.status).toBe(202);
    const denied = await fetch(`${origin}/control/v1/internal/provisioning/claim`, { method: 'POST' });
    expect(denied.status).toBe(401);
    const claim = await fetch(`${origin}/control/v1/internal/provisioning/claim`, { method: 'POST', headers: { authorization: `Bearer ${provisionerToken}` } });
    expect(await claim.json()).toMatchObject({ id: body.onboardingId, payload: { websiteTemplate: 'sri-lakshmi' } });
  });
  it('rejects an unregistered template before queuing a request', async () => {
    expect((await submit({ websiteTemplate: '../../private' })).response.status).toBe(400);
  });
});
