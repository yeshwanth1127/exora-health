import { Badge, type BadgeProps } from "@/components/arc/badge/badge";

/** Keep existing growth status/content bindings while using the adopted badge. */
export function GrowthBadge({
  variant = "outline",
  className,
  ...props
}: Omit<BadgeProps, "tone" | "size"> & {
  variant?: "default" | "secondary" | "outline" | "destructive";
}) {
  return (
    <Badge
      {...props}
      size="sm"
      tone={
        variant === "destructive"
          ? "danger"
          : variant === "secondary"
            ? "info"
            : "neutral"
      }
      className={["arc-demo-scope", className].filter(Boolean).join(" ")}
    />
  );
}
