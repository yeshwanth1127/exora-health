import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { defaultVoiceSettings, type VoiceSettings } from './voice-control.ts';

type Queryable = Pick<pg.Pool, 'connect' | 'query'>;

/**
 * Clinic-raised Voice requests, completed by a Paperwhale superadmin by hand in Sarvam.
 * A request is a voice_provisioning_operation created by the clinic: `provision` asks for a new agent,
 * `publish` asks for a saved settings revision to be applied. Nothing here calls Sarvam's authoring API.
 */
export const AWAITING = 'awaiting_superadmin';
export const IN_SETUP = 'in_setup';
const OPEN = `o.state IN ('queued','running') AND o.stage IN ('${AWAITING}','${IN_SETUP}')`;
/** A successful runtime test is valid this long before activation must test again. */
const TEST_WINDOW_MS = 60 * 60 * 1000;

export class VoiceRequestError extends Error {
  constructor(readonly status: number, readonly body: Record<string, unknown>) {
    super(typeof body.error === 'string' ? body.error : 'voice_request_failed');
  }
}

export type RequestKind = 'create' | 'changes';
export const kindOf = (operation: string): RequestKind => operation === 'provision' ? 'create' : 'changes';
const requester = (createdBy: string) => createdBy.startsWith('clinic:') ? createdBy.slice(7) : createdBy;

function publicState(row: { state: string; stage: string }) {
  if (row.state === 'succeeded') return 'completed';
  if (row.state === 'cancelled' || row.state === 'failed') return 'declined';
  return row.stage === IN_SETUP ? 'in_setup' : 'pending';
}

function requestView(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    kind: kindOf(String(row.operation)),
    state: publicState(row as { state: string; stage: string }),
    revision: Number(row.revision),
    requestedBy: requester(String(row.created_by)),
    requestedAt: row.created_at,
    updatedAt: row.updated_at,
    reason: row.state === 'cancelled' || row.state === 'failed' ? (row.error ?? null) : null,
  };
}

const entitled = (customer: { modules: unknown; subscription_status: string }) =>
  Array.isArray(customer.modules) && customer.modules.includes('comms')
  && customer.subscription_status !== 'suspended' && customer.subscription_status !== 'cancelled';

async function lockedCustomer(client: pg.PoolClient, customerId: string) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`voice:${customerId}`]);
  const { rows: [customer] } = await client.query(`SELECT c.id,c.name,c.slug,c.modules,c.subscription_status,c.voice_status,
      v.agent_id,v.app_version,COALESCE(v.desired_revision,0) AS desired_revision,COALESCE(v.active_revision,0) AS active_revision
    FROM control.customer c LEFT JOIN control.voice_agent_binding v ON v.customer_id=c.id WHERE c.id=$1 FOR UPDATE OF c`, [customerId]);
  if (!customer) throw new VoiceRequestError(404, { error: 'not_found' });
  return customer as Record<string, unknown> & { modules: unknown; subscription_status: string; desired_revision: number; active_revision: number };
}

async function openRequest(client: Pick<pg.PoolClient, 'query'>, customerId: string) {
  const { rows: [row] } = await client.query(`SELECT o.* FROM control.voice_provisioning_operation o
    WHERE o.customer_id=$1 AND ${OPEN} ORDER BY o.created_at DESC LIMIT 1`, [customerId]);
  return row as Record<string, unknown> | undefined;
}

