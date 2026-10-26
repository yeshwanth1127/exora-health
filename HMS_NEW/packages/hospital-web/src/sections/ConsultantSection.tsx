import { ArrowRight } from "lucide-react";
import { useWebsite } from "../ui/Runtime";
import { Link } from "../ui/components/Link";
import { SectionHeading } from "./SectionHeading";
export function ConsultantSection({
  layout = "cards",
}: {
  layout?: "cards" | "list" | "spotlight";
}) {
  const { doctors, services, demoEnabled, catalogError } = useWebsite();
  return (
    <section
      className={
        "kit-consultants kit-consultants--" +
        layout +
        " kit-section kit-container"
      }
    >
      <SectionHeading
        title="The people behind your care"
        link="/consultants"
        label="Find a doctor"
      >
        Meet the team, explore their specialties and see consultation times.
      </SectionHeading>
      {catalogError && <p role="alert">{catalogError}</p>}
      {!doctors.length ? (
        <p className="kit-empty">
          Consultant profiles have not been published yet.
        </p>
      ) : (
        <div className="kit-consultant-list">
          {doctors.slice(0, layout === "list" ? 4 : 3).map((d) => (
            <article key={d.id}>
              <Link
                to={"/consultants/" + d.id}
                className="kit-consultant-identity"
                aria-label={"View " + d.name}
              >
                {d.photoUrl ? (
                  <img src={d.photoUrl} alt={d.name} loading="lazy" />
                ) : (
                  <span className="kit-consultant-avatar" aria-hidden="true">
                    {d.initials}
                  </span>
                )}
                <div>
                  <p>
                    {services.find((s) => s.id === d.specialty)?.name ||
                      d.specialty.replaceAll("-", " ")}
                  </p>
                  <h3>{d.name}</h3>
                  <small>{d.qualifications}</small>
                </div>
              </Link>
              <div className="kit-consultant-links">
                <Link to={"/consultants/" + d.id}>
                  View profile
                  <ArrowRight size={15} />
                </Link>
                <Link to={"/book?doctor=" + d.id}>
                  View appointment times
                  <ArrowRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      {demoEnabled && (
        <p className="kit-sample-note">
          Sample clinician profiles. No claim about a hospital’s actual roster.
        </p>
      )}
    </section>
  );
}
