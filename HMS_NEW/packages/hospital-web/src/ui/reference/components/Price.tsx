import { ChevronRight } from "lucide-react";
import { type CareItem } from "../content";
import { A } from "./A";
import { Pill } from "./Pill";

export function Price({
  item,
  scan = false,
}: {
  item: CareItem;
  scan?: boolean;
}) {
  return (
    <section className="hje-price-section hje-container" id="pricing">
      <div className="hje-price-card">
        <h2>How much does {item.name.toLowerCase()} cost?</h2>
        <strong>Ask about pricing</strong>
        <p>
          Fees will be confirmed by the hospital. Ask what is included, which
          consultations or tests are charged separately and whether any insurer
          authorisation is required.
        </p>
        <p className="hje-small">
          This example page does not offer a procedure price or confirm service
          availability.
        </p>
        <div className="hje-price-actions">
          <Pill to={"/contact?" + (scan ? "scan=" : "treatment=") + item.id}>
            Enquire about fees
          </Pill>
          <A to="/insurance">
            More about payment <ChevronRight size={16} />
          </A>
        </div>
      </div>
    </section>
  );
}
