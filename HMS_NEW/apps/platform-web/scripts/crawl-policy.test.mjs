import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Read the tiny pure TS module without a new runtime dependency.
const source=readFileSync(new URL('../src/lib/crawl-policy.ts',import.meta.url),'utf8').replace(/: string/g,'').replace(/: boolean/g,'');
const {searchHeader,runtimeContentPolicy}=await import('data:text/javascript,'+encodeURIComponent(source));
test('public crawling is enabled only for configured public marketing pages',()=>{
 for(const path of ['/','/blog/a-clearer-front-desk','/product/features','/llms.txt','/sitemap.xml']) assert.match(searchHeader(path,true),/^index, follow/);
 for(const path of ['/business-report','/business-report?place=abc','/business-lookup','/demo/reach-report','/admin','/onboarding','/website-templates/standard','/website-templates/sri-lakshmi']) assert.match(searchHeader(path.split('?')[0],true),/noindex/);
 assert.match(searchHeader('/',false),/noindex/);
});
test('SSR CSP trusts only its server nonce and keeps framing and form restrictions',()=>{
 const policy=runtimeContentPolicy('server-generated-nonce');
 assert.ok(policy.includes("'nonce-server-generated-nonce'"));
 assert.ok(!policy.includes("script-src 'unsafe-inline'"));assert.ok(!policy.includes('unsafe-eval'));
 assert.ok(policy.includes("frame-ancestors 'self'"));assert.ok(policy.includes("form-action 'none'"));
});
test('a final HTTPS origin enables crawling while previews remain closed',async()=>{
 const {transpileModule,ModuleKind}=await import('typescript');
 const ts=readFileSync(new URL('../src/lib/site.ts',import.meta.url),'utf8');
 const js=transpileModule(ts,{compilerOptions:{module:ModuleKind.ESNext}}).outputText;
 const previousOrigin=process.env.NEXT_PUBLIC_SITE_ORIGIN, previousFlag=process.env.NEXT_PUBLIC_SEARCH_INDEXING;
 try {
  process.env.NEXT_PUBLIC_SITE_ORIGIN='https://example.org'; process.env.NEXT_PUBLIC_SEARCH_INDEXING='true';
  const enabled=await import('data:text/javascript,'+encodeURIComponent(js)+'#configured');
  assert.equal(enabled.SEARCH_ENABLED,true);
  assert.equal(enabled.publicOrigin('http://localhost:4490'),'');
  process.env.NEXT_PUBLIC_SEARCH_INDEXING='false';
  const disabled=await import('data:text/javascript,'+encodeURIComponent(js)+'#preview');
  assert.equal(disabled.SEARCH_ENABLED,false);
 } finally {
  if(previousOrigin===undefined)delete process.env.NEXT_PUBLIC_SITE_ORIGIN;else process.env.NEXT_PUBLIC_SITE_ORIGIN=previousOrigin;
  if(previousFlag===undefined)process.env.NEXT_PUBLIC_SEARCH_INDEXING='true';else process.env.NEXT_PUBLIC_SEARCH_INDEXING=previousFlag;
 }
});
test('production robots allow documented AI crawlers and keep paid lookup excluded',async()=>{
 const {transpileModule,ModuleKind}=await import('typescript');
 const ts=readFileSync(new URL('../src/app/robots.ts',import.meta.url),'utf8').replace(/import \{SEARCH_ENABLED,SITE_ORIGIN\} from '[^']+';/,"const SEARCH_ENABLED=true, SITE_ORIGIN='https://example.org';");
 const js=transpileModule(ts,{compilerOptions:{module:ModuleKind.ESNext}}).outputText;
 const {default:robots}=await import('data:text/javascript,'+encodeURIComponent(js));
 const policy=robots();assert.equal(policy.sitemap,'https://example.org/sitemap.xml');
 const agents=policy.rules.flatMap(rule=>Array.isArray(rule.userAgent)?rule.userAgent:[rule.userAgent]);
 for(const agent of ['*','OAI-SearchBot','GPTBot','ChatGPT-User','ClaudeBot','Claude-SearchBot','Claude-User','PerplexityBot','Perplexity-User','Googlebot'])assert.ok(agents.includes(agent),agent);
 for(const rule of policy.rules){assert.equal(rule.allow,'/');assert.ok(rule.disallow.includes('/business-lookup'));assert.ok(!rule.disallow.includes('/'));}
});
