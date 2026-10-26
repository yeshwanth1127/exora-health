import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';

/** Select only a bundled site. No request or environment value becomes a filesystem path. */
export async function registerTenantWebAssets(app: FastifyInstance, options: {
  root: string; template?: string; bookingSite?: string;
}) {
  const template = options.template || 'standard';
  if (template !== 'standard' && template !== 'sri-lakshmi' && template !== 'hospital-editorial') throw new Error('Unknown website template');
  if (template === 'sri-lakshmi' && !options.bookingSite) throw new Error('Sri Lakshmi website requires a tenant booking site');
  if (template === 'hospital-editorial' && !options.bookingSite) throw new Error('Editorial website requires a tenant booking site');
  const publicRoot = path.join(options.root, template === 'sri-lakshmi' ? 'apps/sri-lakshmi-web/dist' : template === 'hospital-editorial' ? 'apps/hospital-editorial-web/dist' : 'apps/public-web/dist');
  const staffRoot = path.join(options.root, 'apps/staff-web/dist');
  await app.register(fastifyStatic, { root: publicRoot, prefix: '/', wildcard: false, maxAge: '1h' });
  await app.register(fastifyStatic, { root: staffRoot, prefix: '/staff/', wildcard: false, decorateReply: false, maxAge: '1h' });
  app.get('/website-config.js', async (_request, reply) => reply
    .header('cache-control', 'no-store').type('application/javascript')
    .send(`window.HMS_WEBSITE=${JSON.stringify({ bookingSite: options.bookingSite ?? null }).replaceAll('<', '\\u003c')};`));
  app.get('/staff/*', async (_request, reply) => reply.sendFile('index.html', staffRoot));
  app.get('/*', async (request, reply) => {
    const pathname = request.url.split('?')[0]!;
    // Never turn missing API endpoints or assets into a successful HTML response.
    if (/^\/(v1|public|api|tele|assets)(\/|$)/.test(pathname) || path.extname(pathname)) return reply.callNotFound();
    return reply.sendFile('index.html', publicRoot);
  });
}
