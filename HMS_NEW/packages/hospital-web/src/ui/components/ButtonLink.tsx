import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "./Link";

export function ButtonLink({
  to,
  children,
  outline = false,
}: {
  to: string;
  children: ReactNode;
  outline?: boolean;
}) {
  return (
    <Link to={to} className={"btn" + (outline ? " outline" : "")}>
      {children}
      <ArrowUpRight size={15} />
    </Link>
  );
}