async function transaction<T>(pool: Queryable, run: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

/** What the clinic Voice page shows. Provider ids stay out of it except the ones the browser runtime needs. */
export async function tenantVoiceStatus(pool: Queryable, customerId: string) {
  const { rows: [customer] } = await pool.query(`SELECT c.id,c.name,c.modules,c.subscription_status,c.voice_status,
      v.agent_id,v.app_version,v.phone_number,COALESCE(v.desired_revision,0) AS desired_revision,COALESCE(v.active_revision,0) AS active_revision
    FROM control.customer c LEFT JOIN control.voice_agent_binding v ON v.customer_id=c.id WHERE c.id=$1`, [customerId]);
  if (!customer) throw new VoiceRequestError(404, { error: 'not_found' });
  const { rows: revisions } = await pool.query(`SELECT revision,settings,state FROM control.voice_configuration_revision
    WHERE customer_id=$1 AND revision = ANY($2::int[])`, [customerId, [customer.desired_revision, customer.active_revision]]);
  const desired = revisions.find((row) => row.revision === customer.desired_revision);
  const active = revisions.find((row) => row.revision === customer.active_revision);
  const { rows: [latest] } = await pool.query(`SELECT * FROM control.voice_provisioning_operation
    WHERE customer_id=$1 AND created_by LIKE 'clinic:%' ORDER BY created_at DESC LIMIT 1`, [customerId]);
  const live = !!customer.agent_id && !!customer.app_version && customer.voice_status === 'active';
  return {
    customerId,
    entitled: entitled(customer),
    voiceStatus: String(customer.voice_status),
    agent: live ? {
      agentId: String(customer.agent_id),
      appVersion: Number(customer.app_version),
      displayName: (active?.settings as VoiceSettings | undefined)?.displayName ?? `${customer.name} Front Desk`,
      phoneNumber: customer.phone_number ?? null,
    } : null,
    request: latest ? requestView(latest) : null,
    desiredRevision: Number(customer.desired_revision),
    activeRevision: Number(customer.active_revision),
    revisionState: desired?.state ?? null,
    settings: (desired?.settings as VoiceSettings | undefined) ?? defaultVoiceSettings(String(customer.name)),
  };
}

/** The clinic's "Create voice agent" button. Idempotent per key and refused while another request is open. */
export async function requestVoiceAgent(pool: Queryable, input: { customerId: string; requestedBy: string; idempotencyKey: string; tenantApiOrigin: string | null }) {
  return transaction(pool, async (client) => {
    const { rows: [replayed] } = await client.query('SELECT * FROM control.voice_provisioning_operation WHERE idempotency_key=$1', [input.idempotencyKey]);
    if (replayed) {
      if (replayed.customer_id !== input.customerId || replayed.operation !== 'provision') throw new VoiceRequestError(409, { error: 'idempotency_key_reused' });
      return { status: 200, body: requestView(replayed) };
    }
    const customer = await lockedCustomer(client, input.customerId);
    if (!entitled(customer)) throw new VoiceRequestError(409, { error: 'voice_not_entitled' });
    if (customer.agent_id && customer.app_version) throw new VoiceRequestError(409, { error: 'voice_agent_exists' });
    if (await openRequest(client, input.customerId)) throw new VoiceRequestError(409, { error: 'voice_request_open' });
    let revision = customer.desired_revision;
    if (revision < 1) {
      revision = 1;
      await client.query(`INSERT INTO control.voice_configuration_revision(customer_id,revision,settings,state,created_by)
        VALUES($1,1,$2,'draft',$3) ON CONFLICT(customer_id,revision) DO NOTHING`,
        [input.customerId, defaultVoiceSettings(String(customer.name)), `clinic:${input.requestedBy}`]);
    }
    await client.query(`INSERT INTO control.voice_agent_binding(customer_id,state,service_secret_ref,desired_revision,tenant_api_origin)
      VALUES($1,'requested',$2,$3,$4) ON CONFLICT(customer_id) DO UPDATE SET state='requested',desired_revision=GREATEST(control.voice_agent_binding.desired_revision,excluded.desired_revision),
        service_secret_ref=COALESCE(control.voice_agent_binding.service_secret_ref,excluded.service_secret_ref),
        tenant_api_origin=COALESCE(excluded.tenant_api_origin,control.voice_agent_binding.tenant_api_origin),last_error=NULL,updated_at=now()`,
      [input.customerId, `tenant-env://${customer.slug}/VOICE_SERVICE_KEY`, revision, input.tenantApiOrigin]);
    const { rows: [created] } = await client.query(`INSERT INTO control.voice_provisioning_operation(id,customer_id,revision,operation,idempotency_key,state,stage,created_by)
      VALUES($1,$2,$3,'provision',$4,'queued',$5,$6) RETURNING *`,
      [randomUUID(), input.customerId, revision, input.idempotencyKey, AWAITING, `clinic:${input.requestedBy}`]);
    await client.query("UPDATE control.customer SET voice_status='requested' WHERE id=$1", [input.customerId]);
    return { status: 201, body: requestView(created) };
  });
}

/** Saves a clinic settings draft as a new revision. Only a live agent without an open request can be edited. */
export async function saveVoiceDraft(pool: Queryable, input: { customerId: string; expectedRevision: number; settings: VoiceSettings; createdBy: string }) {
  return transaction(pool, async (client) => {
    const customer = await lockedCustomer(client, input.customerId);
    if (!customer.agent_id || !customer.app_version) throw new VoiceRequestError(409, { error: 'voice_agent_missing' });
    if (await openRequest(client, input.customerId)) throw new VoiceRequestError(409, { error: 'voice_request_open' });
    if (customer.desired_revision !== input.expectedRevision) throw new VoiceRequestError(409, { error: 'stale_revision', currentRevision: customer.desired_revision });
    const revision = customer.desired_revision + 1;
    await client.query(`INSERT INTO control.voice_configuration_revision(customer_id,revision,settings,state,created_by)
      VALUES($1,$2,$3,'draft',$4)`, [input.customerId, revision, input.settings, input.createdBy]);
    await client.query('UPDATE control.voice_agent_binding SET desired_revision=$2,updated_at=now() WHERE customer_id=$1', [input.customerId, revision]);
    return { status: 201, body: { customerId: input.customerId, revision, state: 'draft', settings: input.settings } };
  });
}

/** "Request changes": asks Paperwhale to apply the clinic's latest saved draft to its live agent. */
export async function requestVoiceChanges(pool: Queryable, input: { customerId: string; revision: number; requestedBy: string; idempotencyKey: string }) {
  return transaction(pool, async (client) => {
    const { rows: [replayed] } = await client.query('SELECT * FROM control.voice_provisioning_operation WHERE idempotency_key=$1', [input.idempotencyKey]);
    if (replayed) {
      if (replayed.customer_id !== input.customerId || replayed.operation !== 'publish' || replayed.revision !== input.revision) throw new VoiceRequestError(409, { error: 'idempotency_key_reused' });
      return { status: 200, body: requestView(replayed) };
    }
    const customer = await lockedCustomer(client, input.customerId);
    if (!entitled(customer)) throw new VoiceRequestError(409, { error: 'voice_not_entitled' });
    if (!customer.agent_id || !customer.app_version) throw new VoiceRequestError(409, { error: 'voice_agent_missing' });
    if (await openRequest(client, input.customerId)) throw new VoiceRequestError(409, { error: 'voice_request_open' });
    if (input.revision !== customer.desired_revision) throw new VoiceRequestError(409, { error: 'stale_revision', currentRevision: customer.desired_revision });
    const { rows: [revision] } = await client.query(`SELECT state FROM control.voice_configuration_revision WHERE customer_id=$1 AND revision=$2`, [input.customerId, input.revision]);
    if (!revision) throw new VoiceRequestError(404, { error: 'voice_revision_not_found' });
    if (revision.state !== 'draft') throw new VoiceRequestError(409, { error: 'voice_revision_not_draft' });
    await client.query(`UPDATE control.voice_configuration_revision SET state='ready',error=NULL,updated_at=now() WHERE customer_id=$1 AND revision=$2`, [input.customerId, input.revision]);
    const { rows: [created] } = await client.query(`INSERT INTO control.voice_provisioning_operation(id,customer_id,revision,operation,idempotency_key,state,stage,created_by)
      VALUES($1,$2,$3,'publish',$4,'queued',$5,$6) RETURNING *`,
      [randomUUID(), input.customerId, input.revision, input.idempotencyKey, AWAITING, `clinic:${input.requestedBy}`]);
    return { status: 201, body: requestView(created) };
  });
}

/** Superadmin inbox: every open clinic request, oldest first. */
export async function listOpenVoiceRequests(pool: Queryable) {
  const { rows } = await pool.query(`SELECT o.*,c.name AS customer_name,c.slug AS customer_slug FROM control.voice_provisioning_operation o
    JOIN control.customer c ON c.id=o.customer_id WHERE ${OPEN} ORDER BY o.created_at`);
  return rows.map((row) => ({ ...requestView(row), customerId: String(row.customer_id), customerName: String(row.customer_name), customerSlug: String(row.customer_slug) }));
}

export async function loadVoiceRequest(pool: Pick<pg.Pool, 'query'>, operationId: string) {
  const { rows: [row] } = await pool.query(`SELECT o.* FROM control.voice_provisioning_operation o WHERE o.id=$1 AND o.operation IN ('provision','publish') AND o.created_by LIKE 'clinic:%'`, [operationId]);
  if (!row) throw new VoiceRequestError(404, { error: 'voice_request_not_found' });
  return { row: row as Record<string, unknown>, view: requestView(row) };
}

async function lockedOpenRequest(client: pg.PoolClient, operationId: string) {
  const { row } = await loadVoiceRequest(client, operationId);
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`voice:${row.customer_id}`]);
  const { rows: [current] } = await client.query(`SELECT o.* FROM control.voice_provisioning_operation o WHERE o.id=$1 AND ${OPEN} FOR UPDATE`, [operationId]);
  if (!current) throw new VoiceRequestError(409, { error: 'voice_request_closed' });
  return current as Record<string, unknown>;
}

