// The signed-in person's alert marks and own registrations (docs/prd/staff-alerts.md). No permission beyond being
// signed in: that is the caller's own data, and the alerts themselves are derived from reads the caller is separately
// authorized for. The one exception, other people's expiring registrations, needs staff.manage.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { listAlertState, listExpiringRegistrations, markAlert, markAlertsRead } from '../../modules/access/alerts.ts';
import { listRegistrations } from '../../modules/access/admin.ts';
import { grantedFacilities } from '../../auth/principal.ts';
import { callerOf, parse, principalOf } from '../support.ts';

/** Team registrations ending within this many days are returned to people who manage staff (they renew them). */
const REGISTRATION_DAYS = 30;

const AlertKey = z.string().regex(/^[a-z_]{2,20}:[A-Za-z0-9:._-]{1,200}$/, 'expected an alert key');

export function registerAlertRoutes(app: FastifyInstance, db: Kysely<DB>) {
  app.get('/v1/me/alerts', async (request) => {
    const caller = callerOf(request), principal = principalOf(request);
    const staffManage = grantedFacilities(principal, 'staff.manage');
    const [states, registrations, team] = await Promise.all([
      listAlertState(db, caller),
      listRegistrations(db, caller, principal.staffId),
      staffManage === null || staffManage.size > 0 ? listExpiringRegistrations(db, caller, REGISTRATION_DAYS, staffManage) : null,
    ]);
    // team is null (not []) without staff.manage, so the app can say it could not check rather than "none due".
    return { states, registrations, teamRegistrations: team };
  });

  app.put('/v1/me/alerts/:key', async (request) => {
    const { key } = parse(z.object({ key: AlertKey }), request.params);
    const body = parse(
      z.object({ read: z.boolean().optional(), dismissed: z.boolean().optional(), snoozedUntil: z.iso.datetime({ offset: true }).nullable().optional() }).strict().refine((b) => Object.keys(b).length > 0, 'nothing to mark'),
      request.body,
    );
    return markAlert(db, callerOf(request), key, body);
  });

  app.post('/v1/me/alerts/read', async (request) => {
    const body = parse(z.object({ keys: z.array(AlertKey).min(1).max(200) }).strict(), request.body);
    return markAlertsRead(db, callerOf(request), body.keys);
  });
}
