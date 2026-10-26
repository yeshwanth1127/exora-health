import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, Clock3, LogOut, ShieldCheck, Stethoscope, UserRound, Users } from 'lucide-react';
import { authApi, CurrentActor } from '../../lib/auth';
import { API_BASE, HospitalApiError } from '../../lib/hospitalApi';
import { teleconsultationApi, AppointmentSummary } from '../../lib/teleconsultationApi';

type PortalRole = 'patient' | 'doctor' | 'hospital_admin';

const roles: Array<{ value: PortalRole; label: string; description: string; icon: typeof UserRound }> = [
  { value: 'patient', label: 'Patient', description: 'Appointments, visit details, and Virtual OPD', icon: UserRound },
  { value: 'doctor', label: 'Doctor', description: 'All assigned clinic and virtual appointments', icon: Stethoscope },
  { value: 'hospital_admin', label: 'Staff / administrator', description: 'Hospital operations, schedules, doctors, and reporting', icon: Users },
];

const demoAccounts: Record<PortalRole, { email: string; password: string }> = {
  patient: { email: 'patient@example.com', password: 'patient-demo-password' },
  doctor: { email: 'doctor@example.com', password: 'doctor-demo-password' },
  hospital_admin: { email: 'admin@example.com', password: 'change-me-in-production' },
};

interface DoctorAppointment {
  id: string;
  confirmation_code: string;
  patient_name: string;
  patient_phone: string;
  patient_email?: string;
  reason?: string;
  status: string;
  origin_channel: string;
  consultation_type: 'in_person' | 'virtual';
  starts_at: string;
  ends_at: string;
  branch?: { id: string; name: string; area: string };
  teleconsultation_status?: string;
}

async function doctorAppointments(): Promise<DoctorAppointment[]> {
  const response = await fetch(`${API_BASE}/api/v1/doctor/dashboard/appointments`, { credentials: 'include' });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new HospitalApiError(body?.error?.message || `Request failed (${response.status}).`);
  return body;
}

export function RoleAccessPortal() {
  const [selectedRole, setSelectedRole] = useState<PortalRole>('patient');
  const [email, setEmail] = useState(demoAccounts.patient.email);
  const [password, setPassword] = useState(demoAccounts.patient.password);
  const [actor, setActor] = useState<CurrentActor | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    authApi.me().then(setActor).catch(() => undefined).finally(() => setChecking(false));
  }, []);

  const chooseRole = (role: PortalRole) => {
    setSelectedRole(role);
    setEmail(demoAccounts[role].email);
    setPassword(demoAccounts[role].password);
    setError('');
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const current = selectedRole === 'patient' && email.trim().toUpperCase().startsWith('EXO-P-')
        ? await authApi.patientCodeLogin(email, password)
        : await authApi.login(email, password);
      if (current.role !== selectedRole) {
        await authApi.logout();
        throw new Error(`This account is registered as ${roleLabel(current.role)}, not ${roleLabel(selectedRole)}.`);
      }
      setActor(current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await authApi.logout().catch(() => undefined);
    setActor(null);
  };

  if (checking) return <PortalShell><div className="text-sm text-[#65736b]">Checking your session…</div></PortalShell>;
  if (actor?.role === 'doctor') return <DoctorDashboard actor={actor} onLogout={logout} />;
  if (actor?.role === 'patient') return <PatientDashboard actor={actor} onLogout={logout} />;
  if (actor?.role === 'hospital_admin') return <StaffDashboard actor={actor} onLogout={logout} />;

  return <PortalShell>
    <div className="w-full max-w-3xl">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#47705b]">Exora HMS</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight text-[#183429]">Choose your portal</h1>
        <p className="mt-3 text-[#65756d]">Select your role to use the correct login and dashboard.</p>
      </div>

      <div className="mt-8 grid sm:grid-cols-3 gap-3">
        {roles.map(({ value, label, description, icon: Icon }) => <button key={value} type="button" onClick={() => chooseRole(value)} className={`rounded-2xl border p-4 text-left transition ${selectedRole === value ? 'border-[#1c6143] bg-[#edf5ef] shadow-sm' : 'border-[#dce4de] bg-white hover:border-[#9eb3a5]'}`}>
          <Icon className={`size-6 ${selectedRole === value ? 'text-[#1c6143]' : 'text-[#78877f]'}`} />
          <span className="mt-3 block font-semibold">{label}</span>
          <span className="mt-1 block text-xs leading-5 text-[#708078]">{description}</span>
        </button>)}
      </div>

      <form onSubmit={login} className="mt-5 rounded-3xl border border-[#dce4de] bg-white p-6 sm:p-8 shadow-[0_18px_60px_rgba(28,67,48,.08)]">
        <div className="flex items-center gap-3"><ShieldCheck className="size-6 text-[#1c6143]"/><div><h2 className="text-xl font-semibold">{roleLabel(selectedRole)} login</h2><p className="text-sm text-[#718078]">Use your hospital-issued account.</p></div></div>
        <label className="mt-6 block text-sm font-medium">{selectedRole === 'patient' ? 'Email or patient code' : 'Email'}<input className="mt-2 h-12 w-full rounded-xl border border-[#d8e1da] px-4 outline-none focus:border-[#3d7859]" type={selectedRole === 'patient' ? 'text' : 'email'} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
        <label className="mt-4 block text-sm font-medium">{selectedRole === 'patient' ? 'Password or access code' : 'Password'}<input className="mt-2 h-12 w-full rounded-xl border border-[#d8e1da] px-4 outline-none focus:border-[#3d7859]" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <button disabled={loading} className="mt-5 h-12 w-full rounded-xl bg-[#174b35] font-semibold text-white hover:bg-[#103b29] disabled:opacity-60">{loading ? 'Signing in…' : `Continue as ${roleLabel(selectedRole)}`}</button>
        <p className="mt-4 text-center text-xs text-[#829087]">Demo credentials are pre-filled for the selected role.</p>
      </form>
    </div>
  </PortalShell>;
}

