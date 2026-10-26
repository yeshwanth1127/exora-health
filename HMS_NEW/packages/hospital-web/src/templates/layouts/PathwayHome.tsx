import { ArrowRight } from "lucide-react";
import { useWebsite } from "../../ui/Runtime";
import { Link } from "../../ui/components/Link";
import { ActionRail } from "../../sections/ActionRail";
import { CareDirectory } from "../../sections/CareDirectory";
import { ConsultantSection } from "../../sections/ConsultantSection";
import { PatientJourney } from "../../sections/PatientJourney";
import { InsuranceSection } from "../../sections/InsuranceSection";
import { PlanSection } from "../../sections/PlanSection";
import { LocationSection } from "../../sections/LocationSection";
import { FAQSection } from "../../sections/FAQSection";
export function PathwayHome() {
  const { profile, hospital } = useWebsite();
  return (
    <>
      <section className="pathway-hero">
        <div className="kit-container pathway-hero-grid">
          <div className="pathway-hero-copy">
            <h1>
              {profile?.content.headline || (
                <>
                  Your health,
                  <br />
                  in good hands.
                </>
              )}
            </h1>
            <p>
              {profile?.content.introduction ||
                "Find your specialist, understand your care and take the next step with confidence."}
            </p>
            <Link to="/book" className="kit-button kit-button--light">
              Book an appointment
              <ArrowRight size={18} />
            </Link>
          </div>
          <img
            src={
              profile?.content.heroImage ||
              "/images/cardiology-consultation.jpg"
            }
            alt={
              profile?.content.heroImage
                ? hospital.name
                : "Illustrative doctor consultation"
            }
          />
        </div>
      </section>
      <ActionRail />
      <CareDirectory layout="index" />
      <PatientJourney />
      <ConsultantSection layout="list" />
      <InsuranceSection layout="band" />
      <PlanSection layout="rows" />
      <LocationSection layout="panel" />
      <FAQSection />
    </>
  );
}
