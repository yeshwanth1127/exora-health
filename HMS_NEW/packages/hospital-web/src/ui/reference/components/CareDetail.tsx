import { MapPin } from "lucide-react";
import { useWebsite } from "../../Runtime";
import { contentNotice, type CareItem } from "../content";
import { Schedule } from "../Schedule";
import { Faq } from "./Faq";
import { FloatingActions } from "./FloatingActions";
import { Hero } from "./Hero";
import { Payment } from "./Payment";
import { Pill } from "./Pill";
import { Price } from "./Price";
import { RelatedConsultants } from "./RelatedConsultants";

export function CareDetail({
  item,
  scan = false,
}: {
  item: CareItem;
  scan?: boolean;
}) {
  const { services, demoEnabled } = useWebsite();

  const service = services.find((s) => s.id === item.specialty);
  return (
    <>
      <FloatingActions scan={scan} />
      <Hero
        title={item.name}
        summary={item.summary}
        image={item.image}
        knownAs={item.knownAs}
        scan={scan}
        crumb={[
          {
            label: scan ? "Tests & scans" : service?.name + " clinic",
            to: scan ? "/tests-scans" : "/clinics/" + item.specialty,
          },
          { label: item.name },
        ]}
      />
      <section className="hje-prose hje-container">
        <h2>What is {item.name.toLowerCase()}?</h2>
        <p>{item.overview}</p>
        <h3>{scan ? "Before your scan" : "Your treatment journey"}</h3>
        <p>{item.preparation}</p>
        <p>
          {demoEnabled
            ? contentNotice
            : "Confirm individual assessment and preparation instructions with your care team."}
        </p>
      </section>
      {!scan && (
        <RelatedConsultants
          specialty={item.specialty}
          title={"Consultants for " + item.name.toLowerCase()}
        />
      )}
      <Price item={item} scan={scan} />
      <Payment scan={scan} />
      <section className="hje-faq-section hje-container">
        <h2>Frequently asked questions about {item.name.toLowerCase()}</h2>
        <Faq questions={item.questions} />
      </section>
      <section className="hje-prose hje-container">
        <h2>Planning your visit</h2>
        <p>
          Find practical information about the hospital locality and what to
          bring to your appointment.
        </p>
        <Pill outline to="/visit">
          How to find us <MapPin size={16} />
        </Pill>
      </section>
      <Schedule
        specialty={scan ? "" : item.specialty}
        context={item.name}
        scan={scan}
      />
    </>
  );
}
