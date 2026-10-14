export type VisitMode = 'in_person' | 'virtual';
export type PublicDoctor = { roleTitle?: string | null; slug: string; name: string; specialty: string | null; acceptsVirtual: boolean; websiteIds: string[]; qualifications: string[]; bio: string | null; experienceYears: number | null; languages: string[]; photoUrl: string | null; departments: string[] };
export type PublicCatalog = { addressLine1?: string; addressLine2?: string; phone?: string; siteSlug: string; clinicName: string; timezone: string; today: string; bookingUntil: string; doctors: PublicDoctor[]; websiteBranchId?: string | null };
export type PublicSlot = { startsAt: string; endsAt: string; feeMinor: number; slotToken: string };
export type UnpricedSlot = { startsAt:string; endsAt:string; serviceName:string };
export type SlotsResponse = { timezone: string; slots: PublicSlot[]; unpricedSlots?:UnpricedSlot[] };
export type BookingPayload = { slotToken: string; name: string; phone: string; email?: string; reason?: string };
export type BookingReceipt = { appointmentId: string; confirmationCode: string; status: 'confirmed'; startsAt: string; endsAt: string; feeMinor: number; clinicName: string; doctorName: string; visitMode: VisitMode; timezone: string };
export type BookingContext = { slot: PublicSlot; clinicName: string; doctorName: string; mode: VisitMode; timezone: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const instant = (value: unknown): value is string => text(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
export const plainDate = (value: unknown): value is string => { if (!text(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; };
const zone = (value: unknown): value is string => { if (!text(value)) return false; try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } };
export const addBookingDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export function bookingDay(instantValue: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instantValue));
  const part = (name: string) => parts.find((p) => p.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export class PublicBookingError extends Error { constructor(message: string, public unknownOutcome = false, public status = 0) { super(message); } }
const invalid = () => new PublicBookingError('The hospital response could not be verified. Please try loading it again.');
export function decodeCatalog(value: unknown, site: string): PublicCatalog {
  if (!record(value) || value.siteSlug !== site || !text(value.clinicName) || !zone(value.timezone) || !plainDate(value.today) || !plainDate(value.bookingUntil) || value.bookingUntil < value.today || !Array.isArray(value.doctors)) throw invalid();
  const slugs = new Set<string>();
  for (const doctor of value.doctors) {
    if (!record(doctor) || !text(doctor.slug) || !/^[a-z0-9][a-z0-9-]*$/.test(doctor.slug) || !text(doctor.name) || !(doctor.specialty === null || text(doctor.specialty)) || typeof doctor.acceptsVirtual !== 'boolean' || !(doctor.roleTitle === undefined || doctor.roleTitle === null || text(doctor.roleTitle)) || !Array.isArray(doctor.qualifications) || doctor.qualifications.some((v) => !text(v)) || !Array.isArray(doctor.languages) || doctor.languages.some((v) => !text(v)) || !Array.isArray(doctor.departments) || doctor.departments.some((v) => !text(v)) || !(doctor.bio === null || text(doctor.bio)) || !(doctor.experienceYears === null || integer(doctor.experienceYears)) || !(doctor.photoUrl === null || (text(doctor.photoUrl) && (/^\/(?!\/)/.test(doctor.photoUrl) || /^https:\/\//.test(doctor.photoUrl)))) || !Array.isArray(doctor.websiteIds) || doctor.websiteIds.some((id) => !text(id)) || slugs.has(doctor.slug)) throw invalid();
    slugs.add(doctor.slug);
  }
  return value as PublicCatalog;
}
export function exactWebsiteDoctor(doctors: PublicDoctor[], requested?: string) {
  if (!requested) return undefined;
  const matches = doctors.filter((doctor) => doctor.slug === requested || doctor.websiteIds.includes(requested));
  return matches.length === 1 ? matches[0] : undefined;
}
function validSlot(value: unknown): value is PublicSlot {
  return record(value) && instant(value.startsAt) && instant(value.endsAt) && Date.parse(value.endsAt) > Date.parse(value.startsAt) && integer(value.feeMinor) && text(value.slotToken);
}
export function decodeSlots(value: unknown, timezone: string, from: string, to: string): SlotsResponse {
  if (!record(value) || value.timezone !== timezone || !Array.isArray(value.slots) || value.slots.some((slot) => !validSlot(slot) || bookingDay(slot.startsAt, timezone) < from || bookingDay(slot.startsAt, timezone) > to)) throw invalid();
  if(value.unpricedSlots !== undefined && (!Array.isArray(value.unpricedSlots) || value.unpricedSlots.some(slot=>!record(slot)||!instant(slot.startsAt)||!instant(slot.endsAt)||Date.parse(slot.endsAt)<=Date.parse(slot.startsAt)||!text(slot.serviceName)||bookingDay(slot.startsAt,timezone)<from||bookingDay(slot.startsAt,timezone)>to)))throw invalid();
  const tokens = value.slots.map((slot) => (slot as PublicSlot).slotToken);
  if (new Set(tokens).size !== tokens.length) throw invalid();
  return value as SlotsResponse;
}
export function normalizeBookingPhone(value: string) {
  const normalized = value.replace(/[\s()-]/g, '');
  if (/^[6-9]\d{9}$/.test(normalized)) return `+91${normalized}`;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}
function validPayload(value: unknown): value is BookingPayload {
  return record(value) && text(value.slotToken) && typeof value.name === 'string' && value.name.trim().length >= 2 && value.name.length <= 100 && typeof value.phone === 'string' && normalizeBookingPhone(value.phone) === value.phone && (value.email === undefined || (typeof value.email === 'string' && value.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))) && (value.reason === undefined || (typeof value.reason === 'string' && value.reason.length <= 500)) && Object.keys(value).every((key) => ['slotToken', 'name', 'phone', 'email', 'reason'].includes(key));
}
export function decodeReceipt(value: unknown, context?: BookingContext): BookingReceipt {
  if (!record(value) || typeof value.appointmentId !== 'string' || !uuid.test(value.appointmentId) || !text(value.confirmationCode) || value.status !== 'confirmed' || !instant(value.startsAt) || !instant(value.endsAt) || Date.parse(value.endsAt) <= Date.parse(value.startsAt) || !integer(value.feeMinor) || !text(value.clinicName) || !text(value.doctorName) || !['in_person', 'virtual'].includes(String(value.visitMode)) || !zone(value.timezone)) throw new PublicBookingError('We could not verify the booking receipt. Recover the original request before trying another booking.', true);
  if (context && (Date.parse(value.startsAt) !== Date.parse(context.slot.startsAt) || Date.parse(value.endsAt) !== Date.parse(context.slot.endsAt) || value.feeMinor !== context.slot.feeMinor || value.visitMode !== context.mode || value.timezone !== context.timezone || value.doctorName !== context.doctorName || value.clinicName !== context.clinicName)) throw new PublicBookingError('The booking receipt does not match the reviewed appointment. Recover the original request.', true);
  return value as BookingReceipt;
}
export function publicBookingRoot(site: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(site)) throw new PublicBookingError('The hospital booking site is not configured correctly.');
  return `/public/v1/booking/${site}`;
}
async function transport(path: string, options: RequestInit = {}) {
  const writing = options.method === 'POST';
  let response: Response;
  try { response = await fetch(path, { ...options, credentials: 'omit', signal: options.signal ?? AbortSignal.timeout(20000) }); }
  catch (error) { if (!writing && error instanceof Error && error.name === 'AbortError') throw error; throw new PublicBookingError(writing ? 'We could not confirm whether your appointment was booked. Recover the original request.' : 'Could not reach hospital booking. Please try again.', writing); }
  if (!response.ok) {
    const message = response.status === 409 ? 'This time is no longer available. Choose another published time.' : response.status === 429 ? 'Too many requests. Please wait a little before trying again.' : response.status === 404 ? 'Online booking is not available for this hospital.' : response.status === 400 || response.status === 422 ? 'The booking details or selected time are no longer valid. Review them and try again.' : 'Hospital booking is temporarily unavailable. Please try again.';
    throw new PublicBookingError(message, writing && response.status >= 500, response.status);
  }
  try { return await response.json() as unknown; }
  catch { throw new PublicBookingError(writing ? 'We could not verify the booking receipt. Recover the original request.' : 'The hospital response could not be verified.', writing); }
}
export function createPublicBookingApi(site = import.meta.env.VITE_HMS_BOOKING_SITE || 'sri-lakshmi') {
  const root = publicBookingRoot(site);
  return {
    site,
    catalog: async (signal?: AbortSignal) => decodeCatalog(await transport(`${root}/catalog`, { signal }), site),
    slots: async (doctor: string, mode: VisitMode, from: string, to: string, timezone: string, signal?: AbortSignal) => {
      if (!plainDate(from) || !plainDate(to) || from > to || to > addBookingDays(from, 13)) throw invalid();
      const params = new URLSearchParams({ doctor, mode, from, to });
      return decodeSlots(await transport(`${root}/slots?${params}`, { signal }), timezone, from, to);
    },
    book: async (body: BookingPayload, key: string, context: BookingContext) => {
      if (!validPayload(body) || !uuid.test(key)) throw new PublicBookingError('Review the patient name and phone number before booking.');
      return decodeReceipt(await transport(`${root}/appointments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) }), context);
    },
  };
}
export type PublicBookingApi = ReturnType<typeof createPublicBookingApi>;
type StoredIntent = { kind: 'pending'; key: string; payload: BookingPayload; context: BookingContext } | { kind: 'confirmed'; receipt: BookingReceipt };
export class PublicBookingIntent {
  busy = false;
  unknown = false;
  receipt: BookingReceipt | null = null;
  error = '';
  private intent: Extract<StoredIntent, {kind: 'pending'}> | null = null;
  private storageKey: string;
  constructor(private api: PublicBookingApi, private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = sessionStorage) {
    this.storageKey = `hms-public-booking:${api.site}:v1`;
    try {
      const raw = storage.getItem(this.storageKey);
      if (!raw) return;
      const stored: unknown = JSON.parse(raw);
      if (record(stored) && stored.kind === 'confirmed') this.receipt = decodeReceipt(stored.receipt);
      else if (record(stored) && stored.kind === 'pending' && typeof stored.key === 'string' && uuid.test(stored.key) && validPayload(stored.payload) && record(stored.context) && validSlot(stored.context.slot) && stored.payload.slotToken === stored.context.slot.slotToken && text(stored.context.clinicName) && text(stored.context.doctorName) && zone(stored.context.timezone) && ['in_person', 'virtual'].includes(String(stored.context.mode))) { this.intent = stored as Extract<StoredIntent, {kind: 'pending'}>; this.unknown = true; }
      else throw new Error('invalid draft');
    } catch { this.error = 'The saved booking request could not be read safely. Contact reception before booking again.'; this.unknown = true; }
  }
  get context() { return this.intent?.context ?? null; }
  async execute(payload: BookingPayload, context: BookingContext) {
    if (this.busy || this.unknown || this.receipt) throw new PublicBookingError('Recover the original request before starting another booking.');
    if (!validPayload(payload)) throw new PublicBookingError('Review the patient name and phone number before booking.');
    this.intent = { kind: 'pending', key: crypto.randomUUID(), payload: structuredClone(payload), context: structuredClone(context) };
    try { this.storage.setItem(this.storageKey, JSON.stringify(this.intent)); } catch { this.intent = null; throw new PublicBookingError('This browser cannot keep a recovery request. Enable session storage before booking online.'); }
    return this.send();
  }
  async recover() { if (!this.intent || !this.unknown || this.busy) throw new PublicBookingError('Contact reception to reconcile the original booking.'); return this.send(); }
  private async send() {
    const wasUnknown = this.unknown;
    this.busy = true;
    this.error = '';
    try {
      const receipt = await this.api.book(this.intent!.payload, this.intent!.key, this.intent!.context);
      try { this.storage.setItem(this.storageKey, JSON.stringify({ kind: 'confirmed', receipt })); } catch { throw new PublicBookingError('The appointment receipt could not be kept safely. Recover the original request.', true); }
      this.receipt = receipt; this.unknown = false; this.intent = null;
      return receipt;
    } catch (error) {
      this.unknown = wasUnknown || !(error instanceof PublicBookingError) || error.unknownOutcome;
      this.error = error instanceof Error ? error.message : 'Could not complete booking.';
      if (!this.unknown) { this.storage.removeItem(this.storageKey); this.intent = null; }
      throw error;
    } finally { this.busy = false; }
  }
  reset() { if (this.busy || this.unknown) throw new PublicBookingError('Recover the original request first.'); this.storage.removeItem(this.storageKey); this.receipt = null; this.error = ''; }
}
