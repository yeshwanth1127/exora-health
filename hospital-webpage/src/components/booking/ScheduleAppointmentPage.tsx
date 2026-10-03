import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CalendarDays, Check, CheckCircle2, Clock3, Loader2, MapPin, ShieldCheck, Stethoscope } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { Breadcrumbs } from '../common/Breadcrumbs';
import { ApiAppointment, ApiDoctor, ApiHold, ApiSlot, hospitalApi, patientOwnerKey } from '../../lib/hospitalApi';

export interface DoctorScheduleProfile {
  id: string; name: string; credentials?: string; specialty: string; photo: string; rating: number;
  reviewCount: number; boardCertified: string; pedigree?: string; bedsideManner?: string;
  decisionChips?: string[]; nicheExpertise?: string; hospitalAffiliation?: string;
  practiceName: string; addressLine1: string; addressLine2: string; phone: string;
  offersVideo?: boolean; nextVisitText?: string; availableSlots?: Record<string, string[]>;
  bio?: string; education?: string[]; clinicalInterests?: string[];
  facilityPhotos?: Array<{ url: string; title: string }>;
}

interface Props {
  doctor: DoctorScheduleProfile; initialStep?: 1 | 2; initialDate?: string; initialSlot?: string;
  initialVisitType?: 'Office Visit' | 'Video Visit'; onBackToSearch: () => void; onBackToHome: () => void;
  onOpenLogin: () => void; onSelectSimilarDoctor?: (doctorId: string) => void;
  user: { name: string; identifier: string } | null;
}

const localDate = (iso: string, timezone: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(iso));

const displayTime = (iso: string, timezone: string) => new Intl.DateTimeFormat('en-IN', {
  timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true,
}).format(new Date(iso));

