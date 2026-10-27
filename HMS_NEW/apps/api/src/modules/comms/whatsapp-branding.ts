import { z } from 'zod';
import type { PublicBookingConfig } from '../booking/public-config.ts';

const Branding = z.array(z.strictObject({
  tenantId: z.uuid(),
  facilityId: z.uuid(),
  welcomeImageUrl: z.url(),
})).max(100);
export type WhatsAppBranding = z.infer<typeof Branding>;

/** Public hospital artwork only. Credentials and arbitrary media uploads never belong here. */
export function loadWhatsAppBranding(raw: string | undefined, booking?: PublicBookingConfig): WhatsAppBranding {
  const entries = Branding.parse(JSON.parse(raw || '[]'));
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.tenantId}:${entry.facilityId}`;
    const url = new URL(entry.welcomeImageUrl);
    const sites = booking?.sites.filter(site => site.tenantId === entry.tenantId && site.facilityId === entry.facilityId) || [];
    if (seen.has(key) || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        !/\.(?:png|jpe?g)$/i.test(url.pathname) || !sites.some(site => site.origins.includes(url.origin))) {
      throw Error('WhatsApp branding requires one HTTPS hospital image on the matching booking-site origin');
    }
    seen.add(key);
  }
  return entries;
}

export function welcomeImage(branding: WhatsAppBranding | undefined, tenantId: string, facilityId: string) {
  return branding?.find(entry => entry.tenantId === tenantId && entry.facilityId === facilityId)?.welcomeImageUrl;
}

/** Meta supports 1,024-character captions. Longer prompts remain text without truncation. */
export function bookingMessage(body: string, imageUrl?: string) {
  return imageUrl && body.length <= 1024
    ? { type: 'image', image: { link: imageUrl, caption: body } }
    : { type: 'text', text: { preview_url: false, body } };
}

/** Test connections fail closed unless the recipient was explicitly approved. */
export function testRecipientAllowed(metadata: any, address: string): boolean {
  return metadata?.testMode !== true || (Array.isArray(metadata.testRecipients) && metadata.testRecipients.includes(address));
}
