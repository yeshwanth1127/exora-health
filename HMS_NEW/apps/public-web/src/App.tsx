import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  HeartPulse,
  LoaderCircle,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { VoiceCall } from "./VoiceCall";

type Facility = {
  facilityId: string;
  name: string;
  city: string | null;
  timezone: string;
};
type Practitioner = {
  staffId: string;
  name: string;
  specialtyName: string | null;
  department: string;
  facilityId: string;
  acceptsVirtual: boolean | null;
};
type Slot = {
  slotStart: string;
  slotEnd: string;
  facilityId: string;
  visitMode: "in_person" | "virtual";
};
type Bootstrap = {
  tenant: { name: string; slug: string; planCode: string | null };
  facilities: Facility[];
  practitioners: Practitioner[];
  analytics?: { siteId: string; script: string } | null;
};
type Patient = { name: string; phone: string; email: string; reason: string };

const json = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      body?.error?.message || "Something went wrong. Please try again.",
    );
  return body as T;
};
const key = () => crypto.randomUUID();
const indianMobile = (value: string) => {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 10);
};
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const dates = Array.from({ length: 7 }, (_, offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
});

export function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [doctor, setDoctor] = useState<Practitioner | null>(null);
  const [visitMode, setVisitMode] = useState<Slot["visitMode"]>("in_person");
  const [day, setDay] = useState(dateKey(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [patient, setPatient] = useState<Patient>({
    name: "",
    phone: "",
    email: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    code: string;
    appointmentId: string;
  } | null>(null);
  const facility = useMemo(
    () =>
      data?.facilities.find((item) => item.facilityId === doctor?.facilityId) ||
      data?.facilities[0],
    [data, doctor],
  );
  const visibleSlots = useMemo(
    () => slots.filter((item) => item.visitMode === visitMode),
    [slots, visitMode],
  );

  useEffect(() => {
    json<Bootstrap>("/public/v1/bootstrap")
      .then((value) => {
        setData(value);
        // Company-hosted websites need no snippet installation by the clinic.
        if (value.analytics && !document.querySelector('script[data-hms-analytics]')) {
          const tracker = document.createElement('script');
          tracker.src = '/a.js';
          tracker.dataset.site = value.analytics.siteId;
          tracker.dataset.hmsAnalytics = 'true';
          tracker.defer = true;
          document.head.append(tracker);
        }
        document.title = `${value.tenant.name} · Appointments`;
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!doctor || !facility) return;
    setSlots([]);
    setSlot(null);
    setError("");
    json<{ items: Slot[] }>(
      `/public/v1/practitioners/${doctor.staffId}/slots?facilityId=${facility.facilityId}&from=${day}&to=${day}`,
    )
      .then((value) => setSlots(value.items))
      .catch((reason: Error) => setError(reason.message));
  }, [doctor, day, facility]);

  const book = async () => {
    if (!doctor || !facility || !slot) return;
    setSubmitting(true);
    setError("");
    try {
      const hold = await json<{ reservationId: string }>("/public/v1/holds", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": key(),
        },
        body: JSON.stringify({
          facilityId: facility.facilityId,
          staffId: doctor.staffId,
          slotStart: slot.slotStart,
        }),
      });
      const booked = await json<{
        confirmationCode: string;
        appointmentId: string;
      }>("/public/v1/appointments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": key(),
        },
        body: JSON.stringify({
          reservationId: hold.reservationId,
          ...patient,
          phone: `+91${patient.phone}`,
          email: patient.email || undefined,
          reason: patient.reason || undefined,
        }),
      });
      setConfirmation({
        code: booked.confirmationCode,
        appointmentId: booked.appointmentId,
      });
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <main className="center-state">
        <LoaderCircle className="spin" />
        <p>Opening the clinic…</p>
      </main>
    );
  if (!data)
    return (
      <main className="center-state">
        <HeartPulse />
        <h1>We could not open this clinic.</h1>
        <p>{error}</p>
      </main>
    );
  const brand = data.tenant.name;

  return (
    <div className="page">
      <header className="header">
        <a className="brand" href="/">
          <span>
            <HeartPulse />
          </span>
          <strong>{brand}</strong>
        </a>
        <div className="powered">
          Powered by <b>Paperwhale</b>
        </div>
      </header>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">
              <span /> Patient appointments
            </p>
            <h1>
              Care, on a day
              <br />
              that works for you.
            </h1>
            <p className="lede">
              Choose your doctor and see real appointment availability. Your
              booking goes directly to {brand}.
            </p>
            <div className="trust">
              <span>
                <ShieldCheck /> Private and secure
              </span>
              <span>
                <Clock3 /> Live availability
              </span>
            </div>
          </div>
          <div className="clinic-card">
            <div className="clinic-icon">
              <Stethoscope />
            </div>
            <p>Now booking</p>
            <h2>{facility?.name || brand}</h2>
            <span>
              <MapPin /> {facility?.city || "Online"}
            </span>
            <div className="clinic-line" />
            <small>
              {data.practitioners.length} care professional
              {data.practitioners.length === 1 ? "" : "s"} available
            </small>
          </div>
        </section>

        <section className="booking" id="book">
          <div className="booking-heading">
            <p className="eyebrow">
              <span /> Book an appointment
            </p>
            <h2>
              {confirmation
                ? "Your visit is confirmed."
                : "Find the right time."}
            </h2>
          </div>
          {confirmation ? (
            <div className="confirmation">
              <span className="check">
                <Check />
              </span>
              <p className="eyebrow">Booking confirmed</p>
              <h3>We’ll see you soon, {patient.name.split(" ")[0]}.</h3>
              <div className="confirmation-grid">
                <div>
                  <small>Doctor</small>
                  <strong>{doctor?.name}</strong>
                </div>
                <div>
                  <small>Visit</small>
                  <strong>
                    {slot?.visitMode === "virtual"
                      ? "Video consultation"
                      : "At the clinic"}
                  </strong>
                </div>
                <div>
                  <small>When</small>
                  <strong>
                    {slot &&
                      new Date(slot.slotStart).toLocaleString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                  </strong>
                </div>
                <div>
                  <small>Confirmation code</small>
                  <strong>{confirmation.code}</strong>
                </div>
              </div>
              <p className="note">
                Keep your confirmation code. The clinic can use it to locate
                your appointment.
              </p>
            </div>
          ) : data.practitioners.length === 0 ? (
            <div className="empty">
              <CalendarDays />
              <h3>Online appointments are being prepared.</h3>
              <p>
                {brand} has not published its doctors and schedules yet. Please
                contact the clinic directly for an appointment.
              </p>
            </div>
          ) : (
            <div className="flow">
              <div className="flow-step">
                <div className="step-label">
                  <span>01</span>
                  <div>
                    <h3>Choose a doctor</h3>
                    <p>Select the care professional you want to meet.</p>
                  </div>
                </div>
                <div className="doctor-grid">
                  {data.practitioners.map((item) => (
                    <button
                      key={`${item.staffId}-${item.facilityId}`}
                      className={
                        doctor?.staffId === item.staffId
                          ? "doctor selected"
                          : "doctor"
                      }
                      onClick={() => {
                        setDoctor(item);
                        setVisitMode("in_person");
                        setSlot(null);
                      }}
                    >
                      <span className="avatar">
                        {item.name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.specialtyName || item.department}</small>
                      </span>
                      {doctor?.staffId === item.staffId && <Check />}
                    </button>
                  ))}
                </div>
              </div>
              {doctor && (
                <div className="flow-step">
                  <div className="step-label">
                    <span>02</span>
                    <div>
                      <h3>Pick a date and time</h3>
                      <p>
                        Times are shown in{" "}
                        {facility?.timezone || "the clinic timezone"}.
                      </p>
                    </div>
                  </div>
                  <div className="visit-mode-row">
                    <button
                      className={visitMode === "in_person" ? "selected" : ""}
                      onClick={() => {
                        setVisitMode("in_person");
                        setSlot(null);
                      }}
                    >
                      <Stethoscope /> At the clinic
                    </button>
                    {doctor.acceptsVirtual && (
                      <button
                        className={visitMode === "virtual" ? "selected" : ""}
                        onClick={() => {
                          setVisitMode("virtual");
                          setSlot(null);
                        }}
                      >
                        <Video /> Video consultation
                      </button>
                    )}
                  </div>
                  <div className="date-row">
                    {dates.map((value) => (
                      <button
                        key={dateKey(value)}
                        onClick={() => setDay(dateKey(value))}
                        className={day === dateKey(value) ? "selected" : ""}
                      >
                        <small>
                          {value.toLocaleDateString("en-IN", {
                            weekday: "short",
                          })}
                        </small>
                        <strong>{value.getDate()}</strong>
                        <span>
                          {value.toLocaleDateString("en-IN", {
                            month: "short",
                          })}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="slot-row">
                    {visibleSlots.length ? (
                      visibleSlots.map((item) => (
                        <button
                          key={item.slotStart}
                          className={
                            slot?.slotStart === item.slotStart ? "selected" : ""
                          }
                          onClick={() => setSlot(item)}
                        >
                          <Clock3 />
                          {new Date(item.slotStart).toLocaleTimeString(
                            "en-IN",
                            { hour: "numeric", minute: "2-digit" },
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="no-slots">
                        No open{" "}
                        {visitMode === "virtual"
                          ? "video consultation"
                          : "clinic"}{" "}
                        times on this date. Try another day.
                      </p>
                    )}
                  </div>
                </div>
              )}
              {slot && (
                <div className="flow-step">
                  <div className="step-label">
                    <span>03</span>
                    <div>
                      <h3>Your details</h3>
                      <p>
                        The clinic will use these to identify and contact you.
                      </p>
                    </div>
                  </div>
                  <div className="patient-form">
                    <label>
                      <span>Full name</span>
                      <input
                        value={patient.name}
                        onChange={(e) =>
                          setPatient({ ...patient, name: e.target.value })
                        }
                        placeholder="Patient name"
                      />
                    </label>
                    <label>
                      <span>Mobile number</span>
                      <span className="phone-input">
                        <b>+91</b>
                        <input
                          value={patient.phone}
                          onChange={(e) =>
                            setPatient({
                              ...patient,
                              phone: indianMobile(e.target.value),
                            })
                          }
                          placeholder="9876543210"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          maxLength={10}
                          aria-label="10-digit mobile number"
                        />
                      </span>
                    </label>
                    <label>
                      <span>
                        Email <i>optional</i>
                      </span>
                      <input
                        value={patient.email}
                        onChange={(e) =>
                          setPatient({ ...patient, email: e.target.value })
                        }
                        placeholder="you@example.com"
                        type="email"
                      />
                    </label>
                    <label className="wide">
                      <span>
                        Reason for visit <i>optional</i>
                      </span>
                      <textarea
                        value={patient.reason}
                        onChange={(e) =>
                          setPatient({ ...patient, reason: e.target.value })
                        }
                        placeholder="A short note for the clinic"
                      />
                    </label>
                  </div>
                  {error && <p className="error">{error}</p>}
                  <button
                    className="book-button"
                    disabled={
                      submitting ||
                      patient.name.trim().length < 2 ||
                      !/^\d{10}$/.test(patient.phone)
                    }
                    onClick={book}
                  >
                    {submitting ? (
                      <LoaderCircle className="spin" />
                    ) : (
                      <CalendarDays />
                    )}{" "}
                    Confirm appointment <ArrowRight />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      <VoiceCall hospitalName={brand} />
      <footer>
        <div className="brand">
          <span>
            <HeartPulse />
          </span>
          <strong>{brand}</strong>
        </div>
        <p>
          <Phone /> For urgent or emergency care, contact your local emergency
          service.
        </p>
        <a href="/staff/appointments">
          Staff sign in <ArrowRight />
        </a>
      </footer>
    </div>
  );
}
