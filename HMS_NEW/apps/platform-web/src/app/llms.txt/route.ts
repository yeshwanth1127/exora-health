import { BRAND_NAME } from '../../lib/brand';
import {SITE_ORIGIN} from '../../lib/site';
import {publicPages} from '../../lib/seo';
export const dynamic='force-static';
export function GET(){return new Response(`# ${BRAND_NAME}\n\nHealthcare software for AI reception and routine call handling, appointment workflows, WhatsApp outreach, Google Business management and clinic analytics.\n\n## Product and resources\n${publicPages.filter(p=>p.path!=='/privacy').map(p=>`- [${p.title}](${SITE_ORIGIN+p.path}): ${p.description}`).join('\n')}\n\n## Product boundaries\nDeployment, plan entitlements and provider activation determine available connected services. Product previews contain fictional data. Clinical decisions and urgent-care handling remain with healthcare teams. Consult current plan and setup information rather than inferring guaranteed outcomes.\n`,{headers:{'content-type':'text/plain; charset=utf-8'}})}
