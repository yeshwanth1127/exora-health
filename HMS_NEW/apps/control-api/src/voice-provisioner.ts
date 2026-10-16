import { z } from 'zod';
import type pg from 'pg';
import { compileVoiceManifest, VoiceSettingsSchema } from './voice-control.ts';
import { managedTelephonyRequest } from './voice-telephony.ts';

const ProviderResult = z.strictObject({
  agentId: z.string().min(3).max(200),
  appVersion: z.number().int().positive(),
  deploymentId: z.string().min(3).max(200).nullable().optional(),
  connectionId: z.string().min(3).max(200).nullable().optional(),
  phoneNumber: z.string().max(32).nullable().optional(),
  telephonyStatus: z.enum(['assigned', 'already_assigned']).optional(),
  configurationHash: z.string().regex(/^[a-f0-9]{64}$/),
});

export type VoiceProvisionerOptions = {
  url: string;
  token: string;
  templateAgentId?: string;
  preferredConnectionId?: string;
};

export async function processOneVoiceOperation(pool: pg.Pool, options: VoiceProvisionerOptions): Promise<boolean> {
  const client = await pool.connect();
  let operation: Record<string, unknown> | undefined;
  try {
    await client.query('BEGIN');
    const { rows: [claimed] } = await client.query(`UPDATE control.voice_provisioning_operation SET state='running',stage='compile',attempts=attempts+1,started_at=COALESCE(started_at,now()),updated_at=now()
      WHERE id=(SELECT id FROM control.voice_provisioning_operation WHERE state='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING *`);
    if (!claimed) { await client.query('ROLLBACK'); return false; }
    operation = claimed;
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }

  if (!operation) return false;
  const operationId = String(operation.id);
  try {
    const { rows: [row] } = await pool.query(`SELECT o.id AS operation_id,o.customer_id,o.revision,o.operation,r.settings,
      c.name,c.slug,c.subscription_status,q.payload,d.tenant_id,d.public_url,
      v.agent_id,v.app_version,v.deployment_id,v.connection_id,v.phone_number,v.service_secret_ref
      FROM control.voice_provisioning_operation o
      JOIN control.voice_configuration_revision r ON r.customer_id=o.customer_id AND r.revision=o.revision
      JOIN control.customer c ON c.id=o.customer_id JOIN control.onboarding_request q ON q.id=c.onboarding_id
      JOIN control.deployment d ON d.customer_id=c.id JOIN control.voice_agent_binding v ON v.customer_id=c.id
      WHERE o.id=$1`, [operationId]);
    if (!row) throw new Error('Voice operation lost its tenant binding');
    if (row.subscription_status === 'suspended' || row.subscription_status === 'cancelled') throw new Error('Tenant subscription is inactive');
    if (!row.service_secret_ref) throw new Error('Tenant Voice service secret reference is missing');
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const manifest = compileVoiceManifest({
      customerId: row.customer_id,
      tenantId: row.tenant_id,
      slug: row.slug,
      hospitalName: row.name,
      facilityName: String(payload.facilityName ?? row.name),
      timezone: String(payload.timezone ?? 'Asia/Kolkata'),
      publicUrl: row.public_url,
    }, VoiceSettingsSchema.parse(row.settings), options.templateAgentId);
    await pool.query("UPDATE control.voice_provisioning_operation SET stage='provider_apply',updated_at=now() WHERE id=$1", [operationId]);
    const telephony = managedTelephonyRequest({
      customerId: String(row.customer_id),
      timezone: String(payload.timezone ?? 'Asia/Kolkata'),
      preferredConnectionId: options.preferredConnectionId,
      connectionId: row.connection_id,
      phoneNumber: row.phone_number,
      deploymentId: row.deployment_id,
    });
    const response = await fetch(options.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${options.token}`, 'content-type': 'application/json', 'idempotency-key': operationId },
      body: JSON.stringify({
        operationId, operation: row.operation, manifest,
        secretRef: row.service_secret_ref,
        currentBinding: { agentId: row.agent_id, appVersion: row.app_version, deploymentId: row.deployment_id, connectionId: row.connection_id, phoneNumber: row.phone_number },
        telephony,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const raw: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Sarvam provisioner rejected the operation (${response.status})`);
    const result = ProviderResult.parse(raw);
    if (result.configurationHash !== manifest.configurationHash) throw new Error('Sarvam provisioner applied a different configuration hash');
    if (!result.deploymentId || !result.connectionId || !result.phoneNumber) {
      throw new Error('Dedicated Voice number inventory is exhausted; rent or import another Sarvam number and retry');
    }
    const completed = await pool.connect();
    try {
      await completed.query('BEGIN');
      await completed.query(`UPDATE control.voice_configuration_revision SET state='superseded',updated_at=now()
        WHERE customer_id=$1 AND state='active' AND revision<>$2`, [row.customer_id,row.revision]);
      await completed.query(`UPDATE control.voice_configuration_revision SET state='active',provider_version=$3,error=NULL,updated_at=now()
        WHERE customer_id=$1 AND revision=$2`, [row.customer_id,row.revision,result.appVersion]);
      await completed.query(`UPDATE control.voice_agent_binding SET state='active',agent_id=$2,previous_app_version=app_version,app_version=$3,
        deployment_id=COALESCE($4,deployment_id),connection_id=COALESCE($5,connection_id),phone_number=COALESCE($6,phone_number),
        active_revision=$7,configuration_hash=$8,last_error=NULL,last_synced_at=now(),updated_at=now() WHERE customer_id=$1`,
        [row.customer_id,result.agentId,result.appVersion,result.deploymentId ?? null,result.connectionId ?? null,result.phoneNumber ?? null,row.revision,manifest.configurationHash]);
      await completed.query("UPDATE control.customer SET voice_status='active' WHERE id=$1", [row.customer_id]);
      await completed.query("UPDATE control.voice_provisioning_operation SET state='succeeded',stage='complete',result=$2,error=NULL,completed_at=now(),updated_at=now() WHERE id=$1", [operationId,result]);
      await completed.query('COMMIT');
    } catch (error) { await completed.query('ROLLBACK'); throw error; }
    finally { completed.release(); }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2000) : 'Voice provisioning failed';
    await pool.query("UPDATE control.voice_provisioning_operation SET state='failed',stage='failed',error=$2,completed_at=now(),updated_at=now() WHERE id=$1", [operationId,message]);
    await pool.query("UPDATE control.voice_configuration_revision SET state='failed',error=$3,updated_at=now() WHERE customer_id=$1 AND revision=$2", [operation.customer_id,operation.revision,message]);
    await pool.query("UPDATE control.voice_agent_binding SET state='failed',last_error=$2,updated_at=now() WHERE customer_id=$1", [operation.customer_id,message]);
    await pool.query("UPDATE control.customer SET voice_status='failed' WHERE id=$1", [operation.customer_id]);
    return true;
  }
}
