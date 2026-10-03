import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Building2, CalendarDays, CheckCircle2, Clock3, IndianRupee,
  LayoutDashboard, LogOut, Menu, Plus, RefreshCw, Search, ShieldCheck,
  Mic2, Stethoscope, Trash2, TrendingUp, Users, Video, X,
} from 'lucide-react';

const API_BASE = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL || 'http://127.0.0.1:8000';

type Section = 'overview' | 'appointments' | 'virtual-opd' | 'doctors' | 'schedules' | 'voice' | 'catalogue' | 'operations';

interface Appointment {
  id: string;
  confirmation_code: string;
  patient_name: string;
  patient_phone: string;
  patient_email?: string;
  reason?: string;
  status: string;
  origin_channel: string;
  created_at: string;
  starts_at: string;
  ends_at: string;
  consultation_type: string;
  doctor?: { id: string; name: string };
  branch?: { id: string; name: string; area: string };
  teleconsultation_status?: string;
  consent_accepted?: boolean;
}

interface Analytics {
  generated_at: string;
  summary: {
    appointments_total: number;
    appointments_confirmed: number;
    appointments_cancelled: number;
    appointments_upcoming: number;
    active_holds: number;
    active_doctors: number;
    schedule_rules: number;
    pending_notifications: number;
    conversion_rate: number;
    voice_sessions_total: number;
    voice_bookings: number;
  };
  by_status: { label: string; value: number }[];
  by_channel: { label: string; value: number }[];
  daily_bookings: { date: string; bookings: number }[];
  recent_appointments: Appointment[];
}

interface Doctor {
  id: string;
  slug: string;
  name: string;
  title: string;
  consultation_fee: number;
  accepts_virtual: boolean;
  is_active: boolean;
  login_email?: string;
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
}

interface Schedule {
  id: string;
  doctor_id: string;
  branch_id: string;
  consultation_type: string;
  weekday: number;
  starts_at_local: string;
  ends_at_local: string;
  slot_minutes: number;
  effective_from: string;
  effective_until?: string;
  is_active: boolean;
}

interface Catalogue {
  branches: { id: string; name: string; area: string; is_active: boolean; is_virtual?: boolean }[];
  departments: { id: string; name: string; slug: string; is_active: boolean }[];
}

interface Operation {
  id: string;
  event_type: string;
  aggregate_id: string;
  created_at: string;
  processed_at?: string;
  status: string;
}

interface VoiceSession {
  id: string; runtime_session_id: string; status: string; channel: string; turn_count: number;
  tool_call_count: number; last_intent?: string; appointment_id?: string;
  started_at: string; ended_at?: string;
}

const NAV: { id: Section; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays },
  { id: 'virtual-opd', label: 'Virtual OPD', icon: Video },
  { id: 'doctors', label: 'Doctors', icon: Stethoscope },
  { id: 'schedules', label: 'Schedules', icon: Clock3 },
  { id: 'voice', label: 'Voice operations', icon: Mic2 },
  { id: 'catalogue', label: 'Hospital catalogue', icon: Building2 },
  { id: 'operations', label: 'Operations', icon: Activity },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatDate(value: string, withTime = true) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value));
}