export function ScheduleAppointmentPage({ doctor, initialStep = 1, initialDate, initialVisitType = 'Office Visit',
  onBackToSearch, onBackToHome, user }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [liveDoctor, setLiveDoctor] = useState<ApiDoctor | null>(null);
  const [branchId, setBranchId] = useState('');
  const [visitType, setVisitType] = useState<'in_person' | 'virtual'>(initialVisitType === 'Video Visit' ? 'virtual' : 'in_person');
  const [slots, setSlots] = useState<ApiSlot[]>([]);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [selectedDate, setSelectedDate] = useState(initialDate || '');
  const [hold, setHold] = useState<ApiHold | null>(null);
  const [appointment, setAppointment] = useState<ApiAppointment | null>(null);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.identifier || '');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const ownerKey = useMemo(() => patientOwnerKey(), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    hospitalApi.doctor(doctor.id).then((result) => {
      if (!active) return;
      setLiveDoctor(result);
      const preferred = result.branches.find((branch) => branch.name === doctor.practiceName) || result.branches[0];
      setBranchId(preferred?.id || '');
    }).catch((cause) => active && setError(cause instanceof Error ? cause.message : 'Could not load this doctor.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [doctor.id, doctor.practiceName]);

  useEffect(() => {
    if (!liveDoctor || !branchId) return;
    let active = true;
    const start = format(new Date(), 'yyyy-MM-dd');
    const end = format(addDays(new Date(), 30), 'yyyy-MM-dd');
    setLoading(true);
    setError('');
    setSlots([]);
    setHold(null);
    hospitalApi.availability(liveDoctor.id, branchId, start, end, visitType).then((result) => {
      if (!active) return;
      setSlots(result.slots);
      setTimezone(result.timezone);
      const dates = Array.from(new Set(result.slots.map((slot) => localDate(slot.starts_at, result.timezone))));
      setSelectedDate((current) => current && dates.includes(current) ? current : dates[0] || '');
    }).catch((cause) => active && setError(cause instanceof Error ? cause.message : 'Could not load availability.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [liveDoctor, branchId, visitType]);

  const dates = useMemo(() => Array.from(new Set(slots.map((slot) => localDate(slot.starts_at, timezone)))), [slots, timezone]);
  const daySlots = useMemo(() => slots.filter((slot) => localDate(slot.starts_at, timezone) === selectedDate), [slots, selectedDate, timezone]);
  const selectedBranch = liveDoctor?.branches.find((branch) => branch.id === branchId);

  const selectSlot = async (slot: ApiSlot) => {
    setSubmitting(true); setError('');
    try {
      if (hold) await hospitalApi.releaseHold(hold.id, ownerKey).catch(() => undefined);
      const created = await hospitalApi.hold(slot, ownerKey);
      setHold(created); setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This slot could not be held. Please choose another.');
    } finally { setSubmitting(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!hold) return setError('Your slot hold is missing. Please choose a time again.');
    if (name.trim().length < 2) return setError('Please enter the patient’s full name.');
    if (phone.replace(/\D/g, '').length < 7) return setError('Please enter a valid phone number.');
    setSubmitting(true); setError('');
    try {
      const result = await hospitalApi.book(hold.id, ownerKey, { name: name.trim(), phone: phone.trim(), email: email.trim(), reason: reason.trim() });
      setAppointment(result); setStep(3); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The appointment could not be confirmed.');
    } finally { setSubmitting(false); }
  };

  return <div className="min-h-[75vh] bg-[#f7f7f3] text-[#16241d]">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: 'Home', onClick: onBackToHome }, { label: 'Find a doctor', onClick: onBackToSearch }, { label: doctor.name }]} />
      <div className="mt-7 flex items-center gap-3 text-sm">
        {['Choose a time', 'Patient details', 'Confirmed'].map((label, index) => <div key={label} className="flex items-center gap-2 flex-1">
          <span className={`size-8 rounded-full grid place-items-center font-bold ${step >= index + 1 ? 'bg-[#154734] text-white' : 'bg-white border text-[#718078]'}`}>{step > index + 1 ? <Check className="size-4" /> : index + 1}</span>
          <span className={`hidden sm:block font-semibold ${step >= index + 1 ? '' : 'text-[#829087]'}`}>{label}</span>
          {index < 2 && <span className="ml-auto h-px bg-[#d7ded9] flex-1" />}
        </div>)}
      </div>

      {error && <div className="mt-6 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertCircle className="size-5 shrink-0" />{error}</div>}

      <div className="mt-7 grid lg:grid-cols-[310px_1fr] gap-6">
        <aside className="bg-white rounded-3xl border border-[#dfe6e0] p-5 h-fit">
          <img src={doctor.photo} alt="" className="w-full aspect-[4/3] object-cover rounded-2xl bg-[#edf2ee]" />
          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-[#4d735e]">{liveDoctor?.departments[0]?.name || doctor.specialty}</p>
          <h1 className="mt-1 text-2xl font-semibold">{liveDoctor?.name || doctor.name}</h1>
          <p className="mt-2 text-sm leading-6 text-[#66756d]">{liveDoctor?.title || doctor.credentials}</p>
          <div className="mt-5 pt-5 border-t space-y-3 text-sm">
            <p className="flex gap-2"><Stethoscope className="size-4 mt-0.5" /> {liveDoctor?.experience_years || '—'} years’ experience</p>
            <p className="flex gap-2"><MapPin className="size-4 mt-0.5" /> {selectedBranch?.name || doctor.practiceName}</p>
            <p className="font-semibold">₹{liveDoctor?.consultation_fee || '—'} consultation</p>
          </div>
        </aside>

        <section className="bg-white rounded-3xl border border-[#dfe6e0] p-5 sm:p-8 min-h-[460px]">
          {loading && <div className="h-72 grid place-items-center text-[#607067]"><div className="text-center"><Loader2 className="size-7 animate-spin mx-auto mb-3" />Loading live availability…</div></div>}

          {!loading && step === 1 && <>
            <h2 className="text-2xl font-semibold">Choose an available appointment</h2>
            <p className="mt-2 text-sm text-[#6b7971]">Times below come directly from the hospital schedule and update after every booking.</p>
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <label className="text-sm font-semibold">Clinic
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="mt-2 w-full h-12 border rounded-xl px-3 bg-white">
                  {liveDoctor?.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">Visit type
                <select value={visitType} onChange={(e) => setVisitType(e.target.value as 'in_person' | 'virtual')} className="mt-2 w-full h-12 border rounded-xl px-3 bg-white">
                  <option value="in_person">Office visit</option>
                  {liveDoctor?.accepts_virtual && <option value="virtual">Video visit</option>}
                </select>
              </label>
            </div>
            {dates.length ? <>
              <div className="mt-7 flex gap-2 overflow-x-auto pb-2">{dates.slice(0, 10).map((value) => <button key={value} onClick={() => setSelectedDate(value)} className={`min-w-[112px] rounded-2xl border px-3 py-3 text-sm ${selectedDate === value ? 'bg-[#154734] text-white border-[#154734]' : 'bg-white hover:border-[#6f8c7b]'}`}>
                <span className="block text-xs opacity-75">{format(new Date(`${value}T12:00:00`), 'EEE')}</span><span className="font-semibold">{format(new Date(`${value}T12:00:00`), 'd MMM')}</span>
              </button>)}</div>
              <div className="mt-6 grid sm:grid-cols-3 gap-3">{daySlots.map((slot) => <button key={slot.starts_at} disabled={submitting} onClick={() => void selectSlot(slot)} className="h-12 rounded-xl border border-[#b8c9bf] font-semibold text-[#154734] hover:bg-[#edf5f0] disabled:opacity-50 flex items-center justify-center gap-2"><Clock3 className="size-4" />{displayTime(slot.starts_at, timezone)}</button>)}</div>
            </> : <div className="mt-8 rounded-2xl bg-[#f4f6f3] p-8 text-center"><CalendarDays className="size-7 mx-auto text-[#688071]" /><p className="mt-3 font-semibold">No open slots in the next 30 days</p><p className="mt-1 text-sm text-[#718078]">Try another clinic or visit type.</p></div>}
          </>}

          {!loading && step === 2 && hold && <>
            <button onClick={() => setStep(1)} className="text-sm font-semibold text-[#315e49] flex items-center gap-1"><ArrowLeft className="size-4" />Change time</button>
            <h2 className="mt-5 text-2xl font-semibold">Patient details</h2>
            <div className="mt-4 rounded-2xl bg-[#eef5f0] p-4 text-sm"><p className="font-semibold">{liveDoctor?.name}</p><p className="mt-1 text-[#52675b]">{format(new Date(hold.starts_at), 'EEEE, d MMMM yyyy')} at {displayTime(hold.starts_at, timezone)} · {selectedBranch?.name}</p><p className="mt-2 text-xs text-[#65786d]">This slot is temporarily held while you finish.</p></div>
            <form onSubmit={(event) => void submit(event)} className="mt-6 grid sm:grid-cols-2 gap-5">
              <Field label="Patient full name" value={name} onChange={setName} required autoComplete="name" />
              <Field label="Mobile number" value={phone} onChange={setPhone} required autoComplete="tel" />
              <Field label="Email (optional)" type="email" value={email} onChange={setEmail} autoComplete="email" />
              <Field label="Reason for visit (optional)" value={reason} onChange={setReason} />
              <div className="sm:col-span-2 flex items-start gap-2 rounded-xl bg-[#fafaf8] border p-3 text-xs text-[#617068]"><ShieldCheck className="size-4 shrink-0" />Your details are sent securely to the hospital booking system and are not shared with the voice model.</div>
              <button disabled={submitting} className="sm:col-span-2 h-13 rounded-xl bg-[#154734] text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2">{submitting && <Loader2 className="size-4 animate-spin" />}Confirm appointment</button>
            </form>
          </>}

          {!loading && step === 3 && appointment && <div className="py-8 text-center max-w-lg mx-auto">
            <div className="size-16 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center mx-auto"><CheckCircle2 className="size-8" /></div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Appointment confirmed</p>
            <h2 className="mt-2 text-3xl font-semibold">You’re booked</h2>
            <p className="mt-3 text-[#607067]">Meeting details will be sent to your WhatsApp number and email.</p>
            <div className="mt-7 rounded-2xl bg-[#f4f6f3] p-5 text-left space-y-2 text-sm"><p><strong>Confirmation:</strong> {appointment.confirmation_code}</p>{appointment.patient_code && <p><strong>Patient code:</strong> {appointment.patient_code}</p>}<p><strong>Doctor:</strong> {liveDoctor?.name}</p><p><strong>When:</strong> {format(new Date(appointment.reservation.starts_at), 'EEEE, d MMMM yyyy')} at {displayTime(appointment.reservation.starts_at, timezone)}</p><p><strong>Clinic:</strong> {selectedBranch?.name}</p></div>
            {appointment.patient_account_created && appointment.patient_access_code && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-950"><p className="font-semibold">Your patient account is ready</p><p className="mt-1">Use {email ? <><strong>{email}</strong> and access code <strong>{appointment.patient_access_code}</strong></> : <>patient code <strong>{appointment.patient_code}</strong> and access code <strong>{appointment.patient_access_code}</strong></>} to sign in. Save this code now; it is only shown once.</p></div>}
            <div className="mt-7 flex justify-center gap-3">
              {appointment.reservation.consultation_type === 'virtual' && <a href={`/virtual-opd?appointment=${encodeURIComponent(appointment.id)}`} className="h-12 px-6 rounded-xl bg-[#154734] text-white font-semibold inline-flex items-center">Open Virtual OPD</a>}
              <button onClick={onBackToHome} className="h-12 px-6 rounded-xl border border-[#154734] text-[#154734] font-semibold">Return home</button>
            </div>
          </div>}
        </section>
      </div>
    </div>
  </div>;
}

function Field({ label, value, onChange, type = 'text', required = false, autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; autoComplete?: string }) {
  return <label className="text-sm font-semibold">{label}<input type={type} value={value} required={required} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full h-12 rounded-xl border border-[#cdd8d1] px-4 font-normal outline-none focus:ring-2 focus:ring-[#154734]/20 focus:border-[#154734]" /></label>;
}
