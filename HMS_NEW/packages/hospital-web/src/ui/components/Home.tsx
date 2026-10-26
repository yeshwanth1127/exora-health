import { ArrowRight, MapPin } from "lucide-react";
import { useContext } from "react";
import { HospitalGallerySection } from "../../components/sections/HospitalGallerySection";
import { useWebsite } from "../Runtime";
import { Router, photos } from "../shared";
import {
  InsurancePartnersSection,
  ServicesBentoSection,
} from "../SriLakshmiSections";
import { ButtonLink } from "./ButtonLink";
import { CTA } from "./CTA";
import { DoctorCard } from "./DoctorCard";
import { FAQList } from "./FAQList";
import { Link } from "./Link";
import { PlanCard } from "./PlanCard";
import { SectionTitle } from "./SectionTitle";

export function Home() {
  const {
    hospital,
    doctors,
    specialties,
    plans,
    insurers,
    demoEnabled,
    profile,
  } = useWebsite();

  const go = useContext(Router);
  return (
    <>
      <section className="hero">
        <img
          src={
            profile?.content.heroImage || "/images/cardiology-consultation.jpg"
          }
          alt={
            profile?.content.heroImage
              ? hospital.name
              : "Illustrative consultation"
          }
        />
        <div className="container hero-inner">
          <div className="hero-panel">
            <h1>
              {profile?.content.headline || (
                <>
                  Care for you.
                  <br />
                  Close to home.
                </>
              )}
            </h1>
            <p>
              {profile?.content.introduction || (
                <>
                  Welcome to {hospital.name}
                  {hospital.area ? ` in ${hospital.area}` : ""}. Find your
                  doctor, explore your care and plan your visit.
                </>
              )}
            </p>
            <p>Clear information. A familiar team. A simple next step.</p>
            <p className="hero-looking">I am looking for…</p>
            <div className="hero-links">
              <Link to="/consultants">A doctor</Link>
              <Link to="/specialties">A specialty</Link>
              <Link to="/plans">A health check</Link>
              <Link to="/visit">Visitor information</Link>
            </div>
          </div>
        </div>
        <span className="image-note">Illustrative photograph</span>
      </section>
      <section className="section container split">
        <div className="editorial-image">
          <img
            src={
              profile?.content.storyImage || "/images/pediatrics-specialty.jpg"
            }
            alt={
              profile?.content.storyImage
                ? hospital.name
                : "Illustrative care conversation"
            }
            loading="lazy"
          />
        </div>
        <div>
          <h2>Care starts with understanding.</h2>
          <p>
            Know who you are seeing, what to expect and how to prepare. Explore
            the team and take a little time to find the right next step for you.
          </p>
          <p>
            {demoEnabled
              ? "This website preview shows how hospital information and appointments will work together. All clinical and commercial details are illustrative."
              : profile?.content.story ||
                "Explore information published by your hospital and speak with the care team about your next step."}
          </p>
          <ButtonLink to="/about" outline>
            About the hospital
          </ButtonLink>
        </div>
      </section>
      <ServicesBentoSection
        departments={specialties}
        onExplore={(id) => go("/clinics/" + id)}
        onViewAll={() => go("/specialties")}
      />
      <section className="section container">
        <SectionTitle
          title="Find your doctor"
          description={
            demoEnabled
              ? "Get to know the example care team and try the appointment journey."
              : "Get to know our published care team and see consultation availability."
          }
          to="/consultants"
          label="All doctors"
        />
        <div className="doctor-grid">
          {doctors.slice(0, 3).map((d) => (
            <DoctorCard key={d.id} doctor={d} />
          ))}
        </div>
      </section>
      <section className="section pale">
        <div className="container split location-split">
          <div
            className="map-preview"
            aria-label="Illustrative locality graphic"
          >
            <svg viewBox="0 0 550 320" aria-hidden="true">
              <g fill="none" stroke="#d0d2df" strokeWidth="12">
                <path d="M-30 70 580 255M-30 230 580 20M90-30 350 350M320-30 510 350" />
              </g>
              <g fill="none" stroke="white" strokeWidth="6">
                <path d="M-30 70 580 255M-30 230 580 20M90-30 350 350M320-30 510 350" />
              </g>
              <circle cx="265" cy="166" r="24" fill="#090879" />
              <path d="M265 153v26m-13-13h26" stroke="white" strokeWidth="4" />
            </svg>
            <div>
              <MapPin size={18} />
              <span>
                {hospital.area}
                <small>Illustrative map · exact address pending</small>
              </span>
            </div>
          </div>
          <div>
            <h2>Coming into the hospital</h2>
            <p>
              From finding your way to knowing what to bring, a little
              preparation can make your visit easier.
            </p>
            <p>
              Explore directions, appointment information and answers to common
              questions before you arrive.
            </p>
            <ButtonLink to="/visit">Plan your visit</ButtonLink>
          </div>
        </div>
      </section>
      {demoEnabled ? (
        <InsurancePartnersSection
          onOpenVerification={(name) =>
            go(
              name
                ? "/contact?insurer=" + encodeURIComponent(name)
                : "/insurance",
            )
          }
        />
      ) : (
        <section className="section container">
          <h2>Insurance & payment</h2>
          <p>
            Confirm cover and pre-authorisation with the hospital and your
            insurer before treatment.
          </p>
          <div className="insurer-grid">
            {insurers.map((name) => (
              <Link
                key={name}
                to={"/contact?insurer=" + encodeURIComponent(name)}
              >
                {name}
              </Link>
            ))}
          </div>
          <ButtonLink to="/insurance">Insurance information</ButtonLink>
        </section>
      )}
      <section className="section pale">
        <div className="container">
          <SectionTitle
            title="Health checks & plans"
            description={
              demoEnabled
                ? "Clear inclusions, preparation information and a simple enquiry flow. All prices are examples."
                : "Published inclusions and prices. Ask the hospital which check suits your needs."
            }
            to="/plans"
            label="See all plans"
          />
          {!plans.length && (
            <p role="status">Health plans have not been published yet.</p>
          )}
          <div className="plan-grid">
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
          </div>
        </div>
      </section>
      <div className="gallery-section">
        <HospitalGallerySection
          preview={demoEnabled}
          name={hospital.name}
          photos={
            !demoEnabled && profile?.content.photos
              ? profile.content.photos
              : photos
          }
          onExploreHospital={() => go("/facilities")}
        />
      </div>
      <section className="section container faq-home">
        <div>
          <h2>Before your visit</h2>
          <p>A few useful answers to help you get started.</p>
          <Link className="text-link" to="/faq">
            All questions <ArrowRight size={16} />
          </Link>
        </div>
        <FAQList limit={4} />
      </section>
      <CTA />
    </>
  );
}
