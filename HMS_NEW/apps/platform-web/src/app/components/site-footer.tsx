import { BRAND_NAME } from "../../lib/brand";
import CaptureBrand from "./brand";
import "./site-footer.css";
const groups=[{title:"Product",links:[["Features","/product/features"],["Pricing","/pricing"],["Request a demo","/contact-sales"]]},{title:"Solutions",links:[["For clinics","/teams"],["For hospitals","/enterprise"]]},{title:"Resources",links:[["Blog","/blog"],["Help centre","/help"],["What’s new","/releases"]]}];
export default function SiteFooter(){return <footer className="capture-site-footer" id="site-footer"><div className="capture-footer-main"><div><a href="/" aria-label={(BRAND_NAME + " – Home")}><CaptureBrand /></a><p>A clearer clinic day.<br/>More time for care.</p></div><nav aria-label="Footer">{groups.map(g=><div key={g.title}><h2>{g.title}</h2>{g.links.map(([label,href])=><a key={href} href={href}>{label}</a>)}</div>)}</nav></div><p className="capture-footer-bottom">© 2026 {BRAND_NAME}</p></footer>}
