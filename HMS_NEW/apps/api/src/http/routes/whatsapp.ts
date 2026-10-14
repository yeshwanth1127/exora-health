import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { forbidden, preconditionFailed, invalid } from '@hms/platform';
import {
  WhatsAppDeliveryQuerySchema,
  ConversationCreateSchema,
  ConversationReplySchema,
  VersionCommandSchema,
  SupportCaseCreateSchema,
  SupportCaseStatusSchema,
  WhatsAppUploadSchema,
  MessageTemplateCreateSchema,
  MessageTemplateEditSchema,
  CampaignCreateSchema,
  CampaignApproveSchema,
  CampaignTestSchema,
  ContactInterestSchema,
  WhatsAppSettingsUpsertSchema,
  TemplateProviderStatusInputSchema,
  TemplateSubmissionInputSchema,
} from '@hms/contracts';
import { authorize, grantedFacilities } from '../../auth/principal.ts';
import { contactOwner } from '../../modules/comms/notifications.ts';
import {
  settings,
  saveSettings,
  conversations,
  conversationFacility,
  inboxContacts,
  thread,
  openConversation,
  conversationCommand,
  createCase,
  caseConversation,
  caseStatus,
  assets,
  assetRecord,
  assetContent,
  uploadAsset,
  templates,
  createTemplate,
  editTemplate,
  templateFacility,
  campaigns,
  campaignFacility,
  createCampaign,
  campaignPreview,
  campaignAction,
  declareInterest,
  deliveryHistory,
  storeWhatsAppCallback,
  validateWhatsAppAccountBinding,
} from '../../modules/comms/whatsapp.ts';
import { decodeWhatsAppWebhook } from '../../modules/comms/whatsapp-webhook.ts';
import { checkTemplateProviderStatus } from '../../modules/comms/template-provider-status.ts';
import { submitTemplate, listTemplateSubmissions } from '../../modules/comms/template-submissions.ts';
import { callerOf, idempotencyKey, parse, principalOf, uuid } from '../support.ts';
export function registerWhatsAppRoutes(app: FastifyInstance, db: Kysely<DB>, options:{templateFetcher?:typeof fetch} = {}) {
  const scoped = (request: any, permission: string, facilityId: string) =>
    authorize(principalOf(request), permission, facilityId);
  const reveal = (request: any, facilityId: string) => {
    const grants = grantedFacilities(principalOf(request), 'comms.reply');
    return grants === null || grants.has(facilityId);
  };
  app.get('/v1/comms/settings', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
    scoped(request, 'comms.read', facilityId);
    return settings(db, callerOf(request), facilityId);
  });
  app.put('/v1/comms/settings', async (request) => {
    const input = parse(WhatsAppSettingsUpsertSchema, request.body);
    scoped(request, 'comms.manage', input.facilityId);
    return saveSettings(db, callerOf(request), input, idempotencyKey(request));
  });
  app.get('/v1/conversations/contacts', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
    scoped(request, 'comms.read', facilityId);
    scoped(request, 'patients.read', facilityId);
    scoped(request, 'appointments.read', facilityId);
    return inboxContacts(db, callerOf(request), facilityId, reveal(request, facilityId));
  });
  app.get('/v1/conversations', async (request) => {
    const q = parse(
      z.object({
        facilityId: uuid,
        status: z.enum(['open', 'closed']).optional(),
        search: z.string().trim().max(100).optional(),
        kind: z.enum(['reception', 'issue', 'feedback']).optional(),
        offset: z.coerce.number().int().min(0).max(10000).default(0),
        limit: z.coerce.number().int().min(1).max(100).default(30),
      }),
      request.query,
    );
    scoped(request, 'comms.read', q.facilityId);
    return conversations(db, callerOf(request), q, reveal(request, q.facilityId));
  });
  app.post('/v1/conversations', async (request) => {
    const input = parse(ConversationCreateSchema, request.body);
    scoped(request, 'comms.reply', input.facilityId);
    const owner = await contactOwner(db, callerOf(request), input.contactPointId);
    scoped(request, owner.patientId ? 'patients.read' : 'appointments.read', owner.facilityId);
    const opened = await openConversation(db, callerOf(request), input, idempotencyKey(request));
    return { id: opened.conversation.id, version: opened.conversation.version };
  });
  app.get('/v1/conversations/:id', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const facility = await conversationFacility(db, callerOf(request), id);
    scoped(request, 'comms.read', facility);
    return thread(db, callerOf(request), id, reveal(request, facility));
  });
  for (const action of ['assign', 'close', 'reply', 'handoff', 'resume'] as const)
    app.post(`/v1/conversations/:id/${action}`, async (request) => {
      const { id } = parse(z.object({ id: uuid }), request.params);
      const input =
        action === 'reply' ? parse(ConversationReplySchema, request.body) : parse(VersionCommandSchema, request.body);
      scoped(request, 'comms.reply', await conversationFacility(db, callerOf(request), id));
      return conversationCommand(db, callerOf(request), id, input, action, idempotencyKey(request));
    });
  app.post('/v1/support-cases', async (request) => {
    const input = parse(SupportCaseCreateSchema, request.body);
    scoped(request, 'comms.reply', await conversationFacility(db, callerOf(request), input.conversationId));
    return createCase(db, callerOf(request), input, idempotencyKey(request));
  });
  app.post('/v1/support-cases/:id/status', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params),
      input = parse(SupportCaseStatusSchema, request.body);
    scoped(
      request,
      'comms.reply',
      await conversationFacility(db, callerOf(request), await caseConversation(db, callerOf(request), id)),
    );
    return caseStatus(db, callerOf(request), id, input, idempotencyKey(request));
  });
  app.get('/v1/comms/assets', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
    scoped(request, 'comms.read', facilityId);
    return assets(db, callerOf(request), facilityId);
  });
  app.get('/v1/comms/assets/:id/content', async (request, reply) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const record = await assetRecord(db, callerOf(request), id);
    scoped(request, 'comms.read', record.facility_id);
    const content = await assetContent(db, callerOf(request), id);
    reply
      .header('cache-control', 'private, no-store')
      .header('x-content-type-options', 'nosniff')
      .header('content-disposition', `attachment; filename="${content.filename.replace(/[^a-zA-Z0-9_. -]/g, '_')}"`);
    return reply.type(content.mimeType).send(content.bytes);
  });
  for (const [url, kind] of [
    ['/v1/practitioners/:id/whatsapp-photo', 'practitioner'],
    ['/v1/departments/:id/whatsapp-guide', 'department'],
    ['/v1/campaign-assets', 'campaign'],
  ] as const) {
    const handler = async (request: any) => {
      const input = parse(WhatsAppUploadSchema, request.body);
      scoped(request, 'comms.manage', input.facilityId);
      const id = kind === 'campaign' ? null : parse(z.object({ id: uuid }), request.params).id;
      return uploadAsset(db, callerOf(request), kind, id, input, idempotencyKey(request));
    };
    if (kind === 'campaign') app.post(url, { bodyLimit: 15_000_000 }, handler);
    else app.put(url, { bodyLimit: 15_000_000 }, handler);
  }
  app.get('/v1/message-templates', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
    scoped(request, 'comms.read', facilityId);
    return templates(db, callerOf(request), facilityId);
  });
  app.post('/v1/message-templates', async (request) => {
    const input = parse(MessageTemplateCreateSchema, request.body);
    scoped(request, 'comms.manage', input.facilityId);
    return createTemplate(db, callerOf(request), input, idempotencyKey(request));
  });
  app.patch('/v1/message-templates/:templateId', async request => {
    const { templateId } = parse(z.object({ templateId: uuid }), request.params);
    const input = parse(MessageTemplateEditSchema, request.body);
    const actualFacility = await templateFacility(db, callerOf(request), templateId);
    scoped(request, 'comms.manage', actualFacility);
    if (actualFacility !== input.facilityId) throw invalid('Template belongs to another clinic');
    return editTemplate(db, callerOf(request), templateId, input, idempotencyKey(request));
  });
  app.post('/v1/message-templates/:templateId/provider-status',async request => {
    const {templateId}=parse(z.object({templateId:uuid}),request.params);
    const input=parse(TemplateProviderStatusInputSchema,request.body);
    const actual=await templateFacility(db,callerOf(request),templateId);
    scoped(request,'comms.manage',actual);
    if(actual!==input.facilityId)throw invalid('Template belongs to another clinic');
    return checkTemplateProviderStatus(db,callerOf(request),templateId,input,idempotencyKey(request),{fetcher:options.templateFetcher});
  });
  app.post('/v1/message-templates/:templateId/submissions',async request=>{
    const {templateId}=parse(z.object({templateId:uuid}),request.params);
    const input=parse(TemplateSubmissionInputSchema,request.body);
    const actual=await templateFacility(db,callerOf(request),templateId);
    scoped(request,'comms.manage',actual);
    if(actual!==input.facilityId)throw invalid('Template belongs to another clinic');
    return submitTemplate(db,callerOf(request),templateId,input,idempotencyKey(request));
  });
  app.get('/v1/message-templates/:templateId/submissions',async request=>{
    const {templateId}=parse(z.object({templateId:uuid}),request.params);
    const actual=await templateFacility(db,callerOf(request),templateId);
    scoped(request,'comms.read',actual);
    return listTemplateSubmissions(db,callerOf(request),templateId);
  });
  app.post('/v1/message-templates/sync', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.body);
    scoped(request, 'comms.manage', facilityId);
    throw preconditionFailed('Meta template synchronization is unavailable; local templates have no provider approval');
  });
  app.get('/v1/campaigns', async (request) => {
    const { facilityId } = parse(z.object({ facilityId: uuid }), request.query);
    scoped(request, 'comms.read', facilityId);
    return campaigns(db, callerOf(request), facilityId);
  });
  app.post('/v1/campaigns', async (request) => {
    const input = parse(CampaignCreateSchema, request.body);
    scoped(request, 'campaigns.manage', input.facilityId);
    return createCampaign(db, callerOf(request), input, idempotencyKey(request));
  });
  app.get('/v1/campaigns/:id/preview', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    scoped(request, 'campaigns.manage', await campaignFacility(db, callerOf(request), id));
    return campaignPreview(db, callerOf(request), id);
  });
  for (const action of ['test', 'approve', 'pause'] as const)
    app.post(`/v1/campaigns/:id/${action}`, async (request) => {
      const { id } = parse(z.object({ id: uuid }), request.params);
      const input =
        action === 'approve'
          ? parse(CampaignApproveSchema, request.body)
          : action === 'test'
            ? parse(CampaignTestSchema, request.body)
            : parse(VersionCommandSchema, request.body);
      scoped(
        request,
        action === 'approve' ? 'campaigns.approve' : 'campaigns.manage',
        await campaignFacility(db, callerOf(request), id),
      );
      return campaignAction(db, callerOf(request), id, input, action, idempotencyKey(request));
    });
  app.post('/v1/contact-points/:id/interests', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params),
      input = parse(ContactInterestSchema, request.body);
    const owner = await contactOwner(db, callerOf(request), id);
    scoped(request, 'comms.manage', owner.facilityId);
    scoped(request, owner.patientId ? 'patients.read' : 'appointments.read', owner.facilityId);
    return declareInterest(db, callerOf(request), id, input, idempotencyKey(request));
  });
  app.get('/v1/whatsapp/outbound', async (request) => {
    const q = parse(WhatsAppDeliveryQuerySchema, request.query);
    scoped(request, 'comms.read', q.facilityId);
    return deliveryHistory(db, callerOf(request), q);
  });
  // Encapsulated raw-body parser is mandatory: signatures cover exact bytes, not reserialized JSON.
  void app.register(async (webhook) => {
    webhook.removeContentTypeParser('application/json');
    webhook.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
    const limits = new Map<string, { count: number; at: number }>();
    webhook.addHook('onRequest', async (request) => {
      const now = Date.now(),
        key = request.ip,
        r = limits.get(key);
      if (!r || now - r.at > 60000) {
        if (limits.size > 10000) limits.clear();
        limits.set(key, { count: 1, at: now });
      } else if (++r.count > 120) throw forbidden('webhook rate limit exceeded');
    });
    webhook.get('/v1/integrations/whatsapp/webhook', async (request) => {
      const q = request.query as Record<string, unknown>,
        token = process.env.WA_VERIFY_TOKEN;
      if (
        !token ||
        q['hub.mode'] !== 'subscribe' ||
        q['hub.verify_token'] !== token ||
        typeof q['hub.challenge'] !== 'string'
      )
        throw forbidden('invalid webhook verification');
      return q['hub.challenge'];
    });
    webhook.post('/v1/integrations/whatsapp/webhook', async (request) => {
      const secret = process.env.WA_APP_SECRET,
        raw = request.body;
      if (!secret || !Buffer.isBuffer(raw)) throw forbidden('WhatsApp webhook is not configured');
      const sig = request.headers['x-hub-signature-256'];
      if (typeof sig !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(sig)) throw forbidden('invalid webhook signature');
      const expected = createHmac('sha256', secret).update(raw).digest(),
        provided = Buffer.from(sig.slice(7), 'hex');
      if (!timingSafeEqual(expected, provided)) throw forbidden('invalid webhook signature');
      let body: any;
      try {
        body = JSON.parse(raw.toString('utf8'));
      } catch {
        throw invalid('invalid JSON');
      }
      const values = decodeWhatsAppWebhook(body);
      // Reject unknown/staff-reassigned accounts before storing any part of a batch.
      for (const { binding } of values) await validateWhatsAppAccountBinding(db, binding);
      for (const { binding, value } of values)
        await storeWhatsAppCallback(db, binding.phoneNumberId, value, binding);
      return { accepted: true };
    });
  });
}
