import { ChevronRight } from "lucide-react";
import { useWebsite } from "../../Runtime";
import { A } from "./A";
import { Pill } from "./Pill";

export function RelatedConsultants({
  specialty,
  title = "Our consultants",
}: {
  specialty: string;
  title?: string;
}) {
  const { doctors, services } = useWebsite();
  const specialtyName = (id: string) =>
    services.find((s) => s.id === id)?.name || id;
  const matches = doctors.filter((d) => d.specialty === specialty);
  return (
    <section className="hje-consultants-section hje-container">
      <h2>{title}</h2>
      <div className="hje-consultant-tiles">
        {matches.map((d) => (
          <A
            className="hje-consultant-tile"
            key={d.id}
            to={"/consultants/" + d.id}
          >
            <span className="hje-avatar" aria-hidden="true">
              {d.initials}
            </span>
            <strong>{d.name}</strong>
            <span>Consultant · {specialtyName(d.specialty)}</span>
            <small>Example profile</small>
          </A>
        ))}
      </div>
      <Pill outline to={"/consultants?service=" + specialty}>
        Show more <ChevronRight size={16} />
      </Pill>
    </section>
  );
}
