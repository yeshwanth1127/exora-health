import { ArrowRight, Check } from "lucide-react";
import { useWebsite } from "../ui/Runtime";
import { Link } from "../ui/components/Link";
import { SectionHeading } from "./SectionHeading";
export function PlanSection({
  layout = "rows",
}: {
  layout?: "rows" | "cards";
}) {
  const { plans, demoEnabled } = useWebsite();
  return (
    <section
      className={
        "kit-plans kit-plans--" + layout + " kit-section kit-container"
      }
    >
      <SectionHeading
        title="A little time for your health"
        link="/plans"
        label="All health checks"
      >
        Explore checks, inclusions and preparation information.
      </SectionHeading>
      {!plans.length ? (
        <p className="kit-empty">Health checks have not been published yet.</p>
      ) : (
        <div className="kit-plan-list">
          {plans.map((p) => (
            <article key={p.id}>
              <div>
                <h3>{p.name}</h3>
                <p>{p.summary}</p>
              </div>
              <ul>
                {p.tests.slice(0, 3).map((t) => (
                  <li key={t}>
                    <Check size={15} />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="kit-plan-end">
                <span>
                  {demoEnabled ? "Sample price" : "Published price"}
                  <strong>₹{p.price.toLocaleString("en-IN")}</strong>
                </span>
                <Link to={"/plans/" + p.id} aria-label={"View " + p.name}>
                  View plan
                  <ArrowRight size={17} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