function label(value: string) {
  return value.split('_').join(' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
}

function statusStyle(status: string) {
  if (['confirmed', 'completed', 'delivered'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['cancelled', 'no_show'].includes(status)) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'checked_in') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export function AdminDashboard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffName, setStaffName] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [section, setSection] = useState<Section>('overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [virtualAppointments, setVirtualAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [catalogue, setCatalogue] = useState<Catalogue>({ branches: [], departments: [] });
  const [operations, setOperations] = useState<Operation[]>([]);
  const [voiceSessions, setVoiceSessions] = useState<VoiceSession[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showVirtualForm, setShowVirtualForm] = useState(false);

  const api = useCallback(async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message || `Request failed (${response.status})`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }, []);

  const loadAll = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    setError('');
    try {
      const [analyticsData, appointmentData, virtualData, doctorData, scheduleData, catalogueData, operationData, voiceData] = await Promise.all([
        api<Analytics>('/api/v1/admin/analytics'),
        api<Appointment[]>('/api/v1/admin/appointments'),
        api<Appointment[]>('/api/v1/admin/virtual-opd'),
        api<Doctor[]>('/api/v1/admin/doctors'),
        api<Schedule[]>('/api/v1/admin/schedules'),
        api<Catalogue>('/api/v1/admin/catalogue'),
        api<Operation[]>('/api/v1/admin/operations'),
        api<VoiceSession[]>('/api/v1/admin/voice-sessions'),
      ]);
      setAnalytics(analyticsData);
      setAppointments(appointmentData);
      setVirtualAppointments(virtualData);
      setDoctors(doctorData);
      setSchedules(scheduleData);
      setCatalogue(catalogueData);
      setOperations(operationData);
      setVoiceSessions(voiceData);
      setAuthenticated(true);
    } catch (cause) {
      setAuthenticated(false);
      setError(cause instanceof Error ? cause.message : 'Unable to load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, [authenticated, api]);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/auth/me`, { credentials: 'include' }).then(async (response) => {
      if (!response.ok) throw new Error('Sign in required');
      const actor = await response.json();
      if (actor.role !== 'hospital_admin') throw new Error('Administrator access is required');
      setStaffName(actor.display_name); setAuthenticated(true);
    }).catch(() => setAuthenticated(false));
  }, []);
  useEffect(() => { void loadAll(); }, [loadAll]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || 'Sign in failed.');
      if (body.role !== 'hospital_admin') throw new Error('Administrator access is required.');
      setStaffName(body.display_name); setAuthenticated(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in failed.'); }
    finally { setLoading(false); }
  };

  const logout = async () => {
    await fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
    setPassword('');
    setAuthenticated(false);
  };

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const updateAppointmentStatus = async (appointment: Appointment, status: string) => {
    try {
      await api(`/api/v1/admin/appointments/${appointment.id}/status`, {
        method: 'PATCH', body: JSON.stringify({ status, reason: 'Updated from admin dashboard' }),
      });
      flash(`Appointment marked ${label(status).toLowerCase()}.`);
      await loadAll();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Update failed.'); }
  };

  const updateDoctor = async (doctor: Doctor, changes: Partial<Doctor>) => {
    try {
      await api(`/api/v1/admin/doctors/${doctor.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
      flash(`${doctor.name} updated.`);
      await loadAll();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Update failed.'); }
  };

  const createVirtualAppointment = async (body: Record<string, unknown>) => {
    try {
      await api('/api/v1/admin/virtual-opd', { method: 'POST', body: JSON.stringify(body) });
      setShowVirtualForm(false);
      flash('Virtual OPD appointment created.');
      await loadAll();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create Virtual OPD appointment.'); }
  };

  const deleteSchedule = async (schedule: Schedule) => {
    if (!window.confirm('Delete this recurring schedule rule?')) return;
    try {
      await api(`/api/v1/admin/schedules/${schedule.id}`, { method: 'DELETE' });
      flash('Schedule rule deleted.');
      await loadAll();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Delete failed.'); }
  };

  const filteredAppointments = useMemo(() => appointments.filter((item) => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const haystack = `${item.patient_name} ${item.patient_phone} ${item.confirmation_code} ${item.doctor?.name || ''}`.toLowerCase();
    return matchesStatus && haystack.includes(search.toLowerCase());
  }), [appointments, search, statusFilter]);

  const filteredSchedules = useMemo(() => schedules.filter((item) => doctorFilter === 'all' || item.doctor_id === doctorFilter), [schedules, doctorFilter]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#f3f5f1] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[28px] bg-white border border-[#dfe5dc] shadow-[0_24px_80px_rgba(21,71,52,0.12)] p-8 sm:p-10">
          <div className="size-12 rounded-2xl bg-[#154734] text-white flex items-center justify-center mb-7"><ShieldCheck className="size-6" /></div>
          <p className="text-xs font-bold tracking-[0.18em] text-[#4f745f] uppercase">Avocado Health</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#13251d]">Hospital administration</h1>
          <p className="mt-3 text-sm leading-6 text-[#66756d]">Sign in with your named hospital account to view operations, schedules, appointments, and analytics.</p>
          <form onSubmit={login} className="mt-8 space-y-4">
            <label className="block text-sm font-semibold text-[#273b31]">
              Work email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus autoComplete="username"
                className="mt-2 w-full h-12 rounded-xl border border-[#ccd7d0] px-4 outline-none focus:ring-2 focus:ring-[#154734]/20 focus:border-[#154734]" placeholder="name@hospital.org" />
            </label>
            <label className="block text-sm font-semibold text-[#273b31]">
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password"
                className="mt-2 w-full h-12 rounded-xl border border-[#ccd7d0] px-4 outline-none focus:ring-2 focus:ring-[#154734]/20 focus:border-[#154734]" />
            </label>
            {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">{error}</p>}
            <button disabled={!email || !password || loading} className="w-full h-12 rounded-xl bg-[#154734] text-white font-semibold hover:bg-[#0e3929] disabled:opacity-50 transition">
              {loading ? 'Checking access…' : 'Open dashboard'}
            </button>
          </form>
          <p className="mt-6 text-xs text-[#819087]">Access is restricted to authorized hospital staff.</p>
          <a href="/" className="inline-block mt-5 text-sm font-semibold text-[#154734] hover:underline">← Return to hospital website</a>
        </div>
      </div>
    );
  }

  const activeNav = NAV.find((item) => item.id === section)!;
  return (
    <div className="min-h-screen bg-[#f3f5f1] text-[#14221b] flex">
      {mobileNav && <button aria-label="Close menu" onClick={() => setMobileNav(false)} className="fixed inset-0 z-30 bg-black/30 lg:hidden" />}
      <aside className={`fixed lg:sticky top-0 z-40 h-screen w-[278px] bg-[#123e2e] text-white flex flex-col transition-transform lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-24 px-7 flex items-center justify-between border-b border-white/10">
          <div><div className="text-2xl font-serif-logo">avocado</div><div className="text-[10px] uppercase tracking-[0.22em] text-emerald-100/60">Hospital operations</div></div>
          <button className="lg:hidden text-white/70" onClick={() => setMobileNav(false)}><X className="size-5" /></button>
        </div>
        <nav className="flex-1 p-4 space-y-1.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} onClick={() => { setSection(item.id); setMobileNav(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${section === item.id ? 'bg-white text-[#123e2e] shadow-sm' : 'text-white/70 hover:bg-white/8 hover:text-white'}`}>
              <Icon className="size-[18px]" />{item.label}
            </button>;
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="px-4 py-3 mb-2 rounded-xl bg-white/6"><p className="text-xs text-white/45">Signed in as</p><p className="text-sm font-semibold mt-0.5">{staffName}</p></div>
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/65 hover:text-white"><LogOut className="size-4" />Sign out</button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="h-20 px-4 sm:px-8 border-b border-[#dde4de] bg-white/85 backdrop-blur sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNav(true)} className="lg:hidden size-10 rounded-xl border border-[#dce4de] flex items-center justify-center"><Menu className="size-5" /></button>
            <div><p className="text-xs text-[#78867e]">Administration</p><h1 className="text-xl font-semibold tracking-tight">{activeNav.label}</h1></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-2 text-xs text-[#587064] bg-[#edf4ef] border border-[#dce9df] rounded-full px-3 py-2"><span className="size-2 rounded-full bg-emerald-500" />Core API online</span>
            <button onClick={() => void loadAll()} disabled={loading} className="size-10 rounded-xl border border-[#dce4de] bg-white flex items-center justify-center hover:bg-[#f5f7f4]"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </header>

        <div className="p-4 sm:p-8 max-w-[1500px] mx-auto">
          {notice && <div className="fixed right-6 top-24 z-50 bg-[#154734] text-white px-5 py-3 rounded-xl shadow-xl text-sm flex items-center gap-2"><CheckCircle2 className="size-4" />{notice}</div>}
          {error && <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm flex justify-between"><span>{error}</span><button onClick={() => setError('')}><X className="size-4" /></button></div>}
          {section === 'overview' && analytics && <Overview analytics={analytics} />}
          {section === 'appointments' && <AppointmentsView items={filteredAppointments} search={search} setSearch={setSearch} status={statusFilter} setStatus={setStatusFilter} onStatus={updateAppointmentStatus} />}
          {section === 'virtual-opd' && <VirtualOpdView items={virtualAppointments} doctors={doctors} showForm={showVirtualForm} setShowForm={setShowVirtualForm} create={createVirtualAppointment} onStatus={updateAppointmentStatus} />}
          {section === 'doctors' && <DoctorsView doctors={doctors} onUpdate={updateDoctor} />}
          {section === 'schedules' && <SchedulesView schedules={filteredSchedules} doctors={doctors} branches={catalogue.branches} doctorFilter={doctorFilter} setDoctorFilter={setDoctorFilter} showForm={showScheduleForm} setShowForm={setShowScheduleForm} api={api} reload={loadAll} remove={deleteSchedule} flash={flash} />}
          {section === 'voice' && <VoiceOperationsView sessions={voiceSessions} analytics={analytics} />}
          {section === 'catalogue' && <CatalogueView catalogue={catalogue} doctors={doctors} />}
          {section === 'operations' && <OperationsView operations={operations} analytics={analytics} />}
        </div>
      </main>
    </div>
  );
}

function Card({ label: cardLabel, value, detail, icon: Icon, accent = false }: { label: string; value: string | number; detail: string; icon: typeof Activity; accent?: boolean }) {
  return <div className={`rounded-2xl p-5 border ${accent ? 'bg-[#154734] text-white border-[#154734]' : 'bg-white border-[#dfe5df]'}`}>
    <div className="flex items-start justify-between"><p className={`text-sm ${accent ? 'text-white/65' : 'text-[#718078]'}`}>{cardLabel}</p><span className={`size-9 rounded-xl flex items-center justify-center ${accent ? 'bg-white/12' : 'bg-[#edf4ef] text-[#154734]'}`}><Icon className="size-[18px]" /></span></div>
    <p className="text-3xl font-semibold tracking-tight mt-4">{value}</p><p className={`text-xs mt-2 ${accent ? 'text-white/55' : 'text-[#8b978f]'}`}>{detail}</p>
  </div>;
}

function Overview({ analytics }: { analytics: Analytics }) {
  const maxDaily = Math.max(1, ...analytics.daily_bookings.map((item) => item.bookings));
  const maxStatus = Math.max(1, ...analytics.by_status.map((item) => item.value));
  return <div className="space-y-7">
    <div><h2 className="text-2xl font-semibold tracking-tight">Good day, Administrator</h2><p className="text-sm text-[#738078] mt-1">Live operational view across Avocado Health clinics.</p></div>
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Card label="Total appointments" value={analytics.summary.appointments_total} detail={`${analytics.summary.appointments_upcoming} upcoming`} icon={CalendarDays} accent />
      <Card label="Booking conversion" value={`${analytics.summary.conversion_rate}%`} detail={`${analytics.summary.appointments_confirmed} confirmed`} icon={TrendingUp} />
      <Card label="Active doctors" value={analytics.summary.active_doctors} detail={`${analytics.summary.schedule_rules} schedule rules`} icon={Users} />
      <Card label="Pending notifications" value={analytics.summary.pending_notifications} detail={`${analytics.summary.active_holds} active slot holds`} icon={Activity} />
      <Card label="Voice bookings" value={analytics.summary.voice_bookings} detail={`${analytics.summary.voice_sessions_total} voice sessions`} icon={Mic2} />
    </div>
    <div className="grid xl:grid-cols-[1.6fr_1fr] gap-5">
      <section className="bg-white border border-[#dfe5df] rounded-2xl p-5 sm:p-6">
        <div className="h-52 mt-8 flex items-end gap-2 border-b border-[#e5eae6] pb-1">
          {analytics.daily_bookings.map((item) => <div key={item.date} className="flex-1 h-full flex flex-col justify-end group relative"><div title={`${item.bookings} bookings`} className="w-full rounded-t-md bg-[#7cad8e] min-h-[3px] group-hover:bg-[#154734] transition" style={{ height: `${Math.max(2, item.bookings / maxDaily * 100)}%` }} /></div>)}
        </div>
        <div className="flex justify-between text-[10px] text-[#919d95] mt-2"><span>{formatDate(analytics.daily_bookings[0].date, false)}</span><span>{formatDate(analytics.daily_bookings.at(-1)!.date, false)}</span></div>
      </section>
      <section className="bg-white border border-[#dfe5df] rounded-2xl p-5 sm:p-6">
        <h3 className="font-semibold">Appointment health</h3><p className="text-xs text-[#869289] mt-1">Current status distribution</p>
        <div className="mt-7 space-y-5">{analytics.by_status.length ? analytics.by_status.map((item) => <div key={item.label}><div className="flex justify-between text-sm mb-2"><span>{label(item.label)}</span><span className="font-semibold">{item.value}</span></div><div className="h-2 bg-[#edf1ee] rounded-full overflow-hidden"><div className="h-full bg-[#286348] rounded-full" style={{ width: `${item.value / maxStatus * 100}%` }} /></div></div>) : <Empty compact text="No appointment activity yet." />}</div>
      </section>
    </div>
    <section className="bg-white border border-[#dfe5df] rounded-2xl overflow-hidden">
      <div className="p-5 sm:px-6 border-b border-[#e6ebe7]"><h3 className="font-semibold">Recent appointments</h3><p className="text-xs text-[#869289] mt-1">Latest activity from web, voice, and staff channels</p></div>
      {analytics.recent_appointments.length ? <AppointmentTable items={analytics.recent_appointments} /> : <Empty text="New appointments will appear here as soon as patients book." />}
    </section>
  </div>;
}

function AppointmentTable({ items, onStatus }: { items: Appointment[]; onStatus?: (item: Appointment, status: string) => void }) {
  return <div className="overflow-x-auto"><table className="w-full text-left min-w-[900px]"><thead className="bg-[#f7f9f7] text-[11px] uppercase tracking-wider text-[#75827a]"><tr><th className="px-6 py-3.5">Patient</th><th className="px-4 py-3.5">Doctor</th><th className="px-4 py-3.5">Appointment</th><th className="px-4 py-3.5">Channel</th><th className="px-4 py-3.5">Status</th><th className="px-6 py-3.5">Reference</th></tr></thead>
    <tbody className="divide-y divide-[#edf0ed]">{items.map((item) => <tr key={item.id} className="hover:bg-[#fafbf9]"><td className="px-6 py-4"><p className="text-sm font-semibold">{item.patient_name}</p><p className="text-xs text-[#849087] mt-0.5">{item.patient_phone}</p></td><td className="px-4 py-4"><p className="text-sm">{item.doctor?.name || 'Unassigned'}</p><p className="text-xs text-[#849087] mt-0.5">{item.branch?.area || '—'}</p></td><td className="px-4 py-4"><p className="text-sm">{formatDate(item.starts_at)}</p><p className="text-xs text-[#849087] mt-0.5">{label(item.consultation_type)}</p></td><td className="px-4 py-4 text-sm">{label(item.origin_channel)}</td><td className="px-4 py-4">{onStatus && ['confirmed', 'checked_in'].includes(item.status) ? <select value={item.status} onChange={(event) => onStatus(item, event.target.value)} className={`text-xs font-semibold border rounded-full px-3 py-1.5 outline-none ${statusStyle(item.status)}`}><option value={item.status}>{label(item.status)}</option>{item.status === 'confirmed' && <option value="checked_in">Checked In</option>}{item.status === 'checked_in' && <option value="completed">Completed</option>}<option value="cancelled">Cancelled</option>{item.status === 'confirmed' && <option value="no_show">No Show</option>}</select> : <span className={`inline-flex text-xs font-semibold border rounded-full px-3 py-1.5 ${statusStyle(item.status)}`}>{label(item.status)}</span>}</td><td className="px-6 py-4 text-xs font-mono text-[#65736a]">{item.confirmation_code}</td></tr>)}</tbody></table></div>;
}

function AppointmentsView({ items, search, setSearch, status, setStatus, onStatus }: { items: Appointment[]; search: string; setSearch: (value: string) => void; status: string; setStatus: (value: string) => void; onStatus: (item: Appointment, status: string) => void }) {
  return <div className="space-y-5"><div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold">Appointments</h2><p className="text-sm text-[#738078] mt-1">Search, review, check in, complete, or cancel bookings.</p></div><div className="text-sm text-[#66756d]">{items.length} records</div></div>
    <div className="bg-white border border-[#dfe5df] rounded-2xl p-4 flex flex-col sm:flex-row gap-3"><label className="relative flex-1"><Search className="absolute left-3.5 top-3 size-4 text-[#8c9890]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, phone, doctor, or reference" className="w-full h-10 pl-10 pr-4 rounded-xl bg-[#f5f7f4] border border-transparent focus:border-[#b7c9bd] outline-none text-sm" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-[#dce4de] px-4 bg-white text-sm"><option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="checked_in">Checked in</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No show</option></select></div>
    <section className="bg-white border border-[#dfe5df] rounded-2xl overflow-hidden">{items.length ? <AppointmentTable items={items} onStatus={onStatus} /> : <Empty text="No appointments match these filters." />}</section></div>;
}

function VirtualOpdView({ items, doctors, showForm, setShowForm, create, onStatus }: {
  items: Appointment[]; doctors: Doctor[]; showForm: boolean; setShowForm: (value: boolean) => void;
  create: (body: Record<string, unknown>) => Promise<void>;
  onStatus: (appointment: Appointment, status: string) => void;
}) {
  const virtualDoctors = doctors.filter((doctor) => doctor.is_active && doctor.accepts_virtual);
  const defaultStart = useMemo(() => {
    const value = new Date(Date.now() + 24 * 60 * 60 * 1000);
    value.setMinutes(0, 0, 0);
    return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }, []);
  const [form, setForm] = useState({ doctor_id: '', patient_name: '', patient_phone: '', patient_email: '', reason: '', starts_at: defaultStart, duration_minutes: '30' });
  useEffect(() => {
    if (!form.doctor_id && virtualDoctors[0]) setForm((current) => ({ ...current, doctor_id: virtualDoctors[0].id }));
  }, [form.doctor_id, virtualDoctors]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await create({ ...form, starts_at: new Date(form.starts_at).toISOString(), duration_minutes: Number(form.duration_minutes), patient_email: form.patient_email || null, reason: form.reason || null, idempotency_key: `staff-virtual-${Date.now()}-${crypto.randomUUID()}` });
  };
  const waiting = items.filter((item) => item.teleconsultation_status === 'waiting').length;
  const inProgress = items.filter((item) => item.teleconsultation_status === 'in_progress').length;
  const upcoming = items.filter((item) => item.status === 'confirmed' && new Date(item.starts_at) > new Date()).length;
  return <div className="space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold">Virtual OPD</h2><p className="text-sm text-[#738078] mt-1">Create and manage online consultations, consent, waiting rooms, and doctor readiness.</p></div><button onClick={() => setShowForm(!showForm)} className="h-10 px-4 bg-[#154734] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"><Plus className="size-4" />New virtual appointment</button></div>
    <div className="grid sm:grid-cols-3 gap-4"><Card label="Upcoming virtual visits" value={upcoming} detail={`${items.length} total records`} icon={Video} accent/><Card label="Patients waiting" value={waiting} detail="Checked in and ready" icon={Clock3}/><Card label="In consultation" value={inProgress} detail="Doctor has started the call" icon={Stethoscope}/></div>
    {showForm && <form onSubmit={(event) => void submit(event)} className="bg-white border border-[#cddacf] rounded-2xl p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Select label="Doctor" value={form.doctor_id} onChange={(value) => setForm({ ...form, doctor_id: value })} options={virtualDoctors.map((doctor) => ({ value: doctor.id, label: doctor.name }))}/><Field label="Date and time" type="datetime-local" value={form.starts_at} onChange={(value) => setForm({ ...form, starts_at: value })}/><Select label="Duration" value={form.duration_minutes} onChange={(value) => setForm({ ...form, duration_minutes: value })} options={[{ value: '15', label: '15 minutes' }, { value: '30', label: '30 minutes' }, { value: '45', label: '45 minutes' }, { value: '60', label: '60 minutes' }]}/><Field label="Patient name" type="text" value={form.patient_name} onChange={(value) => setForm({ ...form, patient_name: value })}/><Field label="Patient phone" type="tel" value={form.patient_phone} onChange={(value) => setForm({ ...form, patient_phone: value })}/><label className="text-xs font-semibold text-[#58695f]">Patient email<input type="email" value={form.patient_email} onChange={(event) => setForm({ ...form, patient_email: event.target.value })} className="mt-1.5 w-full h-10 rounded-lg border border-[#d6dfd9] px-3 text-sm font-normal" /></label><label className="text-xs font-semibold text-[#58695f] sm:col-span-2">Reason / notes<input type="text" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className="mt-1.5 w-full h-10 rounded-lg border border-[#d6dfd9] px-3 text-sm font-normal" /></label>
      {!virtualDoctors.length && <p className="sm:col-span-2 lg:col-span-4 text-sm text-amber-700 bg-amber-50 rounded-xl p-3">Enable Virtual care for at least one doctor in the Doctors menu.</p>}<div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-3"><button type="button" onClick={() => setShowForm(false)} className="h-10 px-4 rounded-xl border border-[#dce4de] text-sm">Cancel</button><button disabled={!virtualDoctors.length} className="h-10 px-5 rounded-xl bg-[#154734] text-white text-sm font-semibold disabled:opacity-50">Create Virtual OPD</button></div>
    </form>}
    <section className="bg-white border border-[#dfe5df] rounded-2xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left"><thead className="bg-[#f7f9f7] text-[11px] uppercase tracking-wider text-[#75827a]"><tr><th className="px-6 py-3.5">Patient</th><th className="px-4 py-3.5">Doctor</th><th className="px-4 py-3.5">Date & time</th><th className="px-4 py-3.5">Consent</th><th className="px-4 py-3.5">Virtual room</th><th className="px-4 py-3.5">Appointment</th><th className="px-6 py-3.5">Reference</th></tr></thead><tbody className="divide-y divide-[#edf0ed]">{items.map((item) => <tr key={item.id}><td className="px-6 py-4"><p className="text-sm font-semibold">{item.patient_name}</p><p className="text-xs text-[#849087]">{item.patient_phone}</p></td><td className="px-4 py-4 text-sm">{item.doctor?.name || 'Unassigned'}</td><td className="px-4 py-4"><p className="text-sm">{formatDate(item.starts_at)}</p><p className="text-xs text-[#849087]">{item.branch?.name || 'Virtual Care'}</p></td><td className="px-4 py-4"><span className={`text-xs font-semibold rounded-full px-3 py-1 ${item.consent_accepted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.consent_accepted ? 'Accepted' : 'Pending'}</span></td><td className="px-4 py-4"><span className={`text-xs font-semibold border rounded-full px-3 py-1 ${statusStyle(item.teleconsultation_status || 'scheduled')}`}>{label(item.teleconsultation_status || 'scheduled')}</span></td><td className="px-4 py-4">{['confirmed', 'checked_in'].includes(item.status) ? <select value={item.status} onChange={(event) => onStatus(item, event.target.value)} className={`text-xs font-semibold border rounded-full px-3 py-1.5 outline-none ${statusStyle(item.status)}`}><option value={item.status}>{label(item.status)}</option>{item.status === 'confirmed' && <option value="checked_in">Checked In</option>}{item.status === 'checked_in' && <option value="completed">Completed</option>}<option value="cancelled">Cancelled</option><option value="no_show">No Show</option></select> : <span className={`text-xs font-semibold border rounded-full px-3 py-1 ${statusStyle(item.status)}`}>{label(item.status)}</span>}</td><td className="px-6 py-4 text-xs font-mono text-[#65736a]">{item.confirmation_code}</td></tr>)}{!items.length && <tr><td colSpan={7}><Empty text="No Virtual OPD appointments yet. Create the first one above."/></td></tr>}</tbody></table></div></section>
  </div>;
}

function DoctorsView({ doctors, onUpdate }: { doctors: Doctor[]; onUpdate: (doctor: Doctor, changes: Partial<Doctor>) => void }) {
  return <div className="space-y-5"><div><h2 className="text-2xl font-semibold">Doctors</h2><p className="text-sm text-[#738078] mt-1">Control availability, virtual care, consultation fees, and confirm each doctor's login identity.</p></div><div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-4">{doctors.map((doctor) => <article key={doctor.id} className={`bg-white border rounded-2xl p-5 ${doctor.is_active ? 'border-[#dfe5df]' : 'border-[#e5dfdf] opacity-70'}`}><div className="flex items-start justify-between gap-4"><div className="size-11 rounded-xl bg-[#eaf2ec] text-[#154734] flex items-center justify-center"><Stethoscope className="size-5" /></div><button onClick={() => onUpdate(doctor, { is_active: !doctor.is_active })} className={`w-11 h-6 rounded-full p-1 transition ${doctor.is_active ? 'bg-[#1f6a49]' : 'bg-[#c9cfcb]'}`}><span className={`block size-4 bg-white rounded-full transition-transform ${doctor.is_active ? 'translate-x-5' : ''}`} /></button></div><h3 className="font-semibold mt-4">{doctor.name}</h3><p className="text-xs leading-5 text-[#75827a] mt-1 min-h-10">{doctor.title}</p><p className="mt-2 text-xs text-[#557164]">{doctor.login_email || 'No login assigned'}</p><div className="flex flex-wrap gap-1.5 mt-3">{doctor.departments.map((item) => <span key={item.id} className="text-[10px] bg-[#f0f4f1] text-[#53675b] rounded-full px-2 py-1">{item.name}</span>)}</div><div className="mt-5 pt-4 border-t border-[#edf0ed] grid grid-cols-2 gap-3"><label className="text-xs text-[#77847c]">Consultation fee<div className="mt-1 flex items-center border border-[#dfe5df] rounded-lg px-2"><IndianRupee className="size-3" /><input key={doctor.consultation_fee} defaultValue={doctor.consultation_fee} type="number" onBlur={(event) => { const fee = Number(event.target.value); if (fee !== doctor.consultation_fee) onUpdate(doctor, { consultation_fee: fee }); }} className="w-full h-8 outline-none text-sm font-semibold" /></div></label><div className="text-xs text-[#77847c]">Virtual care<button onClick={() => onUpdate(doctor, { accepts_virtual: !doctor.accepts_virtual })} className={`mt-1 w-full h-8 rounded-lg text-xs font-semibold border ${doctor.accepts_virtual ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-[#f6f7f5] border-[#e0e4e1] text-[#7c8780]'}`}>{doctor.accepts_virtual ? 'Enabled' : 'Disabled'}</button></div></div></article>)}</div></div>;
}

function SchedulesView({ schedules, doctors, branches, doctorFilter, setDoctorFilter, showForm, setShowForm, api, reload, remove, flash }: { schedules: Schedule[]; doctors: Doctor[]; branches: Catalogue['branches']; doctorFilter: string; setDoctorFilter: (value: string) => void; showForm: boolean; setShowForm: (value: boolean) => void; api: <T>(path: string, options?: RequestInit) => Promise<T>; reload: () => Promise<void>; remove: (schedule: Schedule) => void; flash: (message: string) => void }) {
  const [form, setForm] = useState({ doctor_id: doctors[0]?.id || '', branch_id: branches[0]?.id || '', consultation_type: 'in_person', weekday: '0', starts_at_local: '09:00', ends_at_local: '17:00', slot_minutes: '30', effective_from: new Date().toISOString().slice(0, 10) });
  const submit = async (event: FormEvent) => { event.preventDefault(); await api('/api/v1/admin/schedules', { method: 'POST', body: JSON.stringify({ ...form, weekday: Number(form.weekday), slot_minutes: Number(form.slot_minutes) }) }); setShowForm(false); flash('Schedule rule created.'); await reload(); };
  const doctorName = (id: string) => doctors.find((item) => item.id === id)?.name || 'Unknown doctor';
  const branchName = (id: string) => branches.find((item) => item.id === id)?.area || 'Unknown branch';
  return <div className="space-y-5"><div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold">Schedules</h2><p className="text-sm text-[#738078] mt-1">Manage recurring clinical hours and slot duration.</p></div><button onClick={() => setShowForm(!showForm)} className="h-10 px-4 bg-[#154734] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"><Plus className="size-4" />New schedule</button></div>
    {showForm && <form onSubmit={(event) => void submit(event)} className="bg-white border border-[#cddacf] rounded-2xl p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4"><Select label="Doctor" value={form.doctor_id} onChange={(value) => setForm({ ...form, doctor_id: value })} options={doctors.map((item) => ({ value: item.id, label: item.name }))} /><Select label="Branch" value={form.branch_id} onChange={(value) => setForm({ ...form, branch_id: value })} options={branches.map((item) => ({ value: item.id, label: item.name }))} /><Select label="Day" value={form.weekday} onChange={(value) => setForm({ ...form, weekday: value })} options={DAYS.map((item, index) => ({ value: String(index), label: item }))} /><Select label="Visit type" value={form.consultation_type} onChange={(value) => setForm({ ...form, consultation_type: value })} options={[{ value: 'in_person', label: 'In person' }, { value: 'virtual', label: 'Virtual' }]} /><Field label="Starts" type="time" value={form.starts_at_local} onChange={(value) => setForm({ ...form, starts_at_local: value })} /><Field label="Ends" type="time" value={form.ends_at_local} onChange={(value) => setForm({ ...form, ends_at_local: value })} /><Field label="Slot minutes" type="number" value={form.slot_minutes} onChange={(value) => setForm({ ...form, slot_minutes: value })} /><Field label="Effective from" type="date" value={form.effective_from} onChange={(value) => setForm({ ...form, effective_from: value })} /><div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-3"><button type="button" onClick={() => setShowForm(false)} className="h-10 px-4 rounded-xl border border-[#dce4de] text-sm">Cancel</button><button className="h-10 px-5 rounded-xl bg-[#154734] text-white text-sm font-semibold">Create schedule</button></div></form>}
    <div className="bg-white border border-[#dfe5df] rounded-2xl p-4 flex items-center gap-3"><span className="text-sm text-[#6e7d74]">Filter:</span><select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)} className="h-9 rounded-lg border border-[#dce4de] px-3 text-sm"><option value="all">All doctors</option>{doctors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="ml-auto text-sm text-[#7a877f]">{schedules.length} rules</span></div>
    <div className="bg-white border border-[#dfe5df] rounded-2xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-[#f7f9f7] text-[11px] uppercase tracking-wider text-[#75827a]"><tr><th className="px-6 py-3.5">Doctor</th><th className="px-4 py-3.5">Branch</th><th className="px-4 py-3.5">Day</th><th className="px-4 py-3.5">Hours</th><th className="px-4 py-3.5">Type</th><th className="px-4 py-3.5">Slot</th><th className="px-6 py-3.5" /></tr></thead><tbody className="divide-y divide-[#edf0ed]">{schedules.map((item) => <tr key={item.id}><td className="px-6 py-3.5 text-sm font-medium">{doctorName(item.doctor_id)}</td><td className="px-4 py-3.5 text-sm">{branchName(item.branch_id)}</td><td className="px-4 py-3.5 text-sm">{DAYS[item.weekday]}</td><td className="px-4 py-3.5 text-sm font-mono">{item.starts_at_local.slice(0, 5)}–{item.ends_at_local.slice(0, 5)}</td><td className="px-4 py-3.5 text-sm">{label(item.consultation_type)}</td><td className="px-4 py-3.5 text-sm">{item.slot_minutes} min</td><td className="px-6 py-3.5 text-right"><button onClick={() => remove(item)} className="size-8 inline-flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 className="size-4" /></button></td></tr>)}</tbody></table></div></div></div>;
}

function Select({ label: fieldLabel, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label className="text-xs font-semibold text-[#58695f]">{fieldLabel}<select required value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full h-10 rounded-lg border border-[#d6dfd9] bg-white px-3 text-sm font-normal">{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>; }
function Field({ label: fieldLabel, value, type, onChange }: { label: string; value: string; type: string; onChange: (value: string) => void }) { return <label className="text-xs font-semibold text-[#58695f]">{fieldLabel}<input required type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full h-10 rounded-lg border border-[#d6dfd9] px-3 text-sm font-normal" /></label>; }

function CatalogueView({ catalogue, doctors }: { catalogue: Catalogue; doctors: Doctor[] }) {
  return <div className="space-y-5"><div><h2 className="text-2xl font-semibold">Hospital catalogue</h2><p className="text-sm text-[#738078] mt-1">Operational footprint currently available to patients and agents.</p></div><div className="grid lg:grid-cols-2 gap-5"><section className="bg-white border border-[#dfe5df] rounded-2xl p-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Clinic branches</h3><p className="text-xs text-[#849087] mt-1">{catalogue.branches.length} locations</p></div><Building2 className="size-5 text-[#37684e]" /></div><div className="mt-5 divide-y divide-[#edf0ed]">{catalogue.branches.map((item) => <div key={item.id} className="py-3 flex items-center justify-between"><div><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-[#849087]">{item.area}</p></div><span className={`text-[10px] px-2 py-1 rounded-full ${item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{item.is_active ? 'Active' : 'Inactive'}</span></div>)}</div></section><section className="bg-white border border-[#dfe5df] rounded-2xl p-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Departments</h3><p className="text-xs text-[#849087] mt-1">{catalogue.departments.length} clinical services</p></div><Stethoscope className="size-5 text-[#37684e]" /></div><div className="mt-5 grid sm:grid-cols-2 gap-2">{catalogue.departments.map((item) => <div key={item.id} className="p-3 bg-[#f7f9f7] rounded-xl"><p className="text-sm font-medium">{item.name}</p><p className="text-[10px] text-[#849087] mt-1">{doctors.filter((doctor) => doctor.departments.some((department) => department.id === item.id)).length} doctors</p></div>)}</div></section></div></div>;
}

function VoiceOperationsView({ sessions, analytics }: { sessions: VoiceSession[]; analytics: Analytics | null }) {
  const completed = sessions.filter((item) => item.status === 'completed').length;
  const bookings = sessions.filter((item) => item.appointment_id).length;
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-semibold">Voice operations</h2><p className="text-sm text-[#738078] mt-1">Calls, live scheduling actions, and bookings made by the clinic voice assistant.</p></div>
    <div className="grid sm:grid-cols-3 gap-4">
      <Card label="Voice sessions" value={analytics?.summary.voice_sessions_total || sessions.length} detail={`${completed} completed`} icon={Mic2} />
      <Card label="Voice bookings" value={analytics?.summary.voice_bookings || bookings} detail="Confirmed in the core booking system" icon={CalendarDays} accent />
      <Card label="Tool activity" value={sessions.reduce((sum, item) => sum + item.tool_call_count, 0)} detail="Audited backend operations" icon={Activity} />
    </div>
    <section className="bg-white border border-[#dfe5df] rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-[#e6ebe7]"><h3 className="font-semibold">Recent voice sessions</h3><p className="text-xs text-[#849087] mt-1">Only operational metadata is shown here; audio is not stored in the clinic database.</p></div>
      {sessions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="bg-[#f7f9f7] text-[11px] uppercase tracking-wider text-[#75827a]"><tr><th className="px-6 py-3.5">Started</th><th className="px-4 py-3.5">Channel</th><th className="px-4 py-3.5">Last action</th><th className="px-4 py-3.5">Turns / tools</th><th className="px-4 py-3.5">Booking</th><th className="px-6 py-3.5">Status</th></tr></thead><tbody className="divide-y divide-[#edf0ed]">{sessions.map((item) => <tr key={item.id}><td className="px-6 py-4 text-sm">{formatDate(item.started_at)}</td><td className="px-4 py-4 text-sm">{label(item.channel)}</td><td className="px-4 py-4 text-sm">{item.last_intent ? label(item.last_intent) : 'Conversation started'}</td><td className="px-4 py-4 text-sm">{item.turn_count} / {item.tool_call_count}</td><td className="px-4 py-4 text-xs font-mono">{item.appointment_id ? item.appointment_id.slice(0, 8) : '—'}</td><td className="px-6 py-4"><span className={`text-xs font-semibold border rounded-full px-3 py-1 ${statusStyle(item.status)}`}>{label(item.status)}</span></td></tr>)}</tbody></table></div> : <Empty text="Voice sessions will appear when a patient starts a conversation." />}
    </section>
  </div>;
}

function OperationsView({ operations, analytics }: { operations: Operation[]; analytics: Analytics | null }) {
  return <div className="space-y-5"><div><h2 className="text-2xl font-semibold">Operations</h2><p className="text-sm text-[#738078] mt-1">Notification outbox and system activity.</p></div><div className="grid sm:grid-cols-3 gap-4"><Card label="Pending events" value={analytics?.summary.pending_notifications || 0} detail="Awaiting worker delivery" icon={Activity} /><Card label="Active holds" value={analytics?.summary.active_holds || 0} detail="Temporary reservations" icon={Clock3} /><Card label="API state" value="Healthy" detail="Database readiness confirmed" icon={CheckCircle2} /></div><section className="bg-white border border-[#dfe5df] rounded-2xl overflow-hidden"><div className="p-5 border-b border-[#e6ebe7]"><h3 className="font-semibold">Event outbox</h3></div>{operations.length ? <div className="divide-y divide-[#edf0ed]">{operations.map((item) => <div key={item.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5"><span className={`text-xs font-semibold border rounded-full px-3 py-1 ${statusStyle(item.status)}`}>{label(item.status)}</span><div className="flex-1"><p className="text-sm font-medium">{label(item.event_type.replace('.', ' '))}</p><p className="text-xs text-[#859188] font-mono mt-0.5">{item.aggregate_id}</p></div><time className="text-xs text-[#7c8981]">{formatDate(item.created_at)}</time></div>)}</div> : <Empty text="Operational events will appear after the first booking." />}</section></div>;
}

function Empty({ text, compact = false }: { text: string; compact?: boolean }) { return <div className={`${compact ? 'py-8' : 'py-14'} px-6 text-center`}><div className="size-10 rounded-full bg-[#eef3ef] text-[#5f7769] flex items-center justify-center mx-auto"><CalendarDays className="size-4" /></div><p className="text-sm text-[#78867e] mt-3">{text}</p></div>; }
