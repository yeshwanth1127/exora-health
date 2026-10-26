import { useContext } from "react";
import { useWebsite } from "../Runtime";
import { Router } from "../shared";
import { ServicesBentoSection } from "../SriLakshmiSections";
import { Intro } from "./Intro";

export function SpecialtyDirectory() {
  const { specialties } = useWebsite();

  const go = useContext(Router);
  return (
    <>
      <Intro eyebrow="Treatments & services" title="Find the care you need">
        <p>
          Explore care by specialty, then meet the doctors and try the
          consultation journey.
        </p>
      </Intro>
      <ServicesBentoSection
        departments={specialties}
        onExplore={(id) => go("/clinics/" + id)}
      />
    </>
  );
}
