import { Onboarding } from './onboarding.ts';
import {entitledModules,parseClinicModules,CLINIC_MODULES,type ClinicModule} from '../../../packages/platform/onboarding-modules.mjs';
import { exportedPlatformPage } from './platform-pages.ts';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import pg from 'pg';
import { z } from 'zod';
import { compileVoiceManifest, defaultVoiceSettings, tenantBackendOrigin, VoiceSettingsSchema } from './voice-control.ts';
import {
  activateVoiceRequest, declineVoiceRequest, listOpenVoiceRequests, loadVoiceRequest, requestVoiceAgent, requestVoiceChanges,
  saveVoiceDraft, startVoiceRequest, tenantVoiceStatus, testVoiceRequest, VoiceRequestError,
} from './voice-requests.ts';

const app = Fastify({ logger: true, bodyLimit: 128 * 1024 });
const databaseUrl = process.env.CONTROL_DATABASE_URL ?? 'postgres://postgres:exora-control@127.0.0.1:54330/exora_control?sslmode=disable';
const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const publicBase = process.env.PUBLIC_BASE_URL ?? 'http://127.0.0.1';
const tenantUrlTemplate = process.env.TENANT_PUBLIC_URL_TEMPLATE?.trim();
const autoProvision = process.env.AUTO_PROVISION === '1';
// Agents are created by a superadmin in Sarvam. The platform only uses the workspace key for the runtime
// call-URL endpoint, which proves an agent version exists and serves each clinic's browser calls.
const sarvamApiKey = process.env.SARVAM_API_KEY?.trim();
const sarvamOrgId = process.env.SARVAM_ORG_ID?.trim();
const sarvamWorkspaceId = process.env.SARVAM_WORKSPACE_ID?.trim();
const sarvamRuntimeOrigin = (process.env.SARVAM_RUNTIME_ORIGIN?.trim() || 'https://apps.sarvam.ai').replace(/\/$/, '');
const tenantRoot = process.env.TENANT_ROOT?.trim() || '/srv/apps/exora-health/tenants';
const superadminToken = process.env.SUPERADMIN_TOKEN;
const provisionerToken = process.env.PROVISIONER_TOKEN;
const isSuperadmin = (authorization?: string) => !!superadminToken && authorization === `Bearer ${superadminToken}`;
const isProvisioner = (authorization?: string) => !!provisionerToken && authorization === `Bearer ${provisionerToken}`;
/** Each clinic container holds only its own derived token, never the provisioner token. */
const tenantControlToken = (tenantId: string) => provisionerToken
  ? createHmac('sha256', provisionerToken).update(`tenant-control:${tenantId.toLowerCase()}`).digest('hex')
  : undefined;
function isTenant(authorization: string | undefined, tenantId: string) {
  const token = tenantControlToken(tenantId);
  if (!token || !authorization) return false;
  return timingSafeEqual(hash32(authorization), hash32(`Bearer ${token}`));
}
const hash32 = (value: string) => createHash('sha256').update(value).digest();
const credentialKey = provisionerToken
  ? createHash('sha256').update(`exora-onboarding-credential:${provisionerToken}`).digest()
  : undefined;
