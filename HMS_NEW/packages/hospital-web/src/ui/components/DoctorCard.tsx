import { ArrowRight } from "lucide-react";
import { useWebsite } from "../Runtime";
import { doctors } from "../data";
import { Link } from "./Link";

export function DoctorCard({ doctor }: { doctor: (typeof doctors)[number] }) {
  const { doctors, specialties, demoEnabled } = useWebsite();
  const specialtyName = (id: string) =>
    specialties.find((s) => s.id === id)?.name || id;
  return (
    <article className="doctor-card">
      <Link
        to={"/consultants/" + doctor.id}
        className="doctor-portrait"
        aria-label={"View " + doctor.name}
      >
        <span>{doctor.initials}</span>
        <small>{demoEnabled ? "Sample profile" : "Consultant profile"}</small>
      </Link>
      <div className="doctor-card-copy">
        <p className="eyebrow">{specialtyName(doctor.specialty)}</p>
        <h3>
          <Link to={"/consultants/" + doctor.id}>{doctor.name}</Link>
        </h3>
        <p>{doctor.qualifications}</p>
        <p className="muted">
          {doctor.experience} experience
          {demoEnabled ? " · Example credentials" : ""}
        </p>
        <div className="doctor-card-actions">
          <Link to={"/consultants/" + doctor.id}>
            View profile <ArrowRight size={15} />
          </Link>
          <Link to={"/book?doctor=" + doctor.id} className="small-btn">
            Book appointment
          </Link>
        </div>
      </div>
    </article>
  );
}
