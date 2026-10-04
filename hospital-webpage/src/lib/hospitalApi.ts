const configuredApiBase = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL;

// An explicitly empty production value means "use this website's origin".
// Only fall back to localhost when the variable is absent during local development.
export const API_BASE = configuredApiBase === undefined
  ? 'http://127.0.0.1:8000'
  : configuredApiBase.replace(/\/+$/, '');
export const HOSPITAL_SLUG = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_HOSPITAL_SLUG || 'exora-demo';

export interface ApiBranch { id: string; slug: string; name: string; area: string; timezone: string; is_virtual: boolean }
export interface ApiDepartment { id: string; slug: string; name: string; tagline: string; description: string }
export interface ApiDoctor {
  id: string; slug: string; name: string; title: string; bio: string; experience_years: number;
  consultation_fee: number; accepts_virtual: boolean; image_url?: string;
  departments: ApiDepartment[]; branches: ApiBranch[];
}
export interface ApiSlot { doctor_id: string; branch_id: string; consultation_type: 'in_person' | 'virtual'; starts_at: string; ends_at: string }
export interface ApiHold extends ApiSlot { id: string; status: string; expires_at: string }
export interface ApiAppointment {
  id: string; confirmation_code: string; patient_name: string; patient_phone: string;
  patient_email?: string; reason?: string; status: string; origin_channel: string;
  created_at: string; reservation: ApiHold;
  patient_code?: string; patient_access_code?: string; patient_account_created: boolean;
}

export class HospitalApiError extends Error {}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Hospital-Slug': HOSPITAL_SLUG, ...(options?.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new HospitalApiError(body?.error?.message || `Hospital service returned ${response.status}.`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function identifier(prefix: string) {
  const value = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${value}`;
}

export function patientOwnerKey() {
  const key = 'avocado_patient_owner_key';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = identifier('browser');
  localStorage.setItem(key, created);
  return created;
}

export const hospitalApi = {
  doctor: (idOrSlug: string) => request<ApiDoctor>(`/api/v1/doctors/${encodeURIComponent(idOrSlug)}`),
  availability: (doctorId: string, branchId: string, startDate: string, endDate: string, consultationType: string) =>
    request<{ slots: ApiSlot[]; timezone: string }>(`/api/v1/availability?${new URLSearchParams({
      doctor_id: doctorId, branch_id: branchId, start_date: startDate, end_date: endDate, consultation_type: consultationType,
    })}`),
  hold: (slot: ApiSlot, ownerKey: string) => request<ApiHold>('/api/v1/slot-holds', {
    method: 'POST', body: JSON.stringify({ ...slot, owner_key: ownerKey, idempotency_key: identifier('web-hold') }),
  }),
  releaseHold: (holdId: string, ownerKey: string) => request<void>(`/api/v1/slot-holds/${holdId}?${new URLSearchParams({ owner_key: ownerKey })}`, { method: 'DELETE' }),
  book: (holdId: string, ownerKey: string, patient: { name: string; phone: string; email?: string; reason?: string }) =>
    request<ApiAppointment>('/api/v1/appointments', {
      method: 'POST', body: JSON.stringify({
        hold_id: holdId, owner_key: ownerKey, patient_name: patient.name, patient_phone: patient.phone,
        patient_email: patient.email || null, reason: patient.reason || null, origin_channel: 'web',
        idempotency_key: identifier('web-booking'),
      }),
    }),
};
