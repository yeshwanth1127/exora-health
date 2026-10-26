import { useContext, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Menu, Search, X } from "lucide-react";
import { Button } from "../vendor/arc/button/button";
import { useWebsite } from "../ui/Runtime";
import { Router } from "../ui/shared";
import { Link } from "../ui/components/Link";
import { Brand } from "./Brand";
export function SiteHeader({
  path,
  layout = "inline",
}: {
  path: string;
  layout?: "inline" | "stacked" | "centered";
}) {
  const { hospital, demoEnabled, services, treatments, scans } = useWebsite(),
    go = useContext(Router);
  const [mobile, setMobile] = useState(false),
    [care, setCare] = useState(false),
    [search, setSearch] = useState("");
  const root = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    mobileTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setCare(false);
    setMobile(false);
  }, [path]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCare(false);
        setMobile(false);
        (mobile ? mobileTrigger : trigger).current?.focus();
      }
    };
    const outside = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node))
        setCare(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, [mobile]);
  return (
    <>
      {demoEnabled && (
        <div className="kit-demo" role="note">
          Website preview · Sample clinicians, availability and plans. No real
          appointments are made.
        </div>
      )}
      <header ref={root} className={"kit-header kit-header--" + layout}>
        <div className="kit-header-top kit-container">
          <span>{hospital.area}</span>
          <div>
            <Link to="/patient-information">Patient information</Link>
            <Link to="/insurance">Insurance & payment</Link>
          </div>
        </div>
        <div className="kit-header-main kit-container">
          <Brand />
          <nav
            aria-label="Main navigation"
            className={"kit-nav " + (mobile ? "is-open" : "")}
            id="kit-main-navigation"
          >
            <button
              ref={trigger}
              className="kit-menu-trigger"
              aria-expanded={care}
              aria-controls="kit-care-navigation"
              onClick={() => setCare((v) => !v)}
            >
              Treatments & services
              <ChevronDown size={15} />
            </button>
            <Link
              to="/consultants"
              aria-current={
                path.startsWith("/consultants") ? "page" : undefined
              }
            >
              Find a doctor
            </Link>
            <Link
              to="/plans"
              aria-current={path.startsWith("/plans") ? "page" : undefined}
            >
              Health checks
            </Link>
            <Link
              to="/visit"
              aria-current={path === "/visit" ? "page" : undefined}
            >
              Visit us
            </Link>
          </nav>
          <div className="kit-header-actions">
            <Link to="/book" className="kit-button">
              Book an appointment
              <ArrowRight size={16} />
            </Link>
            <Button
              ref={mobileTrigger}
              variant="secondary"
              size="sm"
              aria-label={mobile ? "Close navigation" : "Open navigation"}
              aria-expanded={mobile}
              aria-controls="kit-main-navigation"
              onClick={() => setMobile((v) => !v)}
              className="kit-mobile-toggle"
            >
              {mobile ? <X size={18} /> : <Menu size={18} />}
            </Button>
          </div>
        </div>
        {care && (
          <div className="kit-mega" id="kit-care-navigation">
            <div className="kit-container kit-mega-columns">
              {[
                {
                  title: "Services",
                  items: services,
                  base: "/clinics/",
                  all: "/clinics",
                },
                {
                  title: "Treatments",
                  items: treatments,
                  base: "/treatments/",
                  all: "/treatments",
                },
                {
                  title: "Tests & scans",
                  items: scans,
                  base: "/tests-scans/",
                  all: "/tests-scans",
                },
              ].map((group) => (
                <div key={group.title}>
                  <h2>{group.title}</h2>
                  {group.items.slice(0, 4).map((item) => (
                    <Link key={item.id} to={group.base + item.id}>
                      {item.name}
                      <ArrowRight size={14} />
                    </Link>
                  ))}
                  <Link to={group.all} className="kit-text-link">
                    View all {group.title.toLowerCase()}
                  </Link>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setCare(false);
                  go(
                    "/consultants?consultant_name=" +
                      encodeURIComponent(search),
                  );
                }}
              >
                <label htmlFor="kit-doctor-search">Search for a doctor</label>
                <div className="kit-header-search">
                  <input
                    id="kit-doctor-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Enter a doctor’s name"
                  />
                  <button aria-label="Search doctors">
                    <Search size={18} />
                  </button>
                </div>
                <p>
                  Find a consultant and see their published appointment times.
                </p>
                <Link to="/contact">Contact reception</Link>
              </form>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
