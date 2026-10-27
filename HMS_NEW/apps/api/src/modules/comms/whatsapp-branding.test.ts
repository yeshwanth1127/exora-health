import { describe, expect, it } from 'vitest';
import type { PublicBookingConfig } from '../booking/public-config.ts';
import { bookingMessage, loadWhatsAppBranding, testRecipientAllowed, welcomeImage } from './whatsapp-branding.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const facilityId = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const image = 'https://swastikaa.example/brand/hospital.png';
const config: PublicBookingConfig = { signingSecret: 'test-only', sites: [{
  siteSlug: 'swastikaa', tenantId, facilityId, origins: ['https://swastikaa.example'],
  identityIssuer: 'test', identitySubject: 'booking', doctorAliases: {}, websiteBranchId: null,
}] };
const entry = { tenantId, facilityId, welcomeImageUrl: image };

describe('tenant-owned WhatsApp welcome branding', () => {
  it('is off by default and matches both tenant and facility', () => {
    expect(loadWhatsAppBranding(undefined, config)).toEqual([]);
    const branding = loadWhatsAppBranding(JSON.stringify([entry]), config);
    expect(welcomeImage(branding, tenantId, facilityId)).toBe(image);
    expect(welcomeImage(branding, other, facilityId)).toBeUndefined();
    expect(welcomeImage(branding, tenantId, other)).toBeUndefined();
  });
  it('rejects unrelated origins, credential URLs, queries and unsupported file types', () => {
    for (const url of ['https://other.example/brand/hospital.png', 'http://swastikaa.example/brand/hospital.png',
      'https://user:secret@swastikaa.example/brand/hospital.png', image + '?key=private', image + '#fragment',
      'https://swastikaa.example/brand/hospital.svg', 'file:///brand/hospital.png']) {
      expect(() => loadWhatsAppBranding(JSON.stringify([{ ...entry, welcomeImageUrl: url }]), config)).toThrow();
    }
    expect(() => loadWhatsAppBranding(JSON.stringify([entry]), undefined)).toThrow();
    expect(() => loadWhatsAppBranding(JSON.stringify([entry, entry]), config)).toThrow();
    expect(() => loadWhatsAppBranding(JSON.stringify([{ ...entry, facilityId: other }]), config)).toThrow();
  });
  it('restricts test connections to approved recipients and fails closed', () => {
    expect(testRecipientAllowed({}, '+919999887766')).toBe(true);
    expect(testRecipientAllowed({testMode:true}, '+919999887766')).toBe(false);
    expect(testRecipientAllowed({testMode:true,testRecipients:['+919999887766']}, '+919999887766')).toBe(true);
    expect(testRecipientAllowed({testMode:true,testRecipients:['+919999887766']}, '+919999887767')).toBe(false);
  });
  it('preserves consent text in captions and keeps long prompts intact as text', () => {
    const body = 'Welcome to Swastikaa Hospital. Reply YES to receive messages about this booking.';
    expect(bookingMessage(body, image)).toEqual({ type: 'image', image: { link: image, caption: body } });
    expect(bookingMessage(body)).toEqual({ type: 'text', text: { preview_url: false, body } });
    const long = 'a'.repeat(1025);
    expect(bookingMessage(long, image)).toEqual({ type: 'text', text: { preview_url: false, body: long } });
  });
});
