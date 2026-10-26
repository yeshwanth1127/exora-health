import type { ReactNode } from "react";
import { A } from "./A";

export function Pill({
  to,
  children,
  outline = false,
}: {
  to: string;
  children: ReactNode;
  outline?: boolean;
}) {
  return (
    <A to={to} className={"hje-pill" + (outline ? " hje-pill-outline" : "")}>
      {children}
    </A>
  );
}
