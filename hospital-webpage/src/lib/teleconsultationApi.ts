import { API_BASE, HospitalApiError } from './hospitalApi';

export interface Teleconsultation {
  id: string; appointment_id: string; status: 'scheduled' | 'waiting' | 'ready' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  consent_version: string; consent_accepted: boolean; doctor?: { id: string; name: string };
  patient?: { id: string; name: string; phone: string };
  starts_at: string; ends_at: string; appointment_status: string; version: number;
  clinical_capabilities: Record<string, string | null>;
}
export interface AppointmentSummary { id: string; confirmation_code?: string; status?: string; consultation_type?: string; starts_at: string; ends_at: string; doctor?: { name: string }; consent_accepted?: boolean }
export interface JoinGrant { domain: string; room_name: string; jwt: string; expires_at: string; role: string; display_name: string }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...options, credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new HospitalApiError(body?.error?.message || `Request failed (${response.status}).`);
  return body as T;
}

export const teleconsultationApi = {
  patientAppointmentsAll: () => request<AppointmentSummary[]>('/api/v1/me/appointments'),
  patientAppointments: () => request<AppointmentSummary[]>('/api/v1/me/appointments?consultation_type=virtual'),
  patientView: (id: string) => request<Teleconsultation>(`/api/v1/me/appointments/${id}/teleconsultation`),
  consent: (id: string, version: string) => request<Teleconsultation>(`/api/v1/me/appointments/${id}/teleconsultation/consent`, { method: 'POST', body: JSON.stringify({ document_version: version, accepted: true }) }),
  checkIn: (id: string) => request<Teleconsultation>(`/api/v1/me/appointments/${id}/teleconsultation/check-in`, { method: 'POST' }),
  patientGrant: (id: string) => request<JoinGrant>(`/api/v1/me/appointments/${id}/teleconsultation/join-grant`, { method: 'POST' }),
  doctorAppointments: () => request<Teleconsultation[]>('/api/v1/doctor/appointments'),
  doctorView: (id: string) => request<Teleconsultation>(`/api/v1/doctor/appointments/${id}/teleconsultation`),
  start: (id: string) => request<Teleconsultation>(`/api/v1/doctor/appointments/${id}/teleconsultation/start`, { method: 'POST' }),
  doctorGrant: (id: string) => request<JoinGrant>(`/api/v1/doctor/appointments/${id}/teleconsultation/join-grant`, { method: 'POST' }),
  end: (id: string) => request<Teleconsultation>(`/api/v1/doctor/appointments/${id}/teleconsultation/end`, { method: 'POST', body: '{}' }),
};
