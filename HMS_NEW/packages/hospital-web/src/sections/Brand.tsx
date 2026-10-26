import { useWebsite } from "../ui/Runtime";
import { Link } from "../ui/components/Link";
export function Brand() {
  const { hospital, profile } = useWebsite();
  return (
    <Link to="/" className="kit-brand" aria-label={hospital.name + " home"}>
      {profile?.content.logoUrl ? (
        <img src={profile.content.logoUrl} alt={hospital.name} />
      ) : (
        <span>{hospital.name}</span>
      )}
    </Link>
  );
}
