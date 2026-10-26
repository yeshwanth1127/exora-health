import { useWebsite } from "../Runtime";
import { ButtonLink } from "./ButtonLink";
import { CTA } from "./CTA";
import { Intro } from "./Intro";

export function About() {
  const { hospital,profile,demoEnabled } = useWebsite();

  return (
    <>
      <Intro eyebrow="About the hospital" title="A place to start your care">
        <p>
          A website for {hospital.name}, {hospital.area}.
        </p>
      </Intro>
      <section className="section container split">
        <div className="editorial-image">
          <img
            src={profile?.content.storyImage||'/images/cardiology-consultation.jpg'}
            alt={profile?.content.storyImage?hospital.name:'Illustrative consultation photograph'}
          />
        </div>
        <div>
          <h2>
            Know your hospital.
            <br />
            Know your next step.
          </h2>
          <p>
            The website brings doctor profiles, specialty information,
            appointment selection and practical patient information into one
            clear journey.
          </p>
          <p>
            {profile?.content.story||(demoEnabled?'This is a UI demonstration. The hospital’s verified history, leadership, facilities and care team will replace the illustrative content before publication.':'Explore our published services and consultant profiles, or contact reception for more information about the hospital.')}
          </p>
          <ButtonLink to="/consultants">Explore the care team</ButtonLink>
        </div>
      </section>
      <CTA />
    </>
  );
}
