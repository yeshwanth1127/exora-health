import { ActionRail } from "../sections/ActionRail";
import { CareDirectory } from "../sections/CareDirectory";
import { ConsultantSection } from "../sections/ConsultantSection";
import { InsuranceSection } from "../sections/InsuranceSection";
import { PlanSection } from "../sections/PlanSection";
import { LocationSection } from "../sections/LocationSection";
import { FAQSection } from "../sections/FAQSection";
import { PatientJourney } from "../sections/PatientJourney";
import { DiagnosticsSection } from "../sections/DiagnosticsSection";
export function ComponentCatalog() {
  return (
    <>
      <section className="kit-container kit-section">
        <h1>Hospital website components</h1>
        <p>
          Each section below reads the same website data. The templates select a
          layout; appointments and hospital configuration remain shared.
        </p>
        <nav className="kit-catalog-index" aria-label="Component catalog">
          <a href="#actions">Patient actions</a>
          <a href="#care">Care directory</a>
          <a href="#consultants">Consultants</a>
          <a href="#insurance">Insurance</a>
          <a href="#plans">Plans</a>
          <a href="#location">Location</a>
          <a href="#questions">FAQs</a>
          <a href="/__templates">Template previews</a>
        </nav>
      </section>
      <div id="actions">
        <ActionRail />
      </div>
      <div id="care">
        <CareDirectory layout="index" />
      </div>
      <div id="consultants">
        <ConsultantSection layout="cards" />
      </div>
      <DiagnosticsSection />
      <PatientJourney />
      <div id="insurance">
        <InsuranceSection />
      </div>
      <div id="plans">
        <PlanSection />
      </div>
      <div id="location">
        <LocationSection />
      </div>
      <div id="questions">
        <FAQSection />
      </div>
    </>
  );
}
