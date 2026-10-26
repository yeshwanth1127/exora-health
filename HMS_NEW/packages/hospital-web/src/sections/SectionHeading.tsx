import type { ReactNode } from "react";
import { Link } from "../ui/components/Link";
import { ArrowRight } from "lucide-react";
export function SectionHeading({
  title,
  children,
  link,
  label = "Explore all",
}: {
  title: string;
  children?: ReactNode;
  link?: string;
  label?: string;
}) {
  return (
    <div className="kit-section-heading">
      <div>
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      {link && (
        <Link to={link} className="kit-text-link">
          {label}
          <ArrowRight size={18} />
        </Link>
      )}
    </div>
  );
}
