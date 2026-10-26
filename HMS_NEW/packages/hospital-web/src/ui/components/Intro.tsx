import type { ReactNode } from "react";
import { Link } from "./Link";

export function Intro({
  eyebrow,
  title,
  children,
  crumb,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  crumb?: string;
}) {
  return (
    <section className="page-intro">
      <div className="container">
        <div className="crumb">
          <Link to="/">Home</Link>
          <span>/ {crumb || eyebrow}</span>
        </div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children && <div className="intro-copy">{children}</div>}
      </div>
    </section>
  );
}
