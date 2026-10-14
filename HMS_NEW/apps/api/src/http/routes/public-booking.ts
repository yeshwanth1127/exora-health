import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DB, Kysely } from '@hms/db';
import { forbidden, notFound } from '@hms/platform';
import { authorize, resolvePrincipal } from '../../auth/principal.ts';
import { consumePublicBudget, publicBook, publicCatalog, publicSlots } from '../../modules/booking/public-booking.ts';
import { readSlot, type PublicBookingConfig } from '../../modules/booking/public-config.ts';
import { e164, parse } from '../support.ts';
import type { Caller } from '../../caller.ts';

const Params=z.object({site:z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/)});
const Book=z.strictObject({slotToken:z.string().min(1).max(2000),name:z.string().trim().min(2).max(100),phone:e164,
  email:z.email().max(254).optional(),reason:z.string().trim().max(500).optional()});
const Query=z.strictObject({doctor:z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/),mode:z.enum(['in_person','virtual']),
  from:z.iso.date(),to:z.iso.date()});

/** Deliberately separate public surface. Staff /v1 authentication and CORS remain unchanged. */
export function registerPublicBookingRoutes(parent:FastifyInstance,db:Kysely<DB>,config:PublicBookingConfig) {
  void parent.register(async app=>{
    app.addHook('onRequest',async(request,reply)=>{
      reply.header('cache-control','no-store');
      const {site:slug}=parse(Params,request.params);
      const site=config.sites.find(s=>s.siteSlug===slug);if(!site)throw notFound('Online booking is not configured for this website');
      const origin=request.headers.origin;
      if((origin!==undefined && !site.origins.includes(origin)) || (request.method!=='GET' && !origin))
        throw forbidden('This website is not allowed to use this clinic booking connection.');
      if(origin) {
        reply.header('access-control-allow-origin',origin).header('vary','Origin');
        reply.header('access-control-allow-methods','GET, POST, OPTIONS');
        reply.header('access-control-allow-headers','content-type, idempotency-key');
      }
      if(request.method==='OPTIONS')return reply.status(204).send();
      // Fastify trusts forwarded IPs only from explicit server-owned proxy CIDRs; default trusts none.
      await consumePublicBudget(db,site,config.signingSecret,`ip:${request.ip}:${request.method==='POST'?'write':'read'}`,
        request.method==='POST'?600:60,request.method==='POST'?30:90,new Date());
    });
    const authority=async(request:FastifyRequest)=>{
      const {site:slug}=parse(Params,request.params),site=config.sites.find(s=>s.siteSlug===slug)!;
      const p=await resolvePrincipal(db,{issuer:site.identityIssuer,subject:site.identitySubject},site.tenantId);
      if(!p.isSystemAccount)throw forbidden('Online booking requires a dedicated integration account.');
      authorize(p,'appointments.read',site.facilityId);authorize(p,'appointments.book',site.facilityId);
      const caller:Caller={tenantId:p.tenantId,actor:{kind:'staff',staffId:p.staffId,userId:p.userAccountId},correlationId:request.id};
      return {site,caller};
    };
    const prefix='/public/v1/booking/:site';
    app.options(`${prefix}/*`,async(_request,reply)=>reply.status(204).send());
    app.get(`${prefix}/catalog`,async request=>{
      const {site,caller}=await authority(request);return publicCatalog(db,caller,site);
    });
    app.get(`${prefix}/slots`,async request=>{
      const query=parse(Query,request.query),{site,caller}=await authority(request);
      return publicSlots(db,caller,site,config.signingSecret,query);
    });
    app.post(`${prefix}/appointments`,async(request,reply)=>{
      const body=parse(Book,request.body),key=parse(z.uuid(),request.headers['idempotency-key']);
      const {site,caller}=await authority(request);
      const claim=readSlot(body.slotToken,config.signingSecret);
      const result=await publicBook(db,caller,site,config.signingSecret,body,claim,key);
      return reply.status(201).send(result);
    });
  });
}
