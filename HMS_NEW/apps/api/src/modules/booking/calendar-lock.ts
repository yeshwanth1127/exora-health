import { sql, type Transaction, type DB } from '@hms/db';
/** Calendar mutations and public confirmation serialize so a new closure cannot race a booking. */
export const lockCalendar = (tx: Transaction<DB>, tenantId: string) =>
  sql`SELECT pg_advisory_xact_lock(hashtextextended('booking-calendar:' || ${tenantId},0))`.execute(tx);
