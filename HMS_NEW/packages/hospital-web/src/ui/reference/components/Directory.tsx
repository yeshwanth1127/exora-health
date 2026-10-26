import { ChevronRight } from "lucide-react";
import { useWebsite } from "../../Runtime";
import { A } from "./A";
import { Crumb } from "./Crumb";

export function Directory({
  kind,
}: {
  kind: "services" | "treatments" | "scans";
}) {
  const { services, treatments, scans, demoEnabled } = useWebsite();

  const data =
    kind === "services" ? services : kind === "treatments" ? treatments : scans;
  const title =
    kind === "services"
      ? "Our services"
      : kind === "treatments"
        ? "Treatments"
        : "Tests & scans";
  const base =
    kind === "services"
      ? "/clinics/"
      : kind === "treatments"
        ? "/treatments/"
        : "/tests-scans/";
  return (
    <div className="hje-directory hje-container">
      <Crumb items={[{ label: title }]} />
      <div className="hje-center-intro">
        <h1>{title}</h1>
        <p>
          {kind === "scans"
            ? "Explore tests and imaging examinations, preparation information and example appointment schedules."
            : "Find the care you need, explore the information and meet the consultants behind it."}
          {demoEnabled
            ? " Services shown are examples for reviewing this website."
            : ""}
        </p>
      </div>
      <div className="hje-directory-links">
        {[...data]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((i) => (
            <A to={base + i.id} key={i.id}>
              <ChevronRight size={16} />
              {i.name}
            </A>
          ))}
      </div>
    </div>
  );
}
