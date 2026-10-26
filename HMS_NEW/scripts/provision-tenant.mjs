#!/usr/bin/env node
import {isWebsiteTemplate} from '../packages/website-templates/src/index.js';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliArgs = process.argv.slice(2).filter((argument) => argument !== '--');
const args = new Map();
for (let index = 0; index < cliArgs.length; index += 2) {
  const key = cliArgs[index];
  const value = cliArgs[index + 1];
  if (!key?.startsWith('--') || value === undefined) throw new Error('Arguments must be --name value pairs');
  args.set(key.slice(2), value);
}
const required = (name) => {
  const value = args.get(name)?.trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
};
const slug = required('slug');
const name = required('name');
const email = required('email').toLowerCase();
const owner = args.get('owner')?.trim() || 'Workspace Administrator';
const facility = args.get('facility')?.trim() || `${name} Main Clinic`;
const city = args.get('city')?.trim() || 'Bengaluru';
const plan = args.get('plan')?.trim() || 'connect';
const voice = (args.get('voice')?.trim() || (plan === 'launch' ? 'false' : 'true')) === 'true';
const port = Number(args.get('port') ?? '8081');
const facilityType = args.get('facility-type') ?? 'clinic';
const timezone = args.get('timezone') ?? 'Asia/Kolkata';
if (!['clinic','hospital','diagnostic_centre','virtual'].includes(facilityType)) throw new Error('Unknown facility type');
new Intl.DateTimeFormat('en', { timeZone: timezone });
const websiteTemplate = args.get('website-template') ?? 'standard';
if (!isWebsiteTemplate(websiteTemplate)) throw new Error('Unknown website template');
if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) throw new Error('--slug must be lower-case letters, numbers and hyphens');
if (!/.+@.+\..+/.test(email)) throw new Error('--email must be a valid email');
if (!['launch', 'connect', 'scale'].includes(plan)) throw new Error('--plan must be launch, connect or scale');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('--port must be between 1024 and 65535');

const tenantDir = path.join(root, '.tenants', slug);
const envPath = path.join(tenantDir, '.env');
if (existsSync(envPath)) throw new Error(`Tenant ${slug} already has a local environment; refusing to overwrite it`);
mkdirSync(tenantDir, { recursive: true, mode: 0o700 });
const secret = (bytes = 32) => randomBytes(bytes).toString('base64url');
const tenantUuid = (() => {
  const bytes = createHash('sha256').update(`exora-tenant:${slug}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
})();
const values = {
  TENANT_SLUG: slug,
  WEBSITE_TEMPLATE: websiteTemplate,
  BOOTSTRAP_FACILITY_TYPE: facilityType,
  BOOTSTRAP_TIMEZONE: timezone,
  TENANT_PORT: String(port),
  TENANT_PLAN: plan,
  VOICE_REQUESTED: voice ? '1' : '0',
  PUBLIC_TENANT_ID: tenantUuid,
  BOOTSTRAP_TENANT_ID: tenantUuid,
  TENANT_BOOTSTRAP: 'custom',
  BOOTSTRAP_TENANT_NAME: name,
  BOOTSTRAP_FACILITY_ID: randomUUID(),
  MANAGED_BOOKING_STAFF_ID: randomUUID(),
  INTEGRATIONS_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  INTEGRATIONS_PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
  PUBLIC_BOOKING_SIGNING_SECRET: secret(),
  WA_VERIFY_TOKEN: secret(),
  BOOTSTRAP_OWNER_NAME: owner,
  BOOTSTRAP_OWNER_EMAIL: email,
  BOOTSTRAP_FACILITY_NAME: facility,
  BOOTSTRAP_CITY: city,
  POSTGRES_PASSWORD: secret(),
  HMS_APP_PASSWORD: secret(),
  DEV_JWT_SECRET: secret(40),
  AUTH_MODE: 'dev',
  NODE_ENV: 'development',
  VITE_HMS_DEV_LOGIN: 'true',
  VITE_HMS_DEFAULT_SUBJECT: 'admin',
  HMS_IMAGE: 'exora/hms:local',
  CORS_ORIGINS: `http://127.0.0.1:${port},http://localhost:${port}`,
  TELE_PATIENT_LINK_BASE: `http://127.0.0.1:${port}/staff/video-consult`,
};
values.PUBLIC_BOOKING_ENABLED = 'true';
values.PUBLIC_BOOKING_SITES_JSON = JSON.stringify([{ siteSlug: slug, tenantId: tenantUuid,
  facilityId: values.BOOTSTRAP_FACILITY_ID, identityIssuer: 'hms-managed-booking',
  identitySubject: tenantUuid, origins: [`http://127.0.0.1:${port}`] }]);
if (voice) {
  values.VOICE_SERVICE_KEY = secret(40);
  values.VOICE_SIGNING_SECRET = secret(40);
  values.VOICE_SERVICE_ACCOUNT_ID = randomUUID();
  values.VOICE_NOTICE_VERSION = '2026-10-14';
  values.VOICE_SESSION_SECONDS = '900';
}
writeFileSync(envPath, Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });

execFileSync('docker', ['compose', '--env-file', envPath, '-f', path.join(root, 'compose.tenant.yml'), 'up', '-d', '--no-build'], {
  cwd: root,
  stdio: 'inherit',
});

console.log(`\n${name} is provisioning.`);
console.log(`Website: http://127.0.0.1:${port}/`);
console.log(`Staff dashboard: http://127.0.0.1:${port}/staff/appointments`);
console.log('Development login: admin (no password; development mode only)');
console.log(`Private environment: ${envPath}`);
