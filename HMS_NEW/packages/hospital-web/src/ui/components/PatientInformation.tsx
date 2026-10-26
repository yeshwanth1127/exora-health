import { ButtonLink } from "./ButtonLink";
import { FAQList } from "./FAQList";
import { Intro } from "./Intro";
import { SectionTitle } from "./SectionTitle";

export function PatientInformation() {
  return (
    <>
      <Intro eyebrow="Patient information" title="Your visit, step by step">
        <p>
          Clear information to help you prepare, ask questions and find your
          way.
        </p>
      </Intro>
      <section className="section container">
        <div className="journey-list">
          {[
            [
              "01",
              "Find your doctor",
              "Explore specialties, qualifications and example consultation information.",
              "/consultants",
              "Find a doctor",
            ],
            [
              "02",
              "Choose an available slot",
              "See your consultant’s schedule and choose a slot. The appointment assistant handles the next step.",
              "/book",
              "See available slots",
            ],
            [
              "03",
              "Prepare for your visit",
              "Check what to bring, location details and practical information.",
              "/visit",
              "Plan your visit",
            ],
            [
              "04",
              "Understand your payment options",
              "Explore the insurer directory and example health plans.",
              "/insurance",
              "Insurance & payment",
            ],
          ].map(([n, title, copy, to, label]) => (
            <article key={n}>
              <span>{n}</span>
              <div>
                <h2>{title}</h2>
                <p>{copy}</p>
              </div>
              <ButtonLink outline to={to}>
                {label}
              </ButtonLink>
            </article>
          ))}
        </div>
      </section>
      <section className="section pale">
        <div className="container">
          <SectionTitle
            title="Common questions"
            to="/faq"
            label="All questions"
          />
          <FAQList limit={3} />
        </div>
      </section>
    </>
  );
}
