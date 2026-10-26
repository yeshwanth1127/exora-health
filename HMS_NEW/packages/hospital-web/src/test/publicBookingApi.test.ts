import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicBookingApi, decodeCatalog, decodeSlots, exactWebsiteDoctor, PublicBookingIntent, normalizeBookingPhone, type BookingContext } from '../lib/publicBookingApi';
const doctor = { slug: 'asha-rao', name: 'Dr Asha Rao', specialty: 'Medicine', acceptsVirtual: true, websiteIds: ['doc-1'], qualifications: [], bio: null, experienceYears: null, languages: [], photoUrl: null, departments: ['Medicine'] };
const catalog = { siteSlug: 'ndr-hospital', clinicName: 'NDR Hospital', timezone: 'Asia/Kolkata', today: '2026-10-14', bookingUntil: '2026-11-14', doctors: [doctor] };
const slot = { startsAt: '2026-10-14T03:30:00Z', endsAt: '2026-10-14T03:45:00Z', feeMinor: 80000, slotToken: 'signed-slot' };
const context: BookingContext = { slot, clinicName: catalog.clinicName, doctorName: doctor.name, mode: 'in_person', timezone: catalog.timezone };
const receipt = { appointmentId: '00000000-0000-4000-8000-000000000001', confirmationCode: 'HMS-ABC123', status: 'confirmed', ...slot, clinicName: catalog.clinicName, doctorName: doctor.name, visitMode: 'in_person', timezone: catalog.timezone };
const payload = { slotToken: slot.slotToken, name: 'Alex Example', phone: '+919876543210' };
beforeEach(() => sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());
describe('Public HMS booking transport', () => {
  it('uses same-origin public routes with no cookies, staff token, or contact data in URLs', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => { calls.push({ url, init }); return Response.json(url.endsWith('/catalog') ? catalog : url.includes('/slots?') ? { timezone: catalog.timezone, slots: [slot] } : receipt); }));
    const api = createPublicBookingApi('ndr-hospital');
    await api.catalog(); await api.slots(doctor.slug, 'in_person', catalog.today, '2026-10-20', catalog.timezone);
    await api.book(payload, crypto.randomUUID(), context);
    expect(calls.every(({ url, init }) => url.startsWith('/public/v1/booking/ndr-hospital/') && init?.credentials === 'omit')).toBe(true);
    expect(calls[2].url).not.toContain(payload.phone);
    expect(new Headers(calls[2].init?.headers).has('Authorization')).toBe(false);
    expect(JSON.parse(String(calls[2].init?.body))).toEqual(payload);
  });
  it('maps only exact unambiguous website IDs or slugs, never names or a first-doctor fallback', () => {
    expect(exactWebsiteDoctor([doctor], 'doc-1')).toBe(doctor);
    expect(exactWebsiteDoctor([doctor], doctor.slug)).toBe(doctor);
    expect(exactWebsiteDoctor([doctor], doctor.name)).toBeUndefined();
    expect(exactWebsiteDoctor([doctor], 'DOC-1')).toBeUndefined();
    expect(exactWebsiteDoctor([doctor, { ...doctor, slug: 'another-doctor' }], 'doc-1')).toBeUndefined();
  });
  it('rejects wrong clinic, timezone, fee, malformed roster and dates outside the requested range', () => {
    expect(() => decodeCatalog({ ...catalog, siteSlug: 'other-clinic' }, 'ndr-hospital')).toThrow();
    expect(() => decodeCatalog({ ...catalog, doctors: [{ ...doctor, acceptsVirtual: 'yes' }] }, 'ndr-hospital')).toThrow();
    expect(() => decodeSlots({ timezone: 'UTC', slots: [slot] }, catalog.timezone, catalog.today, '2026-10-20')).toThrow();
    expect(() => decodeSlots({ timezone: catalog.timezone, slots: [{ ...slot, feeMinor: -1 }] }, catalog.timezone, catalog.today, '2026-10-20')).toThrow();
    expect(() => decodeSlots({ timezone: catalog.timezone, slots: [slot] }, catalog.timezone, '2026-10-15', '2026-10-20')).toThrow();
    expect(() => decodeSlots({ timezone: catalog.timezone, slots: [slot, slot] }, catalog.timezone, catalog.today, '2026-10-20')).toThrow();
  });
  it('normalizes Indian mobiles and rejects invalid public contact numbers', () => {
    expect(normalizeBookingPhone('98765 43210')).toBe('+919876543210');
    expect(normalizeBookingPhone('+44 7700 900123')).toBe('+447700900123');
    expect(normalizeBookingPhone('123')).toBeNull();
    expect(normalizeBookingPhone('81383838383838')).toBeNull();
  });
  it('persists an uncertain frozen request across remount and recovers with exactly the original key/payload', async () => {
    const calls: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => { calls.push({ key: new Headers(init?.headers).get('Idempotency-Key'), body: JSON.parse(String(init?.body)) }); if (calls.length === 1) throw Error('response lost after commit'); return Response.json(receipt); }));
    const api = createPublicBookingApi('ndr-hospital');
    const machine = new PublicBookingIntent(api);
    const original = { ...payload };
    await expect(machine.execute(original, context)).rejects.toThrow();
    original.name = 'Changed after request';
    expect(machine.unknown).toBe(true);
    await expect(machine.execute(original, context)).rejects.toThrow(/Recover/);
    const remounted = new PublicBookingIntent(api);
    expect(remounted.unknown).toBe(true);
    await remounted.recover();
    expect(calls[0]).toEqual(calls[1]);
    expect(calls[1].body.name).toBe('Alex Example');
    expect(remounted.receipt?.confirmationCode).toBe('HMS-ABC123');
    expect(new PublicBookingIntent(api).receipt?.confirmationCode).toBe('HMS-ABC123');
  });
  it('malformed, wrong-mode or mismatched receipts are uncertain and cannot create a second intent', async () => {
    for (const bad of [{ ...receipt, status: 'pending' }, { ...receipt, feeMinor: 1 }, { ...receipt, visitMode: 'virtual' }, { ...receipt, appointmentId: 'invalid' }]) {
      sessionStorage.clear();
      vi.stubGlobal('fetch', vi.fn(async () => Response.json(bad)));
      const machine = new PublicBookingIntent(createPublicBookingApi('ndr-hospital'));
      await expect(machine.execute(payload, context)).rejects.toThrow();
      expect(machine.unknown).toBe(true);
      expect(machine.receipt).toBeNull();
      await expect(machine.execute(payload, context)).rejects.toThrow(/Recover/);
    }
  });
  it('first known conflict allows selection again, while a recovery refusal preserves original uncertainty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 409 })));
    const api = createPublicBookingApi('ndr-hospital');
    const first = new PublicBookingIntent(api);
    await expect(first.execute(payload, context)).rejects.toThrow(/no longer available/);
    expect(first.unknown).toBe(false);
    expect(sessionStorage.length).toBe(0);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 503 })));
    const uncertain = new PublicBookingIntent(api);
    await expect(uncertain.execute(payload, context)).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 409 })));
    await expect(uncertain.recover()).rejects.toThrow();
    expect(uncertain.unknown).toBe(true);
    expect(sessionStorage.length).toBe(1);
  });
  it('never sends a mutation if this browser cannot keep the recovery draft', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const storage = { getItem: () => null, setItem: () => { throw Error('disabled'); }, removeItem: () => {} };
    const machine = new PublicBookingIntent(createPublicBookingApi('ndr-hospital'), storage);
    await expect(machine.execute(payload, context)).rejects.toThrow(/session storage/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