/** Marks the request as being worked on so the clinic sees progress. */
export async function startVoiceRequest(pool: Queryable, operationId: string) {
  return transaction(pool, async (client) => {
    const row = await lockedOpenRequest(client, operationId);
    const { rows: [updated] } = await client.query(`UPDATE control.voice_provisioning_operation SET state='running',stage=$2,
      started_at=COALESCE(started_at,now()),updated_at=now() WHERE id=$1 RETURNING *`, [operationId, IN_SETUP]);
    if (row.operation === 'provision') {
      await client.query("UPDATE control.voice_agent_binding SET state='configuring',updated_at=now() WHERE customer_id=$1", [row.customer_id]);
      await client.query("UPDATE control.customer SET voice_status='configuring' WHERE id=$1", [row.customer_id]);
    }
    return { status: 200, body: requestView(updated) };
  });
}

export type RuntimeCheck = (agentId: string, appVersion: number) => Promise<{ ok: boolean; status: number }>;

const AgentIdPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,199}$/;

function validateAgent(agentId: string, appVersion: number) {
  if (!AgentIdPattern.test(agentId)) throw new VoiceRequestError(400, { error: 'validation', message: 'Agent id is not a Sarvam app id.' });
  if (!Number.isInteger(appVersion) || appVersion < 1) throw new VoiceRequestError(400, { error: 'validation', message: 'Version must be a committed version number.' });
}

