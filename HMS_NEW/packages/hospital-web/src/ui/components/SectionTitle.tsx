import { ArrowRight } from "lucide-react";
import { Link } from "./Link";

export function SectionTitle({
  title,
  description,
  to,
  label = "Find out more",
}: {
  title: string;
  description?: string;
  to?: string;
  label?: string;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {to && (
        <Link to={to} className="text-link">
          {label}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
