import { BRAND_NAME } from "../../lib/brand";
import ResourceShell from '../components/resource-shell';
import PricingContent from './pricing-content';
export const metadata={title:("Pricing · " + BRAND_NAME),description:'Proposed location-based pilot plans for clinic booking, reception, patient outreach and visibility.'};
export default function PricingPage(){return <ResourceShell><PricingContent/></ResourceShell>;}
