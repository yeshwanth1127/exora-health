import { ArrowRight, CalendarDays, Phone } from "lucide-react";
import { useWebsite } from "../../Runtime";
import { Schedule } from "../Schedule";
import { A } from "./A";
import { Crumb } from "./Crumb";
import { FloatingActions } from "./FloatingActions";
import { Missing } from "./Missing";
import { Pill } from "./Pill";

export function ConsultantProfile({ id }: { id: string }) {
  const { doctors, services, demoEnabled } = useWebsite();
  const specialtyName = (id: string) =>
    services.find((s) => s.id === id)?.name || id;
  const d = doctors.find((d) => d.id === id);
  if (!d) return <Missing />;
  return (
    <>
      <FloatingActions />
      <section className="hje-profile-intro">
        <div className="hje-container">
          <Crumb
            items={[
              {
                label: specialtyName(d.specialty) + " clinic",
                to: services.some((s) => s.id === d.specialty)
                  ? "/clinics/" + d.specialty
                  : undefined,
              },
              { label: d.name },
            ]}
          />
          <div className="hje-profile-grid">
            <div>
              <h1>{d.name}</h1>
              <p>{d.qualifications}</p>
              <h2>Consultant · {specialtyName(d.specialty)}</h2>
              <p className="hje-profile-age">
                <strong>Consultant sees</strong>
                <span className="hje-age-tag">
                  {demoEnabled
                    ? d.specialty === "paediatrics"
                      ? "Children"
                      : "Adult"
                    : "Contact hospital for age eligibility"}
                </span>
              </p>
              <div className="hje-profile-actions">
                <Pill to="/contact">
                  <Phone size={16} />
                  Contact reception
                </Pill>
                <Pill to="#schedule">
                  <CalendarDays size={16} />
                  See appointment times
                </Pill>
              </div>
            </div>
            <div className="hje-profile-portrait">
              <span>{d.initials}</span>
              <small>
                {demoEnabled
                  ? "Example clinician profile"
                  : "Consultant profile"}
              </small>
            </div>
          </div>
        </div>
      </section>
      <section className="hje-prose hje-container">
        <p>{d.bio}</p>
        <p>
          Review qualifications, languages and consultation information before
          choosing a time. The appointment assistant continues the journey after
          you select a slot.
        </p>
        <div className="hje-profile-facts">
          <div>
            <strong>Qualifications</strong>
            <p>{d.qualifications}</p>
          </div>
          <div>
            <strong>Experience</strong>
            <p>
              {d.experience}
              {demoEnabled ? " · example" : ""}
            </p>
          </div>
          <div>
            <strong>Languages</strong>
            <p>{d.languages}</p>
          </div>
          <div>
            <strong>
              {demoEnabled
                ? "Example consultation days"
                : "Consultation availability"}
            </strong>
            <p>{d.days}</p>
          </div>
        </div>
        <p className="hje-small hje-muted">
          {demoEnabled
            ? "Sample clinician information for UI review. It is not the hospital’s verified roster."
            : "Information published by the hospital. Please ask your care team about your individual needs."}
        </p>
        <A to="/consultants" className="hje-back">
          Back to Consultant Finder <ArrowRight size={16} />
        </A>
      </section>
      <Schedule doctorId={d.id} />
    </>
  );
}
