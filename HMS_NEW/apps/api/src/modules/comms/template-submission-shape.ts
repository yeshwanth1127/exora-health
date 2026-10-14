import { createHash } from 'node:crypto';
import { TemplateSubmissionSchema } from '@hms/contracts';
export type TemplateContent = {body:string;language:string;category:string;parameter_count:number;header?:string};
/** Aliases, examples and row versions cannot authorize another creation of the same content. */
export function templateContentHash(r:TemplateContent) {
 return createHash('sha256').update(JSON.stringify([r.body,r.language,r.category,r.parameter_count,r.header ?? 'none'])).digest('hex');
}
export function templateSubmissionDto(r:any, current?:TemplateContent) {
 return TemplateSubmissionSchema.parse({id:r.id,templateId:r.template_id,facilityId:r.facility_id,templateVersion:r.template_version,
  providerName:r.provider_name,body:r.body,language:r.language,category:r.category,parameterCount:r.parameter_count,samples:r.samples,
  state:r.state,providerTemplateId:r.provider_template_id,providerStatus:r.provider_status,reason:r.reason,
  createdAt:new Date(r.created_at).toISOString(),updatedAt:new Date(r.updated_at).toISOString(),version:r.version,
  currentDraftMatches:current ? templateContentHash(current)===r.content_sha256 : true});
}
