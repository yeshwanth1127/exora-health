import ResourceShell from '../../components/resource-shell';
import CareTeamPage from '../../components/care-team-page';
import {pageMetadata} from '../../../lib/seo';
export const metadata=pageMetadata('/specialties/physiotherapy');
export default function Page(){return <ResourceShell><CareTeamPage audience="physiotherapy"/></ResourceShell>;}
