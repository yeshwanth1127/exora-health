import { FAQList } from "../ui/components/FAQList";
import { SectionHeading } from "./SectionHeading";
export function FAQSection() {
  return (
    <section className="kit-faq kit-section kit-container">
      <SectionHeading
        title="Before you visit"
        link="/faq"
        label="All questions"
      >
        Helpful answers for planning your care.
      </SectionHeading>
      <div className="kit-faq-list">
        <FAQList limit={4} />
      </div>
    </section>
  );
}
