import SiteImage from "./site-image";
import { BRAND_NAME } from "../../lib/brand";
import "./home-closing-cta.css";

function Spark({ className }: { className: string }) {
  return <svg className={`care-spark ${className}`} viewBox="0 0 40 40" fill="currentColor"><path d="M20 2c2 12 6 16 18 18-12 2-16 6-18 18C18 26 14 22 2 20 14 18 18 14 20 2Z" /></svg>;
}

export default function HomeClosingCta({ demoOnly = false }: { demoOnly?: boolean } = {}) {
  return <section className="home-closing-cta" id="more-time-for-care" aria-labelledby="closing-care-title">
    <div className="care-doodles" aria-hidden="true">
      <SiteImage className="care-object care-stethoscope" src="/assets/capture-footer/stethoscope.webp" alt="" width="300" height="300" loading="lazy" />
      <SiteImage className="care-object care-bandages" src="/assets/capture-footer/bandages.webp" alt="" width="180" height="180" loading="lazy" />
      <SiteImage className="care-object care-syringe" src="/assets/capture-footer/syringe.webp" alt="" width="220" height="220" loading="lazy" />
      <SiteImage className="care-object care-first-aid" src="/assets/capture-footer/first-aid.webp" alt="" width="270" height="270" loading="lazy" />
      <Spark className="spark-one" /><Spark className="spark-two" /><Spark className="spark-three" /><Spark className="spark-four" /><Spark className="spark-five" /><Spark className="spark-six" />
      <span className="care-dot dot-one" /><span className="care-dot dot-two" /><span className="care-dot dot-three" />
      <svg className="care-loop" viewBox="0 0 100 70" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><path d="M7 48C26 4 69 6 63 31c-6 25-38 7-17-11C61 7 82 17 91 29" /></svg>
    </div>
    <div className="closing-care-copy">
      <h2 id="closing-care-title">A little less admin.<br />A lot more care.</h2>
      <p>Calls, appointments and patient conversations.<br />{" "}Bring your clinic day together with {BRAND_NAME}.</p>
      <div className="closing-care-actions"><a className="closing-care-primary" href={demoOnly ? "/contact-sales" : "/quote"}>{demoOnly ? "Request a demo" : `Explore ${BRAND_NAME}`} <span aria-hidden="true">↗</span></a>{!demoOnly && <a className="closing-care-secondary" href="/contact-sales">Request a demo</a>}</div>
    </div>
  </section>;
}
