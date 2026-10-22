import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { preconditionFailed } from '@hms/platform';
import { authorize } from '../../auth/principal.ts';
import { controlCall, type VoiceControlTarget } from '../../modules/comms/managed-voice.ts';
import { idempotencyKey, parse, principalOf, uuid } from '../support.ts';

const FacilityQuery = z.object({ facilityId: uuid });
const RequestBody = z.object({ facilityId: uuid });
const DraftBody = z.object({
  facilityId: uuid,
  expectedRevision: z.number().int().nonnegative(),
  settings: z.unknown(),
});
const ChangesBody = z.object({
  facilityId: uuid,
  revision: z.number().int().positive(),
});

/**
 * Clinic Voice agent requests. The clinic asks Exora for an agent or for changes to it; an Exora superadmin
 * completes the request in Sarvam. These routes only relay to this clinic's control-plane record.
 */
export function registerVoiceAgentSettingsRoutes(app: FastifyInstance, control?: VoiceControlTarget) {
  app.get('/v1/voice/agent-settings', async (request) => {
    const { facilityId } = parse(FacilityQuery, request.query);
    authorize(principalOf(request), 'voice.read', facilityId);
    return controlCall(requireControl(control), '/voice', { method: 'GET' });
  });
  app.post('/v1/voice/agent-request', async (request, reply) => {
    const body = parse(RequestBody, request.body);
    const principal = principalOf(request);
    authorize(principal, 'voice.manage', body.facilityId);
    const result = await controlCall(requireControl(control), '/voice-request', {
      method: 'POST',
      body: { requestedBy: principal.displayName },
      idempotencyKey: idempotencyKey(request),
    });
    return reply.status(201).send(result);
  });
  app.put('/v1/voice/agent-settings', async (request) => {
    const body = parse(DraftBody, request.body);
    const principal = principalOf(request);
    authorize(principal, 'voice.manage', body.facilityId);
    return controlCall(requireControl(control), '/voice-draft', {
      method: 'PUT',
      body: { expectedRevision: body.expectedRevision, settings: body.settings, requestedBy: principal.displayName },
    });
  });
  app.post('/v1/voice/agent-settings/request-changes', async (request, reply) => {
    const body = parse(ChangesBody, request.body);
    const principal = principalOf(request);
    authorize(principal, 'voice.manage', body.facilityId);
    const result = await controlCall(requireControl(control), '/voice-changes', {
      method: 'POST',
      body: { revision: body.revision, requestedBy: principal.displayName },
      idempotencyKey: idempotencyKey(request),
    });
    return reply.status(201).send(result);
  });
}

function requireControl(control?: VoiceControlTarget): VoiceControlTarget {
  if (!control?.url || !control.token) throw preconditionFailed('Voice control is not configured for this clinic.');
  return control;
}
