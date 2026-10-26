import { ArrowRight, Search } from "lucide-react";
import { useState } from "react";
import { useWebsite } from "../Runtime";
import { insuranceLogos } from "../SriLakshmiSections";
import { ButtonLink } from "./ButtonLink";
import { Intro } from "./Intro";
import { Link } from "./Link";

export function Insurance({ query = "" }: { query?: string }) {
  const { insurers, demoEnabled } = useWebsite();

  const [q, setQ] = useState(query),
    [selected, setSelected] = useState("");
  const results = insurers.filter((i) =>
    i.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <Intro eyebrow="Insurance & payment" title="Understand your cover">
        <p>
          {demoEnabled
            ? "A sample insurer directory and a practical checklist for planning a visit."
            : "Published insurer information and a practical checklist for planning a visit."}
        </p>
      </Intro>
      <section className="section container">
        <div className="notice">
          {demoEnabled
            ? "These insurer names demonstrate the directory UI. They do not confirm acceptance, cashless eligibility or hospital partnerships."
            : "Confirm coverage, cashless eligibility and pre-authorisation with the hospital and your insurer for your specific policy."}
        </div>
        <div className="insurance-layout">
          <div>
            <label className="field">
              Find an insurer
              <div className="input-search">
                <input
                  placeholder="Search insurer name"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <Search size={18} />
              </div>
            </label>
            <div className="insurer-grid selectable">
              {results.map((i) => (
                <button
                  className={selected === i ? "selected" : ""}
                  key={i}
                  onClick={() => setSelected(i)}
                >
                  {insuranceLogos.find((p) => p.name === i) && (
                    <img
                      src={insuranceLogos.find((p) => p.name === i)!.src}
                      alt=""
                    />
                  )}
                  <span>{i}</span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
            {!results.length && (
              <div className="empty">
                <h3>No insurers match your search.</h3>
                <button className="text-link" onClick={() => setQ("")}>
                  Clear search
                </button>
              </div>
            )}
            {selected && (
              <div className="insurer-detail" role="status">
                <h3>{selected}</h3>
                <p>
                  This example selection shows the next step: speak with
                  reception and your insurer before treatment.
                </p>
                <ButtonLink
                  to={"/contact?insurer=" + encodeURIComponent(selected)}
                >
                  Ask about cover
                </ButtonLink>
              </div>
            )}
          </div>
          <aside className="info-panel">
            <h2>Before your visit</h2>
            <ol>
              <li>Check your policy and exclusions.</li>
              <li>Confirm hospital eligibility with your insurer.</li>
              <li>Ask whether pre-authorisation is required.</li>
              <li>Bring policy details, ID and relevant reports.</li>
            </ol>
            <Link to="/contact" className="text-link">
              Speak with reception <ArrowRight size={16} />
            </Link>
          </aside>
        </div>
        <div className="payment-strip">
          <h3>Paying directly?</h3>
          <p>
            Ask about consultation fees before attending, or explore health
            checks with clearly listed inclusions.
          </p>
          <ButtonLink outline to="/plans">
            Explore plans
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
