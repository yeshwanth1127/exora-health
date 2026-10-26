import { A } from "./A";

export function Crumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="hje-crumb" aria-label="Breadcrumb">
      <A to="/">Home</A>
      {items.map((i, n) => (
        <span key={n}> » {i.to ? <A to={i.to}>{i.label}</A> : i.label}</span>
      ))}
    </nav>
  );
}
