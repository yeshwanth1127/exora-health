import { BRAND_NAME } from "../../lib/brand";
import QuoteOnboarding from "../components/quote-onboarding";
import "./quote.css";
export const metadata={title:("Your clinic plan · " + BRAND_NAME),robots:{index:false,follow:false}};
export default function QuotePage(){return <QuoteOnboarding/>}
