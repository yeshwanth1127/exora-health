import { API_BASE, HospitalApiError } from './hospitalApi';

export interface CurrentActor {
  user_id: string; membership_id: string; hospital_id: string; hospital_name: string;
  role: 'patient' | 'doctor' | 'hospital_admin' | string; display_name: string; patient_id?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...options, credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new HospitalApiError(body?.error?.message || `Request failed (${response.status}).`);
  return body as T;
}

export const authApi = {
  me: () => request<CurrentActor>('/api/v1/auth/me'),
  login: (email: string, password: string) => request<CurrentActor>('/api/v1/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  }),
  patientCodeLogin: (patientCode: string, accessCode: string) => request<CurrentActor>('/api/v1/auth/patient-code-login', {
    method: 'POST', body: JSON.stringify({ patient_code: patientCode, access_code: accessCode }),
  }),
  logout: () => request<void>('/api/v1/auth/logout', { method: 'POST' }),
};
