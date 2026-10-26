import { ArrowRight, ChevronDown, Menu, Search, X } from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
import { useWebsite } from "../Runtime";
import { Router } from "../shared";
import { ButtonLink } from "./ButtonLink";
import { HospitalBrand } from "./HospitalBrand";
import { Link } from "./Link";

export function Header({ path }: { path: string }) {
  const { hospital, specialties, treatments, scans, demoEnabled } =
    useWebsite();

  const [menu, setMenu] = useState(""),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState("");
  const go = useContext(Router),
    root = useRef<HTMLElement>(null),
    lastToggle = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    setMenu("");
    setMobile(false);
  }, [path]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu("");
        setMobile(false);
        lastToggle.current?.focus();
      }
    };
    const outside = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setMenu("");
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", outside);
    };
  }, []);
  const toggle = (value: string, button: HTMLButtonElement) => {
    lastToggle.current = button;
    setMenu(menu === value ? "" : value);
  };
  return (
    <>
      <div className="preview-bar">
        {useWebsite().demoEnabled
          ? "UI preview · Sample doctors, schedules, plans and insurer names · No appointments or messages are sent."
          : hospital.name + " · Appointments with our automated assistant"}
      </div>
      <header ref={root} className="header">
        <div className="utility">
          <div className="container">
            <span>{hospital.area}</span>
            <Link to="/patient-information">Patient information</Link>
            <Link to="/insurance">Insurance & payment</Link>
          </div>
        </div>
        <div className="header-main container">
          <Link to="/" className="brand" aria-label={hospital.name + " home"}>
            <HospitalBrand />
          </Link>
          <div className="reception">
            <span>Have a question?</span>
            <Link to="/contact">Speak with reception</Link>
          </div>
          <form
            className="header-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              go("/consultants?consultant_name=" + encodeURIComponent(search));
            }}
          >
            <label className="sr-only" htmlFor="site-search">
              Search doctors or specialties
            </label>
            <input
              id="site-search"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button aria-label="Search doctors">
              <Search size={20} />
            </button>
          </form>
          <ButtonLink to="/book">Book an appointment</ButtonLink>
          <button
            className="mobile-toggle"
            aria-label={mobile ? "Close navigation" : "Open navigation"}
            aria-expanded={mobile}
            aria-controls="primary-navigation"
            onClick={(e) => {
              lastToggle.current = e.currentTarget;
              setMobile(!mobile);
            }}
          >
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
        <nav
          className={"primary-nav container " + (mobile ? "mobile-open" : "")}
          id="primary-navigation"
          aria-label="Main navigation"
        >
          <button
            aria-expanded={menu === "patient"}
            aria-controls="patient-menu"
            onClick={(e) => toggle("patient", e.currentTarget)}
          >
            Patient information <ChevronDown size={16} />
          </button>
          <button
            aria-expanded={menu === "care"}
            aria-controls="care-menu"
            onClick={(e) => toggle("care", e.currentTarget)}
          >
            Treatments & services <ChevronDown size={16} />
          </button>
          <Link
            to="/consultants"
            aria-current={path.startsWith("/consultants") ? "page" : undefined}
          >
            Find a doctor
          </Link>
          <Link
            to="/plans"
            aria-current={path.startsWith("/plans") ? "page" : undefined}
          >
            Health checks & plans
          </Link>
          <Link
            to="/contact"
            aria-current={path === "/contact" ? "page" : undefined}
          >
            Contact us
          </Link>
        </nav>
        {menu && (
          <div className="mega-wrap">
            <div
              id={menu === "patient" ? "patient-menu" : "care-menu"}
              className={
                "mega container " + (menu === "care" ? "mega-care" : "")
              }
            >
              <div className="mega-intro">
                <h2>
                  {menu === "patient"
                    ? "Your visit, made clearer."
                    : "Find the care you need."}
                </h2>
                <p>
                  {menu === "patient"
                    ? "Practical information before you arrive, and a person to help with your next step."
                    : "Browse specialties and meet the people behind your care."}
                </p>
                <Link
                  to={
                    menu === "patient" ? "/patient-information" : "/specialties"
                  }
                >
                  Explore{" "}
                  {menu === "patient"
                    ? "patient information"
                    : "all specialties"}{" "}
                  <ArrowRight size={16} />
                </Link>
              </div>
              {menu === "patient" ? (
                <>
                  <div>
                    <h3>Before your visit</h3>
                    <Link to="/visit">Location & directions</Link>
                    <Link to="/patient-information">
                      Your appointment journey
                    </Link>
                    <Link to="/insurance">Insurance & payment</Link>
                    <Link to="/plans">Health checks & plans</Link>
                  </div>
                  <div>
                    <h3>Your hospital</h3>
                    <Link to="/about">About the hospital</Link>
                    <Link to="/facilities">Facilities & gallery</Link>
                    <Link to="/faq">Frequently asked questions</Link>
                    <Link to="/contact">Contact reception</Link>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3>Services</h3>
                    {specialties.slice(0, 4).map((s) => (
                      <Link key={s.id} to={"/clinics/" + s.id}>
                        {s.name}
                      </Link>
                    ))}
                    <Link to="/clinics">A–Z of all services »</Link>
                  </div>
                  <div>
                    <h3>Treatments</h3>
                    {treatments.slice(0, 4).map((t) => (
                      <Link key={t.id} to={"/treatments/" + t.id}>
                        {t.name}
                      </Link>
                    ))}
                    <Link to="/treatments">A–Z of all treatments »</Link>
                  </div>
                  <div>
                    <h3>Tests & scans</h3>
                    {scans.slice(0, 4).map((t) => (
                      <Link key={t.id} to={"/tests-scans/" + t.id}>
                        {t.name}
                      </Link>
                    ))}
                    <Link to="/tests-scans">A–Z of all tests & scans »</Link>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
