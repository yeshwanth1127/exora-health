import { ArrowRight } from "lucide-react";
import { useContext } from "react";
import { HospitalGallerySection } from "../../components/sections/HospitalGallerySection";
import { useWebsite } from "../Runtime";
import { Router, photos } from "../shared";
import { Intro } from "./Intro";
import { Link } from "./Link";
import { SectionTitle } from "./SectionTitle";

export function Facilities() {
  const { hospital, demoEnabled, profile } = useWebsite();

  const go = useContext(Router);
  return (
    <>
      <Intro
        eyebrow="Facilities & gallery"
        title="Feel familiar before you arrive"
      >
        <p>
          Browse the photo viewer and explore practical information for your
          visit.
        </p>
      </Intro>
      <div className="gallery-section">
        <HospitalGallerySection
          preview={demoEnabled}
          name={hospital.name}
          photos={
            !demoEnabled && profile?.content.photos
              ? profile.content.photos
              : photos
          }
          onExploreHospital={() => go("/visit")}
        />
      </div>
      <section className="section container">
        <SectionTitle title="A little preparation helps" />
        <div className="practical-grid">
          <article>
            <h3>Your consultation</h3>
            <p>Know your doctor and review your appointment information.</p>
            <Link to="/consultants" className="text-link">
              Our doctors <ArrowRight size={15} />
            </Link>
          </article>
          <article>
            <h3>Before you travel</h3>
            <p>
              Check the exact address and visiting arrangements with reception.
            </p>
            <Link to="/visit" className="text-link">
              Plan your visit <ArrowRight size={15} />
            </Link>
          </article>
          <article>
            <h3>Have a question?</h3>
            <p>Use the contact UI to see how an enquiry can be prepared.</p>
            <Link to="/contact" className="text-link">
              Contact us <ArrowRight size={15} />
            </Link>
          </article>
        </div>
      </section>
    </>
  );
}
