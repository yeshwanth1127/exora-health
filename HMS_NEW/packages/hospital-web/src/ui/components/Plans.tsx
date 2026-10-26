import { useWebsite } from "../Runtime";
import { CTA } from "./CTA";
import { Intro } from "./Intro";
import { PlanCard } from "./PlanCard";

export function Plans() {
  const { plans, demoEnabled } = useWebsite();

  return (
    <>
      <Intro eyebrow="Health checks & plans" title="Make time for your health">
        <p>
          {demoEnabled
            ? "Compare example checks and see what is included. Prices and inclusions are illustrative."
            : "Compare published health checks and see what is included."}
        </p>
      </Intro>
      <section className="section container">
        {!plans.length && (
          <p role="status">Health plans have not been published yet.</p>
        )}
        <div className="plan-grid">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>
        <div className="notice">
          A health check should suit your needs. Discuss appropriate tests and
          preparation with your clinician.
        </div>
      </section>
      <CTA />
    </>
  );
}