/** Checks the agent/version against the request and the binding, then asks Sarvam's runtime for a call URL. */
export async function testVoiceRequest(pool: Queryable, operationId: string, input: { agentId: string; appVersion: number }, check: RuntimeCheck) {
  validateAgent(input.agentId, input.appVersion);
  const { row } = await loadVoiceRequest(pool, operationId);
  await assertAgentFits(pool, row, input);
  const result = await check(input.agentId, input.appVersion);
  if (!result.ok) {
    return { status: 409, body: { error: 'voice_agent_test_failed', message: `Sarvam did not issue a call URL for ${input.agentId} v${input.appVersion} (HTTP ${result.status}). Check that the version is committed.` } };
  }
  const tested = { agentId: input.agentId, appVersion: input.appVersion, testedAt: new Date().toISOString() };
  const updated = await pool.query(`UPDATE control.voice_provisioning_operation o SET result=COALESCE(result,'{}'::jsonb)||jsonb_build_object('tested',$2::jsonb),updated_at=now()
    WHERE o.id=$1 AND ${OPEN}`, [operationId, tested]);
  if (!updated.rowCount) throw new VoiceRequestError(409, { error: 'voice_request_closed' });
  return { status: 200, body: { ok: true, ...tested } };
}

async function assertAgentFits(pool: Pick<pg.Pool, 'query'>, row: Record<string, unknown>, input: { agentId: string; appVersion: number }) {
  const { rows: [binding] } = await pool.query('SELECT agent_id,app_version FROM control.voice_agent_binding WHERE customer_id=$1', [row.customer_id]);
  const { rows: [owner] } = await pool.query('SELECT customer_id FROM control.voice_agent_binding WHERE agent_id=$1 AND customer_id<>$2', [input.agentId, row.customer_id]);
  if (owner) throw new VoiceRequestError(409, { error: 'voice_agent_bound_elsewhere', message: 'That Sarvam agent is already bound to another clinic.' });
  if (row.operation === 'publish') {
    if (binding?.agent_id !== input.agentId) throw new VoiceRequestError(409, { error: 'voice_agent_mismatch', message: `Changes must be applied to this clinic's agent ${binding?.agent_id ?? ''}.` });
    if (binding?.app_version && input.appVersion <= Number(binding.app_version)) {
      throw new VoiceRequestError(409, { error: 'voice_version_not_newer', message: `Commit a new version after v${binding.app_version} with the requested changes.` });
    }
  }
}

