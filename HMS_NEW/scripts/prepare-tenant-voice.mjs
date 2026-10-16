#!/usr/bin/env node
// Enables the tenant-side voice API and creates missing credentials. It does not create or expose a
// Sarvam agent; run configure-tenant-voice.mjs after the tenant has HTTPS and a committed agent.
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv.slice(2).filter((value) => value !== '--');
const at = input.indexOf('--slug');
const slug = at >= 0 ? input[at + 1]?.trim() : '';
if (!slug || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) throw new Error('--slug is required');
const envPath = path.join(root, '.tenants', slug, '.env');
if (!existsSync(envPath)) throw new Error(`No local tenant environment exists for ${slug}`);
const values = new Map(readFileSync(envPath, 'utf8').trimEnd().split('\n').map((line) => {
  const split = line.indexOf('=');
  return split < 0 ? [line, ''] : [line.slice(0, split), line.slice(split + 1)];
}));
const decoded = (name) => {
  const value = values.get(name);
  if (!value) return '';
  try { return JSON.parse(value); } catch { return value; }
};
const set = (name, value) => values.set(name, JSON.stringify(String(value)));
const secret = () => randomBytes(40).toString('base64url');
set('VOICE_REQUESTED', '1');
if (!decoded('VOICE_SERVICE_KEY')) set('VOICE_SERVICE_KEY', secret());
if (!decoded('VOICE_SIGNING_SECRET')) set('VOICE_SIGNING_SECRET', secret());
if (!decoded('VOICE_SERVICE_ACCOUNT_ID')) set('VOICE_SERVICE_ACCOUNT_ID', randomUUID());
if (!decoded('VOICE_NOTICE_VERSION')) set('VOICE_NOTICE_VERSION', '2026-10-14');
if (!decoded('VOICE_SESSION_SECONDS')) set('VOICE_SESSION_SECONDS', '900');
writeFileSync(envPath, [...values].map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
execFileSync('docker', ['compose', '--env-file', envPath, '-f', path.join(root, 'compose.tenant.yml'), 'up', '-d', '--no-build', '--force-recreate', 'app'], { cwd: root, stdio: 'inherit' });
console.log(`Tenant voice API prepared for ${slug}; credentials remain in ${envPath}.`);
