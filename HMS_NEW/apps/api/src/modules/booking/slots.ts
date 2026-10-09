// Read side of scheduling: a doctor's sessions and bookable slots.
import { sql, type DB, type Kysely } from '@hms/db';
import { runQuery } from '@hms/platform';
import { clock, type Caller } from '../../caller.ts';
import { practitionerResourceId } from './calendar.ts';

export interface Slot {
  slotStart: Date;
  slotEnd: Date;
  facilityId: string;
  consultLocationId: string | null;
  healthcareServiceId: string | null;
  visitMode: 'in_person' | 'virtual';
  status: 'free' | 'taken' | 'blocked';
}

export interface SlotQuery {
  staffId: string;
  from: string; // 'YYYY-MM-DD' (facility-local dates)
  to: string;
  facilityId?: string;
  /** Include taken and blocked slots (for a staff-facing day view). Default: free only. */
  includeUnavailable?: boolean;
}

export async function listSlots(db: Kysely<DB>, caller: Caller, query: SlotQuery): Promise<Slot[]> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const resourceId = await practitionerResourceId(tx, query.staffId);
    const { rows } = await sql<{
      slot_start: Date;
      slot_end: Date;
      facility_id: string;
      consult_location_id: string | null;
      healthcare_service_id: string | null;
      visit_mode: 'in_person' | 'virtual';
      status: 'free' | 'taken' | 'blocked';
    }>`
      SELECT * FROM booking.available_slots(${resourceId}, ${query.from}::date, ${query.to}::date, ${clock(caller)})
      WHERE (${query.facilityId ?? null}::uuid IS NULL OR facility_id = ${query.facilityId ?? null}::uuid)
        AND (${query.includeUnavailable ?? false} OR status = 'free')`.execute(tx);
    return rows.map((r) => ({
      slotStart: r.slot_start,
      slotEnd: r.slot_end,
      facilityId: r.facility_id,
      consultLocationId: r.consult_location_id,
      healthcareServiceId: r.healthcare_service_id,
      visitMode: r.visit_mode,
      status: r.status,
    }));
  });
}

export interface Session {
  sessionOn: string;
  facilityId: string;
  startsAt: Date;
  endsAt: Date;
  slotMinutes: number | null;
  maxWalkInTokens: number;
  source: 'weekly' | 'day_plan' | 'extra_hours';
}

/** A doctor's effective sessions per day (after day plans, extra hours, closures and holidays). */
export async function listSessions(db: Kysely<DB>, caller: Caller, query: { staffId: string; from: string; to: string }): Promise<Session[]> {
  return runQuery(db, caller.tenantId, async (tx) => {
    const resourceId = await practitionerResourceId(tx, query.staffId);
    const { rows } = await sql<{
      session_on: string;
      facility_id: string;
      starts_at: Date;
      ends_at: Date;
      slot_minutes: number | null;
      max_walk_in_tokens: number;
      source: Session['source'];
    }>`SELECT * FROM booking.sessions(${resourceId}, ${query.from}::date, ${query.to}::date) ORDER BY starts_at`.execute(tx);
    return rows.map((r) => ({
      sessionOn: r.session_on,
      facilityId: r.facility_id,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      slotMinutes: r.slot_minutes,
      maxWalkInTokens: r.max_walk_in_tokens,
      source: r.source,
    }));
  });
}
