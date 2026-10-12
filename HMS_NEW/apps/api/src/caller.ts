import type { Actor } from '@hms/platform';

/** Who is calling and for which tenant. `now` lets tests pin the clock; production omits it. */
export interface Caller {
  tenantId: string;
  actor: Actor;
  now?: Date | undefined;
  /** Request id, recorded on audit and outbox rows. */
  correlationId?: string | undefined;
}

export const clock = (caller: Caller): Date => caller.now ?? new Date();
