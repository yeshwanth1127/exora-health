import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import config from '../next.config.mjs';
import {transpileModule,ModuleKind} from 'typescript';
function loadPolicy(file,replace=source=>source) {
 const source=replace(readFileSync(new URL(file,import.meta.url),'utf8'));
 return import('data:text/javascript,'+encodeURIComponent(transpileModule(source,{compilerOptions:{module:ModuleKind.ESNext}}).outputText));
}
test('SSR forwards control onboarding and lookup to separate services',async()=>{
 const rewrites=await config.rewrites();
 assert.ok(rewrites.some(rule=>rule.source==='/control/:path*'&&rule.destination==='http://127.0.0.1:3040/control/:path*'));
 assert.ok(rewrites.some(rule=>rule.source==='/business-lookup'&&rule.destination==='http://127.0.0.1:4500/business-lookup'));
});
test('SSR preserves onboarding writes, protects report indexing and uses fresh CSP nonces',async()=>{
 const fakeNext=`class NextResponse { constructor(body,init={}) {this.status=init.status||200;this.headers=new Headers(init.headers);} static next(options={}){const value=new NextResponse();value.forward=options;return value;} } const SEARCH_ENABLED=true; const runtimeContentPolicy=nonce=>"script-src 'nonce-"+nonce+"'";const searchHeader=path=>/^\\/(quote|onboarding|business-report)/.test(path)?'noindex, nofollow':'index, follow';`;
 const {middleware}=await loadPolicy('../src/middleware.ts',source=>source.replace(/^import .*;\n/gm,'')+'\n'+fakeNext);
 const request=(path,method='GET')=>({nextUrl:{pathname:path},method,headers:new Headers({'x-nonce':'untrusted'})});
 assert.equal(middleware(request('/control/v1/onboarding','POST')).status,200);
 for(const path of ['/quote','/onboarding','/business-report']){const response=middleware(request(path));assert.equal(response.status,200);assert.match(response.headers.get('X-Robots-Tag'),/noindex/);}
 assert.equal(middleware(request('/','POST')).status,405);
 const first=middleware(request('/')),second=middleware(request('/'));
 assert.notEqual(first.forward.request.headers.get('x-nonce'),second.forward.request.headers.get('x-nonce'));
 assert.notEqual(first.forward.request.headers.get('x-nonce'),'untrusted');
});
