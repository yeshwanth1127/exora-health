import { Accordion } from "../../vendor/arc/accordion/accordion";
import { useWebsite } from "../Runtime";

export function FAQList({ limit }: { limit?: number }) {
  const { faqs } = useWebsite();

  return (
    <Accordion
      size="lg"
      defaultOpen={-1}
      items={faqs
        .slice(0, limit ?? faqs.length)
        .map((f) => ({ title: f.q, content: f.a }))}
    />
  );
}
