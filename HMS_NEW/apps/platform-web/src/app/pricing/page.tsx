import { pageMetadata } from "../../lib/seo";
import { BRAND_NAME } from "../../lib/brand";
import ResourceShell from '../components/resource-shell';
import PricingContent from './pricing-content';

export default function PricingPage(){return <ResourceShell><PricingContent/></ResourceShell>;}

export const metadata = pageMetadata("/pricing");
