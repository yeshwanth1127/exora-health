import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, CalendarDays, Video, MapPin } from 'lucide-react';
import { addBookingDays, bookingDay, createPublicBookingApi, exactWebsiteDoctor, normalizeBookingPhone, PublicBookingIntent, type PublicBookingApi, type PublicCatalog, type PublicSlot, type VisitMode } from '../../lib/publicBookingApi';
const button = 'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const primary = `${button} bg-[#234b35] text-white hover:bg-[#173724]`;
const secondary = `${button} border border-[#cfd5c9] bg-white text-[#234b35] hover:bg-[#edf1e8]`;
const input = 'w-full rounded-xl border border-[#cfd5c9] bg-white px-4 py-3 text-[#203728] focus:outline-none focus:ring-2 focus:ring-[#234b35]/25';
const card = 'rounded-2xl border border-[#dddcd2] bg-white p-6 md:p-8';
const money = (fee: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(fee / 100);
const dateLabel = (day: string) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
const timeLabel = (instant: string, timezone: string) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(instant));
export function HmsBookingPage({ requestedDoctorId, onBack, api: providedApi }: { requestedDoctorId?: string; onBack: () => void; api?: PublicBookingApi }) {
  const api = useMemo(() => providedApi ?? createPublicBookingApi(), [providedApi]);
  const machine = useMemo(() => new PublicBookingIntent(api), [api]);
  const mounted = useRef(true);
  const [, changed] = useState(0);
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null), [catalogLoading, setCatalogLoading] = useState(true), [catalogError, setCatalogError] = useState(''), [reload, setReload] = useState(0);
  const [doctorSlug, setDoctorSlug] = useState(''), [mode, setMode] = useState<VisitMode>('in_person'), [from, setFrom] = useState('');
  const [slots, setSlots] = useState<PublicSlot[]>([]), [slotsLoading, setSlotsLoading] = useState(false), [slotsError, setSlotsError] = useState(''), [slotReload, setSlotReload] = useState(0);
  const [selectedDay, setSelectedDay] = useState(''), [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null), [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [email, setEmail] = useState(''), [reason, setReason] = useState(''), [formError, setFormError] = useState('');
  const frozen = machine.busy || machine.unknown;
  const doctor = catalog?.doctors.find((entry) => entry.slug === doctorSlug);
  const mapped = catalog ? exactWebsiteDoctor(catalog.doctors, requestedDoctorId) : undefined;
  const until = catalog && from ? [addBookingDays(from, 6), catalog.bookingUntil].sort()[0] : '';
  const days = [...new Set(slots.map((slot) => bookingDay(slot.startsAt, catalog!.timezone)))].sort();
  const dirty = !machine.receipt && (!!selectedSlot || !!name || !!phone || !!email || !!reason || frozen);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const protectRoute = (event: Event) => { if (machine.busy || machine.unknown || !window.confirm('Leave this booking? Your unsaved details will be discarded.')) event.preventDefault(); };
    window.addEventListener('beforeunload', protect);
    window.addEventListener('hms-booking-leave', protectRoute);
    return () => { window.removeEventListener('beforeunload', protect); window.removeEventListener('hms-booking-leave', protectRoute); };
  }, [dirty]);
  useEffect(() => {
    const controller = new AbortController();
    setCatalogLoading(true); setCatalogError('');
    api.catalog(controller.signal).then((next) => {
      if (controller.signal.aborted) return;
      setCatalog(next); setFrom(next.today);
      const exact = exactWebsiteDoctor(next.doctors, requestedDoctorId);
      setDoctorSlug(exact?.slug ?? ''); setSelectedSlot(null); setSelectedDay(''); setStep(1);
    }).catch((error) => { if (!controller.signal.aborted) { setCatalog(null); setCatalogError(error instanceof Error ? error.message : 'Could not load hospital booking.'); } }).finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, [api, reload, requestedDoctorId]);
  useEffect(() => {
    if (!catalog || !doctor || !from || !until || frozen || machine.receipt) return;
    const controller = new AbortController();
    setSlots([]); setSlotsError(''); setSlotsLoading(true); setSelectedSlot(null);
    api.slots(doctor.slug, mode, from, until, catalog.timezone, controller.signal).then((next) => {
      if (controller.signal.aborted) return;
      setSlots(next.slots);
      setSelectedDay(next.slots.length ? bookingDay(next.slots[0].startsAt, catalog.timezone) : '');
    }).catch((error) => { if (!controller.signal.aborted) setSlotsError(error instanceof Error ? error.message : 'Could not load available times.'); }).finally(() => { if (!controller.signal.aborted) setSlotsLoading(false); });
    return () => controller.abort();
  }, [api, catalog, doctor, mode, from, until, slotReload, frozen, machine.receipt]);
  const update = () => { if (mounted.current) changed((value) => value + 1); };
  const save = async (recover = false) => {
    try {
      let task: Promise<unknown>;
      if (recover) task = machine.recover();
      else {
        if (!catalog || !doctor || !selectedSlot) return;
        const normalizedPhone = normalizeBookingPhone(phone);
        if (!normalizedPhone) { setFormError('Enter a 10-digit Indian mobile or an international number with +country code.'); return; }
        task = machine.execute({ slotToken: selectedSlot.slotToken, name: name.trim(), phone: normalizedPhone, ...(email.trim() ? { email: email.trim() } : {}), ...(reason.trim() ? { reason: reason.trim() } : {}) }, { slot: selectedSlot, clinicName: catalog.clinicName, doctorName: doctor.name, mode, timezone: catalog.timezone });
      }
      update(); await task;
    } catch (error) { if (mounted.current && !machine.error) setFormError(error instanceof Error ? error.message : 'Could not complete booking.'); if (!machine.unknown) { setStep(1); setSlotReload((value) => value + 1); } }
    finally { update(); }
  };
  const leave = () => { if (!frozen) onBack(); };
  if (machine.receipt) {
    const receipt = machine.receipt;
    return <section className="mx-auto max-w-4xl px-6 py-12 text-[#203728]"><div className={card}><CheckCircle2 className="mb-5 size-10 text-[#234b35]" /><h1 className="text-3xl font-semibold">Appointment confirmed</h1><p className="mt-3 text-lg">Your booking is saved with {receipt.clinicName}.</p><dl className="mt-8 grid grid-cols-2 gap-6"><div><dt className="text-[#637160]">Booking reference</dt><dd className="mt-1 font-semibold">{receipt.confirmationCode}</dd></div><div><dt className="text-[#637160]">Doctor</dt><dd className="mt-1">{receipt.doctorName}</dd></div><div><dt className="text-[#637160]">Date & time</dt><dd className="mt-1">{dateLabel(bookingDay(receipt.startsAt, receipt.timezone))} · {timeLabel(receipt.startsAt, receipt.timezone)}<br />{receipt.timezone}</dd></div><div><dt className="text-[#637160]">Visit & fee</dt><dd className="mt-1">{receipt.visitMode === 'virtual' ? 'Teleconsultation' : 'In-person visit'} · {money(receipt.feeMinor)}</dd></div></dl><p className="mt-8 text-[#637160]">For changes or questions, contact hospital reception. This screen does not confirm a WhatsApp message or video link was sent.</p><div className="mt-8 flex flex-wrap gap-3"><button className={primary} onClick={onBack}>Back to website</button><button className={secondary} onClick={() => { machine.reset(); setSelectedSlot(null); setName(''); setPhone(''); setEmail(''); setReason(''); setStep(1); setSlotReload((value) => value + 1); update(); }}>Book another appointment</button></div></div></section>;
  }
  return <section className="mx-auto max-w-5xl px-6 py-10 text-[#203728]">
    <button type="button" className="mb-6 inline-flex items-center gap-2 font-medium text-[#234b35] disabled:opacity-50" onClick={leave} disabled={frozen}><ArrowLeft className="size-4" />Back to website</button>
    <h1 className="text-3xl font-semibold md:text-4xl">Book an appointment</h1><p className="mt-3 text-lg text-[#637160]">{catalog?.clinicName ?? 'Sri Lakshmi Hospital'} · Choose a published time, add your details, then confirm.</p>
    <ol className="my-8 grid grid-cols-3 gap-3" aria-label="Booking progress">{['Choose a time', 'Patient details', 'Review & confirm'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={`rounded-xl border px-4 py-3 ${step === index + 1 ? 'border-[#234b35] bg-[#edf1e8] font-semibold' : 'border-[#dddcd2] text-[#637160]'}`}>{index + 1}. {label}</li>)}</ol>
    {machine.unknown && <div role="alert" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-6"><h2 className="text-xl font-semibold">We need to confirm the original booking</h2><p className="mt-2">The request is kept in this browser tab. Please recover it before choosing another time or booking again.</p>{machine.context && <p className="mt-2">{machine.context.doctorName} · {dateLabel(bookingDay(machine.context.slot.startsAt, machine.context.timezone))} · {timeLabel(machine.context.slot.startsAt, machine.context.timezone)}</p>}<p className="mt-3">{machine.error}</p><button type="button" className={`${primary} mt-4`} disabled={machine.busy || !machine.context} onClick={() => void save(true)}>{machine.busy ? 'Checking original request…' : 'Recover original booking'}</button></div>}
    {(machine.error && !machine.unknown || formError) && <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">{machine.error || formError}</p>}
    {catalogLoading ? <p role="status" className={card}>Loading hospital doctors and booking dates…</p> : catalogError ? <div role="alert" className={card}><p>{catalogError}</p><button className={`${secondary} mt-4`} disabled={frozen} onClick={() => setReload((value) => value + 1)}>Try loading booking again</button></div> : catalog && <div className={card}>
      {step === 1 && <><h2 className="mb-5 text-2xl font-semibold">Choose a doctor and visit</h2>{requestedDoctorId && !mapped && <p className="mb-5 rounded-xl bg-[#f6f4ef] p-4">The doctor from the website is not linked to a published booking profile. Choose a doctor from the hospital’s booking list below.</p>}
        <label className="block font-medium" htmlFor="hms-doctor">Doctor</label><select id="hms-doctor" className={`${input} mt-2`} value={doctorSlug} disabled={frozen} onChange={(event) => { setDoctorSlug(event.target.value); setSelectedSlot(null); setSelectedDay(''); setMode('in_person'); }}><option value="">Choose a published doctor</option>{catalog.doctors.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.name}{entry.specialty ? ` · ${entry.specialty}` : ''}</option>)}</select>
        {!catalog.doctors.length && <p className="mt-4 text-[#637160]">No doctors are published for online booking yet. Please contact hospital reception.</p>}
        {doctor && <><div className="my-6 flex gap-3" role="group" aria-label="Visit type"><button className={mode === 'in_person' ? primary : secondary} disabled={frozen} aria-pressed={mode === 'in_person'} onClick={() => { setMode('in_person'); setSelectedSlot(null); }}><MapPin className="size-4" />In person</button><button className={mode === 'virtual' ? primary : secondary} disabled={frozen || !doctor.acceptsVirtual} aria-pressed={mode === 'virtual'} onClick={() => { setMode('virtual'); setSelectedSlot(null); }}><Video className="size-4" />Teleconsultation</button></div>{!doctor.acceptsVirtual && <p className="mb-5 text-[#637160]">Teleconsultation is not published for this doctor.</p>}
          <div className="mb-5 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="size-5" />{from && dateLabel(from)} – {until && dateLabel(until)}</h3><div className="flex gap-2"><button className="rounded-full border border-[#cfd5c9] p-3 disabled:opacity-40" aria-label="Previous week" disabled={frozen || from <= catalog.today} onClick={() => setFrom(addBookingDays(from, -7) < catalog.today ? catalog.today : addBookingDays(from, -7))}><ChevronLeft className="size-4" /></button><button className="rounded-full border border-[#cfd5c9] p-3 disabled:opacity-40" aria-label="Next week" disabled={frozen || until >= catalog.bookingUntil} onClick={() => setFrom(addBookingDays(from, 7))}><ChevronRight className="size-4" /></button></div></div>
          {slotsLoading ? <p role="status">Loading published appointment times…</p> : slotsError ? <div role="alert"><p>{slotsError}</p><button className={`${secondary} mt-4`} disabled={frozen} onClick={() => setSlotReload((value) => value + 1)}>Try loading times again</button></div> : !slots.length ? <p className="rounded-xl bg-[#f6f4ef] p-5">No {mode === 'virtual' ? 'teleconsultation' : 'in-person'} times are available this week. Try the next week or another doctor.</p> : <><div className="flex flex-wrap gap-3" aria-label="Available dates">{days.map((day) => <button key={day} className={day === selectedDay ? primary : secondary} aria-pressed={day === selectedDay} disabled={frozen} onClick={() => { setSelectedDay(day); setSelectedSlot(null); }}>{dateLabel(day)}</button>)}</div><p className="my-4 text-[#637160]">Times shown in {catalog.timezone}. Availability is checked again when you confirm.</p><div className="flex flex-wrap gap-3" aria-label="Available times">{slots.filter((slot) => bookingDay(slot.startsAt, catalog.timezone) === selectedDay).map((slot) => <button key={slot.slotToken} aria-pressed={slot.slotToken === selectedSlot?.slotToken} className={slot.slotToken === selectedSlot?.slotToken ? primary : secondary} disabled={frozen} onClick={() => setSelectedSlot(slot)}>{timeLabel(slot.startsAt, catalog.timezone)} · {money(slot.feeMinor)}</button>)}</div></>}
          <button className={`${primary} mt-8`} disabled={frozen || slotsLoading || !!slotsError || !selectedSlot} onClick={() => { setStep(2); setFormError(''); }}>Continue to patient details<ChevronRight className="size-4" /></button>
        </>}
      </>}
      {step === 2 && <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); const normalized = normalizeBookingPhone(phone); if (name.trim().length < 2 || !normalized || (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) { setFormError('Enter the patient’s name, a valid mobile number and a valid email if provided.'); return; } setFormError(''); setStep(3); }}><h2 className="text-2xl font-semibold">Patient details</h2><p className="text-[#637160]">Reception will use these details for this appointment. Phone verification and patient account access are not part of this form.</p><fieldset disabled={frozen} className="space-y-5"><div><label className="mb-2 block font-medium" htmlFor="hms-name">Patient name</label><input id="hms-name" autoComplete="name" className={input} value={name} maxLength={100} required onChange={(event) => setName(event.target.value)} /></div><div><label className="mb-2 block font-medium" htmlFor="hms-phone">Mobile number</label><input id="hms-phone" type="tel" autoComplete="tel" className={input} value={phone} maxLength={25} placeholder="10-digit mobile or +country code" required onChange={(event) => setPhone(event.target.value)} /></div><div><label className="mb-2 block font-medium" htmlFor="hms-email">Email · optional</label><input id="hms-email" type="email" autoComplete="email" className={input} value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} /></div><div><label className="mb-2 block font-medium" htmlFor="hms-reason">Visit reason · optional</label><textarea id="hms-reason" className={input} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /><p className="mt-2 text-sm text-[#637160]">A brief reason is enough. Avoid uploading or entering medical records here.</p></div></fieldset><div className="flex gap-3"><button type="button" className={secondary} disabled={frozen} onClick={() => setStep(1)}>Back to times</button><button type="submit" className={primary} disabled={frozen}>Review appointment<ChevronRight className="size-4" /></button></div></form>}
      {step === 3 && doctor && selectedSlot && <><h2 className="text-2xl font-semibold">Review your appointment</h2><dl className="mt-6 grid grid-cols-2 gap-6"><div><dt className="text-[#637160]">Doctor</dt><dd className="mt-1 font-medium">{doctor.name}</dd></div><div><dt className="text-[#637160]">Visit</dt><dd className="mt-1">{mode === 'virtual' ? 'Teleconsultation' : 'In person'}</dd></div><div><dt className="text-[#637160]">Date & time</dt><dd className="mt-1">{dateLabel(bookingDay(selectedSlot.startsAt, catalog.timezone))} · {timeLabel(selectedSlot.startsAt, catalog.timezone)}<br />{catalog.timezone}</dd></div><div><dt className="text-[#637160]">Consultation fee</dt><dd className="mt-1">{money(selectedSlot.feeMinor)}</dd></div><div><dt className="text-[#637160]">Patient</dt><dd className="mt-1">{name.trim()}</dd></div><div><dt className="text-[#637160]">Mobile</dt><dd className="mt-1">{normalizeBookingPhone(phone)}</dd></div></dl>{reason.trim() && <p className="mt-5">Visit reason: {reason.trim()}</p>}<p className="my-6 text-[#637160]">Confirming saves this appointment with the hospital. No payment is collected here.</p><div className="flex gap-3"><button className={secondary} disabled={frozen} onClick={() => setStep(2)}>Edit patient details</button><button className={primary} disabled={frozen} onClick={() => void save()}>{machine.busy ? 'Confirming…' : 'Confirm appointment'}</button></div></>}
    </div>}
  </section>;
}
