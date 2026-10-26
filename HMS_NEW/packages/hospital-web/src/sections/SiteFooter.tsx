import { ArrowUpRight } from "lucide-react";
import { Brand } from "./Brand";
import { Link } from "../ui/components/Link";
import { useWebsite } from "../ui/Runtime";
export function SiteFooter() {
  const { hospital, demoEnabled } = useWebsite();
  return (
    <footer className="kit-footer">
      <div className="kit-container">
        <div className="kit-footer-invitation">
          <h2>Here for your next step.</h2>
          <Link to="/book" className="kit-button">
            Book an appointment
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="kit-footer-grid">
          <div>
            <Brand />
            <p>{hospital.area}</p>
            <small>
              {demoEnabled
                ? "Template demonstration with sample clinical and commercial content."
                : "Information published by your hospital."}
            </small>
          </div>
          <div>
            <h3>Your care</h3>
            <Link to="/consultants">Find a doctor</Link>
            <Link to="/clinics">Services</Link>
            <Link to="/treatments">Treatments</Link>
            <Link to="/tests-scans">Tests & scans</Link>
          </div>
          <div>
            <h3>Your visit</h3>
            <Link to="/insurance">Insurance & payment</Link>
            <Link to="/plans">Health checks</Link>
            <Link to="/visit">Location & directions</Link>
            <Link to="/patient-information">Patient information</Link>
          </div>
          <div>
            <h3>Your hospital</h3>
            <Link to="/about">About us</Link>
            <Link to="/facilities">Facilities & gallery</Link>
            <Link to="/contact">Contact reception</Link>
            <Link to="/faq">Frequently asked questions</Link>
          </div>
        </div>
        <div className="kit-footer-bottom">
          <span>
            © {new Date().getFullYear()} {hospital.name}
          </span>
          <Link to="/privacy">Privacy information</Link>
          <span>
            {demoEnabled
              ? "Demo content · no real bookings"
              : "Connected hospital website"}
          </span>
        </div>
      </div>
    </footer>
  );
}
