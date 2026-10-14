// Explicit server-owned website -> clinic authority. Nothing here is a browser credential.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { DomainError } from '@hms/platform';

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/);
const origin = z.string().refine((s) => {
  try { const u = new URL(s); return u.origin === s && (u.protocol === 'https:' || (u.protocol === 'http:' && ['127.0.0.1','localhost'].includes(u.hostname))); } catch { return false; }
}, 'an exact HTTPS origin or loopback development origin is required');
export const PublicBookingSiteSchema = z.strictObject({
  siteSlug: slug, tenantId: z.uuid(), facilityId: z.uuid(),
  identityIssuer: z.string().min(1).max(300), identitySubject: z.string().min(1).max(200),
  origins: z.array(origin).min(1).max(10),
  websiteBranchId: slug.nullable().default(null),
  // Explicit correspondence to old webpage IDs, never guessed from a doctor's name.
  doctorAliases: z.record(slug, z.array(slug).max(10)).default({}),
});
export type PublicBookingSite = z.infer<typeof PublicBookingSiteSchema>;
export interface PublicBookingConfig { sites: PublicBookingSite[]; signingSecret: string }
export function loadPublicBookingConfig(env: NodeJS.ProcessEnv = process.env): PublicBookingConfig {
  if (env.PUBLIC_BOOKING_ENABLED !== 'true') return { sites: [], signingSecret: '' };
  try {
    const sites = z.array(PublicBookingSiteSchema).min(1).max(100).parse(JSON.parse(env.PUBLIC_BOOKING_SITES_JSON ?? '[]'));
    const signingSecret = z.string().min(32).max(256).parse(env.PUBLIC_BOOKING_SIGNING_SECRET);
    if (new Set(sites.map(s => s.siteSlug)).size !== sites.length) throw Error();
    for (const site of sites) {
      const aliases = Object.values(site.doctorAliases).flat();
      if (new Set(aliases).size !== aliases.length) throw Error();
    }
    return { sites, signingSecret };
  } catch { throw Error('Public booking configuration is invalid; check site bindings and the server signing secret'); }
}
export const SlotClaimSchema = z.strictObject({
  siteSlug: slug, tenantId: z.uuid(), facilityId: z.uuid(), staffId: z.uuid(), doctorSlug: slug,
  serviceId: z.uuid(), visitMode: z.enum(['in_person','virtual']),
  startsAt: z.iso.datetime({offset:true}), endsAt: z.iso.datetime({offset:true}),
  feeMinor: z.number().int().min(0), expiresAt: z.number().int().positive(),
});
export type SlotClaim = z.infer<typeof SlotClaimSchema>;
export function signSlot(claim: SlotClaim, secret: string): string {
  const payload = Buffer.from(JSON.stringify(SlotClaimSchema.parse(claim))).toString('base64url');
  return `${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;
}
export function readSlot(token: string, secret: string): SlotClaim {
  try {
    if (token.length > 2000) throw Error();
    const parts=token.split('.'); if(parts.length!==2 || !parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p))) throw Error();
    const signature=Buffer.from(parts[1]!, 'base64url');
    const expected=createHmac('sha256',secret).update(parts[0]!).digest();
    if(signature.length!==expected.length || !timingSafeEqual(signature,expected)) throw Error();
    return SlotClaimSchema.parse(JSON.parse(Buffer.from(parts[0]!,'base64url').toString('utf8')));
  } catch { throw new DomainError('validation','This time selection is invalid. Choose an available time again.'); }
}
