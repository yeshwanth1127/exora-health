import { pageMetadata } from "../../lib/seo";
import { BRAND_NAME } from "../../lib/brand";
import ResourceShell from '../components/resource-shell';
import HelpCentre from './help-centre';

export default function HelpPage(){return <ResourceShell><HelpCentre/></ResourceShell>;}

export const metadata = pageMetadata("/help");
