import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { DB, Kysely } from '@hms/db';
import { invalid } from '@hms/platform';
import { ChannelOnboardingSaveSchema, ChannelOnboardingSubmitSchema } from '@hms/contracts';
import { authorize } from '../../auth/principal.ts';
import { callerOf, principalOf, parse, uuid, idempotencyKey } from '../support.ts';
import { channelOnboarding, saveChannelOnboarding, submitChannelOnboarding } from '../../modules/comms/onboarding.ts';
const Params = z.object({channel:z.enum(['voice','whatsapp'])});
export function registerChannelOnboardingRoutes(app:FastifyInstance,db:Kysely<DB>) {
  app.get('/v1/channel-onboarding/:channel',async request => {
    const {channel}=parse(Params,request.params), {facilityId}=parse(z.object({facilityId:uuid}),request.query);
    authorize(principalOf(request), channel==='voice'?'voice.read':'comms.read', facilityId);
    return channelOnboarding(db,callerOf(request),facilityId,channel);
  });
  app.put('/v1/channel-onboarding/:channel',async request => {
    const {channel}=parse(Params,request.params), input=parse(ChannelOnboardingSaveSchema,request.body);
    if(input.draft.channel!==channel) throw invalid('Channel must match the route');
    authorize(principalOf(request), channel==='voice'?'voice.manage':'comms.manage', input.facilityId);
    return saveChannelOnboarding(db,callerOf(request),input,idempotencyKey(request));
  });
  app.post('/v1/channel-onboarding/:channel/submit',async request => {
    const {channel}=parse(Params,request.params), input=parse(ChannelOnboardingSubmitSchema,request.body);
    authorize(principalOf(request), channel==='voice'?'voice.manage':'comms.manage', input.facilityId);
    return submitChannelOnboarding(db,callerOf(request),input.facilityId,channel,input.version,idempotencyKey(request));
  });
}
