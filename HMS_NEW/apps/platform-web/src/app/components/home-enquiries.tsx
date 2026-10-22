import { BRAND_NAME } from "../../lib/brand";
import "./home-enquiries.css";

function ChannelIcon({ call = false }: { call?: boolean }) {
  return call ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 3 4 5c-2 5 6 15 12 15l4-4-5-4-2 3c-3-1-5-3-5-6l3-2-3-4Z" strokeLinejoin="round" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 6 8 6 8-6" strokeLinejoin="round" /></svg>;
}
const enquiries = [
  { asset: "caller-lime", src: "/assets/capture-home-enquiries/caller-lime.webp", channel: "Incoming call", text: "“Do you have an appointment today?”", tone: "lime", call: true },
  { asset: "texter-coral", src: "/assets/capture-home-enquiries/texter-coral.webp", channel: "Patient message", text: "“Can I book a follow-up?”", tone: "coral", call: false },
  { asset: "enquirer-blue", src: "/assets/capture-home-enquiries/enquirer-blue.webp", channel: "New enquiry", text: "“What time does the clinic open?”", tone: "blue", call: false },
  { asset: "parent-lime", src: "/assets/capture-home-enquiries/parent-lime.webp", channel: "Booking call", text: "“I’d like to book for my family.”", tone: "lime", call: true },
  { asset: "home-a", src: "/assets/capture-home-product/home-portrait-a.webp", channel: "", text: "", tone: "blue", call: false },
  { asset: "home-b", src: "/assets/capture-home-product/home-portrait-b.webp", channel: "", text: "", tone: "coral", call: false },
  { asset: "reception", src: "/assets/capture-product-art/ai-reception.webp", channel: "", text: "", tone: "lime", call: true },
  { asset: "outreach", src: "/assets/capture-product-art/whatsapp-outreach.webp", channel: "", text: "", tone: "coral", call: false },
  { asset: "manager", src: "/assets/capture-product-art/clinic-analytics.webp", channel: "", text: "", tone: "blue", call: false },
];

export default function HomeEnquiries() {
  return <section className="home-enquiries" id="patient-conversations" aria-labelledby="home-enquiries-title">
    <div className="home-enquiries-scene">
      {enquiries.map((enquiry, index) => <figure className={`home-enquiry home-enquiry-${index + 1} ${!enquiry.text ? "home-enquiry-face-only" : ""}`} key={enquiry.asset}>
        <div className={`home-enquiry-portrait ${enquiry.tone}`}><img src={enquiry.src} width="160" height="160" alt="" loading="lazy" /></div>
        {enquiry.text && <figcaption><span className="home-enquiry-channel"><ChannelIcon call={enquiry.call} />{enquiry.channel}</span><p>{enquiry.text}</p></figcaption>}
      </figure>)}
      <div className="home-enquiries-copy">
        <h2 id="home-enquiries-title">Be there from<br />the first hello.</h2>
        <p>They’re calling, texting, looking for care.<br />Bring every enquiry closer to an appointment with {BRAND_NAME}.</p>
        <a href="/contact-sales">Book a demo <span aria-hidden="true">→</span></a>
      </div>
    </div>
  </section>;
}
