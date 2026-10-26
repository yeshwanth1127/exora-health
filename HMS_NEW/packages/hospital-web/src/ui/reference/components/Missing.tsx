import { Pill } from "./Pill";

export function Missing() {
  return (
    <section className="hje-container hje-missing">
      <h1>Let’s help you find your way.</h1>
      <p>This care page is not currently available.</p>
      <Pill to="/">Return home</Pill>
    </section>
  );
}
