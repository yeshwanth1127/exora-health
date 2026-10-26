import { ArrowRight } from "lucide-react";
import { useWebsite } from "../ui/Runtime";
import { Link } from "../ui/components/Link";
export function DiagnosticsSection() {
  const { scans, demoEnabled } = useWebsite();
  return (
    <section className="kit-diagnostics kit-section kit-container">
      <div>
        <h2>
          A clearer picture.
          <br />A clearer next step.
        </h2>
        <p>
          Understand your test or scan, how to prepare and who to speak with.
        </p>
        <div>
          {scans.slice(0, 4).map((s) => (
            <Link key={s.id} to={"/tests-scans/" + s.id}>
              {s.name}
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
        <Link to="/tests-scans" className="kit-text-link">
          All tests & scans
          <ArrowRight size={17} />
        </Link>
      </div>
      <figure>
        <img
          src="/images/mri-reference.jpg"
          alt="Illustrative MRI scanner"
          loading="lazy"
        />
        {demoEnabled && (
          <figcaption>Illustrative diagnostics photography</figcaption>
        )}
      </figure>
    </section>
  );
}
