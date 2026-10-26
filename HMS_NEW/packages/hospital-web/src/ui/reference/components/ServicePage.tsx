import { ArrowRight, ChevronRight, MapPin } from "lucide-react";
import { useWebsite } from "../../Runtime";
import { contentNotice } from "../content";
import { Schedule } from "../Schedule";
import { A } from "./A";
import { Faq } from "./Faq";
import { FloatingActions } from "./FloatingActions";
import { Hero } from "./Hero";
import { Missing } from "./Missing";
import { Pill } from "./Pill";
import { RelatedConsultants } from "./RelatedConsultants";

export function ServicePage({ id }: { id: string }) {
  const { hospital, services, treatments, demoEnabled } = useWebsite();

  const normal = id === "orthopaedic" ? "orthopaedics" : id;
  const item = services.find((s) => s.id === normal);
  if (!item) return <Missing />;
  const linked = treatments.filter((t) => t.specialty === item.id);
  return (
    <>
      <FloatingActions />
      <Hero
        title={item.name + " clinic"}
        summary={item.description}
        image={item.image}
        service
      />
      <section className="hje-prose hje-container">
        <h2>
          {item.name} at {hospital.name}
        </h2>
        <p>
          {item.description} Review the appointment information and choose the
          consultant you would like to see. Your care team can explain which
          assessment, investigations or treatment options are appropriate for
          you.
        </p>
        <h3>Conditions and concerns we assess</h3>
        <ul>
          {item.conditions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <h3>Preparing for your consultation</h3>
        <p>{item.prepare} Confirm specific instructions with the care team.</p>
        <p className="hje-small hje-muted">
          {demoEnabled
            ? contentNotice
            : "Confirm individual assessment and preparation instructions with your care team."}
        </p>
      </section>
      <section className="hje-service-subclinics hje-container">
        <h2>Your {item.name.toLowerCase()} clinic</h2>
        <div className="hje-plain-links">
          {linked.map((t) => (
            <A to={"/treatments/" + t.id} key={t.id}>
              <ChevronRight size={16} />
              {t.name}
            </A>
          ))}
          <A to={"/consultants?service=" + item.id}>
            <ChevronRight size={16} />
            Find a consultant
          </A>
          <A to="/tests-scans">
            <ChevronRight size={16} />
            Tests & scans
          </A>
        </div>
      </section>
      <RelatedConsultants specialty={item.id} />
      <section className="hje-patient-band">
        <div className="hje-container">
          <h2>Patient information</h2>
          <p>
            Find practical information about visiting, payment options and
            preparing for your appointment.
          </p>
          <Pill to="/patient-information">
            All you need to know <ArrowRight size={16} />
          </Pill>
        </div>
      </section>
      <section className="hje-location hje-container">
        <div>
          <h2>Where to find us</h2>
          <p>
            {hospital.name}
            <br />
            {hospital.area}
          </p>
          <p>
            Check the location information and confirm the exact address before
            travelling.
          </p>
          <Pill outline to="/visit">
            Location & directions <MapPin size={16} />
          </Pill>
        </div>
        <div
          className="hje-location-graphic"
          aria-label="Illustrative locality graphic"
        >
          <MapPin size={38} />
          <span>{hospital.area}</span>
          <small>Exact address awaiting confirmation</small>
        </div>
      </section>
      <section className="hje-faq-section hje-container">
        <h2>{item.name}: frequently asked questions</h2>
        <Faq
          questions={[
            "How do I find a consultant?",
            "What should I bring?",
            "How are treatment options discussed?",
            "How do I ask about fees?",
          ]}
        />
      </section>
      <Schedule specialty={item.id} />
    </>
  );
}
