import { Check } from "lucide-react";
import { useWebsite } from "../Runtime";
import { plans } from "../data";
import { ButtonLink } from "./ButtonLink";

export function PlanCard({ plan: p }: { plan: (typeof plans)[number] }) {
  const { plans, demoEnabled } = useWebsite();

  return (
    <article className="plan-card">
      <p className="eyebrow">
        {demoEnabled ? "Example health check" : "Health check"}
      </p>
      <h3>{p.name}</h3>
      <p>{p.summary}</p>
      <strong className="price">
        ₹{p.price.toLocaleString("en-IN")}
        <small>{demoEnabled ? "Sample price" : "Published price"}</small>
      </strong>
      <ul>
        {p.tests.slice(0, 4).map((t) => (
          <li key={t}>
            <Check size={15} />
            {t}
          </li>
        ))}
      </ul>
      <ButtonLink outline to={"/plans/" + p.id}>
        View plan
      </ButtonLink>
    </article>
  );
}
