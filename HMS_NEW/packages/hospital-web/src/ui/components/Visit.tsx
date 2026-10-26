import { MapPin } from "lucide-react";
import { useWebsite } from "../Runtime";
import { ButtonLink } from "./ButtonLink";
import { CTA } from "./CTA";
import { Intro } from "./Intro";
import { SectionTitle } from "./SectionTitle";

export function Visit() {
  const { hospital, demoEnabled, profile } = useWebsite();

  return (
    <>
      <Intro eyebrow="Location & visiting" title="Plan your visit">
        <p>Find practical information before coming to {hospital.name}.</p>
      </Intro>
      <section className="section container split">
        <div className="map-preview">
          <svg viewBox="0 0 550 320" aria-hidden="true">
            <g fill="none" stroke="#d1d3df" strokeWidth="13">
              <path d="M-30 60 580 250M-30 230 580 40M130-30 360 350M330-30 500 350" />
            </g>
            <circle cx="265" cy="166" r="24" fill="#090879" />
            <path d="M265 153v26m-13-13h26" stroke="white" strokeWidth="4" />
          </svg>
          <div>
            <MapPin size={19} />
            <span>
              {hospital.area}
              <small>Illustrative graphic, not a navigation map</small>
            </span>
          </div>
        </div>
        <div>
          <h2>Getting here</h2>
          <p>
            {hospital.name}
            <br />
            {hospital.area}
          </p>
          <p>
            {demoEnabled
              ? "The exact street address, reception number and operating hours are awaiting verification. This preview does not provide live directions."
              : profile?.address ||
                "Address not published. Contact reception before travelling."}
          </p>
          {!demoEnabled && profile?.phone && (
            <p>
              <a href={"tel:" + profile.phone}>{profile.phone}</a>
            </p>
          )}
          {!demoEnabled && profile?.address && (
            <a
              className="text-link"
              href={
                "https://www.google.com/maps/search/?api=1&query=" +
                encodeURIComponent(profile.address)
              }
              target="_blank"
              rel="noreferrer"
            >
              Open directions
            </a>
          )}
          <ButtonLink to="/contact">Location & visiting enquiry</ButtonLink>
        </div>
      </section>
      <section className="section pale">
        <div className="container">
          <SectionTitle title="Before you arrive" />
          <div className="practical-grid">
            {[
              [
                "Your appointment",
                "Check the doctor, date, time and any instructions.",
              ],
              [
                "Your records",
                "Bring relevant reports and a current medication list.",
              ],
              [
                "Your insurance",
                "Carry policy documents and check authorisation requirements.",
              ],
            ].map(([title, copy]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <CTA />
    </>
  );
}
