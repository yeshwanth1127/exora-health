// Routes of a separately switched clinic module (SWITCHED_MODULES) are registered inside a scope that
// answers 422 module_inactive until the tenant has switched the module on. A suspended module's records
// stay readable; its writes are refused by runCommand.
import type { FastifyInstance } from 'fastify';
import type { DB, Kysely } from '@hms/db';
import { DomainError, runQuery } from '@hms/platform';
import { principalOf } from './support.ts';

const READABLE = new Set(['active', 'suspended']);

export function moduleRoutes(app: FastifyInstance, db: Kysely<DB>, module: string, register: (scoped: FastifyInstance) => void) {
  void app.register(async (scoped) => {
    scoped.addHook('onRequest', async (request) => {
      const { tenantId } = principalOf(request);
      const state = await runQuery(db, tenantId, async (tx) =>
        (await tx.selectFrom('platform.module_state').select('state').where('module_code', '=', module as never).executeTakeFirst())?.state ?? 'not_provisioned');
      if (!READABLE.has(state)) {
        throw new DomainError('precondition_failed', `the ${module} module is not switched on for this hospital`, { reason: 'module_inactive', module, state });
      }
    });
    register(scoped);
  });
}
