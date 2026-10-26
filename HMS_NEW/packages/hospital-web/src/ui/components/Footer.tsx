import { useWebsite } from "../Runtime";
import { HospitalBrand } from "./HospitalBrand";
import { Link } from "./Link";

export function Footer() {
  const { hospital, demoEnabled } = useWebsite();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link to="/" className="brand">
              <HospitalBrand />
            </Link>
            <p>{hospital.area}</p>
            <p className="small muted">
              {useWebsite().demoEnabled
                ? "UI demonstration. Hospital details and sample content require verification before publication."
                : "Published information from your hospital."}
            </p>
          </div>
          <div>
            <h3>Your care</h3>
            <Link to="/consultants">Find a doctor</Link>
            <Link to="/clinics">Services</Link>
            <Link to="/treatments">Treatments</Link>
            <Link to="/tests-scans">Tests & scans</Link>
            <Link to="/plans">Health checks & plans</Link>
            <Link to="/book">Available appointments</Link>
          </div>
          <div>
            <h3>Your visit</h3>
            <Link to="/visit">Location & directions</Link>
            <Link to="/insurance">Insurance & payment</Link>
            <Link to="/patient-information">Patient information</Link>
            <Link to="/faq">Common questions</Link>
          </div>
          <div>
            <h3>Your hospital</h3>
            <Link to="/about">About us</Link>
            <Link to="/facilities">Facilities & gallery</Link>
            <Link to="/contact">Contact us</Link>
            <Link to="/privacy">Privacy information</Link>
          </div>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} {hospital.name}
          <span>
            {useWebsite().demoEnabled
              ? "Demo content · no real bookings"
              : "Connected hospital website"}
          </span>
        </div>
      </div>
    </footer>
  );
}