/** Binds the tested agent/version to the clinic and closes the request. */
export async function activateVoiceRequest(pool: Queryable, operationId: string, input: {
  agentId: string; appVersion: number; phoneNumber?: string | null; deploymentId?: string | null; configurationHash: string;
}) {
  validateAgent(input.agentId, input.appVersion);
  return transaction(pool, async (client) => {
    const row = await lockedOpenRequest(client, operationId);
    await assertAgentFits(client, row, input);
    const tested = (row.result as { tested?: { agentId: string; appVersion: number; testedAt: string } } | null)?.tested;
    if (!tested || tested.agentId !== input.agentId || tested.appVersion !== input.appVersion || Date.now() - Date.parse(tested.testedAt) > TEST_WINDOW_MS) {
      throw new VoiceRequestError(409, { error: 'voice_agent_untested', message: 'Run the test for this exact agent and version before activating.' });
    }
    const customerId = row.customer_id, revision = Number(row.revision);
    await client.query(`UPDATE control.voice_configuration_revision SET state='superseded',updated_at=now() WHERE customer_id=$1 AND state='active' AND revision<>$2`, [customerId, revision]);
    await client.query(`UPDATE control.voice_configuration_revision SET state='active',provider_version=$3,configuration_hash=$4,error=NULL,updated_at=now()
      WHERE customer_id=$1 AND revision=$2`, [customerId, revision, input.appVersion, input.configurationHash]);
    await client.query(`UPDATE control.voice_agent_binding SET state='active',agent_id=$2,
        previous_app_version=CASE WHEN app_version IS DISTINCT FROM $3 THEN app_version ELSE previous_app_version END,app_version=$3,
        phone_number=COALESCE($4,phone_number),deployment_id=COALESCE($5,deployment_id),
        active_revision=$6,desired_revision=GREATEST(desired_revision,$6),configuration_hash=$7,last_error=NULL,last_synced_at=now(),updated_at=now()
      WHERE customer_id=$1`, [customerId, input.agentId, input.appVersion, input.phoneNumber ?? null, input.deploymentId ?? null, revision, input.configurationHash]);
    await client.query("UPDATE control.customer SET voice_status='active' WHERE id=$1", [customerId]);
    const { rows: [updated] } = await client.query(`UPDATE control.voice_provisioning_operation SET state='succeeded',stage='complete',error=NULL,
      result=COALESCE(result,'{}'::jsonb)||jsonb_build_object('activated',$2::jsonb),completed_at=now(),updated_at=now() WHERE id=$1 RETURNING *`,
      [operationId, { agentId: input.agentId, appVersion: input.appVersion, phoneNumber: input.phoneNumber ?? null, deploymentId: input.deploymentId ?? null }]);
    return { status: 200, body: requestView(updated) };
  });
}

/** Declines a request with a reason the clinic can read. A declined create returns the clinic to "not requested". */
export async function declineVoiceRequest(pool: Queryable, operationId: string, reason: string) {
  return transaction(pool, async (client) => {
    const row = await lockedOpenRequest(client, operationId);
    const { rows: [updated] } = await client.query(`UPDATE control.voice_provisioning_operation SET state='cancelled',stage='declined',error=$2,
      completed_at=now(),updated_at=now() WHERE id=$1 RETURNING *`, [operationId, reason]);
    if (row.operation === 'provision') {
      await client.query("UPDATE control.voice_agent_binding SET state='requested',updated_at=now() WHERE customer_id=$1 AND agent_id IS NULL", [row.customer_id]);
      await client.query("UPDATE control.customer SET voice_status='not_requested' WHERE id=$1 AND voice_status<>'active'", [row.customer_id]);
    } else {
      await client.query(`UPDATE control.voice_configuration_revision SET state='failed',error=$3,updated_at=now() WHERE customer_id=$1 AND revision=$2`, [row.customer_id, row.revision, reason]);
    }
    return { status: 200, body: requestView(updated) };
  });
}
