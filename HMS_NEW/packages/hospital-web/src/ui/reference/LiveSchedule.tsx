import { lazy, Suspense, useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useWebsite } from "../Runtime";
import {
  addBookingDays,
  bookingDay,
  type PublicSlot,
} from "../../lib/publicBookingApi";
import { Button } from "../../vendor/arc/button/button";
const VoiceCall = lazy(() => import("../VoiceCall"));
export function LiveSchedule({
  doctorId = "",
  specialty = "",
  context = "",
  scan = false,
}: {
  doctorId?: string;
  specialty?: string;
  context?: string;
  scan?: boolean;
}) {
  const site = useWebsite(),
    { api, catalog, doctors, hospital } = site;
  const eligible = doctors.filter((d) =>
    scan
      ? /imaging|radiolog/i.test(d.specialty)
      : !specialty || d.specialty === specialty,
  );
  const [doctor, setDoctor] = useState(
      doctorId || (!scan && eligible.length === 1 ? eligible[0].id : ""),
    ),
    [week, setWeek] = useState(0),
    [date, setDate] = useState(""),
    [chosen, setChosen] = useState<PublicSlot | null>(null),
    [handoff, setHandoff] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [slots, setSlots] = useState<PublicSlot[]>([]),
    [unpriced, setUnpriced] = useState(false);
  const exact = doctors.find((d) => d.id === doctor);
  const from = catalog ? addBookingDays(catalog.today, week) : "",
    to = catalog
      ? addBookingDays(from, 6) > catalog.bookingUntil
        ? catalog.bookingUntil
        : addBookingDays(from, 6)
      : "";
  const zone = catalog?.timezone || "Asia/Kolkata";
  useEffect(() => {
    if (!api || !catalog || !exact) return;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setSlots([]);
    setChosen(null);
    setHandoff(false);
    api
      .slots(exact.id, "in_person", from, to, zone, abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) {
          setSlots(result.slots);
          setUnpriced(!!result.unpricedSlots?.length);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Could not load availability.",
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [api, doctor, from, to, zone, retry]);
  const dates = catalog
    ? Array.from({ length: 7 }, (_, i) => addBookingDays(from, i)).filter(
        (d) => d <= catalog.bookingUntil,
      )
    : [];
  const label = (d: string) =>
    new Date(d + "T12:00:00Z").toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  const time = (s: PublicSlot) =>
    new Date(s.startsAt).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: zone,
    });
  return (
    <section className="hje-schedule" id="schedule">
      <div className="hje-container">
        <div className="hje-schedule-heading">
          <h2>
            {scan
              ? "Scan appointments"
              : "Consultant schedules & available slots"}
          </h2>
          <p>
            {context ||
              "Choose a consultant and a published time. No appointment form is needed."}
          </p>
          <small>
            Published availability · {zone} · selecting a time does not reserve
            it
          </small>
        </div>
        {!catalog || !api ? (
          <div role="status" className="hje-no-slots">
            <h3>Availability is not published yet</h3>
            <p>
              {site.catalogError ||
                "The hospital has not published online booking availability."}
            </p>
          </div>
        ) : handoff && chosen ? (
          <div className="hje-schedule-calendar">
            <h3>Your selected appointment preference</h3>
            <p>
              {exact?.name} · {label(bookingDay(chosen.startsAt, zone))} ·{" "}
              {time(chosen)}
            </p>
            <p>
              The assistant will recheck availability and confirm your
              appointment during the conversation. This selection has not been
              booked.
            </p>
            <Suspense
              fallback={<p role="status">Loading appointment assistant…</p>}
            >
              <VoiceCall
                hospitalName={hospital.name}
                selection={{ site: api.site, slotToken: chosen.slotToken }}
              />
            </Suspense>
            <Button variant="secondary" onClick={() => setHandoff(false)}>
              Change selection
            </Button>
          </div>
        ) : (
          <div className="hje-schedule-grid">
            {!doctorId && (
              <aside className="hje-schedule-people">
                <h3>Choose your consultant</h3>
                {eligible.map((d) => (
                  <button
                    key={d.id}
                    aria-pressed={doctor === d.id}
                    onClick={() => {
                      setDoctor(d.id);
                      setDate("");
                      setChosen(null);
                    }}
                  >
                    <span>{d.initials}</span>
                    <span>
                      <strong>{d.name}</strong>
                      <small>{d.qualifications}</small>
                    </span>
                  </button>
                ))}
                {!eligible.length && (
                  <p>
                    No {scan ? "imaging specialist" : "consultant"} schedules
                    are published. Contact reception for availability.
                  </p>
                )}
              </aside>
            )}
            <div className="hje-schedule-calendar">
              {exact ? (
                <>
                  <div className="hje-calendar-title">
                    <h3>{exact.name}</h3>
                    <CalendarDays size={22} />
                  </div>
                  <div className="hje-week-controls">
                    <h4>Choose a date</h4>
                    <div>
                      <button
                        aria-label="Previous week"
                        disabled={week === 0 || loading}
                        onClick={() => {
                          setWeek((n) => n - 7);
                          setDate("");
                        }}
                      >
                        <ChevronLeft />
                      </button>
                      <button
                        aria-label="Next week"
                        disabled={
                          addBookingDays(to, 1) > catalog.bookingUntil ||
                          loading
                        }
                        onClick={() => {
                          setWeek((n) => n + 7);
                          setDate("");
                        }}
                      >
                        <ChevronRight />
                      </button>
                    </div>
                  </div>
                  <div className="hje-days">
                    {dates.map((d) => (
                      <button
                        key={d}
                        aria-label={"Choose " + label(d)}
                        aria-pressed={date === d}
                        onClick={() => {
                          setDate(d);
                          setChosen(null);
                        }}
                      >
                        <span>
                          {new Date(d + "T12:00:00Z").toLocaleDateString(
                            "en-IN",
                            { weekday: "short", timeZone: "UTC" },
                          )}
                        </span>
                        <strong>{Number(d.slice(8))}</strong>
                        <span>
                          {new Date(d + "T12:00:00Z").toLocaleDateString(
                            "en-IN",
                            { month: "short", timeZone: "UTC" },
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                  {loading ? (
                    <p role="status">Loading published slots…</p>
                  ) : error ? (
                    <div role="alert">
                      <p>{error}</p>
                      <Button
                        variant="secondary"
                        onClick={() => setRetry((n) => n + 1)}
                      >
                        Reload slots
                      </Button>
                    </div>
                  ) : date ? (
                    <>
                      <h4 className="hje-times-title">Available times</h4>
                      <div className="hje-times">
                        {slots
                          .filter((s) => bookingDay(s.startsAt, zone) === date)
                          .map((s) => (
                            <button
                              key={s.slotToken}
                              aria-pressed={chosen?.slotToken === s.slotToken}
                              onClick={() => setChosen(s)}
                            >
                              {time(s)}
                              <small>
                                {new Intl.NumberFormat("en-IN", {
                                  style: "currency",
                                  currency: "INR",
                                }).format(s.feeMinor / 100)}
                              </small>
                            </button>
                          ))}
                      </div>
                      {!slots.some(
                        (s) => bookingDay(s.startsAt, zone) === date,
                      ) && (
                        <p role="status">
                          No published slots for this date. Choose another day.
                        </p>
                      )}
                    </>
                  ) : (
                    <p>Choose a date to see available times.</p>
                  )}
                  {unpriced && (
                    <p>
                      Some sessions are not bookable online because a fee has
                      not been published.
                    </p>
                  )}
                  <div className="hje-slot-action">
                    <Button
                      disabled={!chosen || loading || !!error}
                      onClick={() => setHandoff(true)}
                    >
                      Continue with appointment assistant
                    </Button>
                  </div>
                </>
              ) : (
                <div className="hje-no-slots">
                  <Clock size={26} />
                  <h3>
                    {doctorId
                      ? "This consultant is not available for online appointments"
                      : "Choose a consultant to see their schedule"}
                  </h3>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
