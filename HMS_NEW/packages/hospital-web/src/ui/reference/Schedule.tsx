import { useWebsite } from "../Runtime";
import { LiveSchedule } from "./LiveSchedule";
import { useState, useEffect, useRef } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "../../vendor/arc/button/button";
import { doctors, specialtyName } from "../data";
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayPattern: Record<string, number[]> = {
  "ananya-rao": [1, 2, 3, 4, 5, 6],
  "karthik-shah": [1, 3, 5],
  "meera-iyer": [1, 2, 3, 4, 5],
  "rahul-menon": [1, 2, 3, 4, 5, 6],
  "neha-patel": [2, 4, 6],
  "arjun-kumar": [1, 2, 3, 4, 5],
};
function DemoSchedule({
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
  const eligible = doctors.filter(
    (d) => !specialty || d.specialty === specialty,
  );
  const [selectedDoctor, setSelectedDoctor] = useState(
    doctorId || (!scan && eligible.length === 1 ? eligible[0].id : ""),
  );
  const [week, setWeek] = useState(0),
    [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [selected, setSelected] = useState(false);
  const selectedHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (selected) {
      selectedHeading.current?.focus({ preventScroll: true });
      selectedHeading.current?.scrollIntoView?.({
        block: "center",
        behavior: "instant",
      });
    }
  }, [selected]);
  const doctor = doctors.find((d) => d.id === selectedDoctor);
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + week + i);
    return d;
  });
  const shown = scan || doctor;
  const working =
    scan ||
    (!!doctor &&
      !!date &&
      dayPattern[doctor.id].includes(new Date(date + "T12:00:00").getDay()));
  const dateLabel = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";
  return (
    <section
      className="hje-schedule"
      id="schedule"
      aria-labelledby="schedule-heading"
    >
      <div className="hje-container">
        <div className="hje-schedule-heading">
          <h2 id="schedule-heading">
            {scan
              ? "Scan appointments"
              : "Consultant schedules & available slots"}
          </h2>
          <p>
            Choose a suitable time. The appointment assistant handles the next
            step.
          </p>
          <span className="hje-demo-label">
            Example schedule · Indian Standard Time · no live availability
            connected
          </span>
        </div>
        {selected ? (
          <div className="hje-slot-selected" role="status">
            <Check size={32} />
            <h3 ref={selectedHeading} tabIndex={-1}>
              Slot selected
            </h3>
            <p className="hje-slot-summary">
              {scan ? context : doctor?.name}
              <br />
              {dateLabel} · {time} IST
            </p>
            <h4>Your appointment assistant takes it from here.</h4>
            <p>
              This UI demonstrates the handoff. No appointment is reserved or
              confirmed, and no message has been sent.
            </p>
            <Button variant="secondary" onClick={() => setSelected(false)}>
              Change selection
            </Button>
          </div>
        ) : (
          <div className="hje-schedule-grid">
            {!scan && !doctorId && (
              <aside
                className="hje-schedule-people"
                aria-label="Choose a consultant"
              >
                <h3>Choose your consultant</h3>
                {eligible.map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    aria-pressed={selectedDoctor === d.id}
                    onClick={() => {
                      setSelectedDoctor(d.id);
                      setDate("");
                      setTime("");
                    }}
                  >
                    <span>{d.initials}</span>
                    <span>
                      <strong>{d.name}</strong>
                      <small>{specialtyName(d.specialty)}</small>
                    </span>
                  </button>
                ))}
                {!eligible.length && (
                  <p>
                    No consultant schedules are published for this selection.
                  </p>
                )}
              </aside>
            )}
            <div className="hje-schedule-calendar">
              {shown ? (
                <>
                  <div className="hje-calendar-title">
                    <div>
                      <h3>{scan ? context : doctor?.name}</h3>
                      <p>
                        {scan
                          ? "Imaging schedule"
                          : specialtyName(doctor?.specialty || "")}{" "}
                        · illustrative availability
                      </p>
                    </div>
                    <CalendarDays size={22} />
                  </div>
                  <div className="hje-week-controls">
                    <h4>Choose a date</h4>
                    <div>
                      <button
                        aria-label="Previous week"
                        disabled={week === 0}
                        onClick={() => {
                          setWeek(Math.max(0, week - 7));
                          setDate("");
                          setTime("");
                        }}
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        aria-label="Next week"
                        disabled={week === 21}
                        onClick={() => {
                          setWeek(week + 7);
                          setDate("");
                          setTime("");
                        }}
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="hje-days">
                    {dates.map((d) => (
                      <button
                        key={key(d)}
                        aria-label={
                          "Choose " +
                          d.toLocaleDateString("en-IN", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })
                        }
                        aria-pressed={date === key(d)}
                        onClick={() => {
                          setDate(key(d));
                          setTime("");
                        }}
                      >
                        <span>
                          {d.toLocaleDateString("en-IN", { weekday: "short" })}
                        </span>
                        <strong>{d.getDate()}</strong>
                        <span>
                          {d.toLocaleDateString("en-IN", { month: "short" })}
                        </span>
                      </button>
                    ))}
                  </div>
                  {date &&
                    (working ? (
                      <>
                        <h4 className="hje-times-title">
                          Available slot examples
                        </h4>
                        <div className="hje-times">
                          {[
                            "09:00 AM",
                            "09:30 AM",
                            "10:00 AM",
                            "10:30 AM",
                            "11:00 AM",
                            "11:30 AM",
                            "02:00 PM",
                            "02:30 PM",
                          ].map((t, i) => (
                            <button
                              key={t}
                              aria-pressed={time === t}
                              disabled={i === 3}
                              onClick={() => setTime(t)}
                            >
                              {t}
                              {i === 3 && <small>Unavailable</small>}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="hje-no-slots" role="status">
                        <Clock size={24} />
                        <h4>No slots in this example schedule</h4>
                        <p>
                          Choose another date or consultant to see example
                          availability.
                        </p>
                      </div>
                    ))}
                  <div className="hje-slot-action">
                    {time && (
                      <p>
                        <Clock size={16} />
                        {dateLabel} · {time}
                      </p>
                    )}
                    <Button
                      disabled={!date || !time}
                      onClick={() => setSelected(true)}
                    >
                      Continue with this slot <ArrowRight size={16} />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="hje-no-slots">
                  <CalendarDays size={28} />
                  <h3>Choose a consultant to see their schedule</h3>
                  <p>
                    Published slots will appear here when availability is
                    connected. This preview includes labelled example schedules.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function Schedule(props: {
  doctorId?: string;
  specialty?: string;
  context?: string;
  scan?: boolean;
}) {
  const { demoEnabled } = useWebsite();
  return demoEnabled ? (
    <DemoSchedule {...props} />
  ) : (
    <LiveSchedule {...props} />
  );
}
