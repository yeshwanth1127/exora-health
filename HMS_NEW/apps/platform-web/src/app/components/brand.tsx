import { BRAND_NAME } from "../../lib/brand";
/** Shared marketing identity. The selected bell is the original generated PNG. */
export default function CaptureBrand(){return <span className="capture-wordmark"><span className="capture-brand-symbol" aria-hidden="true"><img src="/assets/capture-brand/reception-bell.png" width="64" height="64" alt=""/></span>{BRAND_NAME}</span>}
