import { BRAND_NAME } from "../../../lib/brand";
const tools = [
  { name: BRAND_NAME, tag: "Built around your clinic", description: "Reception, outreach and visibility. Together.", logo: "/capture-bell-icon-v3.png", featured: true },
  { name: "Google Voice", tag: "Business phone system", description: "Calling, voicemail and call routing.", logo: "/assets/comparison/google-voice.svg", featured: false },
  { name: "WhatsApp Business", tag: "Business messaging app", description: "Customer conversations on WhatsApp.", logo: "/assets/comparison/whatsapp-business.png", featured: false },
  { name: "Google Business Profile", tag: "Local business presence", description: "Your business on Search and Maps.", logo: "/assets/comparison/google-business-profile.svg", featured: false },
];
const features = [
  { title: "Reception & calls", accent: "lime", cells: ["AI reception & staff handover", "Calling & call routing", "Business messaging", "Phone number on profile"] },
  { title: "WhatsApp outreach", accent: "blue", cells: ["Campaigns & shared inbox", "Separate tool", "Customer messaging", "Separate tool"] },
  { title: "Google Business", accent: "coral", cells: ["Profile & review management", "Separate tool", "Separate tool", "Profile & review management"] },
  { title: "Business insights", accent: "lime", cells: ["Calls, outreach & appointments", "Phone activity", "Messaging activity", "Profile performance"] },
  { title: "Clinic workflow", accent: "blue", cells: ["One connected workspace", "Phone workflow", "Messaging workflow", "Business profile workflow"] },
];

export default function ClinicComparison() {
  return (
    <section className="clinic-comparison" id="compare-tools" aria-labelledby="clinic-comparison-title">
      <header>
        <p className="clinic-comparison-eyebrow">Why {BRAND_NAME}</p>
        <h2 id="clinic-comparison-title">More clinic. Fewer tools.</h2>
        <p>Other tools cover a part of the patient journey.<br />{BRAND_NAME} brings the pieces together.</p>
      </header>
      <div className="clinic-comparison-scroll" role="region" aria-label={("Compare " + BRAND_NAME + " with other tools")} tabIndex={0}>
        <table>
          <thead><tr>
            <th scope="col" className="clinic-comparison-intro"><span>Find the right fit<br />for your clinic.</span><small>Your everyday work,<br />side by side.</small></th>
            {tools.map(tool => <th scope="col" key={tool.name} className={tool.featured ? "is-capture" : undefined}>
              <span className="clinic-tool-tag">{tool.tag}</span>
              <span className="clinic-tool-mark" aria-hidden="true"><img src={tool.logo} width="40" height="40" alt="" loading="lazy" /></span>
              <span className="clinic-tool-name">{tool.name}</span>
              <span className="clinic-tool-description">{tool.description}</span>
              {tool.featured && <a href="/contact-sales" className="clinic-compare-cta">Book a demo <span aria-hidden="true">→</span></a>}
            </th>)}
          </tr></thead>
          <tbody>{features.map(row => <tr key={row.title}>
            <th scope="row"><span className={`clinic-comparison-dot ${row.accent}`} aria-hidden="true" />{row.title}</th>
            {row.cells.map((cell, index) => <td key={index} className={index === 0 ? "is-capture" : cell === "Separate tool" ? "is-separate" : undefined}>{index === 0 && <span className="clinic-comparison-check" aria-hidden="true">✓</span>}<span>{cell}</span></td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <p className="clinic-comparison-note">Compares each standalone product’s focus. “Separate tool” means an additional product is needed for that workflow. Features vary by plan and region. <span>Explore: <a href="https://workspace.google.com/products/voice/" target="_blank" rel="noreferrer">Google Voice ↗</a> · <a href="https://whatsappbusiness.com/products/business-app/" target="_blank" rel="noreferrer">WhatsApp Business ↗</a> · <a href="https://business.google.com/us/business-profile/" target="_blank" rel="noreferrer">Google Business Profile ↗</a></span></p>
    </section>
  );
}
