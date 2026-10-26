import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {publishable,contentPolicy,blockedRoute,hostingRules} from './package-public.mjs';
test('deployment excludes account routes and source artifacts while retaining runtime data',()=>{
 for(const file of ['quote.html','onboarding/welcome.html','api/signup.txt','.env','assets/notes/prompts.json','assets/art/index.html','assets/art/source.zip','assets/art/references/original.png','_next/static/main.js.map']) assert.equal(publishable(file),false,file);
 for(const file of ['index.html','product/features.html','demo/overview.html','_next/static/main.js','assets/art/doctor.webp','assets/font/OFL.txt','product/features.txt']) assert.equal(publishable(file),true,file);
 assert.ok(blockedRoute.test('/onboarding/workspace')); assert.ok(!blockedRoute.test('/product/features'));
});
test('CSP permits exact hydration script bytes without allowing arbitrary inline scripts',()=>{
 const script='self.__next_f.push([1,"hello"])';const hash=createHash('sha256').update(script).digest('base64');
 const policy=contentPolicy('<html><script>'+script+'</script><script src="/app.js"></script></html>');
 assert.ok(policy.includes("'sha256-"+hash+"'"));assert.ok(!policy.includes("script-src 'unsafe-inline'"));assert.ok(!policy.includes('unsafe-eval'));assert.ok(policy.includes("form-action 'none'"));
});
test('hosting config denies mutations, listings and workspace routes without blocking same-origin showcase frames',()=>{
 assert.match(hostingRules,/Options -Indexes/);assert.match(hostingRules,/GET\|HEAD/);assert.match(hostingRules,/R=405/);assert.match(hostingRules,/SAMEORIGIN/);assert.match(hostingRules,/noindex, nofollow/);
});
