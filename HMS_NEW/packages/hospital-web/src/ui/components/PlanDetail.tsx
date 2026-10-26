import { Check } from "lucide-react";
import { useWebsite } from "../Runtime";
import { ButtonLink } from "./ButtonLink";
import { Intro } from "./Intro";
import { NotFound } from "./NotFound";

export function PlanDetail({ id }: { id: string }) {
  const { plans, demoEnabled } = useWebsite();

  const p = plans.find((p) => p.id === id);
  if (!p) return <NotFound />;
  return (
    <>
      <Intro
        eyebrow={demoEnabled ? "Example health check" : "Health check"}
        title={p.name}
        crumb="Health checks & plans"
      >
        <p>{p.summary}</p>
      </Intro>
      <section className="section container plan-detail">
        <div>
          <h2>What’s included</h2>
          <ul className="included-list">
            {p.tests.map((t) => (
              <li key={t}>
                <Check size={18} />
                {t}
              </li>
            ))}
          </ul>
          <h3>Preparing for your visit</h3>
          <p>{p.preparation}</p>
        </div>
        <aside className="info-panel">
          <p className="eyebrow">
            {demoEnabled ? "Example plan" : "Health plan"}
          </p>
          <strong className="price">₹{p.price.toLocaleString("en-IN")}</strong>
          <p>
            {demoEnabled
              ? "Illustrative price and inclusions. No purchase or appointment is created by this preview."
              : "Confirm eligibility and preparation with the hospital. An enquiry does not create a purchase or appointment."}
          </p>
          <ButtonLink to={"/contact?plan=" + p.id}>
            Enquire about this plan
          </ButtonLink>
          <ButtonLink outline to={"/book?plan=" + p.id}>
            See available slots
          </ButtonLink>
        </aside>
      </section>
    </>
  );
}
