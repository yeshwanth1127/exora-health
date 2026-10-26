import { ArrowRight } from "lucide-react";
import { Pill } from "./Pill";

export function Payment({ scan = false }: { scan?: boolean }) {
  return (
    <section className="hje-payment hje-container">
      <h2>How to pay for your {scan ? "test" : "treatment"}</h2>
      <div className="hje-payment-grid">
        <div>
          <h3>If you’re… paying for yourself</h3>
          <p>
            Ask about consultation and examination fees before your visit. The
            team can explain what an estimate includes and any separate charges
            that may apply.
          </p>
          <p>
            Any preparation, referral requirements and next steps will be
            confirmed for your individual appointment.
          </p>
        </div>
        <div>
          <h3>If you’re… insured</h3>
          <p>
            Check your policy, hospital eligibility and any authorisation
            requirements with your insurer before arranging care.
          </p>
          <p>
            The logos in this preview are illustrative. They do not establish
            hospital empanelment or policy acceptance.
          </p>
        </div>
      </div>
      <Pill to="/insurance">
        Find out more <ArrowRight size={16} />
      </Pill>
    </section>
  );
}