function DoctorDashboard({ actor, onLogout }: { actor: CurrentActor; onLogout: () => Promise<void> }) {
  const [items, setItems] = useState<DoctorAppointment[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { doctorAppointments().then(setItems).catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load appointments.')); }, []);
  const virtualCount = items.filter((item) => item.consultation_type === 'virtual').length;
  const inPersonCount = items.length - virtualCount;
  return <DashboardShell actor={actor} title="Doctor dashboard" subtitle="Your complete appointment worklist" onLogout={onLogout}>
    <div className="grid sm:grid-cols-3 gap-4"><Metric label="All appointments" value={items.length}/><Metric label="In person" value={inPersonCount}/><Metric label="Virtual OPD" value={virtualCount}/></div>
    {error && <p className="mt-5 rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    <section className="mt-6 overflow-hidden rounded-2xl border border-[#dce4de] bg-white"><div className="border-b p-5"><h2 className="font-semibold">Assigned appointments</h2><p className="mt-1 text-sm text-[#748179]">Clinic and online visits appear together.</p></div>
      <div className="divide-y divide-[#edf1ed]">{items.map((item) => <article key={item.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="lg:w-52"><p className="font-semibold">{item.patient_name}</p><p className="text-xs text-[#77857d]">{item.patient_phone}</p></div>
        <div className="flex-1"><p className="text-sm font-medium">{new Date(item.starts_at).toLocaleString()}</p><p className="mt-1 text-xs text-[#77857d]">{item.branch?.name || 'Hospital'} · {item.reason || 'Consultation'}</p></div>
        <div className="flex flex-wrap items-center gap-2"><Badge>{item.consultation_type === 'virtual' ? 'Virtual OPD' : 'In person'}</Badge><Badge>{item.status}</Badge>{item.consultation_type === 'virtual' && <a href="/virtual-opd" className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#174b35] px-3 text-xs font-semibold text-white">Open consultation <ChevronRight className="size-3"/></a>}</div>
      </article>)}{!items.length && <div className="p-8 text-center text-sm text-[#77857d]">No appointments are currently assigned to you.</div>}</div>
    </section>
  </DashboardShell>;
}

function PatientDashboard({ actor, onLogout }: { actor: CurrentActor; onLogout: () => Promise<void> }) {
  const [items, setItems] = useState<AppointmentSummary[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { teleconsultationApi.patientAppointmentsAll().then(setItems).catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load appointments.')); }, []);
  const upcoming = useMemo(() => items.filter((item) => !['completed', 'cancelled', 'no_show'].includes(item.status || '')), [items]);
  return <DashboardShell actor={actor} title="Patient dashboard" subtitle="Appointments and online consultations" onLogout={onLogout}>
    <div className="grid sm:grid-cols-2 gap-4"><Metric label="Appointments" value={items.length}/><Metric label="Upcoming" value={upcoming.length}/></div>
    {error && <p className="mt-5 rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    <section className="mt-6 rounded-2xl border border-[#dce4de] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">My appointments</h2><p className="mt-1 text-sm text-[#748179]">Your clinic and Virtual OPD bookings.</p></div><a href="/?page=doctors" className="text-sm font-semibold text-[#1b6042]">Book appointment</a></div>
      <div className="mt-5 divide-y divide-[#edf1ed]">{items.map((item) => <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3"><CalendarDays className="size-5 text-[#47705b]"/><div className="flex-1"><p className="font-medium">{new Date(item.starts_at).toLocaleString()}</p><p className="text-xs text-[#77857d]">{item.confirmation_code} · {item.consultation_type === 'virtual' ? 'Virtual OPD' : 'In-person appointment'}</p></div><Badge>{item.status || 'confirmed'}</Badge>{item.consultation_type === 'virtual' && <a href="/virtual-opd" className="text-sm font-semibold text-[#1b6042]">Open Virtual OPD</a>}</div>)}{!items.length && <p className="py-8 text-center text-sm text-[#77857d]">No appointments found.</p>}</div>
    </section>
  </DashboardShell>;
}

function StaffDashboard({ actor, onLogout }: { actor: CurrentActor; onLogout: () => Promise<void> }) {
  return <DashboardShell actor={actor} title="Staff portal" subtitle="Hospital administration and operations" onLogout={onLogout}>
    <div className="rounded-3xl border border-[#dce4de] bg-white p-8 text-center"><Users className="mx-auto size-10 text-[#1b6042]"/><h2 className="mt-4 text-2xl font-semibold">Hospital administration</h2><p className="mx-auto mt-2 max-w-lg text-sm text-[#718078]">Manage every appointment, doctor, schedule, branch, department, and voice operation.</p><a href="/admin" className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-[#174b35] px-6 font-semibold text-white">Open administration dashboard <ChevronRight className="size-4"/></a></div>
  </DashboardShell>;
}

function PortalShell({ children }: { children: React.ReactNode }) { return <div className="min-h-screen bg-[#f4f6f2] text-[#18261f]"><header className="h-20 border-b bg-white px-5 sm:px-10 flex items-center justify-between"><a href="/" className="font-serif-logo text-3xl font-bold text-[#17372b]">avocado</a><a href="/" className="text-sm font-semibold text-[#315b41]">Back to website</a></header><main className="min-h-[calc(100vh-5rem)] px-5 py-10 sm:py-14 flex justify-center items-start">{children}</main></div>; }

function DashboardShell({ actor, title, subtitle, onLogout, children }: { actor: CurrentActor; title: string; subtitle: string; onLogout: () => Promise<void>; children: React.ReactNode }) { return <div className="min-h-screen bg-[#f4f6f2] text-[#18261f]"><header className="border-b bg-white px-5 sm:px-10 py-4 flex items-center justify-between gap-4"><a href="/" className="font-serif-logo text-2xl font-bold text-[#17372b]">avocado</a><div className="flex items-center gap-3"><div className="hidden sm:block text-right"><p className="text-sm font-semibold">{actor.display_name}</p><p className="text-xs text-[#78867e]">{roleLabel(actor.role)}</p></div><button onClick={() => void onLogout()} className="size-10 grid place-items-center rounded-xl border bg-white" title="Sign out"><LogOut className="size-4"/></button></div></header><main className="mx-auto max-w-7xl p-5 sm:p-8"><div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#4d735e]">{actor.hospital_name}</p><h1 className="mt-2 text-3xl font-semibold">{title}</h1><p className="mt-1 text-[#718078]">{subtitle}</p></div>{children}</main></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-[#dce4de] bg-white p-5"><div className="flex items-center gap-2 text-sm text-[#6f7d75]"><Clock3 className="size-4"/>{label}</div><p className="mt-3 text-3xl font-semibold">{value}</p></div>; }
function Badge({ children }: { children: React.ReactNode }) { return <span className="inline-flex rounded-full bg-[#edf3ee] px-3 py-1 text-xs font-semibold capitalize text-[#3d604c]">{String(children).replace('_', ' ')}</span>; }
function roleLabel(role: string) { return role === 'hospital_admin' ? 'Staff / administrator' : role.charAt(0).toUpperCase() + role.slice(1); }
