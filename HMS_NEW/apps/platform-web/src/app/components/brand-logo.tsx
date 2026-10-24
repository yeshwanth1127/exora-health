import SiteImage from "./site-image";
import CaptureBrand from "./brand";
import { BRAND_LOGO } from "../../lib/brand";
export function BrandSymbol({className=""}:{className?:string}){return <SiteImage className={className} src={BRAND_LOGO} alt="" width="48" height="48"/>}
export default function BrandLogo(){return <CaptureBrand/>}
