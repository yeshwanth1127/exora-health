import { BRAND_NAME } from "../../lib/brand";
import ResourceShell from '../components/resource-shell';
import HelpCentre from './help-centre';
export const metadata={title:("Help centre · " + BRAND_NAME),description:("Answers about getting started, reception, bookings, outreach and your " + BRAND_NAME + " workspace.")};
export default function HelpPage(){return <ResourceShell><HelpCentre/></ResourceShell>;}
