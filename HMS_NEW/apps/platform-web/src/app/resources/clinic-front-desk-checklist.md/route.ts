import {clinicChecklist} from '../../../lib/clinic-checklist';
import {BRAND_NAME} from '../../../lib/brand';
import {SITE_ORIGIN} from '../../../lib/site';
export const dynamic='force-static';
export function GET(){return new Response(`# Clinic front-desk workflow checklist\n\nBy ${BRAND_NAME}. Adapt this administrative checklist to your team.\n\n${clinicChecklist.map(g=>`## ${g.title}\n${g.items.map(i=>`- [ ] ${i}`).join('\n')}`).join('\n\n')}\n\nSource: ${SITE_ORIGIN}/resources/clinic-front-desk-checklist\nClinical decisions and urgent-care handling remain with your healthcare team.\n`,{headers:{'content-type':'text/markdown; charset=utf-8'}})}
