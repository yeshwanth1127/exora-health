import { useEffect, useState, type ReactNode } from "react";
import { SiteFooter } from "../sections/SiteFooter";
import { SiteHeader } from "../sections/SiteHeader";
import { ComponentCatalog } from "../templates/ComponentCatalog";
import { TemplateGallery } from "../templates/TemplateGallery";
import { TemplateHome } from "../templates/TemplateHome";
import { useWebsite } from "./Runtime";
import { About } from "./components/About";
import { ButtonLink } from "./components/ButtonLink";
import { Contact } from "./components/Contact";
import { FAQList } from "./components/FAQList";
import { Facilities } from "./components/Facilities";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Home } from "./components/Home";
import { Insurance } from "./components/Insurance";
import { Intro } from "./components/Intro";
import { NotFound } from "./components/NotFound";
import { PatientInformation } from "./components/PatientInformation";
import { PlanDetail } from "./components/PlanDetail";
import { Plans } from "./components/Plans";
import { SpecialtyDirectory } from "./components/SpecialtyDirectory";
import { Visit } from "./components/Visit";
import { previewHref } from "./previewHref";
import { ReferencePages } from "./reference/ReferencePages";
import { Router } from "./shared";

export default function App() {
  const { template, bound, hospital, demoEnabled } = useWebsite();

  const [route, setRoute] = useState(
    location.pathname + location.search + location.hash,
  );
  const go = (to: string) => {
    to = previewHref(to, template, bound);
    if (to === route) {
      window.scrollTo(0, 0);
      return;
    }
    history.pushState({}, "", to);
    setRoute(location.pathname + location.search + location.hash);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const back = () => {
      setRoute(location.pathname + location.search + location.hash);
      window.scrollTo(0, 0);
    };
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);
  const url = new URL(route, location.origin),
    parts = url.pathname.split("/").filter(Boolean);
  useEffect(() => {
    if(import.meta.env.DEV&&parts[0]==='__templates'){document.title='Hospital website library';return;}
    document.title =
      (parts[0] ? parts[0].replaceAll("-", " ") + " · " : "") + hospital.name;
  }, [route]);
  let body: ReactNode;
  if (import.meta.env.DEV && parts[0] === "__templates")
    return <TemplateGallery />;
  if (import.meta.env.DEV && parts[0] === "__components")
    body = <ComponentCatalog />;
  else if (!parts.length)
    body = template === "swastikaa" ? <Home /> : <TemplateHome />;
  else if (
    [
      "consultants",
      "doctors",
      "clinics",
      "services",
      "treatments",
      "tests-scans",
      "request-an-appointment",
      "imaging-appointment",
      "book",
    ].includes(parts[0]) ||
    (["specialties", "departments"].includes(parts[0]) && parts[1])
  )
    body = (
      <ReferencePages
        key={url.pathname + url.search}
        path={url.pathname}
        params={url.searchParams}
        go={go}
      />
    );
  else if (parts[0] === "specialties" || parts[0] === "departments")
    body = <SpecialtyDirectory />;
  else if (parts[0] === "plans" || parts[0] === "packages")
    body = parts[1] ? <PlanDetail id={parts[1]} /> : <Plans />;
  else if (parts[0] === "insurance")
    body = (
      <Insurance key={url.search} query={url.searchParams.get("q") || ""} />
    );
  else if (parts[0] === "visit") body = <Visit />;
  else if (parts[0] === "patient-information") body = <PatientInformation />;
  else if (parts[0] === "about") body = <About />;
  else if (parts[0] === "facilities") body = <Facilities />;
  else if (parts[0] === "contact")
    body = <Contact key={url.search} params={url.searchParams} />;
  else if (parts[0] === "faq")
    body = (
      <>
        <Intro
          eyebrow="Patient information"
          title="Frequently asked questions"
        />
        <section className="section container narrow">
          <FAQList />
        </section>
      </>
    );
  else if (parts[0] === "privacy")
    body = (
      <>
        <Intro
          eyebrow="Privacy information"
          title={
            demoEnabled
              ? "Your information in this preview"
              : "Your information"
          }
        />
        <section className="section container narrow">
          <h2>
            {demoEnabled
              ? "Local, temporary UI state"
              : "Hospital enquiries and appointments"}
          </h2>
          <p>
            {demoEnabled
              ? "This demonstration does not save enquiries or make appointments. Use sample details when testing."
              : "General enquiries are stored in the hospital’s staff inbox. Appointment availability comes from the hospital’s scheduling system. Selecting a time does not reserve it. The automated assistant requests consent before microphone access and recording, and checks availability before confirming a booking."}
          </p>
          <p>
            Photographs already present in the project are illustrative. A live
            hospital website will require its own verified privacy information
            before publication.
          </p>
          <ButtonLink to="/contact">Contact information</ButtonLink>
        </section>
      </>
    );
  else body = <NotFound />;
  const content = (
    <Router.Provider value={go}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {template === "swastikaa" ? (
        <Header path={url.pathname} />
      ) : (
        <SiteHeader
          path={url.pathname}
          layout={
            template === "hospital-grove"
              ? "centered"
              : template === "hospital-atlas"
                ? "stacked"
                : "inline"
          }
        />
      )}
      <main id="main-content">{body}</main>
      {template === "swastikaa" ? <Footer /> : <SiteFooter />}
    </Router.Provider>
  );
  return template === "swastikaa" ? (
    content
  ) : (
    <div className={"hospital-template " + template} data-template={template}>
      {content}
    </div>
  );
}
