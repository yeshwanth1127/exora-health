import { ArrowUpRight, MapPin, Phone } from "lucide-react";
import { useWebsite } from "../ui/Runtime";
import { Link } from "../ui/components/Link";
export function LocationSection({
  layout = "panel",
}: {
  layout?: "panel" | "editorial";
}) {
  const { hospital, profile, demoEnabled } = useWebsite();
  return (
    <section
      className={
        "kit-location kit-location--" + layout + " kit-section kit-container"
      }
    >
      <div className="kit-location-heading">
        <MapPin size={30} />
        <h2>
          We’ll help you
          <br />
          find your way.
        </h2>
        <p>
          Know where to go, what to bring and how to prepare for your visit.
        </p>
        <Link className="kit-text-link" to="/visit">
          Plan your visit
          <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="kit-location-details">
        <span>Location & visiting</span>
        <h3>{hospital.name}</h3>
        <p>{profile?.address || hospital.area}</p>
        <p>
          {demoEnabled
            ? "Exact address and visiting hours are not verified in this preview."
            : "Confirm any specific arrival instructions with reception before travelling."}
        </p>
        {!demoEnabled && profile?.phone && (
          <a href={"tel:" + profile.phone}>
            <Phone size={18} />
            {profile.phone}
          </a>
        )}
        {!demoEnabled && profile?.address ? (
          <a
            className="kit-button"
            href={
              "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(profile.address)
            }
            target="_blank"
            rel="noreferrer"
          >
            Open directions
            <ArrowUpRight size={18} />
          </a>
        ) : (
          <Link className="kit-button kit-button--outline" to="/contact">
            Contact reception
            <ArrowUpRight size={18} />
          </Link>
        )}
      </div>
    </section>
  );
}
