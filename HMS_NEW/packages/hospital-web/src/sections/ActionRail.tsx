import {
  ArrowUpRight,
  CalendarDays,
  MapPin,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Link } from "../ui/components/Link";
export function ActionRail({ compact = false }: { compact?: boolean }) {
  return (
    <nav
      className={
        "kit-action-rail kit-container " + (compact ? "is-compact" : "")
      }
      aria-label="Quick patient links"
    >
      {[
        {
          to: "/consultants",
          title: "Find a doctor",
          detail: "Choose your specialist",
          Icon: Stethoscope,
        },
        {
          to: "/book",
          title: "View available slots",
          detail: "Continue with our assistant",
          Icon: CalendarDays,
        },
        {
          to: "/insurance",
          title: "Insurance & payment",
          detail: "Plan for your care",
          Icon: ShieldCheck,
        },
        {
          to: "/visit",
          title: "Plan your visit",
          detail: "Location and directions",
          Icon: MapPin,
        },
      ].map(({ to, title, detail, Icon }) => (
        <Link to={to} key={to}>
          <Icon size={26} />
          <span>
            <strong>{title}</strong>
            <small>{detail}</small>
          </span>
          <ArrowUpRight size={20} />
        </Link>
      ))}
    </nav>
  );
}
