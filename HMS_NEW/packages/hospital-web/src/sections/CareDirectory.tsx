import { ArrowRight, ChevronRight } from "lucide-react";
import { useWebsite } from "../ui/Runtime";
import { Link } from "../ui/components/Link";
import { SectionHeading } from "./SectionHeading";
export function CareDirectory({
  layout = "index",
}: {
  layout?: "index" | "mosaic" | "spotlight";
}) {
  const { services, demoEnabled } = useWebsite();
  return (
    <section
      className={"kit-care kit-care--" + layout + " kit-section kit-container"}
      id="services"
    >
      <SectionHeading
        title="Care for every part of you"
        link="/clinics"
        label="All services"
      >
        Find the right specialty and understand your next step.
      </SectionHeading>
      {!services.length ? (
        <p className="kit-empty">
          The hospital has not published its services yet.
        </p>
      ) : layout === "index" ? (
        <div className="kit-care-index">
          <div>
            <p>From a first conversation to specialist care.</p>
            <Link to="/treatments" className="kit-text-link">
              Explore treatments
              <ArrowRight size={18} />
            </Link>
            <img
              src="/images/hip-consultation-reference.jpg"
              alt="Illustrative specialist consultation"
              loading="lazy"
            />
          </div>
          <div className="kit-care-rows">
            {services.map((s, i) => (
              <Link key={s.id} to={"/clinics/" + s.id}>
                <span className="kit-row-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{s.name}</strong>
                  <small>{s.short}</small>
                </span>
                <ChevronRight size={20} />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="kit-care-mosaic">
          {services.map((s, i) => (
            <Link
              key={s.id}
              to={"/clinics/" + s.id}
              className={"kit-care-tile item-" + i}
            >
              <img
                src={s.image}
                alt={
                  demoEnabled
                    ? "Illustrative " + s.name.toLowerCase() + " care"
                    : s.name
                }
                loading="lazy"
              />
              <div>
                <h3>{s.name}</h3>
                <p>{s.short}</p>
                <span>
                  Explore care
                  <ArrowRight size={17} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {demoEnabled && (
        <p className="kit-sample-note">
          Illustrative departments and photography for template review.
        </p>
      )}
    </section>
  );
}
