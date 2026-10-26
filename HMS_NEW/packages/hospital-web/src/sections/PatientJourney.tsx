import {
  ArrowRight,
  CalendarDays,
  MessageCircle,
  Stethoscope,
} from "lucide-react";
import { Link } from "../ui/components/Link";
export function PatientJourney() {
  return (
    <section className="kit-journey kit-section kit-container">
      <div>
        <h2>
          Your next step,
          <br />
          made simpler.
        </h2>
        <p>
          Find your specialist, see available times and let our appointment
          assistant guide you.
        </p>
        <Link className="kit-text-link" to="/book">
          View available slots
          <ArrowRight size={18} />
        </Link>
      </div>
      <ol>
        {[
          {
            title: "Find your doctor",
            text: "Explore the specialty and clinician that suit your next step.",
            Icon: Stethoscope,
          },
          {
            title: "Choose a time",
            text: "View the schedule and select an available appointment preference.",
            Icon: CalendarDays,
          },
          {
            title: "Talk to our assistant",
            text: "The assistant checks availability and helps confirm your appointment.",
            Icon: MessageCircle,
          },
        ].map(({ title, text, Icon }) => (
          <li key={title}>
            <Icon size={23} />
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
