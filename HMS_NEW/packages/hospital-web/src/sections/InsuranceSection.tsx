import { ShieldCheck, ArrowRight } from "lucide-react";
import { useWebsite } from "../ui/Runtime";
import { Link } from "../ui/components/Link";
import { insuranceLogos } from "../ui/SriLakshmiSections";
export function InsuranceSection({
  layout = "band",
}: {
  layout?: "band" | "split";
}) {
  const { demoEnabled, insurers } = useWebsite();
  return (
    <section
      className={"kit-insurance kit-insurance--" + layout + " kit-section"}
    >
      <div className="kit-container">
        <div className="kit-insurance-copy">
          <ShieldCheck size={30} />
          <h2>Make your cover clearer.</h2>
          <p>
            Speak with the hospital and your insurer about cover and
            pre-authorisation before your visit.
          </p>
          <Link className="kit-text-link" to="/insurance">
            Insurance & payment
            <ArrowRight size={18} />
          </Link>
        </div>
        <div className="kit-insurance-logos">
          {insurers.slice(0, 5).map((name) => {
            const logo = insuranceLogos.find((l) => l.name === name);
            return (
              <Link
                key={name}
                to={"/contact?insurer=" + encodeURIComponent(name)}
                aria-label={"Ask about " + name}
              >
                {logo ? (
                  <img src={logo.src} alt={name} />
                ) : (
                  <strong>{name}</strong>
                )}
              </Link>
            );
          })}
        </div>
        {demoEnabled && (
          <p className="kit-sample-note">
            Sample insurer logos. Acceptance and policy eligibility require
            confirmation.
          </p>
        )}
      </div>
    </section>
  );
}
