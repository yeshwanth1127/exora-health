import type { FastifyInstance } from 'fastify';
import type { DB, Kysely } from '@hms/db';
import { preconditionFailed } from '@hms/platform';
import { z } from 'zod';
import { authorize } from '../../auth/principal.ts';
import {
  callerOf,
  principalOf,
  parse,
  uuid,
  idempotencyKey,
} from '../support.ts';
import {
  appleDashboard,
  appleThread,
  replyApple,
} from '../../modules/comms/apple-messages.ts';
import type { AppleSettings } from '../../modules/comms/apple-config.ts';

export function registerAppleMessagesRoutes(
  app: FastifyInstance,
  db: Kysely<DB>,
  settings: AppleSettings,
) {
  const scope = z.strictObject({ facilityId: uuid });
  app.get('/v1/apple-messages', async (request) => {
    const { facilityId } = parse(scope, request.query);
    authorize(principalOf(request), 'comms.read', facilityId);
    return {
      ...(await appleDashboard(db, callerOf(request), facilityId)),
      configured: settings.bindings.some(
        (b) =>
          b.tenantId === callerOf(request).tenantId &&
          b.facilityId === facilityId &&
          !b.localDemo,
      ),
      localDemo: settings.bindings.some(
        (b) =>
          b.tenantId === callerOf(request).tenantId &&
          b.facilityId === facilityId &&
          b.localDemo,
      ),
      provider: 'amazon_connect',
      message:
        'Account linking and an allowlisted iPhone test are required before live acceptance.',
    };
  });
  app.get('/v1/apple-messages/conversations/:id', async (request) => {
    const { facilityId } = parse(scope, request.query),
      { id } = parse(z.strictObject({ id: uuid }), request.params);
    authorize(principalOf(request), 'comms.read', facilityId);
    return appleThread(db, callerOf(request), facilityId, id);
  });
  app.post('/v1/apple-messages/conversations/:id/replies', async (request) => {
    const { id } = parse(z.strictObject({ id: uuid }), request.params);
    const input = parse(
      scope.extend({
        version: z.number().int().positive(),
        text: z.string().trim().min(1).max(4096),
      }),
      request.body,
    );
    authorize(principalOf(request), 'comms.reply', input.facilityId);
    if (
      !settings.bindings.some(
        (b) =>
          b.tenantId === callerOf(request).tenantId &&
          b.facilityId === input.facilityId,
      )
    )
      throw preconditionFailed(
        'Apple Messages is being prepared for this clinic.',
      );
    return replyApple(
      db,
      callerOf(request),
      { ...input, conversationId: id },
      idempotencyKey(request),
    );
  });
}
