import { ButtonLink } from "./ButtonLink";
import { Intro } from "./Intro";

export function NotFound() {
  return (
    <>
      <Intro eyebrow="Page not found" title="Let’s help you find your way." />
      <section className="section container">
        <ButtonLink to="/">Return home</ButtonLink>
      </section>
    </>
  );
}
