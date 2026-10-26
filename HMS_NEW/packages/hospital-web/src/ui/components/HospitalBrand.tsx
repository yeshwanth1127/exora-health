import { useWebsite } from "../Runtime";

export function HospitalBrand() {
  const { hospital, profile, bound } = useWebsite();
  const logo =
    profile?.content.logoUrl ||
    (!bound || /swastikaa/i.test(hospital.name)
      ? "/brand/swastikaa-hospital.png"
      : undefined);
  return logo ? (
    <img className="hospital-wordmark" src={logo} alt={hospital.name} />
  ) : (
    <span className="tenant-wordmark">{hospital.name}</span>
  );
}
