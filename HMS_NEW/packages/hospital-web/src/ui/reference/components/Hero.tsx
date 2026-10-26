import { ArrowRight, CalendarDays, Phone } from "lucide-react";
import { A } from "./A";
import { Crumb } from "./Crumb";
import { Pill } from "./Pill";

export function Hero({
  title,
  summary,
  image,
  crumb,
  knownAs,
  scan = false,
  service = false,
}: {
  title: string;
  summary: string;
  image: string;
  crumb?: { label: string; to?: string }[];
  knownAs?: string;
  scan?: boolean;
  service?: boolean;
}) {
  return (
    <section className="hje-hero">
      <img
        className="hje-hero-image"
        src={image}
        alt="Illustrative care photograph"
      />
      <div className="hje-container">
        <div className="hje-hero-grid">
          <div className="hje-hero-panel">
            {crumb && <Crumb items={crumb} />}
            <h1>{title}</h1>
            <p>{summary}</p>
            <p>
              {service
                ? "Explore the example care team, review related treatments and see consultant schedules. Choose a suitable slot to continue with the appointment assistant."
                : "Explore the information below, see the next steps and view example appointment availability. Actual services and clinical information require confirmation with the hospital."}
            </p>
            {knownAs && (
              <p>
                <strong>Also known as:</strong> {knownAs}
              </p>
            )}
            {!service && (
              <div className="hje-hero-price">
                <span>Pricing on enquiry</span>
                <A to="#pricing">See pricing details</A>
              </div>
            )}
            <div className="hje-hero-actions">
              <Pill to="/contact">
                <Phone size={16} />
                Contact reception
              </Pill>
              <Pill to="#schedule">
                <CalendarDays size={16} />
                {scan ? "View scan slots" : "See appointment times"}
              </Pill>
            </div>
            {scan && (
              <A className="hje-hero-enquiry" to="/contact">
                General enquiry <ArrowRight size={15} />
              </A>
            )}
          </div>
        </div>
      </div>
      <span className="hje-image-note">Illustrative reference photography</span>
    </section>
  );
}
