import {ArrowRight} from 'lucide-react';
import MarketingAsset from './marketing-asset';
import IllustrationSlot from './illustration-slot';
import './showcase-pages.css';
export default function CoreWorkflows(){return <section className="core-workflows" id="appointments-queue" aria-labelledby="core-workflows-title"><header><p className="showcase-kicker">Connected appointment workflows</p><h2 id="core-workflows-title">Keep the day moving.<br/>Wherever care happens.</h2></header><div className="core-workflow-grid">
 <article><header><h3>Appointments & patient queue.</h3><p>Bring bookings, arrivals and patient handoffs into one view for reception and your care team.</p><a href="/teams">Explore clinic workflows <ArrowRight size={17} aria-hidden="true"/></a></header><MarketingAsset name="3a"/></article>
 <article id="teleconsultations"><header><h3>Teleconsultations.</h3><p>Keep remote appointments and administrative follow-ups connected to your configured consultation service.</p><a href="/solutions/teleconsultations">Explore teleconsultations <ArrowRight size={17} aria-hidden="true"/></a></header><IllustrationSlot name="teleconsultations-workflow-2"/></article>
 </div></section>;}
