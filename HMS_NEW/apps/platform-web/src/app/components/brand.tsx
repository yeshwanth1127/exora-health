import SiteImage from "./site-image";
import { BRAND_NAME, BRAND_LOGO } from "../../lib/brand";
/** Shared marketing identity using the selected original artwork. */
export default function CaptureBrand(){return <span className="capture-wordmark"><span className="capture-brand-symbol" aria-hidden="true"><SiteImage src={BRAND_LOGO} width="64" height="64" alt=""/></span>{BRAND_NAME}</span>}
