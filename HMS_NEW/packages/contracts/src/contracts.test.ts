import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AppointmentMessagesResponseSchema, ContactPointCreateSchema, MessagingConsentCreateSchema } from './index.ts';
describe('shared communications contracts', () => {
  it('rejects actor injection, mixed identity owners and informal phone numbers', () => {
    const input = { facilityId: randomUUID(), channel: 'whatsapp', address: '+919876543210', patientId: randomUUID() };
    expect(ContactPointCreateSchema.safeParse(input).success).toBe(true);
    expect(ContactPointCreateSchema.safeParse({ ...input, createdBy: randomUUID() }).success).toBe(false);
    expect(ContactPointCreateSchema.safeParse({ ...input, bookingPartyId: randomUUID() }).success).toBe(false);
    expect(ContactPointCreateSchema.safeParse({ ...input, address: '9876543210' }).success).toBe(false);
  });
  it('requires affirmative evidence for opt-in and validates history dates before rendering', () => {
    const consent = { purpose: 'care', action: 'opt_in', source: 'staff', evidence: 'Patient requested reminders' };
    expect(MessagingConsentCreateSchema.safeParse(consent).success).toBe(false);
    expect(MessagingConsentCreateSchema.safeParse({ ...consent, explicitOptIn: true }).success).toBe(true);
    expect(
      AppointmentMessagesResponseSchema.safeParse({
        items: [
          {
            id: randomUUID(),
            appointmentId: randomUUID(),
            kind: 'day_before',
            status: 'scheduled',
            dueAt: 'tomorrow',
            reason: null,
            message: null,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
