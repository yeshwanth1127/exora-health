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

/**
 * The hospital's calendar day (YYYY-MM-DD) at an instant — the day the database's current_date and the
 * staff see, not the UTC day (which lags by 5½ hours after midnight).
 * ponytail: fixed IST offset; use the facility's timezone if a tenant runs outside India.
 */
export const hospitalDay = (at: Date): string => new Date(at.getTime() + 330 * 60_000).toISOString().slice(0, 10);
