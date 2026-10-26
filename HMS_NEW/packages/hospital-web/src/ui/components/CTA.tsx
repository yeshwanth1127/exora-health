import { ButtonLink } from "./ButtonLink";

export function CTA() {
  return (
    <section className="cta">
      <div className="container">
        <div>
          <h2>Your next step starts here.</h2>
          <p>Find a doctor and try the appointment journey.</p>
        </div>
        <ButtonLink to="/book">Book an appointment</ButtonLink>
      </div>
    </section>
  );
}
