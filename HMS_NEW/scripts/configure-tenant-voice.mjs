#!/usr/bin/env node
// Binds a committed Sarvam agent to an already provisioned tenant without rotating its service key.
// SARVAM_API_KEY is intentionally read from the process environment so it never appears in shell
// history or the process argument list.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv.slice(2).filter((value) => value !== '--');
const args = new Map();
for (let index = 0; index < input.length; index += 2) {
  const key = input[index];
  const value = input[index + 1];
  if (!key?.startsWith('--') || value === undefined) throw new Error('Arguments must be --name value pairs');
  args.set(key.slice(2), value);
}
const required = (name) => {
  const value = args.get(name)?.trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
};
const slug = required('slug');
const version = Number(required('app-version'));
if (!Number.isInteger(version) || version < 1) throw new Error('--app-version must be a positive integer');
const apiKey = process.env.SARVAM_API_KEY?.trim();
if (!apiKey) throw new Error('Set SARVAM_API_KEY in the command environment; do not pass it as an argument');
const envPath = path.join(root, '.tenants', slug, '.env');
if (!existsSync(envPath)) throw new Error(`No local tenant environment exists for ${slug}`);

const lines = readFileSync(envPath, 'utf8').trimEnd().split('\n');
const values = new Map(lines.map((line) => {
  const split = line.indexOf('=');
  return split < 0 ? [line, ''] : [line.slice(0, split), line.slice(split + 1)];
}));
const set = (name, value) => values.set(name, JSON.stringify(String(value)));
set('VOICE_REQUESTED', '1');
set('SARVAM_API_KEY', apiKey);
set('SARVAM_ORG_ID', required('org-id'));
set('SARVAM_WORKSPACE_ID', required('workspace-id'));
set('SARVAM_APP_ID', required('app-id'));
set('SARVAM_APP_VERSION', String(version));
set('SARVAM_AGENT_NAME', args.get('agent-name')?.trim() || 'booking assistant');
const phoneNumber = args.get('phone-number')?.trim();
if (phoneNumber && !/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
  throw new Error('--phone-number must be an E.164 phone number, for example +917965480947');
}
if (phoneNumber) set('SARVAM_PHONE_NUMBER', phoneNumber);
writeFileSync(envPath, [...values].map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });

execFileSync('docker', ['compose', '--env-file', envPath, '-f', path.join(root, 'compose.tenant.yml'), 'up', '-d', '--no-build', '--force-recreate', 'app'], {
  cwd: root,
  stdio: 'inherit',
});
console.log(`Sarvam agent ${required('app-id')} v${version} is bound to ${slug}.`);
