import { ArrowRight } from "lucide-react";
import { useWebsite } from "../../ui/Runtime";
import { Link } from "../../ui/components/Link";
import { ActionRail } from "../../sections/ActionRail";
import { CareDirectory } from "../../sections/CareDirectory";
import { ConsultantSection } from "../../sections/ConsultantSection";
import { InsuranceSection } from "../../sections/InsuranceSection";
import { PlanSection } from "../../sections/PlanSection";
import { LocationSection } from "../../sections/LocationSection";
import { FAQSection } from "../../sections/FAQSection";
import { DiagnosticsSection } from "../../sections/DiagnosticsSection";
export function AtlasHome() {
  const { profile, hospital } = useWebsite();
  return (
    <>
      <section className="atlas-hero">
        <img
          src={profile?.content.heroImage || "/images/pediatrics-specialty.jpg"}
          alt={
            profile?.content.heroImage
              ? hospital.name
              : "Illustrative family consultation"
          }
        />
        <div className="kit-container">
          <div className="atlas-hero-copy">
            <h1>
              {profile?.content.headline || (
                <>
                  Specialist care.
                  <br />
                  Personal to you.
                </>
              )}
            </h1>
            <p>
              {profile?.content.introduction ||
                "Clear answers, dedicated specialists and a team to guide you through your care."}
            </p>
            <Link to="/book" className="kit-button kit-button--light">
              Book an appointment
              <ArrowRight size={18} />
            </Link>
            <Link to="/consultants" className="atlas-secondary">
              Find your specialist
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <ActionRail compact />
      <section className="atlas-introduction kit-section kit-container">
        <h2>
          Care built around
          <br />
          what matters to you.
        </h2>
        <p>
          {profile?.content.story ||
            "A good care journey begins with understanding. Explore your options, meet the people who will look after you and plan your visit."}
        </p>
        <Link to="/about" className="kit-text-link">
          About our hospital
          <ArrowRight size={18} />
        </Link>
      </section>
      <CareDirectory layout="mosaic" />
      <DiagnosticsSection />
      <ConsultantSection layout="cards" />
      <PlanSection layout="cards" />
      <InsuranceSection layout="split" />
      <LocationSection layout="editorial" />
      <FAQSection />
    </>
  );
}
