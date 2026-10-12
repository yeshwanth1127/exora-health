import { useAssetUrl } from "./use-private-asset";
export function PrivateAssetImage({
  id,
  alt,
  className,
}: {
  id: string;
  alt: string;
  className?: string;
}) {
  const { url, error } = useAssetUrl(id);
  return url ? (
    <img src={url} alt={alt} className={className} />
  ) : (
    <span className="text-xs text-muted-foreground">
      {error || "Loading private preview…"}
    </span>
  );
}
export function PrivateAssetLink({
  id,
  children,
  className,
}: {
  id: string;
  children?: import("react").ReactNode;
  className?: string;
}) {
  const { url, error } = useAssetUrl(id);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <span className="text-xs text-muted-foreground">
      {error || "Loading private file…"}
    </span>
  );
}