function encryptCredential(value: string) {
  if (!credentialKey) throw new Error('PROVISIONER_TOKEN is required to protect onboarding credentials');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', credentialKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
function decryptCredential(value: string) {
  if (!credentialKey) return undefined;
  try {
    const [version, iv, tag, encrypted] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !encrypted) return undefined;
    const decipher = createDecipheriv('aes-256-gcm', credentialKey, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
  } catch { return undefined; }
}


async function schema() {
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS control;
    CREATE TABLE IF NOT EXISTS control.onboarding_request (
      id uuid PRIMARY KEY,
      idempotency_key text NOT NULL UNIQUE,
      slug text NOT NULL UNIQUE,
      owner_email text NOT NULL,
      payload jsonb NOT NULL,
      access_token_hash text NOT NULL,
      status text NOT NULL CHECK(status IN ('queued','provisioning','ready','failed')),
      allocated_port integer NOT NULL UNIQUE,
      error text,
      admin_credential_ciphertext text,
      credential_expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE control.onboarding_request ADD COLUMN IF NOT EXISTS admin_credential_ciphertext text;
    ALTER TABLE control.onboarding_request ADD COLUMN IF NOT EXISTS credential_expires_at timestamptz;
    CREATE TABLE IF NOT EXISTS control.customer (
      id uuid PRIMARY KEY,
      onboarding_id uuid NOT NULL UNIQUE REFERENCES control.onboarding_request(id),
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      owner_email text NOT NULL,
      plan_code text NOT NULL,
      subscription_status text NOT NULL DEFAULT 'trial',
      modules jsonb NOT NULL,
      voice_status text NOT NULL DEFAULT 'not_requested',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS control.deployment (
      id uuid PRIMARY KEY,
      customer_id uuid NOT NULL UNIQUE REFERENCES control.customer(id),
      tenant_id uuid,
      compose_project text NOT NULL,
      image text NOT NULL,
      public_url text,
      staff_url text,
      state text NOT NULL,
      health text NOT NULL DEFAULT 'unknown',
      last_error text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS control.voice_agent_binding (
      customer_id uuid PRIMARY KEY REFERENCES control.customer(id),
      provider text NOT NULL DEFAULT 'sarvam',
      agent_id text,
      deployment_id text,
      state text NOT NULL DEFAULT 'requested',
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE control.voice_agent_binding ADD COLUMN IF NOT EXISTS app_version integer;
    ALTER TABLE control.voice_agent_binding ADD COLUMN IF NOT EXISTS connection_id text;
    ALTER TABLE control.voice_agent_binding ADD COLUMN IF NOT EXISTS phone_number text;
    ALTER TABLE control.voice_agent_binding ADD COLUMN IF NOT EXISTS service_secret_ref text;
    ALTER TABLE control.voice_agent_binding ADD COLUMN IF NOT EXISTS public_api_url text;
    ALTER TABLE control.voice_agent_binding ADD COLUMN IF NOT EXISTS last_error text;
    ALTER TABLE control.voice_agent_binding ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
    ALTER TABLE control.voice_agent_binding ADD COLUMN IF NOT EXISTS desired_revision integer NOT NULL DEFAULT 0;
    ALTER TABLE control.voice_agent_binding ADD COLUMN IF NOT EXISTS active_revision integer NOT NULL DEFAULT 0;
    ALTER TABLE control.voice_agent_binding ADD COLUMN IF NOT EXISTS previous_app_version integer;
    ALTER TABLE control.voice_agent_binding ADD COLUMN IF NOT EXISTS configuration_hash text;
    ALTER TABLE control.voice_agent_binding ADD COLUMN IF NOT EXISTS tenant_api_origin text;
    CREATE UNIQUE INDEX IF NOT EXISTS voice_binding_phone_unique ON control.voice_agent_binding(phone_number) WHERE phone_number IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS voice_binding_deployment_unique ON control.voice_agent_binding(deployment_id) WHERE deployment_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS control.voice_configuration_revision (
      customer_id uuid NOT NULL REFERENCES control.customer(id),
      revision integer NOT NULL CHECK(revision > 0),
      settings jsonb NOT NULL,
      configuration_hash text,
      provider_version integer,
      state text NOT NULL CHECK(state IN ('draft','validating','ready','publishing','active','failed','superseded')),
      created_by text NOT NULL,
      error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(customer_id, revision)
    );
    CREATE TABLE IF NOT EXISTS control.voice_provisioning_operation (
      id uuid PRIMARY KEY,
      customer_id uuid NOT NULL REFERENCES control.customer(id),
      revision integer NOT NULL,
      operation text NOT NULL CHECK(operation IN ('provision','publish','rollback','reconcile','pause','resume','rotate_secret')),
      idempotency_key text NOT NULL UNIQUE,
      state text NOT NULL CHECK(state IN ('queued','running','succeeded','failed','cancelled')),
      stage text NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      result jsonb,
      error text,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      started_at timestamptz,
      completed_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY(customer_id, revision) REFERENCES control.voice_configuration_revision(customer_id, revision)
    );
    CREATE INDEX IF NOT EXISTS voice_operation_queue_idx ON control.voice_provisioning_operation(state,created_at);
    UPDATE control.voice_agent_binding v SET service_secret_ref='tenant-env://' || c.slug || '/VOICE_SERVICE_KEY'
      FROM control.customer c WHERE c.id=v.customer_id AND v.service_secret_ref IS NULL;
    -- Voice agents are now requested by the clinic and set up by a superadmin. Close the automatic jobs
    -- that nothing processes any more and return those clinics to "not requested".
    UPDATE control.voice_provisioning_operation SET state='cancelled',stage='declined',
      error='Replaced by clinic-requested setup from the Voice page.',completed_at=now(),updated_at=now()
      WHERE state IN ('queued','running') AND created_by NOT LIKE 'clinic:%';
    UPDATE control.voice_configuration_revision SET state='draft',updated_at=now() WHERE state='publishing' AND provider_version IS NULL;
    UPDATE control.customer c SET voice_status='not_requested'
      WHERE voice_status IN ('requested','configuring','failed')
        AND NOT EXISTS (SELECT 1 FROM control.voice_agent_binding v WHERE v.customer_id=c.id AND v.agent_id IS NOT NULL AND v.app_version IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM control.voice_provisioning_operation o WHERE o.customer_id=c.id AND o.state IN ('queued','running'));
    CREATE UNIQUE INDEX IF NOT EXISTS voice_binding_agent_unique ON control.voice_agent_binding(agent_id) WHERE agent_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS voice_request_open_unique ON control.voice_provisioning_operation(customer_id)
      WHERE state IN ('queued','running') AND stage IN ('awaiting_superadmin','in_setup');
  `);
}

const modulesFor = (plan:string,selected?:ClinicModule[]) => entitledModules(plan,selected);

function tenantUuid(slug: string) {
  const bytes = createHash('sha256').update(`exora-tenant:${slug}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

type CompletedDeployment = {
  tenantId?: string;
  composeProject?: string;
  image?: string;
  publicUrl?: string;
  staffUrl?: string;
  adminUsername?: string;
  temporaryPassword?: string;
};

async function markReady(id: string, payload: z.infer<typeof Onboarding>, port: number, deployment: CompletedDeployment = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const customerId = randomUUID();
    await client.query(`INSERT INTO control.customer(id,onboarding_id,name,slug,owner_email,plan_code,modules,voice_status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(onboarding_id) DO NOTHING`,
      [customerId, id, payload.organisation, payload.slug, payload.email.toLowerCase(), payload.plan, JSON.stringify(modulesFor(payload.plan,payload.clinicModules)), 'not_requested']);
    const { rows: [customer] } = await client.query('SELECT id FROM control.customer WHERE onboarding_id=$1', [id]);
    const tenantUrl = deployment.publicUrl?.replace(/\/$/, '') ?? (tenantUrlTemplate
      ? tenantUrlTemplate.replaceAll('{slug}', payload.slug).replace(/\/$/, '')
      : `${publicBase}:${port}`);
    await client.query(`INSERT INTO control.deployment(id,customer_id,tenant_id,compose_project,image,public_url,staff_url,state,health)
      VALUES($1,$2,$3,$4,$5,$6,$7,'ready','healthy') ON CONFLICT(customer_id) DO UPDATE SET tenant_id=excluded.tenant_id,compose_project=excluded.compose_project,image=excluded.image,state='ready',health='healthy',public_url=excluded.public_url,staff_url=excluded.staff_url,last_error=NULL,updated_at=now()`,
      [randomUUID(), customer.id, deployment.tenantId ?? tenantUuid(payload.slug), deployment.composeProject ?? `exora-${payload.slug}`, deployment.image ?? 'exora/hms:local', `${tenantUrl}/`, deployment.staffUrl ?? `${tenantUrl}/staff/appointments`]);
    const protectedCredential = deployment.temporaryPassword ? encryptCredential(deployment.temporaryPassword) : null;
    await client.query(`UPDATE control.onboarding_request SET status='ready',error=NULL,
      admin_credential_ciphertext=COALESCE($2,admin_credential_ciphertext),
      credential_expires_at=CASE WHEN $2 IS NOT NULL THEN now()+interval '24 hours' ELSE credential_expires_at END,
      updated_at=now() WHERE id=$1`, [id, protectedCredential]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

async function provision(id: string, payload: z.infer<typeof Onboarding>, port: number) {
  const args = [path.join(root, 'scripts/provision-tenant.mjs'), '--slug', payload.slug, '--name', payload.organisation, '--email', payload.email, '--owner', payload.ownerName, '--facility', payload.facilityName, '--city', payload.city, '--plan', payload.plan, '--voice', String(payload.voice), '--website-template', payload.websiteTemplate, '--timezone', payload.timezone, '--facility-type', payload.facilityType, '--port', String(port), '--clinic-modules', parseClinicModules(payload.clinicModules).join(',')];
  const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let failure = '';
  child.stderr.on('data', (chunk) => { failure = `${failure}${String(chunk)}`.slice(-4000); });
  child.on('close', async (code) => {
    try {
      if (code === 0) await markReady(id, payload, port);
      else await pool.query("UPDATE control.onboarding_request SET status='failed',error=$2,updated_at=now() WHERE id=$1", [id, failure || `provisioner exited ${code}`]);
    } catch (error) { app.log.error(error, 'failed to record provisioning result'); }
  });
}

let provisionTimer: ReturnType<typeof setTimeout> | undefined;
async function claimProvisioningJob() {
  if (!autoProvision) return;
  try {
    const { rows: [job] } = await pool.query(`UPDATE control.onboarding_request SET status='provisioning',error=NULL,updated_at=now()
      WHERE id=(SELECT id FROM control.onboarding_request WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING id,payload,allocated_port`);
    if (job) void provision(job.id, Onboarding.parse(job.payload), job.allocated_port);
  } catch (error) {
    app.log.error(error, 'failed to claim provisioning job');
  } finally {
    provisionTimer = setTimeout(() => void claimProvisioningJob(), 1500);
  }
}

await schema();
if (autoProvision) void claimProvisioningJob();
await app.register(cors, { origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://127.0.0.1:5190'], methods: ['GET','POST','PUT','PATCH'], allowedHeaders: ['content-type','idempotency-key','authorization','x-onboarding-access'] });

app.get('/health', async () => ({ status: 'ok' }));
app.get('/ready', async (_request, reply) => { try { await pool.query('SELECT 1'); return { status: 'ready' }; } catch { return reply.status(503).send({ status: 'database unavailable' }); } });

const Completion = z.object({
  tenantId: z.uuid(),
  composeProject: z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/),
  image: z.string().min(3).max(200),
  publicUrl: z.url(),
  staffUrl: z.url(),
  adminUsername: z.string().trim().email().max(254),
  temporaryPassword: z.string().min(20).max(128),
});

app.post('/control/v1/internal/provisioning/claim', async (request, reply) => {
  if (!isProvisioner(request.headers.authorization)) return reply.status(401).send({ error: 'unauthorized' });
  const { rows: [job] } = await pool.query(`UPDATE control.onboarding_request SET status='provisioning',error=NULL,updated_at=now()
    WHERE id=(SELECT id FROM control.onboarding_request WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id,payload,allocated_port`);
  return job ?? null;
});

app.post('/control/v1/internal/provisioning/:id/complete', async (request, reply) => {
  if (!isProvisioner(request.headers.authorization)) return reply.status(401).send({ error: 'unauthorized' });
  const id = z.uuid().safeParse((request.params as { id?: string }).id);
  const completed = Completion.safeParse(request.body);
  if (!id.success || !completed.success) return reply.status(400).send({ error: 'validation' });
  const { rows: [job] } = await pool.query("SELECT payload,allocated_port FROM control.onboarding_request WHERE id=$1 AND status='provisioning'", [id.data]);
  if (!job) return reply.status(409).send({ error: 'not_provisioning' });
  await markReady(id.data, Onboarding.parse(job.payload), job.allocated_port, completed.data);
  return { status: 'ready' };
});

app.post('/control/v1/internal/provisioning/:id/fail', async (request, reply) => {
  if (!isProvisioner(request.headers.authorization)) return reply.status(401).send({ error: 'unauthorized' });
  const id = z.uuid().safeParse((request.params as { id?: string }).id);
  const body = z.object({ error: z.string().trim().min(1).max(4000) }).safeParse(request.body);
  if (!id.success || !body.success) return reply.status(400).send({ error: 'validation' });
  const result = await pool.query("UPDATE control.onboarding_request SET status='failed',error=$2,updated_at=now() WHERE id=$1 AND status='provisioning'", [id.data, body.data.error]);
  if (!result.rowCount) return reply.status(409).send({ error: 'not_provisioning' });
  return { status: 'failed' };
});

app.post('/control/v1/onboarding', async (request, reply) => {
  const parsed = Onboarding.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: 'validation', issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) });
  const idempotencyKey = request.headers['idempotency-key'];
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 128) return reply.status(400).send({ error: 'idempotency_key_required' });
  const requestedAccess = request.headers['x-onboarding-access'];
  if (requestedAccess !== undefined && (typeof requestedAccess !== 'string' || requestedAccess.length < 32 || requestedAccess.length > 128)) return reply.status(400).send({ error: 'invalid_onboarding_access' });
  const existing = await pool.query(
    'SELECT id,status,access_token_hash,payload=$2::jsonb AS payload_matches FROM control.onboarding_request WHERE idempotency_key=$1',
    [idempotencyKey, JSON.stringify(parsed.data)],
  );
  if (existing.rows[0]) {
    if (!requestedAccess || hash(requestedAccess) !== existing.rows[0].access_token_hash) return reply.status(409).send({ error: 'idempotency_recovery_requires_access_token' });
    if (!existing.rows[0].payload_matches) return reply.status(409).send({
      error: 'idempotency_payload_mismatch',
      message: 'This browser request key belongs to a different workspace. Start a new onboarding request.',
    });
    return reply.status(202).send({ onboardingId: existing.rows[0].id, accessToken: requestedAccess, status: existing.rows[0].status });
  }
  const slug = await pool.query('SELECT id FROM control.onboarding_request WHERE slug=$1', [parsed.data.slug]);
  if (slug.rows[0]) return reply.status(409).send({ error: 'slug_unavailable', message: 'That workspace address is already reserved.' });
  // Keep self-service allocations away from the hand-run demo ports (8080/8081).
  const { rows: [allocation] } = await pool.query('SELECT COALESCE(MAX(allocated_port), 8199) + 1 AS port FROM control.onboarding_request');
  const id = randomUUID();
  const token = requestedAccess || randomBytes(32).toString('base64url');
  await pool.query(`INSERT INTO control.onboarding_request(id,idempotency_key,slug,owner_email,payload,access_token_hash,status,allocated_port)
    VALUES($1,$2,$3,$4,$5,$6,'queued',$7)`, [id, idempotencyKey, parsed.data.slug, parsed.data.email.toLowerCase(), parsed.data, hash(token), allocation.port]);
  // The host provisioner claims this row from the same control database. The API process never
  // needs a Docker socket when it runs in the public control-plane container.
  return reply.status(202).send({ onboardingId: id, accessToken: token, status: 'queued' });
});

app.get('/control/v1/onboarding/:id', async (request, reply) => {
  const id = z.uuid().safeParse((request.params as { id?: string }).id);
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!id.success || !bearer) return reply.status(401).send({ error: 'unauthorized' });
  const { rows: [row] } = await pool.query(`SELECT r.id,r.status,r.slug,r.owner_email,r.error,r.created_at,r.updated_at,r.admin_credential_ciphertext,r.credential_expires_at,
      d.public_url,d.staff_url,d.health,c.voice_status
    FROM control.onboarding_request r LEFT JOIN control.customer c ON c.onboarding_id=r.id LEFT JOIN control.deployment d ON d.customer_id=c.id
    WHERE r.id=$1 AND r.access_token_hash=$2`, [id.data, hash(bearer)]);
  if (!row) return reply.status(404).send({ error: 'not_found' });
  if (row.status === 'ready') {
    row.admin_username = row.owner_email;
    if (row.admin_credential_ciphertext && row.credential_expires_at && new Date(row.credential_expires_at) > new Date()) {
      row.temporary_password = decryptCredential(row.admin_credential_ciphertext);
      row.credential_expires_at = new Date(row.credential_expires_at).toISOString();
    }
  }
  if (tenantUrlTemplate) row.target_url = tenantUrlTemplate.replaceAll('{slug}',row.slug).replace(/\/$/,'')+'/';
  delete row.owner_email;
  delete row.admin_credential_ciphertext;
  return row;
});

app.get('/control/v1/admin/customers', async (request, reply) => {
  if (!isSuperadmin(request.headers.authorization)) return reply.status(401).send({ error: 'unauthorized' });
  const { rows } = await pool.query(`SELECT c.id,c.name,c.slug,c.owner_email,c.plan_code,c.subscription_status,c.modules,c.voice_status,d.state AS deployment_state,d.health,d.public_url,d.staff_url,d.updated_at,
    v.agent_id AS voice_agent_id,v.app_version AS voice_app_version,v.deployment_id AS voice_deployment_id,v.phone_number AS voice_phone_number,v.state AS voice_binding_state,v.last_error AS voice_last_error,
    v.desired_revision AS voice_desired_revision,v.active_revision AS voice_active_revision,v.configuration_hash AS voice_configuration_hash,v.tenant_api_origin AS voice_tenant_api_origin
    FROM control.customer c LEFT JOIN control.deployment d ON d.customer_id=c.id LEFT JOIN control.voice_agent_binding v ON v.customer_id=c.id ORDER BY c.created_at DESC`);
  return { items: rows };
});

async function voiceCustomer(customerId: string) {
  const { rows: [row] } = await pool.query(`SELECT c.id,c.name,c.slug,c.plan_code,c.subscription_status,c.voice_status,r.payload,
    d.tenant_id,d.public_url,d.staff_url,d.health,
    v.agent_id,v.app_version,v.previous_app_version,v.deployment_id,v.connection_id,v.phone_number,v.state,
    v.service_secret_ref,v.desired_revision,v.active_revision,v.configuration_hash,v.tenant_api_origin,v.last_error,v.last_synced_at
    FROM control.customer c JOIN control.onboarding_request r ON r.id=c.onboarding_id
    LEFT JOIN control.deployment d ON d.customer_id=c.id
    LEFT JOIN control.voice_agent_binding v ON v.customer_id=c.id WHERE c.id=$1`, [customerId]);
  return row as Record<string, unknown> | undefined;
}

function voiceTenant(row: Record<string, unknown>) {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return {
    customerId: String(row.id),
    tenantId: String(row.tenant_id ?? ''),
    slug: String(row.slug),
    hospitalName: String(row.name),
    facilityName: String(payload.facilityName ?? row.name),
    timezone: String(payload.timezone ?? 'Asia/Kolkata'),
    publicUrl: String(row.public_url ?? ''),
  };
}

app.get('/control/v1/admin/customers/:id/voice', async (request, reply) => {
  if (!isSuperadmin(request.headers.authorization)) return reply.status(401).send({ error: 'unauthorized' });
  const id = z.uuid().safeParse((request.params as { id?: string }).id);
  if (!id.success) return reply.status(400).send({ error: 'validation' });
  const customer = await voiceCustomer(id.data);
  if (!customer) return reply.status(404).send({ error: 'not_found' });
  if (customer.voice_status === 'not_requested') return reply.status(409).send({ error: 'voice_not_requested' });
  const { rows: revisions } = await pool.query(`SELECT revision,settings,configuration_hash,provider_version,state,error,created_by,created_at,updated_at
    FROM control.voice_configuration_revision WHERE customer_id=$1 ORDER BY revision DESC LIMIT 20`, [id.data]);
  const { rows: operations } = await pool.query(`SELECT id,revision,operation,state,stage,attempts,error,created_by,created_at,started_at,completed_at,updated_at
    FROM control.voice_provisioning_operation WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 20`, [id.data]);
  return { customer, revisions, operations, defaults: defaultVoiceSettings(String(customer.name)) };
});

// Clinic Voice routes. Each call authenticates with that clinic's own derived token; the tenant id in the
// path must match it, so one clinic's container cannot read or change another clinic's Voice state.
async function tenantCustomer(request: { params: unknown; headers: { authorization?: string } }) {
  const tenantId = z.uuid().safeParse((request.params as { tenantId?: string }).tenantId);
  if (!tenantId.success) throw new VoiceRequestError(400, { error: 'validation' });
  if (!isTenant(request.headers.authorization, tenantId.data)) throw new VoiceRequestError(401, { error: 'unauthorized' });
  const { rows: [row] } = await pool.query('SELECT customer_id,public_url FROM control.deployment WHERE tenant_id=$1', [tenantId.data]);
  if (!row?.customer_id) throw new VoiceRequestError(404, { error: 'not_found' });
  return { customerId: String(row.customer_id), publicUrl: row.public_url ? String(row.public_url) : null };
}

const RequestedBy = z.string().trim().min(1).max(200);
const idempotencyOf = (request: { headers: Record<string, unknown> }) => {
  const key = request.headers['idempotency-key'];
  if (typeof key !== 'string' || key.length < 16 || key.length > 128) throw new VoiceRequestError(400, { error: 'idempotency_key_required' });
  return key;
};

app.get('/control/v1/internal/tenants/:tenantId/voice', async (request, reply) => voiceResult(reply, async () => {
  const { customerId } = await tenantCustomer(request);
  const status = await tenantVoiceStatus(pool, customerId);
  return { status: 200, body: { ...status, runtime: status.agent && sarvamOrgId && sarvamWorkspaceId ? { orgId: sarvamOrgId, workspaceId: sarvamWorkspaceId } : null } };
}));

app.post('/control/v1/internal/tenants/:tenantId/voice-request', async (request, reply) => voiceResult(reply, async () => {
  const { customerId, publicUrl } = await tenantCustomer(request);
  const body = z.strictObject({ requestedBy: RequestedBy }).safeParse(request.body);
  if (!body.success) throw new VoiceRequestError(400, { error: 'validation' });
  let origin: string | null = null;
  try { origin = publicUrl ? tenantBackendOrigin(publicUrl) : null; } catch { origin = null; }
  return requestVoiceAgent(pool, { customerId, requestedBy: body.data.requestedBy, idempotencyKey: idempotencyOf(request), tenantApiOrigin: origin });
}));

app.put('/control/v1/internal/tenants/:tenantId/voice-draft', async (request, reply) => voiceResult(reply, async () => {
  const { customerId } = await tenantCustomer(request);
  const body = z.strictObject({ expectedRevision: z.number().int().nonnegative(), settings: VoiceSettingsSchema, requestedBy: RequestedBy }).safeParse(request.body);
  if (!body.success) throw new VoiceRequestError(400, { error: 'validation', issues: body.error.issues });
  return saveVoiceDraft(pool, { customerId, expectedRevision: body.data.expectedRevision, settings: body.data.settings, createdBy: `clinic:${body.data.requestedBy}` });
}));

app.post('/control/v1/internal/tenants/:tenantId/voice-changes', async (request, reply) => voiceResult(reply, async () => {
  const { customerId } = await tenantCustomer(request);
  const body = z.strictObject({ revision: z.number().int().positive(), requestedBy: RequestedBy }).safeParse(request.body);
  if (!body.success) throw new VoiceRequestError(400, { error: 'validation' });
  return requestVoiceChanges(pool, { customerId, revision: body.data.revision, requestedBy: body.data.requestedBy, idempotencyKey: idempotencyOf(request) });
}));

/** Browser calls: the clinic asks for a signed Sarvam URL for its own bound agent. The workspace key stays here. */
app.post('/control/v1/internal/tenants/:tenantId/voice-runtime-url', async (request, reply) => voiceResult(reply, async () => {
  const { customerId } = await tenantCustomer(request);
  const body = z.strictObject({ interactionType: z.string().regex(/^[a-z_]{1,40}$/).default('call') }).safeParse(request.body ?? {});
  if (!body.success) throw new VoiceRequestError(400, { error: 'validation' });
  const { rows: [binding] } = await pool.query(`SELECT v.agent_id,v.app_version FROM control.voice_agent_binding v JOIN control.customer c ON c.id=v.customer_id
    WHERE v.customer_id=$1 AND c.voice_status='active' AND v.agent_id IS NOT NULL AND v.app_version IS NOT NULL`, [customerId]);
  if (!binding) throw new VoiceRequestError(409, { error: 'voice_agent_missing' });
  const result = await sarvamRuntimeUrl(String(binding.agent_id), Number(binding.app_version), body.data.interactionType);
  if (!result.ok) {
    app.log.warn({ status: result.status, customerId }, 'Sarvam runtime URL request failed');
    return { status: 502, body: { error: 'voice_runtime_unavailable' } };
  }
  return { status: 200, body: result.body };
}));

async function sarvamRuntimeUrl(agentId: string, appVersion: number, interactionType = 'call') {
  if (!sarvamApiKey || !sarvamOrgId || !sarvamWorkspaceId) {
    throw new VoiceRequestError(503, { error: 'sarvam_not_configured', message: 'Set SARVAM_API_KEY, SARVAM_ORG_ID and SARVAM_WORKSPACE_ID on the platform.' });
  }
  const url = new URL(`${sarvamRuntimeOrigin}/api/app-runtime/orgs/${encodeURIComponent(sarvamOrgId)}/workspaces/${encodeURIComponent(sarvamWorkspaceId)}/apps/${encodeURIComponent(agentId)}/url`);
  url.searchParams.set('interaction_type', interactionType);
  url.searchParams.set('version', String(appVersion));
  try {
    const response = await fetch(url, { headers: { 'X-API-Key': sarvamApiKey }, signal: AbortSignal.timeout(10_000) });
    const text = await response.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) as unknown : null; } catch { body = null; }
    return { ok: response.ok && body !== null, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

// Superadmin request inbox: list, setup kit, start, test, activate, decline.
const requireSuperadmin = (authorization?: string) => {
  if (!isSuperadmin(authorization)) throw new VoiceRequestError(401, { error: 'unauthorized' });
};
const requestId = (params: unknown) => {
  const id = z.uuid().safeParse((params as { id?: string }).id);
  if (!id.success) throw new VoiceRequestError(400, { error: 'validation' });
  return id.data;
};
const AgentBody = z.strictObject({
  agentId: z.string().trim().min(3).max(200),
  appVersion: z.number().int().positive(),
  phoneNumber: z.string().trim().regex(/^\+[1-9]\d{7,14}$/).nullable().optional(),
  deploymentId: z.string().trim().min(3).max(200).nullable().optional(),
});

app.get('/control/v1/admin/voice-requests', async (request, reply) => voiceResult(reply, async () => {
  requireSuperadmin(request.headers.authorization);
  return { status: 200, body: { items: await listOpenVoiceRequests(pool) } };
}));

app.get('/control/v1/admin/voice-requests/:id', async (request, reply) => voiceResult(reply, async () => {
  requireSuperadmin(request.headers.authorization);
  const { row, view } = await loadVoiceRequest(pool, requestId(request.params));
  const customer = await voiceCustomer(String(row.customer_id));
  if (!customer) throw new VoiceRequestError(404, { error: 'not_found' });
  const { rows } = await pool.query(`SELECT revision,settings FROM control.voice_configuration_revision WHERE customer_id=$1 AND revision = ANY($2::int[])`,
    [row.customer_id, [Number(row.revision), Number(customer.active_revision ?? 0)]]);
  const settings = VoiceSettingsSchema.parse(rows.find((item) => item.revision === Number(row.revision))?.settings ?? defaultVoiceSettings(String(customer.name)));
  const previous = rows.find((item) => item.revision === Number(customer.active_revision ?? 0) && item.revision !== Number(row.revision))?.settings ?? null;
  const tenant = voiceTenant(customer);
  let manifest: ReturnType<typeof compileVoiceManifest> | null = null, manifestError: string | null = null;
  try { manifest = compileVoiceManifest(tenant, settings); }
  catch (error) { manifestError = error instanceof Error ? error.message : 'Voice configuration is not ready'; }
  return { status: 200, body: {
    request: { ...view, customerId: String(row.customer_id), customerName: String(customer.name), customerSlug: String(customer.slug) },
    hospital: { name: tenant.hospitalName, facilityName: tenant.facilityName, timezone: tenant.timezone, publicUrl: customer.public_url ?? null, staffUrl: customer.staff_url ?? null },
    settings,
    previousSettings: previous,
    manifest: manifest && { agentName: manifest.agentName, greeting: settings.greeting, prompt: manifest.prompt, apiBaseUrl: manifest.apiBaseUrl, tools: manifest.tools, auth: manifest.auth },
    manifestError,
    serviceKey: { header: 'X-Service-Key', command: `jq -r .voiceServiceKey ${tenantRoot}/${customer.slug}/secrets.json` },
    binding: { agentId: customer.agent_id ?? null, appVersion: customer.app_version == null ? null : Number(customer.app_version), phoneNumber: customer.phone_number ?? null, deploymentId: customer.deployment_id ?? null },
    tested: (row.result as { tested?: unknown } | null)?.tested ?? null,
    sarvamConfigured: !!(sarvamApiKey && sarvamOrgId && sarvamWorkspaceId),
  } };
}));

app.post('/control/v1/admin/voice-requests/:id/start', async (request, reply) => voiceResult(reply, async () => {
  requireSuperadmin(request.headers.authorization);
  return startVoiceRequest(pool, requestId(request.params));
}));

app.post('/control/v1/admin/voice-requests/:id/test', async (request, reply) => voiceResult(reply, async () => {
  requireSuperadmin(request.headers.authorization);
  const body = AgentBody.pick({ agentId: true, appVersion: true }).safeParse(request.body);
  if (!body.success) throw new VoiceRequestError(400, { error: 'validation', issues: body.error.issues });
  return testVoiceRequest(pool, requestId(request.params), body.data, async (agentId, appVersion) => sarvamRuntimeUrl(agentId, appVersion));
}));

app.post('/control/v1/admin/voice-requests/:id/activate', async (request, reply) => voiceResult(reply, async () => {
  requireSuperadmin(request.headers.authorization);
  const id = requestId(request.params);
  const body = AgentBody.safeParse(request.body);
  if (!body.success) throw new VoiceRequestError(400, { error: 'validation', issues: body.error.issues });
  const { row } = await loadVoiceRequest(pool, id);
  const customer = await voiceCustomer(String(row.customer_id));
  const { rows: [revision] } = await pool.query('SELECT settings FROM control.voice_configuration_revision WHERE customer_id=$1 AND revision=$2', [row.customer_id, row.revision]);
  if (!customer || !revision) throw new VoiceRequestError(404, { error: 'voice_revision_not_found' });
  let configurationHash: string;
  try { configurationHash = compileVoiceManifest(voiceTenant(customer), VoiceSettingsSchema.parse(revision.settings)).configurationHash; }
  catch (error) { throw new VoiceRequestError(409, { error: 'voice_not_ready', message: error instanceof Error ? error.message : 'Voice configuration is not ready' }); }
  return activateVoiceRequest(pool, id, { ...body.data, configurationHash });
}));

app.post('/control/v1/admin/voice-requests/:id/decline', async (request, reply) => voiceResult(reply, async () => {
  requireSuperadmin(request.headers.authorization);
  const body = z.strictObject({ reason: z.string().trim().min(3).max(500) }).safeParse(request.body);
  if (!body.success) throw new VoiceRequestError(400, { error: 'validation' });
  return declineVoiceRequest(pool, requestId(request.params), body.data.reason);
}));

async function voiceResult(reply: { status: (code: number) => { send: (body: unknown) => unknown } }, run: () => Promise<{ status: number; body: unknown }>) {
  try {
    const result = await run();
    return reply.status(result.status).send(result.body);
  } catch (error) {
    if (error instanceof VoiceRequestError) return reply.status(error.status).send(error.body);
    throw error;
  }
}

app.patch('/control/v1/admin/customers/:id/deployment-urls', async (request, reply) => {
  if (!isSuperadmin(request.headers.authorization)) return reply.status(401).send({ error: 'unauthorized' });
  const id = z.uuid().safeParse((request.params as { id?: string }).id);
  const body = z.object({ publicUrl: z.url().refine((value) => value.startsWith('https://'), 'publicUrl must use HTTPS'), staffUrl: z.url().refine((value) => value.startsWith('https://'), 'staffUrl must use HTTPS') }).safeParse(request.body);
  if (!id.success || !body.success) return reply.status(400).send({ error: 'validation', issues: body.success ? [] : body.error.issues });
  const result = await pool.query(`UPDATE control.deployment SET public_url=$2,staff_url=$3,updated_at=now() WHERE customer_id=$1 RETURNING customer_id,public_url,staff_url`, [id.data, body.data.publicUrl, body.data.staffUrl]);
  if (!result.rowCount) return reply.status(404).send({ error: 'not_found' });
  return result.rows[0];
});

app.get('/control/v1/admin/customers/:id/voice-manifest', async (request, reply) => {
  if (!isSuperadmin(request.headers.authorization)) return reply.status(401).send({ error: 'unauthorized' });
  const id = z.uuid().safeParse((request.params as { id?: string }).id);
  if (!id.success) return reply.status(400).send({ error: 'validation' });
  const row = await voiceCustomer(id.data);
  if (!row) return reply.status(404).send({ error: 'not_found' });
  if (row.voice_status === 'not_requested') return reply.status(409).send({ error: 'voice_not_requested' });
  const { rows: [revision] } = await pool.query(`SELECT revision,settings,state FROM control.voice_configuration_revision
    WHERE customer_id=$1 ORDER BY revision DESC LIMIT 1`, [id.data]);
  try {
    const manifest = compileVoiceManifest(voiceTenant(row), revision ? VoiceSettingsSchema.parse(revision.settings) : defaultVoiceSettings(String(row.name)), process.env.SARVAM_TEMPLATE_AGENT_ID);
    return { ...manifest, revision: revision?.revision ?? 0, revisionState: revision?.state ?? 'defaults',
      hospital: { name: row.name, firstFacility: voiceTenant(row).facilityName, timezone: voiceTenant(row).timezone, publicUrl: row.public_url, staffUrl: row.staff_url },
      currentBinding: { agentId: row.agent_id, appVersion: row.app_version, deploymentId: row.deployment_id, state: row.state, serviceSecretRef: row.service_secret_ref } };
  } catch (error) {
    return reply.status(409).send({ error: 'voice_not_ready', message: error instanceof Error ? error.message : 'Voice configuration is not ready' });
  }
});

app.put('/control/v1/admin/customers/:id/voice-binding', async (request, reply) => {
  if (!isSuperadmin(request.headers.authorization)) return reply.status(401).send({ error: 'unauthorized' });
  const id = z.uuid().safeParse((request.params as { id?: string }).id);
  const body = z.object({
    state: z.enum(['requested', 'awaiting_https', 'configuring', 'testing', 'active', 'paused', 'failed']),
    agentId: z.string().trim().min(3).max(200).optional(),
    appVersion: z.number().int().positive().optional(),
    deploymentId: z.string().trim().min(3).max(200).optional(),
    connectionId: z.string().trim().min(3).max(200).optional(),
    phoneNumber: z.string().trim().max(32).optional(),
    serviceSecretRef: z.string().trim().min(3).max(200).optional(),
    publicApiUrl: z.url().optional(),
    lastError: z.string().trim().max(2000).optional(),
  }).safeParse(request.body);
  if (!id.success || !body.success) return reply.status(400).send({ error: 'validation', issues: body.success ? [] : body.error.issues });
  const value = body.data;
  const result = await pool.query(`INSERT INTO control.voice_agent_binding(customer_id,state,agent_id,app_version,deployment_id,connection_id,phone_number,service_secret_ref,public_api_url,last_error,last_synced_at,updated_at)
    SELECT c.id,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now() FROM control.customer c WHERE c.id=$1
    ON CONFLICT(customer_id) DO UPDATE SET state=excluded.state,agent_id=COALESCE(excluded.agent_id,control.voice_agent_binding.agent_id),app_version=COALESCE(excluded.app_version,control.voice_agent_binding.app_version),deployment_id=COALESCE(excluded.deployment_id,control.voice_agent_binding.deployment_id),connection_id=COALESCE(excluded.connection_id,control.voice_agent_binding.connection_id),phone_number=COALESCE(excluded.phone_number,control.voice_agent_binding.phone_number),service_secret_ref=COALESCE(excluded.service_secret_ref,control.voice_agent_binding.service_secret_ref),public_api_url=COALESCE(excluded.public_api_url,control.voice_agent_binding.public_api_url),last_error=excluded.last_error,last_synced_at=now(),updated_at=now()
    RETURNING *`, [id.data,value.state,value.agentId ?? null,value.appVersion ?? null,value.deploymentId ?? null,value.connectionId ?? null,value.phoneNumber ?? null,value.serviceSecretRef ?? null,value.publicApiUrl ?? null,value.lastError ?? null]);
  if (!result.rowCount) return reply.status(404).send({ error: 'not_found' });
  await pool.query('UPDATE control.customer SET voice_status=$2 WHERE id=$1', [id.data, value.state]);
  return result.rows[0];
});

app.patch('/control/v1/admin/customers/:id/subscription', async (request, reply) => {
  if (!isSuperadmin(request.headers.authorization)) return reply.status(401).send({ error: 'unauthorized' });
  const id = z.uuid().safeParse((request.params as { id?: string }).id);
  const body = z.object({ status: z.enum(['trial', 'active', 'suspended', 'cancelled']) }).safeParse(request.body);
  if (!id.success || !body.success) return reply.status(400).send({ error: 'validation' });
  const result = await pool.query('UPDATE control.customer SET subscription_status=$2 WHERE id=$1 RETURNING id,subscription_status', [id.data, body.data.status]);
  if (!result.rowCount) return reply.status(404).send({ error: 'not_found' });
  return result.rows[0];
});

app.patch('/control/v1/admin/customers/:id/plan', async (request, reply) => {
  if (!isSuperadmin(request.headers.authorization)) return reply.status(401).send({ error: 'unauthorized' });
  const id = z.uuid().safeParse((request.params as { id?: string }).id);
  const body = z.object({ plan: z.enum(['launch', 'connect', 'scale']) }).safeParse(request.body);
  if (!id.success || !body.success) return reply.status(400).send({ error: 'validation' });
  const result = await pool.query(`UPDATE control.customer SET plan_code=$2,modules=$3::jsonb || COALESCE(
    (SELECT jsonb_agg(code) FROM jsonb_array_elements_text(control.customer.modules) AS selected(code) WHERE code=ANY($4::text[])), '[]'::jsonb)
    WHERE id=$1 RETURNING id,plan_code,modules`, [id.data, body.data.plan, JSON.stringify(modulesFor(body.data.plan,[])), CLINIC_MODULES]);
  if (!result.rowCount) return reply.status(404).send({ error: 'not_found' });
  return result.rows[0];
});

if (process.env.SERVE_PLATFORM_ASSETS === '1') {
  const staticRoot = path.join(root, 'apps/platform-web/dist');
  const adminRoot = path.join(root, 'apps/admin-web/dist');
  await app.register(fastifyStatic, { root: staticRoot, prefix: '/', wildcard: false, cacheControl: true, maxAge: '1h' });
  await app.register(fastifyStatic, { root: adminRoot, prefix: '/admin/', wildcard: false, decorateReply: false, cacheControl: true, maxAge: '1h' });
  app.get('/admin/*', async (_request, reply) => reply.sendFile('index.html', adminRoot));
  app.get('/*', async (request, reply) => {
    const page = await exportedPlatformPage(staticRoot, request.url);
    if (page) return reply.sendFile(page, staticRoot);
    if (request.url.startsWith('/control/')) return reply.code(404).send({ error: 'not_found' });
    return reply.code(404).sendFile('404.html', staticRoot);
  });
}

const shutdown = async () => { if (provisionTimer) clearTimeout(provisionTimer); await app.close(); await pool.end(); process.exit(0); };
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
await app.listen({ host: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? 3040) });
