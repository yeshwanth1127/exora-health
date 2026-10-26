import { useContext, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Router } from "../../ui/shared";
import { useWebsite } from "../../ui/Runtime";
import { Link } from "../../ui/components/Link";
import { CareDirectory } from "../../sections/CareDirectory";
import { ConsultantSection } from "../../sections/ConsultantSection";
import { PatientJourney } from "../../sections/PatientJourney";
import { InsuranceSection } from "../../sections/InsuranceSection";
import { PlanSection } from "../../sections/PlanSection";
import { LocationSection } from "../../sections/LocationSection";
import { FAQSection } from "../../sections/FAQSection";
export function GroveHome() {
  const { profile, hospital } = useWebsite(),
    go = useContext(Router),
    [name, setName] = useState("");
  return (
    <>
      <section className="grove-hero kit-container">
        <div className="grove-masthead">
          <h1>
            {profile?.content.headline || (
              <>
                Care that sees
                <br />
                the whole you.
              </>
            )}
          </h1>
          <div>
            <p>
              {profile?.content.introduction ||
                "Expertise for your health. A familiar team for every step of your journey."}
            </p>
            <form
              className="grove-consultant-search"
              onSubmit={(e) => {
                e.preventDefault();
                go("/consultants?consultant_name=" + encodeURIComponent(name));
              }}
            >
              <label htmlFor="grove-search">Find your consultant</label>
              <div>
                <input
                  id="grove-search"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Search by doctor’s name"
                />
                <button aria-label="Find your consultant">
                  <Search size={20} />
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="grove-hero-image">
          <img
            src={
              profile?.content.heroImage ||
              "/images/hip-consultation-reference.jpg"
            }
            alt={
              profile?.content.heroImage
                ? hospital.name
                : "Illustrative specialist conversation"
            }
          />
        </div>
        <div className="grove-hero-paths">
          <Link to="/book">
            <span>Ready for your next step?</span>
            <strong>
              Book an appointment
              <ArrowRight size={20} />
            </strong>
          </Link>
          <Link to="/clinics">
            <span>Explore our expertise</span>
            <strong>
              Services & specialties
              <ArrowRight size={20} />
            </strong>
          </Link>
          <Link to="/visit">
            <span>Coming to see us?</span>
            <strong>
              Plan your visit
              <ArrowRight size={20} />
            </strong>
          </Link>
        </div>
      </section>
      <ConsultantSection layout="spotlight" />
      <CareDirectory layout="spotlight" />
      <InsuranceSection layout="split" />
      <PatientJourney />
      <PlanSection layout="rows" />
      <LocationSection layout="editorial" />
      <FAQSection />
    </>
  );
}
