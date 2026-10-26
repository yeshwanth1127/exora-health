import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { runQuery, notFound } from '@hms/platform';

// Optional editorial content is operator supplied, public and scoped to the deployment.
// Hospital identities/contact information always come from persisted tenant/facility records.
const copy = z.string().trim().min(1).max(1000);
const mediaUrl = z.string().max(2000).refine(value => /^\/(?!\/)[^\\\s]+$/.test(value) || (() => { try { return new URL(value).protocol === 'https:'; } catch { return false; } })(), 'Use a same-origin path or HTTPS media URL');
const care = z.strictObject({id:z.string().regex(/^[a-z0-9-]+$/),name:copy,specialty:z.string().regex(/^[a-z0-9-]+$/),summary:copy,knownAs:copy,image:mediaUrl,overview:copy,preparation:copy,questions:z.array(copy).max(20)});
export const WebsiteContent = z.strictObject({
  services:z.array(z.strictObject({id:z.string().regex(/^[a-z0-9-]+$/),name:copy,short:copy,description:copy,prepare:copy,image:mediaUrl,conditions:z.array(copy).max(30)})).max(50).optional(),
  treatments:z.array(care).max(100).optional(),scans:z.array(care).max(100).optional(),
  insurers:z.array(copy).max(100).optional(),faqs:z.array(z.strictObject({q:copy,a:copy})).max(50).optional(),
  logoUrl: mediaUrl.optional(), heroImage: mediaUrl.optional(), storyImage: mediaUrl.optional(),
  headline: copy.optional(), introduction: copy.optional(), story: copy.optional(),
  photos: z.array(z.strictObject({ src: mediaUrl, title: copy, alt: copy, width: z.number().int().min(1).max(20000), height: z.number().int().min(1).max(20000) })).max(30).default([]),
  packages: z.array(z.strictObject({ id: z.string().regex(/^[a-z0-9-]+$/), name: copy, description: copy, priceMinor: z.number().int().min(0), inclusions: z.array(copy).max(30) })).max(30).default([]),
});
export function websiteContent(raw?: string) {
  // A malformed deployment configuration must fail visibly, never fall back to another hospital.
  return WebsiteContent.parse(raw ? JSON.parse(raw) : {});
}
export async function tenantWebsiteProfile(db: Kysely<DB>, tenantId: string, content: z.infer<typeof WebsiteContent>, preferredFacilityId?: string, runtime?:{template:string;bookingSite:string|null}) {
  return runQuery(db, tenantId, async tx => {
    const tenant = await tx.selectFrom('platform.tenant').select(['name','slug','status']).where('id','=',tenantId).executeTakeFirst();
    if (!tenant || !['trial','active'].includes(tenant.status)) throw notFound('Hospital website is unavailable');
    let facilities = tx.selectFrom('platform.facility').select(['id','name','city','timezone','address_line1','address_line2','pincode','phone']).where('status','=','active');
    if (preferredFacilityId) facilities = facilities.where('id','=',preferredFacilityId);
    const facility = await facilities.orderBy('created_at').orderBy('id').executeTakeFirst();
    let publishedContent=content, runtimeInfo:Record<string,unknown>={};
    if(runtime?.template==='swastikaa'){
      const {readWebsiteSettings}=await import('./website-settings.ts');
      const saved=facility?await readWebsiteSettings(tx,facility.id):null;
      if(saved?.version)publishedContent=saved.content;
      runtimeInfo={runtime:{template:'swastikaa',demoEnabled:saved?.demoEnabled??true,bookingSite:runtime.bookingSite,facilityId:facility?.id??null}};
    }
    return {
      ...runtimeInfo,
      name: facility?.name || tenant.name, organisation: tenant.name, slug: tenant.slug,
      city: facility?.city || '', timezone: facility?.timezone || '',
      address: [facility?.address_line1,facility?.address_line2,facility?.city,facility?.pincode].filter(Boolean).join(', '),
      phone: facility?.phone || '', content:publishedContent,
    };
  });
}
